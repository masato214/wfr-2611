# K-461 知らせを読む口（listNotifications・GET /api/v1/notifications）
# 答えの形（K-461・D-151.5）：1 件が決めた 12 個の鍵だけ。payload は丸ごと返さず、種類の表（apps/api/src/features/F7/notifications/kinds.ts）の PARAM_KEYS の欄だけを params に入れる。
#   href は種類の表と ticket_id から組む（押せない行は null）・actor は起こした人 { id, name }（無ければ null）・read_at は読んだ時刻（空＝未読）
RESPONSES = {
    "listNotifications": ("Notification", {"id": "uuid", "kind": "string", "tag": "string", "href": "string?", "ticket_id": "uuid?", "number": "string?", "title": "string?", "actor": "object?", "params": "object", "read": "boolean", "read_at": "string?", "created_at": "string"}),
}
# 一覧の答えの meta：次の分の鍵（keyset・最後の分は null）と、最初の分だけの起こした人の候補（人で絞る入れ物・50 人まで）
META = {
    "listNotifications": {"next_cursor": {"type": "string", "nullable": True}, "actors": "array"},
}
# 問い合わせの値域（K-468 の仕組み）：unread は true・false だけ。maybe など契約の外の値は口が 422 にする。空の値は口が指定なしとして通す。
#   actor_member_id は名前の _id で作り手が uuid の形にするので書かない・cursor の形（base64url）は KEY_CURSOR_OPS から作り手が書く
QUERY_RANGES = {
    "listNotifications": {"unread": {"enum": ["true", "false"]}},
}
# 一覧の細目：limit は 1〜50（既定 20）・sort を受けない（できた時刻の新しい順で固定）
LIST_DETAILS = {
    "listNotifications": {"limit_max": 50, "sort": False, "desc": "取得（notifications）— 自分宛ての知らせを新しい順に見る（未読だけ・人で絞る・20 件ずつ・読んだものは 30 日分）", "meta": "{ next_cursor, actors }"},
}
# 続きの鍵が形（base64url の 1〜200 字）には合うが今の状態では読めない（JSON でない・時刻や id の形でない・古い・壊れた）は 409・E-NTF-001（欄なし）。
#   形に合わない鍵は入口が 422（欄 cursor）。契約に書けず 422 のまま残る物は作らない（控え帳 2026-11-20 16:51）
ERRORS_4XX = {
    "listNotifications": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "E-NTF-001"}, "errors": ["E-NTF-001"],
         "trigger": "続きの鍵が形（base64url の 1〜200 字）には合うが、今の状態では読めない（JSON でない・時刻や id の形でない・古い・壊れた）",
         "ears_form": "UNWANTED: IF 続きの鍵が形に合うのに今の状態では読めないなら、Kaname は 409 と E-NTF-001 を返し、最初から読み直すよう促す"},
    ],
}
