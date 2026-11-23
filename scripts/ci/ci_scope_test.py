#!/usr/bin/env python3
"""K-107 の試験：チケットごとの CI の範囲を決める台本（scripts/ci/ci_scope.py）と、それを使う workflow の形。

  python3 scripts/ci/ci_scope_test.py           全部の行（行 ID は K107-CS-NNN。チケット 11_tickets/K-107.md の「テスト仕様と確認の結果」と 1 対 1）

  作りものの git の写し（tempfile の中）に小さなワークスペース（packages/a ← packages/b ← apps/w、apps/x はひとり）を作り、
  ファイルを変えたコミットを足して ci_scope.plan() / main() に渡す。vitest で試験を出す所（list_tests：渡したファイルに
  import で関わる試験／db_tests：DB を使う試験）は差し替える（import の辿りは vitest 自身の働き。本物は CS-053 で確かめる）。
  list_tests は渡したファイルごとの答え（{ファイル: [試験…]}）を返す（どの src がどの試験で受けられているかを見るため）。
  本物のリポジトリを読む行（CS-030〜032・CS-034・CS-047・CS-053）は、本物の pnpm・node・決まりのファイル・生成した v3-gate.yml を読む。
  CI の中（環境の CI がある）では、道具が無いことを skip にせず赤にする（CS-030・CS-053）。
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
import ci_scope  # noqa: E402  （実装はこのチケットで作る）

IN_CI = bool(os.environ.get("CI"))

# 作りもののワークスペースの決まり（本物の scripts/ci/ci_scope.json と同じ形）
RULES = {
    # migration・SQL・行の守り・権限は「DB の範囲」：DB の組＋migration の lint＋DB を使う試験を全部（全部の試験ではない）
    "db": {
        "paths": ["packages/a/migrations/**", "packages/a/policies/**"],
        "migrations": ["packages/a/migrations/**"],
        # migration の並び（ここに足した行が、足した migration のファイル名とだけ一致するなら DB の範囲。ほかの変更は共通の部品）
        "migration_list": {"file": "packages/a/src/index.ts", "entry": r'^\s*"([^"/]+\.sql)",?\s*$'},
        "gateway": ["packages/a/**"],                            # 関門 C2（永続化）の中。import でここに届く試験は DB を使う
        "markers": [r"from\s+['\"]pg['\"]", r"\bDATABASE_URL\b"],   # 関門を通らずに DB に触る試験（文字で見分ける）
    },
    "full": {
        "ci": [".github/**", "scripts/ci/**", "vitest.config.ts", "**/tsconfig*.json"],  # 本物と同じくパッケージの tsconfig も ci の類（K170-CS-013）
        "lockfile": ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "**/package.json"],
    },
    "shared_min_dependents": 2,
    "files_per_shard": 3,
    "affects_required_from": 108,
    "coverage_src": {"include": ["apps/*/src/**/*.ts", "packages/*/src/**/*.ts"], "exclude": ["**/*.test.ts"]},
    "no_test_paths": ["01_hearing/**", "11_tickets/**", "README.md", "07_qa/specs/**"],
    "data_links": [
        {"paths": ["07_qa/plan.json"], "tests": ["apps/x/test/plan.test.ts"]},
        {"paths": ["07_qa/load.json"], "readers": ["apps/x/src/load.ts"]},   # src が読む：読む src に関わる試験を流す
        # 試験が子プロセスで起こす・文字として読む src（apps/bridge/src のような物）：import では辿れないので試験を名指し
        {"paths": ["apps/w/src/spawned.ts"], "tests": ["apps/w/test/page.test.ts"]},
    ],
    "reads_ok": {},
    "jobs": {
        "database": {"packages": ["a", "b", "w"], "paths": ["08_api/**"]},
        "web": {"packages": ["w"], "paths": ["07_qa/specs/web/**"]},
    },
}

# 引数の名前に . や - を書けないので、ファイルの名前だけ表で直す
NAMES = {"tsconfig_json": "tsconfig.json", "main_ts": "main.ts", "page_ts": "page.ts", "index_ts": "index.ts", "i_ts": "i.ts", "0002_sql": "0002.sql",
         "q_sql": "q.sql", "package_json": "package.json", "main_test_ts": "main.test.ts", "README_md": "README.md",
         "pnpm_lock_yaml": "pnpm-lock.yaml", "p_sql": "p.sql", "new_ts": "new.ts"}

MIG1 = 'export const MIGRATIONS = [\n  "0001.sql",\n];\nexport const a = 1;\n'
MIG2 = 'export const MIGRATIONS = [\n  "0001.sql",\n  "0002.sql",\n];\nexport const a = 1;\n'


def git(repo: pathlib.Path, *args: str) -> str:
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"}
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True, env=env).stdout.strip()


def write(repo: pathlib.Path, rel: str, text: str) -> None:
    p = repo / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def pkg(name: str, deps: list[str]) -> str:
    return json.dumps({"name": name, "version": "0.0.0", "dependencies": {d: "workspace:*" for d in deps}})


def ticket(tid: str, affects: list[str] | None, ci_wide: list[str] | None = None, **extra: str) -> str:
    lines = ["---", f"id: {tid}", "title: 試し", f"kind: {extra.pop('kind', 'タスク')}", "stage: 作業中"]
    if affects is not None:
        lines.append(f"affects: [{', '.join(affects)}]")
    if ci_wide is not None:
        lines.append(f"ci_wide: [{', '.join(ci_wide)}]")
    lines += [f"{k}: {v}" for k, v in extra.items()]
    lines += ["---", "## 目的", "", "試し", ""]
    return "\n".join(lines)


def parse_gh_output(text: str) -> dict[str, str]:
    """GitHub の $GITHUB_OUTPUT の形（key<<区切り … 区切り）を読む。key=value の 1 行の形は使わない決まりなので、あれば別に返す"""
    out: dict[str, str] = {}
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        m = re.fullmatch(r"([A-Za-z_][A-Za-z0-9_]*)<<(\S+)", lines[i])
        if m:
            key, delim, val = m.group(1), m.group(2), []
            i += 1
            while lines[i] != delim:
                val.append(lines[i])
                i += 1
            out[key] = "\n".join(val)
        elif lines[i].strip():
            out.setdefault("__plain__", "")
            out["__plain__"] += lines[i] + "\n"
        i += 1
    return out


class Repo:
    """packages/a ← packages/b ← apps/w（w は b を、b は a を使う）・apps/x はひとり"""

    def __init__(self) -> None:
        self.dir = pathlib.Path(tempfile.mkdtemp(prefix="k107-"))
        self.calls: list[list[str]] = []
        r = self.dir
        git(r, "init", "-q", "-b", "main")
        write(r, "package.json", json.dumps({"name": "root", "private": True}))
        write(r, "pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\n')
        write(r, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n")
        write(r, "packages/a/package.json", pkg("a", []))
        write(r, "packages/a/src/index.ts", MIG1)
        write(r, "packages/a/migrations/0001.sql", "select 1;\n")
        write(r, "packages/a/test/rows.test.ts", "import pg from 'pg';\n")   # DB を使う試験
        write(r, "packages/b/package.json", pkg("b", ["a"]))
        write(r, "packages/b/src/index.ts", "export const b = 2;\n")
        write(r, "packages/b/test/b.test.ts", "import { b } from '../src/index';\n")
        write(r, "apps/w/package.json", pkg("w", ["b"]))
        write(r, "apps/w/src/page.ts", "export const w = 3;\n")
        write(r, "apps/w/test/page.test.ts", "import { w } from '../src/page';\n")
        write(r, "apps/w/test/flow.test.ts", "// 中間の試験（QA のチケット K-9 が持つ）\n")
        write(r, "apps/x/package.json", pkg("x", []))
        write(r, "apps/x/src/main.ts", "export const x = 4;\n")
        write(r, "apps/x/src/load.ts", "import { readFileSync } from 'node:fs';\nexport const l = readFileSync('07_qa/load.json');\n")
        write(r, "apps/x/test/main.test.ts", "import { x } from '../src/main';\n")
        write(r, "apps/x/test/plan.test.ts", "import { readFileSync } from 'node:fs';\n")
        write(r, "07_qa/plan.json", "{}\n")
        write(r, "07_qa/load.json", "{}\n")
        write(r, "README.md", "試し\n")
        write(r, "11_tickets/K-1.md", ticket("K-1", ["x"]))
        write(r, "11_tickets/K-2.md", ticket("K-2", ["x"]))
        git(r, "add", "-A")
        git(r, "commit", "-q", "-m", "K-0 chore: 土台")
        self.base = git(r, "rev-parse", "HEAD")

    def commit(self, msg: str = "K-1 feat: 試し", **files: str | None) -> str:
        """files: パス → 中身。None は消す。パスの / は __ で書き、名前の最後の部分は NAMES で直す（main_ts → main.ts）"""
        for key, text in files.items():
            *dirs, last = key.split("__")
            rel = "/".join([*dirs, NAMES.get(last, last)])
            if text is None:
                git(self.dir, "rm", "-q", rel)
            else:
                write(self.dir, rel, text)
        git(self.dir, "add", "-A")
        git(self.dir, "commit", "-q", "--allow-empty", "-m", msg)
        return git(self.dir, "rev-parse", "HEAD")

    def plan(self, head: str = "HEAD", scope: str = "auto", tests: list[str] | dict | None = None, base: str | None = None,
             db_tests: list[str] | None = None, list_tests=None, db_fn=None) -> dict:
        """tests：list なら渡したどのファイルにもその試験が関わる、dict なら {ファイル: [試験]}（無いファイルは 0 本）"""
        def lt(files: list[str]) -> dict[str, list[str]]:
            self.calls.append(sorted(files))
            if isinstance(tests, dict):
                return {f: list(tests.get(f, [])) for f in files}
            return {f: list(tests or []) for f in files}
        db = db_fn or (lambda: list(db_tests if db_tests is not None else ["packages/a/test/rows.test.ts"]))
        return ci_scope.plan(str(self.dir), base if base is not None else self.base, head, scope, rules=RULES,
                             tickets_dir=str(self.dir / "11_tickets"), list_tests=list_tests or lt, db_tests=db)

    def close(self) -> None:
        shutil.rmtree(self.dir, ignore_errors=True)


class Base(unittest.TestCase):
    def setUp(self) -> None:
        self.r = Repo()

    def tearDown(self) -> None:
        self.r.close()


class MapTest(Base):
    """依存の地図（パッケージの依存）で、変えたファイルから影響の範囲を出す"""

    def test_K107_CS_001_one_app_only(self) -> None:
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(set(p["changed_packages"]), {"x"})
        self.assertEqual(set(p["affected"]), {"x"})
        self.assertEqual(p["unit_files"], ["apps/x/test/main.test.ts"])
        self.assertEqual(p["unit_shards"], 1)
        self.assertEqual(self.r.calls, [["apps/x/src/main.ts"]])   # vitest には変えたファイルだけを渡す
        self.assertEqual(p["errors"], [])

    def test_K107_CS_002_dependents_follow(self) -> None:
        self.r.commit("K-1 feat: b", packages__b__src__index_ts="export const b = 9;\n",
                      **{"11_tickets__K-1.md": ticket("K-1", ["b"])})
        p = self.r.plan(tests=["apps/w/test/page.test.ts", "packages/b/test/b.test.ts"])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(set(p["affected"]), {"b", "w"})   # b を使う w も入る。b が使う a は入らない
        self.assertTrue(p["jobs"]["web"])

    def test_K107_CS_003_shared_part_is_full(self) -> None:
        # a は b と（b を通して）w に使われる＝依存される数 2 以上＝共通の部品
        self.r.commit("K-1 feat: a", packages__a__src__index_ts=MIG1 + "export const z = 7;\n",
                      **{"11_tickets__K-1.md": ticket("K-1", ["a"], ["shared"])})
        p = self.r.plan(tests={"packages/a/src/index.ts": ["packages/b/test/b.test.ts", "apps/w/test/page.test.ts"]})
        self.assertEqual(p["mode"], "scoped", p["reasons"])        # K-170：共通の部品でも全部に倒さず、使い手の試験まで
        self.assertIn("shared", {c for c, _ in p["full_reasons"]})
        self.assertNotEqual(p["unit_shards"], 6)
        self.assertIn("apps/w/test/page.test.ts", p["unit_files"])
        self.assertEqual(ci_scope.shared_packages(ci_scope.workspace(str(self.r.dir)), 2), {"a"})

    def test_K107_CS_009_deleted_file(self) -> None:
        self.r.commit(apps__x__src__main_ts=None)
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(set(p["changed_packages"]), {"x"})
        self.assertIn(("D", "apps/x/src/main.ts"), {(c.status, c.path) for c in p["changes"]})
        self.assertEqual(self.r.calls, [["apps/x/src/main.ts"]])   # 消したファイルも vitest に渡す（それを import していた試験を出す）
        self.assertEqual(p["coverage_args"], ["--coverage.enabled=false"])   # 消した src は測らない（残った src が無い）
        self.assertEqual(p["errors"], [])   # 消した src は「試験の無いコード」にしない
        # 消したファイルは import の地図から消えるので、持ち主のパッケージと使い手の試験のファイルを全部足す
        self.assertEqual(p["unit_files"], ["apps/x/test/main.test.ts", "apps/x/test/plan.test.ts"])

    def test_K107_CS_010_rename_counts_both_sides(self) -> None:
        git(self.r.dir, "mv", "apps/x/src/main.ts", "apps/w/src/main.ts")
        self.r.commit("K-1 refactor: 移す", **{"11_tickets__K-1.md": ticket("K-1", ["w", "x"])})
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(set(p["changed_packages"]), {"w", "x"})
        self.assertEqual(p["mismatches"], [])
        (ch,) = [c for c in p["changes"] if c.path == "apps/w/src/main.ts"]
        self.assertTrue(ch.status.startswith("R"), ch)
        self.assertEqual(ch.old, "apps/x/src/main.ts")
        self.assertEqual(self.r.calls, [["apps/w/src/main.ts", "apps/x/src/main.ts"]])   # 元と先の両方
        # 名前を変えた元（x）は地図から消えるので、x とその使い手の試験のファイルを全部足す
        for f in ("apps/x/test/main.test.ts", "apps/x/test/plan.test.ts"):
            self.assertIn(f, p["unit_files"])

    def test_K107_CS_056_deleted_file_adds_owner_and_dependents(self) -> None:
        self.r.commit("K-1 refactor: 消す", packages__b__src__index_ts=None, **{"11_tickets__K-1.md": ticket("K-1", ["b"])})
        p = self.r.plan(tests=[])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], ["apps/w/test/flow.test.ts", "apps/w/test/page.test.ts", "packages/b/test/b.test.ts"])

    def test_K107_CS_011_test_only_change(self) -> None:
        self.r.commit(apps__x__test__main_test_ts="import { x } from '../src/main';\n// 足した\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(set(p["changed_packages"]), {"x"})
        self.assertEqual(p["unit_files"], ["apps/x/test/main.test.ts"])
        self.assertFalse(p["jobs"]["database"])
        self.assertEqual(p["coverage_args"], ["--coverage.enabled=false"])   # 変えた src が無い

    def test_K107_CS_016_non_import_file_in_package(self) -> None:
        # パッケージの中の、import に出ないファイル（.sql・.md・読むだけの .txt）は、そのパッケージと使い手の試験を全部（ファイルに開いて渡す）
        self.r.commit("K-1 feat: 文", packages__b__sql__q_sql="select 2;\n",
                      **{"11_tickets__K-1.md": ticket("K-1", ["b"])})
        p = self.r.plan(tests=[])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], ["apps/w/test/flow.test.ts", "apps/w/test/page.test.ts", "packages/b/test/b.test.ts"])
        self.assertEqual(p["unit_shards"], 1)

    def test_K107_CS_027_japanese_file_name(self) -> None:
        self.r.commit(**{"apps__x__src__名前.ts": "export const n = 1;\n"})
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertIn("apps/x/src/名前.ts", {c.path for c in p["changes"]})   # git diff -z で読む（\343… に化けない）
        self.assertEqual(set(p["changed_packages"]), {"x"})

    def test_K107_CS_033_merge_commit_head(self) -> None:
        # pm_merge.sh は取り込みのコミット（親が main とブランチ）で CI を流す。比べる元は main の先頭
        git(self.r.dir, "checkout", "-q", "-b", "work")
        self.r.commit(apps__x__src__main_ts="export const x = 6;\n")
        git(self.r.dir, "checkout", "-q", "main")
        self.r.commit("K-2 docs: 別のチケット", README_md="変えた\n")
        main_tip = git(self.r.dir, "rev-parse", "HEAD")
        git(self.r.dir, "merge", "-q", "--no-ff", "-m", "K-1 merge: 取り込み", "work")
        p = self.r.plan(base=main_tip, tests=["apps/x/test/main.test.ts"])
        self.assertEqual({c.path for c in p["changes"]}, {"apps/x/src/main.ts"})
        self.assertEqual(p["tickets"], ["K-1"])

    def test_K107_CS_043_rename_out_of_protected_path(self) -> None:
        # 名前を変えて、全部にする場所（.github）から外へ出した：元のパスで全部
        write(self.r.dir, ".github/workflows/gate.yml", "name: gate\n")
        self.r.commit("K-0 chore: 足す")
        base = git(self.r.dir, "rev-parse", "HEAD")
        (self.r.dir / "01_hearing").mkdir(exist_ok=True)   # git mv は行き先の dir を作らない
        git(self.r.dir, "mv", ".github/workflows/gate.yml", "01_hearing/gate.yml")
        self.r.commit("K-1 chore: 移す", **{"11_tickets__K-1.md": ticket("K-1", [], ["ci"])})
        p = self.r.plan(base=base)
        self.assertEqual(p["mode"], "scoped", p["reasons"])        # K-170：CI の設定でも全部に倒さない
        self.assertIn(("ci", ".github/workflows/gate.yml"), set(p["full_reasons"]))


class FullTest(Base):
    """2026-11-11 K-170（決める人「チケットの時はチケットだけ。フォールバックもチケットごと」）：scope=auto は全部に倒さない。
    範囲を広げる理由（CI の設定・部品の版・地図に無い・共通の部品・宣言なし）はチケットの範囲で続け、決められない理由は止める"""

    def assert_full(self, p: dict, cat: str) -> None:   # scope=full（大分類の終わり）だけ
        self.assertEqual(p["mode"], "full", p)
        self.assertIn(cat, {c for c, _ in p["full_reasons"]}, p["full_reasons"])
        self.assertTrue(p["jobs"]["unit"] and p["jobs"]["database"] and p["jobs"]["web"])
        self.assertEqual(p["unit_shards"], 6)
        self.assertEqual(p["unit_files"], [])   # 全部は絞り込みの指定を渡さない（チケットの tests: も足さない）
        self.assertEqual(p["coverage_args"], [])   # 全部は vitest.config.ts の coverage のまま

    def assert_ticket(self, p: dict, cat: str) -> None:   # 全部に倒さず、チケットの範囲で続ける
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn(cat, {c for c, _ in p["full_reasons"]}, p["full_reasons"])   # 理由は残す（スキルの block_kinds が読む）
        self.assertNotEqual(p["unit_shards"], 6, "全部の組の数になった")
        self.assertFalse(any("止める" in e for e in p["errors"]), p["errors"])

    def assert_stop(self, p: dict, cat: str) -> None:     # 範囲を決められない：全部に倒さず止める（組は流さない）
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn(cat, {c for c, _ in p["full_reasons"]}, p["full_reasons"])
        self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), p["errors"])
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})
        self.assertEqual(p["unit_shards"], 0)

    def test_K107_CS_005_lockfile(self) -> None:
        self.r.commit(pnpm_lock_yaml="lockfileVersion: '9.0'\n# 版を上げた\n", **{"11_tickets__K-1.md": ticket("K-1", [], ["lockfile"])})
        self.assert_ticket(self.r.plan(), "lockfile")

    def test_K107_CS_006_package_json_in_package(self) -> None:
        self.r.commit(apps__x__package_json=json.dumps({"name": "x", "version": "0.0.1"}),
                      **{"11_tickets__K-1.md": ticket("K-1", ["x"], ["lockfile"])})
        self.assert_ticket(self.r.plan(), "lockfile")

    def test_K107_CS_007_new_package(self) -> None:
        self.r.commit(apps__n__package_json=pkg("n", []), apps__n__src__i_ts="export {};\n",
                      **{"11_tickets__K-1.md": ticket("K-1", ["n"], ["lockfile"])})
        p = self.r.plan()
        self.assert_ticket(p, "lockfile")
        self.assertIn("n", set(p["changed_packages"]))

    def test_K107_CS_008_ci_settings(self) -> None:
        self.r.commit(**{".github__workflows__gate.yml": "name: gate\n", "11_tickets__K-1.md": ticket("K-1", [], ["ci"])})
        self.assert_ticket(self.r.plan(), "ci")

    def test_K107_CS_012_no_changes(self) -> None:
        p = self.r.plan(head=self.r.base)   # 比べる元と同じ＝変えたファイルが無い（比べる元の取り違えを緑にしない）
        self.assert_stop(p, "empty")

    def test_K107_CS_014_unmapped_root_file(self) -> None:
        # どのパッケージにも、no_test_paths にも、data_links にも無い。jobs.database.paths に当たっても地図には数えない（unmapped が先）
        self.r.commit(**{"08_api__openapi.yaml": "openapi: 3.1.0\n", "11_tickets__K-1.md": ticket("K-1", [], [])})
        self.assert_ticket(self.r.plan(), "unmapped")

    def test_K107_CS_017_scope_full_input(self) -> None:
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        self.assert_full(self.r.plan(scope="full"), "requested")

    def test_K107_CS_018_bad_base(self) -> None:
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        self.assert_stop(self.r.plan(base="0" * 40), "base")
        self.assert_stop(self.r.plan(base=""), "base")

    def test_K107_CS_023_no_ticket_in_commits(self) -> None:
        self.r.commit("feat: 番号なし", apps__x__src__main_ts="export const x = 5;\n")
        self.assert_stop(self.r.plan(), "ticket")

    def test_K107_CS_024_two_tickets(self) -> None:
        self.r.commit("K-1 feat: 1", apps__x__src__main_ts="export const x = 5;\n")
        self.r.commit("K-2 feat: 2", apps__x__src__main_ts="export const x = 6;\n")
        self.assert_stop(self.r.plan(), "ticket")

    def test_K107_CS_022_ticket_without_declaration(self) -> None:
        # 仕組みの前に切ったチケット（K-107 まで・affects が無い）は全部を流す。赤にはしない
        self.r.commit("K-1 feat: x", apps__x__src__main_ts="export const x = 5;\n",
                      **{"11_tickets__K-1.md": ticket("K-1", None)})
        p = self.r.plan()
        self.assert_ticket(p, "no-declaration")
        self.assertEqual(p["mismatches"], [])

    def test_K107_CS_050_inputs_are_validated(self) -> None:
        # workflow の入力は外から来る。決まった形でなければ全部（命令として使わない）
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        self.assert_stop(self.r.plan(scope="auto; touch pwned"), "requested")
        self.assert_stop(self.r.plan(base="HEAD~1; touch pwned"), "base")
        self.assert_stop(self.r.plan(base="main"), "base")   # 比べる元は 40 桁のコミットだけ
        self.assertFalse((self.r.dir / "pwned").exists())

    def test_K107_CS_054_tool_failure_is_full(self) -> None:
        # vitest の辿り（vitest_related.mjs）が落ちた・形の違う答えを返したら、絞らずに全部
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")

        def boom(_files: list[str]) -> dict:
            raise ci_scope.ToolError("vitest_related.mjs が 1 で終わった")
        self.assert_stop(self.r.plan(list_tests=boom), "tool")
        self.r.commit("K-1 feat: 表", packages__a__migrations__0002_sql="create table t();\n", packages__a__src__index_ts=MIG2,
                      **{"11_tickets__K-1.md": ticket("K-1", ["a", "x"], ["db"])})

        def boom_db() -> list[str]:
            raise ci_scope.ToolError("DB を使う試験を出せない")
        self.assert_stop(self.r.plan(tests=["apps/x/test/main.test.ts"], db_fn=boom_db), "tool")


class DbRangeTest(Base):
    """migration・SQL・行の守り・権限：import の地図に出ない「隠れた依存」。全部ではなく、DB の組＋migration の lint＋DB を使う試験を全部"""

    DB_TESTS = ["apps/w/test/rows.test.ts", "packages/a/test/rows.test.ts", "packages/b/test/repo.test.ts"]

    def migrate(self, **more: str) -> None:
        # migration を足し、並び（packages/a/src/index.ts の MIGRATIONS）にその名前の行だけを足す
        self.r.commit("K-1 feat: 表", packages__a__migrations__0002_sql="create table t();\n", packages__a__src__index_ts=MIG2,
                      **{"11_tickets__K-1.md": ticket("K-1", ["a"], ["db"]), **more})

    def test_K107_CS_004_migration_selects_db_tests(self) -> None:
        # a は共通の部品（使い手 2 つ）だが、migration と並びの 1 行だけなら「共通の部品」の全部にはしない
        self.migrate()
        p = self.r.plan(tests=[], db_tests=self.DB_TESTS)
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn("db", {c for c, _ in p["wide_reasons"]})
        self.assertNotIn("shared", {c for c, _ in p["wide_reasons"]})
        self.assertEqual(p["jobs"], {"unit": True, "database": True, "web": False})
        self.assertEqual(p["migration_files"], ["packages/a/migrations/0002.sql"])   # migration の lint に渡す（変えた物だけ）
        self.assertEqual(p["mismatches"], [])
        self.assertEqual(p["errors"], [])   # 並びの src（index.ts）は DB を使う試験が受けるので「試験の無いコード」にしない
        self.assertEqual(p["coverage_args"], ["--coverage.enabled=false"])   # 並びの 1 行だけなら index.ts は測らない

    def test_K107_CS_035_migration_only_db_tests_not_others(self) -> None:
        # migration だけ変えた写しで、DB を使う試験が全部選ばれ、DB を使わない試験は選ばれない
        self.migrate()
        p = self.r.plan(tests=[], db_tests=self.DB_TESTS)
        self.assertEqual(p["unit_files"], sorted(self.DB_TESTS))
        for not_db in ("apps/x/test/main.test.ts", "apps/x/test/plan.test.ts", "packages/b/test/b.test.ts"):
            self.assertNotIn(not_db, p["unit_files"])
        self.assertEqual(p["unit_shards"], 1)   # 3 本・1 つの組に 3 本まで（files_per_shard）

    def test_K107_CS_036_db_range_shards(self) -> None:
        self.r.commit("K-1 feat: 行の守り", packages__a__policies__p_sql="create policy p on t;\n",
                      **{"11_tickets__K-1.md": ticket("K-1", ["a"], ["db"])})
        p = self.r.plan(tests=[], db_tests=[])
        self.assertEqual(p["migration_files"], [])   # 行の守りは DB の範囲だが migration ではない（lint は migration だけ）
        # 組の数＝ceil(本数 ÷ 3) を 1〜6 に収める（3→1・4→2・6→2・7→3・18→6・20→6）
        for n, shards in ((3, 1), (4, 2), (6, 2), (7, 3), (18, 6), (20, 6)):
            many = [f"packages/a/test/t{i:02d}.test.ts" for i in range(n)]
            self.assertEqual(self.r.plan(tests=[], db_tests=many)["unit_shards"], shards, n)

    def test_K107_CS_037_db_range_plus_code(self) -> None:
        # migration と、DB を使わない部品のコードを両方変えた：DB を使う試験 ∪ そのコードに関わる試験（並べて重なりを除く）
        self.migrate(apps__x__src__main_ts="export const x = 5;\n",
                     **{"11_tickets__K-1.md": ticket("K-1", ["a", "x"], ["db"])})
        p = self.r.plan(tests=["apps/x/test/main.test.ts", "packages/a/test/rows.test.ts"], db_tests=self.DB_TESTS)
        self.assertEqual(p["unit_files"], sorted(set(self.DB_TESTS) | {"apps/x/test/main.test.ts"}))

    def test_K107_CS_038_db_tests_detector(self) -> None:
        # DB を使う試験の見分け方（vitest の import の地図で関門 C2 の中に届く ∪ 文字で pg・DATABASE_URL）の文字の側
        write(self.r.dir, "apps/x/test/env.test.ts", "const u = process.env.DATABASE_URL;\n")
        got = ci_scope.db_tests_by_text(str(self.r.dir), RULES)
        self.assertIn("packages/a/test/rows.test.ts", got)   # import pg
        self.assertIn("apps/x/test/env.test.ts", got)        # DATABASE_URL
        self.assertNotIn("apps/x/test/main.test.ts", got)

    def test_K107_CS_039_migration_list_other_change_is_shared(self) -> None:
        # 並びの行の足し方が決まりと違うものは、共通の部品の変更として全部
        cases = {
            "名前がファイルと合わない": MIG1.replace('  "0001.sql",\n', '  "0001.sql",\n  "0003.sql",\n'),
            "行を消した": 'export const MIGRATIONS = [\n];\nexport const a = 1;\n',
            "並びの外も変えた": MIG2.replace("export const a = 1;", "export const a = 2;"),
        }
        for label, text in cases.items():
            with self.subTest(label):
                self.r.close()
                self.r = Repo()
                self.r.commit("K-1 feat: 表", packages__a__migrations__0002_sql="create table t();\n", packages__a__src__index_ts=text,
                              **{"11_tickets__K-1.md": ticket("K-1", ["a"], ["db", "shared"])})
                p = self.r.plan(tests=[], db_tests=self.DB_TESTS)
                self.assertEqual(p["mode"], "scoped", label)   # K-170：全部に倒さない
                self.assertIn(("shared", "packages/a/src/index.ts"), set(p["full_reasons"]), label)


class TicketTest(Base):
    """チケットに書いた影響の範囲（affects・ci_wide）と、機械で出した範囲を突き合わせる"""

    def test_K107_CS_019_declared_matches(self) -> None:
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        self.assertEqual(self.r.plan(tests=["apps/x/test/main.test.ts"])["mismatches"], [])

    def test_K107_CS_020_declared_misses_package(self) -> None:
        self.r.commit("K-1 feat: x と w", apps__x__src__main_ts="export const x = 5;\n", apps__w__src__page_ts="export const w = 4;\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(len(p["mismatches"]), 1, p["mismatches"])
        self.assertIn("w", p["mismatches"][0])
        self.assertIn("チケットに無い", p["mismatches"][0])

    def test_K107_CS_021_declared_extra_package(self) -> None:
        self.r.commit("K-1 feat: x", apps__x__src__main_ts="export const x = 5;\n",
                      **{"11_tickets__K-1.md": ticket("K-1", ["x", "b"])})
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(len(p["mismatches"]), 1, p["mismatches"])
        self.assertIn("b", p["mismatches"][0])
        self.assertIn("変わっていない", p["mismatches"][0])

    def test_K107_CS_025_ci_wide_both_ways(self) -> None:
        # migration に触ったのにチケットの ci_wide に db が無い → 赤
        self.r.commit("K-1 feat: 表", packages__a__migrations__0002_sql="create table t();\n", packages__a__src__index_ts=MIG2,
                      **{"11_tickets__K-1.md": ticket("K-1", ["a"], [])})
        p = self.r.plan()
        self.assertTrue(any("db" in m for m in p["mismatches"]), p["mismatches"])
        # 書いたのに触っていない → 赤
        self.r.commit("K-1 feat: x", **{"11_tickets__K-1.md": ticket("K-1", ["a", "x"], ["db", "lockfile"])},
                      apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertTrue(any("lockfile" in m for m in p["mismatches"]), p["mismatches"])

    def test_K107_CS_045_ticket_file_missing_is_red(self) -> None:
        # コミットの番号のチケットのファイルが無い → 赤（全部に倒した値も書く）
        self.r.commit("K-99 feat: x", apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["mode"], "scoped")                       # K-170：全部に倒さず止める
        self.assertTrue(any("K-99" in m for m in p["mismatches"]), p["mismatches"])
        self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), p["errors"])

    def test_K107_CS_046_new_ticket_without_affects_is_red(self) -> None:
        # 番号で比べる（文字で比べると K-1070 < K-108・K-10 > K-107 を取り違える）
        for tid, red in (("K-108", True), ("K-1070", True), ("K-107", False), ("K-10", False)):
            with self.subTest(tid):
                self.r.close()
                self.r = Repo()
                self.r.commit(f"{tid} feat: x", apps__x__src__main_ts="export const x = 5;\n",
                              **{f"11_tickets__{tid}.md": ticket(tid, None)})
                p = self.r.plan(tests=["apps/x/test/main.test.ts"])
                self.assertEqual(p["mode"], "scoped", tid)       # K-170：赤（食い違い）は止める・宣言なしはチケットの範囲
                self.assertEqual(bool(p["mismatches"]), red, (tid, p["mismatches"]))

    def test_K107_CS_026_main_exit_and_github_output(self) -> None:
        self.r.commit("K-1 feat: x と w", apps__x__src__main_ts="export const x = 5;\n", apps__w__src__page_ts="export const w = 4;\n")
        out = self.r.dir / "gh_output.txt"
        rules = self.r.dir / "rules.json"
        rules.write_text(json.dumps(RULES), encoding="utf-8")
        rc = ci_scope.main(["--repo", str(self.r.dir), "--base", self.r.base, "--head", "HEAD", "--scope", "auto",
                            "--rules", str(rules), "--tickets", str(self.r.dir / "11_tickets"),
                            "--no-vitest", "--github-output", str(out)])
        self.assertEqual(rc, 1)   # 食い違いは赤
        kv = parse_gh_output(out.read_text(encoding="utf-8"))
        self.assertNotIn("__plain__", kv)   # どの値も key<<区切り の形（1 行の key=value は使わない）
        # 赤でも、後ろの組が読む値は書く（食い違いのときは全部に倒す）
        for k in ("full", "unit", "database", "web", "unit_shards", "unit_files", "migration_files", "coverage_args", "base", "reasons"):
            self.assertIn(k, kv)
        self.assertEqual(kv["full"], "false")                       # K-170：赤のとき全部に倒さず、組を流さない
        self.assertEqual((kv["unit"], kv["database"], kv["web"], kv["unit_shards"]), ("false", "false", "false", "0"))
        for k in ("unit_files", "migration_files", "coverage_args"):
            self.assertIsInstance(json.loads(kv[k]), list, k)   # パスの並びは JSON（命令の文字にしない）

    def test_K107_CS_049_newline_in_path_cannot_forge_output(self) -> None:
        # 改行を含むパスは全部に倒し、出力に偽の行を作らせない
        self.r.commit("K-1 feat: 名前", **{"apps__x__src__a\nfull=false\nunit_shards=0.ts": "export {};\n"})
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["mode"], "scoped")                       # K-170：止める
        self.assertIn("badpath", {c for c, _ in p["full_reasons"]})
        self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), p["errors"])
        out = self.r.dir / "gh_output.txt"
        rules = self.r.dir / "rules.json"
        rules.write_text(json.dumps(RULES), encoding="utf-8")
        ci_scope.main(["--repo", str(self.r.dir), "--base", self.r.base, "--scope", "auto", "--rules", str(rules),
                       "--tickets", str(self.r.dir / "11_tickets"), "--no-vitest", "--github-output", str(out)])
        kv = parse_gh_output(out.read_text(encoding="utf-8"))
        self.assertEqual(kv["full"], "false")
        self.assertEqual(kv["unit_shards"], "0")
        self.assertNotIn("__plain__", kv)


class CoverageAndCountTest(Base):
    """変えた src にだけ閾値（決定 1）・試験の無いコードは赤（決定 5）・流れた数の突き合わせ"""

    def test_K107_CS_048_untested_src_is_red(self) -> None:
        self.r.commit(apps__x__src__new_ts="export const n = 1;\n")
        p = self.r.plan(tests=[])
        self.assertTrue(any("試験の無いコード" in e and "apps/x/src/new.ts" in e for e in p["errors"]), p["errors"])
        rules = self.r.dir / "rules.json"
        rules.write_text(json.dumps(RULES), encoding="utf-8")
        # main は vitest を差し替えられないので、--no-vitest（関わる試験 0 本）で同じ赤になる
        rc = ci_scope.main(["--repo", str(self.r.dir), "--base", self.r.base, "--scope", "auto", "--rules", str(rules),
                            "--tickets", str(self.r.dir / "11_tickets"), "--no-vitest"])
        self.assertEqual(rc, 1)

    def test_K107_CS_057_tested_by_any_way(self) -> None:
        # 「関わる試験」は、import の辿り・data_links の tests・中間と統合の試験・DB を使う試験のどれで受けていても数える
        self.r.commit("K-1 feat: 子プロセスで起こす", **{"apps__w__src__spawned.ts": "export {};\n", "11_tickets__K-1.md": ticket("K-1", ["w"])})
        p = self.r.plan(tests={})   # import では 0 本
        self.assertEqual(p["errors"], [], p["errors"])   # data_links の tests が受ける
        self.assertIn("apps/w/test/page.test.ts", p["unit_files"])
        # どれにも無い src は赤（import 0 本・data_links なし・DB の範囲でない）
        self.r.commit("K-1 feat: 足す", apps__w__src__page_ts="export const w = 9;\n")
        p = self.r.plan(tests={"apps/w/src/spawned.ts": []})
        self.assertTrue(any("apps/w/src/page.ts" in e for e in p["errors"]), p["errors"])
        self.assertFalse(any("spawned" in e for e in p["errors"]), p["errors"])

    def test_K107_CS_055_coverage_args(self) -> None:
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n", apps__x__test__main_test_ts="// 試験も\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["coverage_args"], ["--coverage.include=apps/x/src/main.ts"])   # 試験のファイルは測らない
        self.assertEqual(self.r.plan(scope="full")["coverage_args"], [])

    def test_K107_CS_051_argv_without_shell(self) -> None:
        # 組の中では、パスを命令の文字に入れず、引数の並びとして vitest・squawk に渡す
        files = ["apps/x/test/a b.test.ts", "apps/x/test/$(touch pwned).test.ts"]
        argv = ci_scope.unit_argv(files, shard=2, shards=3, coverage=["--coverage.include=apps/x/src/main.ts"])
        self.assertEqual(argv[:4], ["pnpm", "exec", "vitest", "run"])
        for f in files:
            self.assertIn(f, argv)
        self.assertIn("--shard=2/3", argv)
        self.assertIn("--outputFile.blob=.vitest-reports/blob-2-3.json", argv)
        self.assertIn("--coverage.include=apps/x/src/main.ts", argv)
        full = ci_scope.unit_argv([], shard=1, shards=6, coverage=[])
        self.assertIn("--shard=1/6", full)
        self.assertFalse(any(a.endswith(".test.ts") for a in full))
        self.assertEqual(ci_scope.squawk_argv(["packages/db/migrations/0087_x.sql"]),
                         ["pnpm", "exec", "squawk", "packages/db/migrations/0087_x.sql"])
        self.assertIsNone(ci_scope.squawk_argv([]))

    def test_K107_CS_059_merge_argv(self) -> None:
        # 合わせる組：blob を合わせ、json の報告（check-count が読む）を書き、絞った回は coverage_args を付ける
        argv = ci_scope.merge_argv(["--coverage.include=apps/x/src/a b.ts"])
        self.assertEqual(argv[:4], ["pnpm", "exec", "vitest", "run"])
        for a in ("--merge-reports=.vitest-reports", "--coverage", "--reporter=json",
                  "--outputFile.json=.vitest-reports/merged.json", "--coverage.include=apps/x/src/a b.ts"):
            self.assertIn(a, argv)
        full = ci_scope.merge_argv([])
        self.assertIn("--coverage", full)
        self.assertFalse(any(a.startswith("--coverage.include") or a.startswith("--coverage.thresholds") for a in full))   # 全部は vitest.config.ts の閾値

    def test_K107_CS_052_count_check(self) -> None:
        # 合わせた結果の試験のファイルと、決めた unit_files が同じか（vitest が黙って 0 本・一部だけで緑にならない）
        root = "/w/repo"
        rep = {"testResults": [{"name": f"{root}/apps/x/test/main.test.ts"}, {"name": f"{root}/packages/b/test/b.test.ts"}]}
        self.assertEqual(ci_scope.count_check(rep, ["apps/x/test/main.test.ts", "packages/b/test/b.test.ts"], root), [])
        got = ci_scope.count_check(rep, ["apps/x/test/main.test.ts", "apps/w/test/page.test.ts"], root)
        self.assertTrue(any("apps/w/test/page.test.ts" in e for e in got), got)   # 流れなかった
        self.assertTrue(any("packages/b/test/b.test.ts" in e for e in got), got)  # 決めていないのに流れた
        self.assertTrue(ci_scope.count_check({"testResults": []}, ["apps/x/test/main.test.ts"], root))
        self.assertEqual(ci_scope.count_check({"testResults": []}, None, root), [])   # 全部の回は見ない


class DocsAndJobsTest(Base):
    """文書だけ・data_links・組（database・web）の要る要らない・中間と統合の試験"""

    def test_K107_CS_013_docs_only(self) -> None:
        self.r.commit("K-1 docs: 文", README_md="直した\n", **{"11_tickets__K-1.md": ticket("K-1", [])})
        p = self.r.plan(tests=[])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["changed_packages"], [])
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})
        self.assertEqual(p["unit_shards"], 0)

    def test_K107_CS_015_data_link(self) -> None:
        self.r.commit("K-1 docs: 計画", **{"07_qa__plan.json": '{"a": 1}\n', "11_tickets__K-1.md": ticket("K-1", [])})
        p = self.r.plan(tests=[])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], ["apps/x/test/plan.test.ts"])
        self.assertTrue(p["jobs"]["unit"])
        # src が読むデータ：読む src を vitest に渡し、その src に関わる試験を流す
        self.r.commit("K-1 docs: 読む物", **{"07_qa__load.json": '{"b": 1}\n'})
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertIn(["apps/x/src/load.ts"], self.r.calls)
        self.assertIn("apps/x/test/main.test.ts", p["unit_files"])

    def test_K107_CS_061_tickets_json_runs_web(self) -> None:
        # 11_tickets/tickets.json は web の組の G48（op_gate.py --tickets 11_tickets/tickets.json）が読む。画面を持つチケットの行が
        #   変わったら web の組を流す（K-156 で当てはめを変えた：画面を持たないチケットの行だけなら流さない・D-133.5）
        real = ci_scope.load_rules(str(ROOT / "scripts/ci/ci_scope.json"))
        self.assertEqual(real["jobs"]["web"]["ticket_rows"]["file"], "11_tickets/tickets.json")
        rules = json.loads(json.dumps(RULES))
        rules["jobs"]["web"]["paths"] = list(real["jobs"]["web"]["paths"])
        rules["jobs"]["web"]["ticket_rows"] = dict(real["jobs"]["web"]["ticket_rows"])
        self.r.commit("K-1 docs: 一覧", **{"11_tickets__tickets.json": '{"tickets": [{"id": "K-9", "screens": ["login"]}]}\n',
                                         "11_tickets__K-1.md": ticket("K-1", [])})
        p = ci_scope.plan(str(self.r.dir), self.r.base, "HEAD", "auto", rules=rules, tickets_dir=str(self.r.dir / "11_tickets"),
                          list_tests=lambda files: {f: [] for f in files}, db_tests=lambda: [])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertTrue(p["jobs"]["web"])
        self.assertEqual(p["mismatches"], [])

    def test_K107_CS_028_web_and_database_jobs(self) -> None:
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertFalse(p["jobs"]["web"])
        self.assertFalse(p["jobs"]["database"])
        self.r.commit("K-1 feat: 画面", apps__w__src__page_ts="export const w = 8;\n", **{"11_tickets__K-1.md": ticket("K-1", ["w", "x"])})
        p = self.r.plan(tests=["apps/w/test/page.test.ts"])
        self.assertTrue(p["jobs"]["web"])
        self.assertTrue(p["jobs"]["database"])
        self.r.close()
        self.r = Repo()   # 画面の仕様だけを変えた写し（パッケージに触らなくても、web の組は要る）
        self.r.commit("K-1 docs: 画面の仕様", **{"07_qa__specs__web__a.md": "行\n", "11_tickets__K-1.md": ticket("K-1", [])})
        p = self.r.plan(tests=[])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": True})

    def test_K107_CS_029_unmapped_readers(self) -> None:
        # ファイルを読む・子プロセスを起こす試験と src は import の地図に出ない。data_links か reads_ok に書いていなければ赤
        forms = {
            "spawn.test.ts": "import { spawnSync } from 'node:child_process';\n",
            "readdir.test.ts": "import { readdir } from 'node:fs/promises';\n",
            "promises.test.ts": "import fs from 'node:fs';\nawait fs.promises.readFile('x');\n",
            "stream.test.ts": "import { createReadStream } from 'node:fs';\n",
            "stat.test.ts": "import { statSync } from 'node:fs';\n",
            "exists.test.ts": "import { existsSync } from 'node:fs';\n",
            "dyn.test.ts": "const m = await import(name);\n",
        }
        for f, text in forms.items():
            write(self.r.dir, f"apps/x/test/{f}", text)
        write(self.r.dir, "apps/w/src/reader.ts", "import { readFileSync } from 'node:fs';\n")   # src の側
        got = ci_scope.unmapped_readers(str(self.r.dir), RULES)
        for f in forms:
            self.assertIn(f"apps/x/test/{f}", got)
        self.assertIn("apps/w/src/reader.ts", got)
        self.assertNotIn("apps/x/test/plan.test.ts", got)   # data_links の tests にある
        self.assertNotIn("apps/x/src/load.ts", got)         # data_links の readers にある
        self.assertNotIn("apps/x/test/main.test.ts", got)   # 読まない

    def test_K107_CS_044_no_test_paths_really_unread(self) -> None:
        # no_test_paths（試験が読まない文書）を、試験や src が読んでいたら赤（決まりの書き違いを機械で見る）
        # 調べる先は root_kind が doc になる物の全部（no_test_paths・is_doc_only の頭の名前と型・人が読む生成物）。読んだパスごとに見る
        write(self.r.dir, "apps/x/test/hear.test.ts", "const p = join(ROOT, \"01_hearing\", \"x.md\");\n")
        # data_links にある試験でも、data_links に無い文書の置き場の物（07_qa/test-plan は is_doc_only の頭の名前）を読めば赤
        write(self.r.dir, "apps/x/test/plan.test.ts", "import { readFileSync } from 'node:fs';\nreadFileSync(join(ROOT, \"07_qa/test-plan/x.json\"));\n")
        # data_links にある物を読むのは赤にしない
        write(self.r.dir, "apps/x/test/ok.test.ts", "readFileSync(join(ROOT, \"07_qa/plan.json\"));\n")
        got = set(ci_scope.no_test_path_reads(str(self.r.dir), RULES))
        self.assertIn(("apps/x/test/hear.test.ts", "01_hearing/x.md"), got)
        self.assertIn(("apps/x/test/plan.test.ts", "07_qa/test-plan/x.json"), got)
        self.assertNotIn("apps/x/test/ok.test.ts", {f for f, _ in got})
        self.assertNotIn("apps/x/test/main.test.ts", {f for f, _ in got})

    def test_K107_CS_060_generated_code_is_not_doc(self) -> None:
        # 生成物（scripts/ci/generated.json の outputs）のうち、コードとして読まれる物（.ts・.json）は doc にしない。人が読む物（.md・.csv・.html）だけ doc
        write(self.r.dir, "scripts/ci/generated.json", json.dumps({"generators": [
            {"name": "試し", "run": "true", "outputs": ["09_gen/types.ts", "09_gen/plan.json", "09_gen/plan.md", "09_gen/list.csv", "09_gen/view.html"]}]}))
        kind = {f: ci_scope.root_kind(f, RULES, str(self.r.dir)) for f in
                ("09_gen/types.ts", "09_gen/plan.json", "09_gen/plan.md", "09_gen/list.csv", "09_gen/view.html")}
        self.assertEqual(kind, {"09_gen/types.ts": "unmapped", "09_gen/plan.json": "unmapped",
                                "09_gen/plan.md": "doc", "09_gen/list.csv": "doc", "09_gen/view.html": "doc"})

    def test_K107_CS_040_integration_tests_join(self) -> None:
        # 中間・統合の試験（kind: QA のチケット）：このチケットで depends_on が全部そろうなら、その tests も流す（runnable_after）
        write(self.r.dir, "11_tickets/K-9.md", ticket("K-9", [], kind="QA", depends_on="[K-0, K-1]", tests="[apps/w/test/flow.test.ts]"))
        self.r.commit("K-0 docs: 中間の試験のチケット")
        base = git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(base=base, tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], ["apps/w/test/flow.test.ts", "apps/x/test/main.test.ts"])
        self.assertEqual(p["integration"], ["K-9"])

    def test_K107_CS_058_integration_tests_glob(self) -> None:
        # tests: の glob はファイルに開いてから渡す（* のまま vitest に渡さない）。何にも当たらない glob は tests が無いのと同じ（全部）
        write(self.r.dir, "11_tickets/K-9.md", ticket("K-9", [], kind="QA", depends_on="[K-0, K-1]", tests="[apps/w/test/*.test.ts]"))
        self.r.commit("K-0 docs: 中間の試験のチケット")
        base = git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(base=base, tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["unit_files"], ["apps/w/test/flow.test.ts", "apps/w/test/page.test.ts", "apps/x/test/main.test.ts"])
        self.assertFalse(any("*" in f for f in p["unit_files"]))
        # 当たらない glob：新しい写しで、glob を直したコミットは比べる元より前に置き、範囲はこのチケット（K-1）のコミットだけにする
        # （範囲に K-0 のコミットが入ると、ファイルの無い番号（CS-045）・チケットが 2 つ（CS-024）の分岐にも当たってしまう）
        self.r.close()
        self.r = Repo()
        write(self.r.dir, "11_tickets/K-9.md", ticket("K-9", [], kind="QA", depends_on="[K-0, K-1]", tests="[apps/w/test/nai*.test.ts]"))
        self.r.commit("K-0 docs: 当たらない glob")
        base = git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(base=base, tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["tickets"], ["K-1"])
        self.assertEqual(p["mismatches"], [])
        self.assertEqual(p["mode"], "scoped")                       # K-170：止める
        self.assertEqual({c for c, _ in p["full_reasons"]}, {"integration"})
        self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), p["errors"])   # integration の分岐だけに当たる

    def test_K107_CS_041_integration_without_tests_is_full(self) -> None:
        write(self.r.dir, "11_tickets/K-9.md", ticket("K-9", [], kind="QA", depends_on="[K-0, K-1]"))
        self.r.commit("K-0 docs: 中間の試験のチケット")
        base = git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(base=base, tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["mode"], "scoped")                       # K-170：止める
        self.assertIn("integration", {c for c, _ in p["full_reasons"]})
        self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), p["errors"])

    def test_K107_CS_042_integration_not_yet_runnable(self) -> None:
        # depends_on のほか（K-5）がまだ入っていない：まだ流さない
        write(self.r.dir, "11_tickets/K-9.md", ticket("K-9", [], kind="QA", depends_on="[K-1, K-5]", tests="[apps/w/test/flow.test.ts]"))
        self.r.commit("K-0 docs: 中間の試験のチケット")
        base = git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(base=base, tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["unit_files"], ["apps/x/test/main.test.ts"])
        self.assertEqual(p["integration"], [])


class TicketOnlyTest(Base):
    """K-170（2026-11-11・決める人）：チケットの CI（scope=auto）はどんな変更でも全部に倒さない。全部は scope=full の大分類の終わりだけ"""

    def tk(self, tests: str = "[apps/x/test/main.test.ts]", ci_wide: list[str] | None = None, affects: list[str] | None = None) -> str:
        return ticket("K-1", affects if affects is not None else [], ci_wide if ci_wide is not None else [], tests=tests)

    def test_K170_CS_001_lockfile_runs_ticket_tests(self) -> None:
        self.r.commit("K-1 chore: 版", pnpm_lock_yaml="lockfileVersion: '9.0'\n# 版を上げた\n",
                      **{"11_tickets__K-1.md": self.tk(ci_wide=["lockfile"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn("lockfile", {c for c, _ in p["full_reasons"]})
        self.assertIn("apps/x/test/main.test.ts", p["unit_files"])   # チケットの tests: は必ず流す
        self.assertNotEqual(p["unit_shards"], 6)

    def test_K170_CS_002_ci_settings_run_only_ticket_tests(self) -> None:
        self.r.commit("K-1 chore: CI", **{".github__workflows__gate.yml": "name: gate\n",
                                          "11_tickets__K-1.md": self.tk(ci_wide=["ci"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], ["apps/x/test/main.test.ts"])
        self.assertEqual(p["unit_shards"], 1)
        self.assertEqual(p["errors"], [])
        self.assertEqual(p["mismatches"], [])

    def test_K170_CS_003_unmapped_keeps_reason(self) -> None:
        self.r.commit("K-1 docs: 地図に無い", **{"08_api__openapi.yaml": "openapi: 3.1.0\n", "11_tickets__K-1.md": self.tk()})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn(("unmapped", "08_api/openapi.yaml"), set(p["full_reasons"]))   # スキルの block_kinds が読んで止める
        self.assertEqual(p["unit_files"], ["apps/x/test/main.test.ts"])

    def test_K170_CS_004_shared_part_runs_dependents_not_all(self) -> None:
        # a は b と（b を通して）w に使われる＝共通の部品
        self.r.commit("K-1 feat: a", packages__a__src__more_ts="export const m = 1;\n",
                      **{"11_tickets__K-1.md": self.tk(tests="[]", affects=["a"], ci_wide=["shared"])})
        p = self.r.plan(tests={"packages/a/src/more.ts": ["packages/b/test/b.test.ts", "apps/w/test/page.test.ts"]})
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn("shared", {c for c, _ in p["full_reasons"]})
        self.assertIn("apps/w/test/page.test.ts", p["unit_files"])
        self.assertNotIn("apps/x/test/main.test.ts", p["unit_files"])   # 関係の無い所は流さない
        self.assertNotEqual(p["unit_shards"], 6)

    def test_K170_CS_009_ticket_tests_only_vitest_files(self) -> None:
        # tests: の .py（scripts/ci の試験）は vitest に渡さない（spec の組が流す）。.ts だけを unit_files に
        write(self.r.dir, "scripts/ci/x_test.py", "print(1)\n")
        self.r.commit("K-1 chore: CI", **{".github__workflows__gate.yml": "name: gate\n",
                                          "11_tickets__K-1.md": self.tk(tests="[scripts/ci/x_test.py, apps/x/test/main.test.ts]", ci_wide=["ci"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], ["apps/x/test/main.test.ts"])
        self.assertEqual(p["errors"], [])

    def test_K170_CS_012_python_only_tests_do_not_stop(self) -> None:
        # vitest の試験が 1 本も残らない（.py だけ）のは「当たらない」ではない。止めずに、spec の組に任せる
        write(self.r.dir, "scripts/ci/x_test.py", "print(1)\n")
        self.r.commit("K-1 chore: CI", **{".github__workflows__gate.yml": "name: gate\n",
                                          "11_tickets__K-1.md": self.tk(tests="[scripts/ci/x_test.py]", ci_wide=["ci"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["errors"], [])
        self.assertNotIn("scripts/ci/x_test.py", p["unit_files"])

    def test_K170_CS_010_ticket_tests_glob_without_match_stops(self) -> None:
        self.r.commit("K-1 chore: CI", **{".github__workflows__gate.yml": "name: gate\n",
                                          "11_tickets__K-1.md": self.tk(tests="[apps/x/test/nai*.test.ts]", ci_wide=["ci"])})
        p = self.r.plan()
        self.assertTrue(any("範囲を決められない（ticket-tests：" in e and "全部には倒さず止める" in e for e in p["errors"]), p["errors"])
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})

    def test_K170_CS_011_package_json_runs_package_and_users(self) -> None:
        self.r.commit("K-1 chore: 版", packages__b__package_json=json.dumps({"name": "b", "version": "0.0.2", "dependencies": {"a": "workspace:*"}}),
                      **{"11_tickets__K-1.md": self.tk(tests="[]", affects=["b"], ci_wide=["lockfile"])})
        p = self.r.plan(tests=[])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], ["apps/w/test/flow.test.ts", "apps/w/test/page.test.ts", "packages/b/test/b.test.ts"])
        self.assertNotIn("apps/x/test/main.test.ts", p["unit_files"])
        self.assertTrue(p["jobs"]["web"], "使い手 w の画面の組が流れない")              # Q #4：組も使い手まで（K-170 の前は全部で流れていた）
        self.assertTrue(p["jobs"]["database"], "b を使う DB の組が流れない")
        self.assertIn("lockfile", {c for c, _ in p["full_reasons"]})
        self.assertFalse(any(r.startswith("全部：") for r in p["reasons"]), p["reasons"])   # Q #8：続ける理由を「全部」と書かない

    def test_K170_CS_014_ticket_web_tests_turn_on_web_job(self) -> None:
        # チケットの tests: に画面の試験があれば、ci の類だけの変更でも web の組を流す（チケットの試験は必ず流す）
        write(self.r.dir, "apps/web/tests/k1.spec.ts", "// 画面の試験\n")
        self.r.commit("K-1 chore: CI", **{".github__workflows__gate.yml": "name: gate\n",
                                          "11_tickets__K-1.md": self.tk(tests="[apps/web/tests/k1.spec.ts]", ci_wide=["ci"])})
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertTrue(p["jobs"]["web"], p["jobs"])
        self.assertEqual(p["errors"], [])

    def test_K170_CS_013_package_config_runs_package_and_users(self) -> None:
        # パッケージの中の tsconfig・playwright.config（ci の類）は、そのパッケージと使い手まで（D-133.7 ④の当てはめ・PM の判断 2026-11-11）
        self.r.commit("K-1 chore: 設定", apps__w__tsconfig_json="{}\n",
                      **{"11_tickets__K-1.md": self.tk(tests="[]", affects=["w"], ci_wide=["ci"])})
        p = self.r.plan(tests=[])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertIn(("ci", "apps/w/tsconfig.json"), set(p["full_reasons"]))   # ci の類に当たってから、そのパッケージで続ける
        self.assertEqual(p["unit_files"], ["apps/w/test/flow.test.ts", "apps/w/test/page.test.ts"])
        self.assertTrue(p["jobs"]["web"])
        self.assertNotIn("apps/x/test/main.test.ts", p["unit_files"])

    def test_K170_CS_005_undecidable_stops_not_full(self) -> None:
        cases = {
            "比べる元が読めない": dict(base="0" * 40),
            "変えたファイルが無い": dict(head=None),
        }
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")
        for label, kw in cases.items():
            with self.subTest(label):
                p = self.r.plan(**({"head": self.r.base} if "head" in kw else kw))
                self.assertEqual(p["mode"], "scoped", label)
                self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), (label, p["errors"]))
                self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False}, label)
        self.r.commit("K-2 feat: 2", apps__x__src__main_ts="export const x = 6;\n")    # 番号が 2 つ
        p = self.r.plan()
        self.assertEqual(p["mode"], "scoped")
        self.assertTrue(any("全部には倒さず止める" in e for e in p["errors"]), p["errors"])

    def test_K170_CS_006_tool_failure_stops(self) -> None:
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")

        def boom(_files: list[str]) -> dict:
            raise ci_scope.ToolError("vitest_related.mjs が 1 で終わった")
        p = self.r.plan(list_tests=boom)
        self.assertEqual(p["mode"], "scoped")
        self.assertTrue(any(e.startswith("範囲を決められない（tool：") and e.endswith("全部には倒さず止める") for e in p["errors"]), p["errors"])
        self.assertEqual(p["unit_shards"], 0)

    def test_K170_CS_007_red_output_does_not_run_everything(self) -> None:
        self.r.commit("K-1 feat: x と w", apps__x__src__main_ts="export const x = 5;\n", apps__w__src__page_ts="export const w = 4;\n")
        out = self.r.dir / "gh_output.txt"
        rules = self.r.dir / "rules.json"
        rules.write_text(json.dumps(RULES), encoding="utf-8")
        rc = ci_scope.main(["--repo", str(self.r.dir), "--base", self.r.base, "--scope", "auto", "--rules", str(rules),
                            "--tickets", str(self.r.dir / "11_tickets"), "--no-vitest", "--github-output", str(out)])
        self.assertEqual(rc, 1)
        kv = parse_gh_output(out.read_text(encoding="utf-8"))
        self.assertEqual((kv["full"], kv["unit"], kv["database"], kv["web"], kv["unit_shards"]), ("false", "false", "false", "false", "0"))

    def test_K170_CS_008_scope_full_is_still_everything(self) -> None:
        self.r.commit(pnpm_lock_yaml="lockfileVersion: '9.0'\n# 版\n")
        p = self.r.plan(scope="full")
        self.assertEqual(p["mode"], "full")
        self.assertEqual(p["unit_shards"], 6)
        self.assertTrue(p["jobs"]["unit"] and p["jobs"]["database"] and p["jobs"]["web"])


class RealRepoTest(unittest.TestCase):
    """本物のリポジトリで：pnpm の依存の地図と同じか・決まりのファイル・読む試験の棚卸し・目録の使い回し・vitest の辿り・workflow の形"""

    def need(self, tool: str) -> None:
        if shutil.which(tool):
            return
        if IN_CI:
            self.fail(f"{tool} が無い（CI の中では skip にしない）")
        self.skipTest(f"{tool} が無い")

    def test_K107_CS_030_same_as_pnpm_filter(self) -> None:
        self.need("pnpm")
        ws = ci_scope.workspace(str(ROOT))
        self.assertGreater(len(ws), 10)
        for name in sorted(ws):
            got = ci_scope.affected({name}, ws)
            out = subprocess.run(["pnpm", "-s", "--filter", f"...{name}", "ls", "--depth", "-1", "--json"],
                                 cwd=ROOT, capture_output=True, text=True, check=True).stdout
            want = {p["name"] for p in json.loads(out or "[]")}
            self.assertEqual(got, want, name)

    def test_K107_CS_031_real_rules_file(self) -> None:
        rules = ci_scope.load_rules(str(ROOT / "scripts/ci/ci_scope.json"))
        self.assertEqual(set(rules["full"]), {"ci", "lockfile"})   # migration は全部ではなく DB の範囲
        self.assertIn("pnpm-lock.yaml", rules["full"]["lockfile"])
        self.assertIn("**/package.json", rules["full"]["lockfile"])
        self.assertIn(".github/**", rules["full"]["ci"])
        self.assertIn("05_flow/build_testplan.py", rules["full"]["ci"])
        db = rules["db"]
        self.assertEqual(set(db["paths"]), {"packages/db/migrations/**", "packages/db/policies/**",
                                            "07_functional/entities.json", "07_qa/test-plan/access-matrix.json"})
        self.assertEqual(db["migrations"], ["packages/db/migrations/**"])
        # 一覧は作り手が作る生成物（K-327・migration の名前を時刻にした）
        self.assertEqual(db["migration_list"]["file"], "packages/db/src/migrations.generated.ts")
        # 関門 C2 の gateway_path（03_architecture/choke-points.json）と同じ所を DB の入口として見る
        c2 = next(c for c in json.loads((ROOT / "03_architecture/choke-points.json").read_text(encoding="utf-8"))["choke_points"] if c["id"] == "C2")
        self.assertEqual(db["gateway"], [c2["gateway_path"].rstrip("/") + "/**"])
        self.assertEqual(rules["files_per_shard"], 40)
        self.assertEqual(rules["shared_min_dependents"], 2)
        self.assertEqual(rules["affects_required_from"], 108)
        ws = ci_scope.workspace(str(ROOT))
        self.assertEqual(ci_scope.shared_packages(ws, rules["shared_min_dependents"]),
                         {"@kaname/db", "@kaname/config", "@kaname/contracts", "@kaname/errors", "@kaname/notify"})   # notify は api と auth（命令 ops:first・K-945）が使う
        self.assertEqual(set(rules["jobs"]), {"database", "web"})
        for job, j in rules["jobs"].items():
            # packages・paths は要る。ticket_rows（画面の組とチケットの一覧・K-156・D-133.5）は任意
            self.assertLessEqual({"packages", "paths"}, set(j), job)
            self.assertLessEqual(set(j), {"packages", "paths", "ticket_rows"}, job)
            for name in j["packages"]:
                self.assertIn(name, ws, f"jobs.{job} のパッケージが無い: {name}")
        self.assertEqual(rules["jobs"]["web"]["packages"], ["@kaname/web"])
        for link in rules["data_links"]:
            for t in link.get("tests", []) + link.get("readers", []):
                self.assertTrue((ROOT / t).exists(), f"data_links の試験・読む src が無い: {t}")

    def test_K107_CS_032_no_unmapped_readers_in_repo(self) -> None:
        rules = ci_scope.load_rules(str(ROOT / "scripts/ci/ci_scope.json"))
        self.assertEqual(ci_scope.unmapped_readers(str(ROOT), rules), [])
        self.assertEqual(ci_scope.no_test_path_reads(str(ROOT), rules), [])

    def test_K107_CS_047_reuses_catalog(self) -> None:
        # 同じものを 2 つ作らない（ai-driven-process §7）：チケットの番号・文書の見分け・生成物の目録・チケットの読み方は既存の物を使う
        import build_index
        import ticket_commit_gate
        import ticket_order_gate
        self.assertIs(ci_scope.TICKET, ticket_commit_gate.TICKET)
        self.assertIs(ci_scope.is_doc_only, ticket_order_gate.is_doc_only)
        self.assertIs(ci_scope.generated_outputs, ticket_order_gate.generated_outputs)
        self.assertIs(ci_scope.parse_ticket, build_index.parse)
        rules = ci_scope.load_rules(str(ROOT / "scripts/ci/ci_scope.json"))
        # 文書の見分け（DOC_PATTERNS）に当たる根の .md は文書、同じ所の .json は文書にしない（data_links が先・文書より先）。
        #   K-156 から 08_api/** は決まりの spec（static と spec の段だけ）。文書ではないので、読む試験があれば CS-044 が赤にする
        self.assertTrue(ci_scope.root_kind("08_api/README.md", rules, str(ROOT)) == "doc")
        self.assertTrue(ci_scope.root_kind("07_qa/test-plan/access-matrix.json", rules, str(ROOT)) in ("data", "db"))
        self.assertEqual(ci_scope.root_kind("08_api/nai.json", rules, str(ROOT)), "spec")

    def test_K107_CS_053_vitest_related_real(self) -> None:
        self.need("node")
        if not (ROOT / "node_modules/vitest").exists():
            if IN_CI:
                self.fail("node_modules が無い（CI の中では skip にしない）")
            self.skipTest("node_modules が無い")
        r = subprocess.run(["node", "scripts/ci/vitest_related.mjs", "packages/config/src/index.ts"],
                           cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr)
        got = json.loads(r.stdout)   # {渡したファイル: [関わる試験…]}
        self.assertEqual(set(got), {"packages/config/src/index.ts"})
        tests = got["packages/config/src/index.ts"]
        self.assertTrue(any(f.startswith("packages/config/test/") for f in tests), tests)
        self.assertNotIn("apps/web/test/k-tokens.test.ts", tests)
        self.assertEqual(tests, sorted(set(tests)))
        r = subprocess.run(["node", "scripts/ci/vitest_related.mjs", "packages/nai/src/x.ts"], cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual((r.returncode, json.loads(r.stdout or "null")), (0, {"packages/nai/src/x.ts": []}))   # 無ければ空（落ちない）

    def test_K107_CS_034_workflow_shape(self) -> None:
        import yaml
        wf = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
        on = wf.get("on", wf.get(True))   # PyYAML は on を True と読む
        inputs = on["workflow_dispatch"]["inputs"]
        self.assertEqual(inputs["scope"]["default"], "full")   # GitHub で手で押したとき・入力を渡さないときは全部
        self.assertEqual(set(inputs["scope"]["options"]), {"full", "ticket"})   # K-172：ticket-flow の入口
        self.assertIn("base", inputs)
        jobs = wf["jobs"]
        # ★外から来る値（inputs・組の出力）を run の命令の文字に直に入れない。env に渡し、台本が読む（命令の注入を防ぐ）
        for name, job in jobs.items():
            for st in job.get("steps", []):
                run = st.get("run", "")
                self.assertNotRegex(run, r"\$\{\{\s*(inputs\.|needs\.static\.outputs\.|steps\.scope\.outputs\.)", f"{name}: {st.get('name')}")
        st_steps = jobs["static"]["steps"]
        idx = [i for i, st in enumerate(st_steps) if st.get("id") == "scope"]
        self.assertEqual(len(idx), 1)
        scope = st_steps[idx[0]]
        venv_i = [i for i, st in enumerate(st_steps) if "ci_venv.sh" in str(st.get("run", ""))]
        lint_i = [i for i, st in enumerate(st_steps) if str(st.get("run", "")).strip() == "pnpm lint" or str(st.get("name", "")).startswith("G1 lint")]
        inst_i = [i for i, st in enumerate(st_steps) if str(st.get("run", "")).startswith("pnpm install")]
        self.assertTrue(inst_i and inst_i[0] < idx[0], "部品を入れた（pnpm install）後")   # 段の番号で決め打ちしない（K-173）
        self.assertTrue(venv_i and venv_i[0] < idx[0], "Python の部品（ci_venv.sh・K-172）の後")
        self.assertTrue(lint_i, "lint の段がある（無ければ「lint より前」を確かめられない）")
        self.assertLess(idx[0], lint_i[0], "lint より前")
        self.assertIn("inputs.scope", scope["env"]["CI_SCOPE_INPUT"])
        self.assertIn("inputs.base", scope["env"]["CI_BASE_INPUT"])
        for k in ("full", "unit", "database", "web", "unit_shards", "unit_files", "migration_files", "coverage_args", "base"):
            self.assertIn(k, jobs["static"]["outputs"])
        self.assertIn("needs.static.outputs.unit == 'true'", jobs["unit-1"]["if"])
        for i in range(1, 7):
            if i > 1:
                self.assertIn(f"fromJSON(needs.static.outputs.unit_shards) >= {i}", jobs[f"unit-{i}"]["if"])
            st = [s for s in jobs[f"unit-{i}"]["steps"] if "run-unit" in s.get("run", "")]
            self.assertEqual(len(st), 1, i)
            self.assertIn(f"run-unit --shard {i}", st[0]["run"])
            self.assertIn("needs.static.outputs.unit_files", st[0]["env"]["CI_UNIT_FILES"])
        self.assertIn("static", jobs["unit"]["needs"])   # 合わせる組は static の出力を読む
        merge = "\n".join(s.get("run", "") for s in jobs["unit"]["steps"])
        self.assertIn("run-merge", merge)               # 合わせる命令も引数の並びで（coverage_args を env から）
        merge_env = {k: v for s in jobs["unit"]["steps"] for k, v in (s.get("env") or {}).items()}
        self.assertIn("needs.static.outputs.coverage_args", merge_env.get("CI_COVERAGE_ARGS", ""))
        self.assertIn("check-count", merge)            # 流れた試験と決めた試験の突き合わせ
        self.assertIn('[ -n "$CI_UNIT_SHARDS" ]', merge)   # static の出力が空なら赤（黙って 0 本にしない）
        self.assertIn("needs.static.outputs.database == 'true'", jobs["database"]["if"])
        self.assertIn("needs.static.outputs.web == 'true'", jobs["web"]["if"])
        sq = [s for s in jobs["database"]["steps"] if "run-squawk" in s.get("run", "")]
        self.assertEqual(len(sq), 1)
        self.assertIn("needs.static.outputs.migration_files", sq[0]["env"]["CI_MIGRATION_FILES"])
        # spec は毎回流す（if は !cancelled() だけ・範囲の出力で止めない・K-156 で needs を戻したので下で見る）
        # spec の段は static の後に流す（act は needs の無い組を 1 段目にまとめるので、needs が無いと spec が static と並び、
        #   database・unit・web が spec の終わりまで待つ・K-156）。static が赤でも飛ばされない（K-143 の理由）は組の if の !cancelled() で守る。
        #   本線との分かれ目が要る検査（G61）は、spec の段の中で同じ scope の台本を流して自分で出す（K-143・PM の判断 2026-11-08 17:40）
        self.assertEqual(jobs["spec"].get("needs"), ["static"])
        self.assertIn("!cancelled()", str(jobs["spec"].get("if", "")))
        sp_scope = [s for s in jobs["spec"]["steps"] if "scripts/ci/ci_scope.py" in s.get("run", "") and "--github-output" in s.get("run", "")]
        self.assertEqual(len(sp_scope), 1)
        self.assertIn("inputs.base", sp_scope[0]["env"]["CI_BASE_INPUT"])
        g57 = [s for s in jobs["spec"]["steps"] if s.get("name", "").startswith("G57 ")]
        self.assertEqual(len(g57), 1)
        self.assertIn("python3 scripts/ci/ci_scope_test.py", g57[0]["run"])
        self.assertIn("python3 scripts/ci/ticket_affects_test.py", g57[0]["run"])
        gen = (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8")
        self.assertIn("ci_scope.py", gen)   # workflow は作り手から（手で直さない）


if __name__ == "__main__":
    unittest.main(verbosity=2)
