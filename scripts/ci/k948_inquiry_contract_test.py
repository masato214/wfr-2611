"""K-948 契約の作り直し（問い合わせ・受信箱・添付・書き出しを外す）の試験。

テストの名前の頭の行 ID（K948-DC-…）は 11_tickets/K-948.md の表のマスに 1 対 1 で結ぶ。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
読むのは作り手が出した契約（08_api/openapi.yaml・endpoints.json・retired-endpoints.json）と文書・親の md（scripts/ci/f12_contract_kit.py）。
"""
from __future__ import annotations

import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import f12_contract_kit as k  # noqa: E402

TOPICS = ["usage", "trouble", "billing", "other"]
MY_ROW = {"id", "title", "topic", "state", "created_at", "last_reply_at", "has_unread_reply"}
MESSAGE = {"id", "from", "author_name", "body", "attachments", "created_at"}
OPS_ROW = {"id", "title", "topic", "state", "workspace", "asker", "owner", "later_until", "created_at", "last_message_at"}
OPS_MESSAGE = {"id", "kind", "author_name", "body", "attachments", "created_at"}


class UserInquiry(unittest.TestCase):
    def test_K948_DC_001_list_my_inquiries(self) -> None:
        """K948-DC-001 listMyInquiries：答えの 1 行は 7 欄（id は uuid）・問い合わせは cursor と limit だけ（会社・並びを受けない）"""
        self.assertTrue(k.is_list("listMyInquiries"))
        self.assertEqual(k.output_fields("listMyInquiries"), MY_ROW)
        self.assertEqual(k.output_prop("listMyInquiries", "id").get("format"), "uuid")
        self.assertEqual(k.query_names("listMyInquiries"), {"cursor", "limit"})

    def test_K948_DC_002_create_inquiry_input(self) -> None:
        """K948-DC-002 createInquiry：入力は topic・title・body・attachment_ids・context だけ（表の写しの欄・id を受けない）。必須は topic・title・body"""
        self.assertEqual(k.input_fields("createInquiry"), {"topic", "title", "body", "attachment_ids", "context"})
        self.assertEqual(k.required_fields("createInquiry"), {"topic", "title", "body"})
        self.assertFalse(k.input_schema("createInquiry").get("additionalProperties", True))
        self.assertEqual(k.output_fields("createInquiry"), MY_ROW)

    def test_K948_DC_003_create_inquiry_ranges(self) -> None:
        """K948-DC-003 createInquiry の値の形：topic は 4 つ・title は 1〜100 字・body は 1〜4000 字・attachment_ids は uuid を 5 つまで"""
        self.assertEqual(k.input_prop("createInquiry", "topic").get("enum"), TOPICS)
        title = k.input_prop("createInquiry", "title")
        self.assertEqual((title.get("minLength"), title.get("maxLength")), (1, 100))
        body = k.input_prop("createInquiry", "body")
        self.assertEqual((body.get("minLength"), body.get("maxLength")), (1, 4000))
        ids = k.input_prop("createInquiry", "attachment_ids")
        self.assertEqual(ids.get("maxItems"), 5)
        self.assertEqual(ids.get("items", {}).get("format"), "uuid")

    def test_K948_DC_004_get_my_inquiry(self) -> None:
        """K948-DC-004 getMyInquiry：答えは 1 行の 7 欄と messages と context（問い合わせたときに付けた画面の情報・D-156.39）。社内メモの欄は持たない"""
        self.assertEqual(k.output_fields("getMyInquiry"), MY_ROW | {"messages", "context"})
        self.assertNotIn("note", " ".join(k.output_fields("getMyInquiry")))

    def test_K948_DC_005_message_and_resolve(self) -> None:
        """K948-DC-005 postInquiryMessage：入力は body と attachment_ids（必須は body）・答えはやり取りの 1 件の 6 欄。resolveMyInquiry：入力は空の体・答えは 1 行の 7 欄"""
        self.assertEqual(k.input_fields("postInquiryMessage"), {"body", "attachment_ids"})
        self.assertEqual(k.required_fields("postInquiryMessage"), {"body"})
        self.assertEqual(k.output_fields("postInquiryMessage"), MESSAGE)
        self.assertEqual(k.input_fields("resolveMyInquiry"), set())
        self.assertEqual(k.output_fields("resolveMyInquiry"), MY_ROW)

    def test_K948_DC_006_attachment_upload(self) -> None:
        """K948-DC-006 uploadInquiryAttachment：入力は name・content_type・size（全部必須）・size は 1〜10485760・種類は画像 4 つと PDF と zip。答えは id・upload_url・done_url・expires_at（体は置き場へ直に送り、上げ終わりを done_url に知らせる・K-950）。関門に C4"""
        self.assertEqual(k.input_fields("uploadInquiryAttachment"), {"name", "content_type", "size"})
        self.assertEqual(k.required_fields("uploadInquiryAttachment"), {"name", "content_type", "size"})
        size = k.input_prop("uploadInquiryAttachment", "size")
        self.assertEqual((size.get("minimum"), size.get("maximum")), (1, 10485760))
        self.assertEqual(
            set(k.input_prop("uploadInquiryAttachment", "content_type").get("enum", [])),
            {"image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "application/zip"},
        )
        self.assertEqual(k.output_fields("uploadInquiryAttachment"), {"id", "upload_url", "done_url", "expires_at"})
        self.assertIn("C4", k.choke_points("uploadInquiryAttachment"))

    def test_K948_DC_007_write_ops_choke_points(self) -> None:
        """K948-DC-007 問い合わせの書く口（createInquiry・postInquiryMessage）は関門 C2・C4・C6 を持つ"""
        for op in ("createInquiry", "postInquiryMessage"):
            self.assertTrue({"C2", "C4", "C6"} <= k.choke_points(op), op)


class OpsInbox(unittest.TestCase):
    def test_K948_DC_008_list_ops_inquiries(self) -> None:
        """K948-DC-008 listOpsInquiries：1 行は 10 欄・問い合わせは box（5 つ）と topic と cursor・limit。答えの meta に counts を持たない（数は getOpsShell・D-156.4）"""
        self.assertEqual(k.output_fields("listOpsInquiries"), OPS_ROW)
        self.assertEqual(k.query_names("listOpsInquiries"), {"box", "topic", "cursor", "limit"})
        self.assertEqual(k.query_param("listOpsInquiries", "box").get("enum"), ["unassigned", "mine", "waiting", "later", "done"])
        self.assertEqual(k.query_param("listOpsInquiries", "topic").get("enum"), TOPICS)
        self.assertNotIn("counts", k.meta_fields("listOpsInquiries"))

    def test_K948_DC_009_get_ops_inquiry(self) -> None:
        """K948-DC-009 getOpsInquiry：1 行の 10 欄と messages・context（いま見ていた画面の情報）・workspace_status（右のワークスペースの様子）"""
        self.assertEqual(k.output_fields("getOpsInquiry"), OPS_ROW | {"messages", "context", "workspace_status"})

    def test_K948_DC_010_update_ops_inquiry(self) -> None:
        """K948-DC-010 updateOpsInquiry：入力は take・release・state・later_until だけ（担当の人の id を受けない＝取るのは自分だけ）。state は open と done。答えは 1 行の 10 欄"""
        self.assertEqual(k.input_fields("updateOpsInquiry"), {"take", "release", "state", "later_until"})
        self.assertEqual(k.input_prop("updateOpsInquiry", "state").get("enum"), ["open", "done"])
        self.assertEqual(k.output_fields("updateOpsInquiry"), OPS_ROW)

    def test_K948_DC_011_reply_and_note(self) -> None:
        """K948-DC-011 replyOpsInquiry・addOpsInquiryNote：入力は body だけ（運営が添付を上げる口が無いので attachment_ids を持たない・D-156.40）。答えはどちらも運営のやり取りの 1 件の 6 欄（kind で返事と社内メモを分ける）"""
        self.assertEqual(k.input_fields("replyOpsInquiry"), {"body"})
        self.assertEqual(k.required_fields("replyOpsInquiry"), {"body"})
        self.assertEqual(k.input_fields("addOpsInquiryNote"), {"body"})
        for op in ("replyOpsInquiry", "addOpsInquiryNote"):
            self.assertEqual(k.output_fields(op), OPS_MESSAGE, op)
        self.assertEqual(k.output_prop("replyOpsInquiry", "kind").get("enum"), ["customer", "reply", "note"])

    def test_K948_DC_012_uuid_fields(self) -> None:
        """K948-DC-012 この葉の口の入力と答えで `_id` で終わる欄は全部 uuid（控え帳）"""
        ops = ["listMyInquiries", "createInquiry", "getMyInquiry", "postInquiryMessage", "resolveMyInquiry",
               "uploadInquiryAttachment", "listOpsInquiries", "getOpsInquiry", "updateOpsInquiry",
               "replyOpsInquiry", "addOpsInquiryNote"]
        for op in ops:
            self.assertEqual(k.id_fields_are_uuid(k.input_schema(op)), [], f"{op} の入力")
            self.assertEqual(k.id_fields_are_uuid(k.output_schema(op)), [], f"{op} の答え")


class Retire(unittest.TestCase):
    def test_K948_DC_013_exports_retired(self) -> None:
        """K948-DC-013 書き出しの口 2 本（exportOpsWorkspaces・exportOpsInvoices）が契約に無く、外した口の記録に決定 D-156.13 と理由つきで在る"""
        for op, path in (("exportOpsWorkspaces", "/api/v1/ops/workspaces/export"), ("exportOpsInvoices", "/api/v1/ops/invoices/export")):
            self.assertFalse(k.has_op(op), op)
            r = k.retired("POST", path)
            self.assertIsNotNone(r, path)
            self.assertEqual(r["decision"], "D-156.13")
            self.assertTrue(str(r.get("reason", "")).strip())

    def test_K948_DC_014_exports_gone_everywhere(self) -> None:
        """K948-DC-014 書き出しの口の名前と道が、契約の表・目録・作った道・文書・生成の試験のどこにも無い（チケットの md は記録なので見ない・09_features は古い生成物なので見ない）。親 K-72 の md の apis・tests にも無い"""
        import subprocess

        out = subprocess.run(
            ["git", "grep", "-l", "-E", "exportOpsWorkspaces|exportOpsInvoices|ops/workspaces/export|ops/invoices/export|ops_workspaces_export|ops_invoices_export",
             "--", ".", ":!08_api/retired-endpoints.json", ":!01_hearing/*", ":!07_functional/段13-F12/*", ":!11_tickets/*",
             ":!scripts/ci/k948_*",
             # 09_features/features.json は 05_flow/build_features.py の古い出力（11-13 から作り直されていない・作り手の目録 generated.json にも無い）。
             # 今の契約の正本ではないので見ない（作り手の目録に入れるのはまとめ役への申し送り）
             ":!09_features/*"],
            cwd=k.ROOT, capture_output=True, text=True,
        )
        self.assertEqual(out.stdout.strip(), "", out.stdout)
        k72 = (k.ROOT / "11_tickets" / "K-72.md").read_text(encoding="utf-8")
        for word in ("exportOpsWorkspaces", "exportOpsInvoices", "post_ops_workspaces_export", "post_ops_invoices_export"):
            self.assertNotIn(word, k72)

    def test_K948_DC_015_perms(self) -> None:
        """K948-DC-015 権限の言葉：利用者の 6 口は self・運営の受信箱の 5 口は ops:inquiry（今のまま）"""
        for op in ("listMyInquiries", "createInquiry", "getMyInquiry", "postInquiryMessage", "resolveMyInquiry", "uploadInquiryAttachment"):
            self.assertEqual(k.perm_word(op), "self", op)
        for op in ("listOpsInquiries", "getOpsInquiry", "updateOpsInquiry", "replyOpsInquiry", "addOpsInquiryNote"):
            self.assertEqual(k.perm_word(op), "ops:inquiry", op)


    def test_K948_DC_016_not_generic(self) -> None:
        """K948-DC-016 listMyInquiries は表の素の読みで動かさない（答えの形が表の列でなくなった）：generic-ok に GET /api/v1/inquiries が無く、
        前からの試験 qa-d の CHANGED に理由つきで在る（振る舞いは K-951 が作るまで 501）"""
        import json

        ok = json.loads((k.ROOT / "08_api" / "generic-ok.json").read_text(encoding="utf-8"))["ok"]
        self.assertNotIn("GET /api/v1/inquiries", [x["op"] for x in ok])
        qa = (k.ROOT / "apps" / "api" / "test" / "qa-d.test.ts").read_text(encoding="utf-8")
        self.assertRegex(qa, r'"GET /api/v1/inquiries": "D-156\.5[^"]+"')

    def test_K948_DC_017_blank_only(self) -> None:
        """K948-DC-017 空白だけの題・内容を契約の形で断る（D-156.38）：createInquiry の title・body、postInquiryMessage・replyOpsInquiry・addOpsInquiryNote の body に pattern \\S"""
        for op, field in (("createInquiry", "title"), ("createInquiry", "body"), ("postInquiryMessage", "body"),
                          ("replyOpsInquiry", "body"), ("addOpsInquiryNote", "body")):
            self.assertEqual(k.input_prop(op, field).get("pattern"), "\\S", f"{op}.{field}")


if __name__ == "__main__":
    unittest.main()
