// 要求 → テナント文脈。認証（Better Auth）のセッションが生きていても、public.sessions が revoked なら 401（G-14：トークンの期限に頼らない）。
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Auth } from "./index.js";
import { countryOf, deviceOf, ipOf } from "./device.js";
import { hashToken } from "./invitations.js";

/** PC の印を運ぶ頭（Bridge が送る・K-57。K-62 の口もこの頭を前提にする） */
export const DEVICE_TOKEN_HEADER = "x-bridge-session";
/** PC の印の形（"kpc_" ＋ 乱数 32 バイトの base64url）。形が違えば DB を引かない */
export const DEVICE_TOKEN_RE = /^kpc_[A-Za-z0-9_-]{43}$/;

/** PC の印 → PC の文脈（role: device）。印のハッシュで生きている Bridge の行を引く。国か端末が変わったら切って null（D-128.120）。
 *  時間では切らない（D-128.121）。印そのものは DB に無い（ハッシュだけ・D-128.137） */
export function createDeviceResolver(appPool: pg.Pool) {
  return async (headers: Headers): Promise<Resolved | null> => {
    const token = headers.get(DEVICE_TOKEN_HEADER) ?? "";
    if (!DEVICE_TOKEN_RE.test(token)) return null;
    const r = await appPool.query<{ session_id: string; member_id: string; tenant_id: string }>(
      "select * from app.bridge_device_check($1, $2, $3, $4)",
      [hashToken(token), countryOf(headers), deviceOf(headers.get("user-agent")), ipOf(headers)],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      ctx: { tenantId: row.tenant_id, userId: row.member_id, role: "device", sessionId: row.session_id },
      sessionId: row.session_id,
      authUserId: "",
      // PC のセッションには同意し直しの印を立てず止めない（K-53・D-128.137。Bridge は時間で切らないので、止めると PC 側の仕事が全部止まる）
      termsPending: false,
      mfaPending: false,
    };
  };
}

/** 部品のセッションの作った時刻（Date か文字列）。読めなければ null（取り直しの判定は通さない側に倒れる） */
function loginAtOf(session: { createdAt?: unknown }): Date | null {
  const v = session.createdAt;
  if (v === undefined || v === null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface Resolved {
  ctx: TenantContext;
  sessionId: string;
  authUserId: string;
  /** 同意し直しの印（K-53）。立っている間は、規約の口・ログアウト・自分の取得のほかを止める。PC のセッションは常に false。
   *  ctx（DB に渡すテナントの文脈）には入れない */
  termsPending: boolean;
  /** 付けるまで進めない印（K-308・D-128.141）。パスキーも 2 段階も無い人の画面のセッションに立つ。読むだけ（止めるのは入口の別の葉）。
   *  PC のセッションは常に false */
  mfaPending?: boolean;
  /** 会社から抜けた人か（D-131.7・K-166）。画面のログインの解決は、解けた時点で抜けていない（false）と分かる。
   *  持たない解決（PC の印など）は、入口が今までどおり DB で確かめる（K-233） */
  memberLeft?: boolean;
}

export function createSessionResolver(auth: Auth, appPool: pg.Pool) {
  return async (headers: Headers): Promise<Resolved | null> => {
    const s = await auth.api.getSession({ headers });
    if (!s) return null;
    // セッションの見張り（K-20・D-125.140・D-128.120）：操作が無い 12 時間・最長 7 日・国か端末が変わったら閉じて 401。
    //   同じ国の中で IP だけ変わったら記録だけ（security_events）。生きていれば最後に見た時刻を進める。
    //   直前の本人確認の時刻（K-14）と同意し直しの印（K-53）も同じ 1 本の文で引く（K-233。session_check は from の中で 1 回だけ動く）
    const r = await appPool.query<{
      session_id: string;
      member_id: string;
      tenant_id: string;
      at: Date | null;
      terms: boolean;
      mfa: boolean;
      ops: string | null;
    }>(
      "select c.session_id, c.member_id, c.tenant_id, app.session_step_up_at($1) as at, app.session_terms_pending(c.session_id) as terms, app.session_mfa_pending(c.session_id) as mfa, app.session_ops(c.session_id) as ops from app.session_check($1, $2, $3, $4) c",
      [s.session.id, countryOf(headers), deviceOf(headers.get("user-agent")), ipOf(headers)],
    );
    const row = r.rows[0];
    if (!row) return null; // 失効済み・会社に属していない・人が抜けた・見張りで閉じた
    // 運営の会社のセッション（K-944・D-156.2）：運営の人（生きている ops_members）のパスキーのセッションだけを運営として解く（2 層目）。
    //   運営の人でない・外された・入り方がパスキーでないセッションは解かない（401）。顧客の会社のセッションは null で、今までどおり下へ
    if (row.ops !== null && row.ops !== "ops") return null;
    if (row.ops === "ops")
      return {
        // 会社をまたぐ運営の文脈（tenantId null）。指す会社は入口（middleware/tenant.ts）が x-tenant-id で足す
        ctx: {
          tenantId: null,
          userId: row.member_id,
          role: "ops",
          stepUpAt: row.at ?? null,
          loginAt: loginAtOf(s.session),
        },
        sessionId: row.session_id,
        authUserId: s.user.id,
        // 同意し直しは顧客の規約の印・運営はパスキーを持つので、運営のセッションはどちらも止めない
        termsPending: false,
        mfaPending: false,
        memberLeft: false,
      };
    return {
      ctx: {
        tenantId: row.tenant_id,
        userId: row.member_id,
        role: "member",
        stepUpAt: row.at ?? null,
        // ログインした時刻（部品のセッションの createdAt）。ログインから 15 分の内は取り直しを求めない口がある（K-308）
        loginAt: loginAtOf(s.session),
      },
      sessionId: row.session_id,
      authUserId: s.user.id,
      termsPending: row.terms === true,
      mfaPending: row.mfa === true,
      // 行が在る＝session_check が members.deleted_at is null で結んだ＝抜けていない（入口で member_left を引き直さない・K-233）
      memberLeft: false,
    };
  };
}

/** ログアウト：認証側と public.sessions の両方を閉じる */
export async function signOut(auth: Auth, appPool: pg.Pool, headers: Headers): Promise<void> {
  const s = await auth.api.getSession({ headers });
  if (s) await appPool.query("select app.close_session($1, 'logout')", [s.session.id]);
  await auth.api.signOut({ headers });
}

/** パスワード変更の結果。no_session：部品のセッションが無い／no_password：パスワードを持たない人（決める口を使う）／userId：変えた人（記録に使う）／
 *  wrong_current：今のパスワードが違う（何も切らず変えない）／ok：変えた（revoked は切った Kaname のセッションの数） */
export type ChangePasswordResult =
  | { ok: true; userId: string; revoked: number; followUpErrors: unknown[] }
  | { ok: false; reason: "no_session" | "no_password" | "wrong_current" };

/** パスワード変更（D-128.141・D-125.140・D-125.150・K-312）。今の画面のセッションだけ残し、その人の全部のワークスペースの
 *  ほかの端末と PC（Bridge）を切る。順は「今のパスワードを確かめる → 先にほかを切る（public.sessions が失効の正・切れずに残るより
 *  入り直しを選ぶ）→ 変える → 認証の側のほかのセッションも期限を今にして効かなくする」。切る所で落ちたら投げる（変えない）。
 *  部品の changePassword は revokeOtherSessions: false で呼ぶ（true だと今のセッションも消して印を作り直し、今の画面が残らない）。
 *  認証の側のほかのセッションの行は消さずに残す（public.sessions の失効の理由 password_changed と結ぶ行を残す）。
 *  変えた後の認証の側の片付けは落ちても変えた事実は戻らないので投げず、followUpErrors で返す（public.sessions は切ってある） */
export async function changePassword(
  auth: Auth,
  appPool: pg.Pool,
  headers: Headers,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const s = await auth.api.getSession({ headers });
  if (!s) return { ok: false, reason: "no_session" };
  const ctx = await auth.$context;
  const account = await ctx.internalAdapter.findCredentialAccount(s.user.id);
  if (!account?.password) return { ok: false, reason: "no_password" };
  if (!(await ctx.password.verify({ hash: account.password, password: currentPassword })))
    return { ok: false, reason: "wrong_current" };
  const r = await appPool.query<{ n: number }>(
    "select app.revoke_sessions_for_auth_user_except($1, $2, 'password_changed') as n",
    [s.user.id, s.session.id],
  );
  await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: false } });
  const followUpErrors: unknown[] = [];
  try {
    const others = (await ctx.internalAdapter.listSessions(s.user.id))
      .map((x) => x.token)
      .filter((t) => t !== s.session.token);
    const now = new Date();
    for (const t of others) await ctx.internalAdapter.updateSession(t, { expiresAt: now });
  } catch (e) {
    followUpErrors.push(e);
  }
  return { ok: true, userId: s.user.id, revoked: Number(r.rows[0]?.n ?? 0), followUpErrors };
}
