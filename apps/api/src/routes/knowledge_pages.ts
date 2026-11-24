// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/knowledge_pages", op(deps, "listKnowledgePages"));
  app.post("/api/v1/knowledge_pages", op(deps, "createKnowledgePage"));
  app.get("/api/v1/knowledge_pages/:id", op(deps, "getKnowledgePage"));
  app.patch("/api/v1/knowledge_pages/:id", op(deps, "updateKnowledgePage"));
  app.delete("/api/v1/knowledge_pages/:id", op(deps, "deleteKnowledgePage"));
  app.post("/api/v1/knowledge_pages/:id/archive", op(deps, "archiveKnowledgePage"));
  app.post("/api/v1/knowledge_pages/:id/attachments", op(deps, "uploadKnowledgeAttachment"));
  app.post("/api/v1/knowledge_pages/:id/copy", op(deps, "copyKnowledgePage"));
  app.patch("/api/v1/knowledge_pages/:id/draft", op(deps, "saveKnowledgeDraft"));
  app.delete("/api/v1/knowledge_pages/:id/draft", op(deps, "discardKnowledgeDraft"));
  app.get("/api/v1/knowledge_pages/:id/links", op(deps, "getKnowledgeLinks"));
  app.post("/api/v1/knowledge_pages/:id/links", op(deps, "linkKnowledgeMention"));
  app.get("/api/v1/knowledge_pages/:id/markdown", op(deps, "exportKnowledgeMarkdown"));
  app.get("/api/v1/knowledge_pages/:id/messages", op(deps, "listKnowledgeMessages"));
  app.post("/api/v1/knowledge_pages/:id/messages", op(deps, "postKnowledgeMessage"));
  app.put("/api/v1/knowledge_pages/:id/must", op(deps, "setKnowledgeMust"));
  app.post("/api/v1/knowledge_pages/:id/publish", op(deps, "publishKnowledgePage"));
  app.post("/api/v1/knowledge_pages/:id/unarchive", op(deps, "unarchiveKnowledgePage"));
  app.get("/api/v1/knowledge_pages/:id/usage", op(deps, "getKnowledgeUsage"));
  app.post("/api/v1/knowledge_pages/:id/verify", op(deps, "verifyKnowledgePage"));
  app.get("/api/v1/knowledge_pages/:id/versions", op(deps, "listKnowledgeVersions"));
  app.get("/api/v1/knowledge_pages/:id/versions/:v", op(deps, "getKnowledgePageVersion"));
  app.post("/api/v1/knowledge_pages/:id/versions/:v/restore", op(deps, "restoreKnowledgeVersion"));
}
