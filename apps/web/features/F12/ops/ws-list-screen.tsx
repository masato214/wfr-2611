"use client";
// 運営のワークスペースの一覧の画面（/ops・K-965）。URL の絞り込みを読み → 外枠の答え（上の数）と一覧の口を読み → 部品に値と押したときの関数を渡す。
//   絞り込み・探す・並びは URL に持つ（router.push で戻るが効く）。どちらかが読めなければ本文は読めなかった旨（E-PAGE-007）
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ErrorState, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { useOpsShellData, useOpsWorkspaces } from "./use-ops-workspaces";
import { WsListPage, type ListChip, type WsSort } from "./views-list";
import {
  cleanQ,
  listQuery,
  rowsOf,
  shellOfData,
  statsView,
  toSearch,
  wsRowView,
  type ListPlan,
  type ListQuery,
  type ListSort,
  type ListView,
} from "./ws-list-shape";

const HOME = "/ops";
const TO_WS_SORT: Record<ListSort, WsSort> = { attention: "care", members: "people", runs: "runs" };
const TO_API_SORT: Record<WsSort, ListSort> = { care: "attention", people: "members", runs: "runs" };
const VIEW_CHIPS: readonly [ListView, string][] = [
  ["all", "すべて"],
  ["attention", "気にかける"],
  ["stopped", "止めている"],
  ["closing", "やめる手続き中"],
];
const PLAN_CHIPS: readonly [ListPlan, string][] = [
  ["free", "無料"],
  ["team", "チーム"],
  ["business", "ビジネス"],
];

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <PageBody labelledBy="op-list-title">
      <PageHeader id="op-list-title" title="ワークスペース" />
      <ErrorState code={PAGE_ERROR.loadFailed} acts={[onRetry]} />
    </PageBody>
  );
}

export function WsListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const lq = useMemo(() => listQuery(sp), [sp]);
  const shell = useOpsShellData();
  const list = useOpsWorkspaces(lq);

  const go = (next: ListQuery) => router.push(`${HOME}${toSearch(next)}`);
  const relogin = list.data?.kind === "login";
  useEffect(() => {
    if (relogin) router.replace(`/ops/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [relogin, router, pathname]);

  if (shell.isPending || list.isPending || relogin) return null;
  const shellData = shell.data?.kind === "ok" ? shellOfData(shell.data.data) : null;
  const rows = list.data?.kind === "ok" ? rowsOf(list.data.data) : null;
  if (!shellData || !rows) return <Failed onRetry={() => void Promise.all([shell.refetch(), list.refetch()])} />;

  const s = statsView(shellData);
  const now = new Date();
  const chips: ListChip[] = VIEW_CHIPS.map(([v, label]) => ({
    label,
    count: s.chips[v],
    on: lq.view === v,
    onClick: () => go({ ...lq, view: v }),
  }));
  const plans: ListChip[] = PLAN_CHIPS.map(([p, label]) => ({
    label,
    count: s.chips[p],
    on: lq.plan === p,
    onClick: () => go({ ...lq, plan: lq.plan === p ? null : p }),
  }));
  return (
    <WsListPage
      rows={rows.map((r) => wsRowView(r, now))}
      query={lq.q}
      total={s.total}
      stats={s}
      chips={chips}
      plans={plans}
      onQuery={(q) => go({ ...lq, q: cleanQ(q) })}
      sort={TO_WS_SORT[lq.sort]}
      onSort={(v) => go({ ...lq, sort: TO_API_SORT[v] })}
      rowHref={(r) => `${HOME}/tenants/${encodeURIComponent(r.id)}`}
      onClear={() => go({ ...lq, q: "" })}
    />
  );
}
