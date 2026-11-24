"use client";
// 運営の画面の入れ物（K-946）。/ops の頁を運営の外枠（ops-shell）で包む。顧客の外枠は使わない（D-156.1）。
//   外枠の口（getOpsShell）を 1 回読み、401・403 FORBIDDEN（入っていない・役が違う）は運営のログインへ（顧客の画面へは送らない）、
//   403 MFA_REQUIRED（パスキーを付けるだけのセッション・K-945）は /ops/setup へ。ほかの失敗は数の印だけ出さない（文は足さない）。
//   /ops/login と /ops/setup は包まない（外枠の口を呼ばない）。右上の人はログインの人（認証の部品のセッションの名前）
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Crumb } from "@/components/k/shell";
import { useSession } from "@/lib/auth/session";
import { OPS_NAV, OPS_TEAM_NAV, OpsShell, type OpsNavItem, type OpsScreen } from "./ops-shell";
import { useOpsShell } from "./use-ops-shell";

/** 包まない道（ログインと、パスキーを付ける画面） */
export const OPS_OPEN_PATHS = ["/ops/login", "/ops/setup"] as const;
/** 左のバーの本番の行き先 */
export const OPS_HREFS: Record<OpsNavItem["key"], string> = {
  home: "/ops",
  support: "/ops/support",
  notices: "/ops/notices",
  billing: "/ops/billing",
  skills: "/ops/skills",
  team: "/ops/team",
};

const HOME = "/ops";

/** 戻す先は /ops の中の道だけ（//・http・/login・/ops/login などは /ops・TP-AUTH-08） */
export function safeOpsNext(next: string | null): string {
  if (!next || next.includes("\\") || next.startsWith("//")) return HOME;
  const path = next.split(/[?#]/)[0]!;
  if (path !== HOME && !path.startsWith(`${HOME}/`)) return HOME;
  if (path === "/ops/login" || path.startsWith("/ops/login/")) return HOME;
  return next;
}

const isOpen = (path: string) => OPS_OPEN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** 道から、左のバーの印を付ける画面を決める（ワークスペースの一覧と 1 社はワークスペース） */
export function opsScreenOf(path: string): OpsScreen {
  for (const it of [...OPS_NAV, OPS_TEAM_NAV])
    if (it.key !== "home" && under(path, OPS_HREFS[it.key])) return it.screens[0]!;
  return "ops-home";
}
const navOf = (screen: OpsScreen) =>
  [...OPS_NAV, OPS_TEAM_NAV].find((it) => it.screens.includes(screen)) ?? OPS_NAV[0]!;

/** 頁が外枠の「いまの場所」を渡す口（渡さなければ左のバーの項目の名前 1 つ） */
const CrumbsContext = createContext<((c: Crumb[] | null) => void) | null>(null);
export function useOpsCrumbs(crumbs: Crumb[]): void {
  const set = useContext(CrumbsContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    set?.(JSON.parse(key) as Crumb[]);
    return () => set?.(null);
  }, [set, key]);
}

function Frame({ path, children }: { path: string; children: ReactNode }) {
  const router = useRouter();
  const shell = useOpsShell();
  const { session } = useSession();
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  const r = shell.data;
  useEffect(() => {
    if (r?.kind === "login") router.replace(`/ops/login?next=${encodeURIComponent(path + window.location.search)}`);
    else if (r?.kind === "setup") router.replace("/ops/setup");
  }, [r, router, path]);
  // 外枠の口の答えが来るまで・移る間は描かない（入っていない人に運営のメニューを見せない）
  if (shell.isPending || r?.kind === "login" || r?.kind === "setup") return null;
  const screen = opsScreenOf(path);
  const name = session?.user.name || session?.user.email || "";
  const counts = r?.kind === "ok" ? r.counts : {};
  return (
    <CrumbsContext.Provider value={setCrumbs}>
      <OpsShell
        screen={screen}
        crumbs={crumbs ?? [{ label: navOf(screen).label }]}
        badges={counts}
        operator={{ name, initial: name.slice(0, 1) }}
        hrefs={OPS_HREFS}
      >
        {children}
      </OpsShell>
    </CrumbsContext.Provider>
  );
}

export function OpsFrame({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/ops";
  if (isOpen(path)) return <>{children}</>;
  return <Frame path={path}>{children}</Frame>;
}
