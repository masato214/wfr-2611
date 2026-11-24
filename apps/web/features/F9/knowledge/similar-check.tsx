"use client";
// K-691 似たページを探して小窓で見せる（findSimilarKnowledge・K-686）。書き終える前（publish-gate.tsx）と上げる前（K-692）が使う。
//   check(input) は探す口を 1 回呼び、似たページが無ければ true・あれば小窓を出して「このまま」で true・「戻って直す」・Esc・×で false。
//   探す口が失敗しても止めずに true（探すのは気づかせるだけ）。入れ物が外れたら待っている check は false で終える
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNotify } from "@/components/k";
import { call } from "@/lib/api/call";
import { SimilarDialog } from "./dialogs";
import { SIMILAR_FAILED, briefsOf, similarBody, type SimilarSource } from "./must-shape";
import type { PageBrief } from "./types";

const SCREEN = "knowledge";
/** 焦点を戻す先が押せる形に戻るまで待つ回数（描き直しの回数） */
const REFOCUS_FRAMES = 60;

export interface SimilarInput extends SimilarSource {
  when: "save" | "raise";
  /** 小窓の対象の行（棚 › フォルダ › 題名） */
  target: string;
}

export interface SimilarCheck {
  check: (input: SimilarInput) => Promise<boolean>;
  dialog: ReactNode;
  /** 小窓が出ている間 true */
  open: boolean;
}

export interface SimilarOptions {
  /** 「戻って直す」・Esc・× で閉じたあと焦点を戻す先（押せる形に戻るまで待つ） */
  returnFocus?: () => HTMLElement | null;
}

interface DialogState {
  open: boolean;
  when: "save" | "raise";
  target: string;
  pages: readonly PageBrief[];
}

async function findSimilar(input: SimilarInput): Promise<PageBrief[] | null> {
  try {
    const r = await call("findSimilarKnowledge", { body: similarBody(input), screenId: SCREEN });
    return r.ok ? briefsOf(r.data.pages) : null;
  } catch {
    return null;
  }
}

/** 押せる形に戻ったら焦点を置く（答えを待つ間は押せない形なので、戻るまで描き直しを待つ） */
function focusWhenReady(find: (() => HTMLElement | null) | undefined): void {
  if (!find || typeof window === "undefined") return;
  let n = 0;
  const step = (): void => {
    const el = find();
    const usable = el && !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true";
    if (el && usable) {
      if (document.activeElement !== el) el.focus();
      return;
    }
    if (++n < REFOCUS_FRAMES) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

export function useSimilarCheck(opts: SimilarOptions = {}): SimilarCheck {
  const notify = useNotify();
  const [st, setSt] = useState<DialogState | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const asking = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  const answer = (ok: boolean): void => {
    const r = resolver.current;
    resolver.current = null;
    setSt((s) => (s ? { ...s, open: false } : s));
    r?.(ok);
    if (!ok) focusWhenReady(opts.returnFocus);
  };

  const check = async (input: SimilarInput): Promise<boolean> => {
    if (asking.current) return false;
    asking.current = true;
    try {
      const pages = await findSimilar(input);
      if (!mounted.current) return false;
      if (pages === null) {
        notify(SIMILAR_FAILED[input.when]);
        return true;
      }
      if (!pages.length) return true;
      return await new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setSt({ open: true, when: input.when, target: input.target, pages });
      });
    } finally {
      asking.current = false;
    }
  };

  const openPage = (id: string): void => {
    window.open(`/knowledge/${encodeURIComponent(id)}`, "_blank", "noopener");
  };

  const dialog = st ? (
    <SimilarDialog
      open={st.open}
      when={st.when}
      target={st.target}
      pages={st.pages}
      onBack={() => answer(false)}
      onProceed={() => answer(true)}
      onOpen={openPage}
      onClose={() => answer(false)}
    />
  ) : null;

  return { check, dialog, open: Boolean(st?.open) };
}
