"use client";
// 詳細まわりの下絵（render-detail.tsx）が使う見本の値：子・つながり。全部の状態で同じ人・同じチケット（EG-119）にそろえる。
//   本物にする葉（K-452）はここを使わず、口の答えを部品（features/F4/links/views.tsx）に渡す
import type { LinkCandidate, LinkRow, TicketRef } from "@/features/F4/links/views";

// ---------------------------------------------------------------- 子・つながり
/** 番号の行き先（モックでは同じ詳細の状態に戻る） */
const HERE = "/dev/mock/f4/f4-links";

const ref = (number: string, title: string, stage: string, stageTone: TicketRef["stageTone"]): TicketRef => ({
  number,
  title,
  stage,
  stageTone,
  href: HERE,
});

/** 見えない相手（番号だけ・題名と段は出さない・リンクにしない） */
const hidden = (number: string): TicketRef => ({ number, title: "", stage: "", stageTone: "neutral", visible: false });

export const CHILDREN: readonly TicketRef[] = [
  ref("EG-120", "回答の下書きを作る", "作業中", "progress"),
  ref("EG-121", "保守の範囲を確かめる", "完了", "success"),
];
export const LINKS: readonly LinkRow[] = [
  { id: "l1", kind: "derived", ...ref("EG-110", "山田様からの問い合わせを受ける", "完了", "success") },
  { id: "l2", kind: "related", ...ref("JD-150", "京蟻 保守運用（年間）", "作業中", "progress") },
];
export const CANDIDATES: readonly LinkCandidate[] = [
  { group: "受託開発", linked: true, ...ref("JD-150", "京蟻 保守運用（年間）", "作業中", "progress") },
  { group: "営業", ...ref("EG-097", "セイコー様 保守契約の見積", "完了", "success") },
  { group: "経理", ...ref("KR-031", "入金の照合（11月分）", "未着手", "neutral") },
];

/** 種類がそろった見本（派生元・派生先・関連・見えない相手） */
export const LINKS_VARIANTS: readonly LinkRow[] = [
  ...LINKS.slice(0, 1),
  { id: "l3", kind: "source", ...ref("EG-130", "回答の控えを台帳に残す", "未着手", "neutral") },
  { id: "l4", kind: "source", ...hidden("KR-044") },
  ...LINKS.slice(1),
];
