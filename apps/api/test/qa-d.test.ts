// QA 担当 D：テスト仕様書（07_qa/test-specs/screens/*.md の API の行）を、契約の口を直接呼んで確かめる。
// 期待は仕様の行（08_api/openapi.yaml の作業中の版・テスト仕様書の「期待」）から書く。実装の都合で期待を変えない（G-09）。
// テスト名の先頭は行 ID。DB は kaname_test（harness と同じ）。本物の Bridge・kaname_dev には触れない。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ENDPOINTS, type EndpointDef } from "@kaname/contracts";
import { SCHEMAS } from "@kaname/contracts/schemas";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { createAuth, type Auth } from "@kaname/auth";
import { migrateAuth } from "@kaname/auth/migrate";
import { createSessionResolver, changePassword } from "@kaname/auth/resolver";
import { signIn } from "@kaname/auth/two_factor";
import { createApp } from "../src/app.js";
import { assertApiStartup, startupChecks } from "../src/startup.js";
import type { Hook } from "../src/contract/deps.js";
import { makeHarness, type Harness } from "./harness.js";
import { agreeCurrentTerms } from "./_pending.js";
import { ticketHooks } from "../src/hooks/tickets.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");

// ---- 行の対応（rows-D.json から機械で作った。endpoint → 観点 → 行 ID）
const MAP = {
  ep: {
    "POST /api/v1/clones": {
      ok: ["API-01-034", "API-17-036"],
      "401": ["API-01-035", "API-17-037"],
      "403": ["API-01-036", "API-17-038"],
      "409": ["API-01-037", "API-17-039"],
      "422": ["API-01-038", "API-17-040"],
      state: ["API-01-039", "API-17-041"],
    },
    "GET /api/v1/members": {
      ok: ["API-01-040", "API-03-010", "API-05-043", "API-16-069"],
      "401": ["API-01-041", "API-03-011", "API-05-044", "API-16-070"],
      "403": ["API-01-042", "API-03-012", "API-05-045", "API-16-071"],
      "429": ["API-01-043", "API-03-013", "API-05-046", "API-16-072"],
      state: ["API-01-044", "API-03-014", "API-05-047", "API-16-073"],
    },
    "POST /api/v1/sessions": {
      ok: ["API-01-045", "API-07-054"],
      "401": ["API-01-046", "API-07-055"],
      "403": ["API-01-047", "API-07-056"],
      "409": ["API-01-048", "API-07-057"],
      "422": ["API-01-049", "API-07-058"],
      state: ["API-01-050", "API-07-059"],
    },
    "POST /api/v1/subscriptions": {
      ok: ["API-01-051"],
      "401": ["API-01-052"],
      "403": ["API-01-053"],
      "409": ["API-01-054"],
      "422": ["API-01-055"],
      state: ["API-01-056"],
    },
    "GET /api/v1/tenants": {
      ok: ["API-01-057", "API-07-060", "API-11-055", "API-15-091", "API-18-053"],
      "401": ["API-01-058", "API-07-061", "API-11-056", "API-15-092", "API-18-054"],
      "403": ["API-01-059", "API-07-062", "API-11-057", "API-15-093", "API-18-055"],
      "429": ["API-01-060", "API-07-063", "API-11-058", "API-15-094", "API-18-056"],
      "502": ["API-01-061", "API-07-064", "API-11-059", "API-15-095", "API-18-057"],
      state: ["API-01-062", "API-07-065", "API-11-060", "API-15-096", "API-18-058"],
    },
    "GET /api/v1/conversations": {
      ok: ["API-04-079", "API-11-025", "API-17-042"],
      "401": ["API-11-026", "API-17-043"],
      "403": ["API-11-027", "API-17-044"],
      "429": ["API-11-028", "API-17-045"],
      "502": ["API-11-029", "API-17-046"],
      state: ["API-11-030", "API-17-047"],
    },
    "POST /api/v1/conversations": {
      ok: ["API-04-080", "API-09-036", "API-17-048"],
      "401": ["API-04-081", "API-09-037", "API-17-049"],
      "403": ["API-04-082", "API-09-038", "API-17-050"],
      "409": ["API-04-083", "API-09-039", "API-17-051"],
      "422": ["API-04-084", "API-09-040", "API-17-052"],
      state: ["API-04-085", "API-09-041", "API-17-053"],
    },
    "PATCH /api/v1/conversations/:id": {
      ok: ["API-04-086", "API-17-054"],
      "401": ["API-04-087", "API-17-055"],
      "403": ["API-04-088", "API-17-056"],
      "404": ["API-04-089", "API-17-057"],
      "422": ["API-04-090", "API-17-058"],
      state: ["API-04-091", "API-17-059"],
    },
    "DELETE /api/v1/conversations/:id": {
      ok: ["API-04-092", "API-09-042"],
      "401": ["API-04-093", "API-09-043"],
      "403": ["API-04-094", "API-09-044"],
      "404": ["API-04-095", "API-09-045"],
      "429": ["API-04-096", "API-09-046"],
      state: ["API-04-097", "API-09-047"],
    },
    "GET /api/v1/messages": {
      ok: ["API-05-048", "API-18-047"],
      "401": ["API-05-049", "API-18-048"],
      "403": ["API-05-050", "API-18-049"],
      "429": ["API-05-051", "API-18-050"],
      "502": ["API-05-052", "API-18-051"],
      state: ["API-05-053", "API-18-052"],
    },
    "PATCH /api/v1/messages/:id": {
      ok: ["API-05-054"],
      "401": ["API-05-055"],
      "403": ["API-05-056"],
      "404": ["API-05-057"],
      "422": ["API-05-058"],
      state: ["API-05-059"],
    },
    "DELETE /api/v1/messages/:id": {
      ok: ["API-05-060"],
      "401": ["API-05-061"],
      "403": ["API-05-062"],
      "404": ["API-05-063"],
      "429": ["API-05-064"],
      state: ["API-05-065"],
    },
    "GET /api/v1/tasks": {
      ok: ["API-05-066", "API-10-068", "API-11-049", "API-14-025"],
      "401": ["API-05-067", "API-10-069", "API-11-050", "API-14-026"],
      "403": ["API-05-068", "API-10-070", "API-11-051", "API-14-027"],
      "429": ["API-05-069", "API-10-071", "API-11-052", "API-14-028"],
      "502": ["API-05-070", "API-10-072", "API-11-053", "API-14-029"],
      state: ["API-05-071", "API-10-073", "API-11-054", "API-14-030"],
    },
    "POST /api/v1/tasks": {
      ok: ["API-05-072", "API-09-054", "API-14-031"],
      "401": ["API-05-073", "API-09-055", "API-14-032"],
      "403": ["API-05-074", "API-09-056", "API-14-033"],
      "409": ["API-05-075", "API-09-057", "API-14-034"],
      "422": ["API-05-076", "API-09-058", "API-14-035"],
      state: ["API-05-077", "API-09-059", "API-14-036"],
    },
    "PATCH /api/v1/tasks/:id": {
      ok: ["API-06-037", "API-14-037"],
      "401": ["API-06-038", "API-14-038"],
      "403": ["API-06-039", "API-14-039"],
      "404": ["API-06-040", "API-14-040"],
      "422": ["API-06-041", "API-14-041"],
      state: ["API-06-042", "API-14-042"],
    },
    "POST /api/v1/credentials": {
      ok: ["API-07-042"],
      "401": ["API-07-043"],
      "403": ["API-07-044"],
      "409": ["API-07-045"],
      "422": ["API-07-046"],
      state: ["API-07-047"],
    },
    "GET /api/v1/learned_procedures": {
      ok: ["API-07-048"],
      "401": ["API-07-049"],
      "403": ["API-07-050"],
      "429": ["API-07-051"],
      "502": ["API-07-052"],
      state: ["API-07-053"],
    },
    "GET /api/v1/action_runs": {
      ok: ["API-08-049"],
      "401": ["API-08-050"],
      "403": ["API-08-051"],
      "429": ["API-08-052"],
      "502": ["API-08-053"],
      state: ["API-08-054"],
    },
    "GET /api/v1/ai_employees": {
      ok: ["API-08-055", "API-13-025"],
      "401": ["API-08-056", "API-13-026"],
      "403": ["API-08-057", "API-13-027"],
      "429": ["API-08-058", "API-13-028"],
      "502": ["API-08-059", "API-13-029"],
      state: ["API-08-060", "API-13-030"],
    },
    "GET /api/v1/approvals": {
      ok: ["API-08-061", "API-13-037"],
      "401": ["API-08-062", "API-13-038"],
      "403": ["API-08-063", "API-13-039"],
      "429": ["API-08-064", "API-13-040"],
      "502": ["API-08-065", "API-13-041"],
      state: ["API-08-066", "API-13-042"],
    },
    "PATCH /api/v1/approvals/:id": {
      ok: ["API-08-067"],
      "401": ["API-08-068"],
      "403": ["API-08-069"],
      "404": ["API-08-070"],
      "422": ["API-08-071"],
      state: ["API-08-072"],
    },
    "DELETE /api/v1/approvals/:id": {
      ok: ["API-08-073", "API-16-057"],
      "401": ["API-08-074", "API-16-058"],
      "403": ["API-08-075", "API-16-059"],
      "404": ["API-08-076", "API-16-060"],
      "429": ["API-08-077", "API-16-061"],
      state: ["API-08-078", "API-16-062"],
    },
    "GET /api/v1/audit_events": {
      ok: ["API-08-079", "API-13-043", "API-21-055"],
      "401": ["API-08-080", "API-13-044", "API-21-056"],
      "403": ["API-08-081", "API-13-045", "API-21-057"],
      "429": ["API-08-082", "API-13-046", "API-21-058"],
      state: ["API-08-083", "API-13-047", "API-21-059"],
    },
    "PATCH /api/v1/policies/:id": {
      ok: ["API-09-048"],
      "401": ["API-09-049"],
      "403": ["API-09-050"],
      "404": ["API-09-051"],
      "422": ["API-09-052"],
      state: ["API-09-053"],
    },
    "GET /api/v1/ledger_definitions": {
      ok: ["API-10-045"],
      "401": ["API-10-046"],
      "403": ["API-10-047"],
      "429": ["API-10-048"],
      "502": ["API-10-049"],
      state: ["API-10-050"],
    },
    "PATCH /api/v1/ledger_definitions/:id": {
      ok: ["API-10-051", "API-15-085"],
      "401": ["API-10-052", "API-15-086"],
      "403": ["API-10-053", "API-15-087"],
      "404": ["API-10-054", "API-15-088"],
      "422": ["API-10-055", "API-15-089"],
      state: ["API-10-056", "API-15-090"],
    },
    "GET /api/v1/ledger_records": {
      ok: ["API-10-057"],
      "401": ["API-10-058"],
      "403": ["API-10-059"],
      "429": ["API-10-060"],
      state: ["API-10-061"],
    },
    "PATCH /api/v1/ledger_records/:id": {
      ok: ["API-10-062"],
      "401": ["API-10-063"],
      "403": ["API-10-064"],
      "404": ["API-10-065"],
      "422": ["API-10-066"],
      state: ["API-10-067"],
    },
    "PATCH /api/v1/goal_allocations/:id": {
      ok: ["API-11-031"],
      "401": ["API-11-032"],
      "403": ["API-11-033"],
      "404": ["API-11-034"],
      "422": ["API-11-035"],
      state: ["API-11-036"],
    },
    "GET /api/v1/goals": {
      ok: ["API-11-037", "API-12-042"],
      "401": ["API-11-038", "API-12-043"],
      "403": ["API-11-039", "API-12-044"],
      "429": ["API-11-040", "API-12-045"],
      "502": ["API-11-041", "API-12-046"],
      state: ["API-11-042", "API-12-047"],
    },
    "PATCH /api/v1/goals/:id": {
      ok: ["API-11-043"],
      "401": ["API-11-044"],
      "403": ["API-11-045"],
      "404": ["API-11-046"],
      "422": ["API-11-047"],
      state: ["API-11-048"],
    },
    "GET /api/v1/hypotheses": {
      ok: ["API-12-048"],
      "401": ["API-12-049"],
      "403": ["API-12-050"],
      "429": ["API-12-051"],
      "502": ["API-12-052"],
      state: ["API-12-053"],
    },
    "PATCH /api/v1/hypotheses/:id": {
      ok: ["API-12-054"],
      "401": ["API-12-055"],
      "403": ["API-12-056"],
      "404": ["API-12-057"],
      "422": ["API-12-058"],
      state: ["API-12-059"],
    },
    "PATCH /api/v1/ai_employees/:id": {
      ok: ["API-13-031"],
      "401": ["API-13-032"],
      "403": ["API-13-033"],
      "404": ["API-13-034"],
      "422": ["API-13-035"],
      state: ["API-13-036"],
    },
    "PATCH /api/v1/members/:id": {
      ok: ["API-13-048", "API-22-055"],
      "401": ["API-13-049", "API-22-056"],
      "403": ["API-13-050", "API-22-057"],
      "404": ["API-13-051", "API-22-058"],
      "422": ["API-13-052", "API-22-059"],
      state: ["API-13-053", "API-22-060"],
    },
    "DELETE /api/v1/members/:id": {
      ok: ["API-13-054", "API-16-074"],
      "401": ["API-13-055", "API-16-075"],
      "403": ["API-13-056", "API-16-076"],
      "404": ["API-13-057", "API-16-077"],
      "429": ["API-13-058", "API-16-078"],
      state: ["API-13-059", "API-16-079"],
    },
    "PATCH /api/v1/duties/:id": {
      ok: ["API-15-079"],
      "401": ["API-15-080"],
      "403": ["API-15-081"],
      "404": ["API-15-082"],
      "422": ["API-15-083"],
      state: ["API-15-084"],
    },
    "POST /api/v1/approvals": {
      ok: ["API-16-051"],
      "401": ["API-16-052"],
      "403": ["API-16-053"],
      "409": ["API-16-054"],
      "422": ["API-16-055"],
      state: ["API-16-056"],
    },
    "POST /api/v1/export_jobs": {
      ok: ["API-16-063"],
      "401": ["API-16-064"],
      "403": ["API-16-065"],
      "409": ["API-16-066"],
      "422": ["API-16-067"],
      state: ["API-16-068"],
    },
    "GET /api/v1/sessions": {
      ok: ["API-16-080"],
      "401": ["API-16-081"],
      "403": ["API-16-082"],
      "429": ["API-16-083"],
      state: ["API-16-084"],
    },
    "POST /api/v1/memories": {
      ok: ["API-17-060"],
      "401": ["API-17-061"],
      "403": ["API-17-062"],
      "409": ["API-17-063"],
      "422": ["API-17-064"],
      state: ["API-17-065"],
    },
    "PATCH /api/v1/memories/:id": {
      ok: ["API-17-066"],
      "401": ["API-17-067"],
      "403": ["API-17-068"],
      "404": ["API-17-069"],
      "422": ["API-17-070"],
      state: ["API-17-071"],
    },
    "PATCH /api/v1/inquiries/:id": {
      ok: ["API-19-052", "API-21-060"],
      "401": ["API-19-053", "API-21-061"],
      "403": ["API-19-054", "API-21-062"],
      "404": ["API-19-055", "API-21-063"],
      "422": ["API-19-056", "API-21-064"],
      state: ["API-19-057", "API-21-065"],
    },
    "GET /api/v1/plans": {
      ok: ["API-19-058"],
      "401": ["API-19-059"],
      "403": ["API-19-060"],
      "429": ["API-19-061"],
      state: ["API-19-062"],
    },
    "DELETE /api/v1/plans/:id": {
      ok: ["API-19-063"],
      "401": ["API-19-064"],
      "403": ["API-19-065"],
      "404": ["API-19-066"],
      "429": ["API-19-067"],
      state: ["API-19-068"],
    },
    "GET /api/v1/inquiries": {
      ok: ["API-20-059"],
      "401": ["API-20-060"],
      "403": ["API-20-061"],
      "429": ["API-20-062"],
      state: ["API-20-063"],
    },
    "PATCH /api/v1/notice_deliveries/:id": {
      ok: ["API-20-064"],
      "401": ["API-20-065"],
      "403": ["API-20-066"],
      "404": ["API-20-067"],
      "422": ["API-20-068"],
      state: ["API-20-069"],
    },
    "PATCH /api/v1/subscriptions/:id": {
      ok: ["API-20-070"],
      "401": ["API-20-071"],
      "403": ["API-20-072"],
      "404": ["API-20-073"],
      "422": ["API-20-074"],
      state: ["API-20-075"],
    },
    "GET /api/v1/invoices": {
      ok: ["API-21-066"],
      "401": ["API-21-067"],
      "403": ["API-21-068"],
      "429": ["API-21-069"],
      state: ["API-21-070"],
    },
    "POST /api/v1/notices": {
      ok: ["API-21-071"],
      "401": ["API-21-072"],
      "403": ["API-21-073"],
      "409": ["API-21-074"],
      "422": ["API-21-075"],
      state: ["API-21-076"],
    },
    "POST /api/v1/attachments": {
      ok: ["API-22-049"],
      "401": ["API-22-050"],
      "403": ["API-22-051"],
      "409": ["API-22-052"],
      "422": ["API-22-053"],
      state: ["API-22-054"],
    },
    "POST /api/v1/service_registry": {
      ok: ["API-22-061"],
      "401": ["API-22-062"],
      "403": ["API-22-063"],
      "409": ["API-22-064"],
      "422": ["API-22-065"],
      state: ["API-22-066"],
    },
    "PATCH /api/v1/tenants/:id": {
      ok: ["API-22-067"],
      "401": ["API-22-068"],
      "403": ["API-22-069"],
      "404": ["API-22-070"],
      "422": ["API-22-071"],
      state: ["API-22-072"],
    },
    "PATCH /api/v1/service_registry_versions/:id": {
      ok: ["API-23-042"],
      "401": ["API-23-043"],
      "403": ["API-23-044"],
      "404": ["API-23-045"],
      "422": ["API-23-046"],
      state: ["API-23-047"],
    },
    "POST /api/v1/skills": {
      ok: ["API-23-048"],
      "401": ["API-23-049"],
      "403": ["API-23-050"],
      "409": ["API-23-051"],
      "422": ["API-23-052"],
      state: ["API-23-053"],
    },
  },
  lim: {
    "GET /api/v1/members": [120, "user"],
    "GET /api/v1/tenants": [120, "user"],
    "DELETE /api/v1/conversations/:id": [60, "user"],
    "GET /api/v1/messages": [120, "user"],
    "DELETE /api/v1/messages/:id": [60, "user"],
    "GET /api/v1/tasks": [120, "user"],
    "GET /api/v1/learned_procedures": [120, "user"],
    "GET /api/v1/action_runs": [120, "user"],
    "GET /api/v1/ai_employees": [120, "user"],
    "GET /api/v1/approvals": [120, "user"],
    "DELETE /api/v1/approvals/:id": [60, "user"],
    "GET /api/v1/audit_events": [120, "user"],
    "GET /api/v1/ledger_definitions": [120, "user"],
    "GET /api/v1/ledger_records": [120, "user"],
    "GET /api/v1/conversations": [120, "user"],
    "GET /api/v1/goals": [120, "user"],
    "GET /api/v1/hypotheses": [120, "user"],
    "DELETE /api/v1/members/:id": [60, "user"],
    "GET /api/v1/sessions": [120, "user"],
    "GET /api/v1/plans": [120, "user"],
    "DELETE /api/v1/plans/:id": [60, "user"],
    "GET /api/v1/inquiries": [120, "user"],
    "GET /api/v1/invoices": [120, "user"],
  },
  g: {
    "G-11": {
      "T-A-01": ["API-01-063"],
      "T-A-03": ["API-03-015"],
      "T-A-05": ["API-05-078"],
      "T-A-06": ["API-06-043"],
      "T-A-08": ["API-08-084"],
      "T-A-09": ["API-09-060"],
      "T-A-11": ["API-11-061"],
      "T-A-13": ["API-13-060"],
      "T-A-14": ["API-14-043"],
      "T-A-16": ["API-16-085"],
      "T-A-17": ["API-17-072"],
      "T-A-19": ["API-19-069"],
      "T-A-20": ["API-20-076"],
      "T-A-21": ["API-21-077"],
      "T-A-22": ["API-22-073"],
      "T-A-23": ["API-23-054"],
    },
    "G-12": {},
    "G-13": {
      "T-A-01": ["API-01-065"],
      "T-A-05": ["API-05-080"],
      "T-A-06": ["API-06-045"],
      "T-A-08": ["API-08-086"],
      "T-A-09": ["API-09-062"],
      "T-A-10": ["API-10-076"],
      "T-A-11": ["API-11-063"],
      "T-A-12": ["API-12-062"],
      "T-A-13": ["API-13-062"],
      "T-A-14": ["API-14-045"],
      "T-A-15": ["API-15-099"],
      "T-A-16": ["API-16-087"],
      "T-A-17": ["API-17-074"],
      "T-A-19": ["API-19-071"],
      "T-A-20": ["API-20-078"],
      "T-A-21": ["API-21-079"],
      "T-A-22": ["API-22-075"],
    },
    "G-14": {
      "T-A-01": ["API-01-066"],
      "T-A-03": ["API-03-018"],
      "T-A-05": ["API-05-081"],
      "T-A-06": ["API-06-046"],
      "T-A-08": ["API-08-087"],
      "T-A-09": ["API-09-063"],
      "T-A-10": ["API-10-077"],
      "T-A-11": ["API-11-064"],
      "T-A-12": ["API-12-063"],
      "T-A-13": ["API-13-063"],
      "T-A-14": ["API-14-046"],
      "T-A-15": ["API-15-100"],
      "T-A-16": ["API-16-088"],
      "T-A-17": ["API-17-075"],
      "T-A-18": ["API-18-062"],
      "T-A-19": ["API-19-072"],
      "T-A-20": ["API-20-079"],
      "T-A-21": ["API-21-080"],
      "T-A-22": ["API-22-076"],
    },
    "G-15": {
      "T-A-01": ["API-01-067"],
      "T-A-05": ["API-05-082"],
      "T-A-08": ["API-08-088"],
      "T-A-09": ["API-09-064"],
      "T-A-10": ["API-10-078"],
      "T-A-11": ["API-11-065"],
      "T-A-12": ["API-12-064"],
      "T-A-14": ["API-14-047"],
      "T-A-15": ["API-15-101"],
      "T-A-16": ["API-16-089"],
      "T-A-17": ["API-17-076"],
      "T-A-22": ["API-22-077"],
    },
    "G-16": {
      "T-A-01": ["API-01-068"],
      "T-A-03": ["API-03-020"],
      "T-A-05": ["API-05-083"],
      "T-A-06": ["API-06-048"],
      "T-A-07": ["API-07-066"],
      "T-A-08": ["API-08-089"],
      "T-A-09": ["API-09-065"],
      "T-A-10": ["API-10-079"],
      "T-A-11": ["API-11-066"],
      "T-A-12": ["API-12-065"],
      "T-A-13": ["API-13-065"],
      "T-A-14": ["API-14-048"],
      "T-A-15": ["API-15-102"],
      "T-A-16": ["API-16-090"],
      "T-A-17": ["API-17-077"],
      "T-A-18": ["API-18-064"],
      "T-A-19": ["API-19-074"],
      "T-A-20": ["API-20-081"],
      "T-A-21": ["API-21-082"],
      "T-A-22": ["API-22-078"],
    },
  },
  tasks: {
    "T-A-01": [
      "GET /api/v1/members",
      "GET /api/v1/tenants",
      "POST /api/v1/clones",
      "POST /api/v1/sessions",
      "POST /api/v1/subscriptions",
    ],
    "T-A-03": ["GET /api/v1/members"],
    "T-A-04": [
      "DELETE /api/v1/conversations/:id",
      "GET /api/v1/conversations",
      "PATCH /api/v1/conversations/:id",
      "POST /api/v1/conversations",
    ],
    "T-A-05": [
      "DELETE /api/v1/messages/:id",
      "GET /api/v1/members",
      "GET /api/v1/messages",
      "GET /api/v1/tasks",
      "PATCH /api/v1/messages/:id",
      "POST /api/v1/tasks",
    ],
    "T-A-06": ["PATCH /api/v1/tasks/:id"],
    "T-A-07": [
      "GET /api/v1/learned_procedures",
      "GET /api/v1/tenants",
      "POST /api/v1/credentials",
      "POST /api/v1/sessions",
    ],
    "T-A-08": [
      "DELETE /api/v1/approvals/:id",
      "GET /api/v1/action_runs",
      "GET /api/v1/ai_employees",
      "GET /api/v1/approvals",
      "GET /api/v1/audit_events",
      "PATCH /api/v1/approvals/:id",
    ],
    "T-A-09": [
      "DELETE /api/v1/conversations/:id",
      "PATCH /api/v1/policies/:id",
      "POST /api/v1/conversations",
      "POST /api/v1/tasks",
    ],
    "T-A-10": [
      "GET /api/v1/ledger_definitions",
      "GET /api/v1/ledger_records",
      "GET /api/v1/tasks",
      "PATCH /api/v1/ledger_definitions/:id",
      "PATCH /api/v1/ledger_records/:id",
    ],
    "T-A-11": [
      "GET /api/v1/conversations",
      "GET /api/v1/goals",
      "GET /api/v1/tasks",
      "GET /api/v1/tenants",
      "PATCH /api/v1/goal_allocations/:id",
      "PATCH /api/v1/goals/:id",
    ],
    "T-A-12": ["GET /api/v1/goals", "GET /api/v1/hypotheses", "PATCH /api/v1/hypotheses/:id"],
    "T-A-13": [
      "DELETE /api/v1/members/:id",
      "GET /api/v1/ai_employees",
      "GET /api/v1/approvals",
      "GET /api/v1/audit_events",
      "PATCH /api/v1/ai_employees/:id",
      "PATCH /api/v1/members/:id",
    ],
    "T-A-14": ["GET /api/v1/tasks", "PATCH /api/v1/tasks/:id", "POST /api/v1/tasks"],
    "T-A-15": ["GET /api/v1/tenants", "PATCH /api/v1/duties/:id", "PATCH /api/v1/ledger_definitions/:id"],
    "T-A-16": [
      "DELETE /api/v1/approvals/:id",
      "DELETE /api/v1/members/:id",
      "GET /api/v1/members",
      "GET /api/v1/sessions",
      "POST /api/v1/approvals",
      "POST /api/v1/export_jobs",
    ],
    "T-A-17": [
      "GET /api/v1/conversations",
      "PATCH /api/v1/conversations/:id",
      "PATCH /api/v1/memories/:id",
      "POST /api/v1/clones",
      "POST /api/v1/conversations",
      "POST /api/v1/memories",
    ],
    "T-A-18": ["GET /api/v1/messages", "GET /api/v1/tenants"],
    "T-A-19": ["DELETE /api/v1/plans/:id", "GET /api/v1/plans", "PATCH /api/v1/inquiries/:id"],
    "T-A-20": ["GET /api/v1/inquiries", "PATCH /api/v1/notice_deliveries/:id", "PATCH /api/v1/subscriptions/:id"],
    "T-A-21": [
      "GET /api/v1/audit_events",
      "GET /api/v1/invoices",
      "PATCH /api/v1/inquiries/:id",
      "POST /api/v1/notices",
    ],
    "T-A-22": [
      "PATCH /api/v1/members/:id",
      "PATCH /api/v1/tenants/:id",
      "POST /api/v1/attachments",
      "POST /api/v1/service_registry",
    ],
    "T-A-23": ["PATCH /api/v1/service_registry_versions/:id", "POST /api/v1/skills"],
  },
} as {
  ep: Record<string, Record<string, string[]>>;
  lim: Record<string, [number, string]>;
  g: Record<string, Record<string, string[]>>;
  tasks: Record<string, string[]>;
};

type W = "boss" | "staff" | "ops" | "opsB" | "cBoss" | "zBoss" | "anon" | "bogus";
type Opts = { body?: unknown; id?: string; query?: Record<string, string>; headers?: Record<string, string> };
type Target = { method: string; path: string };

let h: Harness;
let admin: pg.Pool;
let tenantC = "";
let bossC = "";
let scopeC = "";
let tenantZ = "";
let bossZ = "";
const ctxs: Partial<Record<W, TenantContext>> = {};
const BIG = 1_000_000;

/** 契約の app を 1 つ作る（上限は引数。既定は事実上無制限＝上限の試験以外で 429 に当たらない） */
function makeApp(o: { limits?: Record<string, number>; hooks?: Record<string, Hook>; repo?: Harness["repo"] } = {}) {
  const limits: Record<string, number> = o.limits ?? Object.fromEntries(ENDPOINTS.map((e) => [e.operationId, BIG]));
  const hooks = o.hooks ?? {};
  const app = createApp({
    version: "qa-d",
    repo: o.repo ?? h.repo,
    resolveSession: async (c) => {
      const t = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") as W | undefined;
      return t ? (ctxs[t] ?? null) : null;
    },
    contract: { hooks, limits },
  });
  return { app, limits, hooks };
}
let A: ReturnType<typeof makeApp>;

const tenantOf = (e: EndpointDef, w: W) =>
  w === "cBoss" ? tenantC : e.auth === "ops" || w === "ops" ? h.opsTenantFor(e) : h.S.tenantA;
function call(app: ReturnType<typeof makeApp>["app"], t: Target | EndpointDef, w: W, o: Opts = {}, opsTenant?: string) {
  const path = t.path.replace(":id", o.id ?? "00000000-0000-4000-8000-000000000000");
  const qs = o.query ? "?" + new URLSearchParams(o.query).toString() : "";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(w === "anon" ? {} : { authorization: `Bearer ${w}` }),
    ...(w === "ops" || w === "opsB"
      ? { "x-tenant-id": opsTenant ?? (w === "opsB" ? h.S.tenantB : h.opsTenantFor(t as EndpointDef)) }
      : {}),
    ...(o.headers ?? {}),
  };
  const body = o.body === undefined ? {} : { body: typeof o.body === "string" ? o.body : JSON.stringify(o.body) };
  return app.request(`http://localhost${path}${qs}`, { method: t.method, headers, ...body });
}
const ep = (key: string) => {
  const [m, p] = key.split(" ");
  return ENDPOINTS.find((e) => e.method === m && e.path === p) ?? null;
};
// 決定で契約から外した口（08_api/retired-endpoints.json・D-128.78・D-128.112）。その行は仕様ごと作り直す（新しい画面のテスト仕様で書き直す）ので、ここでは飛ばして理由を名前に残す
const RETIRED = new Map<string, string>(
  (
    JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "08_api", "retired-endpoints.json"),
        "utf8",
      ),
    ) as { retired: { method: string; path: string; decision: string }[] }
  ).retired.map((r) => [`${r.method} ${r.path.replace(/\{(\w+)\}/g, ":$1")}`, r.decision]),
);
// 道すじは同じだが、決定で意味が変わった口（素の読み書き → 振る舞いのある口）。古い行の期待（行の挿入・削除）はもう仕様でない
const CHANGED: Record<string, string> = {
  "POST /api/v1/credentials": "D-128.93（預ける：暗号化・本人確認の取り直し）",
  "DELETE /api/v1/members/:id": "D-128.96（外す：引き継ぎ・個人の記憶と預けた情報を消す）",
  "GET /api/v1/inquiries": "D-156.5（問い合わせの答えの形を作り直した。表の素の読みでは動かさない・振る舞いは K-951）",
};
const retiredOf = (key: string) => RETIRED.get(key) ?? CHANGED[key] ?? null;
/** タスクの口が全部、決定で外した口なら、その決定の ID（タスクごとの G-xx は新しい作業の分解で作り直す） */
const retiredTask = (task: string) => {
  const ks = MAP.tasks[task] ?? [];
  const ds = ks.map((k) => (ep(k) && !CHANGED[k] ? null : retiredOf(k)));
  return ks.length && ds.every(Boolean) ? [...new Set(ds)].join("・") : null;
};
const actor = (e: EndpointDef): W => (e.auth === "ops" ? "ops" : "boss");
const count = async (table: string) =>
  Number((await admin.query(`select count(*)::int as n from "${table}"`)).rows[0].n);
const auditCount = async () => Number((await admin.query("select count(*)::int as n from audit_events")).rows[0].n);
const rowOf = async (table: string, id: string) =>
  (await admin.query(`select to_jsonb(t) as j from "${table}" t where id::text = $1`, [id])).rows[0]?.j ?? null;
const hasCol = async (table: string, col: string) =>
  (
    await admin.query(
      "select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2",
      [table, col],
    )
  ).rowCount! > 0;
const snap = async (table: string) => ({ n: await count(table), a: await auditCount() });
const bodyOf = (e: EndpointDef, w: W) => h.bodyFor(e, tenantOf(e, w));
/** 更新・削除の的：その人が使う会社の 1 行（種の作り方）。tenants は会社 a の行 */
async function targetRow(e: EndpointDef, tenant?: string, extra: Record<string, unknown> = {}): Promise<string> {
  const seed = h.S.rows[e.table];
  if (!seed?.insert) return seed!.visible;
  const t = tenant ?? (e.auth === "ops" ? h.opsTenantFor(e) : h.S.tenantA);
  const row = { ...seed.insert(t), ...extra };
  const keys = Object.keys(row).filter((k) => row[k] !== null && row[k] !== undefined);
  const r = await admin.query<{ id: string }>(
    `insert into "${e.table}" (${keys.map((k) => `"${k}"`).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    keys.map((k) => row[k]),
  );
  return r.rows[0]!.id;
}
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
/** 全角化（ASCII → 全角）と前後の空白（半角・全角）で包む＝表記ゆらぎ */
const fullwidth = (s: string) =>
  "　 " + s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)) + " 　";
const sameValue = (stored: unknown, sent: unknown) => {
  if (stored === sent) return true;
  if (typeof sent === "string" && typeof stored === "string") {
    const a = Date.parse(sent);
    const b = Date.parse(stored);
    if (!Number.isNaN(a) && !Number.isNaN(b) && /\d{4}-\d{2}-\d{2}/.test(sent))
      return a === b || stored.startsWith(sent);
  }
  return JSON.stringify(stored) === JSON.stringify(sent);
};
/** スキーマが型で弾く項目（"x" を入れると通らない項目）を 1 つ */
function typedField(e: EndpointDef): string | null {
  const s = SCHEMAS[e.input!] as unknown as {
    shape: Record<string, unknown>;
    safeParse: (v: unknown) => { success: boolean };
  };
  for (const k of Object.keys(s.shape)) if (!s.safeParse({ [k]: "x-不正" }).success) return k;
  return null;
}
const ids = (rows: string[] | undefined) => (rows ?? []).join(" ");
/** 消してよい会社（404 の「消した行」用）。会社 a を消すと後の試験が全部 404 になる */
async function throwawayTenant(): Promise<string> {
  return (
    await admin.query(
      "insert into tenants (id, tenant_id, name) select u, u, '捨てる会社' from gen_random_uuid() u returning id",
    )
  ).rows[0].id;
}
/** 同じ冪等キーで送る「違う中身」（契約の検証は通る形）：元が空でなければ空、空なら文字列の項目を 1 つ */
function otherBody(e: EndpointDef, ok: Record<string, unknown>): Record<string, unknown> {
  if (Object.keys(ok).length) return {};
  const s = SCHEMAS[e.input!] as unknown as {
    shape: Record<string, unknown>;
    safeParse: (v: unknown) => { success: boolean };
  };
  const k = Object.keys(s.shape).find((x) => s.safeParse({ [x]: "qa-d" }).success);
  return k ? { [k]: "qa-d" } : { __none: 1 };
}
let appPool: pg.Pool;

beforeAll(async () => {
  h = await makeHarness();
  admin = new pg.Pool({ connectionString: DB_URL, max: 4 });
  appPool = new pg.Pool({ connectionString: APP_URL, max: 2 });
  await migrateAuth(DB_URL);
  // 会社 c：行が 0 件の会社（全部の対象に edit を持つ代表 1 人）
  tenantC = (
    await admin.query(
      "insert into tenants (id, tenant_id, name) select u, u, '会社 c' from gen_random_uuid() u returning id",
    )
  ).rows[0].id;
  scopeC = (await admin.query("insert into scopes (tenant_id, name) values ($1, '会社') returning id", [tenantC]))
    .rows[0].id;
  bossC = (
    await admin.query(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '代表 c') returning id",
      [tenantC, scopeC],
    )
  ).rows[0].id;
  await admin.query(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) select $1, $2, key, 'edit' from target_kinds",
    [tenantC, bossC],
  );
  // 会社 z：一度も書かない会社（一覧の 0 件だけに使う）
  tenantZ = (
    await admin.query(
      "insert into tenants (id, tenant_id, name) select u, u, '会社 z' from gen_random_uuid() u returning id",
    )
  ).rows[0].id;
  const scopeZ = (await admin.query("insert into scopes (tenant_id, name) values ($1, '会社') returning id", [tenantZ]))
    .rows[0].id;
  bossZ = (
    await admin.query(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '代表 z') returning id",
      [tenantZ, scopeZ],
    )
  ).rows[0].id;
  await admin.query(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) select $1, $2, key, 'edit' from target_kinds",
    [tenantZ, bossZ],
  );
  Object.assign(ctxs, {
    zBoss: { tenantId: tenantZ, userId: bossZ, role: "member" },
    boss: { tenantId: h.S.tenantA, userId: h.S.bossA, role: "member" },
    staff: { tenantId: h.S.tenantA, userId: h.S.staffA, role: "member" },
    ops: { tenantId: h.S.opsTenant, userId: h.S.opsId, role: "ops" },
    opsB: { tenantId: h.S.tenantB, userId: h.S.opsId, role: "ops" },
    cBoss: { tenantId: tenantC, userId: bossC, role: "member" },
  });
  A = makeApp();
}, 180_000);
afterAll(async () => {
  await h?.close();
  await appPool?.end();
  await admin?.end();
});

// ============ endpoint ごとの行（API 正常・401・403・404・409・422・429・502・状態）
const MISSING: Record<string, number> = {
  "POST /api/v1/conversations": 201,
  "PATCH /api/v1/conversations/:id": 200,
  "DELETE /api/v1/conversations/:id": 200,
  "PATCH /api/v1/memories/:id": 200,
};
for (const [key, aspects] of Object.entries(MAP.ep)) {
  const e = CHANGED[key] ? null : ep(key);
  if (!e && retiredOf(key)) {
    describe.skip(`${key}（決定 ${retiredOf(key)} で契約から外した口。テスト仕様は新しい画面から作り直す）`, () => {
      for (const rows of Object.values(aspects)) it(`${ids(rows)}`, () => undefined);
    });
    continue;
  }
  if (!e) {
    // 仕様（openapi.yaml）には在るが、契約の route が無い endpoint：仕様どおりの状態を期待して呼ぶ
    describe(`${key}（仕様に在る endpoint）`, () => {
      const [method, path] = key.split(" ") as [string, string];
      const want: Record<string, number> = {
        ok: MISSING[key]!,
        "401": 401,
        "403": 403,
        "404": 404,
        "409": 409,
        "422": 422,
        "429": 429,
        state: MISSING[key]!,
      };
      for (const [a, rows] of Object.entries(aspects)) {
        it(`${ids(rows)} ${key} が仕様の口として在り、${a} の場合に ${want[a]} を返す`, async () => {
          const w: W = a === "401" ? "anon" : a === "403" ? "staff" : "boss";
          const r = await call(A.app, { method, path }, w, method === "DELETE" ? {} : { body: {} });
          const txt = await r.text();
          let code: unknown;
          try {
            code = (JSON.parse(txt) as { code?: unknown }).code;
          } catch {
            code = undefined;
          }
          // 契約の口なら JSON の code を返す。route が無いと Hono の素の 404（"404 Not Found"）になる
          expect(code, `${key} の route が無い（${r.status} ${txt.slice(0, 40)}）`).toBeTruthy();
          expect(r.status).toBe(want[a]);
        });
      }
    });
    continue;
  }
  describe(key, () => {
    if (aspects["ok"])
      it(`${ids(aspects["ok"])} 正常：権限のある人が呼ぶと ${e.success} と { data${e.kind === "list" ? "[] , meta" : ""} } を返し、記録が残る`, async () => {
        const w = actor(e);
        if (e.kind === "list") {
          const r = await call(A.app, e, w, { query: { limit: "5" } });
          expect(r.status).toBe(e.success);
          const b = await json(r);
          expect(Array.isArray(b["data"])).toBe(true);
          expect((b["meta"] as { limit: number }).limit).toBe(5);
          const rows = b["data"] as Record<string, unknown>[];
          expect(rows.length).toBeGreaterThan(0); // 種の行が見える（ダミー固定でない）
          const tid = tenantOf(e, w);
          for (const row of rows) if ("tenant_id" in row && e.table !== "tenants") expect(row["tenant_id"]).toBe(tid);
          if (e.table === "tenants") expect(rows.map((x) => x["id"])).toEqual([h.S.tenantA]);
          return;
        }
        if (e.kind === "create") {
          const before = await count(e.table);
          const body = bodyOf(e, w);
          const r = await call(A.app, e, w, { body });
          const b = await json(r);
          expect(r.status, JSON.stringify(b)).toBe(e.success);
          const id = (b["data"] as { id: string }).id;
          expect(id).toBeTruthy();
          expect(await count(e.table)).toBe(before + 1);
          const stored = await rowOf(e.table, id);
          for (const [k, v] of Object.entries(body)) expect(sameValue(stored[k], v), `${k}`).toBe(true);
          const au = await admin.query("select 1 from audit_events where action = $1 and target_id = $2", [
            `${e.table}.create`,
            id,
          ]);
          expect(au.rowCount).toBe(1); // 記録（証跡）が同じトランザクションに残る
          return;
        }
        const id = await targetRow(e);
        if (e.kind === "update") {
          const body = bodyOf(e, w);
          const r = await call(A.app, e, w, { id, body });
          const b = await json(r);
          expect(r.status, JSON.stringify(b)).toBe(e.success);
          expect((b["data"] as { id: string }).id).toBe(id);
          const stored = await rowOf(e.table, id);
          for (const [k, v] of Object.entries(body)) expect(sameValue(stored[k], v), `${k}`).toBe(true);
          return;
        }
        // delete
        const r = await call(A.app, e, w, { id });
        const b = await json(r);
        expect(r.status, JSON.stringify(b)).toBe(e.success);
        expect((b["data"] as { id: string }).id).toBe(id);
        expect((await rowOf(e.table, id))["deleted_at"]).not.toBeNull(); // 論理削除
      });

    if (aspects["401"])
      it(`${ids(aspects["401"])} セッションが無い／失効したトークンだと 401 UNAUTHENTICATED。副作用なし`, async () => {
        const id = e.kind === "list" || e.kind === "create" ? undefined : await targetRow(e);
        const before = await snap(e.table);
        const rowBefore = id ? await rowOf(e.table, id) : null;
        for (const w of ["anon", "bogus"] as W[]) {
          const r = await call(A.app, e, w, {
            id,
            ...(e.kind === "create" || e.kind === "update" ? { body: bodyOf(e, "boss") } : {}),
            ...(e.kind === "list" ? { query: { limit: "5" } } : {}),
          });
          expect(r.status, `${w}`).toBe(401);
          expect((await json(r))["code"]).toBe("UNAUTHENTICATED");
        }
        expect(await snap(e.table)).toEqual(before);
        if (id) expect(await rowOf(e.table, id)).toEqual(rowBefore);
      });

    if (aspects["403"])
      it(`${ids(aspects["403"])} 権限が無い（${e.auth === "ops" ? "会社の人が運営の口" : e.kind === "list" ? "運営が許可の切れた会社を読む" : "担当者が見える行を書く"}）と 403 FORBIDDEN。副作用なし`, async () => {
        const w: W = e.auth === "ops" ? "boss" : e.kind === "list" ? "opsB" : "staff";
        let id: string | undefined;
        let readable = "—";
        if (e.kind === "update" || e.kind === "delete") {
          // 担当者が「読める」行を的にする（見えない行ではなく、見えるが直す権限が無い）
          const scoped = await hasCol(e.table, "scope_id");
          id = await targetRow(e, undefined, scoped ? { scope_id: h.S.scopeDeptA } : {});
          if (e.auth !== "ops")
            readable = String(
              await withTenant(
                appPool,
                ctxs.staff!,
                async (c) => (await c.query(`select 1 from "${e.table}" where id = $1`, [id])).rowCount,
              ),
            );
        }
        const before = await snap(e.table);
        const rowBefore = id ? await rowOf(e.table, id) : null;
        const o: Opts = {
          id,
          ...(e.kind === "create" || e.kind === "update" ? { body: bodyOf(e, e.auth === "ops" ? "ops" : "boss") } : {}),
          ...(e.kind === "list" ? { query: { limit: "5" } } : {}),
        };
        const r = await call(A.app, e, w, o);
        const b = await json(r);
        // 本人の口（self）の作成は、誰でも自分の分は作れる。403 の場面は「他人を持ち主にして作れない」：作れても持ち主は呼んだ人（K-17）
        if (e.kind === "create" && e.perm.word === "self") {
          if (r.status === 201) {
            const d = b["data"] as Record<string, unknown>;
            for (const c of ["owner_member_id", "opened_by_member_id", "member_id", "requested_by", "uploaded_by"])
              if (c in d) expect(d[c], "持ち主は呼んだ人（入力の値は使わない）").toBe(h.S.staffA);
            return;
          }
        }
        // 本人のものの表（会話・記憶など）は、他人の行が見えない（読める＝0 行）。見えない行は 404（存在を漏らさない・K-17）
        const hidden = readable === "0";
        expect(r.status, `${w}（担当者がその行を読める＝${readable} 行）→ ${JSON.stringify(b)}`).toBe(
          hidden ? 404 : 403,
        );
        expect(b["code"]).toBe(hidden ? "NOT_FOUND" : "FORBIDDEN");
        expect(await snap(e.table)).toEqual(before);
        if (id) expect(await rowOf(e.table, id)).toEqual(rowBefore);
      });

    if (aspects["404"])
      it(`${ids(aspects["404"])} 無い id・他社の行・消した行は 404 NOT_FOUND。副作用なし`, async () => {
        const w = actor(e);
        const cases: [string, string][] = [["無い", "0193c5a0-0000-7000-8000-00000000abcd"]];
        const other = h.S.rows[e.table]?.other;
        if (other && other !== h.S.rows[e.table]?.visible) cases.push(["他社", other]);
        if (await hasCol(e.table, "deleted_at")) {
          const gone = h.S.rows[e.table]?.insert ? await targetRow(e) : await throwawayTenant(); // 会社 a を消さない
          await admin.query(`update "${e.table}" set deleted_at = now() where id = $1`, [gone]);
          cases.push(["消した", gone]);
        }
        expect(cases.length).toBeGreaterThanOrEqual(2);
        for (const [label, id] of cases) {
          const before = await snap(e.table);
          const rowBefore = await rowOf(e.table, id);
          const r = await call(A.app, e, w, { id, ...(e.kind === "update" ? { body: bodyOf(e, w) } : {}) });
          const b = await json(r);
          expect(r.status, `${label}: ${JSON.stringify(b)}`).toBe(404);
          expect(b["code"]).toBe("NOT_FOUND");
          expect(await snap(e.table)).toEqual(before);
          expect(await rowOf(e.table, id)).toEqual(rowBefore);
        }
      });

    if (aspects["409"])
      it(`${ids(aspects["409"])} 同じ冪等キーで違う中身を送る（二重送信）と 409 CONFLICT。副作用なし`, async () => {
        const w = actor(e);
        const key = `qa-d-409-${e.operationId}-${Date.now()}`;
        const first = await call(A.app, e, w, { body: bodyOf(e, w), headers: { "idempotency-key": key } });
        expect(first.status, await first.clone().text()).toBe(e.success);
        const before = await snap(e.table);
        const r = await call(A.app, e, w, { body: otherBody(e, bodyOf(e, w)), headers: { "idempotency-key": key } });
        const b = await json(r);
        expect(r.status, JSON.stringify(b)).toBe(409);
        expect(b["code"]).toBe("CONFLICT");
        expect(await snap(e.table)).toEqual(before);
      });

    if (aspects["422"])
      it(`${ids(aspects["422"])} 必須・形式・値域が違うと 422 VALIDATION_ERROR（項目ごとの理由）。副作用なし。表記ゆらぎは正規化してから判定`, async () => {
        const w = actor(e);
        const bad = async (o: Opts, field?: string) => {
          const before = await snap(e.table);
          const r = await call(A.app, e, w, o);
          const b = await json(r);
          expect(r.status, JSON.stringify(o) + " → " + JSON.stringify(b)).toBe(422);
          expect(b["code"]).toBe("VALIDATION_ERROR");
          const d = b["details"] as { field: string }[];
          expect(d.length).toBeGreaterThan(0);
          if (field) expect(d.map((x) => x.field)).toContain(field);
          expect(await snap(e.table)).toEqual(before);
        };
        if (e.kind === "list") {
          await bad({ query: { limit: "0" } }, "limit");
          await bad({ query: { limit: "201" } }, "limit");
          await bad({ query: { limit: "abc" } }, "limit");
          await bad({ query: { cursor: "!!" } }, "cursor");
          await bad({ query: { scope_id: "not-a-uuid" } }, "scope_id");
          await bad({ query: { sort: "1; drop table x" } }, "sort");
          return;
        }
        if (e.kind === "get" || e.kind === "delete") {
          await bad({ id: "not-a-uuid" }, "id");
          return;
        }
        const id = e.kind === "update" ? await targetRow(e) : undefined;
        const ok = bodyOf(e, w);
        await bad({ id, body: { ...ok, __unknown_field: "x" } });
        await bad({ id, body: "{not json" }, "body");
        const tf = typedField(e);
        if (tf) await bad({ id, body: { ...ok, [tf]: "x-不正" } }, tf);
        // 送る量の守り（D-130.1・K-144 回 11）：自由に書く欄に一律の文字数の上限は無く（入口の 10000 字は外した）、1 回に送る内容全体が 1MB を超えたら 413
        const big = await call(A.app, e, w, { id, body: JSON.stringify({ ...ok, x: "a".repeat(1_048_576) }) });
        expect(big.status, `${e.operationId} の 1MB を超える体`).toBe(413);
        expect((await json(big))["code"]).toBe("PAYLOAD_TOO_LARGE");
        if (e.kind === "update") await bad({ id: "not-a-uuid", body: ok }, "id");
        // 表記ゆらぎ：文字列の項目を全角＋前後の空白にしても、正規化されて同じ値で受け付ける
        const sk = Object.keys(ok).find((k) => typeof ok[k] === "string" && /^[!-~]+$/.test(ok[k] as string));
        if (sk) {
          const id2 = e.kind === "update" ? await targetRow(e) : undefined;
          const r = await call(A.app, e, w, { id: id2, body: { ...ok, [sk]: fullwidth(ok[sk] as string) } });
          const b = await json(r);
          expect([e.success, 409], JSON.stringify(b)).toContain(r.status);
          if (r.status === e.success) {
            const stored = await rowOf(e.table, (b["data"] as { id: string }).id);
            expect(sameValue(stored[sk], ok[sk]), `${sk}=${stored[sk]}`).toBe(true);
          }
        }
      });

    if (aspects["429"])
      it(`${ids(aspects["429"])} ${MAP.lim[key]![0]}/min/${MAP.lim[key]![1]} を超えると 429 RATE_LIMITED と retry_after_sec。副作用なし`, async () => {
        const [per, by] = MAP.lim[key]!;
        const fresh = makeApp({ limits: {} }); // 上限は契約の値のまま
        const w = actor(e);
        const id = e.kind === "update" || e.kind === "delete" ? await targetRow(e) : undefined;
        const o = (): Opts => ({
          id,
          ...(e.kind === "create" || e.kind === "update" ? { body: bodyOf(e, w) } : {}),
          ...(e.kind === "list" ? { query: { limit: "1" } } : {}),
        });
        for (let i = 0; i < per; i++) {
          const r = await call(fresh.app, e, w, o());
          expect(r.status, `${i + 1} 回目`).not.toBe(429);
        }
        const before = await snap(e.table);
        const r = await call(fresh.app, e, w, o());
        const b = await json(r);
        expect(r.status).toBe(429);
        expect(b["code"]).toBe("RATE_LIMITED");
        expect(b["retry_after_sec"]).toBeGreaterThan(0);
        expect(await snap(e.table)).toEqual(before);
        if (by === "user" && e.auth !== "ops") {
          const other = await call(fresh.app, e, "staff", o()); // 上限は人ごと（別の人は止まらない）
          expect(other.status).not.toBe(429);
        }
      }, 60_000);

    if (aspects["502"])
      it(`${ids(aspects["502"])} 外部が失敗した／完了の合図なしに終わったら 502 EXTERNAL_FAILED と次の一手。成功扱い・記録なし`, async () => {
        const w = actor(e);
        for (const res of [
          { status: "failed" as const, reason: "外部が失敗した", handoff: "人が確かめる" },
          { status: "failed" as const, reason: "完了の合図が無いまま終わった", handoff: "人が確かめる" },
        ]) {
          const a = makeApp({ hooks: { [e.operationId]: { effect: async () => res } } });
          const before = await snap(e.table);
          const r = await call(a.app, e, w, e.kind === "list" ? { query: { limit: "5" } } : { body: bodyOf(e, w) });
          const b = await json(r);
          expect(r.status).toBe(502);
          expect(b["code"]).toBe("EXTERNAL_FAILED");
          expect(b["handoff"]).toBeTruthy();
          expect(b["data"]).toBeUndefined();
          expect(await snap(e.table)).toEqual(before);
        }
      });

    if (aspects["state"])
      it(`${ids(aspects["state"])} 状態：${e.kind === "list" ? "0 件は空配列・1,000 件はページング・2 回目は同じ結果" : e.kind === "create" ? "初回 201・同じ冪等キーの 2 回目は最初の結果（記録は 1 回）・違う中身は 409" : e.kind === "update" ? "初回・2 回目とも同じ状態（冪等）・無い行は 404" : "初回で消え・2 回目は 404 で何も変わらない"}`, async () => {
        const w = actor(e);
        if (e.kind === "list") {
          // 0 件：一度も書かない会社 z（tenants・members は自分の会社・自分自身だけ）
          if (e.auth !== "ops") {
            const r0 = await call(A.app, e, "zBoss", { query: { limit: "50" } });
            const b0 = await json(r0);
            expect(r0.status, JSON.stringify(b0)).toBe(200);
            const d0 = b0["data"] as Record<string, unknown>[];
            if (e.table === "tenants") expect(d0.map((x) => x["id"])).toEqual([tenantZ]);
            else if (e.table === "members") expect(d0.map((x) => x["id"])).toEqual([bossZ]);
            else expect(d0).toEqual([]);
            expect((b0["meta"] as Record<string, unknown>)["cursor"]).toBeUndefined();
          }
          // 大量：1,000 行を足し、200 件ずつのページングで全部を 1 回ずつ辿れる
          const seed = h.S.rows[e.table];
          if (seed?.insert) {
            const tenant = tenantOf(e, w);
            const mine: string[] = [];
            for (let i = 0; i < 1000; i++) mine.push(await targetRow(e, tenant));
            const seen: string[] = [];
            let cursor: string | undefined;
            let pages = 0;
            do {
              const r = await call(A.app, e, w, { query: { limit: "200", ...(cursor ? { cursor } : {}) } });
              const b = await json(r);
              expect(r.status).toBe(200);
              const d = b["data"] as { id: string }[];
              expect(d.length).toBeLessThanOrEqual(200);
              seen.push(...d.map((x) => x.id));
              cursor = (b["meta"] as { cursor?: string }).cursor;
              pages++;
            } while (cursor && pages < 50);
            expect(new Set(seen).size).toBe(seen.length); // 重複なし
            for (const id of mine) expect(seen).toContain(id);
            expect(pages).toBeGreaterThanOrEqual(5);
            const def = await json(await call(A.app, e, w, {}));
            expect((def["data"] as unknown[]).length).toBe(50); // 既定は 50 件
          }
          // 2 回目：同じ要求は同じ結果（読むだけで何も変わらない）
          const before = await snap(e.table);
          const r1 = await json(await call(A.app, e, w, { query: { limit: "20" } }));
          const r2 = await json(await call(A.app, e, w, { query: { limit: "20" } }));
          expect(r2).toEqual(r1);
          expect(await snap(e.table)).toEqual(before);
          return;
        }
        if (e.kind === "create") {
          // 0 件の会社でも初回は作れる
          if (e.auth !== "ops") {
            const r0 = await call(A.app, e, "cBoss", { body: bodyOf(e, "cBoss") });
            expect([201], await r0.clone().text()).toContain(r0.status);
          }
          const key = `qa-d-state-${e.operationId}-${Date.now()}`;
          const body = bodyOf(e, w);
          const before = await count(e.table);
          const r1 = await call(A.app, e, w, { body, headers: { "idempotency-key": key } });
          const b1 = await json(r1);
          expect(r1.status, JSON.stringify(b1)).toBe(201);
          expect(await count(e.table)).toBe(before + 1);
          const r2 = await call(A.app, e, w, { body, headers: { "idempotency-key": key } });
          expect(r2.status).toBe(201);
          expect(await json(r2)).toEqual(b1); // 2 回目は最初の結果
          expect(await count(e.table)).toBe(before + 1); // 記録は 1 回
          const r3 = await call(A.app, e, w, { body: otherBody(e, body), headers: { "idempotency-key": key } });
          expect(r3.status).toBe(409); // 重複（違う中身）
          expect(await count(e.table)).toBe(before + 1);
          return;
        }
        if (e.kind === "update") {
          const id = await targetRow(e);
          const body = bodyOf(e, w);
          const r1 = await call(A.app, e, w, { id, body });
          expect(r1.status, await r1.clone().text()).toBe(200);
          const s1 = await rowOf(e.table, id);
          const r2 = await call(A.app, e, w, { id, body });
          expect(r2.status).toBe(200);
          const s2 = await rowOf(e.table, id);
          const strip = (x: Record<string, unknown>) => ({ ...x, updated_at: null });
          expect(strip(s2)).toEqual(strip(s1)); // 2 回目は同じ状態
          const before = await snap(e.table);
          const r0 = await call(A.app, e, w, { id: "0193c5a0-0000-7000-8000-00000000beef", body });
          expect(r0.status).toBe(404); // 0 件（無い行）
          expect(await snap(e.table)).toEqual(before);
          return;
        }
        // delete
        const id = await targetRow(e);
        const r1 = await call(A.app, e, w, { id });
        expect(r1.status, await r1.clone().text()).toBe(200);
        const s1 = await rowOf(e.table, id);
        expect(s1["deleted_at"]).not.toBeNull();
        const before = await snap(e.table);
        const r2 = await call(A.app, e, w, { id });
        expect(r2.status).toBe(404);
        expect(await rowOf(e.table, id)).toEqual(s1); // 2 回目は何も変えない
        expect(await snap(e.table)).toEqual(before);
      }, 120_000);
  });
}

// ============ G-11〜G-16（タスクごと）
const taskEps = (task: string) =>
  (MAP.tasks[task] ?? [])
    .filter((k) => !CHANGED[k])
    .map(ep)
    .filter((x): x is EndpointDef => !!x);
async function argsFor(e: EndpointDef, w: W): Promise<Opts> {
  if (e.kind === "list") return { query: { limit: "5" } };
  if (e.kind === "create") return { body: bodyOf(e, w) };
  const id = await targetRow(e);
  return { id, ...(e.kind === "update" ? { body: bodyOf(e, w) } : {}) };
}

describe("G-11 外部リソースの実在（起動時の存在確認）", () => {
  const rows = Object.values(MAP.g["G-11"] ?? {}).flat();
  if (rows.length)
    it(`${ids(rows)} 表・バケット・秘密の預かり先が無ければ起動しない（名指しで落ちる・黙って 502 にならない）。この環境には全部ある`, async () => {
      const cfg = (env: string) =>
        ({ env, secretsMasterKey: Buffer.alloc(32, 7).toString("base64"), resendApiKey: "x" }) as never;
      const base = { config: cfg("test"), repo: h.repo, bucketExists: async () => true };
      const ok = await assertApiStartup(base);
      expect(ok.ok).toBe(true);
      await expect(assertApiStartup({ ...base, bucketExists: async () => false })).rejects.toThrow(
        /storage:bucket=missing/,
      );
      const noTables = {
        ...h.repo,
        init: async () => {
          throw new Error('relation "tasks" does not exist');
        },
      } as never;
      await expect(assertApiStartup({ ...base, repo: noTables })).rejects.toThrow(/db:tables/);
      await expect(assertApiStartup({ ...base, config: cfg("staging") })).rejects.toThrow(/secrets:vault/); // staging は預かり先が要る
      expect(Object.keys(startupChecks(base)).sort()).toEqual([
        "db:tables",
        "notify:resend",
        "secrets:master-key",
        "secrets:vault",
        "storage:bucket",
      ]);
      // この環境（kaname_test）に、各タスクの endpoint が触る表が実在する
      for (const t of Object.keys(MAP.g["G-11"] ?? {}))
        for (const e of taskEps(t))
          expect(
            h.repo.hasColumn(e.table as never, e.table === "tenants" ? "id" : "tenant_id") ||
              h.repo.hasColumn(e.table as never, "id"),
            `${t} ${e.table}`,
          ).toBe(true);
    });
});

describe("G-13 機能の組み合わせ（同時に起きる）", () => {
  for (const [task, rows] of Object.entries(MAP.g["G-13"] ?? {})) {
    if (retiredTask(task)) {
      describe.skip(`${task}（口が全部、決定 ${retiredTask(task)} で契約から外れた。作業の分解から作り直す）`, () =>
        it(ids(rows), () => undefined));
      continue;
    }
    const eps = taskEps(task);
    it(`${ids(rows)} ${task}：同時に送っても規則どおり（同じ冪等キーの作成は 1 回だけ記録・承認は 1 回で決まる・同じ行の同時更新は全部記録され壊れない）`, async () => {
      for (const e of eps) {
        const w = actor(e);
        if (e.kind === "create") {
          const key = `qa-d-g13-${e.operationId}-${Date.now()}`;
          const body = bodyOf(e, w);
          const before = await count(e.table);
          const rs = await Promise.all(
            Array.from({ length: 5 }, () => call(A.app, e, w, { body, headers: { "idempotency-key": key } })),
          );
          const bodies = await Promise.all(rs.map((r) => r.json() as Promise<{ data?: { id: string } }>));
          expect(
            rs.map((r) => r.status),
            e.operationId,
          ).toEqual([201, 201, 201, 201, 201]);
          expect(
            new Set(bodies.map((b) => b.data?.id)).size,
            `${e.operationId}：同じ冪等キーの同時送信で作られた行の数`,
          ).toBe(1);
          expect(await count(e.table), `${e.operationId}：記録は 1 回`).toBe(before + 1);
        }
        if (e.kind === "update" && e.table === "approvals") {
          // 承認は 1 人 1 回：決まった承認を、もう一度違う決定で上書きできない
          const id = await targetRow(e);
          const first = await call(A.app, e, w, {
            id,
            body: { status_id: "approved", resolved_at: new Date().toISOString() },
          });
          expect(first.status, await first.clone().text()).toBe(200);
          const decided = await rowOf(e.table, id);
          const second = await call(A.app, e, w, {
            id,
            body: { status_id: "rejected", resolved_at: new Date().toISOString() },
          });
          expect(second.status, "決まった承認の上書き").not.toBe(200);
          expect((await rowOf(e.table, id))["status_id"]).toBe(decided["status_id"]);
        } else if (e.kind === "update") {
          const id = await targetRow(e);
          const body = bodyOf(e, w);
          const a0 = await admin.query("select count(*)::int as n from audit_events where target_id = $1", [id]);
          const rs = await Promise.all(Array.from({ length: 5 }, () => call(A.app, e, w, { id, body })));
          expect(
            rs.map((r) => r.status),
            e.operationId,
          ).toEqual([200, 200, 200, 200, 200]);
          const a1 = await admin.query("select count(*)::int as n from audit_events where target_id = $1", [id]);
          expect(a1.rows[0].n - a0.rows[0].n, `${e.operationId}：同時の更新が全部記録される`).toBe(5);
          const stored = await rowOf(e.table, id);
          for (const [k, v] of Object.entries(body))
            expect(sameValue(stored[k], v), `${e.operationId} ${k}`).toBe(true);
        }
        if (e.kind === "delete") {
          const id = await targetRow(e);
          const rs = await Promise.all(Array.from({ length: 5 }, () => call(A.app, e, w, { id })));
          const st = rs.map((r) => r.status).sort();
          expect(st, `${e.operationId}：同時の削除は 1 回だけ成功`).toEqual([200, 404, 404, 404, 404]);
        }
      }
    }, 60_000);
  }
});

describe("G-14 口座状態の波及（本物の認証のセッション）", () => {
  let auth: Auth;
  let authPool: pg.Pool;
  let livePool: pg.Pool;
  beforeAll(async () => {
    livePool = new pg.Pool({ connectionString: APP_URL, max: 3 });
    const a = createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool: livePool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3000",
    });
    auth = a.auth;
    authPool = a.pool;
  });
  afterAll(async () => {
    await authPool?.end();
    await livePool?.end();
  });
  const triggers = ["権限の変更", "パスワードの変更", "退会（人が抜ける）"] as const;
  let n = 0;
  /** 権限の変更の行で、task の口が読むだけのときに代わりに使う「書ける人だけが通る」書き込みの口：チケットを作る（K-60・グループに書ける人だけ） */
  const CREATE_TICKET = ENDPOINTS.find((e) => e.operationId === "createTicket")!;
  let probeSeq = 0;
  for (const [task, rows] of Object.entries(MAP.g["G-14"] ?? {})) {
    if (retiredTask(task)) {
      describe.skip(`${task}（口が全部、決定 ${retiredTask(task)} で契約から外れた。作業の分解から作り直す）`, () =>
        it(ids(rows), () => undefined));
      continue;
    }
    const trig = triggers[n++ % triggers.length]!;
    // 権限の変更では画面のセッションだけを切り、PC（Bridge）のつながりは残す。PC からの新しい権限の外の操作は断られる（D-128.179）
    const title =
      trig === "権限の変更"
        ? `${ids(rows)} ${task}：権限を下げた直後、画面のセッションは 0 秒で 401。Bridge のつながりは残り、新しい権限の外の書き込みは断られる（D-128.179）`
        : `${ids(rows)} ${task}：${trig}の直後、別端末（画面）と Bridge のセッションが 0 秒で 401。sessions が revoked`;
    it(
      title,
      async () => {
        const eps = taskEps(task);
        expect(eps.length).toBeGreaterThan(0);
        // 権限の揃った代表を 1 人作り（権限は先に付ける＝付けた時点の失効を避ける）、画面と Bridge の 2 端末でログイン
        const m = (
          await admin.query(
            "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', 'G-14') returning id",
            [h.S.tenantA, h.S.scopeRootA],
          )
        ).rows[0].id as string;
        await admin.query(
          "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) select $1, $2, key, 'edit' from target_kinds",
          [h.S.tenantA, m],
        );
        const email = `g14-${task.toLowerCase()}-${Date.now()}@example.test`;
        const pw = "correct-horse-battery-staple";
        const su = await auth.api.signUpEmail({ body: { name: "G-14", email, password: pw } });
        await admin.query("update members set auth_user_id = $1 where id = $2", [su.user.id, m]);
        await agreeCurrentTerms(su.user.id); // 今の版に同意済みの人にする（K-53 の同意し直しで止まらないように）
        const web = await signIn(auth, email, pw);
        const bridge = await signIn(auth, email, pw, "Kaname-Bridge/0.1 (macOS)");
        const kinds = (
          await admin.query("select kind_id from sessions where member_id = $1 and revoked_at is null", [m])
        ).rows
          .map((r) => r.kind_id)
          .sort();
        expect(kinds).toEqual(["bridge", "web"]);
        const live = createApp({
          version: "qa-d",
          repo: h.repo,
          resolve: createSessionResolver(auth, livePool),
          contract: {
            limits: Object.fromEntries(ENDPOINTS.map((e) => [e.operationId, BIG])),
            hooks: ticketHooks(livePool), // 権限の変更の行の書き込みの口（チケットを作る）
          },
        });
        const kind = (
          await admin.query<{ id: string }>(
            "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
            [h.S.tenantA],
          )
        ).rows[0]?.id;
        /** チケットを作る体。毎回新しい題名（前に作った行と重ならない） */
        const ticketBody = () => ({
          scope_id: h.S.scopeRootA,
          kind_id: kind,
          title: `G-14 ${task} ${++probeSeq}`,
          assignee_member_id: m,
          due_on: new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10),
          body: {
            doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "権限の確かめ" }] }] },
          },
        });
        const hit = async (e: EndpointDef, token: string) => {
          if (e.operationId === "createTicket")
            return live.request("http://localhost/api/v1/tickets", {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
              body: JSON.stringify(ticketBody()),
            });
          const o = await argsFor(e, "boss");
          const path = e.path.replace(":id", o.id ?? "00000000-0000-4000-8000-000000000000");
          const qs = o.query ? "?" + new URLSearchParams(o.query).toString() : "";
          return live.request(`http://localhost${path}${qs}`, {
            method: e.method,
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            ...(o.body ? { body: JSON.stringify(o.body) } : {}),
          });
        };
        const bridgeBefore = new Map<string, number>();
        for (const e of eps) {
          expect((await hit(e, web.token!)).status, `前：画面 ${e.operationId}`).not.toBe(401);
          const b = (await hit(e, bridge.token!)).status;
          expect(b, `前：Bridge ${e.operationId}`).not.toBe(401);
          bridgeBefore.set(e.operationId, b);
        }
        if (trig === "権限の変更") {
          // 下げる前に Bridge で通った（2xx）書き込みの口。これが 1 本も無ければ、下げた後に断られることを見られない
          let writes = eps.filter((e) => {
            const b = bridgeBefore.get(e.operationId) ?? 0;
            return e.method !== "GET" && b >= 200 && b < 300;
          });
          // task の口が読むだけ（GET だけ）なら、書ける人だけが通る作る口を代わりに 1 本選び、下げる前に Bridge で通ることを確かめる
          // task の口が読むだけ（GET だけ）なら、書ける人だけが通る作る口（チケットを作る）を代わりに使い、下げる前に Bridge で通ることを確かめる
          if (!writes.length) {
            const b = (await hit(CREATE_TICKET, bridge.token!)).status;
            bridgeBefore.set(CREATE_TICKET.operationId, b);
            if (b >= 200 && b < 300) writes = [CREATE_TICKET];
          }
          expect(
            writes.map((e) => e.operationId),
            `${task}：下げる前に Bridge で通った書き込みの口が要る（前の状態：${JSON.stringify(Object.fromEntries(bridgeBefore))}）`,
          ).not.toEqual([]);
          // 権限を下げる（書けるものを全部、見るだけに）
          await admin.query("update permissions set ability_id = 'view' where grantee_member_id = $1", [m]);
          const after: string[] = [];
          for (const e of eps) {
            const w = await hit(e, web.token!);
            const code = w.status === 401 ? ((await w.json()) as { code: string }).code : "";
            if (w.status !== 401 || code !== "UNAUTHENTICATED") after.push(`画面 ${e.operationId}=${w.status}`);
            if (e.method === "GET") {
              const b = (await hit(e, bridge.token!)).status;
              if (b === 401) after.push(`Bridge ${e.operationId}=401（つながりが切れた）`);
            }
          }
          // 前に通った書き込みを、新しい体（hit が毎回作り直す：作る口は新しい体、直す口は新しく作った行）で送ると 403 FORBIDDEN
          //   （409・404・422 で「通らなかった」と数えない。権限の外は入力の確かめより前に 403 で止まる）
          for (const e of writes) {
            const r = await hit(e, bridge.token!);
            const code = r.status === 403 ? ((await r.json()) as { code: string }).code : "";
            if (r.status !== 403 || code !== "FORBIDDEN")
              after.push(`Bridge ${e.operationId}=${r.status} ${code}（403 FORBIDDEN でない）`);
          }
          expect(after, "権限を下げた後の画面と Bridge").toEqual([]);
          const live = (
            await admin.query("select kind_id from sessions where member_id = $1 and revoked_at is null", [m])
          ).rows.map((r) => r.kind_id);
          expect(live, "画面のセッションだけが切れ、Bridge のつながりは残る").toEqual(["bridge"]);
          return;
        } else if (trig === "パスワードの変更")
          await changePassword(
            auth,
            livePool,
            new Headers({ authorization: `Bearer ${web.token}` }),
            pw,
            "another-long-passphrase-42",
          );
        else await admin.query("update members set deleted_at = now() where id = $1", [m]);
        const after: string[] = [];
        // パスワードの変更は、変えた今の画面（web）だけ残し、ほかの端末と PC を切る（D-128.141・K-312。前は今の画面も切っていた）
        const keepsWeb = trig === "パスワードの変更";
        for (const e of eps)
          for (const [label, tk] of [
            ["画面", web.token!],
            ["Bridge", bridge.token!],
          ] as const) {
            const r = await hit(e, tk);
            if (keepsWeb && label === "画面") {
              if (r.status === 401) after.push(`${label} ${e.operationId}=401（今の画面は残るはず）`);
              continue;
            }
            const code = r.status === 401 ? ((await r.json()) as { code: string }).code : "";
            if (r.status !== 401 || code !== "UNAUTHENTICATED") after.push(`${label} ${e.operationId}=${r.status}`);
          }
        expect(
          after,
          "失効の後に 401 UNAUTHENTICATED にならなかった口（パスワードの変更では、今の画面が切れた口）",
        ).toEqual([]);
        if (trig !== "退会（人が抜ける）") {
          const alive = await admin.query("select kind_id from sessions where member_id = $1 and revoked_at is null", [
            m,
          ]);
          if (keepsWeb)
            expect(
              alive.rows.map((r) => r.kind_id),
              "今の画面だけが残る",
            ).toEqual(["web"]);
          else expect(alive.rowCount, "sessions が全部 revoked").toBe(0);
        }
      },
      60_000,
    );
  }
});

describe("G-15 信号なし終了（外部が合図なしに終わる）", () => {
  for (const [task, rows] of Object.entries(MAP.g["G-15"] ?? {})) {
    if (retiredTask(task)) {
      describe.skip(`${task}（口が全部、決定 ${retiredTask(task)} で契約から外れた。作業の分解から作り直す）`, () =>
        it(ids(rows), () => undefined));
      continue;
    }
    const eps = taskEps(task).filter((e) => e.errors.includes(502));
    const gone = (MAP.tasks[task] ?? []).filter((k) => (!ep(k) || CHANGED[k]) && retiredOf(k));
    if (!eps.length && gone.length) {
      describe.skip(`${task}（外へ出る口が決定 ${[...new Set(gone.map(retiredOf))].join("・")} で契約から外れた：${gone.join("・")}。作業の分解から作り直す）`, () =>
        it(ids(rows), () => undefined));
      continue;
    }
    it(`${ids(rows)} ${task}：外部・モデル・プロセスが合図なしに終わる／空を返すと、成功扱いにせず 502 と次の一手（人へのハンドオフ）。記録しない`, async () => {
      expect(eps.length, `${task} に外へ出る口（502 を持つ endpoint）が無い`).toBeGreaterThan(0);
      for (const e of eps) {
        const w = actor(e);
        const a = makeApp({
          hooks: {
            [e.operationId]: {
              effect: async () => ({
                status: "failed",
                reason: "完了の合図が無いまま終わった（空の返事）",
                handoff: "人が確かめる",
              }),
            },
          },
        });
        const o = await argsFor(e, w);
        const before = await snap(e.table);
        const rowBefore = o.id ? await rowOf(e.table, o.id) : null;
        const r = await call(a.app, e, w, o);
        const b = await json(r);
        expect(r.status, e.operationId).toBe(502);
        expect(b["code"]).toBe("EXTERNAL_FAILED");
        expect(b["handoff"]).toBe("人が確かめる");
        expect(await snap(e.table)).toEqual(before);
        if (o.id) expect(await rowOf(e.table, o.id)).toEqual(rowBefore);
      }
    });
  }
});

describe("G-16 有限資源（DB 接続はプール経由・上限で待つ）", () => {
  for (const [task, rows] of Object.entries(MAP.g["G-16"] ?? {})) {
    if (retiredTask(task)) {
      describe.skip(`${task}（口が全部、決定 ${retiredTask(task)} で契約から外れた。作業の分解から作り直す）`, () =>
        it(ids(rows), () => undefined));
      continue;
    }
    it(`${ids(rows)} ${task}：同時 50 要求でも全部返り、DB 接続はプールの上限（3）を超えない。同時にログイン相当の要求も落ちない`, async () => {
      const eps = taskEps(task);
      expect(eps.length).toBeGreaterThan(0);
      const pool = createPool({ databaseUrl: APP_URL, max: 3 });
      const repo = await createRepository(pool);
      const a = makeApp({ repo });
      try {
        const plan: { e: EndpointDef; o: Opts }[] = [];
        for (let i = 0; i < 50; i++) {
          const e = eps[i % eps.length]!;
          plan.push({ e, o: await argsFor(e, actor(e)) });
        }
        let peak = 0;
        let done = false;
        const watch = (async () => {
          while (!done) {
            const r = await admin.query(
              "select count(*)::int as n from pg_stat_activity where usename = 'kaname_app' and datname = current_database() and pid <> pg_backend_pid()",
            );
            peak = Math.max(peak, r.rows[0].n);
            await new Promise((res) => setTimeout(res, 5));
          }
        })();
        const base = Number(
          (
            await admin.query(
              "select count(*)::int as n from pg_stat_activity where usename = 'kaname_app' and datname = current_database()",
            )
          ).rows[0].n,
        );
        const [rs, login] = await Promise.all([
          Promise.all(plan.map(({ e, o }) => call(a.app, e, actor(e), o))),
          call(a.app, ep("GET /api/v1/members")!, "staff", { query: { limit: "1" } }),
        ]);
        done = true;
        await watch;
        const st = rs.map((r, i) => `${plan[i]!.e.operationId}:${r.status}`);
        expect(
          st.filter((s) => /:5\d\d$/.test(s)),
          "5xx が無い",
        ).toEqual([]);
        expect(
          rs.every(
            (r, i) =>
              r.status === plan[i]!.e.success || (plan[i]!.e.kind === "delete" && r.status === 404) || r.status === 409,
          ),
          st.join(" "),
        ).toBe(true);
        expect(login.status).toBe(200);
        expect(peak - base, `プール由来の接続の増分（ベース ${base}）`).toBeLessThanOrEqual(3);
      } finally {
        await pool.end();
      }
    }, 120_000);
  }
});
