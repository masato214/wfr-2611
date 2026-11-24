// 運営のワークスペースの一覧（K-965）の、口の答え → 部品の値と、URL の絞り込みの読み書き。画面の外の純粋な関数（@/ を読まない）。
//   答えの形は 11_tickets/K-1006.md の「画面が使う答えの形」。字は下絵（ops-sample.ts の WS_ROWS・views-list.tsx の上の数）が正
import type { WsRow } from "./ops-sample";

// ---------------------------------------------------------------- 口の答えの形（使う欄だけ）
export interface OpsAttention {
  /** stuck・pc・overdue。知らない種類（前の limit を含む）は出さない */
  kind: string;
  label_value: number;
}
export interface OpsWsRowAnswer {
  id: string;
  name: string;
  admin_name: string;
  plan_name: string | null;
  members: { count: number; limit: number | null };
  pc: { connected: number; total: number } | null;
  runs_month: number | null;
  attention: readonly OpsAttention[];
  billing_state: string | null;
  state: string;
  state_since: string;
}
export interface OpsShellAnswer {
  invoices: { overdue_count: number; overdue_amount: number } | null;
  workspaces: {
    total: number;
    active: number;
    stopped: number;
    closing: number;
    attention: number;
    by_plan: { free: number; team: number; business: number };
  };
  runs_month: { count: number; prev_ratio: number | null };
}

// ---------------------------------------------------------------- 形の確かめ（違えば読めなかったとして扱う・G-15）
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

function isRow(v: unknown): v is OpsWsRowAnswer {
  if (!isObj(v) || !isStr(v["id"]) || !isStr(v["name"]) || !isStr(v["admin_name"]) || !isStr(v["state"])) return false;
  const m = v["members"];
  if (!isObj(m) || !isNum(m["count"]) || !(m["limit"] === null || isNum(m["limit"]))) return false;
  const att = v["attention"];
  if (!Array.isArray(att) || !att.every((a) => isObj(a) && isStr(a["kind"]) && isNum(a["label_value"]))) return false;
  return isStr(v["state_since"]);
}

/** 一覧の答えの data（行の並び）。形が違えば null */
export function rowsOf(data: unknown): OpsWsRowAnswer[] | null {
  return Array.isArray(data) && data.every(isRow) ? (data as OpsWsRowAnswer[]) : null;
}

/** 外枠の答えの data。上の数に使う欄の形が違えば null */
export function shellOfData(data: unknown): OpsShellAnswer | null {
  if (!isObj(data)) return null;
  const ws = data["workspaces"];
  const runs = data["runs_month"];
  const inv = data["invoices"];
  if (!isObj(ws) || !isObj(ws["by_plan"]) || !isObj(runs) || !isNum(runs["count"])) return null;
  const nums = ["total", "active", "stopped", "closing", "attention"].every((k) => isNum(ws[k]));
  const plans = ["free", "team", "business"].every((k) => isNum((ws["by_plan"] as Record<string, unknown>)[k]));
  const ratioOk = runs["prev_ratio"] === null || isNum(runs["prev_ratio"]);
  const invOk = inv === null || (isObj(inv) && isNum(inv["overdue_count"]) && isNum(inv["overdue_amount"]));
  return nums && plans && ratioOk && invOk ? (data as unknown as OpsShellAnswer) : null;
}

// ---------------------------------------------------------------- 字
const DAY_MS = 86_400_000;
const JST_MS = 9 * 3_600_000;
const CLOSING_DAYS = 14;
const MONTH_DAYS = 30;
const DASH = "—";

const comma = (n: number): string => n.toLocaleString("en-US");
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の MM/DD */
function jstMonthDay(iso: string): string {
  const d = new Date(Date.parse(iso) + JST_MS);
  return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
}

function careOf(att: readonly OpsAttention[]): string {
  const first = att.find((a) => a.kind !== "overdue");
  if (first?.kind === "stuck") return `止まった実行 ${first.label_value}`;
  if (first?.kind === "pc") return `PC がまだ ${first.label_value} 日`;
  return DASH; // 無し・知らない種類（前の limit を含む・D-156.72）
}

function billOf(row: OpsWsRowAnswer): string {
  const over = row.attention.find((a) => a.kind === "overdue");
  if (over) {
    const n = over.label_value;
    return n < MONTH_DAYS ? `期限を過ぎた ${n} 日` : `未入金 ${Math.floor(n / MONTH_DAYS)} か月`;
  }
  if (row.billing_state === "overdue") return "期限を過ぎた";
  if (row.billing_state === "paid") return "払われた";
  if (row.billing_state === "unpaid") return "お支払い待ち";
  return DASH;
}

function statusOf(row: OpsWsRowAnswer, now: Date): Pick<WsRow, "status" | "tone"> {
  if (row.state === "active") return { status: "使っている", tone: "success" };
  if (row.state === "stopped") return { status: `止めている（${jstMonthDay(row.state_since)}〜）`, tone: "danger" };
  if (row.state === "closing") {
    const passed = Math.floor((now.getTime() - Date.parse(row.state_since)) / DAY_MS);
    return { status: `やめる手続き中（あと ${Math.max(0, CLOSING_DAYS - passed)} 日）`, tone: "warning" };
  }
  return { status: DASH, tone: "neutral" };
}

/** 一覧の答えの 1 行 → 部品の 1 行（止めている会社の PC と実行は —） */
export function wsRowView(row: OpsWsRowAnswer, now: Date): WsRow {
  const stopped = row.state === "stopped";
  const { count, limit } = row.members;
  return {
    id: row.id,
    name: row.name,
    admin: row.name === row.admin_name ? "個人" : `管理者 ${row.admin_name}`,
    plan: (row.plan_name ?? DASH) as WsRow["plan"],
    people: limit === null ? String(count) : `${count} / ${limit}`,
    pc: stopped || !row.pc ? DASH : `${row.pc.connected} / ${row.pc.total}`,
    runs: stopped || row.runs_month === null ? DASH : comma(row.runs_month),
    care: careOf(row.attention),
    bill: billOf(row),
    ...statusOf(row, now),
  };
}

export interface ListStats {
  total: number;
  active: { value: string; sub: string };
  attention: string;
  runs: { value: string; sub: string | null };
  overdue: { value: string; sub: string | null };
  chips: {
    all: number;
    attention: number;
    stopped: number;
    closing: number;
    free: number;
    team: number;
    business: number;
  };
}

function ratioText(r: number | null): string | null {
  if (r === null || r === 1) return null;
  return r > 1 ? `先月より ${Math.round((r - 1) * 100)}% 多い` : `先月より ${Math.round((1 - r) * 100)}% 少ない`;
}

/** 外枠の答え → 上の数と絞り込みの札の数（お金を持たない人は請求の数を — ・D-156.67） */
export function statsView(shell: OpsShellAnswer): ListStats {
  const w = shell.workspaces;
  const inv = shell.invoices;
  return {
    total: w.total,
    active: { value: String(w.active), sub: `止めている ${w.stopped} ・ やめる手続き中 ${w.closing}` },
    attention: String(w.attention),
    runs: { value: comma(shell.runs_month.count), sub: ratioText(shell.runs_month.prev_ratio) },
    overdue: inv
      ? { value: `${inv.overdue_count} 件`, sub: `¥ ${comma(inv.overdue_amount)}（税込）` }
      : { value: DASH, sub: null },
    chips: {
      all: w.total,
      attention: w.attention,
      stopped: w.stopped,
      closing: w.closing,
      free: w.by_plan.free,
      team: w.by_plan.team,
      business: w.by_plan.business,
    },
  };
}

// ---------------------------------------------------------------- URL の絞り込み
export const VIEWS = ["all", "attention", "stopped", "closing"] as const;
export const PLANS = ["free", "team", "business"] as const;
export const SORTS = ["attention", "members", "runs"] as const;
export type ListView = (typeof VIEWS)[number];
export type ListPlan = (typeof PLANS)[number];
export type ListSort = (typeof SORTS)[number];
export interface ListQuery {
  view: ListView;
  plan: ListPlan | null;
  sort: ListSort;
  q: string;
}
export const DEFAULT_QUERY: ListQuery = { view: "all", plan: null, sort: "attention", q: "" };
const Q_MAX = 100;

const pick = <T extends string>(list: readonly T[], v: string | null): T | null =>
  v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;

/** 探す語：前後の空白を落として 100 字まで */
export const cleanQ = (v: string | null): string =>
  Array.from((v ?? "").trim())
    .slice(0, Q_MAX)
    .join("");

/** URL の問い合わせ → 絞り込み（知らない値は既定に戻す・口に送って 422 にしない） */
export function listQuery(sp: Pick<URLSearchParams, "get">): ListQuery {
  return {
    view: pick(VIEWS, sp.get("view")) ?? DEFAULT_QUERY.view,
    plan: pick(PLANS, sp.get("plan")),
    sort: pick(SORTS, sp.get("sort")) ?? DEFAULT_QUERY.sort,
    q: cleanQ(sp.get("q")),
  };
}

/** 絞り込み → URL と口の問い合わせ（view・plan・sort・q の順・既定の値は書かない） */
export function toSearch(lq: ListQuery): string {
  const sp = new URLSearchParams();
  if (lq.view !== DEFAULT_QUERY.view) sp.set("view", lq.view);
  if (lq.plan !== null) sp.set("plan", lq.plan);
  if (lq.sort !== DEFAULT_QUERY.sort) sp.set("sort", lq.sort);
  if (lq.q !== "") sp.set("q", lq.q);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
