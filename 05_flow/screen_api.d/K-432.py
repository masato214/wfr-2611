# K-432 本文を書き終える口（updateTicketBody・PATCH /api/v1/tickets/:id/body）
# 入力は version（今見ている版・本文の行がまだ無いチケットは 0）と doc（文書の木）だけ。text は受けない（口が doc から docToText で作る）。strict（知らない欄は 422）
# 文書の木の形は K-561・K-584 の validateDoc と同じ決まりを scripts/ci/doc_shape.py で書く（節と印の種類・見出しの段・寄せ・番号・結合の数・色・リンクの形・入れ子 12）
import doc_shape as _DS   # 手助けは断片の中で読む（scripts/ci が import の道に入っている）

INPUTS = {
    "updateTicketBody": ("TicketBodyInput", {"version": "integer", "doc": "object"}),
}
REQUIRED_INPUTS = {"updateTicketBody": ["version", "doc"]}
VALUE_RANGES = {
    "updateTicketBody": {"version": {"minimum": 0, "maximum": 2147483647}, "doc": _DS.doc_schema()},
}
RESPONSES = {
    "updateTicketBody": ("BodySaved", {"version": "integer", "changed": "boolean", "edited_at": "string"}),
}

# 403 は書けない人（見えるが書く権限が無い）。404 は入口の行の守りで返す（別の会社・見えない・無い id・消したチケット。口には届かない）。409 は先に直された（E-SEC-004）・完了した（E-SEC-005）。
# 404・409 の体は error と code（409 は message）だけで field・details・detail を付けない（控え帳 2026-11-20 20:50・2026-11-21 01:15）
ERRORS_4XX = {
    "updateTicketBody": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "そのチケットは見えるが、書く権限（グループの tickets の edit か担当者）が無い",
         "ears_form": "UNWANTED: IF チケットは見えるが書く権限が無いなら、Kaname は 403 と FORBIDDEN を返し、本文も版も変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えない・無い id・消したチケット（入口の行の守りで返す・有ることも漏らさない）",
         "ears_form": "UNWANTED: IF チケットが別の会社・見えない・無い id・消したチケットなら、Kaname は 404 と NOT_FOUND を返し、何も書かない"},
        {"status": 409, "code": "E-SEC-004", "body": {"error": "conflict", "code": "E-SEC-004"}, "errors": ["E-SEC-004"],
         "trigger": "送った version が今の版と違う（先に別の人が直した・同じ版を持った 2 つの画面の後の方・本文の行が無いのに 0 でない版）",
         "ears_form": "UNWANTED: IF 送った version が今の版と違うなら、Kaname は 409 と E-SEC-004 を返し（誰が直したかは答えに入れない）、本文も版も変えない"},
        {"status": 409, "code": "E-SEC-005", "body": {"error": "conflict", "code": "E-SEC-005"}, "errors": ["E-SEC-005"],
         "trigger": "完了したチケット（完了の時刻が入っているか段が done）",
         "ears_form": "UNWANTED: IF 完了したチケットの本文を直そうとしたなら、Kaname は 409 と E-SEC-005 を返し、本文も版も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []},
         "trigger": "version が無い・負・2147483647 より大きい・整数でない／doc が無い・形が違う（節・印・見出しの段・リンクの形・入れ子の深さ）／知らない欄（text を含む）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、本文も版も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "本文の行・版の行・やり取りの 1 行・証跡のどれかを書く DB が落ちた（1 つの取引で戻す）",
         "ears_form": "UNWANTED: IF 本文を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、本文・版・やり取り・証跡のどれも残さない"},
    ],
}
