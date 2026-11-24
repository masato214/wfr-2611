// メンバーの並びを読む（K-420・口 getWorkspaceMembers は K-419）と、口の答えを部品の形（MemberGroup）に直す。
//   1 画面 1 回（StrictMode でも口は 1 回）。招いたあとは invalidate で 1 回だけ読み直す（鍵 MEMBERS_KEY）。
//   画面が字を決める（D-148.48）：PC ok＝「分身 動いている」・away＝「PC <N> 日つながっていない」・none＝「分身なし（見るだけ）」・never＝「PC をまだつないでいない」
//   兼ねる人は主のグループの行に「<名前>も兼ねる」・兼ねる側の行に「兼ねている」・自分の行に「自分」。招待中は「あと <N> 日」
import { useQuery } from "@tanstack/react-query";
import { call } from "@/lib/api/call";
import type { InviteGroup, MemberGroup, MemberRow } from "./views";

export const MEMBERS_KEY = ["k420", "members"] as const;
export const SCREEN = "members";

/** 口の答え（K-419 の形）。契約の型は中身を持たないので、ここで読む形を決める */
interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  primary?: boolean;
  other_groups?: string[];
  self?: boolean;
  pc?: "ok" | "away" | "never" | "none";
  pc_days_away?: number | null;
}
interface GroupAnswer {
  id: string;
  /** scopes.ticket_prefix（会社のグループなどは null） */
  code: string | null;
  name: string;
  members: Person[];
}
interface InvitedAnswer {
  id: string;
  email: string;
  scope_id: string;
  role: string;
  left_days: number;
}
interface MembersAnswer {
  groups: GroupAnswer[];
  invitations: InvitedAnswer[];
  count: number;
}

export interface MembersView {
  groups: MemberGroup[];
  /** 招くの小窓のグループの選ぶ欄 */
  scopes: InviteGroup[];
  count: number;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "管理者",
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  staff: "メンバー",
  viewer: "閲覧のみ",
  requester: "依頼する側",
};
const TONES: MemberGroup["tone"][] = ["teal", "plum", "amber", "indigo"];

function stateOf(p: Person): Pick<MemberRow, "state" | "stateTone"> {
  switch (p.pc) {
    case "ok":
      return { state: "分身 動いている", stateTone: "ok" };
    case "away":
      return {
        state: p.pc_days_away != null ? `PC ${p.pc_days_away} 日つながっていない` : "PC つながっていない",
        stateTone: "warn",
      };
    case "never":
      return { state: "PC をまだつないでいない", stateTone: "none" };
    default:
      return { state: "分身なし（見るだけ）", stateTone: "none" };
  }
}

function noteOf(p: Person): string | undefined {
  const parts = [
    ...(p.self ? ["自分"] : []),
    ...(p.primary === false ? ["兼ねている"] : []),
    ...(p.other_groups?.length ? [`${p.other_groups.join("・")}も兼ねる`] : []),
  ];
  return parts.length ? parts.join("・") : undefined;
}

const toRow = (p: Person): MemberRow => {
  const note = noteOf(p);
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: ROLE_LABEL[p.role] ?? p.role,
    ...stateOf(p),
    ...(note ? { note } : {}),
  };
};

/** 口の答え → 部品の形。招待中の行は、招いたグループの人の並びの後ろに付ける */
export function toView(a: MembersAnswer): MembersView {
  const groups = a.groups.map((g, i): MemberGroup => {
    const invited = a.invitations
      .filter((v) => v.scope_id === g.id)
      .map((v): MemberRow => ({
        id: v.id,
        name: "",
        email: v.email,
        role: ROLE_LABEL[v.role] ?? v.role,
        state: "",
        stateTone: "none",
        invitedLeft: `${v.left_days} 日`,
      }));
    // 頭の字は左のバーと同じ決め方（ticket_prefix が無ければ名前の頭の 1 字・ticket-shell.tsx）
    return {
      id: g.id,
      code: g.code || g.name.slice(0, 1),
      name: g.name,
      tone: TONES[i % TONES.length]!,
      rows: [...g.members.map(toRow), ...invited],
    };
  });
  return { groups, scopes: a.groups.map((g) => ({ id: g.id, name: g.name })), count: a.count };
}

export function useMembers() {
  return useQuery({
    queryKey: MEMBERS_KEY,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<MembersView> => {
      const r = await call("getWorkspaceMembers", { screenId: SCREEN });
      if (!r.ok) throw Object.assign(new Error(r.code), { result: r });
      return toView(r.data as unknown as MembersAnswer);
    },
  });
}

// ---------------------------------------------------------------- 宛てをそろえる（登録と同じ：NFKC・空白を消す・小文字）
export const normalizeEmail = (v: string): string => v.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (v: string): boolean => EMAIL_RE.test(v);

/** 欄の字をカンマ（全角も）・改行で分け、そろえる。空は捨てる（同じ宛ての重なりは足す側で外す） */
export const splitEmails = (v: string): string[] =>
  v
    .split(/[,，、\n]/)
    .map(normalizeEmail)
    .filter((s) => s !== "");
