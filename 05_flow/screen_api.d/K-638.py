# K-638 認証の口の契約の形に足す分（契約 fuzz G36 の ST202：形どおりの入力が断られた・K-424 が入口の上限 429 を外して出た）
# 口の振る舞い（apps/api/src/features/F1/…）が 422 で断る形の誤りは、契約に書く。契約と口を同じ形にする（控え帳 2026-11-20 16:51）
import email_patterns as _EP  # 登録・ログインのメールの形（scripts/ci/email_patterns.py・口は packages/auth/src/signup.ts の isLoginEmail・K-1117）
_EMAIL = "^\\s*[^@\\s]+@[^@\\s]+\\.[^@\\s]+\\s*$"   # 登録（createSignup）と同じ。NFKC で直し空白を全部除いた後に EMAIL_RE で見る口より狭く書く（全角・途中の空白は契約の外）
VALUE_RANGES = {
    "requestPasswordReset": {"email": {"pattern": _EMAIL}},   # apps/api/src/features/F1/password-reset/index.ts（形違いは 422 E-VAL-004）
    "requestAdminRecovery": {"pending": {"pattern": "\\S"}},   # apps/api/src/features/F1/admin-recovery/index.ts（空・空白だけは 422 欄 pending）
}
# K-1116・K-1117：ログインの口は EMAIL_RE の後に部品 better-auth の z.email()（zod 4.6.7 の email の形）でも見て、断れば 422 E-VAL-004（packages/auth/src/signup.ts の INVALID_EMAIL）。
#   契約はその形を前後の空白で挟む（scripts/ci/email_patterns.py の LOGIN_EMAIL・登録の口 createSignup と同じ字）。再設定の口（上の _EMAIL）は K-1106 の後の葉で同じ形にする
# 前からある鍵（signInWithPassword・verifySignInCode）の値域の表は K-639 が掃除する（表の写しを持つ試験 contract_shape_test.py を 1 本の葉だけが運ぶため）。ここでは INPUT_RULES で足す
INPUT_RULES = {
    "signInWithPassword": {"allOf": [{"properties": {"email": {"pattern": _EP.LOGIN_EMAIL}}}]},   # apps/api/src/features/F1/login/sign-in.ts（形違い・部品が断る形は 422 E-VAL-004・K-1116）
    "verifySignInCode": {
        "allOf": [{"properties": {"pending": {"pattern": "\\S"}}}],   # 待ちの印が空・空白だけは 422 欄 pending
        # code と backup_code は、どちらか 1 つだけが文字で来る（null・数・真偽は 422。無い・両方も 422）。口の前処理 sign-in-code.ts の input と同じ
        "oneOf": [
            {"required": ["code"], "properties": {"code": {"type": "string"}}, "not": {"required": ["backup_code"]}},
            {"required": ["backup_code"], "properties": {"backup_code": {"type": "string"}}, "not": {"required": ["code"]}},
        ],
    },
}
