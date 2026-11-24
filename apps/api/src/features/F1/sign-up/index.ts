// K-51 登録する：保留の申し込みを作り、確認のメールを送る（契約の口 createSignup・getSignupStatus・resendSignupEmail）。
//   ここでは本人も会社も作らない。確定はメールのリンクを押した時点（K-52）。作るのは 30 分で切れる保留の申し込みまで（D-088）。
//   待つ画面の状態と送り直しは、登録の答えで返す申し込みの印（頭 x-signup-token）で引く。メールでは引かない（D-128.142）。
//   外に出るもの：メール（関門 C6・送出は server.ts の 1 か所）・漏れたパスワードの照合（関門 C1）。保存は認証の接続（kaname_auth の表）
//   ログにパスワード・メールアドレス・申し込みの印・リンクの手がかりを出さない（TP-REG-14）
import type pg from "pg";
import type { ActionGateway } from "@kaname/actions";
import { sendPendingVerification } from "@kaname/auth";
import {
  currentSignupTerms,
  isRegistered,
  markPendingSent,
  pendingBySignupToken,
  putPending,
  renewPendingLink,
} from "@kaname/auth/pending";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { classifyMailError } from "@kaname/notify/resend";
import { kanameError } from "@kaname/errors";
import { OPS_TENANT_ID } from "@kaname/db/id";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fail, isReply, parseSignup } from "./input.js";
import { checkPwned, registerPwned } from "./pwned.js";

/** 運営のテナント（app.ops_tenant_id()・migration 0003）。登録の前は会社が無いので、照合の証跡とセキュリティの記録はここに残す */
// 運営の会社の id は 1 か所（packages/db/src/id.ts・K-1001）。ほかの機能がここから読むので出し直す
export { OPS_TENANT_ID };
const OPS_CTX: TenantContext = { tenantId: OPS_TENANT_ID, userId: null, role: "anonymous" };
export const SIGNUP_TOKEN_HEADER = "x-signup-token";
/** 照合のサービスが使えなかった出来事と、運営がそれを「確かめた」出来事（security_events.kind_id・migration 0086） */
export const PWNED_UNAVAILABLE = "pwned_check_unavailable";
export const PWNED_ACK = "pwned_check_acknowledged";
/** 申し込みの印の長さ（推し量れない長さ・契約の minLength と同じ） */
const TOKEN_MIN = 32;
const TOKEN_MAX = 200;

export type SignupMailer = (m: { to: string; subject: string; text: string }) => Promise<void>;
export interface SignupDeps {
  /** 認証の接続（kaname_auth.pending_signup・本人の表） */
  authPool: pg.Pool;
  repo: Repository;
  /** 外への口（関門 C1）。照合の行為をここに登録する */
  actions: ActionGateway;
  /** メールの送出（関門 C6）。無ければ「送れなかった」を返す（黙って送ったことにしない・G-15） */
  mailer?: SignupMailer;
  config: { secretsMasterKey: string; baseUrl: string; webBaseUrl: string | null; opsEmail: string };
}

const ok = (status: number, data: Record<string, unknown>): HookReply => ({ status, body: { data } });
/** 印が無い・形が違う。登録済み・保留中・無しのどれでも同じ答え（違いから登録の有無を読ませない） */
const NO_TOKEN: HookReply = {
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: SIGNUP_TOKEN_HEADER, message: "申し込みの印が要る" }],
  },
};
const tokenOf = (a: HookArgs): string | null => {
  const t = a.c.req.header(SIGNUP_TOKEN_HEADER)?.trim() ?? "";
  return t.length >= TOKEN_MIN && t.length <= TOKEN_MAX ? t : null;
};

export function signupFeature(d: SignupDeps) {
  registerPwned(d.actions);
  const pool = d.authPool;

  /** 確認のメールを送り、送れたかを残す（送れていないのに「送りました」と言わない・D-088.5） */
  const sendLink = async (email: string, token: string) => {
    const r = await sendPendingVerification(
      {
        ...(d.mailer ? { mailer: d.mailer } : {}),
        baseURL: d.config.baseUrl,
        ...(d.config.webBaseUrl ? { webBaseURL: d.config.webBaseUrl } : {}),
      },
      { email, token },
    );
    await markPendingSent(pool, email, r.error);
    return { sent: r.sent, mail_error: r.error, mail_error_kind: r.error ? classifyMailError(r.error) : null };
  };

  /** 照合のサービスが使えない：登録は止めずに通し、毎回セキュリティの記録に残す（D-128.134）。
   *  運営へのメールは落ち始めの 1 通だけ：まだ運営が「確かめた」にしていない同じ出来事が他に無いときだけ送る（D-128.146）。
   *  「確かめた」は同じ表に PWNED_ACK を追記する（運営の画面とボタンは F12・K-72）。記録にも知らせにも、メールアドレス・パスワードを入れない */
  const pwnedUnavailable = async (reason: string) => {
    const first = await d.repo.securityEventOpening(OPS_TENANT_ID, PWNED_UNAVAILABLE, PWNED_ACK, {
      reason: reason.slice(0, 200),
    });
    if (!first || !d.mailer) return;
    await d
      .mailer({
        to: d.config.opsEmail,
        subject: "Kaname｜漏れたパスワードの照合が使えなくなりました",
        text: `登録のときの漏れたパスワードの照合（Have I Been Pwned）に失敗したので、照合せずに登録を通しています。\n理由：${reason.slice(0, 200)}\nこのあと続けて失敗しても、運営の画面で「確かめた」にするまでメールは送りません（失敗はセキュリティの記録に残ります）。\n照合のサービスの状態を確かめてください（決定ログ D-128.134・D-128.146）。`,
      })
      .catch(() => console.error("[signup] 運営への知らせを送れなかった（照合の失敗）")); // 送れなくても登録は止めない
  };

  const create = async (a: HookArgs): Promise<HookReply> => {
    // パスワードは契約の入口が表記ゆらぎを直す前の値を使う（打ったとおりに預ける）
    const raw = (await a.c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseSignup(a.input, raw["password"]);
    if (isReply(parsed)) return parsed;
    // 確定した人だけ 409。確認していない申し込みは何度でもやり直せる（上書き・D-088.3）。文言のほかは何も返さない
    if (await isRegistered(pool, parsed.email)) return fail("E-CONF-001");
    // 同意は登録の画面の中（続けると同意したことになる）。今の版を申し込みに残す（D-128.137）。利用規約かプライバシーポリシーの今の版が
    // 無ければ登録を通さない（同意の記録が空の人を作らない・D-128.146）。運営が気づけるようにログに出す（メールアドレスは出さない）
    const terms = await currentSignupTerms(pool);
    if (!terms.termsVersionId || !terms.privacyVersionId) {
      console.error(
        "[signup] 規約の版が無いので登録を通さない（利用規約かプライバシーポリシーの今の版が無い・D-128.146）",
      );
      return { status: 500, body: kanameError("E-PAGE-003").toJSON() };
    }
    const pwned = await checkPwned(d.actions, OPS_CTX, parsed.password);
    if (pwned.kind === "leaked") return fail("E-VAL-011", "password");
    if (pwned.kind === "unavailable") await pwnedUnavailable(pwned.reason);
    const { token, expiresAt, signupToken } = await putPending(pool, d.config.secretsMasterKey, {
      ...parsed,
      consent: { ...terms, consentedAt: new Date() },
    });
    const mail = await sendLink(parsed.email, token);
    return ok(201, {
      email: parsed.email,
      ...mail,
      expires_at: expiresAt.toISOString(),
      signup_token: signupToken,
    });
  };

  const status = async (a: HookArgs): Promise<HookReply> => {
    const t = tokenOf(a);
    if (!t) return NO_TOKEN;
    const p = await pendingBySignupToken(pool, t);
    if (!p) return ok(200, { state: "none", email: null, expires_at: null });
    if (p.consumedAt || (await isRegistered(pool, p.email)))
      return ok(200, { state: "registered", email: p.email, expires_at: null });
    if (p.expired) return ok(200, { state: "expired", email: p.email, expires_at: p.expiresAt.toISOString() });
    return ok(200, { state: "pending", email: p.email, expires_at: p.expiresAt.toISOString() });
  };

  const resend = async (a: HookArgs): Promise<HookReply> => {
    const t = tokenOf(a);
    if (!t) return NO_TOKEN;
    const none = {
      sent: false,
      mail_error: null,
      mail_error_kind: null,
      pending: false,
      registered: false,
      expired: false,
    };
    const p = await pendingBySignupToken(pool, t);
    if (!p) return ok(201, { ...none, email: null });
    // 確認まで終わった人が戻ってきて押した（D-088.9）。送らず「終わっています」の元を返す
    if (p.consumedAt || (await isRegistered(pool, p.email)))
      return ok(201, { ...none, email: p.email, registered: true });
    if (p.expired) return ok(201, { ...none, email: p.email, expired: true });
    const renewed = await renewPendingLink(pool, t);
    if (!renewed) return ok(201, { ...none, email: p.email });
    const mail = await sendLink(renewed.email, renewed.token);
    return ok(201, { ...none, email: renewed.email, ...mail, pending: true });
  };

  return { create, status, resend };
}
