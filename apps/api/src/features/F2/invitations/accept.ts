// K-332 新しく作って参加する（契約の口 acceptInvitation・POST /api/v1/auth/invitations/:token/accept・ログインしていない人）。
//   入り方は登録と同じ形（answer=becc3d3aa526 ①）：名前とパスワードで本人を作り、招かれたワークスペースに所属させ、
//   入った直後のセッションは「付けるまで進めない」（mfa_pending・K-308 の hook）。メールは招待のリンクが届いたことで確かめ済み。
//   規約は画面の「続けると同意」で同意したことにする（D-128.137・受諾と同じ取引で今の版に記録）。
//   順：① トークンの形 → 招待の様子（無い 404・取り消し／期限切れ／使われた 410）② ワークスペースが止められている 403
//       ③ 名前 ④ パスワード（長さ・漏れ）⑤ 宛てに利用者がいれば 409 ⑥ 利用者を作る（外に影響する手順 1・［残る］）→ 受諾（手順 2）
//       → 失敗したら作った利用者を id で消す（後片付け）⑦ セッションを作る（手順 3・失敗しても参加は取り消さない）⑧ 201。
//   上限（10 回／分／IP）は契約の入口（op.ts）が先に確かめる。体の email は読まない（宛ては招待のもの）。ただし送られた email の形は招待の種類によらず契約の決まり（空・形違いは 422・E-INV-013）。
//   ログに宛てのメール・パスワード・トークンを出さない（宛先は mailTag の印・例外は種類だけ）
// K-422 リンクの招待（宛てのメールが空）で、ログインしていない人が新しく入る：利用者も所属も作らない（D-148.51）。
//   順：① ② ③ ④ は同じ → メール（空・形違い 422・E-INV-013／送られていない 409・E-INV-016）→ そのメールにもうアカウント 409・E-INV-006
//       → 保留の行を置く（S1）→ 確認のメールを送る（S2・関門 C6）→ 送った印（S3）→ 202 { state: "sent" | "failed", email: 伏せたメール }。
//       確認のリンクを押したときの続きは confirm.ts（confirmInvitationJoin）。宛てのメールの在る招待は今のまま（体の email は読まない）
// K-333 今のアカウントで参加する（ログイン中の人・D-125.150）：入口がセッションを解けたら（ctx.role が member）この分に入り、体は読まない。
//   順：① ② は同じ → 別のメール宛て 403・E-INV-005（answer=becc3d3aa526 ②）→ もう入っている 409・E-INV-007（answer=7fe1f09fdab4 ⑦）
//       → app.join_invitation（所属を足す・前に抜けた所属は戻す・出来事・そのログインの印だけ招かれた所へ付け替え を 1 つの取引）→ 201 { 今の印, workspace_id, next "/" }。
//   宛てともう入っているの判定は関数の中（招待の行を for update で読んだ後）でする。招待の状態以外の失敗は 503・E-PAGE-003（取引ごと戻り何も残らない）
import { checkPwned } from "../../F1/sign-up/pwned.js";
import { cleanText } from "../../F1/sign-up/input.js";
import { OPS_TENANT_ID } from "../../F1/sign-up/index.js";
import {
  acceptInvitationAgreeing,
  acceptRefusal,
  createInvitedUser,
  hashToken,
  invitationForAccept,
  joinInvitation,
  joinRefusal,
  markLinkJoinSent,
  openSessionFor,
  putLinkJoin,
  type InvitationForAccept,
} from "@kaname/auth/invitations";
import { authUserIdByEmail, deleteAuthUser } from "@kaname/auth/pending";
import { EMAIL_RE, mailTag, normalizeEmail } from "@kaname/auth/signup";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { InvitationDeps } from "./deps.js";
import { linkJoinMail, maskEmail, CONFIRM_PATH } from "./confirm-mail.js";
import { TOKEN_MAX } from "./preview.js";

/** 名前の上限（D-128.142・登録と同じ） */
export const NAME_MAX = 100;
/** パスワードの長さ（E-VAL-005・E-VAL-026・部品の上限 128 と同じ・K-314） */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
/** 入った直後に移る画面（付けるまで進めない・K-308） */
export const NEXT_AFTER_JOIN = "/mfa-setup";
/** ログイン中の人が参加した後に移る画面（招かれたワークスペースのはじめ・K-333） */
export const NEXT_AFTER_SIGNED_JOIN = "/";

const OPS_CTX: TenantContext = { tenantId: OPS_TENANT_ID, userId: null, role: "anonymous" };

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const reply = (status: number, code: string, field?: string): HookReply => ({
  status,
  body: kanameError(code, field ? { field } : {}).toJSON(),
});
const unavailable = (): HookReply => reply(503, "E-PAGE-003");
/** 招待の状態ごとの答え（D-128.63） */
const GONE: Record<Exclude<InvitationForAccept["state"], "ok">, string> = {
  revoked: "E-INV-002",
  expired: "E-INV-003",
  used: "E-INV-004",
};

export function invitationAcceptFeature(d: InvitationDeps) {
  /** 前処理：体の email は残す（読むのはリンクの招待で新しく入るときだけ・メールで招いた招待は体の email を読まない＝K332-API-009）。
   *  ほかの欄は契約の strict な形が確かめる */
  const input = (raw: unknown): { input: Record<string, unknown> } | { reply: HookReply } => {
    const b = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
    // 送られたメールの形（空・空白だけ・形違い）は契約の VALUE_RANGES の pattern と同じ決まり：422・E-INV-013・欄 email。
    //   メールが送られていないときは招待の行（宛てが無いか）で決まるので、ここでは見ない（linkJoin が 409）
    const e = b["email"];
    if (typeof e === "string" && !EMAIL_RE.test(normalizeEmail(e))) return { reply: reply(422, "E-INV-013", "email") };
    return { input: b };
  };

  /** 名前とパスワードを確かめる。通らなければ 422 の答え */
  const check = async (a: HookArgs): Promise<{ name: string; password: string } | HookReply> => {
    const name = cleanText(a.input["name"]);
    if (!name || [...name].length > NAME_MAX) return reply(422, "E-VAL-007", "name");
    // パスワードは入口の正規化（前後の空白を落とす・NFKC）の前の値を使う（打ったとおりに預ける・登録と同じ）
    const raw = (await a.c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const pw = typeof raw["password"] === "string" ? raw["password"] : a.input["password"];
    const password = typeof pw === "string" ? pw : "";
    if ([...password].length < PASSWORD_MIN) return reply(422, "E-VAL-005", "password");
    if (password.length > PASSWORD_MAX) return reply(422, "E-VAL-026", "password");
    const leaked = await checkPwned(d.actions, OPS_CTX, password);
    if (leaked.kind === "leaked") return reply(422, "E-VAL-011", "password");
    if (leaked.kind === "unavailable")
      console.warn(`[invitation] 漏れの照合が使えないので、照合せずに通す: ${leaked.reason}`);
    return { name, password };
  };

  /** 手順 1 の後片付け：この要求で作った利用者を id で消す（メールで引いて消さない：同時に押した勝った方を消さないため） */
  const cleanUp = async (inv: InvitationForAccept, userId: string, why: string): Promise<void> => {
    try {
      await deleteAuthUser(d.authPool, userId);
    } catch (e) {
      console.error(
        `[invitation] 後片付け：参加の途中（${why}）で落ち、作った利用者を消せなかった（招待 ${inv.invitationId}・利用者だけ残った・${kindOf(e)}）`,
      );
    }
  };

  /** ログイン中の本人（認証の利用者とセッション）。入口が会社の人として解けたときだけ。無ければ null（ログインしていない人の分） */
  const signedIn = async (a: HookArgs): Promise<{ userId: string; sessionId: string; token: string } | null> => {
    if (a.ctx.role !== "member") return null;
    const s = await d.auth.api.getSession({ headers: a.c.req.raw.headers });
    return s ? { userId: s.user.id, sessionId: s.session.id, token: s.session.token } : null;
  };

  /** 今のアカウントで参加する（K-333） */
  const join = async (
    token: string,
    inv: InvitationForAccept,
    me: { userId: string; sessionId: string; token: string },
  ): Promise<HookReply> => {
    try {
      const r = await joinInvitation(d.appPool, token, me.userId, me.sessionId);
      return {
        status: 201,
        body: { data: { token: me.token, workspace_id: r.tenantId, next: NEXT_AFTER_SIGNED_JOIN } },
      };
    } catch (e) {
      const why = joinRefusal(e);
      if (why === "wrong_email") return reply(403, "E-INV-005");
      if (why === "already_member") return reply(409, "E-INV-007");
      if (why === "used" || why === "revoked" || why === "expired") return reply(410, GONE[why]);
      if (why === "not_found") return reply(404, "E-INV-001");
      console.error(`[invitation] 今のアカウントで参加できなかった（招待 ${inv.invitationId}・${kindOf(e)}）`);
      return unavailable();
    }
  };

  /** 確認のメールの文に載せる招待の事実（ワークスペースの名前・招いた人の名前）。読めなくても送れる（名前なしの文になる） */
  const mailFacts = async (
    a: HookArgs,
    token: string,
  ): Promise<{ workspace: string | null; inviter: string | null }> => {
    try {
      return await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ workspace_name: string | null; inviter_name: string | null }>(
          "select workspace_name, inviter_name from app.invitation_preview2($1, null)",
          [hashToken(token)],
        );
        return { workspace: r.rows[0]?.workspace_name ?? null, inviter: r.rows[0]?.inviter_name ?? null };
      });
    } catch (e) {
      console.error(`[invite-link] 確認のメールの名前を読めなかった（${kindOf(e)}）`);
      return { workspace: null, inviter: null };
    }
  };

  /** 保留の行に送った印を書く。落ちたら 1 回だけやり直し、それでも落ちたらログに 1 行（答えは変えない・S3） */
  const markSent = async (id: string, error: string | null): Promise<void> => {
    for (let i = 0; i < 2; i++) {
      try {
        await markLinkJoinSent(d.authPool, id, error);
        return;
      } catch (e) {
        if (i === 1) console.error(`[invite-link] 送った印を書けなかった → ${kindOf(e)}`);
      }
    }
  };

  /** リンクの招待で、ログインしていない人が新しく入る（K-422）。名前・パスワードは確かめ済み */
  const linkJoin = async (
    a: HookArgs,
    token: string,
    inv: InvitationForAccept,
    ok: { name: string; password: string },
  ): Promise<HookReply> => {
    const rawEmail = a.input["email"];
    const email = typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";
    // 送られていない（宛てのメールが無い招待は体のメールが要る）：招待の行で決まる断りなので 409（欄・details は付けない）
    if (!email) return reply(409, "E-INV-016");
    try {
      if (await authUserIdByEmail(d.authPool, email)) return reply(409, "E-INV-006");
    } catch (e) {
      console.error(`[invite-link] 利用者を引けなかった → ${mailTag(email)}: ${kindOf(e)}`);
      return unavailable();
    }
    // S1：保留の行を置く（1 文）。失敗したら何も残らない
    let put: Awaited<ReturnType<typeof putLinkJoin>>;
    try {
      put = await putLinkJoin(d.authPool, d.config.secretsMasterKey, {
        invitationId: inv.invitationId,
        invitationToken: token,
        tenantId: inv.tenantId,
        email,
        name: ok.name,
        password: ok.password,
      });
    } catch (e) {
      console.error(`[invite-link] 保留の行を置けなかった → ${mailTag(email)}: ${kindOf(e)}`);
      return unavailable();
    }
    // S2：確認のメールを送る（関門 C6）［残る］。送れなくても保留の行は残し、送れなかった印を書く
    const facts = await mailFacts(a, token);
    const mail = linkJoinMail({
      name: ok.name,
      workspaceName: facts.workspace,
      inviterName: facts.inviter,
      url: `${d.config.webBaseUrl}${CONFIRM_PATH}${put.token}`,
    });
    let sendError: string | null = null;
    if (!d.mailer) sendError = "no_mailer";
    else {
      try {
        await d.mailer({ to: email, subject: mail.subject, text: mail.text });
      } catch (e) {
        sendError = kindOf(e); // 保留の行に残すのは例外の種類だけ（文には宛てのメールや外のサービスの中身が入りうる）
        console.error(`[invite-link] 確認のメールを送れなかった → ${mailTag(email)}: ${kindOf(e)}`);
      }
    }
    // S3：送った印（S2 の後片付け）
    await markSent(put.id, sendError);
    return {
      status: 202,
      body: { data: { state: sendError ? "failed" : "sent", email: maskEmail(email) } },
    };
  };

  const accept = async (a: HookArgs): Promise<HookReply> => {
    const token = a.c.req.param("token") ?? "";
    if (token.length < 1 || token.length > TOKEN_MAX) return reply(404, "E-INV-001");
    let inv: InvitationForAccept | null;
    try {
      inv = await invitationForAccept(d.appPool, token);
    } catch (e) {
      console.error(`[invitation] 招待を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!inv) return reply(404, "E-INV-001");
    if (inv.state !== "ok") return reply(410, GONE[inv.state]);
    if (inv.workspaceSuspended) return reply(403, "E-AUTH-012");
    let me: Awaited<ReturnType<typeof signedIn>>;
    try {
      me = await signedIn(a);
    } catch (e) {
      console.error(`[invitation] セッションを読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (me) return join(token, inv, me);
    const ok = await check(a);
    if ("status" in ok) return ok;
    // リンクの招待（宛てのメールが空）：確認のメールだけを送る（K-422）
    if (!inv.email) return linkJoin(a, token, inv, ok);

    // 手順 1：認証の利用者を作る［残る］
    let made: Awaited<ReturnType<typeof createInvitedUser>>;
    try {
      made = await createInvitedUser(d.auth, d.authPool, { email: inv.email, name: ok.name, password: ok.password });
    } catch (e) {
      const half = (e as { madeUserId?: unknown } | null)?.madeUserId;
      if (typeof half === "string") await cleanUp(inv, half, "パスワードのアカウント");
      console.error(
        `[invitation] 利用者を作れなかった（招待 ${inv.invitationId}・${mailTag(inv.email)}・${kindOf(e)}）`,
      );
      return unavailable();
    }
    // 宛てにもうアカウントがある（同時に 2 回押した負けの方も）：何も作らず、何も消さない（answer=becc3d3aa526 ③）
    if (made.kind === "exists") return reply(409, "E-INV-006");

    // 手順 2：受諾（所属・グループ・規約の同意・出来事を 1 つの取引）。失敗したら手順 1 の利用者を消す
    try {
      await acceptInvitationAgreeing(d.appPool, token, made.userId, ok.name);
    } catch (e) {
      await cleanUp(inv, made.userId, "受諾");
      const why = acceptRefusal(e);
      if (why === "used" || why === "revoked" || why === "expired") return reply(410, GONE[why]);
      if (why === "not_found") return reply(404, "E-INV-001");
      console.error(`[invitation] 受諾できなかった（招待 ${inv.invitationId}・${kindOf(e)}）`);
      return unavailable();
    }

    // 手順 3：セッションを作る（止め・写し・付けるまで進めない印は部品の hook）。失敗しても参加は取り消さない（ログインの画面から入れる）
    let sessionToken: string;
    try {
      sessionToken = await openSessionFor(d.auth, made.userId);
    } catch (e) {
      console.error(`[invitation] 参加はできたがセッションを作れなかった（招待 ${inv.invitationId}・${kindOf(e)}）`);
      return unavailable();
    }
    return {
      status: 201,
      body: { data: { token: sessionToken, workspace_id: inv.tenantId, next: NEXT_AFTER_JOIN } },
    };
  };

  return { input, accept };
}
