"use client";
// 色のある文書の読む形の入口（K-577）。利用者が選んだ #rrggbb の色を持つ文書だけ DocView がここへ渡す。
//   読むだけの編集の部品の本体（./doc-view-live）を、要るときだけ遅く読む。読み込めるまで（と読み込めなかったとき）は、
//   渡された子（色を付けない DocView の描き）を出す＝字は必ず読める。編集の部品（Tiptap・ProseMirror）を静的に import しない
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { Doc } from "@kaname/contracts";

export interface DocViewColorProps {
  doc: Doc;
  onToggleTask?: (index: number, checked: boolean) => void;
  ariaLabel: string;
  /** 色を付けない読む形（読み込みの間に出す） */
  children: ReactNode;
}
type Live = ComponentType<Omit<DocViewColorProps, "children"> & { fallback: ReactNode }>;

export function DocViewColor({ children, ...rest }: DocViewColorProps) {
  const [LiveView, setLiveView] = useState<Live | null>(null);
  useEffect(() => {
    let on = true;
    import("./doc-view-live").then(
      (m) => {
        if (on) setLiveView(() => m.default);
      },
      () => {
        // 読み込めないときは色を付けない読む形のまま（字は読める）
      },
    );
    return () => {
      on = false;
    };
  }, []);
  return LiveView ? <LiveView {...rest} fallback={children} /> : <>{children}</>;
}
