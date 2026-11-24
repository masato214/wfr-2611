// ナレッジ（段 10・作り直し 2026-11-21）の下絵の型。木は 1 つ・入れる形も 1 つ（自由なページ）。
//   棚は 3 つ：会社／グループ／自分。棚の下はフォルダとページ

export type ShelfKind = "company" | "group" | "me";

/** 木の行に出す印（必ず守る・承認待ち・断られた・写し） */
export type PageMark = "waiting" | "declined" | "copy";

export interface TreePage {
  kind: "page";
  id: string;
  title: string;
  /** 「必ず守る」の印（毎回全部 AI に渡る） */
  must?: boolean;
  mark?: PageMark;
}
export interface TreeFolder {
  kind: "folder";
  id: string;
  name: string;
  open?: boolean;
  children: readonly TreeNode[];
}
export type TreeNode = TreePage | TreeFolder;

/** グループの棚の中の 1 つのグループ（自分の入っているグループか、共有されたグループ） */
export interface TreeGroup {
  code: string;
  name: string;
  tone: "teal" | "plum" | "amber";
  /** ほかのグループから共有された物だけが出ている */
  shared?: boolean;
  nodes: readonly TreeNode[];
}

export interface TreeData {
  /** 会社の名前（複数の会社に入っている人は、会社を切り替えると木ごと替わる） */
  company: string;
  companyNodes: readonly TreeNode[];
  groups: readonly TreeGroup[];
  myNodes: readonly TreeNode[];
  /** 書ける棚（＋ を出す） */
  canWrite: { company: boolean; group: readonly string[]; me: boolean };
}

/** 管理の入口に出す数（管理者・マネージャーだけ） */
export interface AdminCounts {
  approvals: number;
  review: number;
}

/** ページの置き場（どの棚の・どのフォルダの） */
export interface PagePlace {
  shelf: ShelfKind;
  /** 棚の名前（会社／営業／自分） */
  shelfName: string;
  folders: readonly string[];
}

/** 似たページ・一覧の 1 行に出すページの要約 */
export interface PageBrief {
  id: string;
  title: string;
  /** 1 行の説明（AI に渡す目次になる） */
  desc: string;
  place: string;
}

// 管理の一覧の行の型（admin-views.tsx と samples.tsx が分け合う。samples が admin-views を読まずに済むよう、ここに置く）
export interface ApprovalItem {
  id: string;
  kind: "raise" | "share";
  /** 頼んだ人（共有は頼んだグループ） */
  from: string;
  /** 元の棚 → 先の棚 */
  fromShelf: string;
  toShelf: string;
  title: string;
  desc: string;
  message?: string;
  at: string;
  /** 似たページ（上げるとき） */
  similar?: string;
  /** 断る理由を書いている */
  declining?: { reason: string; error?: string };
}
export interface UnusedRow {
  id: string;
  title: string;
  place: string;
  lastOpened: string;
}
export interface ConflictRow {
  id: string;
  upper: string;
  upperPlace: string;
  lower: string;
  lowerPlace: string;
  /** どこが食い違っているか（1 行） */
  point: string;
}
export interface BrokenRow {
  id: string;
  title: string;
  place: string;
  count: number;
  /** いちばん多い破られ方（1 行） */
  how: string;
}
