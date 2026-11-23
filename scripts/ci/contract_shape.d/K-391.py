# K-391 決定を改める・取り消す口（updateTicketDecision）
#   action は必須で revise・cancel のどちらか。action ごとに要る欄と空・空白・制御文字だけの 422（E-VAL-042・E-VAL-045）は INPUT_RULES（05_flow/screen_api.d/K-391.py・oneOf）に書いた（代表の答え answer=f0f290e785a9：検査の例外は足さない）。
#   ルールにする経路はこの口に無い（取引先を持たない・answer=4961f0280e9a）。promote は知らない言葉として 422
REQUIRED_INPUTS = {"updateTicketDecision": {"action"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"updateTicketDecision": {"action": {"enum": ["revise", "cancel"]}}}
UNEXPRESSIBLE_422 = {}   # 決まりは全部 INPUT_RULES・VALUE_RANGES と 409 で書いた（代表の答え answer=f0f290e785a9）
AGENT_ANSWERS = {}
