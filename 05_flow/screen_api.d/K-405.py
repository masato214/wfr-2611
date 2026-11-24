# K-405 詳細で渡しの今と記録を読む口（listTicketHandovers）。承認待ちに渡しを並べる直しと getTicket の handover は screen_api.py の本体の行に足した
#   振る舞い：apps/api/src/features/F8/handovers/list.ts・DB の関数 app.ticket_handovers_read（20261121090500）。読むだけ・新しい 50 件
#   名前は K-401 の書く口の答え TicketHandoverCreated／TicketHandoverAnswered と分ける
SCREEN_API = {
    "tickets": [
        ("GET", "/tickets/:id/handovers", "A110|A51", "ticket_handovers", "listTicketHandovers", ["tickets", "members", "scopes"]),
    ],
}

PERMS = {
    "listTicketHandovers": ("read", "そのチケットを読める人と、その渡しを渡した人・答える人。別の会社・見えない人には返さない（D-128.115）", False),
}

RESPONSES = {
    "listTicketHandovers": ("TicketHandover", {"id": "uuid", "kind": "string", "state": "string", "from": "object", "to": "object?", "to_scope": "object?", "ticket_scope": "object", "reason": "string?", "ask": "string?", "reply_due": "string?", "overdue": "boolean", "switch": "object", "decline_reason": "string?", "decided_at": "string?", "reminded_at": "string?", "created_at": "string", "can": "object"}),
}

LIST_DETAILS = {
    "listTicketHandovers": {"sort": False, "desc": "取得（ticket_handovers）— チケットの渡しの今と前の渡し（新しい順・50 件まで）"},
}
