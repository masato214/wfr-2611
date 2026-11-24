# K-675 ナレッジの口の置き場（16 本）の契約の形の表に足す分（K-325 の断片）
#   必須の欄と値域は 05_flow/screen_api.d/K-675.py と同じ。欄をまたぐ決まりは INPUT_RULES（契約に書ける形）なので UNEXPRESSIBLE_422 は空
REQUIRED_INPUTS = {
    "createKnowledgeFolder": {"shelf", "name"},
    "createKnowledgePage": {"shelf", "title"},
    "setKnowledgeMust": {"must"},
    "findSimilarKnowledge": {"title"},
}
NO_REQUIRED_INPUTS = {
    "updateKnowledgeFolder": "name・parent_folder_id・position のどれか 1 つ（契約の INPUT_RULES の anyOf・K-675）",
    "saveKnowledgeDraft": "title・desc・doc のどれか 1 つ（契約の INPUT_RULES の anyOf・K-675）",
    "publishKnowledgePage": "体は空の形（K-675）。{} で 200",
    "updateKnowledgePage": "folder_id・position のどれか 1 つ（契約の INPUT_RULES の anyOf・K-675）",
    "copyKnowledgePage": "folder_id は無くてよい（無ければ自分の棚の直下・K-675）",
}
PATH_PATTERNS = {
    ("getKnowledgePageVersion", "v"): "^[1-9][0-9]{0,8}$",
}
_SHELF = {"enum": ["company", "group", "me"]}
VALUE_RANGES = {
    "createKnowledgeFolder": {"shelf": _SHELF, "name": {"pattern": "\\S", "maxLength": 100}},
    "updateKnowledgeFolder": {"name": {"pattern": "\\S", "maxLength": 100}, "position": {"minimum": 0}},
    "createKnowledgePage": {"shelf": _SHELF, "title": {"pattern": "\\S", "maxLength": 200}, "desc": {"maxLength": 200}},
    "saveKnowledgeDraft": {"title": {"pattern": "\\S", "maxLength": 200}, "desc": {"maxLength": 200}},
    "updateKnowledgePage": {"position": {"minimum": 0}},
    "findSimilarKnowledge": {"title": {"pattern": "\\S", "maxLength": 200}, "desc": {"maxLength": 200}, "text": {"maxLength": 10000}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
