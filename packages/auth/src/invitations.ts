// 招待：作る（権限のある人）→ 受ける（新しい利用者）→ 取り消す（即無効・G-14）。トークンは平文を渡し、DB には sha256 だけ。
import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import type { Auth } from "./index.js";
import { open_, seal } from "./pending.js";
import { normalizeEmail } from "./signup.js";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createInvitation(
  repo: Repository,
  ctx: TenantContext,
  input: {
    email: string;
    scopeId?: string | null;
    roleId?: string | null;
    preset?: Record<string, unknown>;
    days?: number;
  },
): Promise<{ id: string; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const row = await repo.table("invitations").create(ctx, {
    email: input.email.trim().toLowerCase(),
    scope_id: input.scopeId ?? null,
    role_id: input.roleId ?? null,
    permission_preset: JSON.stringify(input.preset ?? {}),
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + (input.days ?? 7) * 86400e3),
  });
  return { id: String(row["id"]), token };
}

export async function acceptInvitation(
  appPool: pg.Pool,
  token: string,
  authUserId: string,
  displayName: string,
): Promise<string> {
  const r = await appPool.query<{ member_id: string }>("select app.accept_invitation($1, $2, $3) as member_id", [
    hashToken(token),
    authUserId,
    displayName,
  ]);
  return r.rows[0]!.member_id;
}

/** 契約の口（K-332）が利用者を作る前に見る招待の様子。行が無ければ null */
export interface InvitationForAccept {
  invitationId: string;
  tenantId: string;
  /** 宛てのメール。空＝招待のリンク（K-421） */
  email: string | null;
  state: "ok" | "expired" | "revoked" | "used";
  workspaceSuspended: boolean;
}
export async function invitationForAccept(appPool: pg.Pool, token: string): Promise<InvitationForAccept | null> {
  return invitationForAcceptByHash(appPool, hashToken(token));
}
/** 招待の印の sha256 で引く（確認のリンクを押したときは、保留の行が持つ sha256 しか無い・K-422） */
export async function invitationForAcceptByHash(
  appPool: pg.Pool,
  tokenHash: string,
): Promise<InvitationForAccept | null> {
  const r = await appPool.query<{
    invitation_id: string;
    tenant_id: string;
    email: string | null;
    state: InvitationForAccept["state"];
    workspace_suspended: boolean;
  }>("select * from app.invitation_for_accept($1)", [tokenHash]);
  const row = r.rows[0];
  if (!row) return null;
  return {
    invitationId: row.invitation_id,
    tenantId: row.tenant_id,
    email: row.email,
    state: row.state,
    workspaceSuspended: row.workspace_suspended,
  };
}

/** 招待で入る人の認証の利用者を作る（K-332）。メールは招待の宛て（確認済み＝リンクが届いた）・会社名は渡さない（会社を作る hook は何もしない）。
 *  部品の登録の口（signUpEmail）は自動でセッションを作るので使わず、利用者とパスワードのアカウントだけを作る（セッションは openSessionFor）。
 *  同じメールの利用者が先にあれば exists（同時に 2 回押した負けの方も含む・何も作っていない）。それ以外の失敗は投げる */
export async function createInvitedUser(
  auth: Auth,
  authPool: pg.Pool,
  input: { email: string; name: string; password: string },
): Promise<{ kind: "made"; userId: string } | { kind: "exists" }> {
  const ctx = await auth.$context;
  const email = normalizeEmail(input.email);
  const exists = async () =>
    !!(await authPool.query('select 1 from kaname_auth."user" where email = $1 limit 1', [email])).rowCount;
  if (await exists()) return { kind: "exists" };
  const hash = await ctx.password.hash(input.password);
  let userId: string;
  try {
    const user = await ctx.internalAdapter.createUser(
      { email, name: input.name, emailVerified: true },
      { method: "email-password" },
    );
    userId = user.id;
  } catch (e) {
    if (await exists()) return { kind: "exists" };
    throw e;
  }
  try {
    await ctx.internalAdapter.linkAccount({ userId, providerId: "credential", accountId: userId, password: hash });
  } catch (e) {
    // パスワードのアカウントが作れない利用者は残さない（ログインできない作りかけ）。消すのも落ちたら呼ぶ側が後片付けとして扱う
    throw Object.assign(new Error("パスワードのアカウントを作れなかった"), { cause: e, madeUserId: userId });
  }
  return { kind: "made", userId };
}

/** 受諾（app.accept_invitation）と、今の版の規約への同意（app.agree_current_terms_on_invite）を 1 つの取引で行う（K-332・D-128.137）。
 *  前の道すじ（acceptInvitation）は同意を取らないまま（K-337 まで） */
export async function acceptInvitationAgreeing(
  appPool: pg.Pool,
  token: string,
  authUserId: string,
  displayName: string,
): Promise<string> {
  return acceptInvitationAgreeingByHash(appPool, hashToken(token), authUserId, displayName);
}
/** 招待の印の sha256 で受諾する（確認のリンクを押したとき・K-422） */
export async function acceptInvitationAgreeingByHash(
  appPool: pg.Pool,
  tokenHash: string,
  authUserId: string,
  displayName: string,
): Promise<string> {
  const cl = await appPool.connect();
  try {
    await cl.query("begin");
    const r = await cl.query<{ member_id: string }>("select app.accept_invitation($1, $2, $3) as member_id", [
      tokenHash,
      authUserId,
      displayName,
    ]);
    const memberId = r.rows[0]!.member_id;
    await cl.query("select app.agree_current_terms_on_invite($1, $2)", [memberId, authUserId]);
    await cl.query("commit");
    return memberId;
  } catch (e) {
    await cl.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    cl.release();
  }
}

/** 受諾の関数が招待の状態で断った理由（例外の hint）。それ以外の例外は null */
export function acceptRefusal(e: unknown): "not_found" | "used" | "revoked" | "expired" | null {
  const x = e as { code?: unknown; hint?: unknown } | null;
  if (x?.code !== "42501") return null;
  return x.hint === "not_found" || x.hint === "used" || x.hint === "revoked" || x.hint === "expired" ? x.hint : null;
}

/** ログイン中の人が今のアカウントで参加する（K-333・app.join_invitation）。所属を足す（前に抜けた所属は戻す）・出来事・
 *  そのログインの印の sessions の行の付け替えを、関数の中の 1 つの取引で行う。返すのは招かれたワークスペースと新しい所属の人 */
export async function joinInvitation(
  appPool: pg.Pool,
  token: string,
  authUserId: string,
  authSessionId: string,
): Promise<{ tenantId: string; memberId: string }> {
  const r = await appPool.query<{ tenant_id: string; member_id: string }>(
    "select * from app.join_invitation($1, $2, $3)",
    [hashToken(token), authUserId, authSessionId],
  );
  const row = r.rows[0];
  if (!row) throw new Error("参加の関数が行を返さなかった");
  return { tenantId: row.tenant_id, memberId: row.member_id };
}

/** 参加の関数（app.join_invitation）が断った理由（例外の hint）。招待の状態に加え、別のメール宛て・もう入っている。それ以外の例外は null */
export function joinRefusal(
  e: unknown,
): "not_found" | "used" | "revoked" | "expired" | "wrong_email" | "already_member" | null {
  const x = e as { code?: unknown; hint?: unknown } | null;
  if (x?.code !== "42501") return null;
  return x.hint === "wrong_email" || x.hint === "already_member" ? x.hint : acceptRefusal(e);
}

/** その人のセッションを部品で作る（K-332）。セッションの hook（止め・Kaname の sessions への写し・同意し直しと付けるまで進めない印）を通る。
 *  端末の印（user-agent）は渡さない（登録の確定と同じく、最初のログインを新しい端末と数えない・D-128.137）。返すのはログインの印（session.token） */
export async function openSessionFor(auth: Auth, userId: string): Promise<string> {
  const ctx = await auth.$context;
  const s = await ctx.internalAdapter.createSession(userId, false);
  if (!s?.token) throw new Error("セッションを作れなかった");
  return s.token;
}

export async function revokeInvitation(repo: Repository, ctx: TenantContext, id: string): Promise<boolean> {
  const row = await repo.table("invitations").update(ctx, id, { revoked_at: new Date() });
  return row !== null;
}

// ---- K-422 招待のリンクで新しく入る人の保留の行（kaname_auth.invitation_link_joins・D-148.51） ----
// 参加を押した時点では利用者も所属も作らず、この表の 1 行と確認のメールだけを置く。確認のリンクを押したときに参加を決める。
/** 確認のリンクの期限（24 時間） */
export const LINK_JOIN_TTL_HOURS = 24;

/** 保留の行を置く（同じ招待・同じメールの待っている行があれば、トークン・期限・包んだパスワード・名前を替えて送った印を空にする）。
 *  1 文で置くので、同時に押されても一意の違反にならない（先に select しない） */
export async function putLinkJoin(
  authPool: pg.Pool,
  masterKeyB64: string,
  input: {
    invitationId: string;
    invitationToken: string;
    tenantId: string;
    email: string;
    name: string;
    password: string;
  },
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_JOIN_TTL_HOURS * 3600e3);
  const pw = seal(masterKeyB64, input.password, "invitation-link-join");
  const r = await authPool.query<{ id: string }>(
    `insert into kaname_auth.invitation_link_joins
       (invitation_id, invitation_token_hash, tenant_id, email, display_name, pw_iv, pw_tag, pw_data, token_hash, expires_at)
     values ($1,$10,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (invitation_id, email) where confirmed_at is null and deleted_at is null do update set
       token_hash = excluded.token_hash, expires_at = excluded.expires_at,
       pw_iv = excluded.pw_iv, pw_tag = excluded.pw_tag, pw_data = excluded.pw_data,
       display_name = excluded.display_name, sent_at = null, send_error = null, updated_at = now()
     returning id`,
    [
      input.invitationId,
      input.tenantId,
      normalizeEmail(input.email),
      input.name,
      pw.iv,
      pw.tag,
      pw.data,
      hashToken(token),
      expiresAt,
      hashToken(input.invitationToken),
    ],
  );
  return { id: r.rows[0]!.id, token, expiresAt };
}

/** 確認のメールを送れたか・送れなかったかを残す（送れていないのに「送りました」と言わない・G-15） */
export async function markLinkJoinSent(authPool: pg.Pool, id: string, error: string | null): Promise<void> {
  await authPool.query(
    "update kaname_auth.invitation_link_joins set sent_at = case when $2::text is null then now() else null end, send_error = $2, updated_at = now() where id = $1",
    [id, error],
  );
}

/** 確認のリンクで引いた保留の行（パスワードは包んだまま） */
export interface ClaimedLinkJoin {
  id: string;
  invitationId: string;
  /** 招待のリンクの印の sha256（受諾の関数に渡す） */
  invitationTokenHash: string;
  tenantId: string;
  email: string;
  name: string;
  sealed: { iv: string; tag: string; data: string };
}
/** 印を付ける 1 文で引く（期限内・まだ印が無い・閉じていない行だけ。同時に何回押しても 1 回だけ取れる）。
 *  取れなければ同じ token_hash の行をもう 1 回読んで見分ける：無い・閉じた＝missing／印がある＝used／期限切れ＝expired */
export async function claimLinkJoin(
  authPool: pg.Pool,
  token: string,
): Promise<{ kind: "ok"; row: ClaimedLinkJoin } | { kind: "missing" | "used" | "expired" }> {
  const h = hashToken(token);
  const r = await authPool.query<{
    id: string;
    invitation_id: string;
    invitation_token_hash: string;
    tenant_id: string;
    email: string;
    display_name: string;
    pw_iv: string;
    pw_tag: string;
    pw_data: string;
  }>(
    `update kaname_auth.invitation_link_joins set confirmed_at = now(), updated_at = now()
      where token_hash = $1 and confirmed_at is null and deleted_at is null and expires_at > now()
      returning id, invitation_id, invitation_token_hash, tenant_id, email, display_name, pw_iv, pw_tag, pw_data`,
    [h],
  );
  const x = r.rows[0];
  if (x)
    return {
      kind: "ok",
      row: {
        id: x.id,
        invitationId: x.invitation_id,
        invitationTokenHash: x.invitation_token_hash,
        tenantId: x.tenant_id,
        email: x.email,
        name: x.display_name,
        sealed: { iv: x.pw_iv, tag: x.pw_tag, data: x.pw_data },
      },
    };
  const why = await authPool.query<{ confirmed: boolean; expired: boolean; closed: boolean }>(
    `select confirmed_at is not null as confirmed, expires_at <= now() as expired, deleted_at is not null as closed
       from kaname_auth.invitation_link_joins where token_hash = $1 limit 1`,
    [h],
  );
  const y = why.rows[0];
  if (!y || y.closed) return { kind: "missing" };
  if (y.confirmed) return { kind: "used" };
  return { kind: y.expired ? "expired" : "missing" };
}

/** 確認の途中で失敗したら印を戻す（もう一度押せば確認できる） */
export async function releaseLinkJoin(authPool: pg.Pool, id: string): Promise<void> {
  await authPool.query(
    "update kaname_auth.invitation_link_joins set confirmed_at = null, updated_at = now() where id = $1",
    [id],
  );
}

/** 参加が決まらないと分かった保留の行を閉じる（印は戻さない・閉じた行は「無い」と同じ） */
export async function closeLinkJoin(authPool: pg.Pool, id: string): Promise<void> {
  await authPool.query(
    "update kaname_auth.invitation_link_joins set deleted_at = now(), pw_iv = null, pw_tag = null, pw_data = null, updated_at = now() where id = $1",
    [id],
  );
}

/** 参加が決まった：包んだパスワードを空にする（行は「使われた」と「期限切れ」を分けるために残す・sealOffPending と同じ） */
export async function sealOffLinkJoin(authPool: pg.Pool, id: string): Promise<void> {
  await authPool.query(
    "update kaname_auth.invitation_link_joins set pw_iv = null, pw_tag = null, pw_data = null, updated_at = now() where id = $1",
    [id],
  );
}

/** 包んだパスワードを開く（用途 invitation-link-join の鍵。鍵が替わっていれば投げる） */
export const openLinkJoinPassword = (masterKeyB64: string, sealed: ClaimedLinkJoin["sealed"]): string =>
  open_(masterKeyB64, sealed, "invitation-link-join");
