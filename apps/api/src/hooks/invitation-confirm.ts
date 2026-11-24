// 招待のリンクで新しく入る人の確認（K-422）の契約の口 confirmInvitationJoin。振る舞いの本体は features/F2/invitations/confirm.ts。
//   答えにログインの印が入るので冪等の器に残さない（2 回目にログインの印を渡すと、リンクを持つ人なら誰でも入れてしまう）
import type { Hook } from "../contract/deps.js";
import { invitationConfirmFeature } from "../features/F2/invitations/confirm.js";
import type { InvitationDeps } from "../features/F2/invitations/deps.js";
import { defineHooks } from "./registry.js";

export function invitationConfirmHooks(d: InvitationDeps): Record<string, Hook> {
  const f = invitationConfirmFeature(d);
  return { confirmInvitationJoin: { before: f.confirm, noIdempotency: true } };
}

export const register = defineHooks({
  name: "invitationConfirmHooks",
  make: (d) =>
    invitationConfirmHooks({
      auth: d.auth,
      appPool: d.appPool,
      authPool: d.authPool,
      actions: d.actions,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      config: {
        opsEmail: d.config.opsEmail,
        webBaseUrl: d.config.webBaseUrl ?? "",
        secretsMasterKey: d.config.secretsMasterKey,
      },
    }),
  fuzz: "same",
});
