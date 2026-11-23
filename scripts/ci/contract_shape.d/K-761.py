# K-761 PC の側の口 2 本（reportBrowserState・getFileForBridge）の契約の形の表（K-325 の断片）。
#   必須の欄（screen_api.d/K-761.py の REQUIRED_INPUTS と同じ値）と、道の値 ref の値域（資料の id・uuid の形）
REQUIRED_INPUTS = {"reportBrowserState": {"browser", "state"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {
    # apps/api/src/features/F5/delegate/job-file.ts（ref が uuid の形でなければ 422 欄 ref・K761-API-009）
    ("getFileForBridge", "ref"): "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
