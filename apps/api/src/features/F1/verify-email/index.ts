// K-52 メールを確かめる：確認のメールのリンクを押した時点で登録を確定し、そのまま入る（契約の口 verifySignup・D-088・D-088.2）。
//   順番：使うの印を付ける（claimPendingByToken）→ 本人とテナントを作る（signUp。会社名が空なら名前を渡す・D-125.135）→ emailVerified を立てる
//        → 同意を移す（terms_consents・関門 C2 の withTenant）→ 包んだパスワードを消す → 完了のメール（関門 C6）→ ログインの印を返す。
//   印は 1 回だけ付く（同時に何回押しても確定は 1 回）。途中で失敗したら全部戻す：この確定で作った本人（id で指す）と、
//   signUp の hook が作った会社の一式（会社は members.auth_user_id から引く）を kaname_auth.drop_half_made_company で片付け、印を戻す。
//   この確定で作った本人かは、同じメールの本人のパスワードのアカウント（credential）が、いま開いたパスワードで合うかで見分ける
//   （3 回目のレビュー M-A・M-B）。合わない本人（確定の途中に別の道でできた）は何も消さずに E-CONF-001。
//   冪等キーは使わない：2 回目にログインの印を渡すと、リンクを持つ人なら誰でも入れてしまう（2 回目は E-CONF-011）。
//   会社を作る hook（packages/auth の databaseHooks.user.create.after）は変えない（招待で入る人は会社を作らない）。
//   確定の直後の最初のログインでは「新しい端末」の知らせを出さない（D-128.137）：signUp は端末の印（user-agent）を渡さずに作るので、
//   セッションの端末は最初に使われたときに決まり、新しい端末とは数えない。
//   ログにパスワード・メールアドレス・リンクの手がかりを出さない（TP-REG-14）
import type { Auth } from "@kaname/auth";
import {
  authUserHasMembers,
  authUserIdByEmail,
  claimPendingByToken,
  closeSessionsOf,
  termsPendingOfNewSession,
  credentialHashOf,
  deleteAuthUser,
  dropHalfMadeCompany,
  emailOfUser,
  halfMadeTenantOf,
  isRegistered,
  markEmailVerified,
  memberOfNewUser,
  openPendingPassword,
  releasePendingClaim,
  sealOffPending,
  type AuthPool,
  type ClaimedPending,
} from "@kaname/auth/pending";
import { signUp } from "@kaname/auth/signup";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { cleanText } from "../sign-up/input.js";
import { OPS_TENANT_ID, PWNED_UNAVAILABLE } from "../sign-up/index.js";
import { sendDoneMail, type DoneMailer } from "./mail.js";

/** 包んだパスワードが開けなかった出来事（security_events.kind_id）。登録の前なので運営のテナントに置く */
export const PENDING_UNSEALABLE = "pending_signup_unsealable";
/** 手がかりの形（putPending が作る 24 バイトの base64url は 32 文字）。形の違うものは DB を引かずに「無い」と同じ答え */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,200}$/;

export interface VerifyEmailDeps {
  auth: Auth;
  /** 認証の接続（kaname_auth の表） */
  authPool: AuthPool;
  /** 業務の接続（関門 C2 の withTenant・app のスキーマの関数） */
  appPool: AuthPool;
  repo: Repository;
  /** メールの送出（関門 C6・server.ts の 1 か所） */
  mailer?: DoneMailer;
  config: {
    secretsMasterKey: string;
    baseUrl: string;
    webBaseUrl: string | null;
    opsEmail: string;
    mailReplyTo?: string;
  };
}

/** 正本のエラーを、決めた状態の番号で返す（410・500 は正本の class から出ない番号） */
const reply = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const ok = (data: Record<string, unknown>): HookReply => ({ status: 201, body: { data } });
const errName = (e: unknown) => (e as Error)?.name ?? "Error";

/** いまログインしているか（signedIn）と、その人のメール。ログイン中かは文脈の役で決める（members が読めなくても、ログインしていない扱いにしない・D-128.137） */
async function currentUser(a: HookArgs, d: VerifyEmailDeps): Promise<{ signedIn: boolean; email: string | null }> {
  if (a.ctx.role === "anonymous") return { signedIn: false, email: null };
  try {
    const me = a.ctx.userId ? await a.repo.table("members").get(a.ctx, a.ctx.userId) : null;
    const id = me?.["auth_user_id"];
    return { signedIn: true, email: typeof id === "string" ? await emailOfUser(d.authPool, id) : null };
  } catch {
    return { signedIn: true, email: null };
  }
}

/** 確定の途中の失敗。made は、この確定で作った本人の id（作る前に落ちたら null）。会社は片付けるときに members.auth_user_id から引く（M-C）。
 *  otherPath は、同じメールの本人が別の道でできていた（パスワードが合わない・signUp が重複で落ちた）とき。何も消さない。
 *  unsure は、この確定で作った本人かを確かめられなかった（照合や本人の読み出しが落ちた）とき。消さない側に倒し、片付けの失敗と同じに
 *  運営に知らせる（4 回目のレビュー MEDIUM-1）。中身は分かった本人の id（分からなければ null） */
class ConfirmFailed extends Error {
  constructor(
    readonly made: string | null,
    readonly reason: unknown,
    readonly otherPath = false,
    readonly unsure: { authUserId: string | null } | null = null,
  ) {
    super("確定の途中で失敗した");
  }
}
/** 片付けが落ちた・印を戻せなかった出来事（security_events.kind_id）。運営のテナントに置く */
export const SIGNUP_CLEANUP_FAILED = "signup_cleanup_failed";

export function verifyEmailFeature(d: VerifyEmailDeps) {
  /** 同意を本人に移す（申し込みに残した版と時刻・D-128.137）。行の守り terms_consents_self_add を通すため、新しい本人の文脈で入れる */
  const moveConsents = async (ctx: TenantContext, userId: string, p: ClaimedPending) => {
    const versions = [p.termsVersionId, p.privacyVersionId].filter((v): v is string => !!v);
    if (!versions.length) return;
    await withTenant(d.appPool, ctx, async (cl) => {
      for (const v of versions)
        await cl.query(
          "insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at) values ($1, $2, $3, $4, coalesce($5, now()))",
          [ctx.tenantId, ctx.userId, userId, v, p.consentedAt],
        );
    });
  };

  /** その本人が、この確定で作った本人か（3 回目のレビュー M-A・M-B）。members の有る無しや作った時刻では見分けない：
   *  パスワードのアカウント（credential）が、いま開いたパスワードで合えば、この確定で作った本人（Better Auth の password.verify）。
   *  合わなければ別の道の本人（消さない）。アカウントが無い本人は、会社を作る hook で落ちてアカウントを足す前に止まった本人
   *  （ログインできず、会社の人もいない）なので、会社の人がどこにもいないときだけ、この確定で作った本人として片付ける。
   *  照合が落ちたら null（確かめられなかった。呼ぶ側が消さない側に倒して運営に知らせる・MEDIUM-1） */
  const isMine = async (userId: string, password: string): Promise<boolean | null> => {
    try {
      const hash = await credentialHashOf(d.authPool, userId);
      if (hash === null) return !(await authUserHasMembers(d.authPool, userId));
      const ctx = await d.auth.$context;
      return await ctx.password.verify({ hash, password });
    } catch (e) {
      console.error(`[verify-email] この確定で作った本人かを確かめられなかった: ${errName(e)}`);
      return null;
    }
  };
  /** signUp が落ちたとき：同じメールの本人がいれば、パスワードで見分ける。いなければ何も作られていない。
   *  ただし Better Auth が「本人を作れなかった」（FAILED_TO_CREATE_USER）で返したときは、パスワードのアカウントを足す前に止まっている
   *  （signUpEmail はアカウントを本人の追加の後に足す）。そのとき同じメールの本人がアカウントを持っていれば、それは別の道で足された
   *  アカウントなので、パスワードが同じでも消さない（同じパスワードで別の道から入った人を取り違えない・K52-API-039） */
  const signUpFailed = async (email: string, password: string, e: unknown): Promise<ConfirmFailed> => {
    const code = (e as { body?: { code?: string } } | null)?.body?.code ?? "";
    if (code.startsWith("USER_ALREADY_EXISTS")) return new ConfirmFailed(null, e, true);
    let uid: string | null = null;
    try {
      uid = await authUserIdByEmail(d.authPool, email);
      if (!uid) return new ConfirmFailed(null, e);
      if (code === "FAILED_TO_CREATE_USER" && (await credentialHashOf(d.authPool, uid)) !== null)
        return new ConfirmFailed(null, e, true);
    } catch (e2) {
      // 本人がいるか分からない：消す相手を決められないので何も消さず、確かめられなかったとして運営に知らせる（MEDIUM-1）
      console.error(`[verify-email] 同じメールの本人を確かめられなかった: ${errName(e2)}`);
      return new ConfirmFailed(null, e, false, { authUserId: uid });
    }
    const mine = await isMine(uid, password);
    if (mine === null) return new ConfirmFailed(null, e, false, { authUserId: uid });
    return mine ? new ConfirmFailed(uid, e) : new ConfirmFailed(null, e, true);
  };

  /** 確定の本体。失敗したら ConfirmFailed（この確定で作った本人の id つき）を投げる */
  const confirm = async (p: ClaimedPending, password: string) => {
    const name = cleanText(p.name);
    const companyName = cleanText(p.companyName) || name; // 会社名が空なら本人の名前で個人のテナント（D-125.135）
    let r: Awaited<ReturnType<typeof signUp>>;
    try {
      r = await signUp(d.auth, { email: p.email, password, name, companyName });
    } catch (e) {
      throw await signUpFailed(p.email, password, e);
    }
    try {
      await markEmailVerified(d.authPool, r.userId);
      const m = await memberOfNewUser(d.authPool, d.appPool, r.userId);
      if (!m) throw new Error("確定した本人の会社の人が見つからない");
      const ctx: TenantContext = { tenantId: m.tenantId, userId: m.memberId, role: "member" };
      await moveConsents(ctx, r.userId, p);
      // 照合が使えなかった登録は、確定したこの会社の出来事として残す（K-1018・D-156.35）。本人は確定した管理者・detail は空。
      // 書けなければ確定の失敗と同じ（作りかけを片付けて印を戻す・もう一度押せば確定できる・D-128.167）
      if (p.pwnedUnchecked) await d.repo.securityEvent(m.tenantId, PWNED_UNAVAILABLE, m.memberId, null, {});
      // 同意を移した後に、この本人のセッションの同意し直しの印を決め直す（K-53）。signUp でセッションができた時点では同意がまだ無く印が立つ。
      // 登録のときの版が今の版なら下り、登録と確定の間に新しい版が出ていれば立ったまま（次の画面で同意し直す）
      await d.appPool.query("select app.refresh_terms_pending($1)", [r.userId]);
      // 答えに返すこのセッションの印（K-53）。画面は true なら同意し直しの画面へ、false なら今の行き先へ移す
      const termsPending = await termsPendingOfNewSession(d.authPool, d.appPool, r.userId);
      return { userId: r.userId, token: r.token, ctx, name, termsPending };
    } catch (e) {
      throw new ConfirmFailed(r.userId, e);
    }
  };

  /** この確定で作った本人と、その会社の中身を片付ける（D-128.167）。会社は members.auth_user_id から引き（人がその本人 1 人だけの会社）、
   *  片付けの関数の守りで外れて片付けられなかったら失敗として投げる（M-C：「片付けるはずのものが残っているのに何もしない」を成功にしない）。
   *  本人は、会社の人がどこにも残っていないときだけ消す。残っていたら kept（確定の途中に別の道でその会社に入った）。
   *  投げるときも、分かった会社の id を ids に残す（片付けの失敗の記録に使う） */
  const cleanUp = async (userId: string, ids: { tenant_id: string | null }): Promise<"cleaned" | "kept"> => {
    const tenant = await halfMadeTenantOf(d.authPool, userId);
    ids.tenant_id = tenant;
    if (tenant && !(await dropHalfMadeCompany(d.authPool, tenant, userId)))
      throw new Error("作りかけの会社が片付けの守りで片付けられなかった");
    if (await authUserHasMembers(d.authPool, userId)) return "kept";
    await deleteAuthUser(d.authPool, userId);
    return "cleaned";
  };

  /** 運営に知らせ（関門 C6）、セキュリティの記録（運営のテナント）に残す。detail は会社の id（tenant_id）と認証の本人の id（auth_user_id）。
   *  メールアドレスは記録にも知らせにも書かない（M-D）。どちらが落ちても止めない */
  const alertOps = async (what: string, ids: { tenant_id: string | null; auth_user_id: string | null }) => {
    try {
      await d.repo.securityEvent(OPS_TENANT_ID, SIGNUP_CLEANUP_FAILED, null, null, { what, ...ids });
    } catch (e) {
      console.error(`[verify-email] セキュリティの記録に残せなかった: ${errName(e)}`);
    }
    if (!d.mailer) return;
    await d
      .mailer({
        to: d.config.opsEmail,
        subject: "Kaname｜登録の確定の途中の片付けが落ちました",
        text: `メールの確認のリンクで登録を確定する途中で落ち、そのあとの${what}ができませんでした。\n作りかけの会社・本人が残っているか、申し込みが使い終わりのままです。セキュリティの記録（${SIGNUP_CLEANUP_FAILED}）を確かめてください（K-52・D-128.167）。\n会社の id：${ids.tenant_id ?? "不明"}\n認証の本人の id：${ids.auth_user_id ?? "不明"}`,
      })
      .catch(() => console.error("[verify-email] 運営への知らせを送れなかった（片付けの失敗）"));
  };

  /** 確定した後の片付け。落ちても確定は済んでいるので答えは変えない。ログに残す（メールアドレスは出さない） */
  const afterwards = async (what: string, fn: () => Promise<void>, tries = 1) => {
    for (let i = 0; i <= tries; i++) {
      try {
        await fn();
        return;
      } catch (e) {
        console.error(`[verify-email] 確定の後の${what}が落ちた（${i + 1} 回目）: ${errName(e)}`);
      }
    }
  };

  const verify = async (a: HookArgs): Promise<HookReply> => {
    // 前後の空白（メールソフトが付ける）は契約の入口が落とす。それ以外は直さない
    const token = typeof a.input["token"] === "string" ? a.input["token"].trim() : "";
    if (!token) return reply(422, "E-PAGE-006");
    // 形の違う手がかりは、でたらめと同じ答え（形の違いで中身を探らせない・TP-REG-07）
    if (!TOKEN_RE.test(token)) return reply(410, "E-PAGE-006");
    const me = await currentUser(a, d);
    let claim: Awaited<ReturnType<typeof claimPendingByToken>>;
    try {
      claim = await claimPendingByToken(d.authPool, token);
    } catch (e) {
      console.error(`[verify-email] 申し込みを引けなかった: ${errName(e)}`);
      return reply(500, "E-PAGE-003");
    }
    if (claim.kind === "gone" || claim.kind === "unusable") return reply(410, "E-PAGE-006");
    if (claim.kind === "expired") return reply(410, "E-AUTH-003");
    if (claim.kind === "replaced") return reply(410, "E-AUTH-008");
    if (claim.kind === "done")
      // 確定済み。別のアカウントでログイン中なら、そのまま（勝手に切り替えない・D-128.137）
      return me.signedIn && me.email !== claim.email ? reply(409, "E-AUTH-009") : reply(409, "E-CONF-011");

    const p = claim.pending;
    // 申し込みの後に、別の道で同じメールの本人ができた：申し込みは使い終わりのまま、二重に作らない
    if (await isRegistered(d.authPool, p.email)) {
      await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
      return reply(409, "E-CONF-001");
    }
    let password: string;
    try {
      password = openPendingPassword(d.config.secretsMasterKey, p.sealed);
    } catch {
      // 鍵が替わった：確定しない。印は戻さず使い終わりのまま、包んだパスワードは空にする（押し直しても同じ登録し直しの案内）。
      // セキュリティの記録に残す（メールアドレスは書かない）
      await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
      try {
        await d.repo.securityEvent(OPS_TENANT_ID, PENDING_UNSEALABLE, null, null, {
          reason: "包んだパスワードを開けない",
        });
      } catch (e) {
        console.error(`[verify-email] セキュリティの記録に残せなかった（鍵の入れ替え）: ${errName(e)}`);
      }
      console.error("[verify-email] 申し込みのパスワードを開けなかった（鍵の入れ替え）");
      return reply(410, "E-PAGE-006");
    }
    let done: Awaited<ReturnType<typeof confirm>>;
    try {
      done = await confirm(p, password);
    } catch (e) {
      const f = e instanceof ConfirmFailed ? e : new ConfirmFailed(null, e);
      console.error(`[verify-email] 確定できなかった: ${errName(f.reason)}`);
      // 同じメールの本人が別の道でできた（パスワードが合わない・signUp が重複で落ちた）：何も消さない。申し込みは使い終わりのまま（HIGH-1・M-B）
      if (f.otherPath) {
        await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
        return reply(409, "E-CONF-001");
      }
      // この確定で作った本人かを確かめられなかった：消さない側に倒す。片付けの失敗と同じに、運営に知らせて印は戻さない（MEDIUM-1）
      if (f.unsure) {
        const uid = f.unsure.authUserId;
        const tenant = uid ? await halfMadeTenantOf(d.authPool, uid).catch(() => null) : null;
        await alertOps("この確定で作った本人かの見分け（何も片付けていない）", {
          tenant_id: tenant,
          auth_user_id: uid,
        });
        return reply(500, "E-PAGE-003");
      }
      // 途中まで残さない：この確定で作った本人と会社の中身を片付ける（会社は印を付けて残す・D-128.167）。
      // 片付けと印を戻すのは別々に。片付けが落ちたら印は戻さない（作りかけが残ったまま押し直させない）
      const ids: { tenant_id: string | null } = { tenant_id: null };
      if (f.made) {
        let done2: "cleaned" | "kept";
        try {
          done2 = await cleanUp(f.made, ids);
        } catch (e2) {
          console.error(`[verify-email] 作りかけを片付けられなかった: ${errName(e2)}`);
          await alertOps("作りかけの会社と本人の片付け", { tenant_id: ids.tenant_id, auth_user_id: f.made });
          return reply(500, "E-PAGE-003");
        }
        // 本人は別の会社に入っている（確定の途中に招待などの別の道で入った）：本人は残し、二重に作らない
        if (done2 === "kept") {
          await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
          return reply(409, "E-CONF-001");
        }
      }
      try {
        await releasePendingClaim(d.authPool, claim.tokenHash);
      } catch (e3) {
        console.error(`[verify-email] 申し込みの印を戻せなかった: ${errName(e3)}`);
        await alertOps("申し込みの印を戻す処理", { tenant_id: ids.tenant_id, auth_user_id: f.made });
      }
      return reply(500, "E-PAGE-003");
    }
    await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
    // 別のアカウントでログイン中：確定だけして、新しい本人のセッションはすぐ閉じる（今のアカウントは切り替えない・D-128.137）。閉じるのは 1 回やり直す
    const signedIn = !me.signedIn;
    if (!signedIn)
      await afterwards("セッションを閉じる処理", () => closeSessionsOf(d.authPool, d.appPool, done.userId), 1);
    const web = d.config.webBaseUrl ?? d.config.baseUrl;
    await sendDoneMail(d, done.ctx, {
      email: p.email,
      name: done.name,
      loginUrl: `${web}/login`,
      supportEmail: d.config.mailReplyTo || d.config.opsEmail,
    });
    // 答えに本人の id は入れない（email・token・signed_in だけ）
    // 別のアカウントでログイン中（新しい本人のセッションは閉じた）なら印は返さない（false）
    return ok({
      email: p.email,
      token: signedIn ? done.token : null,
      signed_in: signedIn,
      terms_pending: signedIn ? done.termsPending : false,
    });
  };

  return { verify };
}
