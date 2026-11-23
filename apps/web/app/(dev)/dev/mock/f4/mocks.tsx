"use client";
// 段 5（F4 チケットを作って中身を決める）の前の下絵のうち、作り直しの後も残す状態（親・期限・複製・つながり・空の一覧のおすすめ・「…」）。
//   新しい下絵（項目の表・自由な本文・確認項目）は ../f4v2/mocks.tsx。ここは本番と同じ部品（features/F4/<区画>/views.tsx・components/k）を
//   決めた値で並べる。1 つの id ＝ 1 つの状態。区画の入力・テスト仕様・業務の型・前の版と差分の状態は外した（段 5 の作り直し・2026-11-21）。
//   状態の並びは機械が読む（scripts/ci/canvas_field_gate.py と画面の試験）：{ id, screen, label, ticket, leaf } の順と引用符を崩さない。
//   描き分けは render-create.tsx（作る面に重なる小窓・空の一覧）と render-detail.tsx（詳細まわり）。共通の枠と見本の値は frame.tsx
import type { Theme } from "@/lib/theme";
import { renderCreate } from "./render-create";
import { renderDetail } from "./render-detail";

export interface MockEntry {
  id: string;
  screen: "tickets";
  label: string;
  /** この状態を本物にする画面の葉（11_tickets/K-443〜K-458） */
  ticket: string;
  /** 下絵の頁に出す葉の名前（ticket と同じ番号・07_functional/段5-F4/切り方.md） */
  leaf: string;
}

// prettier-ignore
export const MOCKS: readonly MockEntry[] = [
  // 作る面に重なる小窓と空の一覧
  { id: "f4-parent-dialog", screen: "tickets", label: "親を決める小窓", ticket: "K-443", leaf: "K-443" },
  { id: "f4-parent-none", screen: "tickets", label: "親を決める小窓：合うチケットが無い", ticket: "K-443", leaf: "K-443" },
  { id: "f4-parent-limit", screen: "tickets", label: "親を決める小窓：3 段目は選べない", ticket: "K-443", leaf: "K-443" },
  { id: "f4-due-dialog", screen: "tickets", label: "期限を決める小窓（作る面）", ticket: "K-444", leaf: "K-444" },
  { id: "f4-due-past", screen: "tickets", label: "期限を決める小窓：過去は選べない", ticket: "K-444", leaf: "K-444" },
  { id: "f4-dup-pick", screen: "tickets", label: "過去のチケットから複製：元を選ぶ", ticket: "K-446", leaf: "K-446" },
  { id: "f4-dup-dialog", screen: "tickets", label: "詳細の複製の小窓（写す物）", ticket: "K-446", leaf: "K-446" },
  { id: "f4-dup-error", screen: "tickets", label: "複製できなかった", ticket: "K-446", leaf: "K-446" },
  { id: "f4-home-empty", screen: "tickets", label: "空の一覧のおすすめ 3 つ", ticket: "K-453", leaf: "K-453" },
  // 詳細まわり
  { id: "f4-more-menu", screen: "tickets", label: "詳細の「…」（使える物と押せない物）", ticket: "K-458", leaf: "K-458" },
  { id: "f4-links-collapsed", screen: "tickets", label: "子・つながり：閉じた形（件数と「開く」）", ticket: "K-452", leaf: "K-452" },
  { id: "f4-links", screen: "tickets", label: "子・つながり", ticket: "K-452", leaf: "K-452" },
  { id: "f4-links-empty", screen: "tickets", label: "子・つながり：どちらも無い", ticket: "K-452", leaf: "K-452" },
  { id: "f4-link-remove", screen: "tickets", label: "つながりを外す確かめ", ticket: "K-452", leaf: "K-452" },
  { id: "f4-links-variants", screen: "tickets", label: "子・つながり：派生先と見えない相手", ticket: "K-452", leaf: "K-452" },
  { id: "f4-link-add", screen: "tickets", label: "つながりを足す小窓", ticket: "K-452", leaf: "K-452" },
];

export function MockView({ id, theme }: { id: string; theme: Theme }) {
  const node = renderCreate(id, theme) ?? renderDetail(id, theme);
  if (node === null) return <p>この状態はまだありません：{id}</p>;
  return node;
}
