// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/action_runs/:id", op(deps, "getActionRun"));
  app.post("/api/v1/action_runs/:id/stop", op(deps, "stopActionRun"));
  app.post("/api/v1/action_runs/:id/takeover", op(deps, "takeoverActionRun"));
}
