// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.post("/api/v1/knowledge/ask", op(deps, "askKnowledge"));
  app.post("/api/v1/knowledge/ask/feedback", op(deps, "sendKnowledgeAnswerFeedback"));
  app.post("/api/v1/knowledge/folders", op(deps, "createKnowledgeFolder"));
  app.patch("/api/v1/knowledge/folders/:id", op(deps, "updateKnowledgeFolder"));
  app.delete("/api/v1/knowledge/folders/:id", op(deps, "deleteKnowledgeFolder"));
  app.get("/api/v1/knowledge/home", op(deps, "getKnowledgeHome"));
  app.get("/api/v1/knowledge/link-targets", op(deps, "searchKnowledgeLinkTargets"));
  app.get("/api/v1/knowledge/proposals", op(deps, "listKnowledgeProposals"));
  app.post("/api/v1/knowledge/proposals/:id/accept", op(deps, "acceptKnowledgeProposal"));
  app.post("/api/v1/knowledge/proposals/:id/decline", op(deps, "declineKnowledgeProposal"));
  app.post("/api/v1/knowledge/similar", op(deps, "findSimilarKnowledge"));
  app.get("/api/v1/knowledge/tree", op(deps, "getKnowledgeTree"));
  app.get("/api/v1/knowledge/verifications", op(deps, "listKnowledgeVerifications"));
}
