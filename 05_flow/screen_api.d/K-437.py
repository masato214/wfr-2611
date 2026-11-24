# K-437：作る口 createTicket の、欄をまたぐ決まり（本体の INPUT_RULES に直に足さない・G74）
INPUT_RULES = {
    # 優先度が高なら理由（空白だけでない字）が要る（無ければ口が 422・欄 priority_reason）。中・空・優先度なしなら理由は問わない
    # K-438：写す物 copy は複製の元 duplicate_of と一緒にだけ送れる（無ければ口が 422・欄 copy）。同じ口の決まりは 1 つの鍵にしか置けないので allOf で重ねる
    "createTicket": {"allOf": [
        {"anyOf": [{"not": {"properties": {"priority": {"enum": ["high"]}}, "required": ["priority"]}},
                   {"properties": {"priority_reason": {"type": "string", "pattern": "\\S"}}, "required": ["priority_reason"]}]},
        {"anyOf": [{"not": {"required": ["copy"]}}, {"required": ["duplicate_of"]}]},
    ]},
}
