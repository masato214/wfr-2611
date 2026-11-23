// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/ticket_stages", op(deps, "listTicketStages"));
  app.post("/api/v1/ticket_stages", op(deps, "createTicketStage"));
  app.post("/api/v1/ticket_stages/order", op(deps, "reorderTicketStages"));
  app.patch("/api/v1/ticket_stages/:id", op(deps, "updateTicketStage"));
  app.delete("/api/v1/ticket_stages/:id", op(deps, "deleteTicketStage"));
}
