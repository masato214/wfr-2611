// 保留の申し込み（D-088）：「はじめる」では何も作らない。メールを確認した時点で利用者と会社を作る。
// パスワードは確認のときに要るので預かるが、平文では置かない（master key から導いた鍵で包む・30 分で失効）。
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import type pg from "pg";
import { normalizeEmail } from "./signup.js";

export const PENDING_TTL_MIN = 30;
// 前のリンクの手がかり（replaced_token_hashes）は、送り直すたびに伸びないよう最後の 10 件だけ残す（K-52・putPending と renewPendingLink の SQL）
/** 包みの用途（既定は登録の保留の申し込み。招待のリンクの保留の行は "invitation-link-join"・K-422） */
export type SealPurpose = "pending-signup" | "invitation-link-join";
function key(masterKeyB64: string, purpose: SealPurpose): Buffer {
  // 用途ごとに鍵を分ける（同じ master key を別の用途と共有しない）
  return Buffer.from(hkdfSync("sha256", Buffer.from(masterKeyB64, "base64"), Buffer.alloc(0), purpose, 32));
}
export function seal(
  masterKeyB64: string,
  plain: string,
  purpose: SealPurpose = "pending-signup",
): { iv: string; tag: string; data: string } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(masterKeyB64, purpose), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}
export function open_(
  masterKeyB64: string,
  s: { iv: string; tag: string; data: string },
  purpose: SealPurpose = "pending-signup",
): string {
  const d = createDecipheriv("aes-256-gcm", key(masterKeyB64, purpose), Buffer.from(s.iv, "base64"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8");
}
export const hashPendingToken = (t: string) => createHash("sha256").update(t).digest("hex");

export interface Pending {
  email: string;
  name: string;
  companyName: string;
  password: string;
  expiresAt: Date;
}

/** 同意した規約の版（利用規約・プライバシーポリシー）と時刻。確定のときに本人の同意に移す（K-52・D-128.137） */
export interface PendingConsent {
  termsVersionId: string | null;
  privacyVersionId: string | null;
  consentedAt: Date;
}

/** 申し込みを預ける。同じメールで再度来たら上書きし、前のリンクは使えなくする（再訪で詰まらせない・D-088.3）。
 *  上書きした前のリンクの手がかり（ハッシュ）は replaced_token_hashes に移す。前のリンクを開いた人に「新しいリンクを」と案内するため（K-52・E-AUTH-008）。
 *  申し込みの印（signupToken）も新しく作る。登録を送ったブラウザにだけ返し、DB にはハッシュだけを置く（D-128.142）。
 *  上書きされた前の印は、もう今の申し込みを引けない */
export async function putPending(
  pool: pg.Pool,
  masterKeyB64: string,
  input: { email: string; name: string; companyName: string; password: string; consent?: PendingConsent },
): Promise<{ token: string; expiresAt: Date; signupToken: string }> {
  const email = normalizeEmail(input.email);
  const token = randomBytes(24).toString("base64url");
  const signupToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PENDING_TTL_MIN * 60_000);
  const pw = seal(masterKeyB64, input.password);
  const c = input.consent;
  await pool.query(
    `insert into kaname_auth.pending_signup
       (email, name, company_name, pw_iv, pw_tag, pw_data, token_hash, expires_at, updated_at, sent_at, send_error,
        signup_token_hash, terms_version_id, privacy_version_id, consented_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now(), null, null, $9, $10, $11, $12)
     on conflict (email) do update set
       name = excluded.name, company_name = excluded.company_name,
       pw_iv = excluded.pw_iv, pw_tag = excluded.pw_tag, pw_data = excluded.pw_data,
       replaced_token_hashes = (array_append(kaname_auth.pending_signup.replaced_token_hashes, kaname_auth.pending_signup.token_hash))[greatest(1, cardinality(kaname_auth.pending_signup.replaced_token_hashes) + 1 - 10 + 1):],
       token_hash = excluded.token_hash, expires_at = excluded.expires_at,
       updated_at = now(), sent_at = null, send_error = null, consumed_at = null,
       signup_token_hash = excluded.signup_token_hash,
       terms_version_id = excluded.terms_version_id, privacy_version_id = excluded.privacy_version_id,
       consented_at = excluded.consented_at`,
    [
      email,
      input.name,
      input.companyName,
      pw.iv,
      pw.tag,
      pw.data,
      hashPendingToken(token),
      expiresAt,
      hashPendingToken(signupToken),
      c?.termsVersionId ?? null,
      c?.privacyVersionId ?? null,
      c?.consentedAt ?? null,
    ],
  );
  return { token, expiresAt, signupToken };
}

/** 登録の画面が同意させる今の版（利用規約・プライバシーポリシー）。版が出ていなければ null（migration 0085） */
export async function currentSignupTerms(
  pool: pg.Pool,
): Promise<{ termsVersionId: string | null; privacyVersionId: string | null }> {
  const r = await pool.query<{ terms_version_id: string | null; privacy_version_id: string | null }>(
    "select terms_version_id, privacy_version_id from kaname_auth.signup_current_terms()",
  );
  return {
    termsVersionId: r.rows[0]?.terms_version_id ?? null,
    privacyVersionId: r.rows[0]?.privacy_version_id ?? null,
  };
}

/** 申し込みの印で引いた、今の申し込み（D-128.142）。上書きされた前の印・知らない印は null */
export interface PendingBySignupToken {
  email: string;
  expiresAt: Date;
  consumedAt: Date | null;
  expired: boolean;
}
export async function pendingBySignupToken(pool: pg.Pool, signupToken: string): Promise<PendingBySignupToken | null> {
  const r = await pool.query<{ email: string; expires_at: Date; consumed_at: Date | null; expired: boolean }>(
    "select email, expires_at, consumed_at, expires_at <= now() as expired from kaname_auth.pending_signup where signup_token_hash = $1",
    [hashPendingToken(signupToken)],
  );
  const x = r.rows[0];
  return x ? { email: x.email, expiresAt: x.expires_at, consumedAt: x.consumed_at, expired: x.expired } : null;
}

/** 送り直し：印の申し込みが期限内で確定していなければ、確認のリンクの手がかりを新しくする（前のリンクは使えなくなる）。
 *  印はそのまま（待つ画面は同じ印で引き続ける）。期限も 30 分に戻す。前の手がかりは replaced_token_hashes に移す（K-52）。引けなければ null */
export async function renewPendingLink(
  pool: pg.Pool,
  signupToken: string,
): Promise<{ email: string; token: string; expiresAt: Date } | null> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + PENDING_TTL_MIN * 60_000);
  const r = await pool.query<{ email: string }>(
    `update kaname_auth.pending_signup
        set replaced_token_hashes = (array_append(replaced_token_hashes, token_hash))[greatest(1, cardinality(replaced_token_hashes) + 1 - 10 + 1):],
            token_hash = $2, expires_at = $3, updated_at = now(), sent_at = null, send_error = null
      where signup_token_hash = $1 and consumed_at is null and expires_at > now() returning email`,
    [hashPendingToken(signupToken), hashPendingToken(token), expiresAt],
  );
  const email = r.rows[0]?.email;
  return email ? { email, token, expiresAt } : null;
}

/** このメールで登録が確定しているか（本人がいる） */
export async function isRegistered(pool: pg.Pool, email: string): Promise<boolean> {
  const r = await pool.query('select 1 from kaname_auth."user" where email = $1', [normalizeEmail(email)]);
  return (r.rowCount ?? 0) > 0;
}

/** 送れたか／送れなかったかを残す。画面が「送りました」と嘘をつかないため（D-088.5・G-15） */
export async function markPendingSent(pool: pg.Pool, email: string, error: string | null): Promise<void> {
  await pool.query(
    "update kaname_auth.pending_signup set sent_at = case when $2::text is null then now() else null end, send_error = $2 where email = $1",
    [normalizeEmail(email), error],
  );
}

export async function getPendingByEmail(pool: pg.Pool, email: string, masterKeyB64 = ""): Promise<Pending | null> {
  const r = await pool.query(
    "select email, name, company_name, pw_iv, pw_tag, pw_data, expires_at from kaname_auth.pending_signup where email = $1 and consumed_at is null and expires_at > now()",
    [normalizeEmail(email)],
  );
  return r.rows[0] ? row(r.rows[0], masterKeyB64) : null;
}

/** 確認のリンクで確定するときに使う申し込みの中身。パスワードは包んだまま（開くのは確定の処理・K-52） */
export interface ClaimedPending {
  email: string;
  name: string;
  companyName: string;
  sealed: { iv: string; tag: string; data: string };
  termsVersionId: string | null;
  privacyVersionId: string | null;
  consentedAt: Date | null;
}
/** リンクの手がかりで引いた結果（K-52）。
 *  claimed … いま使うの印を付けた（この 1 回だけが確定に進む）／ done … もう確定に使った（同じリンク・前のリンクのどちらも）
 *  expired … 期限切れ（30 分・DB の now() で比べる）／ replaced … 送り直す前の前のリンク ／ gone … 無い（掃除された・でたらめ）
 *  unusable … 使い終わりの印があるのに本人がいない（包んだパスワードが開けず空にした）。登録し直しの案内（E-PAGE-006） */
export type ClaimResult =
  | { kind: "claimed"; tokenHash: string; pending: ClaimedPending }
  | { kind: "done"; email: string }
  | { kind: "expired" }
  | { kind: "replaced" }
  | { kind: "unusable" }
  | { kind: "gone" };
/** 引くのと「使う」の印を 1 文で同時に行う（同時に 2 回押しても、確定に進むのは 1 回だけ・TP-REG-12） */
export async function claimPendingByToken(pool: pg.Pool, token: string): Promise<ClaimResult> {
  const h = hashPendingToken(token);
  const r = await pool.query<{
    email: string;
    name: string;
    company_name: string;
    pw_iv: string;
    pw_tag: string;
    pw_data: string;
    terms_version_id: string | null;
    privacy_version_id: string | null;
    consented_at: Date | null;
  }>(
    `update kaname_auth.pending_signup set consumed_at = now(), updated_at = now()
      where token_hash = $1 and consumed_at is null and expires_at > now() and pw_data is not null
      returning email, name, company_name, pw_iv, pw_tag, pw_data, terms_version_id, privacy_version_id, consented_at`,
    [h],
  );
  const x = r.rows[0];
  if (x)
    return {
      kind: "claimed",
      tokenHash: h,
      pending: {
        email: x.email,
        name: x.name,
        companyName: x.company_name,
        sealed: { iv: x.pw_iv, tag: x.pw_tag, data: x.pw_data },
        termsVersionId: x.terms_version_id,
        privacyVersionId: x.privacy_version_id,
        consentedAt: x.consented_at,
      },
    };
  // 印を付けられなかった：なぜかを見分ける。今の手がかりを先に、無ければ前の手がかり（GIN の索引が使える @> の形）で引く。
  //   使い終わりの印があり、パスワードが空で、本人がいない＝開けなかった申し込み（確定の途中ならパスワードはまだ残っている）
  const why = await pool.query<{
    email: string;
    current: boolean;
    consumed: boolean;
    expired: boolean;
    unusable: boolean;
  }>(
    `select email, token_hash = $1 as current, consumed_at is not null as consumed, expires_at <= now() as expired,
            (consumed_at is not null and pw_data is null
              and not exists (select 1 from kaname_auth."user" u where u.email = p.email)) as unusable
       from kaname_auth.pending_signup p
      where token_hash = $1 or replaced_token_hashes @> array[$1]::text[]
      order by (token_hash = $1) desc limit 1`,
    [h],
  );
  const x2 = why.rows[0];
  if (!x2) return { kind: "gone" };
  if (x2.unusable) return { kind: "unusable" };
  if (x2.consumed) return { kind: "done", email: x2.email };
  if (!x2.current) return { kind: "replaced" };
  return x2.expired ? { kind: "expired" } : { kind: "gone" };
}
/** 確定の途中で失敗したら印を戻す（もう一度押せば確定できる・TP-CRUD-05） */
export async function releasePendingClaim(pool: pg.Pool, tokenHash: string): Promise<void> {
  await pool.query("update kaname_auth.pending_signup set consumed_at = null where token_hash = $1", [tokenHash]);
}
/** 確定が済んだ：包んだパスワードを空にする。行は「確定済み」と「期限切れ」を分けるために残す（migration 0023・0087） */
export async function sealOffPending(pool: pg.Pool, tokenHash: string): Promise<void> {
  await pool.query(
    "update kaname_auth.pending_signup set pw_iv = null, pw_tag = null, pw_data = null, updated_at = now() where token_hash = $1",
    [tokenHash],
  );
}
/** 認証の接続（kaname_auth の表）。生の pg を業務の側に持ち込まないための名前（K-52・関門 C2） */
export type AuthPool = pg.Pool;
/** 確定した本人の印にメールの確認済みを立てる（確認のリンクを経て作ったので、この時点で確認済み） */
export async function markEmailVerified(pool: pg.Pool, userId: string): Promise<void> {
  await pool.query('update kaname_auth."user" set "emailVerified" = true where id = $1', [userId]);
}
/** そのメールの認証の本人の id（メールは正規化して引く）。無ければ null */
export async function authUserIdByEmail(pool: pg.Pool, email: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>('select id from kaname_auth."user" where email = $1 limit 1', [
    normalizeEmail(email),
  ]);
  return r.rows[0]?.id ?? null;
}
/** その本人のパスワードのアカウント（Better Auth の credential）のハッシュ。アカウントが無ければ null（会社を作る hook で落ちた本人は、
 *  アカウントを足す前に止まるので持たない）。ハッシュの照合は呼ぶ側が Better Auth の password.verify で行う */
export async function credentialHashOf(pool: pg.Pool, userId: string): Promise<string | null> {
  const r = await pool.query<{ password: string | null }>(
    'select password from kaname_auth.account where "userId" = $1 and "providerId" = \'credential\' order by "createdAt" desc limit 1',
    [userId],
  );
  return r.rows[0]?.password ?? null;
}
/** その本人の会社の人（members）が、どこかの会社に残っているか（確定の処理の役だけが呼べる kaname_auth.auth_user_has_members・migration 0087） */
export async function authUserHasMembers(authPool: pg.Pool, userId: string): Promise<boolean> {
  const r = await authPool.query<{ has: boolean }>("select kaname_auth.auth_user_has_members($1) as has", [userId]);
  return r.rows[0]?.has === true;
}
/** この確定で作った本人の会社（片付ける相手）。セッションからでなく members.auth_user_id から引く（kaname_auth.half_made_tenant_of・M-C）。
 *  人がその本人 1 人だけの会社だけを返す。無ければ null */
export async function halfMadeTenantOf(authPool: pg.Pool, userId: string): Promise<string | null> {
  const r = await authPool.query<{ id: string | null }>("select kaname_auth.half_made_tenant_of($1) as id", [userId]);
  return r.rows[0]?.id ?? null;
}
/** 作りかけの会社に「作りかけで止めた」印を付けて中身を片付ける（kaname_auth.drop_half_made_company・守りは関数の中で 3 重・D-128.167）。
 *  片付けたら true。守りで外れて何もしなかったら false */
export async function dropHalfMadeCompany(authPool: pg.Pool, tenantId: string, userId: string): Promise<boolean> {
  const r = await authPool.query<{ n: number }>("select kaname_auth.drop_half_made_company($1::uuid, $2) as n", [
    tenantId,
    userId,
  ]);
  return (r.rows[0]?.n ?? 0) > 0;
}
/** 認証の本人を消す（セッション・アカウントは外部キーの cascade で一緒に消える）。id で指す（メールで探して消さない） */
export async function deleteAuthUser(authPool: pg.Pool, userId: string): Promise<void> {
  await authPool.query('delete from kaname_auth."user" where id = $1', [userId]);
}
/** セッションを閉じる理由：別のアカウントでログイン中に確定した（ログアウトと分ける・migration 0087） */
export const SIGNUP_OTHER_ACCOUNT = "signup_other_account";
/** 作ったばかりの本人のセッションを閉じる（別のアカウントでログイン中に確定した・D-128.137）。Kaname の側も認証の側も */
export async function closeSessionsOf(authPool: pg.Pool, appPool: pg.Pool, userId: string): Promise<void> {
  await appPool.query("select app.revoke_sessions_for_auth_user($1, $2)", [userId, SIGNUP_OTHER_ACCOUNT]);
  await authPool.query('delete from kaname_auth.session where "userId" = $1', [userId]);
}
/** 確定でできたばかりのセッションの同意し直しの印（K-53）。セッション（最新の 1 つ）に印を決めて返す（app.mark_session_terms は
 *  そのセッションの印を今の版で決め直し、立っていれば true。運営の人・Bridge は false）。セッションが無ければ false */
export async function termsPendingOfNewSession(authPool: pg.Pool, appPool: pg.Pool, userId: string): Promise<boolean> {
  const s = await authPool.query<{ id: string }>(
    'select id from kaname_auth.session where "userId" = $1 order by "createdAt" desc limit 1',
    [userId],
  );
  const id = s.rows[0]?.id;
  if (!id) return false;
  const r = await appPool.query<{ p: boolean }>("select app.mark_session_terms($1) as p", [id]);
  return r.rows[0]?.p === true;
}
/** 作ったばかりの本人の会社の人（members）と会社。確定のときにできたセッションから引く（業務の表は会社の文脈が無いと読めないため、
 *  セッションの写しの関数 app.session_alive を通す）。セッションが無ければ null */
export async function memberOfNewUser(
  authPool: pg.Pool,
  appPool: pg.Pool,
  userId: string,
): Promise<{ memberId: string; tenantId: string } | null> {
  const s = await authPool.query<{ id: string }>(
    'select id from kaname_auth.session where "userId" = $1 order by "createdAt" desc limit 1',
    [userId],
  );
  const sid = s.rows[0]?.id;
  if (!sid) return null;
  const m = await appPool.query<{ member_id: string; tenant_id: string }>("select * from app.session_alive($1)", [sid]);
  const x = m.rows[0];
  return x ? { memberId: x.member_id, tenantId: x.tenant_id } : null;
}
/** 本人のメールアドレス（認証の表）。無ければ null */
export async function emailOfUser(authPool: pg.Pool, userId: string): Promise<string | null> {
  const r = await authPool.query<{ email: string }>('select email from kaname_auth."user" where id = $1', [userId]);
  return r.rows[0]?.email ?? null;
}
/** 包んだパスワードを開く。鍵が替わっていれば投げる */
export const openPendingPassword = (masterKeyB64: string, sealed: ClaimedPending["sealed"]): string =>
  open_(masterKeyB64, sealed);

export async function dropPending(pool: pg.Pool, email: string): Promise<void> {
  await pool.query("delete from kaname_auth.pending_signup where email = $1", [normalizeEmail(email)]);
}
/** 期限の切れた申し込みは残さない（掃除。個人の情報を必要以上に置かない） */
export async function sweepPending(pool: pg.Pool): Promise<number> {
  const r = await pool.query("delete from kaname_auth.pending_signup where expires_at < now() - interval '1 day'");
  return r.rowCount ?? 0;
}
interface Row {
  email: string;
  name: string;
  company_name: string;
  pw_iv: string;
  pw_tag: string;
  pw_data: string;
  expires_at: Date;
}
function row(x: Row, masterKeyB64: string): Pending {
  return {
    email: x.email,
    name: x.name,
    companyName: x.company_name,
    password: masterKeyB64 ? open_(masterKeyB64, { iv: x.pw_iv, tag: x.pw_tag, data: x.pw_data }) : "",
    expiresAt: x.expires_at,
  };
}
