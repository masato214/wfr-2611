// 登録・ログインの補助（T-U-01／05）。表記ゆらぎはサーバで直す（NFKC・前後の空白・小文字）。ロックは app.login_attempts（5 回で 15 分）
import { createHash } from "node:crypto";
import type pg from "pg";
import { z } from "zod";
import { LOGIN_BLOCKED_CODES, type Auth } from "./index.js";
import { authUserIdByEmail } from "./pending.js";

/** メールアドレスの正規化：全角→半角（NFKC）・前後と途中の空白を除く・小文字 */
export const normalizeEmail = (v: string): string => v.normalize("NFKC").replace(/\s+/g, "").trim().toLowerCase();
export const emailHash = (email: string): string => createHash("sha256").update(normalizeEmail(email)).digest("hex");
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** ログインの部品 better-auth が登録・ログインで見るメールの形（zod の z.email()・同じ zod 4.6.7）。外は部品が INVALID_EMAIL で断る */
const PART_EMAIL = z.email();
/** 正規化した後のメールを、EMAIL_RE と部品の z.email() の両方で見る（登録で受けて確かめで落ちるメールを先に断る・K-1117） */
export const isLoginEmail = (normalized: string): boolean =>
  EMAIL_RE.test(normalized) && PART_EMAIL.safeParse(normalized).success;
/** ログに宛先をそのまま出さない（K-51・TP-REG-14）。同じ宛先は同じ印になるので、送った／送れなかったを辿れる */
export const mailTag = (email: string): string => `宛先#${emailHash(email).slice(0, 12)}`;

export interface SignInResult {
  ok: boolean;
  token?: string | null;
  twoFactor?: boolean;
  /** 部品が返した Cookie を全部つないだもの（前の道すじ /api/auth-ext/two-factor/verify が使う） */
  cookie?: string;
  /** 2 段階の待ちの印（部品の 2 段階の待ちの Cookie の値だけ・名前は入れない・5 分）。2 段階でなければ null */
  pending?: string | null;
  /** 入った本人（部品の user.id）。失敗なら無い */
  userId?: string;
  /** 失敗：残り回数（0 ならロック） */
  remaining?: number;
  lockedUntil?: Date | null;
  /** メールの形を部品が受け付けなかった（失敗の数に入れない・口は 422 E-VAL-004） */
  invalidEmail?: boolean;
  /** 止めの 1 か所（K-303）が断った：人・会社の止め・抜けた（403）か、止めの確かめができなかった（503）。失敗の数に入れない */
  blocked?: { code: string; status: number };
}
/** 記録（ログインの成功・失敗・ロックを会社の security_events に・K-301）に要るもの。無ければ記録しない（前の道すじ） */
export interface SignInRecord {
  /** 認証の接続（kaname_auth."user" からメールで本人を引く） */
  authPool: pg.Pool;
  /** 国（x-vercel-ip-country）。IP そのものは渡さない */
  country: string | null;
}
/** 部品の 2 段階の待ちの Cookie の名前の終わり（本番の https では __Secure- が頭に付く） */
const TWO_FACTOR_COOKIE = /(?:^|\.)two_factor$/;
/** 部品の答えの Set-Cookie から、2 段階の待ちの Cookie の値だけを取り出す */
function pendingOf(setCookies: string[]): string | null {
  for (const c of setCookies) {
    const pair = c.split(";")[0] ?? "";
    const i = pair.indexOf("=");
    if (i > 0 && TWO_FACTOR_COOKIE.test(pair.slice(0, i)) && pair.slice(i + 1)) return pair.slice(i + 1);
  }
  return null;
}
/** 部品の APIError の印（status と body.code）。部品の版で型が変わっても形で見る */
function apiErrorCode(e: unknown): string | null {
  const x = e as { status?: unknown; body?: { code?: unknown } } | null;
  if (!x || typeof x !== "object" || typeof x.status !== "string") return null;
  return typeof x.body?.code === "string" ? x.body.code : null;
}
/** 部品の APIError の HTTP の数（無ければ 503・止める側） */
function statusOf(e: unknown): number {
  const n = (e as { statusCode?: unknown } | null)?.statusCode;
  return typeof n === "number" ? n : 503;
}
/** パスワードの失敗に数える部品の答え：「メールかパスワードが違う」と「パスワードが長すぎる」（長すぎるパスワードは決して合わない＝違うのと同じ）。
 *  ほか（DB が落ちた・セッションを写す所の失敗）は数えずに投げ直す（K-301・切る段の精査の後） */
const COUNTED = new Set(["INVALID_EMAIL_OR_PASSWORD", "PASSWORD_TOO_LONG"]);

/** ログインの記録を書く（会社ごとの security_events・migration 0107・0108）。本人がいなければ書かない。書けなくてもログインは止めない。
 *  パスワードの段（K-301）と確認のコードの段（K-302 の login_code_failed・login_code_locked）の 1 か所 */
export async function recordLoginEvent(appPool: pg.Pool, userId: string | null, kind: string, country: string | null) {
  if (!userId) return;
  try {
    await appPool.query("select app.record_login_event($1, $2, $3)", [userId, kind, country]);
  } catch (e) {
    const x = e as { code?: unknown; name?: unknown } | null;
    const why = typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
    console.error(`[auth] ログインの記録を書けなかった（${kind}・${why}）`); // 文や値は出さない（種類だけ）
  }
}
async function recordLogin(appPool: pg.Pool, rec: SignInRecord | undefined, userId: string | null, kind: string) {
  if (rec) await recordLoginEvent(appPool, userId, kind, rec.country);
}

/** メール＋パスワードでログイン。連続失敗は app.login_attempts で数え、5 回で 15 分ロック（E-AUTH-001／002）。
 *  rec を渡すと、成功（2 段階なし）・失敗・ロックを会社の security_events に残す（K-301）。2 段階の待ちになった段では書かない（6 けたの後に K-302 が書く） */
export async function signInWithLock(
  auth: Auth,
  appPool: pg.Pool,
  email: string,
  password: string,
  userAgent?: string,
  rec?: SignInRecord,
): Promise<SignInResult> {
  const e = normalizeEmail(email);
  const h = emailHash(e);
  const locked = await appPool.query<{ until: Date | null }>("select app.login_locked_until($1) as until", [h]);
  if (locked.rows[0]?.until) return { ok: false, remaining: 0, lockedUntil: locked.rows[0].until };
  const headers = new Headers();
  if (userAgent) headers.set("user-agent", userAgent);
  let r: { response: unknown; headers: Headers };
  try {
    r = await auth.api.signInEmail({ headers, body: { email: e, password }, returnHeaders: true });
  } catch (ex) {
    const code = apiErrorCode(ex);
    if (code === "INVALID_EMAIL") return { ok: false, invalidEmail: true };
    // 止めで断られた：パスワードは合っている。失敗にも成功にも数えない（止めを外した直後に入れるように・K-303）
    if (code && LOGIN_BLOCKED_CODES.has(code)) return { ok: false, blocked: { code, status: statusOf(ex) } };
    if (!code || !COUNTED.has(code)) throw ex; // 数えない失敗（DB・写す所）は呼んだ側が 500 にする
    const f = await appPool.query<{ remaining: number; locked_until: Date | null }>(
      "select * from app.login_failed($1)",
      [h],
    );
    const remaining = f.rows[0]?.remaining ?? 0;
    if (rec)
      await recordLogin(
        appPool,
        rec,
        await authUserIdByEmail(rec.authPool, e),
        remaining > 0 ? "login_failed" : "login_locked",
      );
    return { ok: false, remaining, lockedUntil: f.rows[0]?.locked_until ?? null };
  }
  const body = r.response as { token?: string | null; twoFactorRedirect?: boolean; user?: { id?: string } };
  await appPool.query("select app.login_ok($1)", [h]);
  const setCookies = r.headers.getSetCookie();
  const twoFactor = !!body.twoFactorRedirect;
  const userId = body.user?.id;
  if (!twoFactor) await recordLogin(appPool, rec, userId ?? null, "login_succeeded");
  return {
    ok: true,
    token: twoFactor ? null : (body.token ?? null),
    twoFactor,
    cookie: setCookies.map((c) => c.split(";")[0]).join("; "),
    pending: twoFactor ? pendingOf(setCookies) : null,
    ...(userId ? { userId } : {}),
  };
}

/** 登録：会社名があれば hook が会社を作る。メールは正規化してから */
export async function signUp(
  auth: Auth,
  input: { email: string; password: string; name: string; companyName?: string },
): Promise<{ token: string | null; userId: string }> {
  const r = await auth.api.signUpEmail({
    body: {
      email: normalizeEmail(input.email),
      password: input.password,
      name: input.name.normalize("NFKC").trim(),
      ...(input.companyName ? { company_name: input.companyName.normalize("NFKC").trim() } : {}),
    } as never,
  });
  const body = r as { token: string | null; user: { id: string } };
  return { token: body.token, userId: body.user.id };
}
