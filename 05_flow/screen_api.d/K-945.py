# K-945 運営の最初の 1 人：パスキーを付けるリンクの口（startOpsSetup・D-156.22）
# メールのリンク（24 時間・1 回だけ）の印を受け、パスキーを付けるだけのセッション（入り方 ops_setup）を返す。ログインしていない人の口。
#   答えにログインの印が入るので冪等の器に残さない（NO_GENERIC_409・2 回目は 409 E-PAGE-006）
SCREEN_API = {
    "login": [
        ("POST", "/auth/ops-setup", "A134", "sessions", "startOpsSetup", ["ops_members"]),
    ],
}

INPUTS = {
    "startOpsSetup": ("OpsSetupInput", {"token": "string", "name": "string?"}),   # name は K-985 が足した（入るときに本人が付ける・任意・D-156.66）
}

# apps/api/src/features/F12/ops-setup/setup.ts（印が無い・ほかの欄は 422・strict）
REQUIRED_INPUTS = {
    "startOpsSetup": ["token"],
}

# 表は sessions（K-313 の resetPassword と同じ。リンクの表 ops_setup_links は関数だけが触る裏の表で ER 図の対象の外）
# 印は 32 バイトの乱数の base64url（43 字）
VALUE_RANGES = {
    "startOpsSetup": {"token": {"pattern": "^[A-Za-z0-9_-]{43}$"},
                      "name": {"pattern": "\\S", "minLength": 1, "maxLength": 40}},   # 前後の空白を落として 1〜40 字・空白だけは 422（D-156.38 と同じ形・K-985）
}

RESPONSES = {
    "startOpsSetup": ("OpsSetupSession", {"token": "string"}),
}

PERMS = {
    "startOpsSetup": ("public", "メールのリンクを持つ運営の人（パスキーを付けるだけのセッション）", False),
}

RATES = {
    "startOpsSetup": "10/min/ip",
}

NO_GENERIC_409 = {"startOpsSetup"}

# 無い・使った・期限切れのリンクは同じ 409（どれかを見分けさせない・D-156.12）。DB の失敗は 503（D-156.17）
ERRORS_4XX = {
    "startOpsSetup": [
        {"status": 409, "code": "E-PAGE-006", "body": {"error": "not_found", "code": "E-PAGE-006"}, "errors": ["E-PAGE-006"],
         "trigger": "形どおりのリンクの印が使えない（無い・使った・期限切れ。どれかを見分けさせない）。欄・details は付けない",
         "ears_form": "UNWANTED: IF リンクの印が使えないなら、Kaname は 409 と E-PAGE-006 を返し、セッションを作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "印が無い・43 字の base64url でない・名前が空・空白だけ・41 字以上（K-985）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、リンクを使わない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "セッションを作る・入り方を書く DB が落ちた（認証側のセッションは消してから返す）",
         "ears_form": "UNWANTED: IF セッションを作れないなら、Kaname は 503 と E-PAGE-003 を返し、運営として入れるセッションを残さない"},
    ],
}
