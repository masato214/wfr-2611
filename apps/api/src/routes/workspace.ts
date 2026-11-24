// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/workspace", op(deps, "getWorkspaceSettings"));
  app.patch("/api/v1/workspace", op(deps, "updateWorkspace"));
  app.get("/api/v1/workspace/billing", op(deps, "getBilling"));
  app.patch("/api/v1/workspace/billing-contact", op(deps, "updateBillingContact"));
  app.post("/api/v1/workspace/deletion", op(deps, "requestWorkspaceDeletion"));
  app.delete("/api/v1/workspace/deletion", op(deps, "cancelWorkspaceDeletion"));
  app.post("/api/v1/workspace/logo", op(deps, "uploadWorkspaceLogo"));
  app.get("/api/v1/workspace/members", op(deps, "getWorkspaceMembers"));
  app.patch("/api/v1/workspace/permissions", op(deps, "updateWorkspacePermissions"));
  app.post("/api/v1/workspace/plan", op(deps, "changePlan"));
  app.get("/api/v1/workspace/plans", op(deps, "listWorkspacePlans"));
  app.get("/api/v1/workspace/ticket-shape", op(deps, "getTicketShape"));
  app.patch("/api/v1/workspace/ticket-shape", op(deps, "saveTicketShape"));
  app.post("/api/v1/workspace/ticket-shape/preview", op(deps, "previewTicketShapeChange"));
}
