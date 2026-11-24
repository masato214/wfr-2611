"use client";
// 運営のワークスペースの一覧の口を読む（K-965）。外枠の口は入れ物（K-946）と同じ鍵で、ここからは読み直さない（二重に呼ばない・D-156.4）
import { useQuery } from "@tanstack/react-query";
import { fetchOpsShell, fetchOpsWorkspaces } from "@/lib/ops-shell-api";
import { OPS_SHELL_KEY } from "./use-ops-shell";
import { toSearch, type ListQuery } from "./ws-list-shape";

/** 一覧の鍵（絞り込みの値ごと） */
export const wsListKey = (lq: ListQuery) => ["k965", "workspaces", lq.view, lq.plan, lq.sort, lq.q] as const;

/** 一覧（問い合わせは既定でない値だけ）。窓に戻っても読み直さない */
export function useOpsWorkspaces(lq: ListQuery) {
  return useQuery({
    queryKey: wsListKey(lq),
    queryFn: () => fetchOpsWorkspaces(toSearch(lq)),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** 外枠の答え（入れ物が読んだ物をそのまま使う。開いたときに読み直さない＝外枠の口は 1 回） */
export function useOpsShellData() {
  return useQuery({
    queryKey: OPS_SHELL_KEY,
    queryFn: fetchOpsShell,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
