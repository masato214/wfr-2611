"use client";
// K-683 ページを書く画面の状態と口。題名・1 行の説明・本文を持ち、打ち終えてから AUTOSAVE_MS 後に下書きを 1 回にまとめて保存し
//   （体は前の保存から変わった欄だけ）、「書き終える」で 先に保存 → 差し込み口（publish-gate.tsx）→ 公開、「やめる」で下書きを捨てる。
//   保存は 1 度に 1 つ（答えのあとに続きを 1 回）。離れるときは送っていない直しを元のページへ送りきる。更新は新しい値で入れ替える
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { docToText, type Doc, type KnowledgeDraftInput } from "@kaname/contracts";
import { PAGE_ERROR, errorCodeOf } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import type { PublishGate } from "./publish-gate";
import type { PageAnswer } from "./shape";
import { TREE_KEY, pageKey } from "./use-knowledge";

export const AUTOSAVE_MS = 800;
const SCREEN = "knowledge";
const EMPTY_DOC: Doc = { type: "doc", content: [] };
export const TITLE_REQUIRED = "題名を入れてください";

export interface Fields {
  title: string;
  desc: string;
  doc: Doc;
}
export type Field = keyof Fields;
export type SavedKind = "none" | "saving" | "saved" | "failed";
export type DialogKind = "discard" | "discard-page" | null;

export interface WritingState {
  fields: Fields;
  saved: SavedKind;
  savedAt: string | null;
  /** 赤い箱の正本の ID と、どの操作から出たか（保存が通れば保存の箱は消える） */
  box: { code: string; from: "save" | "finish" } | null;
  loginLost: boolean;
  titleError: string | null;
  /** 題名へ焦点を戻す合図（増えるたびに動く） */
  focusTitle: number;
  busy: boolean;
  /** 別の人が下書き中（E-KNW-012）。書き終えるは押せない */
  conflict: boolean;
  dialog: DialogKind;
  dialogBusy: boolean;
  dialogBox: string | null;
}

export interface WritingDeps {
  page: PageAnswer;
  gate: PublishGate;
  setEditing: (on: boolean) => void;
  go: (href: string) => void;
  notify: (text: string) => void;
}

const sameDoc = (a: Doc, b: Doc): boolean => JSON.stringify(a) === JSON.stringify(b);

/** 前の保存から変わった欄だけ（題名が空白だけなら送らない・text は送らない＝口が doc から作る） */
export function dirtyFields(cur: Fields, base: Fields): KnowledgeDraftInput {
  return {
    ...(cur.title !== base.title && cur.title.trim() !== "" ? { title: cur.title } : {}),
    ...(cur.desc !== base.desc ? { desc: cur.desc } : {}),
    ...(!sameDoc(cur.doc, base.doc) ? { doc: cur.doc as unknown as Record<string, unknown> } : {}),
  };
}
const isEmpty = (b: KnowledgeDraftInput): boolean => Object.keys(b).length === 0;
const changed = (a: Fields, b: Fields): boolean => a.title !== b.title || a.desc !== b.desc || !sameDoc(a.doc, b.doc);

/** 開いたときの値（書きかけが口に在ればそれ） */
export function openingFields(page: PageAnswer): Fields {
  const d = page.draft;
  return {
    title: d?.title ?? page.title,
    desc: d?.desc ?? page.desc,
    doc: ((d?.doc ?? page.body?.doc ?? EMPTY_DOC) as Doc) ?? EMPTY_DOC,
  };
}

/** 失敗の答えを赤い箱の正本の ID に（503 は E-PAGE-003・網の切れは E-PAGE-008） */
export function boxCodeOf(r: Pick<CallErr, "kind" | "code" | "status"> | "network"): string {
  if (r === "network") return PAGE_ERROR.offline;
  if (r.status === 503) return PAGE_ERROR.down;
  return errorCodeOf(r);
}

type Reply<T> = { ok: true; data: T } | { ok: false; err: CallErr | "network" };
async function safe<T>(run: () => Promise<{ ok: true; data: T } | CallErr>): Promise<Reply<T>> {
  try {
    const r = await run();
    return r.ok ? { ok: true, data: r.data } : { ok: false, err: r };
  } catch {
    return { ok: false, err: "network" };
  }
}

const initialState = (page: PageAnswer): WritingState => ({
  fields: openingFields(page),
  saved: "none",
  savedAt: page.draft?.saved_at ?? null,
  box: null,
  loginLost: false,
  titleError: null,
  focusTitle: 0,
  busy: false,
  conflict: false,
  dialog: null,
  dialogBusy: false,
  dialogBox: null,
});

export function usePageWriting({ page, gate, setEditing, go, notify }: WritingDeps) {
  const qc = useQueryClient();
  const id = page.id;
  const opened = useRef<Fields>(openingFields(page));
  const fieldsRef = useRef<Fields>(opened.current);
  const baseRef = useRef<Fields>(opened.current);
  const hasDraft = useRef<boolean>(page.draft !== null && page.draft !== undefined);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closed = useRef(false);
  const busyRef = useRef(false);
  const [st, setSt] = useState<WritingState>(() => initialState(page));
  const patch = useCallback((p: Partial<WritingState>) => setSt((s) => ({ ...s, ...p })), []);

  const clearTimer = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const waitInflight = async (): Promise<void> => {
    while (inflight.current) await inflight.current;
  };
  const reloadWait = async (what: { page?: boolean; tree?: boolean }): Promise<void> => {
    await Promise.all([
      what.page ? qc.refetchQueries({ queryKey: pageKey(id) }) : undefined,
      what.tree ? qc.refetchQueries({ queryKey: TREE_KEY }) : undefined,
    ]);
  };

  /** 保存の失敗を画面に出す（自動のときの 503・網の切れは印だけ。書き終えるの中では赤い箱も） */
  const showSaveError = (err: CallErr | "network", mode: "auto" | "finish"): void => {
    if (err !== "network" && err.status === 401) return patch({ saved: "failed", loginLost: true });
    if (err !== "network" && err.status === 409 && err.code === "E-KNW-012")
      return patch({ saved: "failed", conflict: true, box: { code: "E-KNW-012", from: "save" } });
    const soft = err === "network" || err.status === 503 || err.kind === "failed" || err.kind === "rate_limited";
    if (soft && mode === "auto") return patch({ saved: "failed" });
    patch({ saved: "failed", box: { code: boxCodeOf(err), from: mode === "auto" ? "save" : "finish" } });
  };

  const saveOnce = async (body: KnowledgeDraftInput, mode: "auto" | "finish"): Promise<boolean> => {
    patch({ saved: "saving" });
    const r = await safe(() => call("saveKnowledgeDraft", { params: { id }, body, screenId: SCREEN, keepOn401: true }));
    if (!r.ok) {
      showSaveError(r.err, mode);
      return false;
    }
    baseRef.current = {
      title: body.title ?? baseRef.current.title,
      desc: body.desc ?? baseRef.current.desc,
      doc: body.doc ? (body.doc as unknown as Doc) : baseRef.current.doc,
    };
    hasDraft.current = true;
    setSt((s) => ({
      ...s,
      saved: "saved",
      savedAt: r.data.saved_at ?? new Date().toISOString(),
      box: s.box?.from === "save" ? null : s.box,
    }));
    return true;
  };

  /** 送っていない直しを送る（答えを待つ間なら答えの後に）。直しが無ければ true */
  const flush = async (mode: "auto" | "finish"): Promise<boolean> => {
    clearTimer();
    await waitInflight();
    const body = dirtyFields(fieldsRef.current, baseRef.current);
    if (isEmpty(body)) return true;
    const p = saveOnce(body, mode);
    inflight.current = p;
    try {
      return await p;
    } finally {
      inflight.current = null;
    }
  };

  const change = (field: Field, value: string | Doc): void => {
    const next = { ...fieldsRef.current, [field]: value } as Fields;
    fieldsRef.current = next;
    setSt((s) => ({
      ...s,
      fields: next,
      titleError: field === "title" && String(value).trim() ? null : s.titleError,
    }));
    if (st.conflict) return;
    clearTimer();
    timer.current = setTimeout(() => void flush("auto"), AUTOSAVE_MS);
  };

  const close = (): void => {
    closed.current = true;
    clearTimer();
    setEditing(false);
  };

  const publish = async (): Promise<boolean> => {
    const f = fieldsRef.current;
    const ok = await gate.check({ page_id: id, title: f.title, desc: f.desc, text: docToText(f.doc) });
    if (!ok) return false;
    const r = await safe(() =>
      call("publishKnowledgePage", { params: { id }, body: {}, screenId: SCREEN, keepOn401: true }),
    );
    if (r.ok) return true;
    if (r.err !== "network" && r.err.status === 401) patch({ loginLost: true, box: null });
    else patch({ loginLost: false, box: { code: boxCodeOf(r.err), from: "finish" } });
    return false;
  };

  const finish = async (): Promise<void> => {
    if (busyRef.current || st.conflict) return;
    const f = fieldsRef.current;
    if (!f.title.trim()) {
      patch({ titleError: TITLE_REQUIRED, focusTitle: st.focusTitle + 1 });
      return;
    }
    if (page.state !== "draft" && !hasDraft.current && !changed(f, opened.current) && !inflight.current) {
      close();
      return;
    }
    busyRef.current = true;
    patch({ busy: true });
    try {
      if (!(await flush("finish"))) return;
      if (!(await publish())) return;
      closed.current = true;
      await reloadWait({ page: true, tree: true });
      close();
      notify("ページを書き終えました");
    } finally {
      busyRef.current = false;
      patch({ busy: false });
    }
  };

  const cancel = (): void => {
    if (st.conflict) return patch({ dialog: "discard", dialogBox: null });
    if (page.state === "draft") return patch({ dialog: "discard-page", dialogBox: null });
    if (!hasDraft.current && !inflight.current && !changed(fieldsRef.current, opened.current)) return close();
    patch({ dialog: "discard", dialogBox: null });
  };

  /** 捨て終えた（もう無い・E-KNW-030 も含む）。小窓を閉じて読む形へ（読み直しの答えにまだ下書きがあっても、押せない小窓を残さない） */
  const discardDone = async (deleted: boolean): Promise<void> => {
    hasDraft.current = false;
    patch({ dialog: null, dialogBusy: false, dialogBox: null });
    if (deleted) {
      qc.removeQueries({ queryKey: pageKey(id) });
      go("/knowledge");
      await reloadWait({ tree: true });
      close();
      notify("ページを消しました");
      return;
    }
    await reloadWait({ page: true });
    close();
  };

  const discard = async (): Promise<void> => {
    if (st.dialogBusy) return;
    closed.current = true;
    clearTimer();
    patch({ dialogBusy: true, dialogBox: null });
    await waitInflight();
    if (st.conflict || !hasDraft.current) {
      patch({ dialog: null, dialogBusy: false });
      return close();
    }
    const r = await safe(() => call("discardKnowledgeDraft", { params: { id }, screenId: SCREEN, keepOn401: true }));
    if (r.ok) return discardDone(Boolean(r.data.page_deleted));
    if (r.err !== "network" && r.err.status === 409 && r.err.code === "E-KNW-030") return discardDone(false);
    closed.current = false;
    if (r.err !== "network" && r.err.status === 401) return patch({ dialog: null, dialogBusy: false, loginLost: true });
    patch({ dialogBusy: false, dialogBox: boxCodeOf(r.err) });
  };

  const keepWriting = (): void => patch({ dialog: null, dialogBox: null });

  // 送っていない直しがあるときだけ、再読み込み・タブを閉じる前に確かめる
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent): void => {
      if (closed.current) return;
      if (!inflight.current && isEmpty(dirtyFields(fieldsRef.current, baseRef.current))) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  // 離れる（別のページへ移る・戻る）ときは、送っていない直しを元のページへ 1 回送りきる（失敗しても移った先は止めない）
  useEffect(() => {
    closed.current = false;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (closed.current) return;
      const pending = inflight.current;
      void (async () => {
        if (pending) await pending.catch(() => false);
        const body = dirtyFields(fieldsRef.current, baseRef.current);
        if (isEmpty(body)) return;
        await safe(() => call("saveKnowledgeDraft", { params: { id }, body, screenId: SCREEN, keepOn401: true }));
      })();
    };
  }, [id]);

  return { st, change, finish, cancel, discard, keepWriting };
}
