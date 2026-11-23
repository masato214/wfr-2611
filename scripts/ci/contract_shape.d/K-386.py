# K-386 やり取りの書き込みを直す・消す・☆ の口の契約の形の登録（screen_api.d/K-386.py と同じ字）
REQUIRED_INPUTS = {"updateTicketMessage": {"body"}}
NO_REQUIRED_INPUTS = {"starTicketMessage": "体は空の形（K-386）。{} で 200。知らない欄は 422（契約の strict）"}
PATH_PATTERNS = {}
VALUE_RANGES = {"updateTicketMessage": {"body": {"pattern": "\\S"}}}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
