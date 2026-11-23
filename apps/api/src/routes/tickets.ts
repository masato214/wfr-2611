// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）
import type { Hono } from "hono";
import type { Vars } from "../middleware/tenant.js";
import { op, type ContractDeps } from "../contract/op.js";

export function register(app: Hono<Vars>, deps: ContractDeps): void {
  app.get("/api/v1/tickets", op(deps, "listTickets"));
  app.post("/api/v1/tickets", op(deps, "createTicket"));
  app.post("/api/v1/tickets/bulk", op(deps, "bulkUpdateTickets"));
  app.get("/api/v1/tickets/:id", op(deps, "getTicket"));
  app.patch("/api/v1/tickets/:id", op(deps, "updateTicket"));
  app.delete("/api/v1/tickets/:id", op(deps, "deleteTicket"));
  app.post("/api/v1/tickets/:id/acceptances", op(deps, "requestAcceptance"));
  app.get("/api/v1/tickets/:id/agent-session", op(deps, "getTicketAgentSession"));
  app.post("/api/v1/tickets/:id/agent-session/apply", op(deps, "applyTicketAgentProposal"));
  app.post("/api/v1/tickets/:id/agent-session/messages", op(deps, "sendTicketAgentMessage"));
  app.get("/api/v1/tickets/:id/artifacts", op(deps, "listTicketArtifacts"));
  app.post("/api/v1/tickets/:id/attachments", op(deps, "createTicketAttachment"));
  app.patch("/api/v1/tickets/:id/body", op(deps, "updateTicketBody"));
  app.get("/api/v1/tickets/:id/checks", op(deps, "listChecks"));
  app.patch("/api/v1/tickets/:id/client-share", op(deps, "updateTicketClientShare"));
  app.post("/api/v1/tickets/:id/complete", op(deps, "completeTicket"));
  app.get("/api/v1/tickets/:id/decisions", op(deps, "listTicketDecisions"));
  app.post("/api/v1/tickets/:id/decisions", op(deps, "createTicketDecision"));
  app.post("/api/v1/tickets/:id/delegate", op(deps, "delegateTicket"));
  app.get("/api/v1/tickets/:id/delete-preview", op(deps, "previewTicketDelete"));
  app.post("/api/v1/tickets/:id/dry-run", op(deps, "dryRunTicket"));
  app.post("/api/v1/tickets/:id/handovers", op(deps, "createTicketHandover"));
  app.get("/api/v1/tickets/:id/kind-change-preview", op(deps, "previewTicketKindChange"));
  app.get("/api/v1/tickets/:id/links", op(deps, "listTicketLinks"));
  app.post("/api/v1/tickets/:id/links", op(deps, "createTicketLink"));
  app.post("/api/v1/tickets/:id/messages", op(deps, "createTicketMessage"));
  app.get("/api/v1/tickets/:id/references", op(deps, "listTicketReferences"));
  app.post("/api/v1/tickets/:id/restore", op(deps, "restoreTicket"));
  app.get("/api/v1/tickets/:id/runs", op(deps, "listTicketRuns"));
  app.get("/api/v1/tickets/:id/test-specs", op(deps, "listTestSpecs"));
  app.post("/api/v1/tickets/:id/test-specs", op(deps, "createTestSpec"));
  app.post("/api/v1/tickets/:id/test-specs/lint", op(deps, "lintTestSpecs"));
  app.post("/api/v1/tickets/:id/test-specs/suggest", op(deps, "suggestTestSpecs"));
  app.get("/api/v1/tickets/:id/timeline", op(deps, "listTicketTimeline"));
  app.post("/api/v1/tickets/:id/timeline/seen", op(deps, "markTicketTimelineSeen"));
  app.get("/api/v1/tickets/:id/versions", op(deps, "listTicketVersions"));
  app.post("/api/v1/tickets/:id/versions/:v/restore", op(deps, "restoreTicketVersion"));
  app.get("/api/v1/tickets/:id/work-type-candidates", op(deps, "listWorkTypeCandidates"));
}
