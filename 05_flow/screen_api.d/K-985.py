# K-985 運営の人を読む口（listOpsMembers）と、運営の人を足す口（addOpsMember）（D-156.22・D-156.34・D-156.66）
# 読む：生きている運営の人を作った順に全部。1 行は 8 欄（自分の印・パスキーの有る無し・付けるのを待っている・最後の 1 人の印）
# 足す：メールとできること 1〜9 つだけ（strict・名前の欄は持たない＝名前は入るときに本人が付ける・D-156.66）。
#   新しい人・外した運営の人（同じ人として足し直す）にパスキーを付けるリンク（24 時間・1 回）をメールで送る。
#   決まりの確かめは口（apps/api/src/features/F12/ops/team.ts）が契約と同じ数で持つ
INPUTS = {
    "addOpsMember": ("OpsMemberAddInput", {"email": "string", "caps": "string[]"}),
}

REQUIRED_INPUTS = {
    "addOpsMember": ["email", "caps"],
}

# メールは前後の空白を落として 3〜254 字・メールの形。できることは 9 つの字のどれか・1〜9 個・重ならない
_CAPS = ["inquiry", "peek", "money", "stop", "notice", "distribute", "plan_propose", "plan_decide", "ops_people"]
VALUE_RANGES = {
    "addOpsMember": {
        "email": {"minLength": 3, "maxLength": 254, "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"},
        "caps": {"minItems": 1, "maxItems": 9, "uniqueItems": True, "items": {"type": "string", "enum": list(_CAPS)}},
    },
}

UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES で契約に書いた

# 1 行は 8 欄（K-986 の画面の正本）。locked_caps は最後の 1 人である ops_people・plan_decide の並び（無ければ []）
_ROW = {"member_id": "uuid", "name": "string", "email": "string", "caps": "string[]", "has_passkey": "boolean",
        "setup_pending": "boolean", "is_self": "boolean", "locked_caps": "string[]"}
RESPONSES = {
    "listOpsMembers": ("OpsMemberRow", dict(_ROW)),
    "addOpsMember": ("OpsMemberRow", dict(_ROW)),
}

# 一覧は絞り込みも並べ替えも受けない（作った順に全部）
QUERIES = {
    "listOpsMembers": [],
}
LIST_DETAILS = {
    "listOpsMembers": {"sort": False, "desc": "取得（ops_members）— 生きている運営の人を作った順に見る（できること・パスキー・自分・最後の 1 人の印）"},
}

# 足した答えの meta：招待のメールを送れたか（送れなくても運営の人とリンクは残る・G-15）
META = {
    "addOpsMember": {"mail_sent": "boolean"},
}

# 一覧も足すも 60/min/user（G-16・K985-API-015）
RATES = {
    "listOpsMembers": "60/min/user",
}

ERRORS_4XX = {
    "addOpsMember": [
        {"status": 409, "code": "E-OPS-015", "body": {"error": "conflict", "code": "E-OPS-015"}, "errors": ["E-OPS-015"],
         "trigger": "同じメールの生きている運営の人が居る（大文字・前後の空白をそろえた後で比べる）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 同じメールの運営の人がもう居るなら、Kaname は 409 と E-OPS-015 を返し、人もリンクもメールも作らない"},
        {"status": 409, "code": "E-OPS-016", "body": {"error": "conflict", "code": "E-OPS-016"}, "errors": ["E-OPS-016"],
         "trigger": "同じメールの人が顧客の会社に居る（運営の人は運営の会社だけに居る）。欄・details は付けない",
         "ears_form": "UNWANTED: IF メールが顧客のアカウントで使われているなら、Kaname は 409 と E-OPS-016 を返し、運営の人を作らず顧客の利用者も消さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "メールが無い・形が違う・255 字以上、できることが無い・空・知らない字・重なり・10 個以上・並びでない、知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、人もリンクもメールも作らない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "認証の利用者を作る・運営の人とリンクと記録を書く DB が落ちた（作った利用者は消してから返す）",
         "ears_form": "UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、人もリンクもメールも残さない"},
    ],
}
