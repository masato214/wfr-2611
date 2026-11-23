# K-421 招待のリンク（createInvitationLink）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F10/invite/link.ts（scope_id・role_key は無ければ 422）
REQUIRED_INPUTS = {
    "createInvitationLink": {"scope_id", "role_key"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 役割は決まった 4 つ
VALUE_RANGES = {
    "createInvitationLink": {
        "role_key": {"enum": ["member", "manager", "viewer", "admin"]},
    },
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
