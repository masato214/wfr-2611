// K-682 ナレッジの口の答え（getKnowledgeTree・getKnowledgePage）を、部品（tree.tsx・page-views.tsx）の値に直す。
//   画面の外の純粋な関数だけ（@/ を読まない・元の値を変えない）。答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章
import type { PageAct, PageMark, PagePlace, ShelfKind, TreeData, TreeGroup, TreeNode } from "./types";

// ---------------------------------------------------------------- 口の答えの形
export interface TreeNodeAnswer {
  kind: "page" | "folder";
  id: string;
  title?: string;
  name?: string;
  must?: boolean;
  mark?: PageMark | null;
  children?: readonly TreeNodeAnswer[];
}
export interface TreeGroupAnswer {
  id: string;
  name: string;
  /** 札の字（チケットの番号の頭）。無ければ名前の頭 1 字 */
  code: string | null;
  tone: string;
  shared: boolean;
  nodes: readonly TreeNodeAnswer[];
}
export interface TreeAnswer {
  company_name: string;
  company_nodes: readonly TreeNodeAnswer[];
  groups: readonly TreeGroupAnswer[];
  my_nodes: readonly TreeNodeAnswer[];
  can_write: { company: boolean; group_ids: readonly string[]; me: boolean };
  admin_counts: { approvals: number; review: number } | null;
  truncated: boolean;
}
export interface FootAnswer {
  last_editor_name: string | null;
  last_edited_at: string;
  version: number;
  ai_opened_30d: number;
}
export interface RequestAnswer {
  id: string;
  kind: string;
  state: "waiting" | "declined" | string;
  to_name: string;
  who_name: string;
  at: string;
  reason: string | null;
  can_withdraw: boolean;
}
export interface CopiedFromAnswer {
  /** 元が消えた・見えないときは null（gone） */
  page_id: string | null;
  title: string;
  shelf_name: string;
  must: boolean;
  gone: boolean;
}
export interface SharedFromAnswer {
  group_name: string;
  writable: boolean;
  manager_names?: readonly string[];
}
export interface PageAnswer {
  id: string;
  title: string;
  desc: string;
  state: "draft" | "published" | string;
  must: boolean;
  must_blocked?: string | null;
  place: {
    shelf: ShelfKind;
    shelf_name: string;
    group_id: string | null;
    folder_id: string | null;
    folders: readonly string[];
  };
  acts: readonly string[];
  body: { doc: unknown; text?: string } | null;
  draft: { doc: unknown; saved_at: string; title?: string; desc?: string } | null;
  request: RequestAnswer | null;
  copied_from: CopiedFromAnswer | null;
  shared_from: SharedFromAnswer | null;
  raise_to?: unknown;
  foot: FootAnswer;
}

// ---------------------------------------------------------------- 木
const TONES: readonly TreeGroup["tone"][] = ["teal", "plum", "amber"];
const toneOf = (t: string): TreeGroup["tone"] =>
  (TONES as readonly string[]).includes(t) ? (t as TreeGroup["tone"]) : "teal";

function nodesOf(nodes: readonly TreeNodeAnswer[], open: ReadonlySet<string>): TreeNode[] {
  return nodes.map((n): TreeNode =>
    n.kind === "folder"
      ? {
          kind: "folder",
          id: n.id,
          name: n.name ?? "",
          open: open.has(n.id),
          children: nodesOf(n.children ?? [], open),
        }
      : {
          kind: "page",
          id: n.id,
          title: n.title ?? "",
          ...(n.must ? { must: true } : {}),
          ...(n.mark ? { mark: n.mark } : {}),
        },
  );
}

/** 木の答え → 部品の TreeData。フォルダの開き閉じは渡した集合で決める（並びは答えのまま） */
export function shapeTree(answer: TreeAnswer, open: ReadonlySet<string>): TreeData {
  return {
    company: answer.company_name,
    companyNodes: nodesOf(answer.company_nodes, open),
    groups: answer.groups.map((g) => ({
      id: g.id,
      code: g.code || g.name.slice(0, 1),
      name: g.name,
      tone: toneOf(g.tone),
      ...(g.shared ? { shared: true } : {}),
      nodes: nodesOf(g.nodes, open),
    })),
    myNodes: nodesOf(answer.my_nodes, open),
    canWrite: { company: answer.can_write.company, group: [...answer.can_write.group_ids], me: answer.can_write.me },
  };
}

/** 木に 1 枚もページが無い（会社・グループ・自分のどれにも） */
export function isTreeEmpty(answer: TreeAnswer): boolean {
  const hasPage = (ns: readonly TreeNodeAnswer[]): boolean =>
    ns.some((n) => n.kind === "page" || hasPage(n.children ?? []));
  return !hasPage(answer.company_nodes) && !answer.groups.some((g) => hasPage(g.nodes)) && !hasPage(answer.my_nodes);
}

function pathIn(nodes: readonly TreeNodeAnswer[], pageId: string): string[] | null {
  for (const n of nodes) {
    if (n.kind === "page") {
      if (n.id === pageId) return [];
      continue;
    }
    const under = pathIn(n.children ?? [], pageId);
    if (under) return [n.id, ...under];
  }
  return null;
}

/** 開いているページの親フォルダの id（棚の直下から）。木に無いページは空 */
export function openPathOf(answer: TreeAnswer, pageId: string | undefined): string[] {
  if (!pageId) return [];
  for (const shelf of [answer.company_nodes, ...answer.groups.map((g) => g.nodes), answer.my_nodes]) {
    const hit = pathIn(shelf, pageId);
    if (hit) return hit;
  }
  return [];
}

// ---------------------------------------------------------------- ページ
const JST = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
/** 日本時間の「月/日」 */
const monthDay = (iso: string): string => {
  const parts = JST.formatToParts(new Date(iso));
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${m}/${d}`;
};

/** 足元の 1 行 */
export function footLine(foot: FootAnswer): string {
  const who = foot.last_editor_name?.trim() || "—";
  return `最後に直した：${who} ${monthDay(foot.last_edited_at)} ・ 版 ${foot.version} ・ AI がこの 30 日に開いた：${foot.ai_opened_30d} 回`;
}

/** ページの置き場（部品の PagePlace） */
export function placeOf(page: PageAnswer): PagePlace {
  return { shelf: page.place.shelf, shelfName: page.place.shelf_name, folders: [...page.place.folders] };
}

/** 上の帯のいまの場所（ナレッジ › 棚 › フォルダ › 題名 の「ナレッジ」より後ろ） */
export function crumbsOf(page: PageAnswer | undefined): string[] {
  if (!page) return [];
  return [page.place.shelf_name, ...page.place.folders, page.title];
}

export type BandKind = "waiting" | "declined" | "copy" | "shared";
/** 題名の下に出す帯の種類（答えの request・copied_from・shared_from から） */
export function bandsOf(page: PageAnswer): BandKind[] {
  const out: BandKind[] = [];
  if (page.request?.state === "waiting") out.push("waiting");
  if (page.request?.state === "declined") out.push("declined");
  if (page.copied_from) out.push("copy");
  if (page.shared_from) out.push("shared");
  return out;
}

const PAGE_ACTS: readonly string[] = ["must-on", "must-off", "raise", "share", "copy", "edit"];
/** must は K-691 の must-shape.ts が同じ形で受ける（今は読まない）。口の must-on（付けられる）・must-off（外せる）は、部品の押し込みの読み（must-on＝押し込んだ形）と逆なので入れ替える。
 *  ほかの操作と並びは変えない・元の配列を変えない。知らない操作は落とす */
export function partActsOf(acts: readonly string[], must: boolean): PageAct[] {
  void must; // いまの印は読まない（同じ形を K-691 が受ける）
  return acts
    .filter((a) => PAGE_ACTS.includes(a))
    .map((a) => (a === "must-on" ? "must-off" : a === "must-off" ? "must-on" : a) as PageAct);
}

/** ページの id が替わったら書いている印を戻す（同じページのままなら持ち越し） */
export function editingAfterNavigation(
  prevId: string | undefined,
  nextId: string | undefined,
  editing: boolean,
): boolean {
  if (!editing) return false;
  return prevId !== undefined && prevId === nextId;
}

/** 共有された側の帯の「直せるのは …」 */
export function writerOf(shared: SharedFromAnswer): string {
  const names = (shared.manager_names ?? []).filter(Boolean);
  return names.length
    ? `${shared.group_name}のマネージャー（${names.map((n) => `${n}さん`).join("・")}）`
    : `${shared.group_name}のマネージャー`;
}
