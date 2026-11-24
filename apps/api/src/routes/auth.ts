// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/auth/invitations/confirm", op(deps, "confirmInvitationJoin"));
  app.get("/api/v1/auth/invitations/:token", op(deps, "getInvitation"));
  app.post("/api/v1/auth/invitations/:token/accept", op(deps, "acceptInvitation"));
  app.post("/api/v1/auth/invitations/:token/resend-request", op(deps, "requestInvitationResend"));
  app.post("/api/v1/auth/password/forgot", op(deps, "requestPasswordReset"));
  app.post("/api/v1/auth/password/reset", op(deps, "resetPassword"));
  app.post("/api/v1/auth/recovery/admin-request", op(deps, "requestAdminRecovery"));
  app.get("/api/v1/auth/service-status", op(deps, "getServiceStatus"));
  app.post("/api/v1/auth/sign-in", op(deps, "signInWithPassword"));
  app.post("/api/v1/auth/sign-out", op(deps, "signOut"));
  app.post("/api/v1/auth/sign-up", op(deps, "createSignup"));
  app.post("/api/v1/auth/sign-up/resend", op(deps, "resendSignupEmail"));
  app.get("/api/v1/auth/sign-up/status", op(deps, "getSignupStatus"));
  app.post("/api/v1/auth/sign-up/verify", op(deps, "verifySignup"));
  app.post("/api/v1/auth/step-up", op(deps, "stepUp"));
  app.post("/api/v1/auth/terms/consent", op(deps, "consentToTerms"));
  app.get("/api/v1/auth/terms/current", op(deps, "getCurrentTerms"));
  app.post("/api/v1/auth/two-factor/verify", op(deps, "verifySignInCode"));
}
