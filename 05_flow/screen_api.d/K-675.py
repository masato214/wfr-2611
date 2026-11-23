# K-675 ナレッジの口の置き場：契約の宣言（16 本・入力・答え・断り）。名前の正本は 07_functional/段10-F9/土台-knowledge.md の 2・3・4 章
#   前からある 8 本（getKnowledgeTree・getKnowledgePage・listKnowledgeVersions・createKnowledgePage・updateKnowledgePage・saveKnowledgeDraft・
#   discardKnowledgeDraft・publishKnowledgePage）の SCREEN_API の行・RESPONSES（木とページ）・PERMS は本体 05_flow/screen_api.py で直した。
#   ここは本体に無い鍵（新しい 8 本の行・入力・答え・断り・回数の上限）だけ。頼み・共有・承認・見直しの 9 本は、その表を作る葉（K-687〜K-689・K-695）が宣言する
#   口の振る舞いは持ち主の葉（apps/api/src/features/F9/knowledge/ops.ts の表）が作る。振る舞いの無い間は契約の入口が 501 で止める

SCREEN_API = {
    "knowledge": [
        ("GET", "/knowledge_pages/:id/versions/:v", "A114", "knowledge_page_versions", "getKnowledgePageVersion", ["knowledge_pages"]),
        ("POST", "/knowledge/folders", "A114", "knowledge_folders", "createKnowledgeFolder", ["scopes"]),
        ("PATCH", "/knowledge/folders/:id", "A114", "knowledge_folders", "updateKnowledgeFolder", []),
        ("DELETE", "/knowledge/folders/:id", "A114", "knowledge_folders", "deleteKnowledgeFolder", ["knowledge_pages"]),
        ("DELETE", "/knowledge_pages/:id", "A114", "knowledge_pages", "deleteKnowledgePage", ["knowledge_page_versions"]),
        ("PUT", "/knowledge_pages/:id/must", "A114", "knowledge_pages", "setKnowledgeMust", ["knowledge_page_versions"]),
        ("POST", "/knowledge/similar", "A114", "knowledge_pages", "findSimilarKnowledge", ["knowledge_page_versions", "knowledge_folders"]),
        ("POST", "/knowledge_pages/:id/copy", "A114", "knowledge_pages", "copyKnowledgePage", ["knowledge_page_versions", "knowledge_folders"]),
    ],
}

# 入力は口ごとの専用の形（知らない欄は 422・strict）。表の列（ticket_id・tenant_id など）を体に入れさせない
INPUTS = {
    "createKnowledgeFolder": ("KnowledgeFolderCreateInput", {"shelf": "string", "group_id": "uuid?", "parent_folder_id": "uuid?", "name": "string"}),
    "updateKnowledgeFolder": ("KnowledgeFolderUpdateInput", {"name": "string", "parent_folder_id": "uuid?", "position": "integer"}),
    "createKnowledgePage": ("KnowledgePageCreateInput", {"shelf": "string", "group_id": "uuid?", "folder_id": "uuid?", "title": "string", "desc": "string"}),
    "saveKnowledgeDraft": ("KnowledgeDraftInput", {"title": "string", "desc": "string", "doc": "object"}),
    "publishKnowledgePage": ("KnowledgePublishInput", {}),
    "updateKnowledgePage": ("KnowledgePageMoveInput", {"folder_id": "uuid?", "position": "integer"}),
    "setKnowledgeMust": ("KnowledgeMustInput", {"must": "boolean"}),
    "findSimilarKnowledge": ("KnowledgeSimilarInput", {"title": "string", "desc": "string", "text": "string", "exclude_page_id": "uuid"}),
    "copyKnowledgePage": ("KnowledgeCopyInput", {"folder_id": "uuid?"}),
}

REQUIRED_INPUTS = {
    "createKnowledgeFolder": ["shelf", "name"],
    "createKnowledgePage": ["shelf", "title"],
    "setKnowledgeMust": ["must"],
    "findSimilarKnowledge": ["title"],
}

_POS_MAX = 2147483647   # 並びの列は int（knowledge_folders・knowledge_pages の position）。超える数は口の入口で 422（契約 fuzz ST202）
_SHELF = {"enum": ["company", "group", "me"]}
VALUE_RANGES = {
    "createKnowledgeFolder": {"shelf": _SHELF, "name": {"pattern": "\\S", "maxLength": 100}},
    "updateKnowledgeFolder": {"name": {"pattern": "\\S", "maxLength": 100}, "position": {"minimum": 0, "maximum": _POS_MAX}},
    "createKnowledgePage": {"shelf": _SHELF, "title": {"pattern": "\\S", "maxLength": 200}, "desc": {"maxLength": 200}},
    "saveKnowledgeDraft": {"title": {"pattern": "\\S", "maxLength": 200}, "desc": {"maxLength": 200}},
    "updateKnowledgePage": {"position": {"minimum": 0, "maximum": _POS_MAX}},
    "findSimilarKnowledge": {"title": {"pattern": "\\S", "maxLength": 200}, "desc": {"maxLength": 200}, "text": {"maxLength": 10000}},
}

# 欄をまたぐ決まり（契約に書ける形・UNEXPRESSIBLE_422 は使わない＝控え帳 2026-11-20 16:51）
#   グループの棚は group_id が要る（会社・自分の棚は group_id を使わない＝あっても通す）／更新の 3 つは欄が 1 つは要る
_GROUP_NEEDS_ID = {"anyOf": [
    {"properties": {"shelf": {"enum": ["company", "me"]}}},
    {"required": ["group_id"], "properties": {"group_id": {"type": "string", "format": "uuid"}}},   # null は通さない（K675-API-003）
]}
INPUT_RULES = {
    "createKnowledgeFolder": _GROUP_NEEDS_ID,
    "createKnowledgePage": _GROUP_NEEDS_ID,
    "updateKnowledgeFolder": {"anyOf": [{"required": ["name"]}, {"required": ["parent_folder_id"]}, {"required": ["position"]}]},
    "saveKnowledgeDraft": {"anyOf": [{"required": ["title"]}, {"required": ["desc"]}, {"required": ["doc"]}]},
    "updateKnowledgePage": {"anyOf": [{"required": ["folder_id"]}, {"required": ["position"]}]},
}

UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES と INPUT_RULES で契約に書いた（検査の例外は足さない）

# 答えの形（土台 3 章）。木とページは本体の RESPONSES で直した
_PLACE = "object"   # { shelf, shelf_name, group_id, folder_id, folders }（shape.ts の PagePlace）
RESPONSES = {
    "listKnowledgeVersions": ("KnowledgeVersionItem", {"version": "integer", "published_at": "string?", "by_name": "string?"}),
    "getKnowledgePageVersion": ("KnowledgeVersion", {"version": "integer", "published_at": "string?", "by_name": "string?", "body": "object"}),
    "createKnowledgeFolder": ("KnowledgeFolder", {"id": "uuid", "name": "string", "shelf": "string", "group_id": "uuid?", "parent_folder_id": "uuid?", "position": "integer"}),
    "updateKnowledgeFolder": ("KnowledgeFolder", {"id": "uuid", "name": "string", "shelf": "string", "group_id": "uuid?", "parent_folder_id": "uuid?", "position": "integer"}),
    "deleteKnowledgeFolder": ("KnowledgeFolderDeleted", {"id": "uuid"}),
    "createKnowledgePage": ("KnowledgePageStub", {"id": "uuid", "title": "string", "desc": "string", "state": "string", "must": "boolean", "place": _PLACE}),
    "updateKnowledgePage": ("KnowledgePageStub", {"id": "uuid", "title": "string", "desc": "string", "state": "string", "must": "boolean", "place": _PLACE}),
    "copyKnowledgePage": ("KnowledgePageStub", {"id": "uuid", "title": "string", "desc": "string", "state": "string", "must": "boolean", "place": _PLACE}),
    "saveKnowledgeDraft": ("KnowledgeDraftSaved", {"saved_at": "string", "title": "string", "desc": "string"}),
    "discardKnowledgeDraft": ("KnowledgeDraftDiscarded", {"id": "uuid", "page_deleted": "boolean"}),
    "publishKnowledgePage": ("KnowledgePublished", {"id": "uuid", "version": "integer", "published_at": "string?"}),
    "deleteKnowledgePage": ("KnowledgePageDeleted", {"id": "uuid"}),
    "setKnowledgeMust": ("KnowledgeMustSet", {"id": "uuid", "must": "boolean", "used": "integer", "limit": "integer"}),
    "findSimilarKnowledge": ("KnowledgeSimilar", {"pages": "array"}),
}

# 書き終えるは新しい物を作らない（版を 1 つ増やすだけ）・似たページを探すは読むだけ：POST でも 200
SUCCESS_STATUS = {
    "publishKnowledgePage": 200,
    "findSimilarKnowledge": 200,
}

# 版の一覧は並べ替え・絞り込みを受けない（全部を新しい順に・200 行で切る）
QUERIES = {
    "listKnowledgeVersions": [],
}
LIST_DETAILS = {
    "listKnowledgeVersions": {"sort": False, "limit_max": 200, "desc": "取得（knowledge_page_versions）— ページの公開した版を新しい順に見る", "meta": "{ count }"},
}
META = {
    "listKnowledgeVersions": {"count": {"type": "integer"}},
}

RATES = {
    "getKnowledgeTree": "120/min/user",
    "getKnowledgePage": "120/min/user",
    "listKnowledgeVersions": "120/min/user",
    "getKnowledgePageVersion": "120/min/user",
    "saveKnowledgeDraft": "120/min/user",   # 自動で保存する
    "findSimilarKnowledge": "30/min/user",
    "copyKnowledgePage": "30/min/user",
    "createKnowledgeFolder": "60/min/user",
    "updateKnowledgeFolder": "60/min/user",
    "deleteKnowledgeFolder": "60/min/user",
    "createKnowledgePage": "60/min/user",
    "discardKnowledgeDraft": "60/min/user",
    "publishKnowledgePage": "60/min/user",
    "updateKnowledgePage": "60/min/user",
    "deleteKnowledgePage": "60/min/user",
    "setKnowledgeMust": "60/min/user",
}

# 権限の言葉は「社内の人」までしか見ない。棚ごとの書ける人は行の守りと口が決める（見えない物は 404・見えて書けないは 403）
PERMS = {
    "getKnowledgePageVersion": ("read", "見えるページだけ（行の守り）。公開した版の本文", False),
    "createKnowledgeFolder": ("write", "社内の人。その棚に書ける人だけ作れる（口が app.kfolder_writable・棚を決める。見えない棚は 404・書けない棚は 403）", False),
    "updateKnowledgeFolder": ("write", "そのフォルダに書ける人（口が app.kfolder_visible で 404・app.kfolder_writable で 403）。同じ棚の中だけ", False),
    "deleteKnowledgeFolder": ("write", "同上。中が空で、共有していないフォルダだけ", False),
    "deleteKnowledgePage": ("write", "そのページに書ける人（app.kpage_writable）。必ず守る・共有・承認待ちのページは消せない", False),
    "setKnowledgeMust": ("write", "そのページに書ける人（app.kpage_writable）。棚ごとの上限まで", False),
    "findSimilarKnowledge": ("self", "社内の人（見える棚の公開済みのページだけから探す）", False),
    "copyKnowledgePage": ("read", "見えるページを自分の棚へ写す（写す先は自分の棚だけ）", False),
}

# 版の番号は 1 以上の整数（それ以外の道は 422）
PATH_PATTERNS = {
    "getKnowledgePageVersion": {"v": "^[1-9][0-9]{0,8}$"},
}

# 断り（土台 4 章・控え帳）：403＝その棚に書けない／404＝無い・見えない・消した・別の会社（体は error と code だけ）／
#   409＝今の状態ではできない（E-KNW・体は error と code、上限の 060 だけ detail）／422＝形の誤り（details）／503＝DB が使えない（E-PAGE-003）
_403 = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": []}
_404 = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": []}
_422 = {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": []}
_503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
        "trigger": "ナレッジを読む・書く DB の問い合わせが落ちた（想定外の例外・取引が落ちた・控え帳 2026-11-22 18:30）",
        "ears_form": "UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、ページもフォルダも変えない"}


def _r(base: dict, trigger: str, ears: str) -> dict:
    return {**base, "trigger": trigger, "ears_form": ears}


def _c(code: str, trigger: str, detail: bool = False) -> dict:
    body = {"error": "conflict", "code": code, **({"detail": {}} if detail else {})}
    return {"status": 409, "code": code, "body": body, "errors": [code], "trigger": trigger,
            "ears_form": f"UNWANTED: IF {trigger}なら、Kaname は 409 と {code} を返し、ページもフォルダも変えない"}


_NF_PAGE = _r(_404, "ページが無い・見えない・消した・別の会社の物（在るかを漏らさない）",
              "UNWANTED: IF ページが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない")
_FB_PAGE = _r(_403, "ページは見えるが書けない（その棚に書けない人）",
              "UNWANTED: IF ページに書けない人なら、Kaname は 403 を返し、何も変えない")
_NF_FOLDER = _r(_404, "フォルダ・親のフォルダが無い・見えない・別の会社の物",
                "UNWANTED: IF フォルダが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない")
_FB_FOLDER = _r(_403, "フォルダは見えるが書けない（その棚に書けない人）",
                "UNWANTED: IF フォルダに書けない人なら、Kaname は 403 を返し、何も変えない")
_NF_SHELF = _r(_404, "グループ・フォルダが無い・見えない・その棚に無い・別の会社の物",
               "UNWANTED: IF 置く先が無いか見えないなら、Kaname は 404 を返し、何も作らない")
_FB_SHELF = _r(_403, "その棚に書けない人（見えるが書けない）",
               "UNWANTED: IF その棚に書けない人なら、Kaname は 403 を返し、何も作らない")


def _bad(what: str) -> dict:
    return _r(_422, f"{what}・体に知らない欄（strict）", "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない")


ERRORS_4XX = {
    "getKnowledgePage": [_NF_PAGE, _503],
    "listKnowledgeVersions": [_NF_PAGE, _503],
    "getKnowledgePageVersion": [_r(_404, "ページが無い・見えない・その版が無い", "UNWANTED: IF ページか版が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさない"), _503],
    "createKnowledgeFolder": [_FB_SHELF, _NF_SHELF,
                              _c("E-KNW-020", "同じ場所に同じ名前のフォルダがある"),
                              _c("E-KNW-021", "フォルダの深さが 6 を超える"),
                              _bad("名前が空白だけか 100 字を超える・知らない棚・グループの棚で group_id が無い・uuid でない"), _503],
    "updateKnowledgeFolder": [_FB_FOLDER, _NF_FOLDER,
                              _c("E-KNW-020", "同じ場所に同じ名前のフォルダがある"),
                              _c("E-KNW-021", "フォルダの深さが 6 を超える"),
                              _c("E-KNW-022", "フォルダを自分の中へ動かそうとした"),
                              _c("E-KNW-023", "フォルダを別の棚へ動かそうとした"),
                              _bad("名前が空白だけか 100 字を超える・position が 0 より小さい・欄が 1 つも無い"), _503],
    "deleteKnowledgeFolder": [_FB_FOLDER, _NF_FOLDER,
                              _c("E-KNW-024", "中にページかフォルダがある"),
                              _c("E-KNW-051", "ほかのグループに共有している"), _503],
    "createKnowledgePage": [_FB_SHELF, _NF_SHELF,
                            _bad("題名が空白だけか 200 字を超える・1 行の説明が 200 字を超える・知らない棚・グループの棚で group_id が無い"), _503],
    "saveKnowledgeDraft": [_FB_PAGE, _NF_PAGE,
                           _c("E-KNW-012", "ほかの人がこのページを書いている"),
                           _bad("題名・説明の形・本文（doc）が本文の形に合わない・欄が 1 つも無い"), _503],
    "discardKnowledgeDraft": [_FB_PAGE, _NF_PAGE, _c("E-KNW-030", "捨てる下書きが無い"), _503],
    "publishKnowledgePage": [_FB_PAGE, _NF_PAGE,
                             _c("E-KNW-040", "書き終える下書きが無い"),
                             _c("E-KNW-041", "必ず守るのページで本文が 2,000 字を超える"), _503],
    "updateKnowledgePage": [_FB_PAGE, _r(_404, "ページ・動かす先のフォルダが無い・見えない・消した", "UNWANTED: IF ページか動かす先が無いか見えないなら、Kaname は 404 を返し、何も変えない"),
                            _c("E-KNW-011", "上げる・共有する頼みが承認待ち"),
                            _c("E-KNW-052", "ページを別の棚へ動かそうとした"),
                            _bad("folder_id が uuid でない・position が 0 より小さい・欄が 1 つも無い"), _503],
    "deleteKnowledgePage": [_FB_PAGE, _NF_PAGE,
                            _c("E-KNW-011", "上げる・共有する頼みが承認待ち"),
                            _c("E-KNW-050", "必ず守るが付いている"),
                            _c("E-KNW-051", "ほかのグループに共有している"), _503],
    "setKnowledgeMust": [_FB_PAGE, _NF_PAGE,
                         _c("E-KNW-010", "ページがまだ書き終わっていない（下書きだけ）"),
                         _c("E-KNW-011", "上げる・共有する頼みが承認待ち"),
                         _c("E-KNW-060", "必ず守るの上限に届いた", detail=True),
                         _c("E-KNW-061", "本文が 2,000 字を超える"),
                         _bad("must が真偽でない"), _503],
    "findSimilarKnowledge": [_bad("題名が空白だけか 200 字を超える・text が 10,000 字を超える・exclude_page_id が uuid でない"), _503],
    "copyKnowledgePage": [_r(_404, "ページ・写す先のフォルダが無い・見えない・自分の棚に無い", "UNWANTED: IF ページか写す先が無いか見えないなら、Kaname は 404 を返し、何も作らない"),
                          _c("E-KNW-010", "ページがまだ書き終わっていない（下書きだけ）"),
                          _c("E-KNW-080", "自分の棚のページを写そうとした"),
                          _bad("folder_id が uuid でない"), _503],
}

# 似たページを探すは読むだけ（書かない）ので、冪等キーの汎用の 409 を外す（K675-API-006：読む口に 409 は無い）
NO_GENERIC_409 = {"findSimilarKnowledge"}
