# K-1004 お知らせのまとまりの契約を、画面（uh-help・uh-notice・uh-band-*・oq-notices・oq-notice-new・oq-notice・oq-notice-publish・op-ws-notice）が要る欄に作り直す（D-156.5）。
#   利用者の 3 口（listNotices・markNoticeRead・getServiceStatusForMember）と運営の 7 口（listOpsNotices・createOpsNotice・getOpsNotice・
#   updateOpsNotice・publishOpsNotice・addIncidentUpdate・sendWorkspaceNotice）。契約だけで、振る舞いは後の葉（K-954〜K-957・K-977〜K-980）。
#   本体の表の今ある鍵（RESPONSES の getServiceStatusForMember・getOpsNotice）は本体で直した。ここは新しい鍵だけ
#   ログイン前の getServiceStatus（K-307）の形は変えない

_KINDS = ["incident", "maintenance", "release"]
_INCIDENT_STATES = ["investigating", "identified", "monitoring", "resolved"]
_NOT_BLANK = "\\S"   # 空白だけは断る（全角の空白・タブ・改行だけも 422・D-156.38）

# 体は strict（知らない欄は 422）。読んだ印と出すは空の体
_OPS_INPUT = {
    "kind": "string", "title": "string", "body": "string",
    "audience_mode": "string", "audience_plans": "string[]", "audience_workspace_ids": "uuid[]",
    "placements": "string[]", "publish_at": "string?",
    "maintenance_from": "string?", "maintenance_to": "string?", "impact": "string?",
}
INPUTS = {
    "markNoticeRead": ("NoticeReadInput", {}),
    "createOpsNotice": ("OpsNoticeCreateInput", dict(_OPS_INPUT)),
    "updateOpsNotice": ("OpsNoticeUpdateInput", dict(_OPS_INPUT)),
    "publishOpsNotice": ("OpsNoticePublishInput", {}),
    "addIncidentUpdate": ("IncidentUpdateInput", {"state": "string", "body": "string"}),
    # 1 社に送る：会社は道の :id。admins_only は管理者だけに出す（値段が変わるお知らせ・D-156.57）
    "sendWorkspaceNotice": ("WorkspaceNoticeInput", {"title": "string", "body": "string", "placements": "string[]", "admins_only": "boolean"}),
}

# 直す（updateOpsNotice）は必須なし（渡した欄だけ直す）
REQUIRED_INPUTS = {
    "createOpsNotice": ["kind", "title", "body", "audience_mode", "placements"],
    "addIncidentUpdate": ["state", "body"],
    "sendWorkspaceNotice": ["title", "body", "placements"],
}

_TITLE = {"minLength": 1, "maxLength": 100, "pattern": _NOT_BLANK}
_BODY = {"minLength": 1, "maxLength": 4000, "pattern": _NOT_BLANK}
_PLACEMENTS = {"items": {"type": "string", "enum": ["band", "list"]}, "minItems": 1, "maxItems": 2, "uniqueItems": True}
_WHEN = {"format": "date-time"}
_OPS_RANGES = {
    "kind": {"enum": list(_KINDS)},
    "title": dict(_TITLE), "body": dict(_BODY),
    "audience_mode": {"enum": ["all", "plans", "workspaces"]},   # 誰に：全部・プランで選ぶ・ワークスペースを選ぶ（D-156.33）
    "audience_plans": {"items": {"type": "string", "enum": ["free", "team", "business"]}, "uniqueItems": True},
    "audience_workspace_ids": {"items": {"type": "string", "format": "uuid"}, "uniqueItems": True},
    "placements": dict(_PLACEMENTS),
    "publish_at": dict(_WHEN), "maintenance_from": dict(_WHEN), "maintenance_to": dict(_WHEN),
    "impact": {"minLength": 1, "maxLength": 200},
}
VALUE_RANGES = {
    "createOpsNotice": {k: dict(v) for k, v in _OPS_RANGES.items()},
    "updateOpsNotice": {k: dict(v) for k, v in _OPS_RANGES.items()},
    "addIncidentUpdate": {"state": {"enum": list(_INCIDENT_STATES)}, "body": dict(_BODY)},
    "sendWorkspaceNotice": {"title": dict(_TITLE), "body": dict(_BODY), "placements": dict(_PLACEMENTS)},
}

# 管理者だけのお知らせは上の帯に出さない（帯は会社の全員の画面に出る・D-156.57）：admins_only が true で placements に band があれば 422
INPUT_RULES = {
    "sendWorkspaceNotice": {"not": {"properties": {"admins_only": {"const": True}, "placements": {"contains": {"const": "band"}}},
                                    "required": ["admins_only", "placements"]}},
}

# 問い合わせの値域。unread は true だけ（読んだ物だけの絞りは無い）
QUERY_RANGES = {
    "listNotices": {"kind": {"enum": list(_KINDS)}, "unread": {"enum": ["true"]}},
    "listOpsNotices": {"kind": {"enum": list(_KINDS)}, "state": {"enum": ["draft", "scheduled", "published", "resolved"]}},
}

LIST_DETAILS = {
    "listNotices": {"sort": False, "desc": "取得（notices）— 自分に届いたお知らせを新しい順に読む（本文と障害の続報まで・1 件を開く口は無い）"},
    "listOpsNotices": {"sort": False, "desc": "取得（notices）— 運営のお知らせを新しい順に見る（下書き・予定・出した・直った）"},
}

# 利用者の 1 行（9 欄）。state は障害の状態 4 つか null。maintenance は { from, to, impact } か null。updates は障害の続報 { state, body, at }[]
_NOTICE = {"id": "uuid", "kind": "string", "title": "string", "body": "string", "state": "string?", "published_at": "string",
           "unread": "boolean", "maintenance": "object?", "updates": "array"}
# 運営の一覧の 1 行（11 欄）。audience は { mode, plans, workspaces: { id, name }[] }。incident_state は障害の今の状態（一覧の札・K-980）
_OPS_ROW = {"id": "uuid", "kind": "string", "title": "string", "audience": "object", "state": "string",
            "placements": "string[]", "publish_at": "string?", "published_at": "string?", "author_name": "string?",
            "incident_state": "string?", "admins_only": "boolean"}
# 1 件（16 欄）：本体の getOpsNotice と同じ形。reach は { workspaces, members }（出すと届く数）
_OPS_DETAIL = {**_OPS_ROW, "body": "string", "maintenance": "object?", "impact": "string?", "updates": "array", "reach": "object"}
RESPONSES = {
    "listNotices": ("Notice", dict(_NOTICE)),
    "markNoticeRead": ("NoticeRead", {"id": "uuid", "read_at": "string"}),
    "listOpsNotices": ("OpsNoticeRow", dict(_OPS_ROW)),
    "createOpsNotice": ("OpsNoticeDetail", dict(_OPS_DETAIL)),
    "updateOpsNotice": ("OpsNoticeDetail", dict(_OPS_DETAIL)),
    "publishOpsNotice": ("OpsNoticeDetail", dict(_OPS_DETAIL)),
    "addIncidentUpdate": ("OpsNoticeDetail", dict(_OPS_DETAIL)),
    "sendWorkspaceNotice": ("OpsNoticeDetail", dict(_OPS_DETAIL)),
}
