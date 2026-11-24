"use client";
// 段 10 の下絵：必ず守る（上限）・上の棚に上げる・グループを選んで共有・写して直す・似たページ・管理（承認待ち・見直すページ）の 10 状態（K-671）。
//   外枠付きの描き方は render-knowledge.tsx（K-670）の物を使う。部品は features/F9/knowledge の見た目だけの物
import type { ReactNode } from "react";
import { ApprovalsView, ReviewView } from "@/features/F9/knowledge/admin-views";
import { MustFullDialog, RaiseDialog, ShareDialog, SimilarDialog } from "@/features/F9/knowledge/dialogs";
import { CopyBand, DeclinedBand, PageView, WaitingBand } from "@/features/F9/knowledge/page-views";
import {
  APPROVALS,
  BROKEN,
  CONFLICTS,
  EXPENSE,
  INVOICE_DOC,
  MUST_COMPANY,
  MY_DISCOUNT,
  PLACE,
  QUOTE,
  SIMILAR,
  UNUSED,
  treeFor,
} from "@/features/F9/knowledge/samples";
import type { Theme } from "@/lib/theme";
import { KnowledgeFrame } from "./frame";
import { ADMIN_SATO, ADMIN_TAKA, expense, myDiscount, quote, writing } from "./render-knowledge";

function admin(theme: Theme, list: "approvals" | "review"): ReactNode {
  const viewer = list === "approvals" ? "sato" : "taka";
  return (
    <KnowledgeFrame
      theme={theme}
      viewer={viewer}
      path={["管理", list === "approvals" ? "承認待ち" : "見直すページ"]}
      tree={{
        data: treeFor(viewer),
        admin: list === "approvals" ? ADMIN_SATO : ADMIN_TAKA,
        view: "admin",
        adminList: list,
      }}
    >
      {list === "approvals" ? (
        <ApprovalsView items={APPROVALS} />
      ) : (
        <ReviewView unused={UNUSED} conflicts={CONFLICTS} broken={BROKEN} />
      )}
    </KnowledgeFrame>
  );
}

/** K-671 が描く 10 の状態。持っていない id は null */
export function renderAdmin(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "kn-must-full":
      return expense(theme, {
        must: false,
        dialog: (
          <MustFullDialog
            shelf="会社"
            limit={30}
            count={30}
            target={`会社 › 経理 › ${EXPENSE.title}`}
            pages={MUST_COMPANY}
          />
        ),
      });
    case "kn-raise":
      return myDiscount(theme, {
        dialog: (
          <RaiseDialog
            target={`自分 › ${MY_DISCOUNT.title}`}
            to="営業"
            approver="佐藤 花子さん（営業のマネージャー）"
            folders={["営業（いちばん上）", "見積もり"]}
            folder="見積もり"
            message="新しく入った人にも同じ返し方をしてほしいので、営業の棚に上げたいです"
          />
        ),
      });
    case "kn-raise-waiting":
      return myDiscount(theme, {
        mark: "waiting",
        bands: <WaitingBand to="営業" who="佐藤 花子さん（営業のマネージャー）" at="11/21 16:20" />,
      });
    case "kn-raise-declined":
      return myDiscount(theme, {
        mark: "declined",
        bands: (
          <DeclinedBand
            to="営業"
            who="佐藤 花子さん（営業のマネージャー）"
            at="11/22 09:10"
            reason="営業 › 見積もり に「値引きの決まり」があります。「5% まで」の所だけ、そのページに足してください。"
          />
        ),
      });
    case "kn-approvals":
      return admin(theme, "approvals");
    case "kn-review":
      return admin(theme, "review");
    case "kn-share":
      return quote(
        theme,
        "sato",
        <ShareDialog
          target={`グループ：営業 › 見積もり › ${QUOTE.title}`}
          from="営業"
          groups={[
            { code: "JD", name: "受託開発", manager: "田中 美咲さん", checked: true },
            { code: "KR", name: "経理", manager: "山口 恵さん", checked: false },
            { code: "HM", name: "法務", manager: "木下 浩さん", checked: true, state: "共有している" },
          ]}
        />,
      );
    case "kn-shared-view":
      return quote(theme, "tana");
    case "kn-copy":
      return (
        <KnowledgeFrame
          theme={theme}
          viewer="suzu"
          path={["自分", "請求書の送り方（自分用）"]}
          tree={{ data: treeFor("suzu"), current: "p-invoice-copy" }}
        >
          <PageView
            place={PLACE.mine}
            title="請求書の送り方（自分用）"
            desc="請求書を送る前の確かめに、自分の担当の取引先の分を足したもの。"
            acts={["must-off", "edit"]}
            bands={<CopyBand from="会社 › 経理 の「請求書の送り方」" must />}
            foot="写した：11/19 ・ 最後に直した：鈴木 一郎 11/20 ・ 版 2"
            doc={INVOICE_DOC}
          />
        </KnowledgeFrame>
      );
    case "kn-similar":
      return writing(theme, {
        title: "請求書を送る手順",
        desc: "請求書を送るときの順番と、気をつけること。",
        fresh: true,
        dialog: <SimilarDialog when="save" target="自分 › 請求書を送る手順" pages={SIMILAR} />,
      });
    default:
      return null;
  }
}
