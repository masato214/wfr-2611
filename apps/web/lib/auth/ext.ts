// /api/auth-ext（Kaname としての認証の段取り）を画面から呼ぶ。エラーは正本の形（code・message・一手）
import { call } from "@/lib/api/call";
import { apiBase, getToken, notifyUnauthorized, setToken } from "@/lib/api/client";
import { refreshSession } from "./client";
import { noticeMfaRequired } from "@/lib/mfa-gate";
import { noticeTermsRequired } from "@/lib/terms-gate";

export interface ExtError {
  status: number;
  code: string;
  message: string;
  field?: string;
  remaining?: number;
  retry_after_sec?: number;
}
export class AuthExtError extends Error implements ExtError {
  status: number;
  code: string;
  field?: string;
  remaining?: number;
  retry_after_sec?: number;
  constructor(e: ExtError) {
    super(e.message);
    this.status = e.status;
    this.code = e.code;
    if (e.field) this.field = e.field;
    if (e.remaining !== undefined) this.remaining = e.remaining;
    if (e.retry_after_sec !== undefined) this.retry_after_sec = e.retry_after_sec;
  }
}
export async function ext<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  const t = getToken();
  if (t) headers["authorization"] = `Bearer ${t}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const sentAt = Date.now(); // 同意し直し（K-53）：同意できた時刻より前に出した要求の 403 は見ない
  const res = await fetch(`${apiBase()}/api/auth-ext${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    code?: string;
    message?: string;
    field?: string;
    remaining?: number;
    retry_after_sec?: number;
  };
  // ログインが要る口で「入っていない」（鍵が切れた・会社の人が消えた）。空白のまま止めず、鍵を捨てて入り直しへ（D-086.4）。
  // ログインそのものの失敗（E-AUTH-001 等）は各画面が文言で出すので、ここでは UNAUTHENTICATED だけを見る
  if (res.status === 401 && json.code === "UNAUTHENTICATED") notifyUnauthorized();
  noticeTermsRequired(res.status, json.code, json.message, sentAt); // 同意し直しが要る（K-53）
  noticeMfaRequired(res.status, json.code, json.message); // 付けるまで進めない（K-319）
  if (!res.ok)
    throw new AuthExtError({
      status: res.status,
      code: json.code ?? String(res.status),
      message: json.message ?? "うまくいきませんでした。もう一度試してください",
      ...(json.field ? { field: json.field } : {}),
      ...(json.remaining !== undefined ? { remaining: json.remaining } : {}),
      ...(json.retry_after_sec !== undefined ? { retry_after_sec: json.retry_after_sec } : {}),
    });
  return json.data as T;
}
// 登録・待つ画面の状態・送り直しは契約の口（createSignup・getSignupStatus・resendSignupEmail）に移した（K-51・features/F1/sign-up）
/** 確認のリンクで確定する（契約の口 verifySignup・POST /api/v1/auth/sign-up/verify・K-52）。ここで初めて利用者と会社ができる。
 *  ログインの印が返ったら（signed_in）ブラウザに残す。別のアカウントでログイン中なら印は返らず、今のアカウントのまま（D-128.137）。
 *  前の道すじ /api/auth-ext/verify-signup は K-52 で消した */
export const verifySignup = async (token: string) => {
  const r = await call("verifySignup", { body: { token }, keepOn401: true, screenId: "verify-email" });
  if (r.ok && r.data.signed_in && r.data.token) {
    setToken(r.data.token);
    refreshSession(); // ログインの部品の見え方（セッションの印）にも新しいログインを知らせる
  }
  return r;
};
// ログイン（パスワード・確認のコード）は契約の口（signInWithPassword・verifySignInCode）を features/F1/login が直に呼ぶ。前の道すじの呼び手は K-316 で消した
// 招待の下見と参加は契約の口を features/F2/invite が直に呼ぶ。前の道すじ（/invitations/*）の呼び手は K-335 で消した
// 預けたログイン情報の一覧は契約の口（listCredentials）を features/F3/credentials が直に呼ぶ。前の道すじ（/vault/credentials）の画面の呼び手は K-356 で消した
/** 自分のこと（役割）。一覧では自分の行が返らないことがあるので専用の口から（D-086） */
export const me = () =>
  ext<{ member_id: string; tenant_id: string; display_name: string | null; role_id: string | null }>(
    "/me",
    undefined,
    "GET",
  );

/** はじめの設定の進み具合（D-089）。0＝まだ何もしていない、6＝通し終わり */
export const setupState = () => ext<{ step: number; total: number }>("/setup-state", undefined, "GET");
export const setupStepDone = (step: number) => ext<{ step: number; total: number }>("/setup-step", { step });

// ---- 自分のAIに言う・いまどうなっているか（D-090・D-104）
export interface AgentMsg {
  id: string;
  /** me＝自分が言ったこと、ai＝返ってきたこと、stopped＝ここで止まりました（理由だけ）、note＝許可した／しなかった の記録、memo＝覚えました（D-105.1） */
  who: "me" | "ai" | "stopped" | "note" | "memo";
  /** memo のとき、入れた記憶の id */
  memory_id?: string | null;
  text: string;
  at: string;
  job_id?: string | null;
  /** 引用して続けた一部（D-104.17） */
  quote?: { text: string; message_id: string | null } | null;
  /** 終わった作業の 1 行（N つの操作・時間。D-104.8） */
  work?: { ops: number; ms: number } | null;
  attachments?: { id: string; name: string; mime?: string; size?: number }[] | null;
}
export interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}
export interface WorkTool {
  at: string;
  name: string;
  target: string;
  ok: boolean;
  ms: number | null;
}
/** 動いている仕事のいま（D-104.8）：何をしているかの 1 行・手順・道具の行・書きかけの返事 */
export interface Work {
  job_id: string;
  state: "running" | "asking";
  started_at: string | null;
  elapsed_ms: number;
  status: string | null;
  plan: Todo[] | null;
  tools: WorkTool[];
  partial: string | null;
  stopping: boolean;
  permission_mode: PermissionMode;
  /** 最後に動いた時刻（途中経過・書きかけ・状態の変化） */
  last_at?: string | null;
}
import type { DefaultMode, PermissionMode } from "@/lib/agent-modes";
export type { PermissionMode } from "@/lib/agent-modes";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
/** 使用量（D-104.16）：5 時間の枠・週の枠。割合（0〜1）と戻る時刻 */
export type Usage = Partial<
  Record<"five_hour" | "week", { utilization: number; resets_at: string; observed_at: string }>
>;
export interface Asking {
  job_id: string;
  request_id: string;
  tool: string | null;
  summary: string | null;
  input: unknown;
  at: string;
  /** AI社員からの問いならその名前（D-104.14） */
  by?: string | null;
}
export interface QueuedItem {
  id: string;
  kind: "steer" | "job";
  job_id: string;
  text: string | null;
  at: string;
}
export interface AgentState {
  conversation_id: string | null;
  conversation: { id: string; title: string; starred: boolean; incognito: boolean } | null;
  messages: AgentMsg[];
  /** 待っている・動いている仕事。あるあいだは作業中 */
  running_job_id: string | null;
  /** いちばん新しい仕事が止まっていて、その後に何も言っていないとき（理由だけ出す。D-104.15） */
  stopped: { job_id: string; reason: string } | null;
  progress?: { at: string; text: string | null }[];
  asking?: Asking | null;
  work?: Work | null;
  /** 順番待ち（D-104.9）：steer＝動いている仕事に次の区切りで渡す一言／job＝後ろに並んだ仕事。どちらも取り消せる */
  queued?: QueuedItem[];
  /** この会話に並んだ仕事が、別の会話の仕事の後ろで待っている（本人の PC の Claude Code は一度に 1 つ） */
  waiting_on?: { conversation_id: string; title: string; asking: boolean } | null;
  usage?: Usage;
}
export interface BridgeState {
  connected: boolean;
  /** 最後の知らせが 75 秒以内か。つながった記録があっても、止まっていれば false（G-12） */
  live: boolean;
  device_label?: string;
  last_seen_sec?: number;
  /** fix=update は Bridge が古い（入れ直しが要る・E-CONN-012） */
  health?: { name: string; ok: boolean; detail?: string; fix?: string | null }[] | null;
  health_at?: string | null;
  /** この端末で AI が使うブラウザ（D-120.1）。Kaname が正本 */
  browser?: AgentBrowser;
  /** この PC の Claude Code がふだん使うモデル（例 claude-opus-4-8）。何も選んでいないときにボタンへ出す */
  cli_model?: string | null;
}
export type AgentBrowser = "chrome" | "dedicated" | "off";
/** どこで話しかけられたか（D-103）。会話には出さず、自分のAI に渡す指示にだけ添える */
export interface AgentContext {
  screen: string;
  screen_name?: string;
  selected?: string;
}
/** 言う（D-104）。モード・モデル・強さ・資料・引用は選んだときだけ乗せる。全部許可は本人がこの会話で選んだときだけ */
export interface SayBody {
  text: string;
  conversation_id?: string;
  branch_from?: string;
  context?: AgentContext;
  permission_mode?: PermissionMode;
  model?: string;
  effort?: Effort;
  attachment_ids?: string[];
  quote?: { text: string; message_id: string | null };
}
export const agentSay = (b: SayBody) => ext<{ conversation_id: string; job_id: string }>("/agent/say", b);
/** 確認に答える（旧：許可する／許可しない）。答えは証跡に残る（D-093.8） */
export const agentAnswer = (job_id: string, request_id: string, allow: boolean) =>
  ext<{ ok: boolean }>("/agent/answer", { job_id, request_id, allow });
/** 許可の 3 択＋一言・問い合わせの答え（D-104.7・D-104.14） */
export const agentAnswer2 = (b: {
  job_id: string;
  request_id: string;
  allow: boolean;
  scope?: "once" | "always";
  note?: string;
  answers?: Record<string, string>;
}) => ext<{ ok: boolean }>("/agent/answer2", b);
export const agentResume = (job_id: string, how: "continue" | "restart" | "cancel") =>
  ext<{ job_id: string }>("/agent/resume", { job_id, how });
export const agentState = (conversationId?: string | null) =>
  ext<AgentState>(
    `/agent/state${conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ""}`,
    undefined,
    "GET",
  );
/** 会話の一覧（D-104.1）：星が上・新しい順。q で名前と中身を探す */
export interface ConversationItem {
  id: string;
  title: string;
  title_auto: boolean;
  starred: boolean;
  incognito: boolean;
  updated_at: string;
  unread: number;
  hit: string | null;
}
export const agentConversations = (q?: string) =>
  ext<ConversationItem[]>(`/agent/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`, undefined, "GET");
export const agentNewConversation = (incognito = false) =>
  ext<{ conversation_id: string }>("/agent/conversations", { incognito });
export const agentConversationSet = (id: string, b: { title?: string; starred?: boolean; incognito?: boolean }) =>
  ext<{ ok: boolean }>(`/agent/conversations/${encodeURIComponent(id)}`, b, "PATCH");
export const agentConversationDelete = (id: string) =>
  ext<{ ok: boolean }>(`/agent/conversations/${encodeURIComponent(id)}`, undefined, "DELETE");
export const agentMarkRead = (id: string) =>
  ext<{ ok: boolean }>(`/agent/conversations/${encodeURIComponent(id)}/read`, {});
/** 止める（動いているもの）／順番待ちを取り消す（D-104.9） */
export const agentStop = (job_id: string) => ext<{ state: string }>("/agent/stop", { job_id });
/** 止めずに方向を直す（次の区切りで効く。それまでは順番待ちで取り消せる） */
/** 動いている仕事に一言。送ったときのモード・モデルも添える（区切りに間に合わず次の仕事になったときに使う） */
export const agentSteer = (
  job_id: string,
  text: string,
  opts: { permission_mode?: string; model?: string | null; effort?: string | null } = {},
) => ext<{ ok: boolean }>("/agent/steer", { job_id, text, ...opts });
export const agentSteerCancel = (id: string) =>
  ext<{ ok: boolean }>(`/agent/steer/${encodeURIComponent(id)}`, undefined, "DELETE");
/** 「いつも許可」の一覧と既定のモード（ルール › 個人・D-104.14） */
export const agentPermissionRules = () =>
  ext<{ rules: { id: string; tool: string; target: string | null; at: string }[]; default_mode: PermissionMode }>(
    "/agent/permission-rules",
    undefined,
    "GET",
  );
export const agentPermissionRevoke = (id: string) =>
  ext<{ ok: boolean }>(`/agent/permission-rules/${encodeURIComponent(id)}`, undefined, "DELETE");
export const agentSetDefaultMode = (mode: DefaultMode) => ext<{ ok: boolean }>("/agent/default-mode", { mode });
export const agentUsage = () => ext<Usage>("/agent/usage", undefined, "GET");
/** 資料を付ける（D-104.11）。置き場に置いてから id が返る。置けなければ理由つきで失敗（E-CHAT-002・E-LIM-002） */
export async function agentAttach(file: File): Promise<{ id: string; name: string; mime: string; size: number }> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const headers: Record<string, string> = { accept: "application/json" };
  const tk = getToken();
  if (tk) headers["authorization"] = `Bearer ${tk}`;
  const sentAt = Date.now();
  const res = await fetch(`${apiBase()}/api/auth-ext/agent/attachments`, { method: "POST", headers, body: fd });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id: string; name: string; mime: string; size: number };
    code?: string;
    message?: string;
  };
  if (res.status === 401 && json.code === "UNAUTHENTICATED") notifyUnauthorized();
  noticeTermsRequired(res.status, json.code, json.message, sentAt); // 同意し直しが要る（K-53）
  noticeMfaRequired(res.status, json.code, json.message); // 付けるまで進めない（K-319）
  if (!res.ok || !json.data)
    throw new AuthExtError({
      status: res.status,
      code: json.code ?? String(res.status),
      message: json.message ?? "資料を付けられませんでした",
    });
  return json.data;
}
export const bridgeState = () => ext<BridgeState>("/bridge/state", undefined, "GET");
/** AI が使うブラウザを、いまの端末について選ぶ（D-120.1）。次の仕事から効く */
export const agentSetBrowser = (browser: AgentBrowser) => ext<{ browser: AgentBrowser }>("/agent/browser", { browser });
/** もう一度確かめる（D-120.3）。Bridge が小さな仕事で Chrome を本当に使えるか試す。結果は PC の状態に出る */
export const agentBrowserCheck = () => ext<{ job_id: string }>("/agent/browser-check", {});
/** この端末を外す（自分の Bridge の端末だけ）。外した Bridge は次の要求で鍵を捨て、仕事を取りに来なくなる */
export const agentRevokeBridge = (session_id: string) =>
  ext<{ revoked: boolean }>("/agent/bridge-revoke", { session_id });
/** 「新しい会話」（D-062）。いまの 1 本を閉じる。前のやりとりは消えない */
export const agentNew = (conversation_id?: string | undefined) =>
  ext<{ closed: boolean }>("/agent/new", conversation_id ? { conversation_id } : {});

/** 長い会話は上へ戻ると古い分を読み込む（D-104.18） */
export const agentMessagesBefore = (conversationId: string, before: string) =>
  ext<{ messages: AgentMsg[]; has_more: boolean }>(
    `/agent/messages?conversation_id=${encodeURIComponent(conversationId)}&before=${encodeURIComponent(before)}`,
    undefined,
    "GET",
  );

// ---- 成果物（D-106）：返事から書き出す・横で開いて直す（保存で新しい版）・版を戻す（戻すのも新しい版）・落とす
export type ArtifactFormat = "md" | "csv" | string;
export interface ArtifactItem {
  id: string;
  title: string;
  format: ArtifactFormat;
  current_version: number;
  message_id: string | null;
  conversation_id: string | null;
  updated_at: string;
}
export interface ArtifactVersion {
  version: number;
  at: string;
  by: string;
  reverted_from: number | null;
  size: number | null;
  note: string | null;
}
export interface Artifact extends ArtifactItem {
  editable: boolean;
  /** いま開いている版（?version= で前の版を開いたときはその版） */
  viewing: number;
  /** 直せる種類（md・csv）の中身 */
  text?: string | null;
  /** 見るだけの種類（画像・PDF・動画・音声）の期限つきの場所 */
  url?: string | null;
  versions: ArtifactVersion[];
}
export const artifactList = (conversationId?: string | null) =>
  ext<ArtifactItem[]>(
    `/agent/artifacts${conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ""}`,
    undefined,
    "GET",
  );
export const artifactCreate = (b: { message_id: string; text: string; format?: "md" | "csv"; title?: string }) =>
  ext<Artifact>("/agent/artifacts", b);
export const artifactGet = (id: string, version?: number | null) =>
  ext<Artifact>(`/agent/artifacts/${encodeURIComponent(id)}${version ? `?version=${version}` : ""}`, undefined, "GET");
export const artifactSave = (id: string, text: string) =>
  ext<Artifact>(`/agent/artifacts/${encodeURIComponent(id)}/versions`, { text });
export const artifactRevert = (id: string, version: number) =>
  ext<Artifact>(`/agent/artifacts/${encodeURIComponent(id)}/revert`, { version });
export const artifactRename = (id: string, title: string) =>
  ext<{ ok: boolean }>(`/agent/artifacts/${encodeURIComponent(id)}`, { title }, "PATCH");
/** 今の版（か指定の版）の中身をファイルとして受け取る。名前は API が付けたもの */
export async function artifactDownload(id: string, version?: number | null): Promise<{ blob: Blob; name: string }> {
  const headers: Record<string, string> = {};
  const tk = getToken();
  if (tk) headers["authorization"] = `Bearer ${tk}`;
  const res = await fetch(
    `${apiBase()}/api/auth-ext/agent/artifacts/${encodeURIComponent(id)}/download${version ? `?version=${version}` : ""}`,
    { headers },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    if (res.status === 401 && j.code === "UNAUTHENTICATED") notifyUnauthorized();
    throw new AuthExtError({
      status: res.status,
      code: j.code ?? String(res.status),
      message: j.message ?? "落とせませんでした",
    });
  }
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  return { blob: await res.blob(), name: m ? decodeURIComponent(m[1]!) : "成果物" };
}

// ---- たたき台と預けたログイン情報（D-108）
export interface DraftGoal {
  id: string;
  name: string;
  target_value: number | string | null;
  unit: string;
  scope: string;
  period_start: string | null;
  period_end: string | null;
}
export interface OnboardDraft {
  goals: DraftGoal[];
  ledgers: { id: string; name: string; stages: string[]; fields: string[] }[];
  duties: { id: string; name: string; staff: string; summary: string; origin: "distributed" | "company" }[];
}
export const onboardDraft = () => ext<OnboardDraft>("/onboard/draft", undefined, "GET");
/** 5 テストで動かす（T-U-11・D-028）：AI社員ごとの最新のテストの実行と、出てきた成果物 */
export type TestRunStatus = "running" | "done" | "stopped" | "cancelled";
export interface TestRunEmployee {
  employee_id: string;
  name: string;
  duty_id: string | null;
  duty: string;
  run: { id: string; status: TestRunStatus; reason: string | null; finished_at: string | null; count: number } | null;
}
export interface OnboardTestrun {
  employees: TestRunEmployee[];
  outputs: { id: string; title: string; format: string; at: string; employee: string }[];
  /** 全員が 完了 か「この仕事はやめる」＝本番に切り替えられる（D-116.4） */
  ready: boolean;
}
export const onboardTestrun = () => ext<OnboardTestrun>("/onboard/testrun", undefined, "GET");
export const testrunCancel = (run_id: string) => ext<{ ok: boolean }>("/onboard/testrun/cancel", { run_id });
/** 6 本番に切り替える（T-U-12・D-116.5）：切り替える前の確認。red＝押せない・warn＝承知すれば押せる・paused＝止めたまま本番へ */
export type GoLiveLevel = "ok" | "warn" | "red" | "paused";
export interface GoLiveCheck {
  id: string;
  level: GoLiveLevel;
  title: string;
  detail: string;
  fix?: { label: string; href: string };
  employee_id?: string;
}
export interface OnboardGoLive {
  checks: GoLiveCheck[];
  schedule: { duty: string; staff: string; paused: boolean }[];
  red: number;
  warn: number;
  /** 赤が 0 ＝ 切り替えられる */
  ready: boolean;
  /** 赤の文（E-DEP-004）。赤が無ければ null */
  shortfall: string | null;
  /** 切り替えた日時と人。まだなら null */
  live: { at: string; by: string } | null;
  step: number;
}
export const onboardGoLive = () => ext<OnboardGoLive>("/onboard/golive", undefined, "GET");
export const goLiveSwitch = (accept_warnings: boolean) =>
  ext<{ ok: boolean; live_at: string }>("/onboard/golive", { accept_warnings });
export const goLivePause = (employee_id: string, paused: boolean, reason = "") =>
  ext<{ ok: boolean }>("/onboard/golive/pause", { employee_id, paused, reason });
