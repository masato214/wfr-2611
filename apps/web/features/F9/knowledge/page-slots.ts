// K-682 ナレッジの画面の差し込み口。後ろの葉（K-683 書く・K-684 木の操作と「…」・K-691〜K-693 必ず守る／上げる／共有）は、
//   自分の use…Slot を PAGE_SLOTS に 1 行足すだけで画面に動きを入れる。入れ物（knowledge-page.tsx）は毎回同じ順で呼んでまとめる。
//   動きの無い操作は押せない形（aria-disabled）で出す（実装が無いのに押せる死にボタンを作らない）
import type { ReactNode } from "react";
import type { PageAnswer, TreeAnswer } from "./shape";
import type { MoreItem, PageAct, ShelfKind } from "./types";

export type ReloadWhat = { page?: boolean; tree?: boolean };
export type AddTarget = { shelf: ShelfKind; group_id?: string };

/** 帯の中のボタンの動き（K-692・K-693） */
export interface BandActs {
  withdraw?: (requestId: string) => void;
  dismiss?: (requestId: string) => void;
  redo?: () => void;
  openOriginal?: (pageId: string) => void;
}
export type BandKey = keyof BandActs;

/** 1 つの葉が差し込む物。acts の鍵は口の操作の名前（PageAct：must-on＝付けられる・must-off＝外せる） */
export interface PageSlot {
  acts?: Partial<Record<PageAct, () => void>>;
  more?: Partial<Record<MoreItem, () => void>>;
  add?: (target: AddTarget) => void;
  overlay?: ReactNode;
  bands?: BandActs;
}

/** 差し込む葉が受け取る、いまの画面 */
export interface PageCtx {
  /** 開いているページ（読む前・開いていないときは undefined） */
  page: PageAnswer | undefined;
  tree: TreeAnswer | undefined;
  go: (href: string) => void;
  /** 読み直す（無ければ木とページの両方） */
  reload: (what?: ReloadWhat) => void;
  setEditing: (on: boolean) => void;
  notify: (text: string) => void;
}

/** まとめた後の形（同じ操作は先の物・小窓は全部を順に） */
export interface MergedSlots {
  acts: Partial<Record<PageAct, () => void>>;
  more: Partial<Record<MoreItem, () => void>>;
  add?: (target: AddTarget) => void;
  overlays: readonly ReactNode[];
  bands: BandActs;
}

/** K-683 書く：「直す」で書いている画面にする（口は呼ばない・下書きは最初の保存でできる） */
const useWriteSlot = (ctx: PageCtx): PageSlot => ({ acts: { edit: () => ctx.setEditing(true) } });

/** 後ろの葉が 1 行ずつ足す。React の hook として毎回同じ順で呼ぶ */
export const PAGE_SLOTS: readonly ((ctx: PageCtx) => PageSlot)[] = [useWriteSlot];

const firstWins = <T extends object>(list: readonly (T | undefined)[]): T =>
  list.reduce<T>((acc, cur) => ({ ...(cur ?? {}), ...acc }), {} as T);

export function mergeSlots(slots: readonly PageSlot[]): MergedSlots {
  const add = slots.find((s) => s.add)?.add;
  return {
    acts: firstWins(slots.map((s) => s.acts)),
    more: firstWins(slots.map((s) => s.more)),
    ...(add ? { add } : {}),
    overlays: slots.filter((s) => s.overlay !== undefined && s.overlay !== null).map((s) => s.overlay),
    bands: firstWins(slots.map((s) => s.bands)),
  };
}

/** 動きの無い操作か（真なら押せない形で出す） */
export function isInert(merged: MergedSlots, where: "act" | "more" | "band", key: string): boolean {
  const table: Readonly<Record<string, unknown>> =
    where === "act" ? { ...merged.acts } : where === "more" ? { ...merged.more } : { ...merged.bands };
  return typeof table[key] !== "function";
}
