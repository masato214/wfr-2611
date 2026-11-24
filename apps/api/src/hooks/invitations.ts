// 招待の契約の口の振る舞い（K-331 下見。K-332・K-333 参加・K-334 送り直しも同じ hooks に足す）。中身は apps/api/src/features/F2/invitations/。
//   上限・道の値の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import type { InvitationDeps } from "../features/F2/invitations/deps.js";
import { invitationPreviewFeature } from "../features/F2/invitations/preview.js";
import { invitationResendFeature } from "../features/F2/invitations/resend.js";
import { invitationAcceptFeature } from "../features/F2/invitations/accept.js";
import { registerPwned } from "../features/F1/sign-up/pwned.js";
import { defineHooks } from "./registry.js";

export type { InvitationDeps, InvitationMailer } from "../features/F2/invitations/deps.js";

export function invitationHooks(d: InvitationDeps): Record<string, Hook> {
  const preview = invitationPreviewFeature(d);
  const resend = invitationResendFeature(d);
  registerPwned(d.actions);
  const accept = invitationAcceptFeature(d);
  return {
    getInvitation: { before: preview.read },
    // 送り直しを頼む（K-334）。期限切れの招待だけ・招いた人か管理者に知らせる（関門 C6 の mailer）・同じ招待で 1 日 1 回
    requestInvitationResend: { before: resend.request },
    // 新しく作って参加する（K-332・ログインしていない人）。答えにログインの印が入るので冪等の器に残さない
    acceptInvitation: { input: accept.input, before: accept.accept, noIdempotency: true },
  };
}

export const register = defineHooks({
  name: "invitationHooks",
  make: (d) =>
    invitationHooks({
      auth: d.auth,
      appPool: d.appPool,
      authPool: d.authPool,
      actions: d.actions, // 参加（K-332）の漏れたパスワードの照合（関門 C1・登録と同じ行為）
      ...(d.mailer ? { mailer: d.mailer } : {}),
      config: {
        opsEmail: d.config.opsEmail,
        webBaseUrl: d.config.webBaseUrl ?? "",
        secretsMasterKey: d.config.secretsMasterKey,
      },
    }),
  fuzz: "same",
});
