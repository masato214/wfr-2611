# K-435 確認項目にチェックを付ける・外す・文を直す口（updateTestSpec・deleteTestSpec）の契約の形の表に足す分（K-325 の断片）
#   必須の欄（版）・値域（版・題名）。入力の決まり（oneOf）は screen_api.d の INPUT_RULES が持つ。残りの表は空（登録先の決まりがチケットごとの住所を求める）
REQUIRED_INPUTS = {
    "updateTestSpec": {"version"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "updateTestSpec": {
        "version": {"minimum": 1},
        "title": {"pattern": "\\S", "maxLength": 200},
    },
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
