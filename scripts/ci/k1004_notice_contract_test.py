"""K-1004 契約の作り直し（お知らせ・稼働状況・1 社にお知らせを送る）の試験。

テストの名前の頭の行 ID（K1004-DC-…）は 11_tickets/K-1004.md の表のマスに 1 対 1 で結ぶ。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
読むのは作り手が出した契約（scripts/ci/f12_contract_kit.py・K-948 が運ぶ）。
"""
from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import f12_contract_kit as k  # noqa: E402
import portable_regex  # noqa: E402

NOT_BLANK = portable_regex.portable("\\S")   # 作り手は契約の \S を JS と同じ字の組に直して書く（K-1117）

KINDS = ["incident", "maintenance", "release"]
INCIDENT_STATES = ["investigating", "identified", "monitoring", "resolved"]
NOTICE = {"id", "kind", "title", "body", "state", "published_at", "unread", "maintenance", "updates"}
OPS_ROW = {"id", "kind", "title", "audience", "state", "placements", "publish_at", "published_at", "author_name", "incident_state", "admins_only"}
OPS_DETAIL = OPS_ROW | {"body", "maintenance", "impact", "updates", "reach"}
OPS_INPUT = {"kind", "title", "body", "audience_mode", "audience_plans", "audience_workspace_ids", "placements",
             "publish_at", "maintenance_from", "maintenance_to", "impact"}


class UserNotices(unittest.TestCase):
    def test_K1004_DC_001_list_notices(self) -> None:
        """K1004-DC-001 listNotices：1 行は 9 欄（本文・続報まで・1 件を開く口は作らない）・問い合わせは kind・unread・cursor・limit（並びを受けない）"""
        self.assertTrue(k.is_list("listNotices"))
        self.assertEqual(k.output_fields("listNotices"), NOTICE)
        self.assertEqual(k.query_names("listNotices"), {"kind", "unread", "cursor", "limit"})
        self.assertEqual(k.query_param("listNotices", "kind").get("enum"), KINDS)
        self.assertEqual(k.query_param("listNotices", "unread").get("enum"), ["true"])

    def test_K1004_DC_002_mark_read(self) -> None:
        """K1004-DC-002 markNoticeRead：入力は空の体・答えは id と read_at"""
        self.assertEqual(k.input_fields("markNoticeRead"), set())
        self.assertEqual(k.output_fields("markNoticeRead"), {"id", "read_at"})

    def test_K1004_DC_003_status_for_member(self) -> None:
        """K1004-DC-003 getServiceStatusForMember：答えは components（部分ごとの様子）と bands（上の帯：障害・メンテ・止める日・中を見られている間の 4 種・1 つの差し込み口・D-156.10）と maintenance_now"""
        self.assertEqual(k.output_fields("getServiceStatusForMember"), {"components", "bands", "maintenance_now"})
        self.assertFalse(k.is_list("getServiceStatusForMember"))

    def test_K1004_DC_004_public_status_untouched(self) -> None:
        """K1004-DC-004 ログイン前の getServiceStatus（K-307）の形は変えない（incidents と maintenance）"""
        self.assertEqual(k.output_fields("getServiceStatus"), {"incidents", "maintenance"})


class OpsNotices(unittest.TestCase):
    def test_K1004_DC_005_list_ops_notices(self) -> None:
        """K1004-DC-005 listOpsNotices：1 行は 11 欄（障害の今の状態 incident_state と管理者だけの印 admins_only を含む）・問い合わせは kind・state・cursor・limit。state は下書き・予定・出した・直った"""
        self.assertEqual(k.output_fields("listOpsNotices"), OPS_ROW)
        self.assertEqual(k.query_names("listOpsNotices"), {"kind", "state", "cursor", "limit"})
        self.assertEqual(k.query_param("listOpsNotices", "state").get("enum"), ["draft", "scheduled", "published", "resolved"])

    def test_K1004_DC_006_create_input(self) -> None:
        """K1004-DC-006 createOpsNotice：入力は 11 欄（表の写しの欄・id・tenant を受けない）・必須は kind・title・body・audience_mode・placements"""
        self.assertEqual(k.input_fields("createOpsNotice"), OPS_INPUT)
        self.assertEqual(k.required_fields("createOpsNotice"), {"kind", "title", "body", "audience_mode", "placements"})
        self.assertFalse(k.input_schema("createOpsNotice").get("additionalProperties", True))

    def test_K1004_DC_007_create_ranges(self) -> None:
        """K1004-DC-007 値の形：kind 3 つ・audience_mode は all／plans／workspaces（D-156.33）・placements は band と list（1〜2 つ）・audience_workspace_ids は uuid・title 1〜100・body 1〜4000・題と本文（続報・1 社に送るも）は空白だけを断る pattern \\S（D-156.38）"""
        self.assertEqual(k.input_prop("createOpsNotice", "kind").get("enum"), KINDS)
        self.assertEqual(k.input_prop("createOpsNotice", "audience_mode").get("enum"), ["all", "plans", "workspaces"])
        pl = k.input_prop("createOpsNotice", "placements")
        self.assertEqual(pl.get("items", {}).get("enum"), ["band", "list"])
        self.assertEqual((pl.get("minItems"), pl.get("maxItems")), (1, 2))
        self.assertEqual(k.input_prop("createOpsNotice", "audience_workspace_ids").get("items", {}).get("format"), "uuid")
        t = k.input_prop("createOpsNotice", "title")
        self.assertEqual((t.get("minLength"), t.get("maxLength")), (1, 100))
        b = k.input_prop("createOpsNotice", "body")
        self.assertEqual((b.get("minLength"), b.get("maxLength")), (1, 4000))
        for op, field in (("createOpsNotice", "title"), ("createOpsNotice", "body"), ("updateOpsNotice", "title"),
                          ("updateOpsNotice", "body"), ("sendWorkspaceNotice", "title"), ("sendWorkspaceNotice", "body"),
                          ("addIncidentUpdate", "body")):
            self.assertEqual(k.input_prop(op, field).get("pattern"), NOT_BLANK, f"{op}.{field} は空白だけを断る（D-156.38）")

    def test_K1004_DC_008_detail_update_publish(self) -> None:
        """K1004-DC-008 getOpsNotice・updateOpsNotice・publishOpsNotice の答えは 1 件の 16 欄。updateOpsNotice の入力は作ると同じ 11 欄で必須なし。publishOpsNotice の入力は空の体"""
        for op in ("getOpsNotice", "updateOpsNotice", "publishOpsNotice", "createOpsNotice"):
            self.assertEqual(k.output_fields(op), OPS_DETAIL, op)
        self.assertEqual(k.input_fields("updateOpsNotice"), OPS_INPUT)
        self.assertEqual(k.required_fields("updateOpsNotice"), set())
        self.assertEqual(k.input_fields("publishOpsNotice"), set())

    def test_K1004_DC_009_incident_update(self) -> None:
        """K1004-DC-009 addIncidentUpdate：入力は state（4 つ）と body（どちらも必須）・答えは 1 件の 16 欄"""
        self.assertEqual(k.input_fields("addIncidentUpdate"), {"state", "body"})
        self.assertEqual(k.required_fields("addIncidentUpdate"), {"state", "body"})
        self.assertEqual(k.input_prop("addIncidentUpdate", "state").get("enum"), INCIDENT_STATES)
        self.assertEqual(k.output_fields("addIncidentUpdate"), OPS_DETAIL)

    def test_K1004_DC_010_send_workspace_notice(self) -> None:
        """K1004-DC-010 sendWorkspaceNotice（1 社に送る）：入力は title・body・placements（必須・会社は道の :id）と admins_only（boolean・任意・D-156.57）・答えは 1 件の 16 欄"""
        self.assertEqual(k.input_fields("sendWorkspaceNotice"), {"title", "body", "placements", "admins_only"})
        self.assertEqual(k.input_prop("sendWorkspaceNotice", "admins_only").get("type"), "boolean")
        self.assertEqual(k.required_fields("sendWorkspaceNotice"), {"title", "body", "placements"})
        self.assertEqual(k.output_fields("sendWorkspaceNotice"), OPS_DETAIL)

    def test_K1004_DC_011_uuid_and_perms(self) -> None:
        """K1004-DC-011 `_id` の欄は uuid・権限の言葉は今のまま（利用者は read と self・運営は ops:notice）"""
        ops = ["listNotices", "markNoticeRead", "getServiceStatusForMember", "listOpsNotices", "createOpsNotice",
               "getOpsNotice", "updateOpsNotice", "publishOpsNotice", "addIncidentUpdate", "sendWorkspaceNotice"]
        for op in ops:
            self.assertEqual(k.id_fields_are_uuid(k.input_schema(op)), [], f"{op} の入力")
            self.assertEqual(k.id_fields_are_uuid(k.output_schema(op)), [], f"{op} の答え")
        self.assertEqual(k.perm_word("listNotices"), "read")
        self.assertEqual(k.perm_word("markNoticeRead"), "self")
        for op in ops[3:]:
            self.assertEqual(k.perm_word(op), "ops:notice", op)

    def test_K1004_DC_012_admins_only_not_band(self) -> None:
        """K1004-DC-012 管理者だけ × 上の帯：sendWorkspaceNotice の入力の形に、admins_only が true で placements に band がある体を断る not の決まり（422・D-156.57）"""
        self.assertEqual(
            k.input_schema("sendWorkspaceNotice").get("not"),
            {"properties": {"admins_only": {"const": True}, "placements": {"contains": {"const": "band"}}},
             "required": ["admins_only", "placements"]},
        )


if __name__ == "__main__":
    unittest.main()
