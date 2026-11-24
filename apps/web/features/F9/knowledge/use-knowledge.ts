"use client";
// K-682 ナレッジの画面が読む口：木（getKnowledgeTree・K-676）とページ（getKnowledgePage・K-677）。
//   同じ段で同時に始める（ページは木の答えを待たない）・押し直しは自動でしない・窓に戻っても読み直さない（G-16）。
//   読み直しは書いた葉が reload() で明示する。戻る・進むで開いたページは読み直さない（覚えた答え）
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { PAGE_ERROR, errorCodeOf } from "@/components/k";
import { call } from "@/lib/api/call";
import type { PageAnswer, TreeAnswer } from "./shape";

const SCREEN = "knowledge";
export const TREE_KEY = ["k682", "knowledge", "tree"] as const;
export const pageKey = (id: string) => ["k682", "knowledge", "page", id] as const;
const ONCE = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** 読めなかった訳。noaccess＝見られない（無い・消えた・別の会社・道の id が不正をどれか知らせない） */
export class KnowledgeLoadError extends Error {
  constructor(
    readonly code: string,
    readonly noAccess: boolean,
  ) {
    super(code);
    this.name = "KnowledgeLoadError";
  }
}

/** 網が切れた（fetch が投げた）は「読み込めなかった」にする */
async function safeCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    throw new KnowledgeLoadError(PAGE_ERROR.loadFailed, false);
  }
}

async function readTree(): Promise<TreeAnswer> {
  const r = await safeCall(() => call("getKnowledgeTree", { screenId: SCREEN }));
  if (!r.ok) throw new KnowledgeLoadError(errorCodeOf(r), false);
  return r.data as unknown as TreeAnswer;
}

async function readPage(id: string): Promise<PageAnswer> {
  const r = await safeCall(() => call("getKnowledgePage", { params: { id }, screenId: SCREEN }));
  if (r.ok) return r.data as unknown as PageAnswer;
  if (r.status === 403 || r.status === 404 || r.status === 422)
    throw new KnowledgeLoadError(PAGE_ERROR.forbidden, true);
  throw new KnowledgeLoadError(errorCodeOf(r), false);
}

export function useKnowledgeTree(enabled: boolean): UseQueryResult<TreeAnswer, KnowledgeLoadError> {
  return useQuery<TreeAnswer, KnowledgeLoadError>({ queryKey: TREE_KEY, queryFn: readTree, enabled, ...ONCE });
}

export function useKnowledgePage(
  id: string | undefined,
  enabled: boolean,
): UseQueryResult<PageAnswer, KnowledgeLoadError> {
  return useQuery<PageAnswer, KnowledgeLoadError>({
    queryKey: pageKey(id ?? ""),
    queryFn: () => readPage(id ?? ""),
    enabled: enabled && Boolean(id),
    ...ONCE,
  });
}

/** 読み直す（無ければ木とページの両方）。開いているページの id を渡す */
export function useReloadKnowledge(pageId: string | undefined): (what?: { page?: boolean; tree?: boolean }) => void {
  const qc = useQueryClient();
  return useCallback(
    (what) => {
      const both = !what || (what.page === undefined && what.tree === undefined);
      if (both || what?.tree) void qc.refetchQueries({ queryKey: TREE_KEY });
      if (pageId && (both || what?.page)) void qc.refetchQueries({ queryKey: pageKey(pageId) });
    },
    [qc, pageId],
  );
}
