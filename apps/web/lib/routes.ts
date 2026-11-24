// 生成物（scripts/ci/gen_routes.mjs ← 05_flow/flow.json）。手で直さない。flow:fc23c8195cda6561
export interface RouteDef {
  id: string;
  route: string;
  needsLogin: boolean;
  release: string;
}
export const ROUTES: readonly RouteDef[] = [
  {
    "id": "account",
    "route": "/account",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ai-staff",
    "route": "/ai-staff",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ai-staff-detail",
    "route": "/ai-staff/:id",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ai-activity",
    "route": "/ai-staff/activity",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "clone-chat",
    "route": "/ai/chat",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "rules",
    "route": "/ai/rules",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "clone-thread",
    "route": "/ai/thread",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "work-types",
    "route": "/ai/work-types",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "approvals",
    "route": "/approvals",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "audit",
    "route": "/audit",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "automation-repair",
    "route": "/automations/:id/repair",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "billing",
    "route": "/billing",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "billing-setup",
    "route": "/billing-setup",
    "needsLogin": false,
    "release": "v2"
  },
  {
    "id": "clients",
    "route": "/clients",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "company-model",
    "route": "/company-model",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "duties",
    "route": "/duties",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "export",
    "route": "/export",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "goals",
    "route": "/goals",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "goal-allocation",
    "route": "/goals/:id/allocation",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "goal-edit",
    "route": "/goals/:id/edit",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "help",
    "route": "/help",
    "needsLogin": false,
    "release": "v1"
  },
  {
    "id": "hypotheses",
    "route": "/hypotheses",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "import",
    "route": "/import",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "inquiry",
    "route": "/inquiry",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "invite-accept",
    "route": "/invite/:token",
    "needsLogin": false,
    "release": "v1"
  },
  {
    "id": "knowledge",
    "route": "/knowledge",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "legal",
    "route": "/legal/:kind",
    "needsLogin": false,
    "release": "v1"
  },
  {
    "id": "login",
    "route": "/login",
    "needsLogin": false,
    "release": "v1"
  },
  {
    "id": "members",
    "route": "/members",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "member-detail",
    "route": "/members/:id",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "mfa-setup",
    "route": "/mfa-setup",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "my-progress",
    "route": "/my-progress",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "notices",
    "route": "/notices",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "onboard-draft",
    "route": "/onboard/draft",
    "needsLogin": false,
    "release": "v2"
  },
  {
    "id": "onboard-golive",
    "route": "/onboard/golive",
    "needsLogin": false,
    "release": "v2"
  },
  {
    "id": "onboard-interview",
    "route": "/onboard/interview",
    "needsLogin": false,
    "release": "v2"
  },
  {
    "id": "onboard-testrun",
    "route": "/onboard/testrun",
    "needsLogin": false,
    "release": "v2"
  },
  {
    "id": "ops-home",
    "route": "/ops",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ops-audit",
    "route": "/ops/audit",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ops-billing",
    "route": "/ops/billing",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ops-catalog",
    "route": "/ops/catalog",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ops-disclosure",
    "route": "/ops/disclosure",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ops-llm",
    "route": "/ops/llm",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ops-notices",
    "route": "/ops/notices",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ops-review",
    "route": "/ops/review",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ops-services",
    "route": "/ops/services",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "ops-skills",
    "route": "/ops/skills",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ops-support",
    "route": "/ops/support",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ops-team",
    "route": "/ops/team",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ops-tenant",
    "route": "/ops/tenants/:id",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "password-reset",
    "route": "/password-reset",
    "needsLogin": false,
    "release": "v1"
  },
  {
    "id": "policies",
    "route": "/policies",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "portal",
    "route": "/portal",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "records",
    "route": "/records",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "record-detail",
    "route": "/records/:id",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "requests",
    "route": "/requests",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "review",
    "route": "/review",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "security-brief",
    "route": "/security",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "disclosure",
    "route": "/security/disclosure",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "services",
    "route": "/services",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "app-setup",
    "route": "/settings/app",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "account-close",
    "route": "/settings/close",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "company-settings",
    "route": "/settings/company",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "credentials",
    "route": "/settings/credentials",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "ledger-def",
    "route": "/settings/ledgers",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "llm-routes",
    "route": "/settings/llm",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "bridge-setup",
    "route": "/setup/bridge",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "signup",
    "route": "/signup",
    "needsLogin": false,
    "release": "v1"
  },
  {
    "id": "tasks",
    "route": "/tasks",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "tickets",
    "route": "/tickets",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "today",
    "route": "/today",
    "needsLogin": true,
    "release": "v2"
  },
  {
    "id": "verify-email",
    "route": "/verify-email",
    "needsLogin": false,
    "release": "v1"
  },
  {
    "id": "layers",
    "route": "/workspace/members/groups",
    "needsLogin": true,
    "release": "v1"
  },
  {
    "id": "masters",
    "route": "/workspace/ticket-settings",
    "needsLogin": true,
    "release": "v1"
  }
];
/** ナビ・カード・ボタンの href が指してよい URL（flow の route ＋ 入口 /）。:id は実値に置き換わる */
export const ROUTE_PATTERNS: readonly string[] = ["/", ...ROUTES.map((r) => r.route)];
