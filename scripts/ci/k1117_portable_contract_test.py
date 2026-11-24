#!/usr/bin/env python3
"""K-1117 契約の形を、口の受け方と同じ字の集まりにする（契約 fuzz の ST201・ST202 の種を断つ）自己試験。

  K1117-CT-001〜004：契約（08_api/openapi.yaml）の pattern の \\s \\S \\d \\w を、作り手が JS と同じ字を並べた形に直す（scripts/ci/portable_regex.py）
  K1117-CT-005〜006：登録の口（createSignup）の契約のメールの形は、部品 better-auth の z.email() の形を前後の空白で挟んだ物で、口が受ける形より広くない
  K1117-CT-007：預けたログインの login は、口（patterns.ts）と契約で同じ字のまま

使い方: python3 scripts/ci/k1117_portable_contract_test.py（08_api/openapi.yaml は作り手で作り直した後の物を読む）
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import re
import subprocess
import sys
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import credential_patterns  # noqa: E402
import invite_patterns  # noqa: E402  JS の trim が落とす字の並び（K-419 が口と字まで照らしている）
import portable_regex  # noqa: E402

OA = yaml.safe_load((ROOT / "08_api" / "openapi.yaml").read_text(encoding="utf-8"))
SCHEMAS = OA["components"]["schemas"]
WS = invite_patterns.WS
SHORT = re.compile(r"(?<!\\)(?:\\\\)*\\[sSdDwW]")   # 前に \ が偶数個ある \s \S \d \D \w \W（\\s は字の \ と s）
PROBES = ["\x1c", "\x1f", "\x85", "﻿", "　", " ", " ", "\t", "a", "٣", "０", "5", "_"]


def _load_screen_api():
    sys.path.insert(0, str(ROOT / "05_flow"))
    spec = importlib.util.spec_from_file_location("screen_api_k1117", ROOT / "05_flow" / "screen_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


SA = _load_screen_api()


def _patterns(node: object, out: list[str]) -> list[str]:
    """鍵 pattern の文字を全部（example・examples の下は見ない）"""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("example", "examples"):
                continue
            if k == "pattern" and isinstance(v, str):
                out.append(v)
            else:
                _patterns(v, out)
    elif isinstance(node, list):
        for v in node:
            _patterns(v, out)
    return out


def _shorthands(p: str) -> bool:
    """[\\s\\S]（どの字でも・両方で同じ）を除いて、\\s \\S \\d \\D \\w \\W を使うか"""
    return bool(SHORT.search(p.replace("[\\s\\S]", "")))


def _shape_of(op: str) -> dict:
    for item in OA["paths"].values():
        for m in item.values():
            if isinstance(m, dict) and m.get("operationId") == op:
                return SCHEMAS[m["requestBody"]["content"]["application/json"]["schema"]["$ref"].split("/")[-1]]
    raise AssertionError(f"口 {op} が openapi.yaml に無い")


def _email_patterns(op: str) -> list[str]:
    shape = _shape_of(op)
    pats = [shape["properties"]["email"]["pattern"]] if "pattern" in shape["properties"]["email"] else []
    for part in shape.get("allOf", []):
        p = part.get("properties", {}).get("email", {}).get("pattern")
        if p:
            pats.append(p)
    return pats


def _tsx(cwd: pathlib.Path, code: str, arg: object) -> dict:
    tsx = ROOT / "node_modules" / ".bin" / "tsx"
    r = subprocess.run([str(tsx), "--eval", code, json.dumps(arg, ensure_ascii=True)],
                       cwd=cwd, capture_output=True, text=True, timeout=180, env={**os.environ})
    if r.returncode != 0:
        raise AssertionError(f"tsx が落ちた: {r.stderr[-800:]}")
    return json.loads(r.stdout.strip().splitlines()[-1])


def _js_tests(pairs: list[list[str]]) -> list[bool]:
    """元の字の JS の new RegExp(元).test(字)（口の正規表現と同じ読み方）"""
    code = ("const a = JSON.parse(process.argv[process.argv.length - 1]);"
            " console.log(JSON.stringify({ ok: a.map(([p, s]) => new RegExp(p).test(s)) }));")
    r = subprocess.run(["node", "-e", code, json.dumps(pairs, ensure_ascii=True)], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise AssertionError(f"node が落ちた: {r.stderr[-800:]}")
    return json.loads(r.stdout.strip().splitlines()[-1])["ok"]


SIGNUP_SAMPLES = [
    "a﹫b@example.com",   # a﹫b（NFKC で @）
    "a＠b@example.com",   # a＠b（NFKC で @）
    "﻿@example.com",
    "日本@例.jp",
    "a@example.com",
    " Foo.Bar+x@sub.example.co \n",
    "ａ@example.com",     # ａ
    "Ａ@Example.COM　",   # Ａ と後ろの全角の空白
    "\x1ca@example.com",
    "a b@example.com",
    "a..b@example.com",
    "a@b.c",
    "a'@example.com",
    "x.y+z@example.com",
]


class PortableContract(unittest.TestCase):
    def test_K1117_CT_001_portable_rewrites_shorthands_to_js_sets(self):
        cases = {
            "\\S": f"[^{WS}]",
            "\\s": f"[{WS}]",
            "^\\s*[^@\\s]+$": f"^[{WS}]*[^@{WS}]+$",
            "\\d{3}": "[0-9]{3}",
            "[12\\d]": "[120-9]",
            "\\w": "[A-Za-z0-9_]",
            "\\W": "[^A-Za-z0-9_]",
            "\\D": "[^0-9]",
            "a\\\\s": "a\\\\s",
            "[\\s\\S]*": "[\\s\\S]*",
            "\\.": "\\.",
        }
        for src, want in cases.items():
            got = portable_regex.portable(src)
            self.assertEqual(got, want, repr(src))
            self.assertEqual(portable_regex.portable(got), got, f"2 回目で変わる: {src!r}")

    def test_K1117_CT_002_portable_refuses_what_it_cannot_express(self):
        for src in ["[^\\S]", "[a\\D]", "[\\W]", "\\bx", "\\B"]:
            with self.assertRaises(ValueError, msg=repr(src)) as cm:
                portable_regex.portable(src)
            self.assertIn(src, str(cm.exception), "どの pattern かが文に無い")

    def test_K1117_CT_003_contract_has_no_engine_dependent_shorthand(self):
        pats = _patterns(OA, [])
        self.assertGreater(len(pats), 0, "openapi.yaml の pattern を読めない")
        bad = sorted({p for p in pats if _shorthands(p)})
        self.assertEqual(bad, [], f"Python と JS で字の集まりが違う字を使う pattern が {len(bad)} 件")

    def test_K1117_CT_004_contract_matches_like_the_source_does_in_js(self):
        src: list[str] = []
        for table in ("VALUE_RANGES", "INPUT_RULES", "QUERY_RANGES"):
            _patterns(getattr(SA, table, {}), src)
        for fields in getattr(SA, "PATH_PATTERNS", {}).values():
            src.extend(v for v in fields.values() if isinstance(v, str))
        src = sorted({p for p in src if SHORT.search(p)})
        self.assertGreater(len(src), 5, "元の表から \\s \\S \\d を使う pattern を読めない")
        contract = set(_patterns(OA, []))
        missing = [p for p in src if portable_regex.portable(p) not in contract]
        self.assertEqual(missing, [], "直した字が契約に無い（元の字のまま書いた）")
        pairs = [[p, s] for p in src for c in PROBES for s in (c, f"a{c}", f"{c}a")]
        js = _js_tests(pairs)
        wrong = [f"{p!r} に {s!r}: JS {j} ／ 契約 {not j}" for (p, s), j in zip(pairs, js)
                 if bool(re.search(portable_regex.portable(p), s)) != j]
        self.assertEqual(wrong, [], "契約（Python）と口（JS）で判定が違う")

    def test_K1117_CT_005_signup_and_sign_in_email_is_the_part_shape(self):
        out = _tsx(ROOT / "packages" / "auth",
                   "(async () => { const { z } = await import(\"zod\"); const { createRequire } = await import(\"node:module\");"
                   " const req = createRequire(process.cwd() + \"/package.json\");"
                   " const zb = await import(createRequire(req.resolve(\"better-auth\")).resolve(\"zod\"));"
                   " console.log(JSON.stringify({ mine: z.email()._zod.def.pattern.source, part: zb.z.email()._zod.def.pattern.source })); })()",
                   [])
        self.assertEqual(out["mine"], out["part"], "packages/auth の zod と部品 better-auth の zod の email の形が違う")
        source = out["part"]
        self.assertTrue(source.startswith("^") and source.endswith("$"), source)
        want = "^[ \\t\\n\\r]*" + source[1:-1] + "[ \\t\\n\\r]*$"
        import email_patterns  # noqa: PLC0415
        self.assertEqual(email_patterns.LOGIN_EMAIL, want, "LOGIN_EMAIL が部品の形を前後の空白で挟んだ物と字まで同じでない")
        for op in ("createSignup", "signInWithPassword"):
            pats = _email_patterns(op)
            self.assertIn(want, pats, op)
            self.assertFalse([p for p in pats if "[^@" in p], f"{op} に前の形が残っている")

    def test_K1117_CT_006_signup_accepts_everything_the_contract_allows(self):
        code = (
            "(async () => {"
            ' const { parseSignup } = await import("./src/features/F1/sign-up/input.ts");'
            " const s = JSON.parse(process.argv[process.argv.length - 1]);"
            ' const out = s.map((e) => { const r = parseSignup({ email: e, name: "名前", company_name: "" }, "correct-horse-battery-1");'
            '   return "status" in r ? { ok: false, status: r.status, body: r.body } : { ok: true }; });'
            " console.log(JSON.stringify({ out }));"
            "})()"
        )
        out = _tsx(ROOT / "apps" / "api", code, SIGNUP_SAMPLES)["out"]
        pats = _email_patterns("createSignup")
        fits = [all(re.search(p, s) for p in pats) for s in SIGNUP_SAMPLES]
        for i in range(3):
            self.assertFalse(fits[i], f"{SIGNUP_SAMPLES[i]!r} が契約の形どおり（口は断る）")
        jp = out[SIGNUP_SAMPLES.index("日本@例.jp")]
        self.assertFalse(jp["ok"])
        self.assertEqual(jp["status"], 422)
        self.assertEqual(jp["body"]["code"], "E-VAL-004")
        self.assertEqual((jp["body"].get("detail") or {}).get("field"), "email")
        for e in ("ａ@example.com", "Ａ@Example.COM　", "a@example.com"):
            self.assertTrue(out[SIGNUP_SAMPLES.index(e)]["ok"], f"{e!r} を口が受けない（今までどおり直して受ける）")
        wrong = [repr(s) for s, f, o in zip(SIGNUP_SAMPLES, fits, out) if f and not o["ok"]]
        self.assertEqual(wrong, [], "契約の形どおりなのに口が断るメール")

    def test_K1117_CT_007_credential_login_pattern_is_the_same_everywhere(self):
        ts = (ROOT / "apps/api/src/features/F3/credentials/patterns.ts").read_text(encoding="utf-8")
        m = re.search(r'export const LOGIN_PATTERN = ("(?:[^"\\]|\\.)*");', ts)
        self.assertIsNotNone(m, "patterns.ts に LOGIN_PATTERN が無い")
        ts_login = json.loads(m.group(1))  # type: ignore[union-attr]
        want = portable_regex.portable("\\S")
        self.assertEqual(credential_patterns.LOGIN, want)
        self.assertEqual(ts_login, want)
        self.assertEqual(SCHEMAS["CredentialCreateInput"]["properties"]["login"]["pattern"], want)
        self.assertNotIn("\\S", want)


if __name__ == "__main__":
    unittest.main(verbosity=2)
