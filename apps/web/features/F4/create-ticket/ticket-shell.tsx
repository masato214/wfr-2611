"use client";
// チケットの画面の外枠（K-60・K-138）。キャンバスどおりの新しい外枠（components/k の Shell・D-143.1）に載せる。
//   役と名前は前からある口（/api/auth-ext/me）を useMyRoles と同じ問い合わせ（鍵 ["me"]）で読む（契約の口 getMe は K-70）。
//     読み中・失敗（401 など）・役の値が分からない（null・知らない値）あいだは役を渡さない：役の項目を出さない
//   会社名は自分の情報の口の答えの workspace_name（口の側は K-253）。在れば頭文字と会社名、無ければどちらも出さない（D-145.16）
//   外枠が読む口（グループ・承認待ちの数・PC）は 1 画面で 1 回ずつ。承認待ちの数は一覧の右の列と同じ問い合わせ（APPROVALS_KEY・K-235）。読み続けない・窓に戻っても読み直さない（G-16）。
//     グループの口は作る面の選択肢と同じ問い合わせ（SCOPES_KEY）で分け合う。失敗したら、その部分を出さないだけ（本文は出す）
//   本当の値が無い物（グループの件数・知らせの数）は出さない（D-144.3）。承認待ちの数はどの画面でも出す（D-144.5）
//   グループの行は絞り込みができるまでグレーで押せない（D-145.18）
//   PC の状態は、画面が自分で PC の一覧を読み続けるとき（PC をつなぐ・K-220）は画面の答えを受け取り、外枠は読まない（口を二重に呼ばない）
//   右の自分のAIのパネルは出さない（チケットは PC をつないでいなくても作れる・D-127.8）
import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Shell, type Crumb, type Group } from "@/components/k";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { signOut } from "@/lib/auth";
import { me } from "@/lib/auth/ext";
import type { RoleId } from "@/lib/nav";
import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

/** members.role_id → 主ナビの役（役ごとの並べ方は flow.json の sections_by_role）。ここに無い値は役を渡さない */
const ROLE_OF: Record<string, RoleId> = { owner: "R1", admin: "R1", staff: "R3", viewer: "R4", ops: "R6" };
/** グループの札の色（データの色の順に回す。キャンバスは 営業 teal・受託開発 plum・経理 amber） */
const TONES: Group["tone"][] = ["teal", "plum", "amber", "indigo", "coral", "sage", "lavender", "teal-light"];
/** 外枠の口は 1 画面で 1 回：自分では読み直さない */
export const ONCE = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export interface ScopeRow {
  id: string;
  name: string;
  tenant_id?: string;
  /** 番号の頭（EG など）。在れば札に使う（キャンバスの札と同じ物） */
  ticket_prefix?: string | null;
}
export interface Scopes {
  rows: ScopeRow[];
  /** 書けるグループの id（口の meta.writable） */
  writable: string[];
}
/** グループの口の問い合わせの鍵（外枠と作る面の選択肢で分け合う） */
export const SCOPES_KEY = ["k138-shell", "scopes"] as const;

export async function readScopes(screen: string): Promise<Scopes> {
  const r = await call("listScopes", { screenId: screen });
  if (!r.ok) throw Object.assign(new Error(r.code), { result: r });
  const writable = ((r.meta["writable"] as unknown[] | undefined) ?? []).map(String);
  return { rows: r.data as unknown as ScopeRow[], writable };
}
/** 承認待ちの口の問い合わせの鍵（外枠の数と一覧の右の列「自分の承認を待っているもの」で分け合う・K-235）。
 *  1 本の問い合わせ（5 件）で、数は答えの meta.counts.total、行は答えの data から読む */
export const APPROVALS_KEY = ["k138-shell", "approvals"] as const;
export const APPROVALS_LIMIT = 5;
export interface ApprovalsAnswer {
  rows: Record<string, unknown>[];
  total: number;
}
export async function readApprovals(screen: string): Promise<ApprovalsAnswer> {
  const r = await call("listApprovalQueue", { query: { limit: APPROVALS_LIMIT }, screenId: screen });
  if (!r.ok) throw new Error(r.code);
  const total = Number(((r.meta["counts"] ?? {}) as { total?: number }).total ?? 0);
  return { rows: r.data as unknown as Record<string, unknown>[], total };
}

/** 作る面がグループを読む（外枠が読んでいれば同じ答えを使い、口を 2 回呼ばない） */
export const fetchScopes = (qc: QueryClient, screen: string): Promise<Scopes> =>
  qc.fetchQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes(screen), ...ONCE });

export interface TicketShellProps {
  /** いま見ている画面（flow の screen id）。左のメニューの今いる項目になる */
  screen: "tickets" | "approvals" | "bridge-setup" | "mfa-setup" | "credentials" | "members";
  /** 上の帯のいまの場所 */
  crumbs: Crumb[];
  /** 左のメニューの数（まとまりの鍵 → 数）。承認待ちの画面は自分で読んだ数を渡す（外枠は二重に読まない） */
  counts?: Partial<Record<string, number>>;
  /** 作るボタンを押したとき（一覧の画面はその場で作る面を開く）。無ければ /tickets?new=1 へ移る。書けるグループが無い人には出さない */
  onCreate?: () => void;
  /** 画面が読んだ PC の状態（true＝つながっている・null＝まだ読んでいる）。渡されたら外枠は PC の一覧を読まない（K-220） */
  bridgeConnected?: boolean | null;
  /** 左のバーを 56 に畳ませる（一覧で横に詳細を開いた 1024〜1279・K-252） */
  railed?: boolean;
  children: ReactNode;
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${THEME_COOKIE}=`));
  return parseTheme(hit?.slice(THEME_COOKIE.length + 1));
}

/** 自分の情報の口の答え（前からある口・会社名の欄は K-253 が足す） */
type Me = Awaited<ReturnType<typeof me>> & { workspace_name?: string | null };

function useShellData(screen: string, ownCount: boolean, ownBridge: boolean) {
  const signedIn = typeof window !== "undefined" && Boolean(getToken());
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled: signedIn, ...ONCE });
  const scopes = useQuery({
    queryKey: SCOPES_KEY,
    enabled: signedIn,
    ...ONCE,
    queryFn: () => readScopes(screen),
  });
  const waiting = useQuery({
    queryKey: APPROVALS_KEY,
    enabled: signedIn && !ownCount,
    ...ONCE,
    queryFn: () => readApprovals(screen),
    select: (a: ApprovalsAnswer): number => a.total,
  });
  const devices = useQuery({
    queryKey: ["k138-shell", "devices"],
    enabled: signedIn && !ownBridge,
    ...ONCE,
    queryFn: async (): Promise<boolean> => {
      const r = await call("listMyDevices", { screenId: screen });
      if (!r.ok) throw new Error(r.code);
      return (r.data as unknown as { state: string }[]).some((d) => d.state === "live");
    },
  });
  return { who, scopes, waiting, devices };
}

/** グループの札の色（左のメニューの札と同じ色の順・グループの一覧の見出しの札にも使う） */
export const scopeTone = (rows: ScopeRow[], id: string): Group["tone"] =>
  TONES[
    Math.max(
      0,
      rows.findIndex((s) => s.id === id),
    ) % TONES.length
  ]!;

export function TicketShell({ screen, crumbs, counts, onCreate, bridgeConnected, railed, children }: TicketShellProps) {
  const ownCount = counts?.["approvals"] !== undefined;
  const ownBridge = bridgeConnected !== undefined;
  const { who, scopes, waiting, devices } = useShellData(screen, ownCount, ownBridge);
  const mine = who.isSuccess ? (who.data as Me) : null;
  // 役は口が答え、値が分かるときだけ（読み中・失敗・知らない値は役なし＝役の項目を出さない）
  const role = mine?.role_id ? ROLE_OF[mine.role_id] : undefined;
  const name = mine?.display_name ?? "";
  const company = mine?.workspace_name?.trim() ?? "";
  const groups: Group[] = (scopes.data?.rows ?? []).map((s, i) => ({
    code: s.ticket_prefix || s.name.slice(0, 1),
    name: s.name,
    href: `/tickets?scope=${encodeURIComponent(s.id)}`,
    tone: TONES[i % TONES.length]!,
    pending: true,
  }));
  const approvals = ownCount ? counts?.["approvals"] : waiting.data;
  const badges = { ...counts, ...(approvals !== undefined ? { approvals } : {}) };
  const canCreate = (scopes.data?.writable.length ?? 0) > 0;
  return (
    <Shell
      {...(role ? { role } : {})}
      screen={screen}
      crumbs={crumbs}
      workspace={{ name: company, initial: company.slice(0, 1) }}
      member={{ name, initial: name.slice(0, 1) }}
      groups={groups}
      badges={badges}
      bridgeConnected={ownBridge ? bridgeConnected === true : devices.data === true}
      theme={readTheme()}
      {...(railed ? { railed } : {})}
      {...(canCreate ? { onCreate: onCreate ?? (() => window.location.assign("/tickets?new=1")) } : {})}
      onSignOut={() => {
        void signOut().finally(() => window.location.assign("/login"));
      }}
    >
      <div data-ticket-shell>{children}</div>
    </Shell>
  );
}
