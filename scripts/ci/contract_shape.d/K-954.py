# K-954 お知らせを読む口（listNotices）と読んだ印（markNoticeRead）の契約の形の表に足す分（K-325 の断片）
#   契約の形（入力・答え・問い合わせの値）は K-1004 の断片が持つ。読んだ印の体は空の {} だけ（必須の欄が無い）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "markNoticeRead": "体は空の {} だけ（知らない鍵は入口の strict な形が 422）。読むお知らせは道の :id、会社と人はセッションから（K-954）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
