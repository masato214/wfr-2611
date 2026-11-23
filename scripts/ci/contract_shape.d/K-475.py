# K-475 検索条件を保存する口（createSavedView）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F7/saved-views/input.ts（名前が無ければ 422・欄 name）
REQUIRED_INPUTS = {"createSavedView": {"name"}}
# 値域は 05_flow/screen_api.d/K-475.py の VALUE_RANGES と同じ字の写し。INPUT_RULES は screen_api.d だけに書く（K-355 と同じ）
_VISIBLE = r"[^\s\u0000-\u001f\u007f-\u009f]"
_NO_CTRL = r"[^\u0000-\u001f\u007f-\u009f]"
_NAME = rf"^\s*{_VISIBLE}(?:{_NO_CTRL}{{0,58}}{_VISIBLE})?\s*$"   # 前後の空白を除いた長さ 60 字まで（maxLength は空白込みで数えるので使わず、pattern で書く）
def _key(): return {"pattern": "^[A-Za-z0-9_]{1,40}$"}
def _leaf(): return [{"type": "string", "maxLength": 500}, {"type": "number"}, {"type": "boolean"}]
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
