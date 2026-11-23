#!/usr/bin/env python3
"""K-1116 契約 fuzz（G36）で出た前からの口の赤 3 種を、契約と fuzz の設定の側で見る自己試験。

  K1116-CT-001〜002：入力の形を分け合う口どうしで、ほかの口の値域・必須・形全体の決まりが自分の形に漏れない（updateMemory の confidence・kind_id）
  K1116-CT-003〜005：パスワードで入る口（signInWithPassword）の契約のメールの形は、口が受ける形（正規化の後の EMAIL_RE と部品 better-auth の z.email()）より広くない
  K1116-CT-006〜007：PC の確かめに答える口（answerCredentialLoginCheck）だけ、作った直後に引けるかの確かめ（ST302）を外す

使い方: python3 scripts/ci/k1116_fuzz_contract_test.py（08_api/openapi.yaml は作り手で作り直した後の物を読む）
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import re
import subprocess
import sys
import tomllib
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OA = yaml.safe_load((ROOT / "08_api" / "openapi.yaml").read_text(encoding="utf-8"))
SCHEMAS = OA["components"]["schemas"]
EPS = json.loads((ROOT / "08_api" / "endpoints.json").read_text(encoding="utf-8"))["endpoints"]
TOML = tomllib.loads((ROOT / "scripts" / "ci" / "schemathesis.toml").read_text(encoding="utf-8"))

# G36 の回 45114016413（K-424）で ST202 になったメール（改行・制御の字・ASCII でない字を含む。JSON の \\ud9d6\\udf69 などの対は 1 字にした）
FUZZ_EMAIL = "\n0®yíĂ²\u009b\u0083\U00085b69\u0007@Ð.\u0080õp*\u000fª\U000dedbdiÿ"


def _load_screen_api():
    sys.path.insert(0, str(ROOT / "05_flow"))
    spec = importlib.util.spec_from_file_location("screen_api_k1116", ROOT / "05_flow" / "screen_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


SA = _load_screen_api()


def _base_name(e: dict) -> str:
    """作り手 05_flow/build_api.py の _in_name と同じ：分ける前の入力の形の名前"""
    t = e.get("table") or e["path"].split("/")[3]
    return getattr(SA, "INPUTS", {}).get(e.get("operation_id"), ("".join(w.capitalize() for w in t.split("_")) + "Input",))[0]


BODY_OPS = {e["implementation_path"].split("::")[1]: _base_name(e) for e in EPS if e["method"] in ("POST", "PATCH")}


def _shape_of(op: str) -> dict:
    for item in OA["paths"].values():
        for m in item.values():
            if isinstance(m, dict) and m.get("operationId") == op:
                return SCHEMAS[m["requestBody"]["content"]["application/json"]["schema"]["$ref"].split("/")[-1]]
    raise AssertionError(f"口 {op} が openapi.yaml に無い")


def _leaks() -> list[str]:
    """形を分け合うほかの口 P の値域・必須・決まりが、口 O の形に入っていれば並べる（O 自身が同じ物を持つなら漏れではない）"""
    ranges, req, rules = SA.VALUE_RANGES, SA.REQUIRED_INPUTS, getattr(SA, "INPUT_RULES", {})
    out = []
    for o, base in BODY_OPS.items():
        s = _shape_of(o)
        for p, pbase in BODY_OPS.items():
            if p == o or pbase != base:
                continue
            for k, words in ranges.get(p, {}).items():
                for w, v in words.items():
                    if ranges.get(o, {}).get(k, {}).get(w) == v:
                        continue
                    if s.get("properties", {}).get(k, {}).get(w) == v:
                        out.append(f"{o} の欄 {k} の {w} に {p} の値域が入っている")
            if p in req and req.get(o) != req[p] and s.get("required") == req[p]:
                out.append(f"{o} の required に {p} の必須が入っている")
            for w, v in rules.get(p, {}).items():
                if rules.get(o, {}).get(w) != v and s.get(w) == v:
                    out.append(f"{o} の {w} に {p} の決まりが入っている")
    return out


def _contract_patterns(shape: dict, field: str) -> list[str]:
    pats = [shape["properties"][field]["pattern"]] if "pattern" in shape["properties"][field] else []
    for part in shape.get("allOf", []):
        p = part.get("properties", {}).get(field, {}).get("pattern")
        if p:
            pats.append(p)
    return pats


def _contract_accepts(pats: list[str], s: str) -> bool:
    """schemathesis（Python）が形どおりと見るか：全部の pattern に search で当たる"""
    return all(re.search(p, s) for p in pats)


def _api_accepts(samples: list[str]) -> tuple[list[bool], str]:
    """口が受けるか：本物の normalizeEmail・EMAIL_RE と、ログインの部品 better-auth が自分で引く zod の z.email() を tsx で流す。
    better-auth の z.email() の正規表現の字（source）も返す（部品の版が上がって形が変われば CT-004 が赤になる）"""
    code = (
        "(async () => {"
        ' const { createRequire } = await import("node:module");'
        ' const req = createRequire(process.cwd() + "/package.json");'
        ' const zz = await import(createRequire(req.resolve("better-auth")).resolve("zod"));'
        ' const { normalizeEmail, EMAIL_RE } = await import("./src/signup.ts");'
        " const s = JSON.parse(process.argv[process.argv.length - 1]);"
        " const ok = s.map((x) => { const e = normalizeEmail(x); return EMAIL_RE.test(e) && zz.z.email().safeParse(e).success; });"
        " console.log(JSON.stringify({ ok, source: zz.z.email()._zod.def.pattern.source }));"
        "})()"
    )
    tsx = ROOT / "node_modules" / ".bin" / "tsx"
    r = subprocess.run(
        [str(tsx), "--eval", code, json.dumps(samples, ensure_ascii=True)],
        cwd=ROOT / "packages" / "auth", capture_output=True, text=True, timeout=120, env={**os.environ},
    )
    if r.returncode != 0:
        raise AssertionError(f"tsx が落ちた: {r.stderr[-800:]}")
    out = json.loads(r.stdout.strip().splitlines()[-1])
    return out["ok"], out["source"]


SIGNIN_SAMPLES = [
    FUZZ_EMAIL,
    "a@example.com",
    " Foo.Bar+x@sub.example.co \n",
    "\x1ca@example.com",
    "a@example.com　",
    "a@b.c",
    "日本@例.jp",
    "a..b@example.com",
    ".a@example.com",
    "a'@example.com",
    "a@-b.example.com",
    "a@example.c0m",
    "ａ@example.com",
    "a b@example.com",
]


class FuzzContract(unittest.TestCase):
    def test_K1116_CT_001_update_memory_has_no_create_ranges(self):
        upd = _shape_of("updateMemory")
        # confidence は表の型（numeric）の形に戻る（作る口の numeric(3,2) の値域ではない）。口はこの形で断る（K1116-API-001）
        self.assertEqual(upd["properties"]["confidence"].get("pattern"), "^-?[0-9]+(\\.[0-9]+)?$", "updateMemory の confidence が表の型の形でない")
        self.assertNotEqual(upd["properties"]["confidence"].get("pattern"), SA.VALUE_RANGES["createMemory"]["confidence"]["pattern"])
        self.assertNotIn("enum", upd["properties"]["kind_id"], "updateMemory の kind_id に createMemory の値域が残っている")
        self.assertEqual(upd["properties"]["body"].get("pattern"), "\\S")   # 自分の値域は残る
        crt = _shape_of("createMemory")
        self.assertEqual(crt["properties"]["confidence"]["pattern"], SA.VALUE_RANGES["createMemory"]["confidence"]["pattern"])
        self.assertEqual(crt["properties"]["kind_id"]["enum"], ["rule", "preference", "example", None])
        self.assertNotIn("pattern", crt["properties"]["body"], "createMemory の body に updateMemory の値域が入っている")

    def test_K1116_CT_002_no_range_leaks_between_sharers(self):
        self.assertEqual(_leaks(), [])

    def test_K1116_CT_003_fuzz_email_is_outside_contract(self):
        pats = _contract_patterns(_shape_of("signInWithPassword"), "email")
        self.assertFalse(_contract_accepts(pats, FUZZ_EMAIL), "制御の字を含むメールが契約の形どおりのまま")
        self.assertTrue(_contract_accepts(pats, "a@example.com"))
        self.assertTrue(_contract_accepts(pats, " Foo.Bar+x@sub.example.co \n"))

    def test_K1116_CT_004_contract_email_is_accepted_by_api(self):
        pats = _contract_patterns(_shape_of("signInWithPassword"), "email")
        api, source = _api_accepts(SIGNIN_SAMPLES)
        self.assertTrue(source.startswith("^") and source.endswith("$"), source)
        self.assertIn("^[ \\t\\n\\r]*" + source[1:-1] + "[ \\t\\n\\r]*$", pats, "契約のメールの形が部品の z.email() の形（前後の空白つき）と字まで同じでない")
        self.assertEqual(api[0], False)   # 口は回のメールを断る（422 E-VAL-004 の元）
        self.assertEqual(api[1], True)
        wrong = [repr(s) for s, ok in zip(SIGNIN_SAMPLES, api) if _contract_accepts(pats, s) and not ok]
        self.assertEqual(wrong, [], "契約の形どおりなのに口が断るメール")

    def test_K1116_CT_005_other_email_ops_unchanged(self):
        # 登録・再設定は部品の z.email() を通らない（EMAIL_RE だけ）ので今の形のまま
        for op in ("createSignup", "requestPasswordReset"):
            self.assertIn("^\\s*[^@\\s]+@[^@\\s]+\\.[^@\\s]+\\s*$", _contract_patterns(_shape_of(op), "email"), op)

    def test_K1116_CT_006_answer_login_check_skips_resource_check(self):
        hits = [o for o in TOML.get("operations", []) if o.get("include-operation-id") == "answerCredentialLoginCheck"]
        self.assertEqual(len(hits), 1)
        self.assertIs(hits[0]["checks"]["ensure_resource_availability"]["enabled"], False)

    def test_K1116_CT_007_resource_check_kept_elsewhere(self):
        self.assertNotIn("ensure_resource_availability", TOML.get("checks", {}), "全部の口で外している")
        others = [o.get("include-operation-id") for o in TOML.get("operations", [])
                  if "ensure_resource_availability" in o.get("checks", {}) and o.get("include-operation-id") != "answerCredentialLoginCheck"]
        self.assertEqual(others, [])
        self.assertIn("answerCredentialLoginCheck", BODY_OPS)


if __name__ == "__main__":
    unittest.main(verbosity=2)
