// 招待のリンクの契約の口（K-421）：createInvitationLink（D-148.22）。振る舞いの本体は apps/api/src/features/F10/invite/link.ts。
//   答えにリンクのトークンが入るので、冪等の器に残さない（二度押しで 2 本のリンクができ、どちらも使える）
import type { Hook } from "../contract/deps.js";
import { createCreateInvitationLink } from "../features/F10/invite/link.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function workspaceInvitationLinkHooks(d: HookDeps): Record<string, Hook> {
  return {
    createInvitationLink: { before: createCreateInvitationLink(d), noIdempotency: true },
  };
}

export const register = defineHooks({
  name: "workspaceInvitationLinkHooks",
  make: (d) => workspaceInvitationLinkHooks(d),
  fuzz: "same",
});
