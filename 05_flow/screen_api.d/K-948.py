# K-948 契約の作り直し 1：問い合わせ（利用者の 6 口・運営の受信箱の 5 口）を画面（下絵 uh-ask・uh-thread・oq-inbox）が要る欄に作り直す。
#   振る舞いは後の葉（K-949〜K-953・K-973〜K-976）で、ここは入力と答えの形だけ（D-156.5）。
#   何について（topic）は usage・trouble・billing・other の 4 つ・添付は 10MB・画像と PDF と zip（D-156.26）。顧客に見せる状態は waiting・replied・done（D-156.25）
#   空白だけの題・内容は契約の形で 422（D-156.38）。運営は添付を上げないので返事に attachment_ids を持たない（D-156.40）

_TOPICS = ["usage", "trouble", "billing", "other"]
_TEXT = {"minLength": 1, "maxLength": 4000, "pattern": "\\S"}   # 内容（空白でない字が 1 つは在る・4000 字まで）

# 体は strict（知らない欄は 422）。表の写しの欄・id は受けない
INPUTS = {
    "createInquiry": ("InquiryCreateInput", {"topic": "string", "title": "string", "body": "string", "attachment_ids": "uuid[]", "context": "object"}),
    "postInquiryMessage": ("InquiryMessageInput", {"body": "string", "attachment_ids": "uuid[]"}),
    "resolveMyInquiry": ("InquiryResolveInput", {}),
    "uploadInquiryAttachment": ("InquiryAttachmentInput", {"name": "string", "content_type": "string", "size": "integer"}),
    # 担当を取るのは自分だけ（人の id を受けない・取り合いの 409 は K-974）
    "updateOpsInquiry": ("OpsInquiryUpdateInput", {"take": "boolean", "release": "boolean", "state": "string", "later_until": "string?"}),
    "replyOpsInquiry": ("OpsInquiryReplyInput", {"body": "string"}),
    "addOpsInquiryNote": ("OpsInquiryNoteInput", {"body": "string"}),
}

REQUIRED_INPUTS = {
    "createInquiry": ["topic", "title", "body"],
    "postInquiryMessage": ["body"],
    "uploadInquiryAttachment": ["name", "content_type", "size"],
    "replyOpsInquiry": ["body"],
    "addOpsInquiryNote": ["body"],
}

VALUE_RANGES = {
    "createInquiry": {"topic": {"enum": list(_TOPICS)}, "title": {"minLength": 1, "maxLength": 100, "pattern": "\\S"},
                      "body": dict(_TEXT), "attachment_ids": {"maxItems": 5}},
    "postInquiryMessage": {"body": dict(_TEXT), "attachment_ids": {"maxItems": 5}},
    # 体は置き場へ直に送る（1MB の送る量の守り・D-130.1 を通さない）。ここは名前・種類・大きさだけ
    "uploadInquiryAttachment": {"name": {"minLength": 1, "maxLength": 200},
                                "content_type": {"enum": ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "application/zip"]},
                                "size": {"minimum": 1, "maximum": 10485760}},
    "updateOpsInquiry": {"state": {"enum": ["open", "done"]}},
    "replyOpsInquiry": {"body": dict(_TEXT)},
    "addOpsInquiryNote": {"body": dict(_TEXT)},
}

# 利用者の問い合わせの 1 件（一覧の 1 行・作った・済みにした の答え）。state は waiting・replied・done
_MY = {"id": "uuid", "title": "string", "topic": "string", "state": "string", "created_at": "string", "last_reply_at": "string?", "has_unread_reply": "boolean"}
# やり取りの 1 件（利用者に見せる分・社内メモは含めない）。from は me・ops。attachments は { id, name, size } の並び
_MY_MESSAGE = {"id": "uuid", "from": "string", "author_name": "string", "body": "string", "attachments": "array", "created_at": "string"}
# 受信箱の 1 行。state は open・waiting・later・done。workspace は { id, name }・asker は { name }・owner は { member_id, name } か null
_OPS_ROW = {"id": "uuid", "title": "string", "topic": "string", "state": "string", "workspace": "object", "asker": "object",
            "owner": "object?", "later_until": "string?", "created_at": "string", "last_message_at": "string?"}
# 運営のやり取りの 1 件。kind は customer・reply・note（社内メモ）
_OPS_MESSAGE = {"id": "uuid", "kind": "string", "author_name": "string", "body": "string", "attachments": "array", "created_at": "string"}

RESPONSES = {
    "listMyInquiries": ("MyInquiry", dict(_MY)),
    "createInquiry": ("MyInquiry", dict(_MY)),
    # 付けた情報（問い合わせたときの画面の場所・時刻・ブラウザ・PC のつながり・D-128.71・D-156.39）は付けていなければ null
    "getMyInquiry": ("MyInquiryDetail", {**_MY, "messages": "array", "context": "object?"}),
    "postInquiryMessage": ("MyInquiryMessage", dict(_MY_MESSAGE)),
    "resolveMyInquiry": ("MyInquiry", dict(_MY)),
    # 上げる先（upload_url は関門 C4 が署名した置き場の上げ先・done_url は上げ終わりを知らせる受け口・K-950）
    "uploadInquiryAttachment": ("InquiryAttachmentUpload", {"id": "uuid", "upload_url": "string", "done_url": "string", "expires_at": "string"}),
    "listOpsInquiries": ("OpsInquiryRow", dict(_OPS_ROW)),
    "updateOpsInquiry": ("OpsInquiryRow", dict(_OPS_ROW)),
    "replyOpsInquiry": ("OpsInquiryMessage", dict(_OPS_MESSAGE)),
    "addOpsInquiryNote": ("OpsInquiryMessage", dict(_OPS_MESSAGE)),
}

# 利用者の一覧は会社と並びを受けない（自分の問い合わせだけ・新しい順）
QUERIES = {
    "listMyInquiries": [],
}

LIST_DETAILS = {
    "listMyInquiries": {"sort": False, "desc": "取得（inquiries）— 自分の問い合わせ（新しい順・返事ありの印つき）"},
    "listOpsInquiries": {"sort": False, "limit_max": 100, "desc": "取得（inquiries）— 運営の受信箱（箱と何について で絞る・数は getOpsShell）"},
}

QUERY_RANGES = {
    "listOpsInquiries": {"box": {"enum": ["unassigned", "mine", "waiting", "later", "done"]}, "topic": {"enum": list(_TOPICS)}},
}
