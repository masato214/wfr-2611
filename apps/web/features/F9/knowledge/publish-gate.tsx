"use client";
// K-683 書き終えるの前の差し込み口。書き終える手順（use-page-writing.ts の finish）は、公開の口を呼ぶ前に check を呼び、
//   true なら公開する・false なら止める（書いている画面のまま）。dialog は書いている画面が描く。名前と型は K-683 のまま。
//   中身は K-691：似たページを探して小窓で見せる（similar-check.tsx）。対象の行は読み込み済みのページの場所から作る（無ければ題名だけ）
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { pageTarget } from "./must-shape";
import type { PageAnswer } from "./shape";
import { useSimilarCheck } from "./similar-check";
import { pageKey } from "./use-knowledge";

export interface PublishGateInput {
  page_id: string;
  title: string;
  desc: string;
  text: string;
}

export interface PublishGate {
  check: (input: PublishGateInput) => Promise<boolean>;
  dialog: ReactNode;
}

/** 小窓を閉じたあと焦点を戻す「書き終える」 */
const findFinish = (): HTMLElement | null => {
  const buttons = document.querySelectorAll<HTMLElement>('article[aria-label="ページを書いている"] .k-f9-acts button');
  return Array.from(buttons).find((b) => b.textContent?.trim() === "書き終える") ?? null;
};

export function usePublishGate(): PublishGate {
  const qc = useQueryClient();
  const similar = useSimilarCheck({ returnFocus: findFinish });
  const check = (input: PublishGateInput): Promise<boolean> => {
    const page = qc.getQueryData<PageAnswer>(pageKey(input.page_id));
    const title = input.title.trim();
    const target = page ? pageTarget(page.place, title || page.title) : title;
    return similar.check({ ...input, when: "save", target });
  };
  return { check, dialog: similar.dialog };
}
