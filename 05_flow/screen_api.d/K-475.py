# K-475 検索条件を保存する・開く口（listSavedViews・createSavedView）
# 答えの形（K-475・D-128.83）：保存した条件 1 件が 13 個の鍵。表の列（tenant_id・created_by・updated_by・deleted_at）は出さない。
#   mine＝作った人が呼んだ人／can_edit＝mine か、グループの全員に見せた条件でそのグループの edit を持つ人
INPUTS = {
    # member_id・tenant_id・created_by は受けない（作った人は呼んだ人に決まる・strict）。scope_id だけ null を受ける（自分だけの保存・見せるグループ無し）
    "createSavedView": ("SavedViewInput", {"name": "string", "share": "string", "scope_id": "uuid?", "filters": "object", "columns": "string[]", "density": "string"}),
}

_VIEW = {"id": "uuid", "name": "string", "share": "string", "scope_id": "uuid?", "filters": "object", "columns": "string[]", "density": "string",
         "member_id": "uuid", "member_name": "string", "mine": "boolean", "can_edit": "boolean", "created_at": "string", "updated_at": "string"}
RESPONSES = {
    "listSavedViews": ("SavedView", dict(_VIEW)),
    "createSavedView": ("SavedView", dict(_VIEW)),
}

# 一覧の細目（K-475）：絞り込みは share だけ（scope_id・limit・cursor は入口の共通）・並べ替えは名前の順で固定（sort を受けない）。上限 500 行
LIST_DETAILS = {
    "listSavedViews": {"sort": False, "desc": "取得（saved_views）— 保存した検索条件を名前の順に開く（自分の物と、見えるグループの全員向けの物）"},
}

# 一覧の share は self・group だけ（それ以外は口が 422・欄 share。空の値は指定なし）。scope_id は名前が _id で作り手が uuid の形にするので書かない
QUERY_RANGES = {
    "listSavedViews": {"share": {"enum": ["self", "group"]}},
}

REQUIRED_INPUTS = {"createSavedView": ["name"]}   # apps/api/src/features/F7/saved-views/input.ts（無いときは 422・欄 name）

# 名前：見える字が 1 つ以上・途中に制御文字（C0・DEL・C1）が無い・前後は空白（改行・タブも）でよい。長さは入口の normalize（NFKC と前後の空白）の後の字で数える
_VISIBLE = r"[^\s\u0000-\u001f\u007f-\u009f]"
_NO_CTRL = r"[^\u0000-\u001f\u007f-\u009f]"
_NAME = rf"^\s*{_VISIBLE}(?:{_NO_CTRL}{{0,58}}{_VISIBLE})?\s*$"   # 前後の空白を除いた長さ 60 字まで（maxLength は空白込みで数えるので使わず、pattern で書く）
def _key(): return {"pattern": "^[A-Za-z0-9_]{1,40}$"}
def _leaf(): return [{"type": "string", "maxLength": 500}, {"type": "number"}, {"type": "boolean"}]
# filters：欄 8 個まで・欄の名前は英数字と _ の 1〜40 字・値は 500 字までの文字か数か真偽か、同じ決まりの値だけを持つ入れ物 1 段（32 欄まで）
def _filters(): return {"maxProperties": 8, "propertyNames": _key(),
                        "additionalProperties": {"anyOf": _leaf() + [{"type": "object", "maxProperties": 32, "propertyNames": _key(), "additionalProperties": {"anyOf": _leaf()}}]}}
VALUE_RANGES = {"createSavedView": {
    "name": {"minLength": 1, "pattern": _NAME},
    "share": {"enum": ["self", "group"]},
    "density": {"enum": ["normal", "compact"]},
    "filters": _filters(),
    "columns": {"maxItems": 50, "items": {"type": "string", "maxLength": 40}},
}}

# 条件（filters）の欄の名前の決まり（英数字と _ の 40 字まで）は OpenAPI 3.0 に書く場所が無い（propertyNames は 3.1 から）ので、口の振る舞いのまま 422・E-VWS-007
UNEXPRESSIBLE_422 = {
    "createSavedView": ["条件（filters）の欄の名前の決まり（英数字と _ の 40 字まで）"],
}

# group に見せるなら scope_id（null でない）が要る。share が無いか self のときは scope_id は何でもよい（null も）
INPUT_RULES = {"createSavedView": {"anyOf": [
    {"not": {"required": ["share"]}},
    {"properties": {"share": {"enum": ["self"]}}},
    {"required": ["scope_id"], "properties": {"scope_id": {"type": "string"}}},
]}}

# 保存（K-475）：見せるグループが見えない・無い（404・存在を教えない）／同じ名前・50 件まで（409）／形の誤り（422）／DB が落ちた（503・11-22 18:30 の決め）
ERRORS_4XX = {
    "listSavedViews": [
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "一覧を読む所で DB が落ちた（ログは場所と例外の種類だけ。名前と条件は出さない）",
         "ears_form": "UNWANTED: IF 一覧を読む所で DB が落ちたなら、Kaname は 503 を返す（止める側に倒す）"},
    ],
    "createSavedView": [
        {"status": 404, "code": "E-VWS-004", "body": {"error": "not_found", "code": "E-VWS-004"}, "errors": ["E-VWS-004"],
         "trigger": "見せるグループ（scope_id）が無い・別の会社のグループ・消したグループ・自分に見えないグループ（自分だけの保存に付けた scope_id も同じ。在るかを教えない）",
         "ears_form": "UNWANTED: IF 見せるグループが無いか見えないなら、Kaname は 404 と E-VWS-004 を返し、保存した条件も証跡も書かない"},
        {"status": 409, "code": "E-VWS-005", "body": {"error": "conflict", "code": "E-VWS-005"}, "errors": ["E-VWS-005"],
         "trigger": "同じ人の消していない保存した条件に、同じ名前（大文字小文字・全角半角の違いも同じ）がもうある（同時の 2 回目も）",
         "ears_form": "UNWANTED: IF 同じ人の消していない条件に同じ名前があるなら、Kaname は 409 と E-VWS-005 を返し、条件も証跡も増やさない"},
        {"status": 409, "code": "E-VWS-006", "body": {"error": "conflict", "code": "E-VWS-006"}, "errors": ["E-VWS-006"],
         "trigger": "同じ人が作った消していない保存した条件が 50 件ある（51 件目・同時の 2 回目も）",
         "ears_form": "UNWANTED: IF 同じ人の消していない条件が 50 件あるなら、Kaname は 409 と E-VWS-006 を返し、条件も証跡も増やさない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "知らない欄（member_id・tenant_id・created_by など・strict）・名前が無い・share と density が決めた言葉の外・scope_id が uuid でない",
         "ears_form": "UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、条件も証跡も書かない"},
        {"status": 422, "code": "E-VWS-001", "body": {"error": "validation", "code": "E-VWS-001"}, "errors": ["E-VWS-001", "E-VWS-002", "E-VWS-003", "E-VWS-007", "E-VWS-008"],
         "trigger": "名前が空・空白だけ（E-VWS-001）／61 文字以上（E-VWS-002）／グループの全員に見せるのに見せるグループが無い・null（E-VWS-003）／条件・列の形か大きさが決まりの外（E-VWS-007）／名前の途中に制御文字（E-VWS-008）",
         "ears_form": "UNWANTED: IF 名前か条件か見せるグループの指定が決まりに合わないなら、Kaname は 422 と欄つきの番号を返し、条件も証跡も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "保存する取引（見えるグループの確かめ・行・証跡）の中で DB が落ちた（1 つの取引なので何も残らない・ログは場所と例外の種類だけ。名前と条件は出さない）",
         "ears_form": "UNWANTED: IF 保存する所で DB が落ちたなら、Kaname は 503 を返し、条件の行も証跡も残さない（止める側に倒す）"},
    ],
}
