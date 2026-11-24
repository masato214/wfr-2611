"""K-947 運営が別の会社を触る DB の関数の検査（scripts/ci/ops_definer_gate.py）の自己試験。

テストの名前の頭の行 ID（K947-DB-…）は 11_tickets/K-947.md の表のマスに 1 対 1 で結ぶ。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。

試験が決める形（K-947 が決める本体・D-156.3）:
  ops_definer_gate.check(dir: Path) -> list[str]   … 見つけた誤り（空なら緑）。ファイル名と関数名を文に入れる
  python3 scripts/ci/ops_definer_gate.py [--dir <migrations のフォルダ>]  … 誤りがあれば 1 で終わり、1 行ずつ出す
  検査の対象は、migration の中の `create [or replace] function app.ops_<名前>` で `security definer` の関数（最後に定義した版）:
    ① 本体の先頭の文が `perform app.ops_require(` か `v_… := app.ops_require(`（運営の人とできることを関数の中でも確かめる・2 層目）
    ② 本体に insert・update・delete があれば `app.record_ops_audit(` を呼ぶ（運営と会社の両方の記録・D-128.108）
    台帳 EXEMPT（名前 → 理由）に在る関数は見ない。理由の無い台帳の行は誤り
"""
from __future__ import annotations

import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
GATE = ROOT / "scripts" / "ci" / "ops_definer_gate.py"


def _gate():
    spec = importlib.util.spec_from_file_location("ops_definer_gate", GATE)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


GOOD_READ = """
create or replace function app.ops_k947_read(p_tenant uuid) returns int
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.ops_require('any');
  perform app.ops_target(p_tenant);
  return (select count(*) from members where tenant_id = p_tenant);
end $$;
"""
GOOD_WRITE = """
create or replace function app.ops_k947_write(p_tenant uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_ops uuid;
begin
  v_ops := app.ops_require('stop');
  perform app.ops_target(p_tenant);
  update tenants set updated_at = now() where id = p_tenant;
  perform app.record_ops_audit(p_tenant, 'k947.write', 'tenant', p_tenant::text, null, jsonb_build_object('reason', p_reason));
end $$;
"""
NO_REQUIRE = GOOD_READ.replace("  perform app.ops_require('any');\n", "")
NO_AUDIT = GOOD_WRITE.replace(
    "  perform app.record_ops_audit(p_tenant, 'k947.write', 'tenant', p_tenant::text, null, jsonb_build_object('reason', p_reason));\n",
    "",
)


def _dir(files: dict[str, str]) -> pathlib.Path:
    d = pathlib.Path(tempfile.mkdtemp(prefix="k947-"))
    for name, body in files.items():
        (d / name).write_text(body, encoding="utf-8")
    return d


class OpsDefinerGate(unittest.TestCase):
    def test_K947_DB_001_good_functions_pass(self) -> None:
        """K947-DB-001 読む関数（ops_require で始まる）と書く関数（ops_require で始まり record_ops_audit を呼ぶ）は誤り 0"""
        g = _gate()
        self.assertEqual(g.check(_dir({"20261128004700_a.sql": GOOD_READ + GOOD_WRITE})), [])

    def test_K947_DB_002_missing_require_fails(self) -> None:
        """K947-DB-002 ops_require で始まらない運営の関数は誤り。文にファイル名と関数名が入る"""
        g = _gate()
        probs = g.check(_dir({"20261128004700_b.sql": NO_REQUIRE}))
        self.assertEqual(len(probs), 1)
        self.assertIn("20261128004700_b.sql", probs[0])
        self.assertIn("app.ops_k947_read", probs[0])

    def test_K947_DB_003_write_without_audit_fails(self) -> None:
        """K947-DB-003 書く（update）のに record_ops_audit を呼ばない運営の関数は誤り"""
        g = _gate()
        probs = g.check(_dir({"20261128004700_c.sql": NO_AUDIT}))
        self.assertEqual(len(probs), 1)
        self.assertIn("app.ops_k947_write", probs[0])
        self.assertIn("record_ops_audit", probs[0])

    def test_K947_DB_004_last_definition_wins(self) -> None:
        """K947-DB-004 同じ関数を後の migration で直したら、後の版を見る（前の誤りは残らない・後の誤りは出る）"""
        g = _gate()
        fixed = _dir({"20261128004700_d.sql": NO_REQUIRE, "20261128004800_e.sql": GOOD_READ})
        self.assertEqual(g.check(fixed), [])
        broken = _dir({"20261128004700_d.sql": GOOD_READ, "20261128004800_e.sql": NO_REQUIRE})
        self.assertEqual(len(g.check(broken)), 1)

    def test_K947_DB_005_exempt_needs_reason(self) -> None:
        """K947-DB-005 台帳 EXEMPT の関数（ops_tenant_id・ops_grant_ok・ops_require・ops_target ほか）は見ない。台帳の理由はどれも空でない"""
        g = _gate()
        for name in ("app.ops_tenant_id", "app.ops_grant_ok", "app.ops_require", "app.ops_target"):
            self.assertIn(name, g.EXEMPT)
        for name, why in g.EXEMPT.items():
            self.assertTrue(str(why).strip(), f"{name} の理由が空")
        not_definer = GOOD_WRITE.replace("security definer ", "").replace("app.ops_k947_write", "app.ops_k947_plain")
        self.assertEqual(g.check(_dir({"20261128004700_f.sql": not_definer.replace("  v_ops := app.ops_require('stop');\n", "")})), [])

    def test_K947_DB_006_repo_and_cli(self) -> None:
        """K947-DB-006 本物の migrations のフォルダで誤り 0。命令は誤りがあれば 1 で終わり、無ければ 0"""
        g = _gate()
        self.assertEqual(g.check(ROOT / "packages" / "db" / "migrations"), [])
        ok = subprocess.run([sys.executable, str(GATE)], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        bad = subprocess.run(
            [sys.executable, str(GATE), "--dir", str(_dir({"20261128004700_g.sql": NO_AUDIT}))],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(bad.returncode, 1)
        self.assertIn("app.ops_k947_write", bad.stdout + bad.stderr)


if __name__ == "__main__":
    unittest.main()
