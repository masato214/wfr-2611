"use client";
// 運営の外枠の口を 1 回読む（K-946・TanStack Query の 1 つの鍵）。読み直しは画面を開き直したとき
import { useQuery } from "@tanstack/react-query";
import { fetchOpsShell } from "@/lib/ops-shell-api";

/** 運営の場所の問いの鍵の頭（ログインし直したらこの頭ごと捨てる） */
export const OPS_QUERY_ROOT = "ops" as const;
export const OPS_SHELL_KEY = [OPS_QUERY_ROOT, "shell"] as const;

export function useOpsShell() {
  return useQuery({ queryKey: OPS_SHELL_KEY, queryFn: fetchOpsShell, retry: false, staleTime: 0 });
}
