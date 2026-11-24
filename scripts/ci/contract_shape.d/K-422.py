# K-422 確認の口（confirmInvitationJoin）の契約の形の表に足す分（K-325 の断片）。acceptInvitation の行は K-332 の断片と本体（screen_api.py）が持つ
# apps/api/src/features/F2/invitations/confirm.ts（token は無ければ 422）
REQUIRED_INPUTS = {
    "confirmInvitationJoin": {"token"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 確認のトークンが空白だけは契約の決まりで書く（K-355 の request_ref と同じ書き方・UNEXPRESSIBLE_422 には足さない）
VALUE_RANGES = {
    "confirmInvitationJoin": {"token": {"pattern": "\\S"}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
