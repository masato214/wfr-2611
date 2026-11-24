"use client";
// K-682 書いている画面の差し込み口（K-683 が中身を書き替えた・名前と props は K-682 のまま）。
//   書いている画面にするのは：いま「直す」を押した（editing）・まだ 1 度も書き終えていない（state=draft）・書きかけが口に在る（draft）。
//   どれでもなければ children（読む形）。URL には持たない（K-682 の決め）
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useNotify } from "@/components/k";
import type { PageAnswer } from "./shape";
import { WritingPage } from "./writing-page";

export interface WritingSlotProps {
  page: PageAnswer;
  editing: boolean;
  setEditing: (on: boolean) => void;
  children: ReactNode;
}

/** 書いている画面にするか */
export function isWriting(page: PageAnswer, editing: boolean): boolean {
  return editing || page.state === "draft" || Boolean(page.draft);
}

export function WritingSlot({ page, editing, setEditing, children }: WritingSlotProps): ReactNode {
  const router = useRouter();
  const notify = useNotify();
  if (!isWriting(page, editing)) return children;
  return (
    <WritingPage
      key={page.id}
      page={page}
      setEditing={setEditing}
      go={(href) => router.push(href as Route)}
      notify={(text) => notify(text)}
    />
  );
}
