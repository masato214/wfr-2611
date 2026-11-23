# K-432 本文を書き終える口（updateTicketBody）の契約の形の表に足す分（K-325 の断片）
#   文書の木の形は scripts/ci/doc_shape.py（05_flow/screen_api.d/K-432.py と同じ物）。口は apps/api/src/features/F4/body/input.ts の checkBodyUpdate
import doc_shape as _DS   # 手助けは断片の中で読む（置き場の断片を 1 つずつ実行する試験にも通る）

REQUIRED_INPUTS = {"updateTicketBody": {"version", "doc"}}
VALUE_RANGES = {
    "updateTicketBody": {"version": {"minimum": 0, "maximum": 2147483647}, "doc": _DS.doc_schema()},
}
UNEXPRESSIBLE_422: dict = {}   # 登録先の決まりが住所を求めるので置く。書けない決まり（節ごとの子・中身の無い節・colwidth の長さ）は口が同じ 422・欄 doc で断る
