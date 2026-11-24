"use client";
// K-683 書き終えるの前の差し込み口。書き終える手順（use-page-writing.ts の finish）は、公開の口を呼ぶ前に check を呼び、
//   true なら公開する・false なら止める（書いている画面のまま）。dialog は書いている画面が描く。
//   この葉の中身は既定（いつも true・小窓なし）。K-691 がこのファイルの中身を書き替える（似たページの小窓）。名前と型は変えない
import type { ReactNode } from "react";

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

const DEFAULT_GATE: PublishGate = { check: async () => true, dialog: null };

export function usePublishGate(): PublishGate {
  return DEFAULT_GATE;
}
