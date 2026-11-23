// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml components）。手で直さない。openapi:b561953c147e9926
import { z } from "zod";

export const Tenants = z.strictObject({
  name: z.string().optional(),
  plan_id: z.uuid().nullable().optional(),
  status_id: z.uuid().nullable().optional(),
  live_at: z.iso.datetime({ offset: true }).nullable().optional(),
  live_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_visibility_default: z.string().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  deletion_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  half_made_at: z.iso.datetime({ offset: true }).nullable().optional(),
  logo_ref: z.string().nullable().optional(),
  request_routing: z.string().nullable().optional(),
  session_idle_hours: z.number().int().optional(),
  session_max_days: z.number().int().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TenantsInput = z.strictObject({
  name: z.string().optional(),
  plan_id: z.uuid().nullable().optional(),
  status_id: z.uuid().nullable().optional(),
  live_at: z.iso.datetime({ offset: true }).nullable().optional(),
  live_by: z.uuid().nullable().optional(),
});
export const Scopes = z.strictObject({
  parent_id: z.uuid().nullable().optional(),
  layer_id: z.uuid().nullable().optional(),
  name: z.string().optional(),
  ticket_prefix: z.string().nullable().optional(),
  next_ticket_no: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ScopesInput = z.strictObject({
  parent_id: z.uuid().nullable().optional(),
  layer_id: z.uuid().nullable().optional(),
  name: z.string().optional(),
  ticket_prefix: z.string().nullable().optional(),
  next_ticket_no: z.number().int().optional(),
});
export const MemberKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const MemberKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Members = z.strictObject({
  kind_id: z.string().optional(),
  display_name: z.string().optional(),
  role_id: z.string().nullable().optional(),
  manager_member_id: z.uuid().nullable().optional(),
  auth_user_id: z.string().nullable().optional(),
  setup_step: z.number().int().optional(),
  agent_permission_mode: z.string().optional(),
  agent_model: z.string().nullable().optional(),
  agent_effort: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  avatar_ref: z.string().nullable().optional(),
  call_name: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  language: z.string().optional(),
  scope_id: z.uuid().optional(),
  setup_dismissed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  setup_skipped_keys: z.array(z.string()).optional(),
  suspended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  suspended_by: z.uuid().nullable().optional(),
  theme: z.string().optional(),
  timezone: z.string().optional(),
  updated_by: z.uuid().nullable().optional(),
  week_start: z.number().int().optional(),
});
export const MembersInput = z.strictObject({
  kind_id: z.string().optional(),
  display_name: z.string().optional(),
  role_id: z.string().nullable().optional(),
  manager_member_id: z.uuid().nullable().optional(),
  auth_user_id: z.string().nullable().optional(),
  setup_step: z.number().int().optional(),
  agent_permission_mode: z.string().optional(),
  agent_model: z.string().nullable().optional(),
  agent_effort: z.string().nullable().optional(),
});
export const SetupSteps = z.strictObject({
  n: z.number().int().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const SetupStepsInput = z.strictObject({
  n: z.number().int().optional(),
  label: z.string().optional(),
});
export const Clones = z.strictObject({
  owner_member_id: z.uuid().nullable().optional(),
  persona: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  auto_memory: z.boolean().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClonesInput = z.strictObject({
  owner_member_id: z.uuid().nullable().optional(),
  persona: z.string().nullable().optional(),
});
export const AiEmployees = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  provisioning_id: z.uuid().nullable().optional(),
  template_ref: z.string().nullable().optional(),
  paused_at: z.iso.datetime({ offset: true }).nullable().optional(),
  paused_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AiEmployeesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  provisioning_id: z.uuid().nullable().optional(),
  template_ref: z.string().nullable().optional(),
  paused_at: z.iso.datetime({ offset: true }).nullable().optional(),
  paused_reason: z.string().nullable().optional(),
});
export const GoalKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  progress_strategy: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const GoalKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  progress_strategy: z.string().nullable().optional(),
});
export const Units = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  symbol: z.string().nullable().optional(),
  value_type_id: z.string().nullable().optional(),
  decimals: z.number().int().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const UnitsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  symbol: z.string().nullable().optional(),
  value_type_id: z.string().nullable().optional(),
  decimals: z.number().int().nullable().optional(),
});
export const RollupKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const RollupKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Goals = z.strictObject({
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  parent_id: z.uuid().nullable().optional(),
  rollup_kind_id: z.string().nullable().optional(),
  rollup_spec: z.unknown().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  target_value: z.string().nullable().optional(),
  unit_id: z.uuid().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
});
export const GoalsInput = z.strictObject({
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  parent_id: z.uuid().nullable().optional(),
  rollup_kind_id: z.string().nullable().optional(),
  rollup_spec: z.unknown().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  target_value: z.string().nullable().optional(),
  unit_id: z.uuid().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
});
export const GoalAllocations = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  allocated_value: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const GoalAllocationsInput = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  allocated_value: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
});
export const GoalContributions = z.strictObject({
  child_goal_id: z.uuid().nullable().optional(),
  parent_goal_id: z.uuid().nullable().optional(),
  hypothesis_id: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const GoalContributionsInput = z.strictObject({
  child_goal_id: z.uuid().nullable().optional(),
  parent_goal_id: z.uuid().nullable().optional(),
  hypothesis_id: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
});
export const GoalVersions = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  name: z.string().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const GoalVersionsInput = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
});
export const Hypotheses = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const HypothesesInput = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
});
export const Measures = z.strictObject({
  hypothesis_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  expected_effect: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const MeasuresInput = z.strictObject({
  hypothesis_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  expected_effect: z.string().nullable().optional(),
});
export const Validations = z.strictObject({
  measure_id: z.uuid().nullable().optional(),
  measured_value: z.string().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  measured_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ValidationsInput = z.strictObject({
  measure_id: z.uuid().nullable().optional(),
  measured_value: z.string().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  measured_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const LedgerDefinitions = z.strictObject({
  kind_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  json_schema: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
});
export const LedgerDefinitionsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  json_schema: z.unknown().nullable().optional(),
});
export const LedgerFields = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  data_type_id: z.string().nullable().optional(),
  required: z.boolean().nullable().optional(),
  options_master_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  is_filterable: z.boolean().nullable().optional(),
  is_sortable: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerFieldsInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  data_type_id: z.string().nullable().optional(),
  required: z.boolean().nullable().optional(),
  options_master_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  is_filterable: z.boolean().nullable().optional(),
  is_sortable: z.boolean().nullable().optional(),
});
export const LedgerStages = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().nullable().optional(),
  rules: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerStagesInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().nullable().optional(),
  rules: z.unknown().nullable().optional(),
});
export const LedgerViews = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  filters: z.unknown().nullable().optional(),
  sorts: z.unknown().nullable().optional(),
  columns: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerViewsInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  filters: z.unknown().nullable().optional(),
  sorts: z.unknown().nullable().optional(),
  columns: z.unknown().nullable().optional(),
});
export const LedgerRecords = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  stage_id: z.uuid().nullable().optional(),
  amount: z.string().nullable().optional(),
  occurred_on: z.iso.date().nullable().optional(),
  assignee_id: z.uuid().nullable().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  data: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerRecordsInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  stage_id: z.uuid().nullable().optional(),
  amount: z.string().nullable().optional(),
  occurred_on: z.iso.date().nullable().optional(),
  assignee_id: z.uuid().nullable().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  data: z.unknown().nullable().optional(),
});
export const Duties = z.strictObject({
  ai_employee_id: z.uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  definition_md: z.string().nullable().optional(),
  constraints: z.unknown().nullable().optional(),
  visibility_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
});
export const DutiesInput = z.strictObject({
  ai_employee_id: z.uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  definition_md: z.string().nullable().optional(),
  constraints: z.unknown().nullable().optional(),
  visibility_id: z.string().nullable().optional(),
});
export const DutyVersions = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DutyVersionsInput = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
});
export const LearnedProcedures = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  target_service_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  run_count: z.number().int().nullable().optional(),
  avg_ms: z.number().int().nullable().optional(),
  fail_count: z.number().int().nullable().optional(),
  last_verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LearnedProceduresInput = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  target_service_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  run_count: z.number().int().nullable().optional(),
  avg_ms: z.number().int().nullable().optional(),
  fail_count: z.number().int().nullable().optional(),
  last_verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ProcedureSteps = z.strictObject({
  procedure_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  intent_ja: z.string().nullable().optional(),
  locator: z.unknown().nullable().optional(),
  is_variable: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ProcedureStepsInput = z.strictObject({
  procedure_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  intent_ja: z.string().nullable().optional(),
  is_variable: z.boolean().nullable().optional(),
});
export const MemoryKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const MemoryKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Memories = z.strictObject({
  kind_id: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  source_type_id: z.string().nullable().optional(),
  source_ref_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  approved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  digest_id: z.uuid().nullable().optional(),
  superseded_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  auto: z.boolean().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  embedding: z.array(z.unknown()).nullable().optional(),
  last_used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  use_count: z.number().int().optional(),
  visibility: z.string().optional(),
});
export const MemoriesInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  source_type_id: z.string().nullable().optional(),
  source_ref_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  approved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  digest_id: z.uuid().nullable().optional(),
  superseded_by: z.uuid().nullable().optional(),
});
export const MemoryDigests = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  from_on: z.iso.date().nullable().optional(),
  to_on: z.iso.date().nullable().optional(),
  conversation_count: z.number().int().nullable().optional(),
  state_id: z.string().nullable().optional(),
  result: z.unknown().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const MemoryDigestsInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  from_on: z.iso.date().nullable().optional(),
  to_on: z.iso.date().nullable().optional(),
  conversation_count: z.number().int().nullable().optional(),
  state_id: z.string().nullable().optional(),
  result: z.unknown().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const MemoryProposals = z.strictObject({
  memory_id: z.uuid().nullable().optional(),
  target_scope_id: z.uuid().nullable().optional(),
  proposer_member_id: z.uuid().nullable().optional(),
  reviewer_member_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  conflict_group_id: z.uuid().nullable().optional(),
  evidence: z.unknown().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const MemoryProposalsInput = z.strictObject({
  memory_id: z.uuid().nullable().optional(),
  target_scope_id: z.uuid().nullable().optional(),
  proposer_member_id: z.uuid().nullable().optional(),
  reviewer_member_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  conflict_group_id: z.uuid().nullable().optional(),
  evidence: z.unknown().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const EmbeddingModels = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  dim: z.number().int().optional(),
  state_id: z.string().optional(),
  artifact_url: z.string().optional(),
  sha256: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const EmbeddingModelsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  dim: z.number().int().optional(),
  state_id: z.string().optional(),
  artifact_url: z.string().optional(),
  sha256: z.string().optional(),
});
export const SearchEmbeddings = z.strictObject({
  target_type_id: z.string().optional(),
  target_id: z.uuid().optional(),
  model_id: z.string().optional(),
  chunk_no: z.string().optional(),
  content_hash: z.string().optional(),
  embedding: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const SearchEmbeddingsInput = z.strictObject({
  target_type_id: z.string().optional(),
  target_id: z.uuid().optional(),
  model_id: z.string().optional(),
  chunk_no: z.string().optional(),
});
export const Tasks = z.strictObject({
  parent_task_id: z.uuid().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  title: z.string().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
  goal_changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  next_action: z.string().nullable().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  planned_for: z.iso.date().nullable().optional(),
  blocked_reason_id: z.string().nullable().optional(),
  blocked_since: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TasksInput = z.strictObject({
  parent_task_id: z.uuid().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  title: z.string().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
  goal_changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  next_action: z.string().nullable().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  planned_for: z.iso.date().nullable().optional(),
  blocked_reason_id: z.string().nullable().optional(),
  blocked_since: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const TaskHandovers = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  from_member_id: z.uuid().nullable().optional(),
  to_member_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TaskHandoversInput = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  from_member_id: z.uuid().nullable().optional(),
  to_member_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const DailyPlans = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  plan_date: z.iso.date().nullable().optional(),
  capacity_minutes: z.number().int().nullable().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  carry_over: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DailyPlansInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  plan_date: z.iso.date().nullable().optional(),
  capacity_minutes: z.number().int().nullable().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  carry_over: z.unknown().nullable().optional(),
});
export const Triggers = z.strictObject({
  kind_id: z.string().nullable().optional(),
  cron_expr: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  on_missed_id: z.string().nullable().optional(),
  ttl_minutes: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TriggersInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  cron_expr: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  on_missed_id: z.string().nullable().optional(),
  ttl_minutes: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});
export const Policies = z.strictObject({
  subject_kind_id: z.string().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  params: z.unknown().nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  applies_to: z.string().optional(),
  client_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  escalate_to: z.string().nullable().optional(),
  escalate_when: z.unknown().nullable().optional(),
  exception_approval_id: z.uuid().nullable().optional(),
  exception_of_policy_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
  kind_id: z.uuid().nullable().optional(),
  last_used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  paused_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  source_ref: z.unknown().nullable().optional(),
  text: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  use_count: z.number().int().optional(),
  version: z.number().int().optional(),
});
export const PoliciesInput = z.strictObject({
  subject_kind_id: z.string().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  params: z.unknown().nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
});
export const Approvals = z.strictObject({
  action_run_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  approver_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  bulk_batch_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  decision: z.string().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  escalated_by_policy_id: z.uuid().nullable().optional(),
  human_checks: z.unknown().optional(),
  irreversible: z.boolean().optional(),
  kind: z.string().optional(),
  level: z.number().int().optional(),
  memory_candidate: z.boolean().optional(),
  next_actor: z.string().nullable().optional(),
  parent_approval_id: z.uuid().nullable().optional(),
  return_reason: z.string().nullable().optional(),
  return_targets: z.unknown().nullable().optional(),
  scope_id: z.uuid().optional(),
  step_up_at: z.iso.datetime({ offset: true }).nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  ticket_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  withdrawn_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ApprovalsInput = z.strictObject({
  action_run_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  approver_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
});
export const ActionRuns = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  choke_point_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  procedure_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  tokens_in: z.number().int().nullable().optional(),
  tokens_out: z.number().int().nullable().optional(),
  cost: z.string().nullable().optional(),
  error_summary: z.string().nullable().optional(),
  ai_employee_id: z.uuid().nullable().optional(),
  duty_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  taken_over_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  approval_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  phase: z.string().nullable().optional(),
  scope_id: z.uuid().optional(),
  ticket_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ActionRunsInput = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  choke_point_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  procedure_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  tokens_in: z.number().int().nullable().optional(),
  tokens_out: z.number().int().nullable().optional(),
  cost: z.string().nullable().optional(),
  error_summary: z.string().nullable().optional(),
  ai_employee_id: z.uuid().nullable().optional(),
  duty_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  taken_over_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ServiceRegistry = z.strictObject({
  name: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ServiceRegistryInput = z.strictObject({
  name: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const CredentialKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const CredentialKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Credentials = z.strictObject({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  layer: z.string().optional(),
  service_id: z.uuid().nullable().optional(),
  service_name: z.string().nullable().optional(),
  service_domain: z.string().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  provider_id: z.string().optional(),
  vault_ref: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  destinations: z.array(z.string()).optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  last_used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  login_check_at: z.iso.datetime({ offset: true }).nullable().optional(),
  login_check_detail: z.string().nullable().optional(),
  login_check_state: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  read_only: z.boolean().optional(),
  scope_id: z.uuid().optional(),
  two_factor_id: z.string().optional(),
  updated_by: z.uuid().nullable().optional(),
  use_count: z.number().int().optional(),
});
export const CredentialsInput = z.strictObject({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  layer: z.string().optional(),
  service_id: z.uuid().nullable().optional(),
  service_name: z.string().nullable().optional(),
  service_domain: z.string().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  provider_id: z.string().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Conversations = z.strictObject({
  title: z.string().nullable().optional(),
  participant_member_ids: z.array(z.uuid()).nullable().optional(),
  area: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  parent_conversation_id: z.uuid().nullable().optional(),
  agent_session_id: z.string().nullable().optional(),
  branched_from_message_id: z.uuid().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  title_auto: z.boolean().optional(),
  starred_at: z.iso.datetime({ offset: true }).nullable().optional(),
  incognito: z.boolean().optional(),
  last_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ConversationsInput = z.strictObject({
  title: z.string().nullable().optional(),
  participant_member_ids: z.array(z.uuid()).nullable().optional(),
  area: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  parent_conversation_id: z.uuid().nullable().optional(),
  agent_session_id: z.string().nullable().optional(),
  branched_from_message_id: z.uuid().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  title_auto: z.boolean().optional(),
  starred_at: z.iso.datetime({ offset: true }).nullable().optional(),
  incognito: z.boolean().optional(),
  last_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const BridgeJobs = z.strictObject({
  member_id: z.uuid().optional(),
  conversation_id: z.uuid().nullable().optional(),
  state_id: z.string().optional(),
  prompt: z.string().optional(),
  agent_session_id: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  partial: z.string().nullable().optional(),
  stopped_reason: z.string().nullable().optional(),
  permission_mode: z.string().optional(),
  model: z.string().nullable().optional(),
  effort: z.string().nullable().optional(),
  tools: z.array(z.string()).nullable().optional(),
  attachment_ids: z.array(z.uuid()).nullable().optional(),
  steer_seq: z.number().int().optional(),
  tool_token_hash: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  kind: z.string().optional(),
  resume_session_id: z.uuid().nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  stop_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  taken_session_id: z.uuid().nullable().optional(),
  target_session_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BridgeJobsInput = z.strictObject({
  member_id: z.uuid().optional(),
  conversation_id: z.uuid().nullable().optional(),
  state_id: z.string().optional(),
  prompt: z.string().optional(),
  agent_session_id: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  partial: z.string().nullable().optional(),
  stopped_reason: z.string().nullable().optional(),
  permission_mode: z.string().optional(),
  model: z.string().nullable().optional(),
  effort: z.string().nullable().optional(),
  tools: z.array(z.string()).nullable().optional(),
  attachment_ids: z.array(z.uuid()).nullable().optional(),
  steer_seq: z.number().int().optional(),
  tool_token_hash: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const BridgeJobStates = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const BridgeJobStatesInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const BridgeJobEvents = z.strictObject({
  member_id: z.uuid().optional(),
  job_id: z.uuid().optional(),
  kind: z.string().optional(),
  seq: z.number().int().optional(),
  request_id: z.string().nullable().optional(),
  payload: z.unknown().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BridgeJobEventsInput = z.strictObject({
  member_id: z.uuid().optional(),
  job_id: z.uuid().optional(),
  kind: z.string().optional(),
  seq: z.number().int().optional(),
  request_id: z.string().nullable().optional(),
  payload: z.unknown().optional(),
});
export const PermissionRules = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  tool: z.string().nullable().optional(),
  target_pattern: z.string().nullable().optional(),
  decision_id: z.string().nullable().optional(),
  bridge_job_event_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PermissionRulesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  tool: z.string().nullable().optional(),
  target_pattern: z.string().nullable().optional(),
  decision_id: z.string().nullable().optional(),
  bridge_job_event_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const AgentUsageSnapshots = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  window_id: z.string().nullable().optional(),
  utilization: z.string().nullable().optional(),
  resets_at: z.iso.datetime({ offset: true }).nullable().optional(),
  observed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AgentUsageSnapshotsInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  window_id: z.string().nullable().optional(),
  utilization: z.string().nullable().optional(),
  resets_at: z.iso.datetime({ offset: true }).nullable().optional(),
  observed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Messages = z.strictObject({
  conversation_id: z.uuid().nullable().optional(),
  sender_member_id: z.uuid().nullable().optional(),
  body: z.string().nullable().optional(),
  attachments: z.unknown().nullable().optional(),
  action_run_id: z.uuid().nullable().optional(),
  kind: z.string().nullable().optional(),
  options: z.unknown().nullable().optional(),
  confidence: z.string().nullable().optional(),
  citations: z.unknown().nullable().optional(),
  parent_message_id: z.uuid().nullable().optional(),
  quote: z.unknown().nullable().optional(),
  work: z.unknown().nullable().optional(),
  send_state: z.string().nullable().optional(),
  transcript_uuid: z.string().nullable().optional(),
  undo_action_run_id: z.uuid().nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  job_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const MessagesInput = z.strictObject({
  conversation_id: z.uuid().nullable().optional(),
  sender_member_id: z.uuid().nullable().optional(),
  body: z.string().nullable().optional(),
  attachments: z.unknown().nullable().optional(),
  action_run_id: z.uuid().nullable().optional(),
  kind: z.string().nullable().optional(),
  options: z.unknown().nullable().optional(),
  confidence: z.string().nullable().optional(),
  citations: z.unknown().nullable().optional(),
  parent_message_id: z.uuid().nullable().optional(),
  quote: z.unknown().nullable().optional(),
  work: z.unknown().nullable().optional(),
  send_state: z.string().nullable().optional(),
  transcript_uuid: z.string().nullable().optional(),
  undo_action_run_id: z.uuid().nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Artifacts = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  format_id: z.string().nullable().optional(),
  storage_ref: z.string().nullable().optional(),
  template_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  source_message_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  source_conversation_id: z.uuid().nullable().optional(),
  source_job_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ArtifactsInput = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  format_id: z.string().nullable().optional(),
  template_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  source_message_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  source_conversation_id: z.uuid().nullable().optional(),
  source_job_id: z.uuid().nullable().optional(),
});
export const ArtifactVersions = z.strictObject({
  artifact_id: z.uuid().optional(),
  version: z.number().int().optional(),
  storage_ref: z.string().optional(),
  size_bytes: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  reverted_from: z.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ArtifactVersionsInput = z.strictObject({
  artifact_id: z.uuid().optional(),
  size_bytes: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  reverted_from: z.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const AuditEvents = z.strictObject({
  actor_member_id: z.uuid().nullable().optional(),
  actor_role: z.string().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: z.string().nullable().optional(),
  choke_point_id: z.string().nullable().optional(),
  payload: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AuditEventsInput = z.strictObject({
  actor_member_id: z.uuid().nullable().optional(),
  actor_role: z.string().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: z.string().nullable().optional(),
  choke_point_id: z.string().nullable().optional(),
  payload: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const SessionKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const SessionKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const RevokeReasons = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const RevokeReasonsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Layers = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LayersInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().optional(),
});
export const TargetKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const TargetKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Abilities = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const AbilitiesInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Permissions = z.strictObject({
  grantee_member_id: z.uuid().optional(),
  target_kind_id: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  ability_id: z.string().optional(),
  granted_by: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  bundle_role: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PermissionsInput = z.strictObject({
  grantee_member_id: z.uuid().optional(),
  target_kind_id: z.string().optional(),
  ability_id: z.string().optional(),
  granted_by: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const AccountEvents = z.strictObject({
  kind_id: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AccountEventsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const AccountEventItems = z.strictObject({
  event_id: z.uuid().nullable().optional(),
  object_kind: z.string().nullable().optional(),
  disposition_id: z.string().nullable().optional(),
  target_ref: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  done_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AccountEventItemsInput = z.strictObject({
  event_id: z.uuid().nullable().optional(),
  object_kind: z.string().nullable().optional(),
  disposition_id: z.string().nullable().optional(),
  target_ref: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  done_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Sessions = z.strictObject({
  member_id: z.uuid().optional(),
  kind_id: z.string().optional(),
  auth_session_id: z.string().nullable().optional(),
  device_label: z.string().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).optional(),
  last_seen_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoke_reason_id: z.string().nullable().optional(),
  device_token_hash: z.string().nullable().optional(),
  alive_at: z.iso.datetime({ offset: true }).nullable().optional(),
  bridge_version: z.string().nullable().optional(),
  machine_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  browser: z.string().optional(),
  cli_model: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  device: z.string().nullable().optional(),
  health: z.unknown().nullable().optional(),
  health_at: z.iso.datetime({ offset: true }).nullable().optional(),
  last_ip: z.string().nullable().optional(),
  mfa_pending: z.boolean().optional(),
  step_up_at: z.iso.datetime({ offset: true }).nullable().optional(),
  terms_pending: z.boolean().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SessionsInput = z.strictObject({
  member_id: z.uuid().optional(),
  kind_id: z.string().optional(),
  auth_session_id: z.string().nullable().optional(),
  device_label: z.string().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).optional(),
  last_seen_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoke_reason_id: z.string().nullable().optional(),
  device_token_hash: z.string().nullable().optional(),
  alive_at: z.iso.datetime({ offset: true }).nullable().optional(),
  bridge_version: z.string().nullable().optional(),
  machine_id: z.uuid().nullable().optional(),
});
export const SupportAccessGrants = z.strictObject({
  granted_by_member_id: z.uuid().nullable().optional(),
  scope: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  inquiry_id: z.uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SupportAccessGrantsInput = z.strictObject({
  granted_by_member_id: z.uuid().nullable().optional(),
  scope: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
});
export const RetentionHolds = z.strictObject({
  record_type: z.string().nullable().optional(),
  record_ref: z.string().nullable().optional(),
  retain_until: z.iso.date().nullable().optional(),
  legal_basis: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const RetentionHoldsInput = z.strictObject({
  record_type: z.string().nullable().optional(),
  record_ref: z.string().nullable().optional(),
  retain_until: z.iso.date().nullable().optional(),
  legal_basis: z.string().nullable().optional(),
});
export const ErasureCertificates = z.strictObject({
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  content_hash: z.string().nullable().optional(),
  sent_to: z.string().nullable().optional(),
  storage_ref: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ErasureCertificatesInput = z.strictObject({
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  sent_to: z.string().nullable().optional(),
});
export const Distributions = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DistributionsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
});
export const DistributionVersions = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const DistributionVersionsInput = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
});
export const TenantDistributions = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  override: z.unknown().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TenantDistributionsInput = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  override: z.unknown().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
});
export const ServiceRegistryVersions = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ServiceRegistryVersionsInput = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ServiceRequests = z.strictObject({
  service_name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ServiceRequestsInput = z.strictObject({
  service_name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ReviewRequests = z.strictObject({
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  anonymization_check: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  reviewer_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ReviewRequestsInput = z.strictObject({
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  anonymization_check: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  reviewer_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const OpsMembers = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  ops_role_id: z.string().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  caps: z.array(z.string()).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const OpsMembersInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  ops_role_id: z.string().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const OpsAuditEvents = z.strictObject({
  ops_member_id: z.uuid().nullable().optional(),
  target_tenant_id: z.uuid().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: z.string().nullable().optional(),
  grant_id: z.uuid().nullable().optional(),
  payload: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const OpsAuditEventsInput = z.strictObject({
  ops_member_id: z.uuid().nullable().optional(),
  target_tenant_id: z.uuid().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: z.string().nullable().optional(),
  grant_id: z.uuid().nullable().optional(),
  payload: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const SecurityEvents = z.strictObject({
  kind_id: z.string().optional(),
  step_up: z.string().optional(),
  step_up_failed: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  detail: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SecurityEventsInput = z.strictObject({
  kind_id: z.string().optional(),
  step_up: z.string().optional(),
  step_up_failed: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  detail: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const Inquiries = z.strictObject({
  opened_by_member_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  status_id: z.string().nullable().optional(),
  conversation_id: z.uuid().nullable().optional(),
  assignee_ops_member_id: z.uuid().nullable().optional(),
  ai_first_answered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  context: z.unknown().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  later_until: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const InquiriesInput = z.strictObject({
  opened_by_member_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  status_id: z.string().nullable().optional(),
  conversation_id: z.uuid().nullable().optional(),
  assignee_ops_member_id: z.uuid().nullable().optional(),
  ai_first_answered_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Notices = z.strictObject({
  kind_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  target_plan_ids: z.array(z.uuid()).nullable().optional(),
  target_tenant_id: z.uuid().nullable().optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  affects: z.unknown().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  emailed_admins_at: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_from: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_to: z.iso.datetime({ offset: true }).nullable().optional(),
  placements: z.array(z.string()).optional(),
  state: z.string().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NoticesInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  target_plan_ids: z.array(z.uuid()).nullable().optional(),
  target_tenant_id: z.uuid().nullable().optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
});
export const NoticeDeliveries = z.strictObject({
  notice_id: z.uuid().nullable().optional(),
  member_id: z.uuid().nullable().optional(),
  delivered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NoticeDeliveriesInput = z.strictObject({
  notice_id: z.uuid().nullable().optional(),
  member_id: z.uuid().nullable().optional(),
  delivered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const StatusIncidents = z.strictObject({
  component_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  body: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  notice_id: z.uuid().nullable().optional(),
  state: z.string().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const StatusIncidentsInput = z.strictObject({
  component_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
});
export const NotificationPreferences = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NotificationPreferencesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});
export const Notifications = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  dedupe_key: z.string().nullable().optional(),
  sent_at: z.iso.datetime({ offset: true }).nullable().optional(),
  failed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retry_count: z.number().int().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NotificationsInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  sent_at: z.iso.datetime({ offset: true }).nullable().optional(),
  failed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retry_count: z.number().int().nullable().optional(),
});
export const Plans = z.strictObject({
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  price_monthly: z.string().nullable().optional(),
  limits: z.unknown().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PlansInput = z.strictObject({
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  price_monthly: z.string().nullable().optional(),
  limits: z.unknown().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
});
export const PlanVersions = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const PlanVersionsInput = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Subscriptions = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  suspended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  billing_contact: z.unknown().nullable().optional(),
  payment_method_id: z.uuid().optional(),
  stripe_customer_ref: z.string().optional(),
  stripe_subscription_ref: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SubscriptionsInput = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  suspended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  billing_contact: z.unknown().nullable().optional(),
  payment_method_id: z.uuid().optional(),
  stripe_customer_ref: z.string().optional(),
  stripe_subscription_ref: z.string().optional(),
});
export const PlanChangeRequests = z.strictObject({
  from_plan_id: z.uuid().nullable().optional(),
  to_plan_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  dependencies_event_id: z.uuid().nullable().optional(),
  decided_by_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PlanChangeRequestsInput = z.strictObject({
  from_plan_id: z.uuid().nullable().optional(),
  to_plan_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  dependencies_event_id: z.uuid().nullable().optional(),
  decided_by_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const UsageMeters = z.strictObject({
  meter_key: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  value: z.string().nullable().optional(),
  limit_value: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const UsageMetersInput = z.strictObject({
  meter_key: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  value: z.string().nullable().optional(),
  limit_value: z.string().nullable().optional(),
});
export const Invoices = z.strictObject({
  subscription_id: z.uuid().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  status_id: z.string().nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  stripe_invoice_ref: z.string().optional(),
  hosted_url: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const InvoicesInput = z.strictObject({
  subscription_id: z.uuid().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  status_id: z.string().nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  stripe_invoice_ref: z.string().optional(),
  hosted_url: z.string().optional(),
});
export const Payments = z.strictObject({
  invoice_id: z.uuid().nullable().optional(),
  paid_on: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  method_id: z.string().nullable().optional(),
  recorded_by_ops_member_id: z.uuid().nullable().optional(),
  stripe_payment_ref: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PaymentsInput = z.strictObject({
  invoice_id: z.uuid().nullable().optional(),
  paid_on: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  method_id: z.string().nullable().optional(),
  recorded_by_ops_member_id: z.uuid().nullable().optional(),
  stripe_payment_ref: z.string().optional(),
});
export const ErrorEvents = z.strictObject({
  error_code: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  screen_id: z.string().nullable().optional(),
  context: z.unknown().optional(),
  shown_at: z.iso.datetime({ offset: true }).optional(),
  next_action_taken_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ErrorEventsInput = z.strictObject({
  error_code: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  screen_id: z.string().nullable().optional(),
  context: z.unknown().optional(),
  shown_at: z.iso.datetime({ offset: true }).optional(),
  next_action_taken_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Imports = z.strictObject({
  file_ref: z.string().nullable().optional(),
  detected_kind_id: z.string().nullable().optional(),
  proposal: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  applied_at: z.iso.datetime({ offset: true }).nullable().optional(),
  applied_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ImportsInput = z.strictObject({
  file_ref: z.string().nullable().optional(),
  detected_kind_id: z.string().nullable().optional(),
  proposal: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  applied_at: z.iso.datetime({ offset: true }).nullable().optional(),
  applied_by: z.uuid().nullable().optional(),
});
export const Integrations = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  scopes: z.array(z.string()).nullable().optional(),
  status_id: z.string().nullable().optional(),
  connected_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const IntegrationsInput = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  scopes: z.array(z.string()).nullable().optional(),
  status_id: z.string().nullable().optional(),
  connected_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Invitations = z.strictObject({
  email: z.string().nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  role_id: z.string().nullable().optional(),
  permission_preset: z.unknown().optional(),
  token_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  accepted_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  message: z.string().nullable().optional(),
  resend_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const InvitationsInput = z.strictObject({
  email: z.string().nullable().optional(),
  role_id: z.string().nullable().optional(),
  permission_preset: z.unknown().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  accepted_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  message: z.string().nullable().optional(),
  resend_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const PendingSignup = z.strictObject({
  email: z.string().optional(),
  name: z.string().optional(),
  company_name: z.string().optional(),
  pw_iv: z.string().optional(),
  token_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  sent_at: z.iso.datetime({ offset: true }).optional(),
  send_error: z.string().optional(),
  consumed_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const PendingSignupInput = z.strictObject({
  email: z.string().optional(),
  name: z.string().optional(),
  company_name: z.string().optional(),
  pw_iv: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  sent_at: z.iso.datetime({ offset: true }).optional(),
  send_error: z.string().optional(),
  consumed_at: z.iso.datetime({ offset: true }).optional(),
});
export const ExportJobs = z.strictObject({
  requested_by: z.uuid().nullable().optional(),
  kind_id: z.string().optional(),
  storage_ref: z.string().nullable().optional(),
  status_id: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  downloaded_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ExportJobsInput = z.strictObject({
  requested_by: z.uuid().nullable().optional(),
  kind_id: z.string().optional(),
  status_id: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  downloaded_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Attachments = z.strictObject({
  owner_type: z.string().nullable().optional(),
  owner_id: z.uuid().nullable().optional(),
  storage_ref: z.string().nullable().optional(),
  mime: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  uploaded_by: z.uuid().nullable().optional(),
  scanned_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AttachmentsInput = z.strictObject({
  owner_type: z.string().nullable().optional(),
  owner_id: z.uuid().nullable().optional(),
  mime: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  uploaded_by: z.uuid().nullable().optional(),
  scanned_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Skills = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  visibility_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SkillsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  visibility_id: z.string().nullable().optional(),
});
export const SkillVersions = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  package_ref: z.string().nullable().optional(),
  changelog: z.string().nullable().optional(),
  tested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  test_result: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  checked: z.unknown().nullable().optional(),
  fields: z.unknown().optional(),
  state: z.string().optional(),
});
export const SkillVersionsInput = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  changelog: z.string().nullable().optional(),
  tested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  test_result: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
});
export const SkillTestRuns = z.strictObject({
  skill_version_id: z.uuid().nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
  mode: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SkillTestRunsInput = z.strictObject({
  skill_version_id: z.uuid().nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
  mode: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result: z.unknown().nullable().optional(),
});
export const SkillAttachments = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  target_type: z.string().nullable().optional(),
  target_id: z.uuid().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
  attached_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SkillAttachmentsInput = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  target_type: z.string().nullable().optional(),
  target_id: z.uuid().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
  attached_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const PaymentMethods = z.strictObject({
  kind_id: z.string().nullable().optional(),
  stripe_customer_ref: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  last4: z.string().nullable().optional(),
  expires_on: z.iso.date().nullable().optional(),
  registered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PaymentMethodsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  stripe_customer_ref: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  last4: z.string().nullable().optional(),
  expires_on: z.iso.date().nullable().optional(),
  registered_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const BillingEvents = z.strictObject({
  stripe_event_ref: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  received_at: z.iso.datetime({ offset: true }).nullable().optional(),
  processed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  signature_ok: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BillingEventsInput = z.strictObject({
  stripe_event_ref: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  received_at: z.iso.datetime({ offset: true }).nullable().optional(),
  processed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  signature_ok: z.string().nullable().optional(),
});
export const LlmRoutes = z.strictObject({
  default_kind_id: z.string().nullable().optional(),
  offline_kind_id: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  managed_allowed_by_ops_member_id: z.uuid().nullable().optional(),
  managed_allowed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LlmRoutesInput = z.strictObject({
  default_kind_id: z.string().nullable().optional(),
  offline_kind_id: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  managed_allowed_by_ops_member_id: z.uuid().nullable().optional(),
  managed_allowed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const LlmCapabilities = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  provider_id: z.uuid().nullable().optional(),
  capability_id: z.string().nullable().optional(),
  supported: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const LlmCapabilitiesInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  provider_id: z.uuid().nullable().optional(),
  capability_id: z.string().nullable().optional(),
  supported: z.string().nullable().optional(),
});
export const PushDevices = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  platform_id: z.string().nullable().optional(),
  token_ref: z.string().nullable().optional(),
  app_version: z.number().int().nullable().optional(),
  last_seen_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PushDevicesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  platform_id: z.string().nullable().optional(),
  token_ref: z.string().nullable().optional(),
  app_version: z.number().int().nullable().optional(),
  last_seen_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const DisclosureVersions = z.strictObject({
  version: z.number().int().nullable().optional(),
  generated_at: z.iso.datetime({ offset: true }).nullable().optional(),
  content_hash: z.string().nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  dpa_ref: z.string().nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  notice_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DisclosureVersionsInput = z.strictObject({
  generated_at: z.iso.datetime({ offset: true }).nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  dpa_ref: z.string().nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  notice_id: z.uuid().nullable().optional(),
});
export const Subprocessors = z.strictObject({
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  data_kinds: z.array(z.string()).nullable().optional(),
  effective_from: z.string().nullable().optional(),
  announced_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retired_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SubprocessorsInput = z.strictObject({
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  data_kinds: z.array(z.string()).nullable().optional(),
  effective_from: z.string().nullable().optional(),
  announced_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retired_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Tickets = z.strictObject({
  number: z.string().optional(),
  kind_id: z.uuid().optional(),
  stage_id: z.uuid().optional(),
  title: z.string().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  completed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  completed_by: z.uuid().nullable().optional(),
  delegated_to_clone: z.boolean().optional(),
  client_id: z.uuid().nullable().optional(),
  parent_ticket_id: z.uuid().nullable().optional(),
  derived_from_ticket_id: z.uuid().nullable().optional(),
  start_on: z.iso.date().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  priority: z.string().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  work_type_id: z.uuid().nullable().optional(),
  work_type_version: z.number().int().nullable().optional(),
  hold_reason: z.string().nullable().optional(),
  resume_condition: z.string().nullable().optional(),
  priority_reason: z.string().nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  draft_import_id: z.uuid().nullable().optional(),
  no_spec_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_share: z.unknown().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketsInput = z.strictObject({
  number: z.string().optional(),
  kind_id: z.uuid().optional(),
  stage_id: z.uuid().optional(),
  title: z.string().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  completed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  completed_by: z.uuid().nullable().optional(),
  delegated_to_clone: z.boolean().optional(),
  client_id: z.uuid().nullable().optional(),
  parent_ticket_id: z.uuid().nullable().optional(),
  derived_from_ticket_id: z.uuid().nullable().optional(),
  start_on: z.iso.date().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  priority: z.string().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  work_type_id: z.uuid().nullable().optional(),
  work_type_version: z.number().int().nullable().optional(),
  hold_reason: z.string().nullable().optional(),
  resume_condition: z.string().nullable().optional(),
  priority_reason: z.string().nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
  draft_import_id: z.uuid().nullable().optional(),
  no_spec_reason: z.string().nullable().optional(),
});
export const TicketSections = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_key: z.string().optional(),
  position: z.number().int().optional(),
  body: z.unknown().optional(),
  version: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketSectionsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_key: z.string().optional(),
  position: z.number().int().optional(),
  body: z.unknown().optional(),
});
export const TicketSectionVersions = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_id: z.uuid().optional(),
  version: z.number().int().optional(),
  body: z.unknown().optional(),
  edited_by: z.uuid().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).optional(),
  edited_by_clone: z.boolean().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  restored_from: z.number().int().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketSectionVersionsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_id: z.uuid().optional(),
  body: z.unknown().optional(),
  edited_by: z.uuid().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).optional(),
  edited_by_clone: z.boolean().optional(),
});
export const TicketKinds = z.strictObject({
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
  is_builtin: z.boolean().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  body_template: z.unknown().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  description: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketKindsInput = z.strictObject({
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
  is_builtin: z.boolean().optional(),
});
export const KindSections = z.strictObject({
  kind_id: z.uuid().optional(),
  section_key: z.string().optional(),
  label: z.string().optional(),
  mode: z.string().optional(),
  position: z.number().int().optional(),
  default_test_specs: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_visible: z.boolean().optional(),
  content_type: z.string().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  hint: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  used_for_acceptance: z.boolean().optional(),
});
export const KindSectionsInput = z.strictObject({
  kind_id: z.uuid().optional(),
  section_key: z.string().optional(),
  label: z.string().optional(),
  mode: z.string().optional(),
  position: z.number().int().optional(),
  default_test_specs: z.unknown().nullable().optional(),
});
export const TicketStages = z.strictObject({
  name: z.string().optional(),
  position: z.number().int().optional(),
  is_fixed: z.boolean().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  key: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketStagesInput = z.strictObject({
  name: z.string().optional(),
  position: z.number().int().optional(),
  is_fixed: z.boolean().optional(),
});
export const ClassAxes = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  is_builtin: z.boolean().optional(),
  position: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClassAxesInput = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  is_builtin: z.boolean().optional(),
  position: z.number().int().optional(),
});
export const ClassValues = z.strictObject({
  axis_id: z.uuid().optional(),
  label: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClassValuesInput = z.strictObject({
  axis_id: z.uuid().optional(),
  label: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
});
export const TicketClassValues = z.strictObject({
  ticket_id: z.uuid().optional(),
  value_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketClassValuesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  value_id: z.uuid().optional(),
});
export const CustomFields = z.strictObject({
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.unknown().optional(),
  position: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const CustomFieldsInput = z.strictObject({
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.unknown().optional(),
  position: z.number().int().optional(),
});
export const CustomFieldKinds = z.strictObject({
  field_id: z.uuid().optional(),
  kind_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const CustomFieldKindsInput = z.strictObject({
  field_id: z.uuid().optional(),
  kind_id: z.uuid().optional(),
});
export const TicketFieldValues = z.strictObject({
  ticket_id: z.uuid().optional(),
  field_id: z.uuid().optional(),
  value: z.unknown().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketFieldValuesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  field_id: z.uuid().optional(),
  value: z.unknown().optional(),
});
export const HandoverRules = z.strictObject({
  target: z.string().optional(),
  axis_id: z.uuid().nullable().optional(),
  mode: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const HandoverRulesInput = z.strictObject({
  target: z.string().optional(),
  axis_id: z.uuid().nullable().optional(),
  mode: z.string().optional(),
});
export const TestSpecs = z.strictObject({
  ticket_id: z.uuid().optional(),
  check_kind: z.string().nullable().optional(),
  title: z.string().optional(),
  judge_type: z.string().nullable().optional(),
  params: z.unknown().optional(),
  version: z.number().int().optional(),
  off_reason: z.string().nullable().optional(),
  checked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
  checked_by_ai: z.boolean().optional(),
  source: z.string().optional(),
  source_ref_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TestSpecsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  check_kind: z.string().nullable().optional(),
  title: z.string().optional(),
  judge_type: z.string().nullable().optional(),
  params: z.unknown().optional(),
  off_reason: z.string().nullable().optional(),
  checked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
  checked_by_ai: z.boolean().optional(),
  source: z.string().optional(),
  source_ref_id: z.uuid().nullable().optional(),
});
export const Checks = z.strictObject({
  ticket_id: z.uuid().optional(),
  test_spec_id: z.uuid().optional(),
  spec_version: z.number().int().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  attempt: z.number().int().optional(),
  result: z.string().optional(),
  evidence: z.unknown().optional(),
  runner: z.string().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ChecksInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  test_spec_id: z.uuid().optional(),
  spec_version: z.number().int().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  attempt: z.number().int().optional(),
  result: z.string().optional(),
  evidence: z.unknown().optional(),
  runner: z.string().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
});
export const TicketDecisions = z.strictObject({
  ticket_id: z.uuid().optional(),
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).optional(),
  source_message_id: z.uuid().nullable().optional(),
  superseded_by_id: z.uuid().nullable().optional(),
  promoted_to: z.string().optional(),
  decided_note: z.string().nullable().optional(),
  cancelled_at: z.iso.datetime({ offset: true }).nullable().optional(),
  cancelled_by: z.uuid().nullable().optional(),
  cancel_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketDecisionsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).optional(),
  source_message_id: z.uuid().nullable().optional(),
  superseded_by_id: z.uuid().nullable().optional(),
  promoted_to: z.string().optional(),
  decided_note: z.string().nullable().optional(),
  cancelled_at: z.iso.datetime({ offset: true }).nullable().optional(),
  cancelled_by: z.uuid().nullable().optional(),
  cancel_reason: z.string().nullable().optional(),
});
export const TicketMessages = z.strictObject({
  ticket_id: z.uuid().optional(),
  author_member_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
  body: z.string().nullable().optional(),
  mentions: z.array(z.uuid()).optional(),
  changes: z.unknown().nullable().optional(),
  quote_of_id: z.uuid().nullable().optional(),
  reactions: z.unknown().optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  quote_text: z.string().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketMessagesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  author_member_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
  body: z.string().nullable().optional(),
  mentions: z.array(z.uuid()).optional(),
  changes: z.unknown().nullable().optional(),
  quote_of_id: z.uuid().nullable().optional(),
  reactions: z.unknown().optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  quote_text: z.string().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
});
export const ReferenceLogs = z.strictObject({
  ticket_id: z.uuid().optional(),
  action_run_id: z.uuid().nullable().optional(),
  ref_type: z.string().optional(),
  ref_id: z.uuid().nullable().optional(),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  seen_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ReferenceLogsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  action_run_id: z.uuid().nullable().optional(),
  ref_type: z.string().optional(),
  ref_id: z.uuid().nullable().optional(),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  seen_at: z.iso.datetime({ offset: true }).optional(),
});
export const KnowledgePages = z.strictObject({
  is_personal: z.boolean().optional(),
  parent_page_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  owner_member_id: z.uuid().optional(),
  state: z.string().optional(),
  verify_interval_days: z.number().int().nullable().optional(),
  verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  verify_due_on: z.iso.date().nullable().optional(),
  topics: z.array(z.string()).optional(),
  current_version: z.number().int().optional(),
  form: z.string().optional(),
  archived_at: z.iso.datetime({ offset: true }).nullable().optional(),
  archived_to_page_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgePagesInput = z.strictObject({
  is_personal: z.boolean().optional(),
  parent_page_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  owner_member_id: z.uuid().optional(),
  state: z.string().optional(),
  verify_interval_days: z.number().int().nullable().optional(),
  verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  verify_due_on: z.iso.date().nullable().optional(),
  topics: z.array(z.string()).optional(),
  current_version: z.number().int().optional(),
  form: z.string().optional(),
  archived_at: z.iso.datetime({ offset: true }).nullable().optional(),
  archived_to_page_id: z.uuid().nullable().optional(),
});
export const KnowledgePageVersions = z.strictObject({
  page_id: z.uuid().optional(),
  version: z.number().int().optional(),
  kind: z.string().optional(),
  body: z.unknown().optional(),
  note: z.string().nullable().optional(),
  author_member_id: z.uuid().nullable().optional(),
  proposed_from_ticket_id: z.uuid().nullable().optional(),
  proposed_by_clone: z.boolean().optional(),
  decision: z.string().nullable().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
  published_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgePageVersionsInput = z.strictObject({
  page_id: z.uuid().optional(),
  kind: z.string().optional(),
  body: z.unknown().optional(),
  note: z.string().nullable().optional(),
  author_member_id: z.uuid().nullable().optional(),
  proposed_from_ticket_id: z.uuid().nullable().optional(),
  proposed_by_clone: z.boolean().optional(),
  decision: z.string().nullable().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
  published_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const KnowledgeLinks = z.strictObject({
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  unlinked_mentions: z.array(z.unknown()).optional(),
});
export const KnowledgeLinksInput = z.strictObject({
  from_page_id: z.uuid().optional(),
  to_type: z.string().optional(),
  to_id: z.uuid().optional(),
  anchor: z.string().nullable().optional(),
});
export const Clients = z.strictObject({
  name: z.string().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  visibility: z.string().optional(),
  default_share: z.unknown().optional(),
  routing: z.string().nullable().optional(),
  email_domain: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientsInput = z.strictObject({
  name: z.string().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  visibility: z.string().optional(),
  default_share: z.unknown().optional(),
  routing: z.string().nullable().optional(),
  email_domain: z.string().nullable().optional(),
});
export const ClientGroups = z.strictObject({
  client_id: z.uuid().optional(),
  scope_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientGroupsInput = z.strictObject({
  client_id: z.uuid().optional(),
});
export const ClientContacts = z.strictObject({
  client_id: z.uuid().optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  role: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  cc_role: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientContactsInput = z.strictObject({
  client_id: z.uuid().optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  role: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  cc_role: z.string().optional(),
});
export const ClientRequests = z.strictObject({
  client_id: z.uuid().optional(),
  contact_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  body: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  state: z.string().optional(),
  ticket_id: z.uuid().nullable().optional(),
  routed_scope_id: z.uuid().nullable().optional(),
  questions: z.unknown().optional(),
  decline_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientRequestsInput = z.strictObject({
  client_id: z.uuid().optional(),
  contact_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  body: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  state: z.string().optional(),
  ticket_id: z.uuid().nullable().optional(),
  routed_scope_id: z.uuid().nullable().optional(),
  questions: z.unknown().optional(),
  decline_reason: z.string().nullable().optional(),
});
export const Acceptances = z.strictObject({
  ticket_id: z.uuid().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  contact_id: z.uuid().optional(),
  due_on: z.iso.date().nullable().optional(),
  message: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reminded_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AcceptancesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  contact_id: z.uuid().optional(),
  due_on: z.iso.date().nullable().optional(),
  message: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reminded_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const TenantMemberships = z.strictObject({
  auth_user_id: z.string().nullable().optional(),
  member_id: z.uuid().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  joined_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TenantMembershipsInput = z.strictObject({
  auth_user_id: z.string().nullable().optional(),
  member_id: z.uuid().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  joined_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const TermsVersions = z.strictObject({
  kind: z.string().optional(),
  version: z.string().optional(),
  url: z.string().optional(),
  published_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TermsVersionsInput = z.strictObject({
  kind: z.string().optional(),
  url: z.string().optional(),
  published_at: z.iso.datetime({ offset: true }).optional(),
});
export const TermsConsents = z.strictObject({
  member_id: z.uuid().optional(),
  auth_user_id: z.string().nullable().optional(),
  terms_version_id: z.uuid().optional(),
  agreed_at: z.iso.datetime({ offset: true }).optional(),
  ip: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TermsConsentsInput = z.strictObject({
  member_id: z.uuid().optional(),
  auth_user_id: z.string().nullable().optional(),
  terms_version_id: z.uuid().optional(),
  agreed_at: z.iso.datetime({ offset: true }).optional(),
  ip: z.string().nullable().optional(),
});
export const Passkeys = z.strictObject({
  auth_user_id: z.uuid().optional(),
  credential_id: z.uuid().optional(),
  public_key: z.string().optional(),
  name: z.string().optional(),
  transports: z.string().optional(),
  last_used_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const PasskeysInput = z.strictObject({
  auth_user_id: z.uuid().optional(),
  credential_id: z.uuid().optional(),
  public_key: z.string().optional(),
  name: z.string().optional(),
  transports: z.string().optional(),
  last_used_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).optional(),
});
export const Operations = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  kind: z.string().optional(),
  current_version: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const OperationsInput = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  kind: z.string().optional(),
  current_version: z.number().int().optional(),
});
export const TicketLinks = z.strictObject({
  from_ticket_id: z.uuid().optional(),
  to_ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketLinksInput = z.strictObject({
  from_ticket_id: z.uuid().optional(),
  to_ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
});
export const TicketHandovers = z.strictObject({
  ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  from_member_id: z.uuid().optional(),
  to_member_id: z.uuid().nullable().optional(),
  to_scope_id: z.uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.iso.datetime({ offset: true }).nullable().optional(),
  switch: z.unknown().optional(),
  state: z.string().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketHandoversInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  from_member_id: z.uuid().optional(),
  to_member_id: z.uuid().nullable().optional(),
  to_scope_id: z.uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.iso.datetime({ offset: true }).nullable().optional(),
  switch: z.unknown().optional(),
  state: z.string().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const SavedViews = z.strictObject({
  member_id: z.uuid().optional(),
  name: z.string().optional(),
  share: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.unknown().optional(),
  columns: z.unknown().optional(),
  density: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SavedViewsInput = z.strictObject({
  member_id: z.uuid().optional(),
  name: z.string().optional(),
  share: z.string().optional(),
  filters: z.unknown().optional(),
  columns: z.unknown().optional(),
  density: z.string().optional(),
});
export const TicketImports = z.strictObject({
  uploaded_by: z.uuid().optional(),
  scope_id: z.uuid().optional(),
  source: z.string().optional(),
  mapping: z.unknown().optional(),
  rows: z.number().int().optional(),
  errors: z.unknown().optional(),
  state: z.string().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketImportsInput = z.strictObject({
  uploaded_by: z.uuid().optional(),
  source: z.string().optional(),
  mapping: z.unknown().optional(),
  rows: z.number().int().optional(),
  errors: z.unknown().optional(),
  state: z.string().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const LearningCandidates = z.strictObject({
  owner_member_id: z.uuid().optional(),
  trigger: z.string().optional(),
  proposed_as: z.string().optional(),
  text: z.string().optional(),
  evidence: z.unknown().optional(),
  check_result: z.unknown().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result_type: z.string().nullable().optional(),
  result_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LearningCandidatesInput = z.strictObject({
  owner_member_id: z.uuid().optional(),
  trigger: z.string().optional(),
  proposed_as: z.string().optional(),
  text: z.string().optional(),
  evidence: z.unknown().optional(),
  check_result: z.unknown().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result_type: z.string().nullable().optional(),
  result_id: z.uuid().nullable().optional(),
});
export const BridgePairingCodes = z.strictObject({
  member_id: z.uuid().optional(),
  code_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  used_session_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BridgePairingCodesInput = z.strictObject({
  member_id: z.uuid().optional(),
  code_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  used_session_id: z.uuid().nullable().optional(),
});
export const NotificationSettings = z.strictObject({
  email_digest: z.boolean().optional(),
  quiet_hours: z.record(z.string(), z.unknown()).optional(),
  paused_until: z.string().nullable().optional(),
  urgent_override: z.array(z.unknown()).optional(),
  events: z.array(z.unknown()).optional(),
});
export const NotificationSettingsInput = z.strictObject({
  member_id: z.uuid().optional(),
  email_digest: z.boolean().optional(),
  quiet_hours: z.unknown().optional(),
  paused_until: z.iso.datetime({ offset: true }).nullable().optional(),
  urgent_override: z.unknown().optional(),
});
export const OpsPlanProposals = z.strictObject({
  plan_id: z.uuid().optional(),
  from_version: z.number().int().nullable().optional(),
  to_version: z.number().int().nullable().optional(),
  changes: z.unknown().optional(),
  existing_policy: z.string().optional(),
  notice_days: z.number().int().nullable().optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().optional(),
  proposed_by: z.uuid().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  return_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const OpsPlanProposalsInput = z.strictObject({
  plan_id: z.uuid().optional(),
  from_version: z.number().int().nullable().optional(),
  to_version: z.number().int().nullable().optional(),
  changes: z.unknown().optional(),
  existing_policy: z.string().optional(),
  notice_days: z.number().int().nullable().optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().optional(),
  proposed_by: z.uuid().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  return_reason: z.string().nullable().optional(),
});
export const ScopeMemberships = z.strictObject({
  member_id: z.uuid().optional(),
  scope_id: z.uuid().optional(),
  is_primary: z.boolean().optional(),
  role: z.string().optional(),
  since: z.iso.date().optional(),
  changed_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ScopeMembershipsInput = z.strictObject({
  member_id: z.uuid().optional(),
  is_primary: z.boolean().optional(),
  role: z.string().optional(),
  since: z.iso.date().optional(),
  changed_by: z.uuid().nullable().optional(),
});
export const RoleBundleDefaults = z.strictObject({
  role: z.string().optional(),
  target_kind_id: z.string().optional(),
  ability_id: z.string().optional(),
  scope_kind: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const RoleBundleDefaultsInput = z.strictObject({
  role: z.string().optional(),
  target_kind_id: z.string().optional(),
  ability_id: z.string().optional(),
  scope_kind: z.string().optional(),
});
export const StepUpInput = z.strictObject({
  password: z.string().optional(),
  code: z.string().optional(),
  passkey: z.record(z.string(), z.unknown()).optional(),
});
export const PasskeyRenameInput = z.strictObject({
  name: z.string().optional(),
});
export const SignupInput = z.strictObject({
  email: z.string().optional(),
  name: z.string().optional(),
  company_name: z.string().optional(),
  password: z.string().optional(),
});
export const SignupResendInput = z.strictObject({

});
export const SignupVerifyInput = z.strictObject({
  token: z.string().optional(),
});
export const PasswordForgotInput = z.strictObject({
  email: z.string().optional(),
});
export const SignInInput = z.strictObject({
  email: z.string().optional(),
  password: z.string().optional(),
});
export const SignInCodeInput = z.strictObject({
  pending: z.string().optional(),
  code: z.string().nullable().optional(),
  backup_code: z.string().nullable().optional(),
});
export const SignOutInput = z.strictObject({

});
export const AdminRecoveryInput = z.strictObject({
  pending: z.string().optional(),
});
export const TwoFactorStartInput = z.strictObject({
  password: z.string().nullable().optional(),
});
export const TwoFactorConfirmInput = z.strictObject({
  code: z.string().optional(),
});
export const PasswordChangeInput = z.strictObject({
  current_password: z.string().optional(),
  new_password: z.string().optional(),
});
export const PasswordSetInput = z.strictObject({
  new_password: z.string().optional(),
});
export const PasswordResetInput = z.strictObject({
  token: z.string().optional(),
  new_password: z.string().optional(),
});
export const TermsConsentInput = z.strictObject({
  agree: z.boolean().optional(),
  terms_version_id: z.uuid().optional(),
  privacy_version_id: z.uuid().optional(),
});
export const PairingCodeInput = z.strictObject({

});
export const BridgeClaimInput = z.strictObject({
  code: z.string().optional(),
  device_label: z.string().optional(),
  machine_id: z.uuid().nullable().optional(),
});
export const BridgeHeartbeatInput = z.strictObject({
  health: z.unknown().optional(),
  protocol: z.unknown().optional(),
  version: z.string().optional(),
});
export const TicketCreateInput = z.strictObject({
  scope_id: z.uuid().optional(),
  kind_id: z.uuid().optional(),
  title: z.string().optional(),
  assignee_member_id: z.uuid().optional(),
  due_on: z.string().optional(),
  start_on: z.string().optional(),
  priority: z.string().optional(),
  priority_reason: z.string().optional(),
  parent_ticket_id: z.uuid().optional(),
  estimate_minutes: z.unknown().nullable().optional(),
  sections: z.record(z.string(), z.unknown()).optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  draft_id: z.uuid().optional(),
  source_draft_id: z.uuid().optional(),
});
export const TicketDraftInput = z.strictObject({
  draft_id: z.uuid().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  discard: z.boolean().optional(),
});
export const DismissSetupTasksInput = z.strictObject({
  key: z.string().optional(),
});
export const TicketDelegateInput = z.strictObject({
  no_spec_reason: z.string().optional(),
});
export const BridgeTakeInput = z.strictObject({
  wait_sec: z.number().int().optional(),
  protocol: z.number().int().optional(),
  idle: z.boolean().optional(),
});
export const BridgeProgressInput = z.strictObject({
  seq: z.number().int().optional(),
  kind: z.string().optional(),
  text: z.string().optional(),
  agent_session_id: z.uuid().optional(),
  model: z.string().optional(),
  tool: z.unknown().optional(),
  usage: z.unknown().optional(),
  todos: z.unknown().optional(),
  windows: z.unknown().optional(),
  blocked: z.unknown().optional(),
});
export const BridgeFinishInput = z.strictObject({
  state: z.string().optional(),
  result: z.string().optional(),
  reason: z.string().optional(),
  agent_session_id: z.uuid().optional(),
});
export const BridgeToolInput = z.strictObject({
  input: z.unknown().optional(),
});
export const ApprovalApproveInput = z.strictObject({

});
export const ApprovalReturnInput = z.strictObject({
  note: z.string().optional(),
});
export const InvitationAcceptInput = z.strictObject({
  name: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
});
export const TicketCompleteInput = z.strictObject({
  todo_checked: z.array(z.unknown()).nullable().optional(),
  todo_version: z.number().int().nullable().optional(),
  conditions_confirmed: z.boolean().optional(),
});
export const InvitationResendInput = z.strictObject({

});
export const CredentialCreateInput = z.strictObject({
  layer: z.string().optional(),
  kind: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  login: z.string().optional(),
  password: z.string().optional(),
  value: z.string().optional(),
  two_factor: z.string().optional(),
  totp_secret: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  expires_on: z.string().nullable().optional(),
});
export const CredentialUpdateInput = z.strictObject({
  login: z.string().optional(),
  password: z.string().optional(),
  value: z.string().optional(),
  two_factor: z.string().optional(),
  totp_secret: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  expires_on: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  reason: z.string().optional(),
});
export const CredentialResolveInput = z.strictObject({
  job_id: z.uuid().optional(),
  credential_id: z.uuid().optional(),
  destination: z.string().optional(),
  executor_key: z.string().optional(),
});
export const CredentialLoginCheckInput = z.strictObject({

});
export const CredentialLoginAnswerInput = z.strictObject({
  request_ref: z.string().optional(),
  code: z.string().optional(),
  approved: z.boolean().optional(),
});
export const CredentialCheckReportInput = z.strictObject({
  job_id: z.uuid().optional(),
  state: z.string().optional(),
  detail: z.string().optional(),
  request_ref: z.string().optional(),
  ask_kind: z.string().optional(),
  text: z.string().optional(),
});
export const DeviceBrowserInput = z.strictObject({
  browser: z.string().optional(),
});
export const DeviceBrowserCheckInput = z.strictObject({

});
export const BridgeBrowserInput = z.strictObject({
  browser: z.string().optional(),
});
export const TicketTimelineSeenInput = z.strictObject({
  seen_at: z.string().nullable().optional(),
});
export const TicketMessageInput = z.strictObject({
  body: z.string().optional(),
  mention_member_ids: z.array(z.uuid()).optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  quote_of_id: z.uuid().nullable().optional(),
  stage_key: z.string().optional(),
  stage_id: z.uuid().optional(),
  hold_reason: z.string().optional(),
  resume_condition: z.string().optional(),
});
export const TicketMessageEditInput = z.strictObject({
  body: z.string().optional(),
  mention_member_ids: z.array(z.uuid()).optional(),
});
export const TicketMessageStarInput = z.strictObject({

});
export const TicketUpdateInput = z.strictObject({
  stage_id: z.uuid().optional(),
  stage_key: z.string().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  hold_reason: z.string().optional(),
  resume_condition: z.string().optional(),
});
export const TicketDecisionInput = z.strictObject({
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by_member_id: z.uuid().nullable().optional(),
  decided_note: z.string().nullable().optional(),
  source_message_id: z.uuid().nullable().optional(),
  promoted_to: z.string().nullable().optional(),
});
export const TicketDecisionUpdateInput = z.strictObject({
  action: z.string().optional(),
  text: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const InvitationsCreateInput = z.strictObject({
  emails: z.array(z.string()).optional(),
  scope_id: z.uuid().optional(),
  role_key: z.string().optional(),
  message: z.string().nullable().optional(),
});
export const InvitationLinkCreateInput = z.strictObject({
  scope_id: z.uuid().optional(),
  role_key: z.string().optional(),
});
export const TicketBodyInput = z.strictObject({
  version: z.number().int().optional(),
  doc: z.record(z.string(), z.unknown()).optional(),
});
export const TestSpecCreateInput = z.strictObject({
  title: z.string().optional(),
});
export const TestSpecUpdateInput = z.strictObject({
  version: z.number().int().optional(),
  checked: z.boolean().optional(),
  title: z.string().optional(),
});
export const TicketLinkInput = z.strictObject({
  other_ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
});
export const SavedViewInput = z.strictObject({
  name: z.string().optional(),
  share: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  density: z.string().optional(),
});
export const ActionRunTakeoverInput = z.strictObject({

});
export const ScopeOverview = z.strictObject({
  by_stage: z.array(z.unknown()).optional(),
  milestones: z.array(z.unknown()).optional(),
  recent: z.array(z.unknown()).optional(),
  total: z.number().int().optional(),
});
export const TicketKindChangePreview = z.strictObject({
  added_sections: z.array(z.unknown()).optional(),
  removed_sections: z.array(z.unknown()).optional(),
  moved_to_body: z.array(z.unknown()).optional(),
  checks_reset: z.boolean().optional(),
});
export const TicketDeletePreview = z.strictObject({
  children: z.number().int().optional(),
  descendants: z.number().int().optional(),
  attachments: z.number().int().optional(),
  artifacts: z.number().int().optional(),
  pending_approvals: z.number().int().optional(),
  links: z.number().int().optional(),
  running_runs: z.number().int().optional(),
  descendant_pending_approvals: z.number().int().optional(),
  descendant_running_runs: z.number().int().optional(),
  restorable_until: z.string().optional(),
});
export const SearchHit = z.strictObject({
  kind: z.string().optional(),
  id: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  url: z.string().optional(),
});
export const TimelineItem = z.strictObject({
  id: z.string().optional(),
  kind: z.string().optional(),
  at: z.string().optional(),
  actor: z.record(z.string(), z.unknown()).nullable().optional(),
  message: z.record(z.string(), z.unknown()).nullable().optional(),
  changes: z.array(z.unknown()).nullable().optional(),
  run: z.record(z.string(), z.unknown()).nullable().optional(),
  deleted: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TestSpecLint = z.strictObject({
  missing: z.array(z.unknown()).optional(),
  warnings: z.array(z.unknown()).optional(),
});
export const TicketCompletion = z.strictObject({
  ticket: z.record(z.string(), z.unknown()).optional(),
  knowledge_candidates: z.array(z.unknown()).optional(),
  skipped_reason: z.string().optional(),
  unchecked: z.record(z.string(), z.unknown()).optional(),
});
export const BulkResult = z.strictObject({
  updated: z.array(z.unknown()).optional(),
  skipped: z.array(z.unknown()).optional(),
});
export const ApprovalQueueItem = z.strictObject({
  kind: z.string().optional(),
  id: z.string().optional(),
  ticket_id: z.string().nullable().optional(),
  ticket_number: z.string().optional(),
  title: z.string().optional(),
  from_member_id: z.string().optional(),
  from_name: z.string().optional(),
  check_summary: z.string().optional(),
  due_on: z.string().nullable().optional(),
  decide_inline: z.boolean().optional(),
  irreversible: z.boolean().optional(),
  primary_action: z.string().optional(),
  secondary_action: z.string().optional(),
  note: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export const ApprovalDetail = z.strictObject({
  approval: z.record(z.string(), z.unknown()).optional(),
  ticket: z.record(z.string(), z.unknown()).optional(),
  operation: z.record(z.string(), z.unknown()).optional(),
  message_text: z.string().optional(),
  artifact_version: z.record(z.string(), z.unknown()).optional(),
  checks: z.array(z.unknown()).optional(),
  check_summary: z.string().optional(),
  cautions: z.array(z.unknown()).optional(),
  irreversible: z.boolean().optional(),
  can_decide: z.boolean().optional(),
  chain: z.array(z.unknown()).optional(),
});
export const BulkApprovalPreview = z.strictObject({
  eligible: z.array(z.unknown()).optional(),
  excluded: z.array(z.unknown()).optional(),
});
export const CloneNow = z.strictObject({
  pc: z.record(z.string(), z.unknown()).optional(),
  current: z.record(z.string(), z.unknown()).nullable().optional(),
  next: z.array(z.unknown()).optional(),
  waiting_approvals: z.number().int().optional(),
  stopped: z.number().int().optional(),
});
export const CloneGrowth = z.strictObject({
  delegated: z.number().int().optional(),
  passed_without_edit_rate: z.number().optional(),
  saved_hours: z.number().optional(),
  trend: z.array(z.unknown()).optional(),
  often_fixed: z.array(z.unknown()).optional(),
});
export const KnowsCounts = z.strictObject({
  rules: z.number().int().optional(),
  work_types: z.number().int().optional(),
  memories: z.number().int().optional(),
  candidates: z.number().int().optional(),
});
export const ActivityItem = z.strictObject({
  kind: z.string().optional(),
  at: z.string().optional(),
  title: z.string().optional(),
  ticket_id: z.string().nullable().optional(),
  used: z.array(z.unknown()).optional(),
  result: z.string().optional(),
});
export const SignupCreated = z.strictObject({
  email: z.string().optional(),
  sent: z.boolean().optional(),
  mail_error: z.string().nullable().optional(),
  mail_error_kind: z.string().nullable().optional(),
  expires_at: z.string().optional(),
  signup_token: z.string().optional(),
});
export const SignupResent = z.strictObject({
  email: z.string().nullable().optional(),
  sent: z.boolean().optional(),
  mail_error: z.string().nullable().optional(),
  mail_error_kind: z.string().nullable().optional(),
  pending: z.boolean().optional(),
  registered: z.boolean().optional(),
  expired: z.boolean().optional(),
});
export const SignupStatus = z.strictObject({
  state: z.string().optional(),
  email: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});
export const SignupVerified = z.strictObject({
  email: z.string().optional(),
  token: z.string().nullable().optional(),
  signed_in: z.boolean().optional(),
  terms_pending: z.boolean().optional(),
});
export const PasswordForgotAccepted = z.strictObject({
  accepted: z.boolean().optional(),
});
export const SignInResult = z.strictObject({
  token: z.string().nullable().optional(),
  two_factor: z.boolean().optional(),
  pending: z.string().nullable().optional(),
});
export const SignInCodeResult = z.strictObject({
  token: z.string().optional(),
  backup_codes_left: z.number().int().optional(),
});
export const SignedOut = z.strictObject({
  signed_out: z.boolean().optional(),
});
export const AdminRecoveryResult = z.strictObject({
  result: z.string().optional(),
});
export const PasswordResetDone = z.strictObject({
  reset: z.boolean().optional(),
});
export const CurrentTerms = z.strictObject({
  id: z.string().optional(),
  kind: z.string().optional(),
  version: z.string().optional(),
  url: z.string().optional(),
  published_at: z.string().optional(),
});
export const TermsConsented = z.strictObject({
  consented: z.boolean().optional(),
});
export const ConversationCreated = z.strictObject({
  id: z.uuid().optional(),
  conversation_id: z.uuid().optional(),
});
export const ConversationUpdated = z.strictObject({
  id: z.uuid().optional(),
  ok: z.boolean().optional(),
});
export const MemoryUpdated = z.strictObject({
  id: z.uuid().optional(),
  ok: z.boolean().optional(),
});
export const MySecurity = z.strictObject({
  passkeys: z.array(z.unknown()).optional(),
  has_password: z.boolean().optional(),
  two_factor: z.boolean().optional(),
  two_factor_required: z.boolean().optional(),
  backup_codes_left: z.number().int().nullable().optional(),
  mfa_pending: z.boolean().optional(),
});
export const TwoFactorSetup = z.strictObject({
  otpauth_uri: z.string().optional(),
  secret: z.string().optional(),
});
export const TwoFactorEnabled = z.strictObject({
  backup_codes: z.array(z.string()).optional(),
  token: z.string().nullable().optional(),
});
export const BackupCodes = z.strictObject({
  codes: z.array(z.unknown()).optional(),
});
export const StepUp = z.strictObject({
  step_up_at: z.string().optional(),
  valid_until: z.string().optional(),
});
export const PasswordChanged = z.strictObject({
  revoked: z.number().int().optional(),
});
export const PasswordSet = z.strictObject({
  ok: z.boolean().optional(),
});
export const Me = z.strictObject({
  member: z.record(z.string(), z.unknown()).optional(),
  workspaces: z.array(z.unknown()).optional(),
  workspace_name: z.string().nullable().optional(),
});
export const MyUsage = z.strictObject({
  five_hour: z.record(z.string(), z.unknown()).optional(),
  month: z.record(z.string(), z.unknown()).optional(),
  by_workspace: z.array(z.unknown()).optional(),
  notify_at_percent: z.number().int().optional(),
  on_exhausted: z.string().optional(),
});
export const SetupTask = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  desc: z.string().optional(),
  done: z.boolean().optional(),
  href: z.string().nullable().optional(),
  available: z.boolean().optional(),
  optional: z.boolean().optional(),
  skipped: z.boolean().optional(),
});
export const SetupTasksDismissed = z.strictObject({
  dismissed: z.boolean().optional(),
  skipped: z.array(z.string()).optional(),
});
export const PairingCode = z.strictObject({
  code: z.string().optional(),
  expires_at: z.string().optional(),
});
export const BridgeRelease = z.strictObject({
  released: z.boolean().optional(),
  version: z.string().optional(),
  released_at: z.string().optional(),
  update: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const BridgeClaim = z.strictObject({
  device_token: z.string().optional(),
  device_id: z.string().optional(),
  member_id: z.string().optional(),
  device_label: z.string().optional(),
});
export const BridgeReleaseLink = z.strictObject({
  url: z.string().optional(),
  expires_at: z.string().optional(),
});
export const BridgeHeartbeat = z.strictObject({
  ok: z.boolean().optional(),
  browser: z.string().nullable().optional(),
  outdated: z.boolean().optional(),
  device_id: z.string().optional(),
});
export const BridgeDevice = z.strictObject({
  id: z.string().optional(),
  device_label: z.string().nullable().optional(),
  state: z.string().optional(),
  last_seen_at: z.string().nullable().optional(),
  connected_at: z.string().optional(),
  version: z.string().nullable().optional(),
  health: z.array(z.unknown()).optional(),
  health_at: z.string().nullable().optional(),
  browser: z.string().optional(),
  revoke_reason: z.string().nullable().optional(),
});
export const TicketDetail = z.strictObject({
  ticket: z.record(z.string(), z.unknown()).optional(),
  sections: z.array(z.unknown()).optional(),
  kind: z.record(z.string(), z.unknown()).nullable().optional(),
  stage: z.record(z.string(), z.unknown()).nullable().optional(),
  assignee: z.record(z.string(), z.unknown()).nullable().optional(),
  can: z.record(z.string(), z.unknown()).optional(),
  approval: z.record(z.string(), z.unknown()).nullable().optional(),
  completed: z.record(z.string(), z.unknown()).nullable().optional(),
  time: z.record(z.string(), z.unknown()).optional(),
  hold: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketKindChoice = z.strictObject({
  id: z.string().optional(),
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
  is_builtin: z.boolean().optional(),
  sections: z.array(z.unknown()).optional(),
});
export const TicketDraft = z.strictObject({
  draft_id: z.string().optional(),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  saved_at: z.string().nullable().optional(),
});
export const BridgeJob = z.strictObject({
  job: z.record(z.string(), z.unknown()).nullable().optional(),
  forbidden_domains: z.array(z.unknown()).optional(),
  next_ms: z.number().int().optional(),
  outdated: z.boolean().optional(),
});
export const JobControl = z.strictObject({
  stop: z.boolean().optional(),
  reason: z.string().nullable().optional(),
  steers: z.array(z.unknown()).optional(),
});
export const TicketDelegation = z.strictObject({
  run_id: z.string().optional(),
  job_id: z.string().optional(),
  status: z.string().optional(),
  pc: z.string().optional(),
});
export const ApprovalDecided = z.strictObject({
  id: z.string().optional(),
  decision: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  status_id: z.string().nullable().optional(),
  ticket_id: z.string().nullable().optional(),
  run_id: z.string().optional(),
  pc: z.string().optional(),
});
export const BridgeFinish = z.strictObject({
  ok: z.boolean().optional(),
  outcome: z.string().optional(),
});
export const BridgeToolResult = z.strictObject({
  result: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const ActionRunView = z.strictObject({
  id: z.string().optional(),
  ticket_id: z.string().optional(),
  phase: z.string().optional(),
  status: z.string().optional(),
  by: z.record(z.string(), z.unknown()).optional(),
  pc: z.string().optional(),
  silent: z.boolean().optional(),
  last_event_at: z.string().nullable().optional(),
  progress: z.string().nullable().optional(),
  stopped_reason: z.string().nullable().optional(),
  return_reason: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  taken_over_at: z.string().nullable().optional(),
  reason_kind: z.string().nullable().optional(),
  checks: z.record(z.string(), z.unknown()).optional(),
});
export const ResolvedCredential = z.strictObject({
  credential_id: z.uuid().optional(),
  kind: z.string().optional(),
  name: z.string().optional(),
  destinations: z.array(z.unknown()).optional(),
  two_factor: z.string().optional(),
  expires_at: z.string().nullable().optional(),
  server_key: z.string().optional(),
  iv: z.string().optional(),
  tag: z.string().optional(),
  ciphertext_for_executor: z.string().optional(),
});
export const WorkTypeUploadCheck = z.strictObject({
  package: z.record(z.string(), z.unknown()).optional(),
  checks: z.array(z.unknown()).optional(),
  passed: z.boolean().optional(),
  test_scenarios: z.number().int().optional(),
  changelog: z.string().nullable().optional(),
});
export const PlanProposalImpact = z.strictObject({
  tenants: z.number().int().optional(),
  monthly_revenue_diff: z.number().int().optional(),
  existing_from: z.string().optional(),
  new_from: z.string().nullable().optional(),
  by_workspace: z.array(z.unknown()).optional(),
});
export const RuleCheck = z.strictObject({
  conflicts: z.array(z.unknown()).optional(),
  similar: z.array(z.unknown()).optional(),
  needs_approval_from: z.string().optional(),
  warnings: z.array(z.unknown()).optional(),
});
export const WorkspaceMembers = z.strictObject({
  groups: z.array(z.unknown()).optional(),
  invitations: z.array(z.unknown()).optional(),
  alerts: z.array(z.unknown()).optional(),
  count: z.number().int().optional(),
});
export const InvitationLink = z.strictObject({
  url: z.string().optional(),
  expires_at: z.string().optional(),
});
export const MemberDetail = z.strictObject({
  member: z.record(z.string(), z.unknown()).optional(),
  groups: z.array(z.unknown()).optional(),
  role_bundle: z.record(z.string(), z.unknown()).optional(),
  granted: z.array(z.unknown()).optional(),
  revoked: z.array(z.unknown()).optional(),
  assigned: z.record(z.string(), z.unknown()).optional(),
  clone: z.record(z.string(), z.unknown()).optional(),
  login: z.record(z.string(), z.unknown()).optional(),
  recent_events: z.array(z.unknown()).optional(),
});
export const MemberRemovalPreview = z.strictObject({
  tickets: z.array(z.unknown()).optional(),
  handovers_cancelled: z.array(z.unknown()).optional(),
  approvals_reassigned: z.array(z.unknown()).optional(),
  sole_approver: z.array(z.unknown()).optional(),
  deleted: z.array(z.unknown()).optional(),
  kept: z.array(z.unknown()).optional(),
  restorable_until: z.string().optional(),
});
export const WorkspaceRules = z.strictObject({
  rules: z.array(z.unknown()).optional(),
  rules_by_layer: z.array(z.unknown()).optional(),
  escalations: z.array(z.unknown()).optional(),
  work_types: z.array(z.unknown()).optional(),
});
export const EscalationPreview = z.strictObject({
  matched_last_month: z.number().int().optional(),
  examples: z.array(z.unknown()).optional(),
});
export const ExportStatus = z.strictObject({
  status: z.string().optional(),
  url: z.string().optional(),
  expires_at: z.string().nullable().optional(),
});
export const WorkspaceSettings = z.strictObject({
  workspace: z.record(z.string(), z.unknown()).optional(),
  plan: z.record(z.string(), z.unknown()).optional(),
  subscription: z.record(z.string(), z.unknown()).optional(),
  price_change: z.record(z.string(), z.unknown()).optional(),
  permissions: z.array(z.unknown()).optional(),
  fixed_rules: z.array(z.unknown()).optional(),
  deletion: z.record(z.string(), z.unknown()).optional(),
});
export const PlanChoice = z.strictObject({
  plan_id: z.string().optional(),
  name: z.string().nullable().optional(),
  price_monthly: z.number().int().nullable().optional(),
  limits: z.record(z.string(), z.unknown()).nullable().optional(),
  current: z.boolean().optional(),
  can_choose: z.boolean().optional(),
  reason: z.string().optional(),
  effective_from: z.string().optional(),
});
export const Billing = z.strictObject({
  payee: z.record(z.string(), z.unknown()).optional(),
  billing_contact: z.record(z.string(), z.unknown()).optional(),
  terms: z.string().optional(),
  invoices: z.array(z.unknown()).optional(),
});
export const SignedUrl = z.strictObject({
  url: z.string().optional(),
  expires_at: z.string().optional(),
});
export const ClientRow = z.strictObject({
  id: z.string().optional(),
  name: z.string().optional(),
  summary: z.string().optional(),
  groups: z.array(z.unknown()).optional(),
  owner_member_id: z.string().nullable().optional(),
  visibility: z.string().optional(),
  active_tickets: z.number().int().optional(),
  open_requests: z.number().int().optional(),
  waiting_acceptances: z.number().int().optional(),
  last_activity_at: z.string().optional(),
});
export const ClientLinkCandidate = z.strictObject({
  ticket_id: z.string().optional(),
  number: z.string().optional(),
  title: z.string().optional(),
  reason: z.string().optional(),
});
export const ClientDetail = z.strictObject({
  client: z.record(z.string(), z.unknown()).optional(),
  groups: z.array(z.unknown()).optional(),
  contacts: z.array(z.unknown()).optional(),
  todo: z.array(z.unknown()).optional(),
  rules: z.array(z.unknown()).optional(),
  knowledge: z.array(z.unknown()).optional(),
  counts: z.record(z.string(), z.unknown()).optional(),
});
export const ClientActivityItem = z.strictObject({
  at: z.string().optional(),
  actor: z.record(z.string(), z.unknown()).optional(),
  kind: z.string().optional(),
  text: z.string().optional(),
  ticket_id: z.string().optional(),
  client_visible: z.boolean().optional(),
});
export const PortalHome = z.strictObject({
  to_review: z.array(z.unknown()).optional(),
  requests: z.array(z.unknown()).optional(),
  tickets: z.array(z.unknown()).optional(),
});
export const ClientRequestDetail = z.strictObject({
  request: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
  ticket_draft: z.record(z.string(), z.unknown()).optional(),
  questions: z.array(z.unknown()).optional(),
  reply_draft: z.string().optional(),
  route_suggestion: z.record(z.string(), z.unknown()).optional(),
});
export const PortalQuestions = z.strictObject({
  available: z.boolean().optional(),
  questions: z.array(z.unknown()).optional(),
});
export const PortalRequest = z.strictObject({
  request: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
});
export const PortalTicket = z.strictObject({
  title: z.string().optional(),
  stage: z.string().optional(),
  due_on: z.string().nullable().optional(),
  artifacts: z.array(z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
  sections: z.array(z.unknown()).optional(),
});
export const PortalAcceptance = z.strictObject({
  acceptance: z.record(z.string(), z.unknown()).optional(),
  artifact: z.record(z.string(), z.unknown()).optional(),
  preview_url: z.string().optional(),
  message: z.string().nullable().optional(),
  due_on: z.string().nullable().optional(),
});
export const KnowledgeHome = z.strictObject({
  to_verify: z.array(z.unknown()).optional(),
  proposals: z.array(z.unknown()).optional(),
  recent: z.array(z.unknown()).optional(),
  popular: z.array(z.unknown()).optional(),
  count: z.number().int().optional(),
});
export const KnowledgeTree = z.strictObject({
  places: z.array(z.unknown()).optional(),
  topics: z.array(z.unknown()).optional(),
  archived: z.number().int().optional(),
});
export const KnowledgeAnswer = z.strictObject({
  mode: z.string().optional(),
  answer: z.string().optional(),
  citations: z.array(z.unknown()).optional(),
  hits: z.array(z.unknown()).optional(),
});
export const KnowledgePageDetail = z.strictObject({
  page: z.record(z.string(), z.unknown()).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  toc: z.array(z.unknown()).optional(),
  children: z.array(z.unknown()).optional(),
  backlinks: z.array(z.unknown()).optional(),
  related_rules: z.array(z.unknown()).optional(),
  proposal_marks: z.array(z.unknown()).optional(),
  draft: z.record(z.string(), z.unknown()).optional(),
});
export const KnowledgeUsage = z.strictObject({
  reads_3m: z.number().int().optional(),
  returns: z.number().int().optional(),
  recent_tickets: z.array(z.unknown()).optional(),
  hot_sections: z.array(z.unknown()).optional(),
});
export const KnowledgeLinkTarget = z.strictObject({
  kind: z.string().optional(),
  id: z.string().optional(),
  title: z.string().optional(),
  place: z.string().optional(),
});
export const KnowledgeVerification = z.strictObject({
  page_id: z.string().optional(),
  title: z.string().optional(),
  place: z.string().optional(),
  owner_member_id: z.string().optional(),
  due_on: z.string().optional(),
  interval: z.string().optional(),
  ai_check: z.string().optional(),
  suggested_action: z.string().optional(),
  newer_page_id: z.string().optional(),
});
export const KnowledgeImportPreview = z.strictObject({
  source: z.string().optional(),
  pages: z.number().int().optional(),
  folders: z.number().int().optional(),
  links: z.number().int().optional(),
  topics: z.number().int().optional(),
  images: z.number().int().optional(),
  mapping: z.record(z.string(), z.unknown()).optional(),
  warnings: z.array(z.unknown()).optional(),
});
export const OpsWorkspaceRow = z.strictObject({
  id: z.string().optional(),
  name: z.string().optional(),
  admin: z.record(z.string(), z.unknown()).optional(),
  plan: z.string().optional(),
  members: z.string().optional(),
  pc_connected: z.string().optional(),
  runs_month: z.number().int().optional(),
  attention: z.array(z.unknown()).optional(),
  billing: z.string().optional(),
  state: z.string().optional(),
});
export const OpsWorkspace = z.strictObject({
  workspace: z.record(z.string(), z.unknown()).optional(),
  pc: z.record(z.string(), z.unknown()).optional(),
  runs: z.record(z.string(), z.unknown()).optional(),
  stopped: z.record(z.string(), z.unknown()).optional(),
  files: z.record(z.string(), z.unknown()).optional(),
  stop_reasons: z.array(z.unknown()).optional(),
  recent: z.array(z.unknown()).optional(),
  info: z.record(z.string(), z.unknown()).optional(),
});
export const OpsWorkspaceMember = z.strictObject({
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  last_seen_at: z.string().optional(),
  pc: z.string().optional(),
  login: z.string().optional(),
});
export const OpsWorkspaceBilling = z.strictObject({
  plan: z.record(z.string(), z.unknown()).optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
  payment_terms: z.string().optional(),
  invoices: z.array(z.unknown()).optional(),
});
export const Shell = z.strictObject({
  approvals_waiting: z.number().int().optional(),
  notifications_unread: z.number().int().optional(),
  groups: z.array(z.unknown()).optional(),
  pc: z.record(z.string(), z.unknown()).optional(),
  setup_left: z.number().int().optional(),
  banner: z.record(z.string(), z.unknown()).optional(),
  workspace: z.record(z.string(), z.unknown()).optional(),
});
export const OpsShell = z.strictObject({
  inquiries_unassigned: z.number().int().optional(),
  inquiries_mine: z.number().int().optional(),
  invoices_overdue: z.number().int().optional(),
  banner: z.record(z.string(), z.unknown()).optional(),
});
export const TicketShape = z.strictObject({
  kinds: z.array(z.unknown()).optional(),
  stages: z.array(z.unknown()).optional(),
  axes: z.array(z.unknown()).optional(),
  handover_rules: z.array(z.unknown()).optional(),
  limits: z.record(z.string(), z.unknown()).optional(),
  template_updates: z.number().int().optional(),
});
export const TicketShapeChangePreview = z.strictObject({
  removed: z.array(z.unknown()).optional(),
  needs_move_to: z.array(z.unknown()).optional(),
  affected_tickets: z.number().int().optional(),
  over_limits: z.array(z.unknown()).optional(),
});
export const OpsInquiryDetail = z.strictObject({
  inquiry: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  workspace: z.record(z.string(), z.unknown()).optional(),
});
export const OpsNoticeDetail = z.strictObject({
  notice: z.record(z.string(), z.unknown()).optional(),
  updates: z.array(z.unknown()).optional(),
  affects: z.record(z.string(), z.unknown()).optional(),
  placements: z.array(z.unknown()).optional(),
});
export const PublicServiceStatus = z.strictObject({
  incidents: z.array(z.unknown()).optional(),
  maintenance: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const InvitationPreview = z.strictObject({
  state: z.string().optional(),
  workspace_name: z.string().optional(),
  inviter_name: z.string().nullable().optional(),
  group_name: z.string().nullable().optional(),
  role: z.string().optional(),
  message: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  expires_at: z.string().optional(),
  account_exists: z.boolean().optional(),
  signed_in: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const InvitationAccepted = z.strictObject({
  token: z.string().optional(),
  workspace_id: z.string().optional(),
  next: z.string().optional(),
});
export const ServiceStatus = z.strictObject({
  components: z.array(z.unknown()).optional(),
  banner: z.record(z.string(), z.unknown()).optional(),
  maintenance: z.record(z.string(), z.unknown()).optional(),
});
export const InvitationResendResult = z.strictObject({
  result: z.string().optional(),
});
export const Credential = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  layer: z.string().optional(),
  kind: z.string().optional(),
  two_factor: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  expires_on: z.string().nullable().optional(),
  use_count: z.number().int().optional(),
  last_used_at: z.string().nullable().optional(),
  login_check: z.record(z.string(), z.unknown()).optional(),
  can_edit: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export const CredentialDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const CredentialLoginCheck = z.strictObject({
  state: z.string().optional(),
  job_id: z.uuid().nullable().optional(),
});
export const CredentialLoginAnswer = z.strictObject({
  accepted: z.boolean().optional(),
});
export const CredentialCheckReport = z.strictObject({
  accepted: z.boolean().optional(),
  code: z.string().nullable().optional(),
});
export const RevokedDevice = z.strictObject({
  id: z.string().optional(),
  device_label: z.string().nullable().optional(),
  revoked_at: z.string().nullable().optional(),
  revoke_reason: z.string().optional(),
});
export const DeviceBrowser = z.strictObject({
  id: z.uuid().optional(),
  browser: z.string().optional(),
});
export const DeviceBrowserCheck = z.strictObject({
  job_id: z.uuid().optional(),
});
export const BridgeBrowser = z.strictObject({
  browser: z.string().optional(),
});
export const TicketTimelineSeen = z.strictObject({
  ticket_id: z.string().optional(),
  seen_at: z.string().optional(),
});
export const TicketMessageStar = z.strictObject({
  id: z.string().optional(),
  stars: z.number().int().optional(),
  starred: z.boolean().optional(),
});
export const TicketUpdated = z.strictObject({
  ticket: z.record(z.string(), z.unknown()).optional(),
  stage: z.record(z.string(), z.unknown()).optional(),
  changed: z.boolean().optional(),
  message_id: z.uuid().nullable().optional(),
});
export const TicketDecision = z.strictObject({
  id: z.uuid().optional(),
  ticket_id: z.uuid().optional(),
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by: z.record(z.string(), z.unknown()).nullable().optional(),
  decided_note: z.string().nullable().optional(),
  decided_at: z.string().optional(),
  source: z.record(z.string(), z.unknown()).nullable().optional(),
  revises_id: z.uuid().nullable().optional(),
  superseded_by_id: z.uuid().nullable().optional(),
  cancelled: z.record(z.string(), z.unknown()).nullable().optional(),
  promoted_to: z.string().optional(),
});
export const TicketDecisionCreated = z.strictObject({
  decision: z.record(z.string(), z.unknown()).optional(),
  message_id: z.uuid().optional(),
});
export const TicketDecisionChange = z.strictObject({
  decision: z.record(z.string(), z.unknown()).optional(),
  previous: z.record(z.string(), z.unknown()).nullable().optional(),
  message_id: z.uuid().optional(),
});
export const InvitationsSent = z.strictObject({
  invitations: z.array(z.unknown()).optional(),
});
export const BodySaved = z.strictObject({
  version: z.number().int().optional(),
  changed: z.boolean().optional(),
  edited_at: z.string().optional(),
});
export const TestSpecItem = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().optional(),
  checked: z.boolean().optional(),
  position: z.number().int().optional(),
  source: z.string().optional(),
  version: z.number().int().optional(),
});
export const TicketLink = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  side: z.string().nullable().optional(),
  other: z.record(z.string(), z.unknown()).optional(),
  can_remove: z.boolean().optional(),
  created_at: z.string().optional(),
});
export const TicketLinkDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const Notification = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  tag: z.string().optional(),
  href: z.string().nullable().optional(),
  ticket_id: z.uuid().nullable().optional(),
  number: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  actor: z.record(z.string(), z.unknown()).nullable().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  read: z.boolean().optional(),
  read_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export const SavedView = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  share: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  density: z.string().optional(),
  member_id: z.uuid().optional(),
  member_name: z.string().optional(),
  mine: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export const TicketDeleted = z.strictObject({
  id: z.uuid().optional(),
  deleted_count: z.number().int().optional(),
  withdrawn_approvals: z.number().int().optional(),
  stopped_runs: z.number().int().optional(),
  restorable_until: z.string().optional(),
});
export const TicketField = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.array(z.unknown()).optional(),
  position: z.number().int().optional(),
});
export const MyClone = z.strictObject({
  name: z.string().optional(),
  full_name: z.string().optional(),
  since: z.string().optional(),
  pc: z.record(z.string(), z.unknown()).optional(),
});
export const UpdateConversationInput = z.strictObject({
  title: z.string().nullable().optional(),
  participant_member_ids: z.array(z.uuid()).nullable().optional(),
  area: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  parent_conversation_id: z.uuid().nullable().optional(),
  agent_session_id: z.string().nullable().optional(),
  branched_from_message_id: z.uuid().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  title_auto: z.boolean().optional(),
  starred_at: z.iso.datetime({ offset: true }).nullable().optional(),
  incognito: z.boolean().optional(),
  last_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const UpdateMemoryInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  source_type_id: z.string().nullable().optional(),
  source_ref_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  approved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  digest_id: z.uuid().nullable().optional(),
  superseded_by: z.uuid().nullable().optional(),
});

export const SCHEMAS: Record<string, z.ZodType> = { Tenants, TenantsInput, Scopes, ScopesInput, MemberKinds, MemberKindsInput, Members, MembersInput, SetupSteps, SetupStepsInput, Clones, ClonesInput, AiEmployees, AiEmployeesInput, GoalKinds, GoalKindsInput, Units, UnitsInput, RollupKinds, RollupKindsInput, Goals, GoalsInput, GoalAllocations, GoalAllocationsInput, GoalContributions, GoalContributionsInput, GoalVersions, GoalVersionsInput, Hypotheses, HypothesesInput, Measures, MeasuresInput, Validations, ValidationsInput, LedgerDefinitions, LedgerDefinitionsInput, LedgerFields, LedgerFieldsInput, LedgerStages, LedgerStagesInput, LedgerViews, LedgerViewsInput, LedgerRecords, LedgerRecordsInput, Duties, DutiesInput, DutyVersions, DutyVersionsInput, LearnedProcedures, LearnedProceduresInput, ProcedureSteps, ProcedureStepsInput, MemoryKinds, MemoryKindsInput, Memories, MemoriesInput, MemoryDigests, MemoryDigestsInput, MemoryProposals, MemoryProposalsInput, EmbeddingModels, EmbeddingModelsInput, SearchEmbeddings, SearchEmbeddingsInput, Tasks, TasksInput, TaskHandovers, TaskHandoversInput, DailyPlans, DailyPlansInput, Triggers, TriggersInput, Policies, PoliciesInput, Approvals, ApprovalsInput, ActionRuns, ActionRunsInput, ServiceRegistry, ServiceRegistryInput, CredentialKinds, CredentialKindsInput, Credentials, CredentialsInput, Conversations, ConversationsInput, BridgeJobs, BridgeJobsInput, BridgeJobStates, BridgeJobStatesInput, BridgeJobEvents, BridgeJobEventsInput, PermissionRules, PermissionRulesInput, AgentUsageSnapshots, AgentUsageSnapshotsInput, Messages, MessagesInput, Artifacts, ArtifactsInput, ArtifactVersions, ArtifactVersionsInput, AuditEvents, AuditEventsInput, SessionKinds, SessionKindsInput, RevokeReasons, RevokeReasonsInput, Layers, LayersInput, TargetKinds, TargetKindsInput, Abilities, AbilitiesInput, Permissions, PermissionsInput, AccountEvents, AccountEventsInput, AccountEventItems, AccountEventItemsInput, Sessions, SessionsInput, SupportAccessGrants, SupportAccessGrantsInput, RetentionHolds, RetentionHoldsInput, ErasureCertificates, ErasureCertificatesInput, Distributions, DistributionsInput, DistributionVersions, DistributionVersionsInput, TenantDistributions, TenantDistributionsInput, ServiceRegistryVersions, ServiceRegistryVersionsInput, ServiceRequests, ServiceRequestsInput, ReviewRequests, ReviewRequestsInput, OpsMembers, OpsMembersInput, OpsAuditEvents, OpsAuditEventsInput, SecurityEvents, SecurityEventsInput, Inquiries, InquiriesInput, Notices, NoticesInput, NoticeDeliveries, NoticeDeliveriesInput, StatusIncidents, StatusIncidentsInput, NotificationPreferences, NotificationPreferencesInput, Notifications, NotificationsInput, Plans, PlansInput, PlanVersions, PlanVersionsInput, Subscriptions, SubscriptionsInput, PlanChangeRequests, PlanChangeRequestsInput, UsageMeters, UsageMetersInput, Invoices, InvoicesInput, Payments, PaymentsInput, ErrorEvents, ErrorEventsInput, Imports, ImportsInput, Integrations, IntegrationsInput, Invitations, InvitationsInput, PendingSignup, PendingSignupInput, ExportJobs, ExportJobsInput, Attachments, AttachmentsInput, Skills, SkillsInput, SkillVersions, SkillVersionsInput, SkillTestRuns, SkillTestRunsInput, SkillAttachments, SkillAttachmentsInput, PaymentMethods, PaymentMethodsInput, BillingEvents, BillingEventsInput, LlmRoutes, LlmRoutesInput, LlmCapabilities, LlmCapabilitiesInput, PushDevices, PushDevicesInput, DisclosureVersions, DisclosureVersionsInput, Subprocessors, SubprocessorsInput, Tickets, TicketsInput, TicketSections, TicketSectionsInput, TicketSectionVersions, TicketSectionVersionsInput, TicketKinds, TicketKindsInput, KindSections, KindSectionsInput, TicketStages, TicketStagesInput, ClassAxes, ClassAxesInput, ClassValues, ClassValuesInput, TicketClassValues, TicketClassValuesInput, CustomFields, CustomFieldsInput, CustomFieldKinds, CustomFieldKindsInput, TicketFieldValues, TicketFieldValuesInput, HandoverRules, HandoverRulesInput, TestSpecs, TestSpecsInput, Checks, ChecksInput, TicketDecisions, TicketDecisionsInput, TicketMessages, TicketMessagesInput, ReferenceLogs, ReferenceLogsInput, KnowledgePages, KnowledgePagesInput, KnowledgePageVersions, KnowledgePageVersionsInput, KnowledgeLinks, KnowledgeLinksInput, Clients, ClientsInput, ClientGroups, ClientGroupsInput, ClientContacts, ClientContactsInput, ClientRequests, ClientRequestsInput, Acceptances, AcceptancesInput, TenantMemberships, TenantMembershipsInput, TermsVersions, TermsVersionsInput, TermsConsents, TermsConsentsInput, Passkeys, PasskeysInput, Operations, OperationsInput, TicketLinks, TicketLinksInput, TicketHandovers, TicketHandoversInput, SavedViews, SavedViewsInput, TicketImports, TicketImportsInput, LearningCandidates, LearningCandidatesInput, BridgePairingCodes, BridgePairingCodesInput, NotificationSettings, NotificationSettingsInput, OpsPlanProposals, OpsPlanProposalsInput, ScopeMemberships, ScopeMembershipsInput, RoleBundleDefaults, RoleBundleDefaultsInput, StepUpInput, PasskeyRenameInput, SignupInput, SignupResendInput, SignupVerifyInput, PasswordForgotInput, SignInInput, SignInCodeInput, SignOutInput, AdminRecoveryInput, TwoFactorStartInput, TwoFactorConfirmInput, PasswordChangeInput, PasswordSetInput, PasswordResetInput, TermsConsentInput, PairingCodeInput, BridgeClaimInput, BridgeHeartbeatInput, TicketCreateInput, TicketDraftInput, DismissSetupTasksInput, TicketDelegateInput, BridgeTakeInput, BridgeProgressInput, BridgeFinishInput, BridgeToolInput, ApprovalApproveInput, ApprovalReturnInput, InvitationAcceptInput, TicketCompleteInput, InvitationResendInput, CredentialCreateInput, CredentialUpdateInput, CredentialResolveInput, CredentialLoginCheckInput, CredentialLoginAnswerInput, CredentialCheckReportInput, DeviceBrowserInput, DeviceBrowserCheckInput, BridgeBrowserInput, TicketTimelineSeenInput, TicketMessageInput, TicketMessageEditInput, TicketMessageStarInput, TicketUpdateInput, TicketDecisionInput, TicketDecisionUpdateInput, InvitationsCreateInput, InvitationLinkCreateInput, TicketBodyInput, TestSpecCreateInput, TestSpecUpdateInput, TicketLinkInput, SavedViewInput, ActionRunTakeoverInput, ScopeOverview, TicketKindChangePreview, TicketDeletePreview, SearchHit, TimelineItem, TestSpecLint, TicketCompletion, BulkResult, ApprovalQueueItem, ApprovalDetail, BulkApprovalPreview, CloneNow, CloneGrowth, KnowsCounts, ActivityItem, SignupCreated, SignupResent, SignupStatus, SignupVerified, PasswordForgotAccepted, SignInResult, SignInCodeResult, SignedOut, AdminRecoveryResult, PasswordResetDone, CurrentTerms, TermsConsented, ConversationCreated, ConversationUpdated, MemoryUpdated, MySecurity, TwoFactorSetup, TwoFactorEnabled, BackupCodes, StepUp, PasswordChanged, PasswordSet, Me, MyUsage, SetupTask, SetupTasksDismissed, PairingCode, BridgeRelease, BridgeClaim, BridgeReleaseLink, BridgeHeartbeat, BridgeDevice, TicketDetail, TicketKindChoice, TicketDraft, BridgeJob, JobControl, TicketDelegation, ApprovalDecided, BridgeFinish, BridgeToolResult, ActionRunView, ResolvedCredential, WorkTypeUploadCheck, PlanProposalImpact, RuleCheck, WorkspaceMembers, InvitationLink, MemberDetail, MemberRemovalPreview, WorkspaceRules, EscalationPreview, ExportStatus, WorkspaceSettings, PlanChoice, Billing, SignedUrl, ClientRow, ClientLinkCandidate, ClientDetail, ClientActivityItem, PortalHome, ClientRequestDetail, PortalQuestions, PortalRequest, PortalTicket, PortalAcceptance, KnowledgeHome, KnowledgeTree, KnowledgeAnswer, KnowledgePageDetail, KnowledgeUsage, KnowledgeLinkTarget, KnowledgeVerification, KnowledgeImportPreview, OpsWorkspaceRow, OpsWorkspace, OpsWorkspaceMember, OpsWorkspaceBilling, Shell, OpsShell, TicketShape, TicketShapeChangePreview, OpsInquiryDetail, OpsNoticeDetail, PublicServiceStatus, InvitationPreview, InvitationAccepted, ServiceStatus, InvitationResendResult, Credential, CredentialDeleted, CredentialLoginCheck, CredentialLoginAnswer, CredentialCheckReport, RevokedDevice, DeviceBrowser, DeviceBrowserCheck, BridgeBrowser, TicketTimelineSeen, TicketMessageStar, TicketUpdated, TicketDecision, TicketDecisionCreated, TicketDecisionChange, InvitationsSent, BodySaved, TestSpecItem, TicketLink, TicketLinkDeleted, Notification, SavedView, TicketDeleted, TicketField, MyClone, UpdateConversationInput, UpdateMemoryInput };
