"use client";
// K-682 ナレッジの画面の入れ物（/knowledge・/knowledge/<ページの id>）。外枠は TicketShell（screen="knowledge"）。
//   木とページを口から読み（use-knowledge.ts）、答えを部品の値に直して（shape.ts）、K-670 の部品に渡す。
//   操作の動きは後ろの葉が page-slots.ts の PAGE_SLOTS に 1 行ずつ足す。動きの無い操作は押せない形で出す
import { BookOpen } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { Doc } from "@kaname/contracts";
import { Button, Empty, Loading, PAGE_ERROR, Toaster, errorText, useNotify } from "@/components/k";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { useMyRoles } from "@/lib/auth/role";
import { NAV } from "@/lib/nav";
import { KnowledgeLayout } from "./knowledge-layout";
import { CopyBand, DeclinedBand, PageView, SharedBand, WaitingBand, type BandHandlers } from "./page-views";
import { MUST_BLOCKED_TOO_LONG } from "./must-shape";
import { PAGE_SLOTS, mergeSlots, type MergedSlots, type PageCtx } from "./page-slots";
import {
  bandsOf,
  crumbsOf,
  editingAfterNavigation,
  footLine,
  isTreeEmpty,
  openPathOf,
  partActsOf,
  placeOf,
  shapeTree,
  writerOf,
  type PageAnswer,
} from "./shape";
import type { KnowledgeTreeProps } from "./tree";
import type { MoreItem, PageAct, TreeData } from "./types";
import { useKnowledgePage, useKnowledgeTree, useReloadKnowledge, type KnowledgeLoadError } from "./use-knowledge";
import { WritingSlot } from "./writing-slot";

const EMPTY_TREE: TreeData = {
  company: "",
  companyNodes: [],
  groups: [],
  myNodes: [],
  canWrite: { company: false, group: [], me: false },
};
const hrefOf = (id: string): string => `/knowledge/${encodeURIComponent(id)}`;

// ---------------------------------------------------------------- 状態の箱
/** 読めなかった旨と「もう一度読む」（正本の 1 件の文・下絵の ErrorState と同じ形。一手の読み上げは「もう一度読む」） */
function LoadFailed({ code, onRetry }: { code: string; onRetry: () => void }) {
  const t = errorText(code);
  const danger = t.entry.severity === "critical" || t.entry.cls === "permission";
  return (
    <section
      className="k-state"
      data-state="error"
      data-code={code}
      role={danger ? "alert" : undefined}
      aria-labelledby={`k-err-${code}`}
    >
      <h2 id={`k-err-${code}`} className="k-state-title">
        {t.title}
      </h2>
      {t.body ? <p className="k-state-body">{t.body}</p> : null}
      <div className="k-state-actions">
        <Button variant="primary" onClick={onRetry} aria-label="もう一度読む">
          {t.actions[0] ?? "もう一度"}
        </Button>
      </div>
      <p className="k-state-code">番号：{t.entry.support_code}</p>
    </section>
  );
}

/** 見られないページ（正本 E-PAGE-002・下絵 kn-noaccess と同じ形。どれかを知らせない）。一手は 2 つ（代表の答え answer=21b765e5e0c8）：
 *  「マネージャーに頼む」は頼む口がまだ無いので押せない形・「戻る」は /knowledge へ */
function PageNoAccess({ onBack }: { onBack: () => void }) {
  const code = PAGE_ERROR.forbidden;
  const t = errorText(code);
  return (
    <section className="k-state" data-state="error" data-code={code} role="alert" aria-labelledby={`k-err-${code}`}>
      <h2 id={`k-err-${code}`} className="k-state-title">
        {t.title}
      </h2>
      {t.body ? <p className="k-state-body">{t.body}</p> : null}
      <div className="k-state-actions">
        <Button variant="primary" aria-disabled>
          {t.actions[0]}
        </Button>
        <Button variant="outlined" onClick={onBack}>
          {t.actions[1]}
        </Button>
      </div>
      <p className="k-state-code">番号：{t.entry.support_code}</p>
    </section>
  );
}

/** 役が合わない人（画面の導出 §6：無言の空画面にしない） */
function Forbidden() {
  return (
    <section className="k-state" data-state="forbidden" aria-labelledby="kn-forbidden">
      <h2 id="kn-forbidden" className="k-state-title">
        いまの権限では開けません
      </h2>
      <p className="k-state-body">この画面は「{NAV.screens.knowledge.name}」です。見える画面へ戻ります。</p>
      <div className="k-state-actions">
        <a className="k-btn" data-variant="primary" data-size="md" href="/tickets">
          見える画面へ
        </a>
      </div>
    </section>
  );
}

const Card = ({ children }: { children: ReactNode }) => <article className="k-f9-card">{children}</article>;

// ---------------------------------------------------------------- 帯
function Bands({ page, merged }: { page: PageAnswer; merged: MergedSlots }): ReactNode {
  const kinds = bandsOf(page);
  if (!kinds.length) return undefined;
  const b = merged.bands;
  const req = page.request;
  const h = (extra: Omit<BandHandlers, "live">): BandHandlers => ({ live: true, ...extra });
  return (
    <>
      {kinds.includes("waiting") && req ? (
        <WaitingBand
          to={req.to_name}
          who={req.who_name}
          at={req.at}
          handlers={h({ withdraw: b.withdraw && req.can_withdraw ? () => b.withdraw?.(req.id) : undefined })}
        />
      ) : null}
      {kinds.includes("declined") && req ? (
        <DeclinedBand
          to={req.to_name}
          who={req.who_name}
          at={req.at}
          reason={req.reason ?? ""}
          handlers={h({ dismiss: b.dismiss ? () => b.dismiss?.(req.id) : undefined, redo: b.redo })}
        />
      ) : null}
      {kinds.includes("copy") && page.copied_from ? (
        <CopyBand
          from={page.copied_from.shelf_name}
          must={page.copied_from.must}
          handlers={h({
            openOriginal:
              b.openOriginal && !page.copied_from.gone && page.copied_from.page_id
                ? () => b.openOriginal?.(page.copied_from?.page_id ?? "")
                : undefined,
          })}
        />
      ) : null}
      {kinds.includes("shared") && page.shared_from ? (
        <SharedBand from={page.shared_from.group_name} writer={writerOf(page.shared_from)} />
      ) : null}
    </>
  );
}

/** 帯の操作の動き（口の must-on＝付けられる ⇔ 部品の must-on＝押し込んだ形 を入れ替える） */
function partHandlers(merged: MergedSlots) {
  const acts: Partial<Record<PageAct, () => void>> = {};
  for (const [k, fn] of Object.entries(merged.acts) as [PageAct, () => void][]) {
    const key: PageAct = k === "must-on" ? "must-off" : k === "must-off" ? "must-on" : k;
    acts[key] = fn;
  }
  const more: Partial<Record<MoreItem, () => void>> = { ...merged.more };
  return { acts, more };
}

// ---------------------------------------------------------------- 入れ物
export function KnowledgePage({ pageId }: { pageId?: string }) {
  const { roles } = useMyRoles();
  const allowed = roles === undefined ? undefined : roles.some((r) => NAV.screens.knowledge.roles.includes(r));
  const page = useKnowledgePage(pageId, allowed === true);
  const crumbs = [
    { label: "ナレッジ", href: "/knowledge" },
    ...crumbsOf(pageId ? page.data : undefined).map((label) => ({ label })),
  ];
  return (
    <Toaster>
      <TicketShell screen="knowledge" crumbs={crumbs}>
        {allowed === false ? <Forbidden /> : <KnowledgeBody pageId={pageId} ready={allowed === true} />}
      </TicketShell>
    </Toaster>
  );
}

function KnowledgeBody({ pageId, ready }: { pageId: string | undefined; ready: boolean }) {
  const router = useRouter();
  const notify = useNotify();
  const tree = useKnowledgeTree(ready);
  const page = useKnowledgePage(pageId, ready);
  const reload = useReloadKnowledge(pageId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditingRaw] = useState(false);
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(new Set());
  const seededFor = useRef<string | null>(null);
  const [prevPage, setPrevPage] = useState(pageId);

  // ページの id が替わったら書いている印を戻す（/knowledge/a と /knowledge/b は同じ入れ物で作り直されないため）
  if (prevPage !== pageId) {
    setPrevPage(pageId);
    setEditingRaw(editingAfterNavigation(prevPage, pageId, editing));
  }

  // 初めから開くフォルダ：開いているページの親（木が届いた時・ページを替えた時に足す。閉じた物は戻さない）
  useEffect(() => {
    if (!tree.data || seededFor.current === (pageId ?? "")) return;
    seededFor.current = pageId ?? "";
    const path = openPathOf(tree.data, pageId);
    if (path.length) setOpenFolders((cur) => new Set([...cur, ...path]));
  }, [tree.data, pageId]);

  // 引き出しは Esc で閉じる
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const go = (href: string) => router.push(href as Route);
  const ctx: PageCtx = {
    page: page.data,
    tree: tree.data,
    go,
    reload,
    setEditing: setEditingRaw,
    notify: (text) => notify(text),
  };
  // 後ろの葉の差し込み（hook として毎回同じ順で呼ぶ・ページが無い間も呼ぶ）
  const slots = PAGE_SLOTS.map((use) => use(ctx));
  const merged = mergeSlots(slots);

  const treeProps: KnowledgeTreeProps = {
    data: tree.data ? shapeTree(tree.data, openFolders) : EMPTY_TREE,
    current: pageId,
    ...(tree.data?.admin_counts ? { admin: tree.data.admin_counts } : {}),
    drawerOpen,
    state: tree.data ? "ready" : "loading",
    truncated: Boolean(tree.data?.truncated),
    onCloseDrawer: () => setDrawerOpen(false),
    acts: {
      hrefOf,
      onOpenPage: (id) => {
        setDrawerOpen(false);
        router.push(hrefOf(id) as Route);
      },
      onToggleFolder: (id) =>
        setOpenFolders((cur) => {
          const next = new Set(cur);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      ...(merged.add ? { onAdd: merged.add } : { inertAdd: true }),
    },
  };

  const place = page.data ? [page.data.place.shelf_name, ...page.data.place.folders].join(" › ") : "ナレッジ";
  const retryTree = () => reload({ tree: true });

  if (tree.isError) {
    return (
      <KnowledgeLayout tree={null} place={place}>
        <Card>
          <LoadFailed code={tree.error.code} onRetry={retryTree} />
        </Card>
      </KnowledgeLayout>
    );
  }

  return (
    <>
      <KnowledgeLayout tree={treeProps} place={place} onOpenDrawer={() => setDrawerOpen(true)}>
        <Main
          pageId={pageId}
          tree={tree.data}
          page={page}
          merged={merged}
          editing={editing}
          setEditing={setEditingRaw}
          onBack={() => go("/knowledge")}
          onRetryPage={() => reload({ page: true })}
        />
      </KnowledgeLayout>
      {merged.overlays.map((o, i) => (
        <Fragment key={i}>{o}</Fragment>
      ))}
    </>
  );
}

interface MainProps {
  pageId: string | undefined;
  tree: ReturnType<typeof useKnowledgeTree>["data"];
  page: { data?: PageAnswer | undefined; isError: boolean; error: KnowledgeLoadError | null };
  merged: MergedSlots;
  editing: boolean;
  setEditing: (on: boolean) => void;
  onBack: () => void;
  onRetryPage: () => void;
}

function Main({ pageId, tree, page, merged, editing, setEditing, onBack, onRetryPage }: MainProps): ReactNode {
  if (!pageId) {
    if (!tree)
      return (
        <Card>
          <Loading delayMs={0} />
        </Card>
      );
    if (isTreeEmpty(tree)) {
      const add = merged.add;
      return (
        <Empty
          title="まだページがありません"
          icon={<BookOpen size={28} />}
          action={
            <Button {...(add ? { onClick: () => add({ shelf: "me" }) } : { "aria-disabled": true })}>
              最初のページを書く
            </Button>
          }
        >
          会社のやり方・気をつけることを、ページに書いて貯めます。AI がチケットを進めるときに読んで、守ります。
        </Empty>
      );
    }
    return <Empty title="左の木からページを選んでください" />;
  }
  if (page.isError && page.error) {
    if (page.error.noAccess) {
      return (
        <Card>
          <PageNoAccess onBack={onBack} />
        </Card>
      );
    }
    return (
      <Card>
        <LoadFailed code={page.error.code} onRetry={onRetryPage} />
      </Card>
    );
  }
  if (!page.data)
    return (
      <Card>
        <Loading delayMs={0} />
      </Card>
    );
  const p = page.data;
  const acts = partActsOf(p.acts, p.must);
  const handlers = partHandlers(merged);
  return (
    <WritingSlot page={p} editing={editing} setEditing={setEditing}>
      <PageView
        place={placeOf(p)}
        title={p.title}
        desc={p.desc}
        acts={acts}
        must={p.must}
        bands={bandsOf(p).length ? <Bands page={p} merged={merged} /> : undefined}
        foot={footLine(p.foot)}
        doc={(p.body?.doc ?? { type: "doc", content: [] }) as Doc}
        handlers={handlers}
        mustBlocked={p.must_blocked === "too_long" ? MUST_BLOCKED_TOO_LONG : undefined}
      />
    </WritingSlot>
  );
}
