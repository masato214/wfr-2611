"use client";
// K-682 書いている画面の差し込み口。この葉の中身は children（読む形）を返すだけ。
//   K-683 がこのファイルの中身を書き替える（書いている画面か children かを決める）。名前と props は変えない
import type { ReactNode } from "react";
import type { PageAnswer } from "./shape";

export interface WritingSlotProps {
  page: PageAnswer;
  editing: boolean;
  setEditing: (on: boolean) => void;
  children: ReactNode;
}

export function WritingSlot({ children }: WritingSlotProps): ReactNode {
  return children;
}
