#!/usr/bin/env python3
"""K-144 の試験：契約（08_api/openapi.yaml と、その元 05_flow/screen_api.py）が口の実際の振る舞いを書いているか。

  python3 scripts/ci/contract_shape_test.py      全部の行（行 ID は K144-SHAPE-NNN。チケット 11_tickets/K-144.md の表の行と 1 対 1）

  作り手を回した後の生成物（08_api/openapi.yaml・packages/contracts/src/schemas.ts・08_api/types.ts）を読んで確かめる。
  口の振る舞いそのもの（本物の DB で叩いた答えが契約の形に合うか）は apps/api/test/features/contract/k144-contract.test.ts が見る。
  決まり（D-129.42・2026-11-08 決める人）：
    ・入力の形は、契約で知らない項目を許さない（additionalProperties: false）。入口は前から strict（z.strictObject）
    ・uuid の欄は、契約に正式な uuid の形（format: uuid）を書き、入口で厳しく確かめる（422）。中で 500 になる道を残さない
    ・口が返す状態コード・答えの中身の形（null を含む）は、全部契約に書く（K-62 の契約の fuzz が赤にしないため）
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import re
import sys
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "05_flow"))
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import email_patterns as _EP  # noqa: E402  登録・ログインのメールの形（K-1117）
from portable_regex import walk as _portable  # noqa: E402  作り手が契約に書くときの直し（\s \S \d \w を JS と同じ字に・K-1117）。表の字はそのまま、比べる前に当てる


def _load_screen_api():
    spec = importlib.util.spec_from_file_location("screen_api_k144", ROOT / "05_flow" / "screen_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


SA = _load_screen_api()
OA = yaml.safe_load((ROOT / "08_api" / "openapi.yaml").read_text(encoding="utf-8"))
SCHEMAS = OA["components"]["schemas"]
DBC = json.loads((ROOT / "08_api" / "db-columns.json").read_text(encoding="utf-8"))["tables"]
EPS = json.loads((ROOT / "08_api" / "endpoints.json").read_text(encoding="utf-8"))["endpoints"]
ZOD = (ROOT / "packages" / "contracts" / "src" / "schemas.ts").read_text(encoding="utf-8")
REGISTRY = (ROOT / "packages" / "contracts" / "src" / "registry.ts").read_text(encoding="utf-8")
TYPES = (ROOT / "08_api" / "types.ts").read_text(encoding="utf-8")

# INPUTS・RESPONSES の欄の型の名前として作り手（05_flow/build_api.py の _ftype）が表せるもの。後ろの ? は null を許す（any には付けない）
VOCAB = {"string", "integer", "number", "boolean", "object", "array", "uuid", "uuid[]", "string[]"}

# 類 E（回 9・Q5 回 8 追加-1）：口が「無い」ことで 422 にする入力の欄（必須の欄）。読んで洗い出した根拠つき。
#   入口の zod は前から全部 .optional()（契約に required が 1 つも無かった）なので、必須の確かめと文言は口の振る舞いが持っている。
#   ここに無い口の入力の形は required を持たない（条件つきで要る欄＝stepUp の code・種別ごとの必須の区画は required にしない）
REQUIRED_INPUTS: dict[str, set[str]] = {
    "completeTicket": {"conditions_confirmed"},   # apps/api/src/features/F5/approve-complete/complete.ts（conditions_confirmed だけ必須・todo_* は任意で中身は見ない・K-566）
    "returnApproval": {"note"},                       # apps/api/src/features/F5/approve-complete/decide.ts（無い・空は 422 E-VAL-020・K-163）
    "createSignup": {"email", "name", "password"},     # apps/api/src/features/F1/sign-up/input.ts:40〜47（E-VAL-004・010・005。無いと空と同じ）。company_name は空でよい（D-125.135）
    "verifySignup": {"token"},                         # apps/api/src/features/F1/verify-email/index.ts:227（無い・空は 422 E-PAGE-006・K52-API-015）
    "requestPasswordReset": {"email"},                 # apps/api/src/features/F1/password-reset/index.ts（無い・空・形違いは 422 E-VAL-004・K-313）
    "signInWithPassword": {"email", "password"},       # apps/api/src/features/F1/login/sign-in.ts の input（無い・空は 422 E-VAL-008・K301-API-009）
    "verifySignInCode": {"pending"},                   # apps/api/src/features/F1/login/sign-in-code.ts の input（待ちの印が無いと 422。code と backup_code はどちらか 1 つ・条件つき）
    "requestAdminRecovery": {"pending"},               # apps/api/src/features/F1/admin-recovery/index.ts の input（待ちの印が無いと 422・K-302 と同じ・K305-API-011）
    "confirmTwoFactor": {"code"},                      # apps/api/src/features/F1/two-factor/index.ts（無い・空・6 けたでないは 422 欄 code・K311-API-007）
    "resetPassword": {"token", "new_password"},       # apps/api/src/features/F1/password-reset/index.ts（無い・文字でないは 422・K-314）
    "changePassword": {"current_password", "new_password"},   # apps/api/src/features/F1/change-password/index.ts（無い・文字でないは 422・欄ごと・K312-API-005・007）
    "setMyPassword": {"new_password"},                 # apps/api/src/features/F1/change-password/index.ts（無い・文字でないは 422・K312-API-017）
    "renamePasskey": {"name"},                         # apps/api/src/features/F1/passkeys/index.ts（無い・空・41 文字以上・制御文字は 422・欄 name・K-309）
    "consentToTerms": {"agree", "terms_version_id", "privacy_version_id"},   # apps/api/src/features/F1/consent-terms/index.ts:72・88〜90（E-VAL-019・同意する版の ID が要る）
    "claimPairingCode": {"code"},                      # apps/api/src/features/F3/connect-pc/code.ts:28。device_label・machine_id は送らなくてよい
    "saveMyTicketDraft": {"draft_id"},                 # apps/api/src/features/F4/create-ticket/hooks.ts:170
    "createTicket": {"title", "scope_id", "kind_id", "assignee_member_id", "due_on"},   # apps/api/src/features/F4/create-ticket/input.ts:28〜38
    "updateMemory": {"body"},                          # apps/api/src/hooks/agent.ts:63（覚えることが空です）。作る createMemory は {} で 201
    "reportJobProgress": {"kind"},                     # apps/api/src/features/F5/delegate/bridge.ts（kind が無い・決まった値でないは 422・K62-API-032）
    "finishBridgeJob": {"state"},                      # apps/api/src/features/F5/delegate/bridge.ts（state が無い・3 つ以外は 422・K62-API-032）
}
# 体を受ける作った口のうち、無いことで 422 にする欄を持たないもの（理由つき。新しく作った口はどちらかに載せる）
NO_REQUIRED_INPUTS: dict[str, str] = {
    "startTwoFactor": "password は口が見る：パスワードの無い人は 409・E-AUTH-020 を先に返し、ある人で空なら 422 欄 password（入口の 422 で 409 に届かなくしない・K311-API-022）",
    "createPairingCode": "体は空の形（K-57）。{} で 201",
    "sendHeartbeat": "health・protocol・version はどれも無くてよい（無ければ空の並び・古い印として扱う・connect-pc/hooks.ts:136〜145）",
    "resendSignupEmail": "体は空の形。申し込みの印は頭 x-signup-token で受ける（D-128.142）",
    "createConversation": "incognito だけを読み、無ければ普通の会話（hooks/agent.ts:35）。{} で 201",
    "updateConversation": "title・starred_at・incognito は無ければ変えない（hooks/agent.ts:42〜47）。{} で 200",
    "createMemory": "表の素の書き込み。無い列は DB の既定（{} で 201・K144-API-033）",
    "delegateTicket": "使わない理由 no_spec_reason は無くてよい（K-565）。{} で 201。知らない欄は 422（K62-API-030）",
    "takeBridgeJob": "wait_sec・protocol・idle はどれも無くてよい（無ければ 0・古い印・いま動いている）。bridge.ts の takeBridgeJob（K-62）",
    "callKanameTool": "input が無ければ {} として道具に渡す（tools.ts・K-62）",
    "approveApproval": "体は空の形（K-162）。{} で 201。知らない欄は 422（契約の strict）",
    "dismissSetupTasks": "key は無くてよい（無ければ箱を閉じる・K-250）。{} で 201",
    "stepUp": "password か passkey のどちらか 1 つ（条件つき・K-309）。どちらも無ければ口が 422（apps/api/src/hooks/auth.ts）",
}
# 類 F（回 9・Q5 回 8 追加-2）：道の値を口が値域つきで断る（422）口。契約の道の値の形に値域（pattern）を書く
PATH_PATTERNS: dict[tuple[str, str], str] = {
    # apps/api/src/features/F3/connect-pc/hooks.ts:191（mac・win）・200（それ以外の英小文字だけの名前は 422）・202〜204（ほかは目録の名前か 404）
    ("downloadBridgeRelease", "name"): r"^(?:mac|win|[\s\S]*[^a-z][\s\S]*)$",
    # apps/api/src/features/F5/delegate/tools.ts:40（ticket_read と会話の道具 8 つ以外は 422・K-62）
    ("callKanameTool", "name"): r"^(?:ticket_read|draft_read|goal_set|goal_remove|ledger_set|ledger_remove|duty_set|duty_remove|remember)$",
}

# 類 G（回 9 の続き・PM の判断 2026-11-09）：契約の形に合う値を口が 422 で断る体の値。書ける値域は契約の欄に足す（type・format・nullable は変えない＝入口の zod は変わらない）。
#   値域は口が受ける値の集合より狭く書かない（狭いと契約の外の値を口が受けて fuzz の ST201）。書けない分だけ広く、その分は UNEXPRESSIBLE_422 に理由を書く
CODE_SEP = "\\s\\-‐‑‒–—―ー−－"
CODE_CHAR = "2-9A-HJKMNP-Za-hjkmnp-z２-９Ａ-ＨＪＫＭＮＰ-Ｚａ-ｈｊｋｍｎｐ-ｚ"
VALUE_RANGES: dict[str, dict[str, dict]] = {
    "createTicket": {   # apps/api/src/features/F4/create-ticket/input.ts の checkCreate
        "title": {"pattern": "\\S", "maxLength": 200},                                  # :28〜30（前後の空白を落として空は 422・200 字まで）
        "due_on": {"pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},                           # :37〜41（日付の形。今日より前・暦に無い日は書けない）
        "start_on": {"pattern": "^(?:[0-9]{4}-[0-9]{2}-[0-9]{2})?$"},                    # :42〜46（空は「無し」）
        "priority": {"enum": ["", "mid", "high"]},                                       # :47〜48（空は中）
        "estimate_minutes": {"anyOf": [{"type": "integer", "minimum": 0, "maximum": 100000},
                                       {"type": "string", "pattern": "^(?:0*(?:[0-9]{1,5}|100000))?$"}], "nullable": True},   # :52〜61
        "sections": {"propertyNames": {"pattern": "^[a-z][a-z0-9_]{0,40}$"},
                     "additionalProperties": {"type": "string"}},     # :63〜74（区画の中身の上限 20,000 字は外した・D-130.3。守りは送る量 1MB だけ）
        "notify_member_ids": {"maxItems": 20},                                           # :75〜81
    },
    "claimPairingCode": {   # apps/api/src/features/F3/connect-pc/code.ts:27〜36（NFKC・大文字・区切りを落として、見分けやすい英数字 6 けた。32 字まで）
        "code": {"maxLength": 32, "pattern": f"^[{CODE_SEP}]*(?:[{CODE_CHAR}][{CODE_SEP}]*){{6}}$"},
    },
    "updateConversation": {"title": {"pattern": "\\S"}},   # apps/api/src/hooks/agent.ts:42〜43（改行を空白にして前後を落とし、空は 422）
    "updateMemory": {"body": {"pattern": "\\S"}},          # apps/api/src/hooks/agent.ts:62〜63
    "createMemory": {"confidence": {"pattern": "^-?(?:[0-8](?:\\.[0-9]+)?|9(?:\\.(?:[0-9]{1,2}|(?:[0-8][0-9]|9[0-8])[0-9]+|99[0-4][0-9]*))?)$"}, "kind_id": {"enum": ["rule", "preference", "example", None]}},   # memories.confidence numeric(3,2)（10 以上は DB が断る）
    "createSignup": {   # apps/api/src/features/F1/sign-up/input.ts:37〜47
        "email": {"pattern": _EP.LOGIN_EMAIL},   # 部品の z.email() の形を前後の空白で挟んだ物（K-1117）
        "name": {"pattern": "\\S", "maxLength": 100},
        "company_name": {"maxLength": 100},
        "password": {"minLength": 12},
    },
    "verifySignup": {"token": {"pattern": "\\S"}},      # apps/api/src/features/F1/verify-email/index.ts:226〜227（空は 422・形が違えば 410）
    "signInWithPassword": {"email": {"pattern": "\\S"}, "password": {"pattern": "\\S"}},   # apps/api/src/features/F1/login/sign-in.ts（空は 422 E-VAL-008・K301-API-009）
    "verifySignInCode": {"code": {"pattern": "\\S", "maxLength": 64}, "backup_code": {"pattern": "\\S", "maxLength": 64}},   # apps/api/src/features/F1/login/sign-in-code.ts（空・64 文字を超えると 422 E-VAL-009・K302-API-012）
    "renamePasskey": {"name": {"pattern": "\\S"}},     # apps/api/src/features/F1/passkeys/index.ts（空・空白だけは 422・K-309）
    "confirmTwoFactor": {"code": {"pattern": "\\S", "maxLength": 64}},   # apps/api/src/features/F1/two-factor/index.ts（空・64 文字を超えると入口で 422 欄 code・6 けたでないは口が 422 欄 code・K311-API-007）
    "delegateTicket": {"no_spec_reason": {"pattern": "\\S", "maxLength": 500}},   # apps/api/src/features/F5/delegate/people.ts・app.ticket_delegate（使わない理由・1〜500 字・K-565）
    "finishBridgeJob": {"result": {"maxLength": 200000}},   # apps/api/src/features/F5/delegate/bridge.ts（REPLY_MAX・K62-API-032）。その欄だけの上限（K-62）
    "consentToTerms": {"agree": {"enum": [True]}},      # apps/api/src/features/F1/consent-terms/index.ts:72（true でなければ 422 E-VAL-019）
}
# 契約に書けない値の決まり（口の振る舞いのまま 422）。422 の説明と x-unexpressible-422 に書く。fuzz での扱いは K-62 の受け持ち
UNEXPRESSIBLE_422: dict[str, list[str]] = {
    "createTicket": ["期限が今日より前（E-VAL-012・今日は日本時間）", "暦に無い日付の期限・開始", "開始が期限より後", "優先度が高で理由が空",
                     "種別の必須の区画が空（E-VAL-013）", "グループ・種別・担当者・知らせる人がその会社に無いか書けない（E-VAL-014）",
                     "親のチケットが深すぎる（E-VAL-015）", "前後の空白・NFKC で長さが変わる題名"],
    "claimPairingCode": ["NFKC で英数字になる字（① など）"],
    "updateConversation": ["名前が null（空と同じ）"],
    "changePassword": ["漏れたことのあるパスワード（E-VAL-011）", "12 文字より短い・128 文字を超える新しいパスワード（E-VAL-005・E-VAL-026・文字の数で数える）", "今のパスワードが違う（欄 current_password）"],   # K-312
    "setMyPassword": ["漏れたことのあるパスワード（E-VAL-011）", "12 文字より短い・128 文字を超える新しいパスワード（E-VAL-005・E-VAL-026・文字の数で数える）"],   # K-312
    "createSignup": ["漏れたことのあるパスワード（E-VAL-011）", "制御文字・NFKC で形や長さが変わるメール・名前・会社名"],
    "stepUp": ["2 段階を使う人のコードが空（条件つき）", "password も passkey も無い・password が空（どちらか 1 つ・K-309）", "passkey が object でない"],
    "renamePasskey": ["NFKC と前後の空白を除いて 41 文字以上の名前", "制御文字（改行・タブ・NUL など）を含む名前"],
    "consentToTerms": ["無い版の ID（版の ID の在りか）"],
    "dismissSetupTasks": ["任意でない項目・知らない key"],   # K-250：key は形（string）だけ契約に書け、任意の項目（credentials）かは口が決める
}
# 会話と記憶の口（hooks/agent.ts）の成功の答えの形（類 C/D の続き）：表の行ではなく、口が返すとおりの形
AGENT_ANSWERS: dict[str, tuple[str, dict[str, str]]] = {
    "createConversation": ("ConversationCreated", {"id": "uuid", "conversation_id": "uuid"}),   # hooks/agent.ts:37
    "updateConversation": ("ConversationUpdated", {"id": "uuid", "ok": "boolean"}),             # hooks/agent.ts:50
    "updateMemory": ("MemoryUpdated", {"id": "uuid", "ok": "boolean"}),                          # hooks/agent.ts:66
}

# チケットごとのファイル（contract_shape.d/K-xxx.py）の分を足す（K-325）。足せるのはこの 6 つの表だけ（OA・SCHEMAS などの読んだ値は足させない）
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
from registry_d import merge_py  # noqa: E402
import credential_patterns as _CP  # noqa: E402

FRAGMENT_NAMES = ("REQUIRED_INPUTS", "NO_REQUIRED_INPUTS", "PATH_PATTERNS", "VALUE_RANGES", "UNEXPRESSIBLE_422", "AGENT_ANSWERS")
merge_py(globals(), ROOT / "scripts" / "ci" / "contract_shape.d", names=FRAGMENT_NAMES,
         helpers={"CODE_SEP": CODE_SEP, "CODE_CHAR": CODE_CHAR, "_CP": _CP})

# 口の振る舞い（hooks）の入口。ここに並ぶ口が全部、拾う対象（K-57・K-60 だけでなく今ある口の全部・PM の続きの指示 2026-11-08）
HOOKS_DIR = ROOT / "apps/api/src/hooks"
# 共通の処理（apps/api/src/contract/op.ts）のうち、hooks から呼ばれて状態コードを返すもの
SHARED_HELPERS = {"unwritable": {403, 404}}


def operation(op_id: str) -> tuple[str, str, dict]:
    for path, methods in OA["paths"].items():
        for method, op in methods.items():
            if isinstance(op, dict) and op.get("operationId") == op_id:
                return path, method, op
    raise AssertionError(f"契約に {op_id} が無い")


def ref_name(s: dict) -> str:
    return s["$ref"].rsplit("/", 1)[-1]


def prop(schema_name: str, field: str) -> dict:
    sc = SCHEMAS[schema_name]
    assert field in sc["properties"], f"{schema_name} に {field} が無い"
    return sc["properties"][field]


def table_of(op_id: str) -> str | None:
    """口の表（08_api/endpoints.json）。契約に無い口（RESPONSES にだけある名前）は None"""
    for e in EPS:
        oid = e.get("operation_id") or e["implementation_path"].split("::")[1]
        if oid == op_id:
            return e.get("table") or e["path"].split("/")[3]
    return None


def is_uuid(p: dict) -> bool:
    return p.get("type") == "string" and p.get("format") == "uuid"


def catalog_status() -> dict[str, int]:
    """エラーの正本（packages/errors）の ID → 状態コード（cls → STATUS_OF）"""
    idx = (ROOT / "packages/errors/src/index.ts").read_text(encoding="utf-8")
    block = re.search(r"STATUS_OF[^{]*\{([^}]*)\}", idx)
    assert block, "packages/errors/src/index.ts に STATUS_OF が無い"
    status_of = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d{3})", block.group(1))}
    cat = (ROOT / "packages/errors/src/catalog.ts").read_text(encoding="utf-8")
    out: dict[str, int] = {}
    for code, cls in re.findall(r'"(E-[A-Z]+-\d{3})":\s*\{\s*"id":\s*"E-[A-Z]+-\d{3}",\s*"cls":\s*"(\w+)"', cat):
        out[code] = status_of[cls]
    assert out, "エラーの正本が読めない"
    return out


def hook_blocks(src: str) -> dict[str, str]:
    """hooks のファイルを口（operationId）ごとの中身に分ける（`    opName: {` の行から次の同じ深さの行まで）"""
    heads = list(re.finditer(r"^    (\w+): \{\s*$", src, re.M))
    out = {}
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(src)
        out[m.group(1)] = src[m.start():end]
    return out


_DEF = re.compile(r"^(\s*)(?:export\s+)?(?:const\s+(\w+)\s*(?::[^=]*)?=|(?:async\s+)?function\s+(\w+))", re.M)


def definitions(src: str) -> dict[str, str]:
    """ファイルの中の名前つきの定義（const・function。入れ子も）→ その中身（次の同じ深さかより浅い定義・return { の行まで）"""
    lines = src.split("\n")
    out: dict[str, str] = {}
    for i, line in enumerate(lines):
        m = _DEF.match(line)
        if not m:
            continue
        ind = len(m.group(1))
        if line.rstrip().endswith(";"):
            out[m.group(2) or m.group(3)] = line  # 1 行で終わる定義（const OS = new Set([…]);）
            continue
        j = i + 1
        while j < len(lines):
            n = lines[j]
            k = len(n) - len(n.lstrip())
            if n.strip() and k <= ind and re.match(r"\s*(?:export\s+|const\s|let\s|(?:async\s+)?function\s|return\s|\}\s*$|\};?\s*$)", n):
                break
            j += 1
        body = "\n".join(lines[i:j + 1])
        if not hook_blocks(body):  # 口を並べる工場（connectPcHooks など）は定義として辿らない（口ごとに分けて見る）
            out[m.group(2) or m.group(3)] = body
    return out


def _imported_files(path: pathlib.Path, src: str) -> list[pathlib.Path]:
    """そのファイルが相対で import するファイル（.js → .ts）と、同じフォルダの .ts（入力の確かめが別のファイルにある口）"""
    out = []
    for rel in re.findall(r'from\s+"(\.{1,2}/[^"]+)"', src):
        f = (path.parent / rel).resolve()
        f = f.with_suffix(".ts") if f.suffix == ".js" else f
        if f.exists() and "contract" not in f.parts[-2:]:
            out.append(f)
            out += [g for g in sorted(f.parent.glob("*.ts")) if g != f and not g.name.endswith(".test.ts")]
    return list(dict.fromkeys(out))


def op_block(src: str, op: str) -> str | None:
    """機能のファイルの中の口 op の中身（`op: {` から対になる `}` まで）。1 行の形（`op: { before: … },`）も、どの深さの複数行の形も読む（K-185）"""
    m = re.search(rf"^\s+{re.escape(op)}:\s*\{{", src, re.M)
    if not m:
        return None
    depth, i = 0, m.end() - 1
    while i < len(src):
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return src[m.start():i + 1]
        i += 1
    return None


def hook_regions() -> dict[str, tuple[str, dict[str, str]]]:
    """今ある口の全部（apps/api/src/hooks/*.ts に並ぶ口）→（振る舞いの中身・そこから呼べる定義）。
    中身の書き方は 3 つ：その場の { before: async … }／機能のフォルダの hooks に預ける { ...h["op"] }／機能の関数に預ける { before: f.name, input: fn }"""
    out: dict[str, tuple[str, dict[str, str]]] = {}
    listed: set[str] = set()   # hooks のファイルが { ...h["op"] } で並べた口（拾えなければ黙って外さずに赤・K-185）
    for hf in sorted(HOOKS_DIR.glob("*.ts")):
        src = hf.read_text(encoding="utf-8")
        files = [hf] + _imported_files(hf, src)
        defs: dict[str, str] = {}
        texts = {}
        for f in files:
            t = f.read_text(encoding="utf-8")
            texts[f] = t
            for k, v in definitions(t).items():
                defs.setdefault(k, v)
        for op_id, block in hook_blocks(src).items():
            out[op_id] = (block, defs)
        for m in re.finditer(r"(\w+):\s*\{([^{}]*)\}", src):
            op_id, body = m.group(1), m.group(2)
            if op_id in out and "before:" not in body and "...h[" not in body:
                continue
            parts = []
            for ref in re.findall(r'\.\.\.h\["(\w+)"\]', body):
                listed.add(ref)
                for f in files[1:]:
                    b = hook_blocks(texts[f]).get(ref) or op_block(texts[f], ref)   # 1 行の形も読む（K-185）
                    if b:
                        parts.append(b)
                        break
            for name in re.findall(r"(?:before|input|after):\s*(?:\w+\.)?(\w+)", body):
                if name in defs:
                    parts.append(defs[name])
            if parts:
                out[op_id] = ("\n".join(parts), defs)
    assert out, "hooks の口が 1 本も拾えない（apps/api/src/hooks の書き方が変わった）"
    lost = sorted(listed - set(out))
    assert not lost, f"hooks のファイルに並ぶのに中身を読めない口：{', '.join(lost)}（書き方が変わった・拾い方を直す）"
    return out


def statuses_in(block: str, cat: dict[str, int], defs: dict[str, str] | None = None, depth: int = 3) -> set[int]:
    """口の中身が返しうる状態コード（機械で拾う）：
    数の literal（status: 404）・状態を最初の引数に取る関数の呼び出し（fail(404, …)・reply(410, …)・fromCatalog(500, …)・ok(201, …)）・
    正本の ID だけを渡す呼び出し（fromCatalog("E-…")・fail("E-…")。kanameError は体を作るだけなので数えない）・
    同じファイル群の定義の呼び出し（invalid(…)・serverDown()・parseSignup(…)・大文字の定数 NO_TOKEN など。depth 段まで辿る）・
    共通の処理（unwritable）"""
    defs = defs or {}
    s = {int(x) for x in re.findall(r"\bstatus:\s*(\d{3})\b", block)}
    s |= {int(x) for x in re.findall(r"\b\w+\(\s*([1-5]\d\d)\s*,", block)}
    for code in re.findall(r'\b(\w+)\(\s*"(E-[A-Z]+-\d{3})"', block):
        if code[0] in ("kanameError", "KanameError"):
            continue
        assert code[1] in cat, f"エラーの正本に {code[1]} が無い"
        s.add(cat[code[1]])
    for name, extra in SHARED_HELPERS.items():
        if re.search(rf"\b{name}\(", block):
            s |= extra
    if depth > 0:
        for name, body in defs.items():
            used = re.search(rf"\b{name}\(", block) or (name.isupper() and re.search(rf"\b{name}\b", block))
            if used and body not in block:
                s |= statuses_in(body, cat, defs, depth - 1)
    return s



def returns_raw(text: str) -> bool:
    """返す答え（status の鍵を持つ物の書き方）に鍵 raw があるか。`raw: <値>` と省略形 `raw`（, か } が続く）の両方を拾う。
    引数・変数の名前の raw、型の `raw?:`（; で区切る型の書き方）は拾わない（K144-SHAPE-011・回 6）"""
    for obj in re.findall(r"\{[^{}]*\}", text):
        if not re.search(r"(?:^\{|,)\s*status\s*:", obj):
            continue
        if re.search(r"(?:^\{|,)\s*raw\s*(?::|,|\})", obj):
            return True
    return False


K144 = "apps/api/test/features/contract/k144-contract.test.ts"
K144_LEAVES = "apps/api/test/features/contract/k144.d"   # 葉ごとのファイル（K-<番号>.ts）の置き場（K-378）
UUID_ROW = re.compile(r'\["K144-API-\d{3}",\s*"(\w+)",\s*"(path|query)",\s*"(\w+)"\]')


def k144_uuid_rows(root: pathlib.Path = ROOT) -> list[tuple[str, str, str, str]]:
    """入口の uuid の行の全部：(口, path か query, 値の名前, 書いてあるファイル)。
    本体 k144-contract.test.ts の UUID_PARAM_CASES の中と、置き場 k144.d の葉ごとのファイル（K-<番号>.ts）の字から拾う（K-378）。
    葉のファイルは字のどこに在っても拾う（読む所 k144-leaves.ts が「字から拾った行＝動く行」を確かめる）"""
    src = (root / K144).read_text(encoding="utf-8")
    block = re.search(r"UUID_PARAM_CASES = \[(.*?)\] as const;", src, re.S)
    if block is None:
        raise AssertionError("UUID_PARAM_CASES が無い")
    rows = [(*r, K144) for r in UUID_ROW.findall(block.group(1))]
    place = root / K144_LEAVES
    leaves = sorted((f for f in place.glob("K-*.ts") if re.fullmatch(r"K-[1-9]\d*\.ts", f.name)), key=lambda f: int(f.stem[2:])) if place.is_dir() else []
    for f in leaves:
        rows += [(*r, f"{K144_LEAVES}/{f.name}") for r in UUID_ROW.findall(f.read_text(encoding="utf-8"))]
    return rows


class ContractShapeTest(unittest.TestCase):
    # ---- 作り手が書ける形（R1 #3）
    def test_K144_SHAPE_001_input_and_answer_types_are_in_the_generator_vocabulary(self) -> None:
        """INPUTS・RESPONSES の欄の型の名前は、作り手が契約に書ける名前だけ（uuid・uuid[] を足した）。知らない名前を黙って string にしない"""
        bad = []
        for table in ("INPUTS", "RESPONSES"):
            for op_id, (_name, props) in getattr(SA, table).items():
                for k, v in props.items():
                    if v == "any" and table == "INPUTS":
                        continue
                    base = v[:-1] if v.endswith("?") else v
                    if base not in VOCAB:
                        bad.append(f"{table}.{op_id}.{k}={v}")
        self.assertEqual(bad, [], "作り手が表せない型の名前")

    # ---- 入力の知らない項目（R1 #4）
    def test_K144_SHAPE_002_every_request_body_rejects_unknown_fields(self) -> None:
        """要求の体の形は、全部 additionalProperties: false（入口の z.strictObject と同じ）。表の行の入力（*Input）と INPUTS の形の両方"""
        names = {ref_name(op["requestBody"]["content"]["application/json"]["schema"])
                 for methods in OA["paths"].values() for op in methods.values()
                 if isinstance(op, dict) and "requestBody" in op}
        names |= {n for n, _ in SA.INPUTS.values()}
        self.assertIn("PairingCodeInput", names)
        missing = sorted(n for n in names if SCHEMAS[n].get("additionalProperties") is not False)
        self.assertEqual(missing, [], "知らない項目を許している入力の形")

    def test_K144_SHAPE_003_pairing_code_input_is_empty_and_closed(self) -> None:
        """fuzz の赤 ③：createPairingCode の体は空の形で、知らない項目を許さない"""
        sc = SCHEMAS[ref_name(operation("createPairingCode")[2]["requestBody"]["content"]["application/json"]["schema"])]
        self.assertEqual(sc["properties"], {})
        self.assertIs(sc.get("additionalProperties"), False)

    # ---- uuid の欄（R1 #5・D-129.42）
    def test_K144_SHAPE_004_every_id_field_of_hand_written_inputs_is_uuid(self) -> None:
        """INPUTS の欄で名前が *_id のものは uuid、*_ids のものは uuid の並び（機械の決まり。口の中の正規表現に頼らない）"""
        bad = []
        for _op, (name, props) in SA.INPUTS.items():
            for k in props:
                p = SCHEMAS[name]["properties"][k]
                if k.endswith("_id") and not is_uuid(p):
                    bad.append(f"{name}.{k}")
                if k.endswith("_ids") and not (p.get("type") == "array" and is_uuid(p.get("items") or {})):
                    bad.append(f"{name}.{k}")
        self.assertEqual(bad, [], "uuid の形を契約に書いていない id の欄")

    @staticmethod
    def _id_params() -> list[tuple[str, str, str, dict]]:
        """契約の全部の口（まだ作っていない口も）の、id の道の値と問い合わせ：道は名前が id か id で終わるもの（:id・:qid・:pid・:mid）、
        問い合わせは名前が *_id・*_ids のもの（口ごとの QUERIES と一覧の scope_id）"""
        out = []
        for path, methods in OA["paths"].items():
            for _m, op in methods.items():
                if not isinstance(op, dict):
                    continue
                for x in op.get("parameters", []):
                    n = x["name"]
                    if (x["in"] == "path" and n.endswith("id")) or (x["in"] == "query" and re.search(r"_ids?$", n)):
                        out.append((op["operationId"], x["in"], n, x["schema"]))
        return out

    def test_K144_SHAPE_015_every_id_path_value_and_query_is_uuid(self) -> None:
        """回 2 の差し戻し（R1 #5）：道の値（:id だけでなく :qid・:pid・:mid）と問い合わせの *_id（listClientRequests・listRules の client_id、listScopes の layer_id、
        listAuditEvents の member_id・ticket_id、listCredentials の tenant_id など）も、契約に format: uuid（*_ids は uuid の並び）。作り手の決まりで全部の口に"""
        params = self._id_params()
        names = {(i, n) for _o, i, n, _s in params}
        # K-92：listTickets の kind_id・assignee_id は契約から外した（まだ使えない絞り込み・422・E-VAL-018）。拾い方の見本は契約に残る欄に替えた
        for must in [("path", "qid"), ("path", "pid"), ("path", "mid"), ("query", "client_id"), ("query", "layer_id"),
                     ("query", "actor_member_id"), ("query", "tenant_id"), ("query", "plan_id"), ("query", "parent_id")]:
            self.assertIn(must, names, f"{must} を拾えていない（拾い方が壊れたか、口が消えた）")
        bad = [f"{o} {i}:{n}" for o, i, n, sc in params
               if not (is_uuid(sc) if not n.endswith("_ids") else sc.get("type") == "array" and is_uuid(sc.get("items") or {}))]
        self.assertEqual(bad, [], "uuid の形を契約に書いていない道の値・問い合わせ")

    def test_K144_SHAPE_016_registry_carries_uuid_params_for_the_entrance(self) -> None:
        """入口（apps/api/src/contract/op.ts）が道の値と問い合わせの uuid を確かめられるよう、作り手（scripts/ci/contract.mjs）が
        registry の口ごとに uuidParams（契約で format: uuid の道の値と問い合わせの名前）を出している。契約と 1 対 1"""
        want: dict[str, set[str]] = {}
        for o, _i, n, sc in self._id_params():
            if is_uuid(sc) or is_uuid(sc.get("items") or {}):
                want.setdefault(o, set()).add(n)
        blocks = re.split(r'\n  \{\n', REGISTRY)
        got: dict[str, set[str]] = {}
        for b in blocks:
            m = re.search(r'"operationId":\s*"(\w+)"', b)
            if not m:
                continue
            u = re.search(r'"uuidParams":\s*\[([^\]]*)\]', b)
            self.assertIsNotNone(u, f"registry の {m.group(1)} に uuidParams が無い")
            got[m.group(1)] = set(re.findall(r'"(\w+)"', u.group(1)))  # type: ignore[union-attr]
        self.assertTrue(got, "registry を読めない")
        diff = sorted(f"{o}: 契約 {sorted(want.get(o, set()))} ／ registry {sorted(got.get(o, set()))}"
                      for o in set(want) | set(got) if want.get(o, set()) != got.get(o, set()))
        self.assertEqual(diff, [], "registry の uuidParams が契約と合わない")

    def test_K144_SHAPE_005_known_uuid_fields_and_nullability(self) -> None:
        """口が uuid として確かめている欄（全文検索で洗い出したもの）は全部 format: uuid。送らなくてよい印の machine_id だけ null を許す"""
        want = {
            ("BridgeClaimInput", "machine_id"): True,
            ("TicketCreateInput", "scope_id"): False,
            ("TicketCreateInput", "kind_id"): False,
            ("TicketCreateInput", "assignee_member_id"): False,
            ("TicketCreateInput", "parent_ticket_id"): False,
            ("TicketCreateInput", "draft_id"): False,
            ("TicketCreateInput", "source_draft_id"): False,
            ("TicketDraftInput", "draft_id"): False,
            ("TermsConsentInput", "terms_version_id"): False,
            ("TermsConsentInput", "privacy_version_id"): False,
        }
        for (name, field), nullable in want.items():
            p = prop(name, field)
            self.assertTrue(is_uuid(p), f"{name}.{field} が format: uuid でない: {p}")
            self.assertEqual(bool(p.get("nullable")), nullable, f"{name}.{field} の null")
        items = prop("TicketCreateInput", "notify_member_ids").get("items") or {}
        self.assertTrue(is_uuid(items), f"TicketCreateInput.notify_member_ids の中身が uuid でない: {items}")

    def test_K144_SHAPE_006_generated_zod_checks_uuid_at_the_entrance(self) -> None:
        """作り手（scripts/ci/contract.mjs）が、入口の形（packages/contracts/src/schemas.ts）を z.uuid() にしている。並びの中身も"""
        def body(name: str) -> str:
            m = re.search(rf"export const {name} = z\.strictObject\(\{{(.*?)\n\}}\);", ZOD, re.S)
            self.assertIsNotNone(m, f"schemas.ts に {name} が無い")
            return m.group(1)  # type: ignore[union-attr]
        self.assertRegex(body("TicketDraftInput"), r"\n  draft_id: z\.uuid\(\)\.optional\(\),")
        self.assertRegex(body("BridgeClaimInput"), r"\n  machine_id: z\.uuid\(\)\.nullable\(\)\.optional\(\),")
        self.assertRegex(body("TicketCreateInput"), r"\n  notify_member_ids: z\.array\(z\.uuid\(\)\)\.optional\(\),")
        self.assertRegex(body("TermsConsentInput"), r"\n  terms_version_id: z\.uuid\(\)\.optional\(\),")

    # ---- 契約に無い応答（R1 #6）
    def test_K144_SHAPE_007_release_file_answers_are_all_in_the_contract(self) -> None:
        """fuzz の赤 ①：配布物の受け取りは 200（JSON の期限つき URL か、ファイルそのもの）・404（NOT_FOUND と E-CONN-014）・422・503（E-PAGE-007）"""
        _p, _m, op = operation("downloadBridgeRelease")
        r = op["responses"]
        ok = r["200"]["content"]
        self.assertEqual(ref_name(ok["application/json"]["schema"]["properties"]["data"]), "BridgeReleaseLink")
        self.assertEqual(ok.get("application/octet-stream", {}).get("schema"), {"type": "string", "format": "binary"})
        for code in ("404", "422", "503"):
            self.assertIn(code, r, f"downloadBridgeRelease に {code} が無い")
        self.assertIn("NOT_FOUND", r["404"]["description"])
        self.assertIn("E-CONN-014", r["404"]["description"])
        self.assertIn("E-PAGE-007", r["503"]["description"])

    def test_K144_SHAPE_008_latest_release_answers_and_query(self) -> None:
        """新しい版を見る口は 503（E-PAGE-007）を返し、問い合わせ os・arch を受ける（口は値が違えば更新を返さないだけ。必須ではない）"""
        _p, _m, op = operation("getLatestBridgeRelease")
        self.assertIn("503", op["responses"])
        self.assertIn("E-PAGE-007", op["responses"]["503"]["description"])
        q = {x["name"]: x for x in op.get("parameters", []) if x["in"] == "query"}
        for n in ("os", "arch"):
            self.assertIn(n, q, f"getLatestBridgeRelease に問い合わせ {n} が無い")
            self.assertFalse(q[n].get("required", False))
            self.assertEqual(q[n]["schema"].get("type"), "string")

    def test_K144_SHAPE_009_create_ticket_declares_parent_not_found(self) -> None:
        """チケットを作る口は、親が無い・見えないとき 404（E-PAGE-001）を返す。契約にも 404 がある"""
        r = operation("createTicket")[2]["responses"]
        self.assertIn("404", r)
        self.assertIn("E-PAGE-001", r["404"]["description"])

    def test_K144_SHAPE_010_every_status_a_hook_returns_is_in_the_contract(self) -> None:
        """今ある口の全部（apps/api/src/hooks に並ぶ口）の振る舞いが返しうる状態コードは、全部その口の契約の responses にある（機械で拾う）。
        K-57・K-60 の口に限らない（同意の口の 500 E-PAGE-003 など・PM の続きの指示 2026-11-08）"""
        cat = catalog_status()
        regions = hook_regions()
        for op_id in ("createPairingCode", "downloadBridgeRelease", "createTicket", "consentToTerms", "getCurrentTerms",
                      "createSignup", "verifySignup", "stepUp", "createConversation"):
            self.assertIn(op_id, regions, f"{op_id} の振る舞いを拾えていない（拾い方が壊れた）")
        self.assertIn(500, statuses_in(regions["consentToTerms"][0], cat, regions["consentToTerms"][1]), "同意の口の serverDown（500）を拾えていない")
        # 口の振る舞いを足す所（本物のサーバーと fuzz の的が束ねる一覧 apps/api/src/hooks/all.generated.ts・K-326）は、
        #   全部 apps/api/src/hooks のファイルの register から来る（拾う対象の外に口を置かない）
        listed = (HOOKS_DIR / "all.generated.ts").read_text(encoding="utf-8")
        used = re.findall(r'import \{ register as \w+ \} from "\./([\w-]+)\.js"', listed)
        self.assertTrue(used, "apps/api/src/hooks/all.generated.ts の一覧を読めない")
        outside = [n for n in used
                   if not (HOOKS_DIR / f"{n}.ts").is_file()
                   or not re.search(r"export const register\b", (HOOKS_DIR / f"{n}.ts").read_text(encoding="utf-8"))]
        self.assertEqual(outside, [], "apps/api/src/hooks のファイルの register でない物を一覧から差している")
        missing = []
        for op_id, (block, defs) in sorted(regions.items()):
            declared = {int(k) for k in operation(op_id)[2]["responses"]}
            for st in sorted(statuses_in(block, cat, defs) - declared):
                missing.append(f"{op_id} {st}")
        self.assertEqual(missing, [], "口が返すのに契約に無い状態コード")

    def test_K144_SHAPE_011_raw_answers_declare_a_non_json_content(self) -> None:
        """JSON でなくファイルそのものを返す口（返す答え HookReply に鍵 raw がある）は、200 に JSON 以外の中身の形を書いている。
        回 6：拾うのは「status の鍵を持つ物の中の raw の鍵」だけ（`raw: r` と省略形 `{ raw }`・`, raw }`）。引数や変数の名前 raw・型の `raw?:` は数えない"""
        # 拾い方そのものの確かめ（前の拾い方 \braw: は引数の名前を拾い、省略形を見落とした）
        for sample in ("return { status: 200, body: null, raw: r };", "return { status: 200, body: null, raw };",
                       "return { raw, status: 200, body: null };"):
            self.assertTrue(returns_raw(sample), f"返す答えの raw を拾えていない：{sample}")
        for sample in ("export function parse(raw: unknown) { return { status: 422, body: {} }; }",
                       "const raw = a.input.x; return { status: 200, body: raw };",
                       "type R = { status: number; body: unknown; raw?: Response };"):
            self.assertFalse(returns_raw(sample), f"答えでない raw を拾った：{sample}")
        bad: list[str] = []
        found: list[str] = []
        for op_id, (block, defs) in hook_regions().items():
            text = block + "".join(v for k, v in defs.items() if re.search(rf"\b{k}\(", block))
            if returns_raw(text):
                found.append(op_id)
                ok = operation(op_id)[2]["responses"].get("200", {}).get("content", {})
                if not any(k != "application/json" for k in ok):
                    bad.append(op_id)
        self.assertIn("downloadBridgeRelease", found, "ファイルを返す口を拾えていない（拾い方が壊れた）")
        self.assertEqual(bad, [], "ファイルを返すのに 200 が JSON だけ")

    def test_K144_SHAPE_017_every_built_op_has_an_entrance_uuid_row(self) -> None:
        """回 3（R1 #9）：作った口（hooks がある口か、表の素の読み書きで表がある口＝op.ts の 501 の外）の uuid の道の値と問い合わせは、
        全部 apps/api/test/features/contract/k144-contract.test.ts の UUID_PARAM_CASES か、置き場 k144.d の葉ごとのファイル（K-378）に 422 の行がある（数えて 1 対 1）。
        まだ作っていない口の代表 UNBUILT_UUID_CASE（422 が 501 より先）は、本当にまだ作っていない口の uuid の値を指す"""
        built = set(hook_regions())
        generic: dict[str, tuple[bool, str]] = {}
        for b in re.split(r"\n  \{\n", REGISTRY):
            m = re.search(r'"operationId":\s*"(\w+)"', b)
            if m:
                g = re.search(r'"generic":\s*(true|false)', b)
                t = re.search(r'"table":\s*"(\w+)"', b)
                generic[m.group(1)] = (bool(g and g.group(1) == "true"), t.group(1) if t else "")
        built |= {o for o, (g, t) in generic.items() if g and "id" in DBC.get(t, {})}
        want = {(o, i, n) for o, i, n, _sc in self._id_params() if o in built}
        src = (ROOT / K144).read_text(encoding="utf-8")
        rows = k144_uuid_rows()   # 本体の行と、置き場 k144.d の葉ごとのファイルの行（K-378）
        got = {(o, i, n) for o, i, n, _f in rows}
        twice = sorted(f"{o} {i} {n}：" + "・".join(f for a, b, c, f in rows if (a, b, c) == (o, i, n)) for o, i, n in got if sum((a, b, c) == (o, i, n) for a, b, c, _f in rows) > 1)
        self.assertEqual(twice, [], "同じ口の同じ値の行が 2 つある（本体か葉のファイルのどちらか 1 つにする）")
        self.assertEqual(sorted(want - got), [], "作った口の uuid の値なのに、入口の 422 の行が無い")
        self.assertEqual(sorted(got - want), [], "作った口の uuid の値でないものが行にある（口が消えたか、まだ作っていない）")
        u = re.search(r'UNBUILT_UUID_CASE = \["(\w+)",\s*"(path|query)",\s*"(\w+)"\]', src)
        self.assertIsNotNone(u, "UNBUILT_UUID_CASE が無い")
        o, i, n = u.groups()  # type: ignore[union-attr]
        self.assertNotIn(o, built, f"{o} はもう作った口（まだ作っていない口の代表を選び直す）")
        self.assertIn((o, i, n), {(a, b, c) for a, b, c, _ in self._id_params()}, f"{o} の {n} は uuid の値でない")

    # ---- 答えの null（R1 #7）
    def test_K144_SHAPE_012_answers_that_return_null_are_nullable(self) -> None:
        """口が null を返す欄（読んで洗い出したもの）は nullable。PC の引き取りは名前（device_label）も返す"""
        want = [
            ("TicketKindChoice", "color"),       # fuzz の赤 ②（ticket_kinds.color は null 可）
            ("BridgeRelease", "update"),         # その OS・CPU の更新が無いと null
            ("BridgeHeartbeat", "browser"),      # 口は ?? null で返す
            ("BridgeDevice", "device_label"),    # sessions.device_label は null 可
            ("BridgeDevice", "last_seen_at"),    # 最初の知らせの前（waiting）は null
            ("BridgeDevice", "version"),         # sessions.bridge_version は null 可
            ("BridgeDevice", "revoke_reason"),   # 生きている PC は null
            ("TicketDetail", "kind"),            # 種別の行が読めないと null
            ("TicketDetail", "stage"),           # 段の行が読めないと null
            ("TicketDetail", "assignee"),        # 担当者がいない（tickets.assignee_member_id は null 可）と null
            ("TicketDraft", "body"),             # 捨てた・使い終わった下書きは body: null（app.ticket_draft_save）
            ("TicketDraft", "saved_at"),         # 同上 saved_at: null
        ]
        for name, field in want:
            self.assertTrue(prop(name, field).get("nullable"), f"{name}.{field} が nullable でない")
        self.assertEqual(prop("BridgeClaim", "device_label").get("type"), "string")

    def test_K144_SHAPE_013_answer_fields_match_nullable_db_columns(self) -> None:
        """答えの形（RESPONSES）の欄が、その口の表の null を許す列と同じ名前なら、契約も null を許す。
        口が null を返さないと言い切れる欄だけ、screen_api.py の NOT_NULL_ANSWERS に理由（15 文字以上）を書いて外す（機械の洗い出し）"""
        exc = getattr(SA, "NOT_NULL_ANSWERS", {})
        bad = []
        for op_id, (_name, props) in SA.RESPONSES.items():
            t = table_of(op_id)
            cols = DBC.get(t, {}) if t else {}
            for k, v in props.items():
                if k in cols and cols[k].get("nullable") and not v.endswith("?") and f"{op_id}.{k}" not in exc:
                    bad.append(f"{op_id}.{k}（{t}.{k} は null 可）")
        self.assertEqual(bad, [], "DB は null を許すのに、答えの形が null を許さない")
        for key, reason in exc.items():
            op_id, _, field = key.partition(".")
            self.assertIn(op_id, SA.RESPONSES, f"NOT_NULL_ANSWERS の {key} の口が無い")
            self.assertIn(field, SA.RESPONSES[op_id][1], f"NOT_NULL_ANSWERS の {key} の欄が無い")
            self.assertGreaterEqual(len(reason), 15, f"NOT_NULL_ANSWERS の {key} の理由が短い")

    def test_K144_SHAPE_014_types_follow_the_contract(self) -> None:
        """画面とサーバーの型（08_api/types.ts）も契約に合う：色は null がある・下書きの id は文字"""
        self.assertRegex(TYPES, r"export type TicketKindChoice = \{[^}]*\bcolor\?: string \| null;")
        self.assertRegex(TYPES, r"export type TicketDraftInput = \{[^}]*\bdraft_id: string;")   # 回 9：必須の欄（類 E）なので ? が付かない

    def test_K144_SHAPE_018_every_op_declares_the_entrance_503(self) -> None:
        """回 6（類 C の続き）：/api/* の全部の口が通る入口（apps/api/src/middleware の tenantContext）が返す状態コード（セッションを解けないときの
        503・E-PAGE-003＝op.ts の sessionUnresolved）を、契約の全部の口の responses と endpoints.json の outputs_4xx（EARS の文つき）に書いている。
        生成の試験で本物の試験が別のファイルにある口（ears-elsewhere）は、その 503 の文の試験を covers に結んでいる（it.todo にしない）"""
        op_src = (ROOT / "apps/api/src/contract/op.ts").read_text(encoding="utf-8")
        mw = "".join(f.read_text(encoding="utf-8") for f in sorted((ROOT / "apps/api/src/middleware").glob("*.ts")) if ".test." not in f.name)
        helpers = set(re.findall(r"export const (\w+) = \(c: Context", op_src))
        statuses: dict[int, set[str]] = {}
        for h in helpers:
            if not re.search(rf"\b{h}\(", mw):
                continue
            body = re.search(rf"export const {h} = \(c: Context.*?\n\}};", op_src, re.S)
            self.assertIsNotNone(body, f"op.ts の {h} の中身を読めない")
            codes = set(re.findall(r'code: "([A-Z]-[A-Z]+-\d{3}|[A-Z_]+)"', body.group(0))) | set(re.findall(r'kanameError\("([A-Z]-[A-Z]+-\d{3})"\)', body.group(0)))  # type: ignore[union-attr]
            for st in re.findall(r"\},\s*(\d{3})\s*\)", body.group(0)):  # type: ignore[union-attr]
                statuses.setdefault(int(st), set()).update(codes)
        statuses |= {int(st): set() for st in re.findall(r"c\.json\([^;]*?,\s*(\d{3})\s*\)", mw)}
        self.assertIn(503, statuses, "入口（middleware）の 503 を拾えていない（拾い方が壊れた）")
        self.assertIn("E-PAGE-003", statuses[503])
        missing = []
        for path, methods in OA["paths"].items():
            if not path.startswith("/"):
                continue
            for method, op in methods.items():
                if not isinstance(op, dict) or "operationId" not in op:
                    continue
                for st, codes in statuses.items():
                    r = op.get("responses", {}).get(str(st))
                    if r is None:
                        missing.append(f"{op['operationId']} {st}")
                    elif not all(c in r.get("description", "") for c in codes):
                        missing.append(f"{op['operationId']} {st} の説明に {'・'.join(sorted(codes))} が無い")
        self.assertEqual(missing, [], "入口が全部の口で返すのに契約に無い状態コード")
        no_ears = [e.get("operation_id") or e["implementation_path"].split("::")[1] for e in EPS
                   if not any(x["status"] == 503 and x.get("code") == "E-PAGE-003" and "503" in x.get("ears_form", "") for x in e["outputs_4xx"])]
        self.assertEqual(no_ears, [], "endpoints.json の outputs_4xx に入口の 503・E-PAGE-003（EARS の文つき）が無い口")
        mapping = json.loads((ROOT / "07_qa/test-plan/ears-test-mapping.json").read_text(encoding="utf-8"))["mappings"]
        away = json.loads((ROOT / "07_qa/test-plan/ears-elsewhere.json").read_text(encoding="utf-8"))["ops"]
        op_of = {f"{e['method']} {e['path']}": e["implementation_path"].split("::")[1] for e in EPS}
        loose = [m["test_function"] for m in mapping
                 if m["http_code"] == "503" and "E-PAGE-003" in m["ears_text"] and op_of.get(m["endpoint"]) in away
                 and m["test_function"] not in away[op_of[m["endpoint"]]].get("covers", {})]
        self.assertEqual(loose, [], "本物の試験が別のファイルにある口の、入口の 503 の生成の試験が covers に結ばれていない（it.todo のまま）")

    def test_K144_SHAPE_019_no_hand_rolled_loose_uuid_check(self) -> None:
        """回 6（類 B の続き・L-008）・K-145 で広げた：画面（apps/web）・口（apps/api/src・前の道すじ apps/api/src/auth を含む）・Bridge（apps/bridge/src）・
        部品（packages/*/src）は、id の形を自前の緩い正規表現で確かめない。拾う形は 2 つ：
          (1) 緩い 36 字 `[0-9a-f-]{36}`（36 個のハイフンが通る）  (2) 版の桁を見ない 8-4-4-4-12 `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-`（版の桁 0 が通る）
        正式な形の手書きの正規表現（`-[1-8][0-9a-f]{3}-[89ab]…`）は、依存を持てない層の正本 2 ファイル（packages/db/src/id.ts・apps/bridge/src/pairing.ts）にしか無く、
        2 つの文字列は同じ（決まりが分かれない）。ほかは契約の isUuid（z.uuid()）か、その正本を import する。
        緩いと、入口が 422 で断る id を画面は「ある」とみなし、「見つからない」でなく「読み込めない」を出す（/tickets/<版の桁が 0 の 36 字>）。
        試験のファイル（.test・.spec・/test/・/tests/）と生成物は見ない"""
        loose = re.compile(r"\[0-9a-f(?:A-F)?-\]\{36\}")
        no_version = re.compile(r"\[0-9a-f(?:A-F)?\]\{8\}-\[0-9a-f(?:A-F)?\]\{4\}-\[0-9a-f(?:A-F)?\]\{4\}-")
        strict = re.compile(r"\[0-9a-f(?:A-F)?\]\{8\}-\[0-9a-f(?:A-F)?\]\{4\}-\[1-8\]\[0-9a-f(?:A-F)?\]\{3\}-")
        canon = {"packages/db/src/id.ts", "apps/bridge/src/pairing.ts"}
        # 拾い方そのものの見本（壊して確かめる）：緩い 2 形は拾い、正式な形は拾わない
        self.assertTrue(loose.search("const UUID = /^[0-9a-f-]{36}$/i;"))
        self.assertTrue(no_version.search("/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/"))
        self.assertFalse(no_version.search("/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i"))
        self.assertTrue(strict.search("/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i"))
        bad: list[str] = []
        strict_sources: dict[str, str] = {}
        bases = [ROOT / "apps/web", ROOT / "apps/api/src", ROOT / "apps/bridge/src"] + sorted((ROOT / "packages").glob("*/src"))
        for base in bases:
            for f in sorted(base.rglob("*.ts*")):
                rel = f.relative_to(ROOT).as_posix()
                if "node_modules" in rel or "/.next/" in rel or "/.next-prod/" in rel or "/dist/" in rel or re.search(r"(\.test\.|\.spec\.|/tests?/)", rel):
                    continue
                for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                    if loose.search(line) or no_version.search(line):
                        bad.append(f"{rel}:{i}")
                    m = strict.search(line)
                    if m:
                        if rel not in canon:
                            bad.append(f"{rel}:{i}（正式な形でも手書きは正本の外：isUuid か UUID_RE を import する）")
                        else:
                            lit = re.search(r"/\^.*\$/[a-z]*", line)
                            strict_sources[rel] = lit.group(0) if lit else line.strip()
        self.assertEqual(bad, [], "id の形を手書きの正規表現で確かめている（入口と同じ isUuid か、正本の UUID_RE を使う）")
        self.assertEqual(set(strict_sources), canon, "正本の 2 ファイルに正式な形の UUID_RE が無い")
        self.assertEqual(len(set(strict_sources.values())), 1, f"正本 2 つの文字列が違う：{strict_sources}")

    # ---- 必須の欄（類 E・回 9・Q5 回 8 追加-1）
    @staticmethod
    def _bodies() -> dict[str, str]:
        """体を受ける口の全部（まだ作っていない口も）→ その入力の形の名前"""
        return {op["operationId"]: ref_name(op["requestBody"]["content"]["application/json"]["schema"])
                for methods in OA["paths"].values() for op in methods.values()
                if isinstance(op, dict) and "requestBody" in op}

    def test_K144_SHAPE_020_required_fields_match_what_the_behaviour_rejects(self) -> None:
        """口が「無い」ことで 422 にする欄（REQUIRED_INPUTS）は、その口の入力の形の required とちょうど同じ。ほかの口（まだ作っていない口も）の入力の形は required を持たない。
        体を受ける作った口（hooks の口と表の素の書き込み）は、REQUIRED_INPUTS か NO_REQUIRED_INPUTS のどちらかに載っている（新しく作った口を見落とさない）。
        本物の DB の答え（{} と 1 欄ずつ抜いた体）は k144-contract.test.ts の REQUIRED_CASES（K144-API-033・034）で、この表と 1 対 1"""
        bodies = self._bodies()
        bad = []
        for op_id, name in sorted(bodies.items()):
            sc = SCHEMAS[name]
            got = set(sc.get("required", []))
            want = REQUIRED_INPUTS.get(op_id, set())
            if got != want:
                bad.append(f"{op_id}（{name}）: 契約 {sorted(got)} ／ 口 {sorted(want)}")
            missing = sorted(got - set(sc["properties"]))
            if missing:
                bad.append(f"{name} の required に無い欄 {missing}")
        self.assertEqual(bad, [], "必須の欄が口の振る舞いと合わない")
        built = set(hook_regions())
        for b in re.split(r"\n  \{\n", REGISTRY):
            m = re.search(r'"operationId":\s*"(\w+)"', b)
            g = re.search(r'"generic":\s*true', b)
            t = re.search(r'"table":\s*"(\w+)"', b)
            if m and g and t and "id" in DBC.get(t.group(1), {}):
                built.add(m.group(1))
        unlisted = sorted(o for o in built & set(bodies) if o not in REQUIRED_INPUTS and o not in NO_REQUIRED_INPUTS)
        self.assertEqual(unlisted, [], "体を受ける作った口が REQUIRED_INPUTS にも NO_REQUIRED_INPUTS にも無い（無いと 422 にする欄を読んで載せる）")
        self.assertEqual(sorted(set(REQUIRED_INPUTS) & set(NO_REQUIRED_INPUTS)), [])
        self.assertEqual(sorted(o for o in list(REQUIRED_INPUTS) + list(NO_REQUIRED_INPUTS) if o not in bodies), [], "表に体を受けない口がある")
        # 本物の DB の試験の表（REQUIRED_CASES）と 1 対 1
        src = (ROOT / "apps/api/test/features/contract/k144-contract.test.ts").read_text(encoding="utf-8")
        block = re.search(r"REQUIRED_CASES = \[(.*?)\] as const;", src, re.S)
        self.assertIsNotNone(block, "k144-contract.test.ts に REQUIRED_CASES が無い")
        cases = {op: set(re.findall(r'"(\w+)"', fs)) for op, fs in re.findall(r'\["(\w+)",\s*\[([^\]]*)\]', block.group(1))}  # type: ignore[union-attr]
        self.assertTrue(cases, "REQUIRED_CASES を読めない")
        diff = sorted(f"{o}: 試験 {sorted(fs)} ／ 表 {sorted(REQUIRED_INPUTS.get(o, set()))}" for o, fs in cases.items() if fs != REQUIRED_INPUTS.get(o, set()))
        self.assertEqual(diff, [], "本物の DB の試験の必須の欄が、この表と合わない")
        for o in ("claimPairingCode", "saveMyTicketDraft", "createTicket", "updateMemory", "createPairingCode", "createConversation", "updateConversation", "createMemory"):
            self.assertIn(o, cases, f"REQUIRED_CASES に {o} が無い（試験の土台で動かせる口は全部本物で確かめる）")

    def test_K144_SHAPE_021_required_inputs_keep_the_behaviours_error_and_own_shape(self) -> None:
        """必須の欄を書いた入力の形は x-required-by: hooks を持ち、入口の zod（packages/contracts/src/schemas.ts）ではその欄を .optional() のままにする
        （無いときの答えは口の振る舞いの正本のエラーのまま：登録 E-VAL-004・確認 E-PAGE-006・同意 E-VAL-019。入口が先に VALIDATION_ERROR にしない）。
        型（08_api/types.ts）は必須の欄に ? が付かない。2 つの口が分け合う形（MemoriesInput）は、必須の違う口（updateMemory）に自分の形を持たせる"""
        bodies = self._bodies()
        for op_id, fields in sorted(REQUIRED_INPUTS.items()):
            name = bodies[op_id]
            sc = SCHEMAS[name]
            self.assertEqual(sc.get("x-required-by"), "hooks", f"{name} に x-required-by: hooks が無い")
            m = re.search(rf"export const {name} = z\.strictObject\(\{{(.*?)\n\}}\);", ZOD, re.S)
            self.assertIsNotNone(m, f"schemas.ts に {name} が無い")
            t = re.search(rf"export type {name} = \{{([^}}]*)\}};", TYPES)
            self.assertIsNotNone(t, f"types.ts に {name} が無い")
            for k in sorted(fields):
                self.assertRegex(m.group(1), rf"\n  {k}: [^\n]*\.optional\(\),", f"schemas.ts の {name}.{k} が .optional() でない（無いときの答えを口に任せる）")  # type: ignore[union-attr]
                self.assertRegex(t.group(1), rf"(?:^\s*|;\s*){k}: ", f"types.ts の {name}.{k} に ? が付いている")  # type: ignore[union-attr]
            sharers = sorted(o for o, n in bodies.items() if n == name and o != op_id)
            self.assertEqual([o for o in sharers if REQUIRED_INPUTS.get(o, set()) != fields], [], f"{name} を必須の違う口と分け合っている")
        self.assertNotEqual(bodies["updateMemory"], bodies["createMemory"], "updateMemory が createMemory と同じ入力の形のまま（必須が違う）")
        self.assertEqual(SCHEMAS[bodies["updateMemory"]]["properties"].keys(), SCHEMAS[bodies["createMemory"]]["properties"].keys(), "updateMemory の形の欄の名前は createMemory と同じ（受ける欄を変えない・値域は口ごと＝K144-SHAPE-023）")
        self.assertIs(SCHEMAS[bodies["updateMemory"]].get("additionalProperties"), False)
        self.assertNotIn("required", SCHEMAS[bodies["createMemory"]])

    # ---- 道の値の値域（類 F・回 9・Q5 回 8 追加-2）
    def test_K144_SHAPE_022_path_values_the_behaviour_rejects_carry_a_range(self) -> None:
        """口が道の値を値域つきで断る（422）なら、契約の道の値の形に値域（pattern）がある。
        downloadBridgeRelease の name：mac・win・英小文字だけでない名前は契約に合い、それ以外の英小文字だけの名前（linux・seed）は合わない。
        見本の名前は本物の DB の試験の RELEASE_NAMES（K144-API-035）と同じ並びで、口の答え（422 か否か）と pattern の判定が 1 対 1。
        ほかの口で、口が道の値・問い合わせを読んでその名前の欄で 422 を返すものは、契約の形に値域（pattern・enum・format・minimum・maximum）がある（機械の洗い出し）"""
        for (op_id, pname), pat in PATH_PATTERNS.items():
            ps = {x["name"]: x for x in operation(op_id)[2].get("parameters", []) if x["in"] == "path"}
            self.assertIn(pname, ps, f"{op_id} に道の値 {pname} が無い")
            self.assertEqual(ps[pname]["schema"].get("pattern"), _portable({"pattern": pat})["pattern"], f"{op_id} の {pname} の値域が違う")
        pat = re.compile(PATH_PATTERNS[("downloadBridgeRelease", "name")])
        src = (ROOT / "apps/api/test/features/contract/k144-contract.test.ts").read_text(encoding="utf-8")
        block = re.search(r"RELEASE_NAMES = \[(.*?)\] as const;", src, re.S)
        self.assertIsNotNone(block, "k144-contract.test.ts に RELEASE_NAMES が無い")
        rows = re.findall(r'\[\s*"((?:[^"\\]|\\.)*)",\s*(true|false)\s*\]', block.group(1))  # type: ignore[union-attr]
        self.assertGreaterEqual(len(rows), 8, "RELEASE_NAMES を読めない")
        wrong = [f"{n!r} は契約に{'合う' if ok == 'true' else '合わない'}はず" for n, ok in rows
                 if bool(pat.fullmatch(json.loads(f'"{n}"'))) != (ok == "true")]
        self.assertEqual(wrong, [], "pattern の判定が口の答え（422 か否か）と合わない")
        for must in ("mac", "win", "linux", "seed"):
            self.assertIn(must, [json.loads(f'"{n}"') for n, _ in rows])
        # 機械の洗い出し：口が読む道の値・問い合わせのうち、その名前の欄で 422 を返すもの
        bad = []
        found = []
        for op_id, (block_src, defs) in hook_regions().items():
            text = block_src + "".join(v for k, v in defs.items() if re.search(rf"\b{k}\(", block_src))
            reads = set(re.findall(r'req\.(?:param|query)\("(\w+)"\)', text))
            for n in sorted(reads):
                if not re.search(rf'(?:invalid\(\s*"{n}"|field:\s*"{n}")', text):
                    continue
                found.append((op_id, n))
                sc = next((x["schema"] for x in operation(op_id)[2].get("parameters", []) if x["name"] == n), None)
                if sc is None or not any(k in sc for k in ("pattern", "enum", "format", "minimum", "maximum")):
                    bad.append(f"{op_id} {n}")
        self.assertIn(("downloadBridgeRelease", "name"), found, "道の値を値域つきで断る口を拾えていない（拾い方が壊れた）")
        self.assertEqual(bad, [], "口が値域つきで 422 にするのに、契約の形に値域が無い道の値・問い合わせ")

    # ---- 体の値の値域（類 G・回 9 の続き・PM の判断 2026-11-09）
    @staticmethod
    def _fits(v: object, sc: dict) -> bool:
        """契約の欄の形（このチケットで使う言葉だけ）に値が合うか。pattern は JSON Schema と同じく「どこかに合う」（re.search）"""
        if v is None:
            return bool(sc.get("nullable"))
        if "anyOf" in sc:
            return any(ContractShapeTest._fits(v, x) for x in sc["anyOf"])
        if "enum" in sc and v not in sc["enum"]:
            return False
        t = sc.get("type")
        if t == "string":
            if not isinstance(v, str):
                return False
            if "pattern" in sc and not re.search(sc["pattern"], v):
                return False
            if len(v) > sc.get("maxLength", 10**9) or len(v) < sc.get("minLength", 0):
                return False
        elif t == "integer":
            if isinstance(v, bool) or not (isinstance(v, int) or (isinstance(v, float) and v.is_integer())):
                return False
            if v < sc.get("minimum", -10**18) or v > sc.get("maximum", 10**18):
                return False
        elif t == "boolean":
            return isinstance(v, bool) and ("enum" not in sc or v in sc["enum"])
        elif t == "object":
            if not isinstance(v, dict):
                return False
            pn = (sc.get("propertyNames") or {}).get("pattern")
            ap = sc.get("additionalProperties")
            for k, x in v.items():
                if pn and not re.search(pn, k):
                    return False
                if isinstance(ap, dict) and not ContractShapeTest._fits(x, ap):
                    return False
        elif t == "array":
            if not isinstance(v, list) or len(v) > sc.get("maxItems", 10**9):
                return False
        return True

    @staticmethod
    def _range_cases() -> list[tuple[str, str, object, bool]]:
        """本物の DB の試験の RANGE_CASES（k144-contract.test.ts）。値は JSON。@today・@code:* は見本の値に置き換える"""
        src = (ROOT / "apps/api/test/features/contract/k144-contract.test.ts").read_text(encoding="utf-8")
        block = re.search(r"RANGE_CASES: RangeCase\[\] = \[(.*?)\n\];", src, re.S)
        assert block, "k144-contract.test.ts に RANGE_CASES が無い"
        out = []
        for op, field, raw, ok in re.findall(r'\[\s*"(\w+)",\s*"(\w+)",\s*(.+?),\s*(true|false)\s*\],?\s*(?://[^\n]*)?\n', block.group(1)):
            raw = raw.strip()
            m = re.fullmatch(r'"(.*)"\.repeat\((\d+)\)', raw)
            if m:
                v: object = json.loads(f'"{m.group(1)}"') * int(m.group(2))
            elif raw == "Array.from({ length: 21 }, () => randomUUID())":
                v = ["00000000-0000-4000-8000-000000000000"] * 21
            else:
                v = json.loads(raw)
            sample = {"@today": "2026-01-01", "@code:plain": "ABC234", "@code:lower": "abc234", "@code:fullwidth": "ＡＢＣ２３４",
                      "@code:spaced": " abc-234 "}
            if isinstance(v, str) and v in sample:
                v = sample[v]
            out.append((op, field, v, ok == "true"))
        assert len(out) >= 30, "RANGE_CASES を読めない"
        return out

    def test_K144_SHAPE_023_body_value_ranges_are_in_the_contract(self) -> None:
        """口が値で断る欄のうち書けるもの（VALUE_RANGES）は、その口の入力の形の欄に同じ値域がある。type・format・nullable は変えず、
        入口の zod（schemas.ts）はその欄に値域を足さない（今のエラー ID と文言のまま）。分け合う形は、値域の違う口に自分の形を持たせる（updateConversation）。
        本物の DB の試験の RANGE_CASES（K144-API-039）の値ごとに、契約の判定（合う／合わない）と口の答え（その欄で 422 にしない／する）が 1 対 1"""
        bodies = self._bodies()
        bad = []
        for op_id, fields in sorted(VALUE_RANGES.items()):
            name = bodies[op_id]
            props = SCHEMAS[name]["properties"]
            for k, want in fields.items():
                got = props.get(k, {})
                for key, val in _portable(want).items():
                    if got.get(key) != val:
                        bad.append(f"{op_id}（{name}）.{k}.{key}: 契約 {got.get(key)!r} ／ 口 {val!r}")
            m = re.search(rf"export const {name} = z\.strictObject\(\{{(.*?)\n\}}\);", ZOD, re.S)
            self.assertIsNotNone(m, f"schemas.ts に {name} が無い")
            for k in fields:
                line = re.search(rf"\n  {k}: ([^\n]*),", m.group(1))  # type: ignore[union-attr]
                self.assertIsNotNone(line, f"schemas.ts の {name} に {k} が無い")
                self.assertNotRegex(line.group(1), r"\.(?:regex|min|length|int\(\)\.min|enum|literal|gte|lte|max)\(|z\.enum|z\.literal|\bstr\(",  # type: ignore[union-attr]
                                    f"schemas.ts の {name}.{k} に値域が入った（入口が先に断ると今のエラー ID と文言が変わる）")
        self.assertEqual(bad, [], "口が値で断るのに、契約の欄に値域が無い（または違う）")
        self.assertNotEqual(bodies["updateConversation"], bodies["createConversation"], "updateConversation が createConversation と同じ入力の形のまま（値域が違う）")
        self.assertEqual(SCHEMAS[bodies["updateConversation"]]["properties"].keys(), SCHEMAS[bodies["createConversation"]]["properties"].keys())
        self.assertNotIn("pattern", SCHEMAS[bodies["createConversation"]]["properties"]["title"], "createConversation の title に値域（口は読まない）")
        self.assertNotIn("pattern", SCHEMAS["Conversations"]["properties"]["title"], "答えの形に値域が入った（入力の欄を写さずに書き換えた）")
        self.assertNotEqual(SCHEMAS["Memories"]["properties"]["confidence"].get("pattern"), VALUE_RANGES["createMemory"]["confidence"]["pattern"], "答えの形に入力の値域が入った（入力の欄を写さずに書き換えた）")
        wrong = []
        for op_id, field, v, ok in self._range_cases():
            sc = SCHEMAS[bodies[op_id]]["properties"][field]
            if self._fits(v, sc) != ok:
                wrong.append(f"{op_id}.{field}={str(v)[:40]!r}: 契約は{'合う' if self._fits(v, sc) else '合わない'}・口は{'受ける' if ok else '断る'}")
        self.assertEqual(wrong, [], "契約の値域の判定が、口の答え（RANGE_CASES）と合わない")
        self.assertEqual(sorted({o for o, *_ in self._range_cases()}), ["claimPairingCode", "createMemory", "createTicket", "updateConversation", "updateMemory"])

    def test_K144_SHAPE_024_unexpressible_rejections_are_explained_in_the_422(self) -> None:
        """契約に書けない値の決まり（今日より前の期限・外部キーの在りか・条件つき など）は、口の振る舞いのまま 422。
        その口の 422 の説明に理由を全部書き、x-unexpressible-422 に同じ並びを持つ（fuzz での扱いは K-62 の受け持ち）。ほかの口は x-unexpressible-422 を持たない"""
        bad = []
        for path, methods in OA["paths"].items():
            for _m, op in methods.items():
                if not isinstance(op, dict) or "operationId" not in op:
                    continue
                o = op["operationId"]
                r = op.get("responses", {}).get("422", {})
                want = UNEXPRESSIBLE_422.get(o)
                if want is None:
                    if "x-unexpressible-422" in r:
                        bad.append(f"{o}: 表に無いのに x-unexpressible-422")
                    continue
                if not r:
                    bad.append(f"{o}: 422 が無い")
                    continue
                if r.get("x-unexpressible-422") != want:
                    bad.append(f"{o}: x-unexpressible-422 {r.get('x-unexpressible-422')} ／ 表 {want}")
                missing = [x for x in want if x not in r.get("description", "")]
                if missing:
                    bad.append(f"{o}: 422 の説明に無い理由 {missing}")
        self.assertEqual(bad, [], "契約に書けない値の決まりが 422 に書かれていない")

    def test_K144_SHAPE_028_query_value_ranges_are_in_the_contract(self) -> None:
        """口が値で断る問い合わせの欄のうち書けるもの（screen_api.py の QUERY_RANGES：operationId → 名前 → JSON Schema の言葉。チケットごとの分は screen_api.d）は、その口の問い合わせの欄に同じ言葉がある（enum・pattern・minLength・maxLength・format・anyOf）。
        表に無い欄は、一覧の共通の形（cursor の pattern・sort の既定の enum・*_id の uuid）のほか値の言葉を持たない（書いたのに表に無い言葉を残さない）。
        契約に書ける決まりは契約に書き、書けない決まりを x-unexpressible-422 で残さない：表の口は x-unexpressible-422 を持たない（K-468）"""
        QUERY_RANGES = SA.QUERY_RANGES
        words = ("enum", "pattern", "minLength", "maxLength", "anyOf", "oneOf")
        generic = {("cursor", "pattern"), ("sort", "pattern"), ("sort", "enum")}
        bad = []
        for _path, methods in OA["paths"].items():
            for _m, op in methods.items():
                if not isinstance(op, dict) or "operationId" not in op:
                    continue
                o = op["operationId"]
                want = QUERY_RANGES.get(o, {})
                params = {x["name"]: x["schema"] for x in op.get("parameters", []) if x["in"] == "query"}
                for name, ws in want.items():
                    if name not in params:
                        bad.append(f"{o}: 問い合わせに {name} が無い")
                        continue
                    for key, val in _portable(ws).items():
                        if params[name].get(key) != val:
                            bad.append(f"{o}.{name}.{key}: 契約 {params[name].get(key)!r} ／ 表 {val!r}")
                for name, sc in params.items():
                    for key in (*words, "format"):
                        if key not in sc or (name, key) in generic or (key == "format" and sc[key] == "uuid"):
                            continue
                        if key not in want.get(name, {}):
                            bad.append(f"{o}.{name}.{key}: 契約にあるのに QUERY_RANGES に無い")
                if want and "x-unexpressible-422" in op.get("responses", {}).get("422", {}):
                    bad.append(f"{o}: 問い合わせの値域を契約に書いたのに x-unexpressible-422 が残っている")
        known = {op["operationId"] for methods in OA["paths"].values() for op in methods.values() if isinstance(op, dict) and "operationId" in op}
        bad += [f"{o}: 契約に無い口" for o in QUERY_RANGES if o not in known]
        self.assertEqual(bad, [], "問い合わせの値域が契約と合わない")

    # ---- 会話と記憶の口の成功の答えの形（類 C/D の続き・回 9）
    def test_K144_SHAPE_025_agent_answers_are_the_shape_the_hooks_return(self) -> None:
        """会話と記憶の口（hooks/agent.ts）の成功の答えは、表の行（Conversations・Memories）ではなく、口が返すとおりの形（AGENT_ANSWERS）。
        本物の答えが形（strict）に合うかは K144-API-037"""
        for op_id, (name, fields) in AGENT_ANSWERS.items():
            r = operation(op_id)[2]["responses"]
            ok = next(v for k, v in r.items() if k.startswith("2"))
            self.assertEqual(ref_name(ok["content"]["application/json"]["schema"]["properties"]["data"]), name, f"{op_id} の成功の答えの形")
            self.assertEqual(SA.RESPONSES.get(op_id), (name, fields), f"screen_api.py の RESPONSES の {op_id}")
            for k, t in fields.items():
                p = prop(name, k)
                self.assertTrue(is_uuid(p) if t == "uuid" else p.get("type") == t, f"{name}.{k} の型が {t} でない")
                self.assertFalse(p.get("nullable"), f"{name}.{k} は null を返さない")

    # ---- 入口の文字の上限と送る量の守り（精査 R1 回 10・D-130.1・PM の判断 2026-11-09）
    def test_K144_SHAPE_026_free_text_has_no_limit_and_bodies_declare_413(self) -> None:
        """D-130.1：自由に書く欄（その欄だけの上限を持たない欄）には文字数の上限を置かない。入口の zod の文字の欄は `z.string()`（`.max(` も一律の上限も無い）。
        契約の入力の形の文字の欄（format の無い type: string）は、口の値域（VALUE_RANGES の maxLength：題名 200 など）がある欄だけ maxLength を持ち、ほかは持たない。
        サーバーを守るため、体を受ける口（POST・PATCH・PUT）は全部、1 回に送る内容が 1MB（1,048,576 バイト）を超えたら 413・PAYLOAD_TOO_LARGE を返す：
        契約の responses に 413（説明に PAYLOAD_TOO_LARGE）、endpoints.json の outputs_4xx に EARS の文つきの 413。本物の試験が別のファイルにある口の 413 の生成の試験は covers に結ばれている"""
        self.assertNotIn("z.string().max(", ZOD, "入口に一律の文字の上限 z.string().max( が残っている（D-130.1）")
        self.assertNotRegex(ZOD, r"\bstr\(", "入口に一律の文字の上限 str( が残っている（D-130.1）")
        bodies = self._bodies()
        ops_of: dict[str, list[str]] = {}
        for o, n in bodies.items():
            ops_of.setdefault(n, []).append(o)
        bad = []
        checked = 0
        for name, ops in sorted(ops_of.items()):
            m = re.search(rf"export const {name} = z\.strictObject\(\{{(.*?)\n\}}\);", ZOD, re.S)
            self.assertIsNotNone(m, f"schemas.ts に {name} が無い")
            for k, p in SCHEMAS[name]["properties"].items():
                if p.get("type") != "string" or p.get("format"):
                    continue
                checked += 1
                if not re.search(rf"\n  {k}: z\.string\(\)(?:\.nullable\(\))?\.optional\(\),", m.group(1)):  # type: ignore[union-attr]
                    bad.append(f"{name}.{k}: 入口の zod が z.string() でない")
                narrower = [x for x in (VALUE_RANGES.get(o, {}).get(k, {}).get("maxLength") for o in ops) if x is not None]
                want = min(narrower) if narrower else None
                if p.get("maxLength") != want:
                    bad.append(f"{name}.{k}: 契約 maxLength {p.get('maxLength')} ／ 口の値域 {want}")
        self.assertGreater(checked, 150, "入力の文字の欄を拾えていない")
        self.assertEqual(bad, [], "自由に書く欄に上限がある、または口の値域の上限が契約と合わない")
        leaked = sorted(f"{n}.{k}" for n, sc in SCHEMAS.items() if n not in ops_of
                        for k, p in sc.get("properties", {}).items() if isinstance(p, dict) and p.get("maxLength") == 10000)
        self.assertEqual(leaked, [], "答えの形に一律の上限 maxLength 10000 が入った")
        missing = []
        for path, methods in OA["paths"].items():
            for method, op in methods.items():
                if not isinstance(op, dict) or method not in ("post", "patch", "put") or "requestBody" not in op:
                    continue
                r = op.get("responses", {}).get("413")
                if not r or "PAYLOAD_TOO_LARGE" not in r.get("description", ""):
                    missing.append(op["operationId"])
        self.assertEqual(missing, [], "体を受けるのに契約の 413（PAYLOAD_TOO_LARGE）が無い口")
        no_ears = [e.get("operation_id") or e["implementation_path"].split("::")[1] for e in EPS
                   if e["method"] in ("POST", "PATCH", "PUT")
                   and not any(x["status"] == 413 and x.get("code") == "PAYLOAD_TOO_LARGE" and "413" in x.get("ears_form", "") for x in e["outputs_4xx"])]
        self.assertEqual(no_ears, [], "endpoints.json の outputs_4xx に 413（EARS の文つき）が無い口")
        mapping = json.loads((ROOT / "07_qa/test-plan/ears-test-mapping.json").read_text(encoding="utf-8"))["mappings"]
        away = json.loads((ROOT / "07_qa/test-plan/ears-elsewhere.json").read_text(encoding="utf-8"))["ops"]
        op_of = {f"{e['method']} {e['path']}": e["implementation_path"].split("::")[1] for e in EPS}
        loose = [m["test_function"] for m in mapping
                 if m["http_code"] == "413" and op_of.get(m["endpoint"]) in away
                 and m["test_function"] not in away[op_of[m["endpoint"]]].get("covers", {})]
        self.assertEqual(loose, [], "本物の試験が別のファイルにある口の 413 の生成の試験が covers に結ばれていない")
        self.assertTrue(all(m["test_function"].endswith("_too_large") or re.search(r"_too_large_\d+$", m["test_function"]) for m in mapping if m["http_code"] == "413"),
                        "413 の生成の試験の名前が too_large でない（05_flow/build_testplan.py の classify）")

    # ---- 黙った切り捨てと、決めていない上限（精査 R1 回 12 追加-3・D-130.3・D-130.4）
    # 契約の口の振る舞い（apps/api/src/hooks と apps/api/src/features）で、入力を `.slice(0, 数)` で黙って切る所は、ここに理由つきで載せたものだけ。
    #   人が自由に書く欄（区画・下書き・記憶の本文と題・会話の名前）は切らない（D-130.1・D-130.4）。載せた所は人が書く欄でない（日付の形・外の理由のログ・Bridge が送る値）
    SLICE_ALLOWED: dict[str, list[tuple[str, str]]] = {
        # K-475：保存した条件の一覧（DB から上限 +1 件取った行を、超えたかを見た後に上限の 500 件に戻す・K-351 の credentials/list.ts と同じ形）
        "apps/api/src/features/F7/saved-views/list.ts": [("rows.slice(0, LIST_MAX)", "DB から上限 +1 件取った行を、超えたかを見た後に上限の 500 件に戻す（入力でない）")],
        "apps/api/src/features/F4/create-ticket/input.ts": [("toISOString().slice(0, 10)", "日本時間の今日を日付の形にする（入力でない）")],
        "apps/api/src/features/F1/sign-up/index.ts": [("reason.slice(0, 200)", "外の照合サービスの失敗の理由を記録と運営への知らせに残す（入力でない）")],
        "apps/api/src/features/F1/sign-up/pwned.ts": [("hash.slice(0, 5)", "漏れたパスワードの照合に送るハッシュの頭 5 字（k-匿名・入力でない）")],
        "apps/api/src/features/F3/connect-pc/code.ts": [("slice(0, LABEL_MAX)", "Bridge が送る PC の名前（人が書く欄でない・D-130.4 の外。報告で PM に申し送り）")],
        "apps/api/src/features/F3/connect-pc/hooks.ts": [("[...v].slice(0, max)", "Bridge が送る自己診断の 1 行の名前・詳しく・直し方・番号（人が書く欄でない）"),
                                                         ("slice(0, HEALTH_MAX)", "Bridge が送る点検の並び（人が書く欄でない）"),
                                                         ("slice(0, 40)", "Bridge が送る版の名前（人が書く欄でない）")],
        # K-161：一覧は limit+1 件を DB から取り、続きがあるかを見てから limit 件に切る（入力でない・DB 側で絞った後の行）
        "apps/api/src/features/F5/approve-complete/queue.ts": [("rows.slice(0, limit)", "DB から limit+1 件取った行を、続きの有無を見た後に limit 件に戻す（入力でない）")],
        # K-351：預けたログイン情報の一覧（DB から上限 +1 件取った行を、上限を超えたかを見た後に上限の件数に戻す）
        "apps/api/src/features/F3/credentials/list.ts": [("rows.slice(0, LIST_MAX)", "DB から上限 +1 件取った行を、超えたかを見た後に上限の 500 件に戻す（入力でない）")],
        # K-92：チケットの一覧も同じ形（DB から limit+1 件取った行を、次の分の有無を見た後に limit 件に戻す）
        "apps/api/src/features/F4/ticket-list/hooks.ts": [("const page = rows.slice(0, q.limit);", "DB から limit+1 件取った行を、次の分の有無を見た後に limit 件に戻す（入力でない）")],
        # K-62：Bridge（PC）が送る途中の様子の形。人が書く欄でない。返事（reply）は契約の上限（REPLY_MAX 200000）と同じ、1 行の文は 400 字（D-129.46 の要約と同じ大きさ）
        "apps/api/src/features/F5/delegate/records.ts": [("slice(0, 30)", "Bridge が送る todo の並びの数（人が書く欄でない）"),
                                                          ("slice(0, 4)", "Bridge が送る開いている窓の並びの数（人が書く欄でない）"),
                                                          ("[...wellFormed(s)].slice(0, max)", "Bridge が送る欄（道具の名前・対象・todo の文・止めた先・セッションの id・返事 200000 字・途中の 1 行 400 字。人が書く欄でない）を文字（コードポイント）の単位で切る 1 か所の clip。呼ぶ所は clip(…) の 10 か所（K62-API-033・K62-API-082）")],
        # K-461：知らせの一覧（DB から limit+1 件取った行を次の分の有無を見た後に limit 件に戻す）と、payload の写しを短くする clip（文字の単位）
        "apps/api/src/features/F7/notifications/list.ts": [("rows.slice(0, q.limit)", "DB から limit+1 件取った行を、次の分の有無を見た後に limit 件に戻す（入力でない）")],
        "apps/api/src/features/F7/notifications/shape.ts": [("Array.from(s).slice(0, CLIP_MAX)", "payload の写しを短くする（人が書く入力でない・文字（コードポイント）の単位で切る）")],
    }

    def _migration_texts(self) -> list[tuple[str, str]]:
        idx = (ROOT / "packages/db/src/migrations.generated.ts").read_text(encoding="utf-8")
        m = re.search(r"export const MIGRATIONS = \[(.*?)\]", idx, re.S)
        self.assertIsNotNone(m, "packages/db/src/migrations.generated.ts に MIGRATIONS が無い")
        names = re.findall(r'"(\d{4}_[^"]+\.sql|\d{14}_[^"]+\.sql)"', m.group(1))  # type: ignore[union-attr]
        return [(n, (ROOT / "packages/db/migrations" / n).read_text(encoding="utf-8")) for n in names]

    def _last_function(self, name: str) -> str:
        body = ""
        for _n, t in self._migration_texts():
            for mm in re.finditer(rf"create or replace function {re.escape(name)}\(.*?\nend \$\$;", t, re.S | re.I):
                body = mm.group(0)
        self.assertTrue(body, f"{name} の定義が migration に無い")
        return body

    def test_K144_SHAPE_027_free_text_is_not_silently_cut_and_has_no_undecided_limit(self) -> None:
        """D-130.3・D-130.4：区画の 20,000 字・下書きの 180,000 バイトの上限を外し、記憶の本文と題・会話の名前を黙って切らない（上限も置かない）。守りは送る量 1MB だけ。
        (1) 契約の口の振る舞い（hooks と features）の `.slice(0, …)` は SLICE_ALLOWED（理由つき）にあるものだけ
        (2) 作る口に区画と下書きの上限（SECTION_MAX・DRAFT_MAX_BYTES・バイト数の比べ）が無い
        (3) 効いている（MIGRATIONS の順で最後の）app.agent_memory_edit・app.agent_conversation_set が本文と名前を left( で切らない
            （記憶の題が無いときに本文の頭 80 字から題を作るのは、書いたものを消さないので残してよい）
        (4) app.ticket_drafts の大きさの決まり（ticket_drafts_body_check：pg_column_size(body) <= 200000）を、0090 より後の migration が外す
        本物の DB で長い区画・下書き・記憶・会話の名前が一字も欠けずに残るかは K144-API-043"""
        bad = []
        files = sorted([*(ROOT / "apps/api/src/hooks").glob("*.ts"), *(ROOT / "apps/api/src/features").rglob("*.ts")])
        for f in files:
            if ".test." in f.name:
                continue
            rel = f.relative_to(ROOT).as_posix()
            allowed = self.SLICE_ALLOWED.get(rel, [])
            for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                if not re.search(r"\.(?:slice|substring|substr)\(\s*0\s*,", line):
                    continue
                if not any(a in line for a, _why in allowed):
                    bad.append(f"{rel}:{i}: {line.strip()[:100]}")
        self.assertEqual(bad, [], "契約の口で入力を黙って切っている（D-130.4）。人が書く欄でないなら SLICE_ALLOWED に理由つきで載せる")
        ct = "".join((ROOT / "apps/api/src/features/F4/create-ticket" / n).read_text(encoding="utf-8") for n in ("input.ts", "hooks.ts"))
        for word in ("SECTION_MAX", "DRAFT_MAX_BYTES", "byteLength"):
            self.assertNotIn(word, ct, f"作る口に区画・下書きの上限 {word} が残っている（D-130.3）")
        mem = self._last_function("app.agent_memory_edit")
        set_line = re.search(r"update memories set (.*?)\n\s*where", mem, re.S)
        self.assertIsNotNone(set_line, "app.agent_memory_edit の update が読めない")
        sets = set_line.group(1)  # type: ignore[union-attr]
        body_expr = re.search(r"\bbody = (.*?)(?:, updated_by\b|\n|$)", sets)
        self.assertIsNotNone(body_expr, "app.agent_memory_edit が body を書いていない")
        self.assertNotIn("left(", body_expr.group(1), "app.agent_memory_edit が記憶の本文を left( で切っている（D-130.4）")  # type: ignore[union-attr]
        self.assertNotRegex(sets, r"\btitle = left\(", "app.agent_memory_edit が記憶の題を left( で切っている（D-130.4）")
        conv = self._last_function("app.agent_conversation_set")
        title_line = re.search(r"\btitle = (case .*?end),", conv, re.S)
        self.assertIsNotNone(title_line, "app.agent_conversation_set の title が読めない")
        self.assertNotIn("left(", title_line.group(1), "app.agent_conversation_set が会話の名前を left( で切っている（D-130.4）")  # type: ignore[union-attr]
        later = [n for n, t in self._migration_texts() if n > "0090"
                 and re.search(r"alter table app\.ticket_drafts\s+drop constraint (?:if exists )?ticket_drafts_body_check", t, re.I)]
        self.assertTrue(later, "app.ticket_drafts の大きさの決まり（pg_column_size(body) <= 200000）を外す migration が無い（D-130.3）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
