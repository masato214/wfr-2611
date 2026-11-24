"use client";
// K-682 ナレッジの画面の骨組み：左に木・右に本文（幅 1023 以下は木が引き出し・本文の上に「木を開く」）。
//   本番の入れ物（knowledge-page.tsx）と下絵の外枠（app/(dev)/dev/mock/f9/frame.tsx）の両方がこれを使う（同じ組み立てを 2 か所に書かない）
import type { ReactNode } from "react";
import { KnowledgeTree, TreeBar, type KnowledgeTreeProps } from "./tree";

export interface KnowledgeLayoutProps {
  /** 左の木（null＝木が読めず、本文の場所だけに出す） */
  tree: KnowledgeTreeProps | null;
  /** 本文の上の帯のいまの場所（幅 1023 以下で出る） */
  place: string;
  /** 「木を開く」を押した（渡さなければ見た目だけ） */
  onOpenDrawer?: (() => void) | undefined;
  children: ReactNode;
}

export function KnowledgeLayout({ tree, place, onOpenDrawer, children }: KnowledgeLayoutProps) {
  return (
    <div className="k-f9-wrap">
      {tree ? <KnowledgeTree {...tree} /> : null}
      <div className="k-root k-f9-main">
        {tree ? <TreeBar place={place} onOpen={onOpenDrawer} /> : null}
        {children}
      </div>
    </div>
  );
}
