"use client";
// K-691「必ず守る」の付け外しと上限の小窓の状態と口（setKnowledgeMust・K-685）。
//   押すと口を 1 回（答えを待つ間は押せない）→ 成功ならページと木を読み直してお知らせ。上限（409 E-KNW-060）なら小窓を出し、
//   小窓の「外す」はそのページを外して続けてこのページに付ける（2 本の順）。更新は新しい値を作って入れ替える
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { errorText, useNotify } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { mustFullOf, mustToast, pageTarget, type MustFullPage } from "./must-shape";
import type { PageCtx } from "./page-slots";
import type { PageAnswer } from "./shape";
import { TREE_KEY, pageKey } from "./use-knowledge";
import { boxCodeOf } from "./use-page-writing";

const SCREEN = "knowledge";
const FULL_CODE = "E-KNW-060";

export interface MustFullState {
  open: boolean;
  shelfName: string;
  limit: number;
  target: string;
  pages: readonly MustFullPage[];
  busy: boolean;
  /** 小窓の赤い箱の正本の ID */
  error: string | null;
}

type MustReply = { ok: true; used: number; limit: number } | { ok: false; err: CallErr | "network" };

async function putMust(id: string, must: boolean): Promise<MustReply> {
  try {
    const r = await call("setKnowledgeMust", { params: { id }, body: { must }, screenId: SCREEN });
    return r.ok ? { ok: true, used: r.data.used ?? 0, limit: r.data.limit ?? 0 } : { ok: false, err: r };
  } catch {
    return { ok: false, err: "network" };
  }
}

const isFull = (err: CallErr | "network"): err is CallErr =>
  err !== "network" && err.status === 409 && err.code === FULL_CODE;
/** 読み直す断り（ページの今の形に合わせる）：404・409 */
const needsReread = (err: CallErr | "network"): boolean =>
  err !== "network" && (err.status === 404 || err.status === 409);

export interface UseMust {
  full: MustFullState | null;
  press: (on: boolean) => Promise<void>;
  removeAndAttach: (id: string) => Promise<void>;
  close: () => void;
}

export function useMust(ctx: PageCtx): UseMust {
  const qc = useQueryClient();
  const notify = useNotify();
  const [full, setFull] = useState<MustFullState | null>(null);
  const busyRef = useRef(false);
  const fullRef = useRef<MustFullState | null>(null);
  const page = ctx.page;

  const putFull = (next: MustFullState | null): void => {
    fullRef.current = next;
    setFull(next);
  };
  const reloadWait = async (id: string, what: { page: boolean; tree: boolean }): Promise<void> => {
    await Promise.all([
      what.page ? qc.refetchQueries({ queryKey: pageKey(id) }) : undefined,
      what.tree ? qc.refetchQueries({ queryKey: TREE_KEY }) : undefined,
    ]);
  };
  const failNotify = (err: CallErr | "network"): void => {
    notify(errorText(boxCodeOf(err)).title, { type: "error" });
  };
  const openFull = (p: PageAnswer, body: unknown): boolean => {
    const f = mustFullOf(body);
    if (!f) return false;
    putFull({ open: true, ...f, target: pageTarget(p.place, p.title), busy: false, error: null });
    return true;
  };
  const attached = async (p: PageAnswer, used: number, limit: number, on: boolean): Promise<void> => {
    await reloadWait(p.id, { page: true, tree: true });
    notify(mustToast(on, p.place.shelf_name, used, limit));
  };

  const press = async (on: boolean): Promise<void> => {
    const p = page;
    if (!p || busyRef.current || fullRef.current?.open) return;
    busyRef.current = true;
    try {
      const r = await putMust(p.id, on);
      if (r.ok) return await attached(p, r.used, r.limit, on);
      if (on && isFull(r.err)) {
        if (!openFull(p, r.err.body)) notify(errorText(FULL_CODE).title, { type: "error" });
        return;
      }
      failNotify(r.err);
      if (needsReread(r.err)) await reloadWait(p.id, { page: true, tree: true });
    } finally {
      busyRef.current = false;
    }
  };

  const removeAndAttach = async (id: string): Promise<void> => {
    const p = page;
    const cur = fullRef.current;
    if (!p || !cur || cur.busy) return;
    putFull({ ...cur, busy: true, error: null });
    const off = await putMust(id, false);
    if (!off.ok) {
      putFull({ ...cur, busy: false, error: boxCodeOf(off.err) });
      return;
    }
    const left = cur.pages.filter((x) => x.id !== id);
    const on = await putMust(p.id, true);
    if (on.ok) {
      putFull({ ...cur, pages: left, open: false, busy: false, error: null });
      await attached(p, on.used, on.limit, true);
      return;
    }
    void reloadWait(p.id, { page: false, tree: true });
    if (isFull(on.err) && openFull(p, on.err.body)) return;
    putFull({ ...cur, pages: left, busy: false, error: boxCodeOf(on.err) });
  };

  const close = (): void => {
    const cur = fullRef.current;
    if (!cur || cur.busy) return;
    putFull({ ...cur, open: false, error: null });
  };

  return { full, press, removeAndAttach, close };
}
