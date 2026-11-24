"use client";
// 段 10 の下絵：ナレッジの木とページを読む・書く・空・読み込み中・読めなかった・見られない・狭い幅の引き出し（K-670 の 8 状態）と、
//   ほかの状態（K-671）が使う外枠付きの描き方。部品は features/F9/knowledge の見た目だけの物
import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Empty, ErrorState, Loading, NoAccess, PAGE_ERROR } from "@/components/k";
import { PageEdit, PageView, SharedBand, type PageAct } from "@/features/F9/knowledge/page-views";
import {
  APPROVALS,
  BROKEN,
  CONFLICTS,
  EXPENSE,
  EXPENSE_DOC,
  INVOICE,
  INVOICE_DOC,
  MY_DISCOUNT,
  MY_DISCOUNT_DOC,
  MY_DISCOUNT_DRAFT_DOC,
  PLACE,
  QUOTE,
  QUOTE_DOC,
  UNUSED,
  treeFor,
} from "@/features/F9/knowledge/samples";
import type { Theme } from "@/lib/theme";
import { KnowledgeFrame } from "./frame";

// 管理の入口に出す数（管理者の高本・営業のマネージャーの佐藤）
export const ADMIN_TAKA = { approvals: 1, review: UNUSED.length + CONFLICTS.length + BROKEN.length };
export const ADMIN_SATO = { approvals: APPROVALS.length, review: 3 };

const noop = (): void => undefined;
const ACTS_ADMIN: readonly PageAct[] = ["must-on", "edit"];
const ACTS_MINE: readonly PageAct[] = ["must-off", "raise", "edit"];

function invoice(theme: Theme, extra: { drawer?: boolean } = {}): ReactNode {
  return (
    <KnowledgeFrame
      theme={theme}
      viewer="taka"
      path={["会社", "経理", INVOICE.title]}
      tree={{ data: treeFor("taka"), current: "p-invoice", admin: ADMIN_TAKA, drawerOpen: Boolean(extra.drawer) }}
    >
      <PageView
        place={PLACE.invoice}
        title={INVOICE.title}
        desc={INVOICE.desc}
        acts={ACTS_ADMIN}
        must
        foot={INVOICE.foot}
        doc={INVOICE_DOC}
      />
    </KnowledgeFrame>
  );
}

export function expense(theme: Theme, o: { must: boolean; dialog?: ReactNode }): ReactNode {
  return (
    <KnowledgeFrame
      theme={theme}
      viewer="taka"
      path={["会社", "経理", EXPENSE.title]}
      tree={{ data: treeFor("taka", o.must ? { must: ["p-expense"] } : {}), current: "p-expense", admin: ADMIN_TAKA }}
      dialog={o.dialog}
    >
      <PageView
        place={PLACE.expense}
        title={EXPENSE.title}
        desc={EXPENSE.desc}
        acts={o.must ? ACTS_ADMIN : ["must-off", "edit"]}
        must={o.must}
        foot={EXPENSE.foot}
        doc={EXPENSE_DOC}
      />
    </KnowledgeFrame>
  );
}

/** 鈴木さんの自分の棚のページ（上の棚に上げる 3 つの状態） */
export function myDiscount(
  theme: Theme,
  o: { mark?: "waiting" | "declined"; bands?: ReactNode; dialog?: ReactNode },
): ReactNode {
  return (
    <KnowledgeFrame
      theme={theme}
      viewer="suzu"
      path={["自分", MY_DISCOUNT.title]}
      tree={{ data: treeFor("suzu", o.mark ? { marks: { "p-my-discount": o.mark } } : {}), current: "p-my-discount" }}
      dialog={o.dialog}
    >
      <PageView
        place={PLACE.mine}
        title={MY_DISCOUNT.title}
        desc={MY_DISCOUNT.desc}
        acts={o.mark === "waiting" ? ["must-off", "edit"] : ACTS_MINE}
        bands={o.bands}
        foot={MY_DISCOUNT.foot}
        doc={MY_DISCOUNT_DOC}
      />
    </KnowledgeFrame>
  );
}

export function quote(theme: Theme, viewer: "sato" | "tana", dialog?: ReactNode): ReactNode {
  const shared = viewer === "tana";
  return (
    <KnowledgeFrame
      theme={theme}
      viewer={viewer}
      path={["グループ", "営業", "見積もり", QUOTE.title]}
      tree={{ data: treeFor(viewer), current: "p-quote", ...(shared ? {} : { admin: ADMIN_SATO }) }}
      dialog={dialog}
    >
      <PageView
        place={PLACE.quote}
        title={QUOTE.title}
        desc={QUOTE.desc}
        acts={shared ? ["copy"] : ["must-off", "raise", "share", "edit"]}
        bands={shared ? <SharedBand from="営業" writer="営業のマネージャー（佐藤 花子さん）" /> : undefined}
        foot={QUOTE.foot}
        doc={QUOTE_DOC}
      />
    </KnowledgeFrame>
  );
}

export function writing(
  theme: Theme,
  o: { title: string; desc: string; fresh?: boolean; dialog?: ReactNode },
): ReactNode {
  return (
    <KnowledgeFrame
      theme={theme}
      viewer="suzu"
      path={["自分", o.title]}
      tree={
        o.fresh
          ? { data: treeFor("suzu", { myExtra: { id: "p-new", title: o.title } }), current: "p-new" }
          : { data: treeFor("suzu"), current: "p-my-discount" }
      }
      dialog={o.dialog}
    >
      <PageEdit
        place={PLACE.mine}
        title={o.title}
        desc={o.desc}
        saved="自動で保存しました（10:42）"
        doc={MY_DISCOUNT_DRAFT_DOC}
      />
    </KnowledgeFrame>
  );
}

/** 本文の場所に、空・読み込み・失敗・見られない を出す */
function stateOnly(theme: Theme, kind: "empty" | "loading" | "failed" | "noaccess"): ReactNode {
  const viewer = kind === "noaccess" ? "suzu" : "taka";
  return (
    <KnowledgeFrame
      theme={theme}
      viewer={viewer}
      path={kind === "empty" ? [] : kind === "noaccess" ? ["グループ", "受託開発"] : ["会社", "経理"]}
      tree={{
        data: treeFor(viewer, kind === "empty" ? { empty: true } : {}),
        state: kind === "loading" ? "loading" : "ready",
        ...(viewer === "taka" && kind !== "loading" ? { admin: { approvals: 0, review: 0 } } : {}),
      }}
    >
      {kind === "empty" ? (
        <Empty
          title="まだページがありません"
          icon={<BookOpen size={28} />}
          action={<Button>最初のページを書く</Button>}
        >
          会社のやり方・気をつけることを、ページに書いて貯めます。AI がチケットを進めるときに読んで、守ります。
        </Empty>
      ) : (
        <div className="k-f9-card">
          {kind === "loading" ? (
            <Loading delayMs={0} />
          ) : kind === "failed" ? (
            <ErrorState code={PAGE_ERROR.loadFailed} acts={[noop]} />
          ) : (
            <NoAccess acts={[noop, noop]} />
          )}
        </div>
      )}
    </KnowledgeFrame>
  );
}

/** K-670 が描く 8 つの状態。持っていない id は null */
export function renderKnowledge(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "kn-tree":
      return invoice(theme);
    case "kn-drawer":
      return invoice(theme, { drawer: true });
    case "kn-write":
      return writing(theme, { title: MY_DISCOUNT.title, desc: MY_DISCOUNT.desc });
    case "kn-must":
      return expense(theme, { must: true });
    case "kn-empty":
      return stateOnly(theme, "empty");
    case "kn-loading":
      return stateOnly(theme, "loading");
    case "kn-failed":
      return stateOnly(theme, "failed");
    case "kn-noaccess":
      return stateOnly(theme, "noaccess");
    default:
      return null;
  }
}
