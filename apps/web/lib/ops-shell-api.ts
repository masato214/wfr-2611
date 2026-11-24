// 運営の外枠の口（getOpsShell・GET /api/v1/ops/shell・形は K-1006）を読む（K-946）。
//   顧客の画面の共通の口（lib/api/client.ts の request・lib/api/call.ts）は通さない：あちらは 401 で顧客のログインへ、
//   403・E-AUTH-010 で顧客の同意し直しの画面へ移す（運営の場所はどちらにも乗らない・D-128.172）。
//   生の fetch は関門 C1 の決まりで apps/web/lib の中だけに置く。印は顧客の画面と同じ Bearer（lib/api/client の getToken）
import { apiBase, getToken } from "@/lib/api/client";

export const OPS_SHELL_PATH = "/api/v1/ops/shell";

/** 外枠が使う数だけ（K-1006 の答えの形の一部）。生成した型の版によらず読めるよう、使う欄だけを持つ */
export interface OpsShellCounts {
  /** 問い合わせの未担当の数 */
  support?: number;
  /** 期限を過ぎた請求の数（お金を持たない人は請求の欄が null で、数も無い） */
  billing?: number;
}

/** 外枠の口の結果：読めた／入り直し（401・403 FORBIDDEN）／パスキーを付けるだけのセッション（403 MFA_REQUIRED）／それ以外の失敗 */
export type OpsShellResult =
  { kind: "ok"; counts: OpsShellCounts } | { kind: "login" } | { kind: "setup" } | { kind: "failed" };

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;

/** 答えの体から数だけを拾う（形が違えば数を出さない） */
export function countsOf(body: unknown): OpsShellCounts {
  const data = obj(obj(body)?.["data"]);
  const support = num(obj(data?.["inbox"])?.["unassigned"]);
  const billing = num(obj(data?.["invoices"])?.["overdue_count"]);
  return { ...(support === undefined ? {} : { support }), ...(billing === undefined ? {} : { billing }) };
}

/** 失敗の答えの code（読めなければ空） */
async function codeOf(res: Response): Promise<string> {
  const b = obj(await res.json().catch(() => null));
  const c = b?.["code"] ?? b?.["error"];
  return typeof c === "string" ? c : "";
}

export async function fetchOpsShell(): Promise<OpsShellResult> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${OPS_SHELL_PATH}`, {
      method: "GET",
      headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      credentials: "omit",
    });
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (res.ok) return { kind: "ok", counts: countsOf(await res.json().catch(() => null)) };
  if (res.status === 401) return { kind: "login" };
  if (res.status === 403) {
    const code = await codeOf(res);
    if (code === "FORBIDDEN") return { kind: "login" };
    if (code === "MFA_REQUIRED") return { kind: "setup" };
  }
  return { kind: "failed" }; // 503・403 E-AUTH-010 ほか：数だけ出さない
}
