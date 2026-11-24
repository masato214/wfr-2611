"use client";
// ナレッジの左の木（IDE の左と同じ形）。棚は 3 つ：会社／グループ／自分。棚の下はフォルダとページ。
//   見た目だけ（値は props・口は呼ばない）。幅 1023 以下では引き出しになる（knowledge.css）
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  Menu as MenuIcon,
  Plus,
  ShieldCheck,
  Undo2,
  User,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/k";
import type { AdminCounts, TreeData, TreeGroup, TreeNode, TreePage } from "./types";
import "./knowledge.css";

/** 木の字下げの深さ（CSS は data-depth の 0〜3 の段で字下げする。4 段より深い所は 3 と同じ） */
const MAX_DEPTH = 3;
const depthAttr = (depth: number): { "data-depth": number } => ({ "data-depth": Math.min(depth, MAX_DEPTH) });

function PageMarks({ p }: { p: TreePage }) {
  return (
    <span className="k-f9-marks">
      {p.must ? (
        <span className="k-f9-mark" data-mark="must" title="必ず守る" aria-label="必ず守る">
          <ShieldCheck size={14} aria-hidden="true" />
        </span>
      ) : null}
      {p.mark === "waiting" ? (
        <span className="k-f9-mark" data-mark="waiting" title="承認待ち" aria-label="承認待ち">
          <Clock size={14} aria-hidden="true" />
        </span>
      ) : null}
      {p.mark === "declined" ? (
        <span className="k-f9-mark" data-mark="declined" title="断られた" aria-label="断られた">
          <Undo2 size={14} aria-hidden="true" />
        </span>
      ) : null}
      {p.mark === "copy" ? (
        <span className="k-f9-mark" data-mark="copy" title="写し" aria-label="写し">
          <Copy size={14} aria-hidden="true" />
        </span>
      ) : null}
    </span>
  );
}

function Nodes({ nodes, depth, current }: { nodes: readonly TreeNode[]; depth: number; current?: string | undefined }) {
  return (
    <ul className="k-f9-nodes" role="group">
      {nodes.map((n) =>
        n.kind === "folder" ? (
          <li key={n.id} role="treeitem" aria-expanded={Boolean(n.open)}>
            <button type="button" className="k-f9-node" {...depthAttr(depth)}>
              {n.open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
              {n.open ? <FolderOpen size={15} aria-hidden="true" /> : <Folder size={15} aria-hidden="true" />}
              <span className="k-f9-node-t">{n.name}</span>
            </button>
            {n.open ? <Nodes nodes={n.children} depth={depth + 1} current={current} /> : null}
          </li>
        ) : (
          <li key={n.id} role="treeitem">
            <a
              className="k-f9-node"
              data-page
              href={`#${n.id}`}
              {...depthAttr(depth)}
              aria-current={n.id === current ? "page" : undefined}
            >
              <FileText size={15} aria-hidden="true" />
              <span className="k-f9-node-t">{n.title}</span>
              <PageMarks p={n} />
            </a>
          </li>
        ),
      )}
    </ul>
  );
}

function ShelfHead({ icon, name, sub, canAdd }: { icon: ReactNode; name: string; sub?: string; canAdd: boolean }) {
  return (
    <div className="k-f9-shelf-h">
      <span className="k-f9-shelf-ic" aria-hidden="true">
        {icon}
      </span>
      <h2>{name}</h2>
      {sub ? <span className="k-f9-shelf-sub">{sub}</span> : null}
      {canAdd ? (
        <button
          type="button"
          className="k-f9-add"
          aria-label={`${name}の棚にページかフォルダを足す`}
          title="ページ・フォルダを足す"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function GroupBlock({ d, current, canAdd }: { d: TreeGroup; current?: string | undefined; canAdd: boolean }) {
  return (
    <li role="treeitem" aria-expanded="true">
      <div className="k-f9-group" {...depthAttr(0)}>
        <ChevronDown size={14} aria-hidden="true" />
        <span className="k-f9-code" data-tone={d.tone} aria-hidden="true">
          {d.code}
        </span>
        <span className="k-f9-node-t">{d.name}</span>
        {d.shared ? <span className="k-f9-shared">共有</span> : null}
        {canAdd ? (
          <button
            type="button"
            className="k-f9-add"
            aria-label={`${d.name}の棚にページかフォルダを足す`}
            title="ページ・フォルダを足す"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <Nodes nodes={d.nodes} depth={1} current={current} />
    </li>
  );
}

export interface KnowledgeTreeProps {
  data: TreeData;
  /** いま開いているページ */
  current?: string | undefined;
  /** 管理の入口（管理者・マネージャーだけ）。無ければ切り替えを出さない */
  admin?: AdminCounts | undefined;
  /** いまの面：pages＝木／admin＝管理 */
  view?: "pages" | "admin";
  /** 管理の面でいま選んでいる一覧 */
  adminList?: "approvals" | "review";
  /** 幅 1023 以下で、引き出しを開いた形にする */
  drawerOpen?: boolean;
  /** まだ読めていない（読み込み中）・1 枚も無い */
  state?: "ready" | "loading";
}

function ViewSwitch({ view, admin }: { view: "pages" | "admin"; admin: AdminCounts }) {
  const n = admin.approvals + admin.review;
  return (
    <div className="k-f9-switch" role="tablist" aria-label="ナレッジの面">
      <button type="button" role="tab" aria-selected={view === "pages"}>
        ページ
      </button>
      <button type="button" role="tab" aria-selected={view === "admin"}>
        管理
        {n ? <span className="k-f9-count">{n}</span> : null}
      </button>
    </div>
  );
}

function AdminNav({ admin, active }: { admin: AdminCounts; active: "approvals" | "review" }) {
  const items: readonly { key: "approvals" | "review"; label: string; n: number; desc: string }[] = [
    { key: "approvals", label: "承認待ち", n: admin.approvals, desc: "上の棚に上げる・共有の頼み" },
    { key: "review", label: "見直すページ", n: admin.review, desc: "使われていない・食い違い・よく破られる" },
  ];
  return (
    <ul className="k-f9-adminnav">
      {items.map((it) => (
        <li key={it.key}>
          <a href={`#${it.key}`} className="k-f9-adminnav-i" aria-current={it.key === active ? "page" : undefined}>
            <span className="k-f9-adminnav-t">
              {it.label}
              {it.n ? <span className="k-f9-count">{it.n}</span> : null}
            </span>
            <span className="k-f9-adminnav-d">{it.desc}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Legend() {
  return (
    <p className="k-f9-legend">
      <span>
        <ShieldCheck size={12} aria-hidden="true" /> 必ず守る
      </span>
      <span>
        <Clock size={12} aria-hidden="true" /> 承認待ち
      </span>
      <span>
        <Copy size={12} aria-hidden="true" /> 写し
      </span>
    </p>
  );
}

/** 左の木。view が admin のときは、木の代わりに管理の一覧の入口を出す */
export function KnowledgeTree({
  data,
  current,
  admin,
  view = "pages",
  adminList = "approvals",
  drawerOpen = false,
  state = "ready",
}: KnowledgeTreeProps) {
  return (
    <>
      {drawerOpen ? <div className="k-f9-scrim" aria-hidden="true" /> : null}
      <aside className="k-f9-tree" aria-label="ナレッジの木" data-open={drawerOpen || undefined}>
        <div className="k-f9-tree-head">
          <b>ナレッジ</b>
          <button type="button" className="k-f9-drawer-close" aria-label="木を閉じる">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {admin ? <ViewSwitch view={view} admin={admin} /> : null}
        {view === "admin" && admin ? (
          <AdminNav admin={admin} active={adminList} />
        ) : state === "loading" ? (
          <div className="k-f9-tree-skel" role="status" aria-label="木を読み込んでいます">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : (
          <nav aria-label="棚とページ" className="k-f9-shelves">
            <section className="k-f9-shelf" aria-label="会社の棚">
              <ShelfHead icon={<Building2 size={14} />} name="会社" sub={data.company} canAdd={data.canWrite.company} />
              {data.companyNodes.length ? (
                <div role="tree" aria-label="会社のページ">
                  <Nodes nodes={data.companyNodes} depth={0} current={current} />
                </div>
              ) : (
                <p className="k-f9-none">まだありません</p>
              )}
            </section>
            <section className="k-f9-shelf" aria-label="グループの棚">
              <ShelfHead icon={<Users size={14} />} name="グループ" canAdd={false} />
              <ul className="k-f9-nodes" role="tree" aria-label="グループのページ">
                {data.groups.map((d) => (
                  <GroupBlock key={d.code} d={d} current={current} canAdd={data.canWrite.group.includes(d.code)} />
                ))}
              </ul>
            </section>
            <section className="k-f9-shelf" aria-label="自分の棚">
              <ShelfHead icon={<User size={14} />} name="自分" sub="自分だけが読める" canAdd={data.canWrite.me} />
              {data.myNodes.length ? (
                <div role="tree" aria-label="自分のページ">
                  <Nodes nodes={data.myNodes} depth={0} current={current} />
                </div>
              ) : (
                <p className="k-f9-none">まだありません</p>
              )}
            </section>
          </nav>
        )}
        {view === "pages" && state === "ready" ? <Legend /> : null}
      </aside>
    </>
  );
}

/** 幅 1023 以下で本文の上に出る帯（木を開くボタンと、いまの場所） */
export function TreeBar({ place }: { place: string }) {
  return (
    <div className="k-f9-mbar">
      <Button variant="outlined" size="sm" icon={<MenuIcon size={14} aria-hidden="true" />}>
        木を開く
      </Button>
      <span className="k-f9-mbar-place">{place}</span>
    </div>
  );
}
