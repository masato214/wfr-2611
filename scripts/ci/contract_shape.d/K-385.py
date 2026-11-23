# K-385 やり取りに書き込む口（createTicketMessage）の契約の形の登録（screen_api.d/K-385.py と同じ字）
REQUIRED_INPUTS = {"createTicketMessage": {"body"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 05_flow/screen_api.d/K-385.py と同じ値域（K-389：保留の理由と再開の条件は空白と制御文字だけでない字）
_NOT_BLANK = "[^\\s\\u0000-\\u001f\\u007f]"
VALUE_RANGES = {"createTicketMessage": {"body": {"pattern": "\\S"}, "stage_key": {"enum": ["todo", "doing", "hold"]},
                                        "hold_reason": {"pattern": _NOT_BLANK}, "resume_condition": {"pattern": _NOT_BLANK}}}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
