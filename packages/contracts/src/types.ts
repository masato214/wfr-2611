// 生成物（scripts/ci/contract.mjs gen ← 08_api/types.ts ← openapi.yaml）。手で直さない。openapi:b7f9b45a1ba890f8
export type ApiResponse<T> = { data: T; meta?: { cursor?: string; limit?: number; total?: number } };
export type ApiError = { error: string; code?: string; message?: string; details?: Array<{ field: string; message: string }>; retry_after_sec?: number };

export type Tenants = { name?: string; plan_id?: string | null; status_id?: string | null; live_at?: string | null; live_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; client_visibility_default?: string; created_by?: string | null; deleted_at?: string | null; deletion_requested_at?: string | null; half_made_at?: string | null; logo_ref?: string | null; request_routing?: string | null; session_idle_hours?: number; session_max_days?: number; updated_by?: string | null };
export type TenantsInput = { name?: string; plan_id?: string | null; status_id?: string | null; live_at?: string | null; live_by?: string | null };
export type Scopes = { parent_id?: string | null; layer_id?: string | null; name?: string; ticket_prefix?: string | null; next_ticket_no?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ScopesInput = { parent_id?: string | null; layer_id?: string | null; name?: string; ticket_prefix?: string | null; next_ticket_no?: number };
export type MemberKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MemberKindsInput = { key?: string; label?: string };
export type Members = { kind_id?: string; display_name?: string; role_id?: string | null; manager_member_id?: string | null; auth_user_id?: string | null; setup_step?: number; agent_permission_mode?: string; agent_model?: string | null; agent_effort?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; avatar_ref?: string | null; call_name?: string | null; created_by?: string | null; deleted_at?: string | null; language?: string; scope_id?: string; setup_dismissed_at?: string | null; setup_skipped_keys?: string[]; suspended_at?: string | null; suspended_by?: string | null; theme?: string; timezone?: string; updated_by?: string | null; week_start?: number };
export type MembersInput = { kind_id?: string; display_name?: string; role_id?: string | null; manager_member_id?: string | null; auth_user_id?: string | null; setup_step?: number; agent_permission_mode?: string; agent_model?: string | null; agent_effort?: string | null };
export type SetupSteps = { n?: number; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SetupStepsInput = { n?: number; label?: string };
export type Clones = { owner_member_id?: string | null; persona?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; auto_memory?: boolean; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ClonesInput = { owner_member_id?: string | null; persona?: string | null };
export type AiEmployees = { member_id?: string | null; provisioning_id?: string | null; template_ref?: string | null; paused_at?: string | null; paused_reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type AiEmployeesInput = { member_id?: string | null; provisioning_id?: string | null; template_ref?: string | null; paused_at?: string | null; paused_reason?: string | null };
export type GoalKinds = { key?: string; label?: string; progress_strategy?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type GoalKindsInput = { key?: string; label?: string; progress_strategy?: string | null };
export type Units = { key?: string; label?: string; symbol?: string | null; value_type_id?: string | null; decimals?: number | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type UnitsInput = { key?: string; label?: string; symbol?: string | null; value_type_id?: string | null; decimals?: number | null };
export type RollupKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type RollupKindsInput = { key?: string; label?: string };
export type Goals = { ended_at?: string | null; parent_id?: string | null; rollup_kind_id?: string | null; rollup_spec?: unknown | null; kind_id?: string | null; period_start?: string | null; period_end?: string | null; target_value?: string | null; unit_id?: string | null; origin_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null; version?: number };
export type GoalsInput = { ended_at?: string | null; parent_id?: string | null; rollup_kind_id?: string | null; rollup_spec?: unknown | null; kind_id?: string | null; period_start?: string | null; period_end?: string | null; target_value?: string | null; unit_id?: string | null; origin_id?: string | null };
export type GoalAllocations = { goal_id?: string | null; assignee_member_id?: string | null; allocated_value?: string | null; agreement_status_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type GoalAllocationsInput = { goal_id?: string | null; assignee_member_id?: string | null; allocated_value?: string | null; agreement_status_id?: string | null };
export type GoalContributions = { child_goal_id?: string | null; parent_goal_id?: string | null; hypothesis_id?: string | null; verdict_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type GoalContributionsInput = { child_goal_id?: string | null; parent_goal_id?: string | null; hypothesis_id?: string | null; verdict_id?: string | null };
export type GoalVersions = { goal_id?: string | null; version?: number; name?: string | null; snapshot?: unknown | null; changed_at?: string | null; changed_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type GoalVersionsInput = { goal_id?: string | null; name?: string | null; snapshot?: unknown | null; changed_at?: string | null; changed_by?: string | null };
export type Hypotheses = { goal_id?: string | null; statement?: string | null; evidence?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type HypothesesInput = { goal_id?: string | null; statement?: string | null; evidence?: string | null };
export type Measures = { hypothesis_id?: string | null; statement?: string | null; expected_effect?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type MeasuresInput = { hypothesis_id?: string | null; statement?: string | null; expected_effect?: string | null };
export type Validations = { measure_id?: string | null; measured_value?: string | null; verdict_id?: string | null; measured_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ValidationsInput = { measure_id?: string | null; measured_value?: string | null; verdict_id?: string | null; measured_at?: string | null };
export type LedgerDefinitions = { kind_id?: string | null; name?: string | null; json_schema?: unknown | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null; version?: number };
export type LedgerDefinitionsInput = { kind_id?: string | null; name?: string | null; json_schema?: unknown | null };
export type LedgerFields = { definition_id?: string | null; key?: string; label?: string; data_type_id?: string | null; required?: boolean | null; options_master_id?: string | null; order_no?: number | null; is_filterable?: boolean | null; is_sortable?: boolean | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type LedgerFieldsInput = { definition_id?: string | null; key?: string; label?: string; data_type_id?: string | null; required?: boolean | null; options_master_id?: string | null; order_no?: number | null; is_filterable?: boolean | null; is_sortable?: boolean | null };
export type LedgerStages = { definition_id?: string | null; key?: string; label?: string; order_no?: number | null; rules?: unknown | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type LedgerStagesInput = { definition_id?: string | null; key?: string; label?: string; order_no?: number | null; rules?: unknown | null };
export type LedgerViews = { definition_id?: string | null; kind_id?: string | null; filters?: unknown | null; sorts?: unknown | null; columns?: unknown | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type LedgerViewsInput = { definition_id?: string | null; kind_id?: string | null; filters?: unknown | null; sorts?: unknown | null; columns?: unknown | null };
export type LedgerRecords = { definition_id?: string | null; stage_id?: string | null; amount?: string | null; occurred_on?: string | null; assignee_id?: string | null; goal_id?: string | null; measure_id?: string | null; data?: unknown | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type LedgerRecordsInput = { definition_id?: string | null; stage_id?: string | null; amount?: string | null; occurred_on?: string | null; assignee_id?: string | null; goal_id?: string | null; measure_id?: string | null; data?: unknown | null };
export type Duties = { ai_employee_id?: string | null; name?: string | null; definition_md?: string | null; constraints?: unknown | null; visibility_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null; version?: number };
export type DutiesInput = { ai_employee_id?: string | null; name?: string | null; definition_md?: string | null; constraints?: unknown | null; visibility_id?: string | null };
export type DutyVersions = { duty_id?: string | null; version?: number; snapshot?: unknown | null; changed_by?: string | null; change_reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type DutyVersionsInput = { duty_id?: string | null; snapshot?: unknown | null; changed_by?: string | null; change_reason?: string | null };
export type LearnedProcedures = { duty_id?: string | null; target_service_id?: string | null; status_id?: string | null; run_count?: number | null; avg_ms?: number | null; fail_count?: number | null; last_verified_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type LearnedProceduresInput = { duty_id?: string | null; target_service_id?: string | null; status_id?: string | null; run_count?: number | null; avg_ms?: number | null; fail_count?: number | null; last_verified_at?: string | null };
export type ProcedureSteps = { procedure_id?: string | null; order_no?: number | null; intent_ja?: string | null; locator?: unknown | null; is_variable?: boolean | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ProcedureStepsInput = { procedure_id?: string | null; order_no?: number | null; intent_ja?: string | null; is_variable?: boolean | null };
export type MemoryKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MemoryKindsInput = { key?: string; label?: string };
export type Memories = { kind_id?: string | null; owner_member_id?: string | null; title?: string | null; body?: string | null; confidence?: string | null; source_type_id?: string | null; source_ref_id?: string | null; approved_by?: string | null; approved_at?: string | null; digest_id?: string | null; superseded_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; auto?: boolean; created_by?: string | null; deleted_at?: string | null; embedding?: string[] | null; last_used_at?: string | null; scope_id?: string; updated_by?: string | null; use_count?: number; visibility?: string };
export type MemoriesInput = { kind_id?: string | null; owner_member_id?: string | null; title?: string | null; body?: string | null; confidence?: string | null; source_type_id?: string | null; source_ref_id?: string | null; approved_by?: string | null; approved_at?: string | null; digest_id?: string | null; superseded_by?: string | null };
export type MemoryDigests = { member_id?: string | null; from_on?: string | null; to_on?: string | null; conversation_count?: number | null; state_id?: string | null; result?: unknown | null; bridge_job_id?: string | null; started_at?: string | null; finished_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type MemoryDigestsInput = { member_id?: string | null; from_on?: string | null; to_on?: string | null; conversation_count?: number | null; state_id?: string | null; result?: unknown | null; bridge_job_id?: string | null; started_at?: string | null; finished_at?: string | null };
export type MemoryProposals = { memory_id?: string | null; target_scope_id?: string | null; proposer_member_id?: string | null; reviewer_member_id?: string | null; state_id?: string | null; conflict_group_id?: string | null; evidence?: unknown | null; decided_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type MemoryProposalsInput = { memory_id?: string | null; target_scope_id?: string | null; proposer_member_id?: string | null; reviewer_member_id?: string | null; state_id?: string | null; conflict_group_id?: string | null; evidence?: unknown | null; decided_at?: string | null };
export type EmbeddingModels = { key?: string; label?: string; dim?: number; state_id?: string; artifact_url?: string; sha256?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type EmbeddingModelsInput = { key?: string; label?: string; dim?: number; state_id?: string; artifact_url?: string; sha256?: string };
export type SearchEmbeddings = { target_type_id?: string; target_id?: string; model_id?: string; chunk_no?: string; content_hash?: string; embedding?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SearchEmbeddingsInput = { target_type_id?: string; target_id?: string; model_id?: string; chunk_no?: string };
export type Tasks = { parent_task_id?: string; goal_id?: string | null; measure_id?: string | null; assignee_member_id?: string | null; status_id?: string | null; due_on?: string | null; title?: string | null; origin_id?: string | null; goal_changed_at?: string | null; next_action?: string | null; estimate_minutes?: number | null; actual_minutes?: number | null; planned_for?: string | null; blocked_reason_id?: string | null; blocked_since?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type TasksInput = { parent_task_id?: string; goal_id?: string | null; measure_id?: string | null; assignee_member_id?: string | null; status_id?: string | null; due_on?: string | null; title?: string | null; origin_id?: string | null; goal_changed_at?: string | null; next_action?: string | null; estimate_minutes?: number | null; actual_minutes?: number | null; planned_for?: string | null; blocked_reason_id?: string | null; blocked_since?: string | null };
export type TaskHandovers = { task_id?: string | null; from_member_id?: string | null; to_member_id?: string | null; mode_id?: string | null; agreement_status_id?: string | null; reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TaskHandoversInput = { task_id?: string | null; from_member_id?: string | null; to_member_id?: string | null; mode_id?: string | null; agreement_status_id?: string | null; reason?: string | null };
export type DailyPlans = { member_id?: string | null; plan_date?: string | null; capacity_minutes?: number | null; committed_at?: string | null; closed_at?: string | null; carry_over?: unknown | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type DailyPlansInput = { member_id?: string | null; plan_date?: string | null; capacity_minutes?: number | null; committed_at?: string | null; closed_at?: string | null; carry_over?: unknown | null };
export type Triggers = { kind_id?: string | null; cron_expr?: string | null; timezone?: string | null; on_missed_id?: string | null; ttl_minutes?: number | null; enabled?: boolean | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type TriggersInput = { kind_id?: string | null; cron_expr?: string | null; timezone?: string | null; on_missed_id?: string | null; ttl_minutes?: number | null; enabled?: boolean | null };
export type Policies = { subject_kind_id?: string | null; action_kind_id?: string | null; mode_id?: string | null; params?: unknown | null; is_locked?: boolean | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; applies_to?: string; client_id?: string | null; created_by?: string | null; deleted_at?: string | null; escalate_to?: string | null; escalate_when?: unknown | null; exception_approval_id?: string | null; exception_of_policy_id?: string | null; kind?: string; kind_id?: string | null; last_used_at?: string | null; paused_at?: string | null; scope_id?: string; source_ref?: unknown | null; text?: string | null; updated_by?: string | null; use_count?: number; version?: number };
export type PoliciesInput = { subject_kind_id?: string | null; action_kind_id?: string | null; mode_id?: string | null; params?: unknown | null; is_locked?: boolean | null };
export type Approvals = { action_run_id?: string | null; requested_by?: string | null; approver_member_id?: string | null; status_id?: string | null; resolved_at?: string | null; note?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; bulk_batch_id?: string | null; created_by?: string | null; decided_at?: string | null; decision?: string | null; deleted_at?: string | null; escalated_by_policy_id?: string | null; human_checks?: unknown; irreversible?: boolean; kind?: string; level?: number; memory_candidate?: boolean; next_actor?: string | null; parent_approval_id?: string | null; return_reason?: string | null; return_targets?: unknown | null; scope_id?: string; step_up_at?: string | null; subject_id?: string | null; subject_type?: string | null; ticket_id?: string | null; updated_by?: string | null; withdrawn_at?: string | null };
export type ApprovalsInput = { action_run_id?: string | null; requested_by?: string | null; approver_member_id?: string | null; status_id?: string | null; resolved_at?: string | null; note?: string | null };
export type ActionRuns = { task_id?: string | null; action_kind_id?: string | null; choke_point_id?: string | null; service_id?: string | null; procedure_id?: string | null; status_id?: string | null; started_at?: string | null; finished_at?: string | null; tokens_in?: number | null; tokens_out?: number | null; cost?: string | null; error_summary?: string | null; ai_employee_id?: string | null; duty_id?: string | null; mode_id?: string | null; bridge_job_id?: string | null; taken_over_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; approval_id?: string | null; created_by?: string | null; deleted_at?: string | null; phase?: string | null; scope_id?: string; ticket_id?: string | null; updated_by?: string | null };
export type ActionRunsInput = { task_id?: string | null; action_kind_id?: string | null; choke_point_id?: string | null; service_id?: string | null; procedure_id?: string | null; status_id?: string | null; started_at?: string | null; finished_at?: string | null; tokens_in?: number | null; tokens_out?: number | null; cost?: string | null; error_summary?: string | null; ai_employee_id?: string | null; duty_id?: string | null; mode_id?: string | null; bridge_job_id?: string | null; taken_over_at?: string | null };
export type ServiceRegistry = { name?: string | null; domain?: string | null; automation_verdict_id?: string | null; notes?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ServiceRegistryInput = { name?: string | null; domain?: string | null; automation_verdict_id?: string | null; notes?: string | null };
export type CredentialKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type CredentialKindsInput = { key?: string; label?: string };
export type Credentials = { name?: string; description?: string | null; layer?: string; service_id?: string | null; service_name?: string | null; service_domain?: string | null; kind_id?: string | null; provider_id?: string; vault_ref?: string | null; owner_member_id?: string | null; revoked_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; client_id?: string | null; created_by?: string | null; deleted_at?: string | null; destinations?: string[]; expires_at?: string | null; last_used_at?: string | null; login_check_at?: string | null; login_check_detail?: string | null; login_check_state?: string | null; purpose?: string | null; read_only?: boolean; scope_id?: string; two_factor_id?: string; updated_by?: string | null; use_count?: number };
export type CredentialsInput = { name?: string; description?: string | null; layer?: string; service_id?: string | null; service_name?: string | null; service_domain?: string | null; kind_id?: string | null; provider_id?: string; owner_member_id?: string | null; revoked_at?: string | null };
export type Conversations = { title?: string | null; participant_member_ids?: string[] | null; area?: string | null; subject_type?: string | null; parent_conversation_id?: string | null; agent_session_id?: string | null; branched_from_message_id?: string | null; owner_member_id?: string | null; closed_at?: string | null; title_auto?: boolean; starred_at?: string | null; incognito?: boolean; last_read_at?: string | null; deleted_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; scope_id?: string; updated_by?: string | null };
export type ConversationsInput = { title?: string | null; participant_member_ids?: string[] | null; area?: string | null; subject_type?: string | null; parent_conversation_id?: string | null; agent_session_id?: string | null; branched_from_message_id?: string | null; owner_member_id?: string | null; closed_at?: string | null; title_auto?: boolean; starred_at?: string | null; incognito?: boolean; last_read_at?: string | null };
export type BridgeJobs = { member_id?: string; conversation_id?: string | null; state_id?: string; prompt?: string; agent_session_id?: string | null; result?: string | null; partial?: string | null; stopped_reason?: string | null; permission_mode?: string; model?: string | null; effort?: string | null; tools?: string[] | null; attachment_ids?: string[] | null; steer_seq?: number; tool_token_hash?: string | null; browser?: string | null; started_at?: string | null; finished_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; credential_id?: string | null; deleted_at?: string | null; kind?: string; resume_session_id?: string | null; scope_id?: string | null; stop_requested_at?: string | null; taken_session_id?: string | null; target_session_id?: string | null; updated_by?: string | null };
export type BridgeJobsInput = { member_id?: string; conversation_id?: string | null; state_id?: string; prompt?: string; agent_session_id?: string | null; result?: string | null; partial?: string | null; stopped_reason?: string | null; permission_mode?: string; model?: string | null; effort?: string | null; tools?: string[] | null; attachment_ids?: string[] | null; steer_seq?: number; tool_token_hash?: string | null; browser?: string | null; started_at?: string | null; finished_at?: string | null };
export type BridgeJobStates = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type BridgeJobStatesInput = { key?: string; label?: string };
export type BridgeJobEvents = { member_id?: string; job_id?: string; kind?: string; seq?: number; request_id?: string | null; payload?: unknown; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string | null; updated_by?: string | null };
export type BridgeJobEventsInput = { member_id?: string; job_id?: string; kind?: string; seq?: number; request_id?: string | null; payload?: unknown };
export type PermissionRules = { member_id?: string | null; tool?: string | null; target_pattern?: string | null; decision_id?: string | null; bridge_job_event_id?: string | null; revoked_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type PermissionRulesInput = { member_id?: string | null; tool?: string | null; target_pattern?: string | null; decision_id?: string | null; bridge_job_event_id?: string | null; revoked_at?: string | null };
export type AgentUsageSnapshots = { member_id?: string | null; window_id?: string | null; utilization?: string | null; resets_at?: string | null; observed_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type AgentUsageSnapshotsInput = { member_id?: string | null; window_id?: string | null; utilization?: string | null; resets_at?: string | null; observed_at?: string | null };
export type Messages = { conversation_id?: string | null; sender_member_id?: string | null; body?: string | null; attachments?: unknown | null; action_run_id?: string | null; kind?: string | null; options?: unknown | null; confidence?: string | null; citations?: unknown | null; parent_message_id?: string | null; quote?: unknown | null; work?: unknown | null; send_state?: string | null; transcript_uuid?: string | null; undo_action_run_id?: string | null; read_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; job_id?: string | null; updated_by?: string | null };
export type MessagesInput = { conversation_id?: string | null; sender_member_id?: string | null; body?: string | null; attachments?: unknown | null; action_run_id?: string | null; kind?: string | null; options?: unknown | null; confidence?: string | null; citations?: unknown | null; parent_message_id?: string | null; quote?: unknown | null; work?: unknown | null; send_state?: string | null; transcript_uuid?: string | null; undo_action_run_id?: string | null; read_at?: string | null };
export type Artifacts = { task_id?: string | null; format_id?: string | null; storage_ref?: string | null; template_id?: string | null; approved_by?: string | null; source_message_id?: string | null; title?: string | null; owner_member_id?: string | null; current_version?: number | null; source_conversation_id?: string | null; source_job_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type ArtifactsInput = { task_id?: string | null; format_id?: string | null; template_id?: string | null; approved_by?: string | null; source_message_id?: string | null; title?: string | null; owner_member_id?: string | null; current_version?: number | null; source_conversation_id?: string | null; source_job_id?: string | null };
export type ArtifactVersions = { artifact_id?: string; version?: number; storage_ref?: string; size_bytes?: string | null; owner_member_id?: string | null; reverted_from?: number | null; note?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type ArtifactVersionsInput = { artifact_id?: string; size_bytes?: string | null; owner_member_id?: string | null; reverted_from?: number | null; note?: string | null };
export type AuditEvents = { actor_member_id?: string | null; actor_role?: string; action?: string; target_type?: string; target_id?: string | null; choke_point_id?: string | null; payload?: unknown; occurred_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type AuditEventsInput = { actor_member_id?: string | null; actor_role?: string; action?: string; target_type?: string; target_id?: string | null; choke_point_id?: string | null; payload?: unknown; occurred_at?: string };
export type SessionKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SessionKindsInput = { key?: string; label?: string };
export type RevokeReasons = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type RevokeReasonsInput = { key?: string; label?: string };
export type Layers = { key?: string; label?: string; order_no?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type LayersInput = { key?: string; label?: string; order_no?: number };
export type TargetKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TargetKindsInput = { key?: string; label?: string };
export type Abilities = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AbilitiesInput = { key?: string; label?: string };
export type Permissions = { grantee_member_id?: string; target_kind_id?: string; scope_id?: string | null; ability_id?: string; granted_by?: string | null; revoked_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; bundle_role?: string | null; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type PermissionsInput = { grantee_member_id?: string; target_kind_id?: string; ability_id?: string; granted_by?: string | null; revoked_at?: string | null };
export type AccountEvents = { kind_id?: string | null; subject_type?: string | null; subject_id?: string | null; requested_by?: string | null; status_id?: string | null; resolved_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type AccountEventsInput = { kind_id?: string | null; subject_type?: string | null; subject_id?: string | null; requested_by?: string | null; status_id?: string | null; resolved_at?: string | null };
export type AccountEventItems = { event_id?: string | null; object_kind?: string | null; disposition_id?: string | null; target_ref?: string | null; decided_by?: string | null; done_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type AccountEventItemsInput = { event_id?: string | null; object_kind?: string | null; disposition_id?: string | null; target_ref?: string | null; decided_by?: string | null; done_at?: string | null };
export type Sessions = { member_id?: string; kind_id?: string; auth_session_id?: string | null; device_label?: string | null; ip_region?: string | null; issued_at?: string; last_seen_at?: string; revoked_at?: string | null; revoke_reason_id?: string | null; device_token_hash?: string | null; alive_at?: string | null; bridge_version?: string | null; machine_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; browser?: string; cli_model?: string | null; country?: string | null; created_by?: string | null; deleted_at?: string | null; device?: string | null; health?: unknown | null; health_at?: string | null; last_ip?: string | null; mfa_pending?: boolean; step_up_at?: string | null; terms_pending?: boolean; updated_by?: string | null };
export type SessionsInput = { member_id?: string; kind_id?: string; auth_session_id?: string | null; device_label?: string | null; ip_region?: string | null; issued_at?: string; last_seen_at?: string; revoked_at?: string | null; revoke_reason_id?: string | null; device_token_hash?: string | null; alive_at?: string | null; bridge_version?: string | null; machine_id?: string | null };
export type SupportAccessGrants = { granted_by_member_id?: string | null; scope?: string; expires_at?: string; revoked_at?: string | null; ops_member_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; closed_at?: string | null; created_by?: string | null; deleted_at?: string | null; inquiry_id?: string | null; reason?: string | null; updated_by?: string | null };
export type SupportAccessGrantsInput = { granted_by_member_id?: string | null; scope?: string; expires_at?: string; revoked_at?: string | null; ops_member_id?: string | null };
export type RetentionHolds = { record_type?: string | null; record_ref?: string | null; retain_until?: string | null; legal_basis?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type RetentionHoldsInput = { record_type?: string | null; record_ref?: string | null; retain_until?: string | null; legal_basis?: string | null };
export type ErasureCertificates = { issued_at?: string | null; content_hash?: string | null; sent_to?: string | null; storage_ref?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ErasureCertificatesInput = { issued_at?: string | null; sent_to?: string | null };
export type Distributions = { kind_id?: string | null; key?: string; name?: string | null; current_version?: number | null; plan_ids?: string[] | null; is_locked?: boolean | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type DistributionsInput = { kind_id?: string | null; key?: string; name?: string | null; current_version?: number | null; plan_ids?: string[] | null; is_locked?: boolean | null };
export type DistributionVersions = { distribution_id?: string | null; version?: number; snapshot?: unknown | null; released_at?: string | null; released_by?: string | null; change_reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type DistributionVersionsInput = { distribution_id?: string | null; snapshot?: unknown | null; released_at?: string | null; released_by?: string | null; change_reason?: string | null };
export type TenantDistributions = { distribution_id?: string | null; version_in_use?: number | null; enabled?: boolean | null; override?: unknown | null; disabled_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TenantDistributionsInput = { distribution_id?: string | null; version_in_use?: number | null; enabled?: boolean | null; override?: unknown | null; disabled_by?: string | null };
export type ServiceRegistryVersions = { service_id?: string | null; version?: number; automation_verdict_id?: string | null; reason?: string | null; released_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ServiceRegistryVersionsInput = { service_id?: string | null; automation_verdict_id?: string | null; reason?: string | null; released_at?: string | null };
export type ServiceRequests = { service_name?: string | null; url?: string | null; requested_by?: string | null; verdict_id?: string | null; decided_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ServiceRequestsInput = { service_name?: string | null; url?: string | null; requested_by?: string | null; verdict_id?: string | null; decided_at?: string | null };
export type ReviewRequests = { subject_type?: string | null; subject_id?: string | null; anonymization_check?: unknown | null; status_id?: string | null; reviewer_ops_member_id?: string | null; decided_at?: string | null; reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ReviewRequestsInput = { subject_type?: string | null; subject_id?: string | null; anonymization_check?: unknown | null; status_id?: string | null; reviewer_ops_member_id?: string | null; decided_at?: string | null; reason?: string | null };
export type OpsMembers = { member_id?: string | null; ops_role_id?: string | null; revoked_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; caps?: string[]; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type OpsMembersInput = { member_id?: string | null; ops_role_id?: string | null; revoked_at?: string | null };
export type OpsAuditEvents = { ops_member_id?: string | null; target_tenant_id?: string; action?: string; target_type?: string; target_id?: string | null; grant_id?: string | null; payload?: unknown; occurred_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type OpsAuditEventsInput = { ops_member_id?: string | null; target_tenant_id?: string; action?: string; target_type?: string; target_id?: string | null; grant_id?: string | null; payload?: unknown; occurred_at?: string };
export type SecurityEvents = { kind_id?: string; step_up?: string; step_up_failed?: string; member_id?: string | null; ip_region?: string | null; detail?: unknown; occurred_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type SecurityEventsInput = { kind_id?: string; step_up?: string; step_up_failed?: string; member_id?: string | null; ip_region?: string | null; detail?: unknown; occurred_at?: string };
export type Inquiries = { opened_by_member_id?: string | null; kind_id?: string | null; status_id?: string | null; conversation_id?: string | null; assignee_ops_member_id?: string | null; ai_first_answered_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; context?: unknown; created_by?: string | null; deleted_at?: string | null; later_until?: string | null; updated_by?: string | null };
export type InquiriesInput = { opened_by_member_id?: string | null; kind_id?: string | null; status_id?: string | null; conversation_id?: string | null; assignee_ops_member_id?: string | null; ai_first_answered_at?: string | null };
export type Notices = { kind_id?: string | null; title?: string | null; body?: string | null; target_plan_ids?: string[] | null; target_tenant_id?: string | null; publish_at?: string | null; published_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; affects?: unknown; created_by?: string | null; deleted_at?: string | null; emailed_admins_at?: string | null; maintenance_from?: string | null; maintenance_to?: string | null; placements?: string[]; state?: string; updated_by?: string | null };
export type NoticesInput = { kind_id?: string | null; title?: string | null; body?: string | null; target_plan_ids?: string[] | null; target_tenant_id?: string | null; publish_at?: string | null; published_by?: string | null };
export type NoticeDeliveries = { notice_id?: string | null; member_id?: string | null; delivered_at?: string | null; read_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type NoticeDeliveriesInput = { notice_id?: string | null; member_id?: string | null; delivered_at?: string | null; read_at?: string | null };
export type StatusIncidents = { component_id?: string | null; service_id?: string | null; state_id?: string | null; started_at?: string | null; resolved_at?: string | null; note?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; body?: string | null; created_by?: string | null; deleted_at?: string | null; notice_id?: string | null; state?: string; updated_by?: string | null };
export type StatusIncidentsInput = { component_id?: string | null; service_id?: string | null; state_id?: string | null; started_at?: string | null; resolved_at?: string | null; note?: string | null };
export type NotificationPreferences = { member_id?: string | null; event_kind_id?: string | null; channel_id?: string | null; enabled?: boolean | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type NotificationPreferencesInput = { member_id?: string | null; event_kind_id?: string | null; channel_id?: string | null; enabled?: boolean | null };
export type Notifications = { member_id?: string | null; channel_id?: string | null; event_kind_id?: string | null; payload?: unknown | null; dedupe_key?: string | null; sent_at?: string | null; failed_at?: string | null; read_at?: string | null; retry_count?: number | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type NotificationsInput = { member_id?: string | null; channel_id?: string | null; event_kind_id?: string | null; payload?: unknown | null; sent_at?: string | null; failed_at?: string | null; read_at?: string | null; retry_count?: number | null };
export type Plans = { key?: string; name?: string | null; price_monthly?: string | null; limits?: unknown | null; current_version?: number | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type PlansInput = { key?: string; name?: string | null; price_monthly?: string | null; limits?: unknown | null; current_version?: number | null };
export type PlanVersions = { plan_id?: string | null; version?: number; snapshot?: unknown | null; released_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PlanVersionsInput = { plan_id?: string | null; snapshot?: unknown | null; released_at?: string | null };
export type Subscriptions = { plan_id?: string | null; status_id?: string | null; started_at?: string | null; suspended_at?: string | null; ended_at?: string | null; billing_contact?: unknown | null; payment_method_id?: string; stripe_customer_ref?: string; stripe_subscription_ref?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type SubscriptionsInput = { plan_id?: string | null; status_id?: string | null; started_at?: string | null; suspended_at?: string | null; ended_at?: string | null; billing_contact?: unknown | null; payment_method_id?: string; stripe_customer_ref?: string; stripe_subscription_ref?: string };
export type PlanChangeRequests = { from_plan_id?: string | null; to_plan_id?: string | null; requested_by?: string | null; status_id?: string | null; dependencies_event_id?: string | null; decided_by_ops_member_id?: string | null; decided_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type PlanChangeRequestsInput = { from_plan_id?: string | null; to_plan_id?: string | null; requested_by?: string | null; status_id?: string | null; dependencies_event_id?: string | null; decided_by_ops_member_id?: string | null; decided_at?: string | null };
export type UsageMeters = { meter_key?: string | null; period_start?: string | null; value?: string | null; limit_value?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type UsageMetersInput = { meter_key?: string | null; period_start?: string | null; value?: string | null; limit_value?: string | null };
export type Invoices = { subscription_id?: string | null; period_start?: string | null; period_end?: string | null; amount?: string | null; issued_at?: string | null; due_on?: string | null; status_id?: string | null; pdf_ref?: string | null; stripe_invoice_ref?: string; hosted_url?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type InvoicesInput = { subscription_id?: string | null; period_start?: string | null; period_end?: string | null; amount?: string | null; issued_at?: string | null; due_on?: string | null; status_id?: string | null; pdf_ref?: string | null; stripe_invoice_ref?: string; hosted_url?: string };
export type Payments = { invoice_id?: string | null; paid_on?: string | null; amount?: string | null; method_id?: string | null; recorded_by_ops_member_id?: string | null; stripe_payment_ref?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type PaymentsInput = { invoice_id?: string | null; paid_on?: string | null; amount?: string | null; method_id?: string | null; recorded_by_ops_member_id?: string | null; stripe_payment_ref?: string };
export type ErrorEvents = { error_code?: string; member_id?: string | null; screen_id?: string | null; context?: unknown; shown_at?: string; next_action_taken_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ErrorEventsInput = { error_code?: string; member_id?: string | null; screen_id?: string | null; context?: unknown; shown_at?: string; next_action_taken_at?: string | null };
export type Imports = { file_ref?: string | null; detected_kind_id?: string | null; proposal?: unknown | null; status_id?: string | null; applied_at?: string | null; applied_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type ImportsInput = { file_ref?: string | null; detected_kind_id?: string | null; proposal?: unknown | null; status_id?: string | null; applied_at?: string | null; applied_by?: string | null };
export type Integrations = { service_id?: string | null; kind_id?: string | null; credential_id?: string | null; scopes?: string[] | null; status_id?: string | null; connected_at?: string | null; revoked_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type IntegrationsInput = { service_id?: string | null; kind_id?: string | null; credential_id?: string | null; scopes?: string[] | null; status_id?: string | null; connected_at?: string | null; revoked_at?: string | null };
export type Invitations = { email?: string | null; scope_id?: string | null; role_id?: string | null; permission_preset?: unknown; token_hash?: string; expires_at?: string; accepted_member_id?: string | null; revoked_at?: string | null; message?: string | null; resend_requested_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type InvitationsInput = { email?: string | null; role_id?: string | null; permission_preset?: unknown; expires_at?: string; accepted_member_id?: string | null; revoked_at?: string | null; message?: string | null; resend_requested_at?: string | null };
export type PendingSignup = { email?: string; name?: string; company_name?: string; pw_iv?: string; token_hash?: string; expires_at?: string; sent_at?: string; send_error?: string; consumed_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PendingSignupInput = { email?: string; name?: string; company_name?: string; pw_iv?: string; expires_at?: string; sent_at?: string; send_error?: string; consumed_at?: string };
export type ExportJobs = { requested_by?: string | null; kind_id?: string; storage_ref?: string | null; status_id?: string; expires_at?: string | null; downloaded_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ExportJobsInput = { requested_by?: string | null; kind_id?: string; status_id?: string; expires_at?: string | null; downloaded_at?: string | null };
export type Attachments = { owner_type?: string | null; owner_id?: string | null; storage_ref?: string | null; mime?: string | null; size?: string | null; name?: string | null; uploaded_by?: string | null; scanned_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type AttachmentsInput = { owner_type?: string | null; owner_id?: string | null; mime?: string | null; size?: string | null; name?: string | null; uploaded_by?: string | null; scanned_at?: string | null };
export type Skills = { kind_id?: string | null; key?: string; name?: string | null; purpose?: string | null; current_version?: number | null; plan_ids?: string[] | null; visibility_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; owner_member_id?: string | null; scope_id?: string | null; updated_by?: string | null };
export type SkillsInput = { kind_id?: string | null; key?: string; name?: string | null; purpose?: string | null; current_version?: number | null; plan_ids?: string[] | null; visibility_id?: string | null };
export type SkillVersions = { skill_id?: string | null; version?: number; package_ref?: string | null; changelog?: string | null; tested_at?: string | null; test_result?: unknown | null; released_at?: string | null; released_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; checked?: unknown | null; fields?: unknown; state?: string };
export type SkillVersionsInput = { skill_id?: string | null; changelog?: string | null; tested_at?: string | null; test_result?: unknown | null; released_at?: string | null; released_by?: string | null };
export type SkillTestRuns = { skill_version_id?: string | null; ops_member_id?: string | null; mode?: string | null; started_at?: string | null; finished_at?: string | null; result?: unknown | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type SkillTestRunsInput = { skill_version_id?: string | null; ops_member_id?: string | null; mode?: string | null; started_at?: string | null; finished_at?: string | null; result?: unknown | null };
export type SkillAttachments = { skill_id?: string | null; version_in_use?: number | null; target_type?: string | null; target_id?: string | null; enabled?: boolean | null; disabled_by?: string | null; attached_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type SkillAttachmentsInput = { skill_id?: string | null; version_in_use?: number | null; target_type?: string | null; target_id?: string | null; enabled?: boolean | null; disabled_by?: string | null; attached_at?: string | null };
export type PaymentMethods = { kind_id?: string | null; stripe_customer_ref?: string | null; brand?: string | null; last4?: string | null; expires_on?: string | null; registered_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type PaymentMethodsInput = { kind_id?: string | null; stripe_customer_ref?: string | null; brand?: string | null; last4?: string | null; expires_on?: string | null; registered_at?: string | null };
export type BillingEvents = { stripe_event_ref?: string | null; kind?: string | null; payload?: unknown | null; received_at?: string | null; processed_at?: string | null; signature_ok?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type BillingEventsInput = { stripe_event_ref?: string | null; kind?: string | null; payload?: unknown | null; received_at?: string | null; processed_at?: string | null; signature_ok?: string | null };
export type LlmRoutes = { default_kind_id?: string | null; offline_kind_id?: string | null; provider_id?: string | null; credential_id?: string | null; managed_allowed_by_ops_member_id?: string | null; managed_allowed_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type LlmRoutesInput = { default_kind_id?: string | null; offline_kind_id?: string | null; provider_id?: string | null; credential_id?: string | null; managed_allowed_by_ops_member_id?: string | null; managed_allowed_at?: string | null };
export type LlmCapabilities = { key?: string; label?: string; provider_id?: string | null; capability_id?: string | null; supported?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LlmCapabilitiesInput = { key?: string; label?: string; provider_id?: string | null; capability_id?: string | null; supported?: string | null };
export type PushDevices = { member_id?: string | null; platform_id?: string | null; token_ref?: string | null; app_version?: number | null; last_seen_at?: string | null; revoked_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type PushDevicesInput = { member_id?: string | null; platform_id?: string | null; token_ref?: string | null; app_version?: number | null; last_seen_at?: string | null; revoked_at?: string | null };
export type DisclosureVersions = { version?: number | null; generated_at?: string | null; content_hash?: string | null; pdf_ref?: string | null; dpa_ref?: string | null; released_by?: string | null; notice_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type DisclosureVersionsInput = { generated_at?: string | null; pdf_ref?: string | null; dpa_ref?: string | null; released_by?: string | null; notice_id?: string | null };
export type Subprocessors = { name?: string | null; purpose?: string | null; region?: string | null; data_kinds?: string[] | null; effective_from?: string | null; announced_at?: string | null; retired_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type SubprocessorsInput = { name?: string | null; purpose?: string | null; region?: string | null; data_kinds?: string[] | null; effective_from?: string | null; announced_at?: string | null; retired_at?: string | null };
export type Tickets = { number?: string; kind_id?: string; stage_id?: string; title?: string; assignee_member_id?: string | null; completed_at?: string | null; completed_by?: string | null; delegated_to_clone?: boolean; client_id?: string | null; parent_ticket_id?: string | null; derived_from_ticket_id?: string | null; start_on?: string | null; due_on?: string | null; priority?: string; estimate_minutes?: number | null; actual_minutes?: number | null; work_type_id?: string | null; work_type_version?: number | null; hold_reason?: string | null; resume_condition?: string | null; priority_reason?: string | null; deleted_by?: string | null; created_by?: string | null; draft_import_id?: string | null; no_spec_reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; client_share?: unknown; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type TicketsInput = { number?: string; kind_id?: string; stage_id?: string; title?: string; assignee_member_id?: string | null; completed_at?: string | null; completed_by?: string | null; delegated_to_clone?: boolean; client_id?: string | null; parent_ticket_id?: string | null; derived_from_ticket_id?: string | null; start_on?: string | null; due_on?: string | null; priority?: string; estimate_minutes?: number | null; actual_minutes?: number | null; work_type_id?: string | null; work_type_version?: number | null; hold_reason?: string | null; resume_condition?: string | null; priority_reason?: string | null; deleted_by?: string | null; draft_import_id?: string | null; no_spec_reason?: string | null };
export type TicketSections = { ticket_id?: string; section_key?: string; position?: number; body?: unknown; version?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketSectionsInput = { ticket_id?: string; section_key?: string; position?: number; body?: unknown };
export type TicketSectionVersions = { ticket_id?: string; section_id?: string; version?: number; body?: unknown; edited_by?: string | null; edited_at?: string; edited_by_clone?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; restored_from?: number | null; updated_by?: string | null };
export type TicketSectionVersionsInput = { ticket_id?: string; section_id?: string; body?: unknown; edited_by?: string | null; edited_at?: string; edited_by_clone?: boolean };
export type TicketKinds = { name?: string; color?: string | null; position?: number; is_builtin?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string; body_template?: unknown | null; created_by?: string | null; deleted_at?: string | null; description?: string | null; updated_by?: string | null };
export type TicketKindsInput = { name?: string; color?: string | null; position?: number; is_builtin?: boolean };
export type KindSections = { kind_id?: string; section_key?: string; label?: string; mode?: string; position?: number; default_test_specs?: unknown | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; client_visible?: boolean; content_type?: string; created_by?: string | null; deleted_at?: string | null; hint?: string | null; updated_by?: string | null; used_for_acceptance?: boolean };
export type KindSectionsInput = { kind_id?: string; section_key?: string; label?: string; mode?: string; position?: number; default_test_specs?: unknown | null };
export type TicketStages = { name?: string; position?: number; is_fixed?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; key?: string | null; updated_by?: string | null };
export type TicketStagesInput = { name?: string; position?: number; is_fixed?: boolean };
export type ClassAxes = { key?: string; name?: string; is_builtin?: boolean; position?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ClassAxesInput = { key?: string; name?: string; is_builtin?: boolean; position?: number };
export type ClassValues = { axis_id?: string; label?: string; color?: string | null; position?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ClassValuesInput = { axis_id?: string; label?: string; color?: string | null; position?: number };
export type TicketClassValues = { ticket_id?: string; value_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketClassValuesInput = { ticket_id?: string; value_id?: string };
export type CustomFields = { name?: string; field_type?: string; required?: boolean; description?: string | null; options?: unknown; position?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type CustomFieldsInput = { name?: string; field_type?: string; required?: boolean; description?: string | null; options?: unknown; position?: number };
export type CustomFieldKinds = { field_id?: string; kind_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type CustomFieldKindsInput = { field_id?: string; kind_id?: string };
export type TicketFieldValues = { ticket_id?: string; field_id?: string; value?: unknown; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketFieldValuesInput = { ticket_id?: string; field_id?: string; value?: unknown };
export type HandoverRules = { target?: string; axis_id?: string | null; mode?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type HandoverRulesInput = { target?: string; axis_id?: string | null; mode?: string };
export type TestSpecs = { ticket_id?: string; check_kind?: string | null; title?: string; judge_type?: string | null; params?: unknown; version?: number; off_reason?: string | null; checked_at?: string | null; checked_by_member_id?: string | null; checked_by_ai?: boolean; source?: string; source_ref_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TestSpecsInput = { ticket_id?: string; check_kind?: string | null; title?: string; judge_type?: string | null; params?: unknown; off_reason?: string | null; checked_at?: string | null; checked_by_member_id?: string | null; checked_by_ai?: boolean; source?: string; source_ref_id?: string | null };
export type Checks = { ticket_id?: string; test_spec_id?: string; spec_version?: number; artifact_version_id?: string | null; attempt?: number; result?: string; evidence?: unknown; runner?: string; checked_by_member_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ChecksInput = { ticket_id?: string; test_spec_id?: string; spec_version?: number; artifact_version_id?: string | null; attempt?: number; result?: string; evidence?: unknown; runner?: string; checked_by_member_id?: string | null };
export type TicketDecisions = { ticket_id?: string; text?: string; reason?: string | null; decided_by?: string | null; decided_at?: string; source_message_id?: string | null; superseded_by_id?: string | null; promoted_to?: string; decided_note?: string | null; cancelled_at?: string | null; cancelled_by?: string | null; cancel_reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketDecisionsInput = { ticket_id?: string; text?: string; reason?: string | null; decided_by?: string | null; decided_at?: string; source_message_id?: string | null; superseded_by_id?: string | null; promoted_to?: string; decided_note?: string | null; cancelled_at?: string | null; cancelled_by?: string | null; cancel_reason?: string | null };
export type TicketMessages = { ticket_id?: string; author_member_id?: string | null; kind?: string; body?: string | null; mentions?: string[]; changes?: unknown | null; quote_of_id?: string | null; reactions?: unknown; notify_member_ids?: string[]; quote_text?: string | null; edited_at?: string | null; deleted_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketMessagesInput = { ticket_id?: string; author_member_id?: string | null; kind?: string; body?: string | null; mentions?: string[]; changes?: unknown | null; quote_of_id?: string | null; reactions?: unknown; notify_member_ids?: string[]; quote_text?: string | null; edited_at?: string | null; deleted_by?: string | null };
export type ReferenceLogs = { ticket_id?: string; action_run_id?: string | null; ref_type?: string; ref_id?: string | null; url?: string | null; title?: string | null; seen_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ReferenceLogsInput = { ticket_id?: string; action_run_id?: string | null; ref_type?: string; ref_id?: string | null; url?: string | null; title?: string | null; seen_at?: string };
export type KnowledgePages = { is_personal?: boolean; parent_page_id?: string | null; title?: string; summary?: string; is_must?: boolean; copied_from_page_id?: string | null; folder_id?: string | null; position?: number; owner_member_id?: string; state?: string; verify_interval_days?: number | null; verified_at?: string | null; verify_due_on?: string | null; topics?: string[]; current_version?: number; form?: string; archived_at?: string | null; archived_to_page_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type KnowledgePagesInput = { is_personal?: boolean; parent_page_id?: string | null; title?: string; summary?: string; is_must?: boolean; copied_from_page_id?: string | null; folder_id?: string | null; position?: number; owner_member_id?: string; state?: string; verify_interval_days?: number | null; verified_at?: string | null; verify_due_on?: string | null; topics?: string[]; current_version?: number; form?: string; archived_at?: string | null; archived_to_page_id?: string | null };
export type KnowledgePageVersions = { page_id?: string; version?: number; kind?: string; body?: unknown; note?: string | null; author_member_id?: string | null; proposed_from_ticket_id?: string | null; proposed_by_clone?: boolean; decision?: string | null; decline_reason?: string | null; decided_by?: string | null; decided_at?: string | null; published_by?: string | null; published_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type KnowledgePageVersionsInput = { page_id?: string; kind?: string; body?: unknown; note?: string | null; author_member_id?: string | null; proposed_from_ticket_id?: string | null; proposed_by_clone?: boolean; decision?: string | null; decline_reason?: string | null; decided_by?: string | null; decided_at?: string | null; published_by?: string | null; published_at?: string | null };
export type KnowledgeLinks = { nodes?: string[]; edges?: string[]; unlinked_mentions?: string[] };
export type KnowledgeLinksInput = { from_page_id?: string; to_type?: string; to_id?: string; anchor?: string | null };
export type KnowledgeFolders = { is_personal?: boolean; owner_member_id?: string; parent_folder_id?: string | null; name?: string; position?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; scope_id?: string; updated_by?: string | null };
export type KnowledgeFoldersInput = { is_personal?: boolean; owner_member_id?: string; parent_folder_id?: string | null; name?: string; position?: number };
export type Clients = { name?: string; owner_member_id?: string | null; visibility?: string; default_share?: unknown; routing?: string | null; email_domain?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ClientsInput = { name?: string; owner_member_id?: string | null; visibility?: string; default_share?: unknown; routing?: string | null; email_domain?: string | null };
export type ClientGroups = { client_id?: string; scope_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ClientGroupsInput = { client_id?: string };
export type ClientContacts = { client_id?: string; name?: string; email?: string | null; role?: string; member_id?: string | null; cc_role?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ClientContactsInput = { client_id?: string; name?: string; email?: string | null; role?: string; member_id?: string | null; cc_role?: string };
export type ClientRequests = { client_id?: string; contact_id?: string | null; title?: string; body?: string | null; due_on?: string | null; state?: string; ticket_id?: string | null; routed_scope_id?: string | null; questions?: unknown; decline_reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ClientRequestsInput = { client_id?: string; contact_id?: string | null; title?: string; body?: string | null; due_on?: string | null; state?: string; ticket_id?: string | null; routed_scope_id?: string | null; questions?: unknown; decline_reason?: string | null };
export type Acceptances = { ticket_id?: string; artifact_version_id?: string | null; contact_id?: string; due_on?: string | null; message?: string | null; result?: string | null; comment?: string | null; decided_at?: string | null; reminded_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type AcceptancesInput = { ticket_id?: string; artifact_version_id?: string | null; contact_id?: string; due_on?: string | null; message?: string | null; result?: string | null; comment?: string | null; decided_at?: string | null; reminded_at?: string | null };
export type TenantMemberships = { auth_user_id?: string | null; member_id?: string; role?: string; status?: string; joined_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TenantMembershipsInput = { auth_user_id?: string | null; member_id?: string; role?: string; status?: string; joined_at?: string | null };
export type TermsVersions = { kind?: string; version?: string; url?: string; published_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TermsVersionsInput = { kind?: string; url?: string; published_at?: string };
export type TermsConsents = { member_id?: string; auth_user_id?: string | null; terms_version_id?: string; agreed_at?: string; ip?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TermsConsentsInput = { member_id?: string; auth_user_id?: string | null; terms_version_id?: string; agreed_at?: string; ip?: string | null };
export type Passkeys = { auth_user_id?: string; credential_id?: string; public_key?: string; name?: string; transports?: string; last_used_at?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PasskeysInput = { auth_user_id?: string; credential_id?: string; public_key?: string; name?: string; transports?: string; last_used_at?: string; revoked_at?: string };
export type Operations = { key?: string; name?: string; kind?: string; current_version?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type OperationsInput = { key?: string; name?: string; kind?: string; current_version?: number };
export type TicketLinks = { from_ticket_id?: string; to_ticket_id?: string; kind?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketLinksInput = { from_ticket_id?: string; to_ticket_id?: string; kind?: string };
export type TicketHandovers = { ticket_id?: string; kind?: string; from_member_id?: string; to_member_id?: string | null; to_scope_id?: string | null; reason?: string | null; ask?: string | null; reply_due?: string | null; switch?: unknown; state?: string; decline_reason?: string | null; decided_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketHandoversInput = { ticket_id?: string; kind?: string; from_member_id?: string; to_member_id?: string | null; to_scope_id?: string | null; reason?: string | null; ask?: string | null; reply_due?: string | null; switch?: unknown; state?: string; decline_reason?: string | null; decided_at?: string | null };
export type SavedViews = { member_id?: string; name?: string; share?: string; scope_id?: string | null; filters?: unknown; columns?: unknown; density?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type SavedViewsInput = { member_id?: string; name?: string; share?: string; filters?: unknown; columns?: unknown; density?: string };
export type TicketImports = { uploaded_by?: string; scope_id?: string; source?: string; mapping?: unknown; rows?: number; errors?: unknown; state?: string; committed_at?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type TicketImportsInput = { uploaded_by?: string; source?: string; mapping?: unknown; rows?: number; errors?: unknown; state?: string; committed_at?: string | null };
export type LearningCandidates = { owner_member_id?: string; trigger?: string; proposed_as?: string; text?: string; evidence?: unknown; check_result?: unknown; decided_by?: string | null; state?: string; decided_at?: string | null; result_type?: string | null; result_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type LearningCandidatesInput = { owner_member_id?: string; trigger?: string; proposed_as?: string; text?: string; evidence?: unknown; check_result?: unknown; decided_by?: string | null; state?: string; decided_at?: string | null; result_type?: string | null; result_id?: string | null };
export type BridgePairingCodes = { member_id?: string; code_hash?: string; expires_at?: string; used_at?: string | null; used_session_id?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type BridgePairingCodesInput = { member_id?: string; code_hash?: string; expires_at?: string; used_at?: string | null; used_session_id?: string | null };
export type NotificationSettings = { email_digest?: boolean; quiet_hours?: Record<string, unknown>; paused_until?: string | null; urgent_override?: string[]; events?: string[] };
export type NotificationSettingsInput = { member_id?: string; email_digest?: boolean; quiet_hours?: unknown; paused_until?: string | null; urgent_override?: unknown };
export type OpsPlanProposals = { plan_id?: string; from_version?: number | null; to_version?: number | null; changes?: unknown; existing_policy?: string; notice_days?: number | null; new_from?: string | null; reason?: string; proposed_by?: string; decided_by?: string | null; state?: string; decided_at?: string | null; return_reason?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type OpsPlanProposalsInput = { plan_id?: string; from_version?: number | null; to_version?: number | null; changes?: unknown; existing_policy?: string; notice_days?: number | null; new_from?: string | null; reason?: string; proposed_by?: string; decided_by?: string | null; state?: string; decided_at?: string | null; return_reason?: string | null };
export type ScopeMemberships = { member_id?: string; scope_id?: string; is_primary?: boolean; role?: string; since?: string; changed_by?: string | null; id: string; tenant_id?: string; created_at?: string; updated_at?: string; created_by?: string | null; deleted_at?: string | null; updated_by?: string | null };
export type ScopeMembershipsInput = { member_id?: string; is_primary?: boolean; role?: string; since?: string; changed_by?: string | null };
export type RoleBundleDefaults = { role?: string; target_kind_id?: string; ability_id?: string; scope_kind?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type RoleBundleDefaultsInput = { role?: string; target_kind_id?: string; ability_id?: string; scope_kind?: string };
export type StepUpInput = { password?: string; code?: string; passkey?: Record<string, unknown> };
export type PasskeyRenameInput = { name: string };
export type SignupInput = { email: string; name: string; company_name?: string; password: string };
export type SignupResendInput = Record<string, never>;
export type SignupVerifyInput = { token: string };
export type PasswordForgotInput = { email: string };
export type SignInInput = { email: string; password: string };
export type SignInCodeInput = { pending: string; code?: string | null; backup_code?: string | null };
export type SignOutInput = Record<string, never>;
export type AdminRecoveryInput = { pending: string };
export type TwoFactorStartInput = { password?: string | null };
export type TwoFactorConfirmInput = { code: string };
export type PasswordChangeInput = { current_password: string; new_password: string };
export type PasswordSetInput = { new_password: string };
export type PasswordResetInput = { token: string; new_password: string };
export type TermsConsentInput = { agree: boolean; terms_version_id: string; privacy_version_id: string };
export type PairingCodeInput = Record<string, never>;
export type BridgeClaimInput = { code: string; device_label?: string; machine_id?: string | null };
export type BridgeHeartbeatInput = { health?: unknown; protocol?: unknown; version?: string };
export type TicketCreateInput = { scope_id: string; kind_id: string; title: string; assignee_member_id: string; due_on: string; start_on?: string; priority?: string; priority_reason?: string; parent_ticket_id?: string; estimate_minutes?: unknown | null; sections?: Record<string, unknown>; notify_member_ids?: string[]; draft_id?: string; source_draft_id?: string };
export type TicketDraftInput = { draft_id: string; body?: Record<string, unknown>; discard?: boolean };
export type DismissSetupTasksInput = { key?: string };
export type TicketDelegateInput = { no_spec_reason?: string };
export type BridgeTakeInput = { wait_sec?: number; protocol?: number; idle?: boolean };
export type BridgeProgressInput = { seq?: number; kind: string; text?: string; agent_session_id?: string; model?: string; tool?: unknown; usage?: unknown; todos?: unknown; windows?: unknown; blocked?: unknown };
export type BridgeFinishInput = { state: string; result?: string; reason?: string; agent_session_id?: string };
export type BridgeToolInput = { input?: unknown };
export type ApprovalApproveInput = Record<string, never>;
export type ApprovalReturnInput = { note: string };
export type InvitationAcceptInput = { name?: string | null; password?: string | null };
export type TicketCompleteInput = { todo_checked?: string[] | null; todo_version?: number | null; conditions_confirmed: boolean };
export type InvitationResendInput = Record<string, never>;
export type CredentialCreateInput = { layer: string; kind: string; name: string; description?: string | null; login?: string; password?: string; value?: string; two_factor?: string; totp_secret?: string; destinations: string[]; expires_on?: string | null };
export type CredentialUpdateInput = { login?: string; password?: string; value?: string; two_factor?: string; totp_secret?: string; destinations?: string[]; expires_on?: string | null; description?: string | null; reason?: string };
export type CredentialResolveInput = { job_id: string; credential_id: string; destination: string; executor_key: string };
export type CredentialLoginCheckInput = Record<string, never>;
export type CredentialLoginAnswerInput = { request_ref: string; code?: string; approved?: boolean };
export type CredentialCheckReportInput = { job_id: string; state: string; detail?: string; request_ref?: string; ask_kind?: string; text?: string };
export type DeviceBrowserInput = { browser: string };
export type DeviceBrowserCheckInput = Record<string, never>;
export type BridgeBrowserInput = { browser: string };
export type TicketTimelineSeenInput = { seen_at?: string | null };
export type TicketMessageInput = { body: string; mention_member_ids?: string[]; notify_member_ids?: string[]; quote_of_id?: string | null; stage_key?: string; stage_id?: string; hold_reason?: string; resume_condition?: string };
export type TicketMessageEditInput = { body: string; mention_member_ids?: string[] };
export type TicketMessageStarInput = Record<string, never>;
export type TicketUpdateInput = { stage_id?: string; stage_key?: string; actual_minutes?: number | null; hold_reason?: string; resume_condition?: string };
export type TicketDecisionInput = { text: string; reason?: string | null; decided_by_member_id?: string | null; decided_note?: string | null; source_message_id?: string | null; promoted_to?: string | null };
export type TicketDecisionUpdateInput = { action: string; text?: string | null; reason?: string | null };
export type InvitationsCreateInput = { emails: string[]; scope_id: string; role_key: string; message?: string | null };
export type InvitationLinkCreateInput = { scope_id: string; role_key: string };
export type TicketBodyInput = { version: number; doc: Record<string, unknown> };
export type TestSpecCreateInput = { title: string };
export type TestSpecUpdateInput = { version: number; checked?: boolean; title?: string };
export type TicketLinkInput = { other_ticket_id: string; kind: string };
export type SavedViewInput = { name: string; share?: string; scope_id?: string | null; filters?: Record<string, unknown>; columns?: string[]; density?: string };
export type ActionRunTakeoverInput = Record<string, never>;
export type KnowledgeFolderCreateInput = { shelf: string; group_id?: string | null; parent_folder_id?: string | null; name: string };
export type KnowledgeFolderUpdateInput = { name?: string; parent_folder_id?: string | null; position?: number };
export type KnowledgePageCreateInput = { shelf: string; group_id?: string | null; folder_id?: string | null; title: string; desc?: string };
export type KnowledgeDraftInput = { title?: string; desc?: string; doc?: Record<string, unknown> };
export type KnowledgePublishInput = Record<string, never>;
export type KnowledgePageMoveInput = { folder_id?: string | null; position?: number };
export type KnowledgeMustInput = { must: boolean };
export type KnowledgeSimilarInput = { title: string; desc?: string; text?: string; exclude_page_id?: string };
export type KnowledgeCopyInput = { folder_id?: string | null };
export type ScopeOverview = { by_stage?: string[]; milestones?: string[]; recent?: string[]; total?: number };
export type TicketKindChangePreview = { added_sections?: string[]; removed_sections?: string[]; moved_to_body?: string[]; checks_reset?: boolean };
export type TicketDeletePreview = { children?: number; descendants?: number; attachments?: number; artifacts?: number; pending_approvals?: number; links?: number; running_runs?: number; descendant_pending_approvals?: number; descendant_running_runs?: number; restorable_until?: string };
export type SearchHit = { kind?: string; id?: string; title?: string; snippet?: string; url?: string };
export type TimelineItem = { id?: string; kind?: string; at?: string; actor?: Record<string, unknown> | null; message?: Record<string, unknown> | null; changes?: string[] | null; run?: Record<string, unknown> | null; deleted?: Record<string, unknown> | null };
export type TestSpecLint = { missing?: string[]; warnings?: string[] };
export type TicketCompletion = { ticket?: Record<string, unknown>; knowledge_candidates?: string[]; skipped_reason?: string; unchecked?: Record<string, unknown> };
export type BulkResult = { updated?: string[]; skipped?: string[] };
export type ApprovalQueueItem = { kind?: string; id?: string; ticket_id?: string | null; ticket_number?: string; title?: string; from_member_id?: string; from_name?: string; check_summary?: string; due_on?: string | null; decide_inline?: boolean; irreversible?: boolean; primary_action?: string; secondary_action?: string; note?: string | null; created_at?: string };
export type ApprovalDetail = { approval?: Record<string, unknown>; ticket?: Record<string, unknown>; operation?: Record<string, unknown>; message_text?: string; artifact_version?: Record<string, unknown>; checks?: string[]; check_summary?: string; cautions?: string[]; irreversible?: boolean; can_decide?: boolean; chain?: string[] };
export type BulkApprovalPreview = { eligible?: string[]; excluded?: string[] };
export type CloneNow = { current?: Record<string, unknown>; next?: string[]; waiting_approvals?: number; stopped?: number };
export type CloneGrowth = { delegated?: number; passed_without_edit_rate?: number; saved_hours?: number; trend?: string[]; often_fixed?: string[] };
export type KnowsCounts = { rules?: number; work_types?: number; memories?: number; candidates?: number };
export type ActivityItem = { kind?: string; at?: string; title?: string; ticket_id?: string | null; used?: string[]; result?: string };
export type SignupCreated = { email?: string; sent?: boolean; mail_error?: string | null; mail_error_kind?: string | null; expires_at?: string; signup_token?: string };
export type SignupResent = { email?: string | null; sent?: boolean; mail_error?: string | null; mail_error_kind?: string | null; pending?: boolean; registered?: boolean; expired?: boolean };
export type SignupStatus = { state?: string; email?: string | null; expires_at?: string | null };
export type SignupVerified = { email?: string; token?: string | null; signed_in?: boolean; terms_pending?: boolean };
export type PasswordForgotAccepted = { accepted?: boolean };
export type SignInResult = { token?: string | null; two_factor?: boolean; pending?: string | null };
export type SignInCodeResult = { token?: string; backup_codes_left?: number };
export type SignedOut = { signed_out?: boolean };
export type AdminRecoveryResult = { result?: string };
export type PasswordResetDone = { reset?: boolean };
export type CurrentTerms = { id?: string; kind?: string; version?: string; url?: string; published_at?: string };
export type TermsConsented = { consented?: boolean };
export type ConversationCreated = { id?: string; conversation_id?: string };
export type ConversationUpdated = { id?: string; ok?: boolean };
export type MemoryUpdated = { id?: string; ok?: boolean };
export type MySecurity = { passkeys?: string[]; has_password?: boolean; two_factor?: boolean; two_factor_required?: boolean; backup_codes_left?: number | null; mfa_pending?: boolean };
export type TwoFactorSetup = { otpauth_uri?: string; secret?: string };
export type TwoFactorEnabled = { backup_codes?: string[]; token?: string | null };
export type BackupCodes = { codes?: string[] };
export type StepUp = { step_up_at?: string; valid_until?: string };
export type PasswordChanged = { revoked?: number };
export type PasswordSet = { ok?: boolean };
export type Me = { member?: Record<string, unknown>; workspaces?: string[]; workspace_name?: string | null };
export type MyUsage = { five_hour?: Record<string, unknown>; month?: Record<string, unknown>; by_workspace?: string[]; notify_at_percent?: number; on_exhausted?: string };
export type SetupTask = { key?: string; label?: string; desc?: string; done?: boolean; href?: string | null; available?: boolean; optional?: boolean; skipped?: boolean };
export type SetupTasksDismissed = { dismissed?: boolean; skipped?: string[] };
export type PairingCode = { code?: string; expires_at?: string };
export type BridgeRelease = { released?: boolean; version?: string; released_at?: string; update?: Record<string, unknown> | null };
export type BridgeClaim = { device_token?: string; device_id?: string; member_id?: string; device_label?: string };
export type BridgeReleaseLink = { url?: string; expires_at?: string };
export type BridgeHeartbeat = { ok?: boolean; browser?: string | null; outdated?: boolean; device_id?: string };
export type BridgeDevice = { id?: string; device_label?: string | null; state?: string; last_seen_at?: string | null; connected_at?: string; version?: string | null; health?: string[]; health_at?: string | null; browser?: string; revoke_reason?: string | null };
export type TicketDetail = { ticket?: Record<string, unknown>; sections?: string[]; kind?: Record<string, unknown> | null; stage?: Record<string, unknown> | null; assignee?: Record<string, unknown> | null; can?: Record<string, unknown>; approval?: Record<string, unknown> | null; completed?: Record<string, unknown> | null; time?: Record<string, unknown>; hold?: Record<string, unknown> | null };
export type TicketKindChoice = { id?: string; name?: string; color?: string | null; position?: number; is_builtin?: boolean; sections?: string[] };
export type TicketDraft = { draft_id?: string; body?: Record<string, unknown> | null; saved_at?: string | null };
export type BridgeJob = { job?: Record<string, unknown> | null; forbidden_domains?: string[]; next_ms?: number; outdated?: boolean };
export type JobControl = { stop?: boolean; reason?: string | null; steers?: string[] };
export type TicketDelegation = { run_id?: string; job_id?: string; status?: string; pc?: string };
export type ApprovalDecided = { id?: string; decision?: string | null; decided_at?: string | null; status_id?: string | null; ticket_id?: string | null; run_id?: string; pc?: string };
export type BridgeFinish = { ok?: boolean; outcome?: string };
export type BridgeToolResult = { result?: Record<string, unknown> | null };
export type ActionRunView = { id?: string; ticket_id?: string; phase?: string; status?: string; by?: Record<string, unknown>; pc?: string; silent?: boolean; last_event_at?: string | null; progress?: string | null; stopped_reason?: string | null; return_reason?: string | null; started_at?: string | null; finished_at?: string | null; taken_over_at?: string | null; reason_kind?: string | null; checks?: Record<string, unknown> };
export type ResolvedCredential = { credential_id?: string; kind?: string; name?: string; destinations?: string[]; two_factor?: string; expires_at?: string | null; server_key?: string; iv?: string; tag?: string; ciphertext_for_executor?: string };
export type WorkTypeUploadCheck = { package?: Record<string, unknown>; checks?: string[]; passed?: boolean; test_scenarios?: number; changelog?: string | null };
export type PlanProposalImpact = { tenants?: number; monthly_revenue_diff?: number; existing_from?: string; new_from?: string | null; by_workspace?: string[] };
export type RuleCheck = { conflicts?: string[]; similar?: string[]; needs_approval_from?: string; warnings?: string[] };
export type WorkspaceMembers = { groups?: string[]; invitations?: string[]; alerts?: string[]; count?: number };
export type InvitationLink = { url?: string; expires_at?: string };
export type MemberDetail = { member?: Record<string, unknown>; groups?: string[]; role_bundle?: Record<string, unknown>; granted?: string[]; revoked?: string[]; assigned?: Record<string, unknown>; clone?: Record<string, unknown>; login?: Record<string, unknown>; recent_events?: string[] };
export type MemberRemovalPreview = { tickets?: string[]; handovers_cancelled?: string[]; approvals_reassigned?: string[]; sole_approver?: string[]; deleted?: string[]; kept?: string[]; restorable_until?: string };
export type WorkspaceRules = { rules?: string[]; rules_by_layer?: string[]; escalations?: string[]; work_types?: string[] };
export type EscalationPreview = { matched_last_month?: number; examples?: string[] };
export type ExportStatus = { status?: string; url?: string; expires_at?: string | null };
export type WorkspaceSettings = { workspace?: Record<string, unknown>; plan?: Record<string, unknown>; subscription?: Record<string, unknown>; price_change?: Record<string, unknown>; permissions?: string[]; fixed_rules?: string[]; deletion?: Record<string, unknown> };
export type PlanChoice = { plan_id?: string; name?: string | null; price_monthly?: number | null; limits?: Record<string, unknown> | null; current?: boolean; can_choose?: boolean; reason?: string; effective_from?: string };
export type Billing = { payee?: Record<string, unknown>; billing_contact?: Record<string, unknown>; terms?: string; invoices?: string[] };
export type SignedUrl = { url?: string; expires_at?: string };
export type ClientRow = { id?: string; name?: string; summary?: string; groups?: string[]; owner_member_id?: string | null; visibility?: string; active_tickets?: number; open_requests?: number; waiting_acceptances?: number; last_activity_at?: string };
export type ClientLinkCandidate = { ticket_id?: string; number?: string; title?: string; reason?: string };
export type ClientDetail = { client?: Record<string, unknown>; groups?: string[]; contacts?: string[]; todo?: string[]; rules?: string[]; knowledge?: string[]; counts?: Record<string, unknown> };
export type ClientActivityItem = { at?: string; actor?: Record<string, unknown>; kind?: string; text?: string; ticket_id?: string; client_visible?: boolean };
export type PortalHome = { to_review?: string[]; requests?: string[]; tickets?: string[] };
export type ClientRequestDetail = { request?: Record<string, unknown>; messages?: string[]; ticket_draft?: Record<string, unknown>; questions?: string[]; reply_draft?: string; route_suggestion?: Record<string, unknown> };
export type PortalQuestions = { available?: boolean; questions?: string[] };
export type PortalRequest = { request?: Record<string, unknown>; messages?: string[] };
export type PortalTicket = { title?: string; stage?: string; due_on?: string | null; artifacts?: string[]; messages?: string[]; sections?: string[] };
export type PortalAcceptance = { acceptance?: Record<string, unknown>; artifact?: Record<string, unknown>; preview_url?: string; message?: string | null; due_on?: string | null };
export type KnowledgeHome = { to_verify?: string[]; proposals?: string[]; recent?: string[]; popular?: string[]; count?: number };
export type KnowledgeTree = { company_name?: string; company_nodes?: string[]; groups?: string[]; my_nodes?: string[]; can_write?: Record<string, unknown>; admin_counts?: Record<string, unknown> | null; truncated?: boolean };
export type KnowledgeAnswer = { mode?: string; answer?: string; citations?: string[]; hits?: string[] };
export type KnowledgePageDetail = { id?: string; title?: string; desc?: string; state?: string; must?: boolean; must_blocked?: string | null; place?: Record<string, unknown>; acts?: string[]; body?: Record<string, unknown> | null; draft?: Record<string, unknown> | null; request?: Record<string, unknown> | null; copied_from?: Record<string, unknown> | null; shared_from?: Record<string, unknown> | null; raise_to?: Record<string, unknown> | null; foot?: Record<string, unknown> };
export type KnowledgeUsage = { reads_3m?: number; returns?: number; recent_tickets?: string[]; hot_sections?: string[] };
export type KnowledgeLinkTarget = { kind?: string; id?: string; title?: string; place?: string };
export type KnowledgeVerification = { page_id?: string; title?: string; place?: string; owner_member_id?: string; due_on?: string; interval?: string; ai_check?: string; suggested_action?: string; newer_page_id?: string };
export type KnowledgeImportPreview = { source?: string; pages?: number; folders?: number; links?: number; topics?: number; images?: number; mapping?: Record<string, unknown>; warnings?: string[] };
export type OpsWorkspaceRow = { id?: string; name?: string; admin?: Record<string, unknown>; plan?: string; members?: string; pc_connected?: string; runs_month?: number; attention?: string[]; billing?: string; state?: string };
export type OpsWorkspace = { workspace?: Record<string, unknown>; pc?: Record<string, unknown>; runs?: Record<string, unknown>; stopped?: Record<string, unknown>; files?: Record<string, unknown>; stop_reasons?: string[]; recent?: string[]; info?: Record<string, unknown> };
export type OpsWorkspaceMember = { name?: string; email?: string; role?: string; last_seen_at?: string; pc?: string; login?: string };
export type OpsWorkspaceBilling = { plan?: Record<string, unknown>; usage?: Record<string, unknown>; payment_terms?: string; invoices?: string[] };
export type Shell = { approvals_waiting?: number; notifications_unread?: number; groups?: string[]; pc?: Record<string, unknown>; setup_left?: number; banner?: Record<string, unknown>; workspace?: Record<string, unknown> };
export type OpsShell = { inquiries_unassigned?: number; inquiries_mine?: number; invoices_overdue?: number; banner?: Record<string, unknown> };
export type TicketShape = { kinds?: string[]; stages?: string[]; axes?: string[]; handover_rules?: string[]; limits?: Record<string, unknown>; template_updates?: number };
export type TicketShapeChangePreview = { removed?: string[]; needs_move_to?: string[]; affected_tickets?: number; over_limits?: string[] };
export type OpsInquiryDetail = { inquiry?: Record<string, unknown>; messages?: string[]; context?: Record<string, unknown>; workspace?: Record<string, unknown> };
export type OpsNoticeDetail = { notice?: Record<string, unknown>; updates?: string[]; affects?: Record<string, unknown>; placements?: string[] };
export type PublicServiceStatus = { incidents?: string[]; maintenance?: Record<string, unknown> | null };
export type InvitationPreview = { state?: string; workspace_name?: string; inviter_name?: string | null; group_name?: string | null; role?: string; message?: string | null; email?: string | null; expires_at?: string; account_exists?: boolean; signed_in?: Record<string, unknown> | null };
export type InvitationAccepted = { token?: string; workspace_id?: string; next?: string };
export type ServiceStatus = { components?: string[]; banner?: Record<string, unknown>; maintenance?: Record<string, unknown> };
export type InvitationResendResult = { result?: string };
export type Credential = { id?: string; name?: string; description?: string | null; layer?: string; kind?: string; two_factor?: string; destinations?: string[]; expires_on?: string | null; use_count?: number; last_used_at?: string | null; login_check?: Record<string, unknown>; can_edit?: boolean; created_at?: string; updated_at?: string };
export type CredentialDeleted = { id?: string };
export type CredentialLoginCheck = { state?: string; job_id?: string | null };
export type CredentialLoginAnswer = { accepted?: boolean };
export type CredentialCheckReport = { accepted?: boolean; code?: string | null };
export type RevokedDevice = { id?: string; device_label?: string | null; revoked_at?: string | null; revoke_reason?: string };
export type DeviceBrowser = { id?: string; browser?: string };
export type DeviceBrowserCheck = { job_id?: string };
export type BridgeBrowser = { browser?: string };
export type TicketTimelineSeen = { ticket_id?: string; seen_at?: string };
export type TicketMessageStar = { id?: string; stars?: number; starred?: boolean };
export type TicketUpdated = { ticket?: Record<string, unknown>; stage?: Record<string, unknown>; changed?: boolean; message_id?: string | null };
export type TicketDecision = { id?: string; ticket_id?: string; text?: string; reason?: string | null; decided_by?: Record<string, unknown> | null; decided_note?: string | null; decided_at?: string; source?: Record<string, unknown> | null; revises_id?: string | null; superseded_by_id?: string | null; cancelled?: Record<string, unknown> | null; promoted_to?: string };
export type TicketDecisionCreated = { decision?: Record<string, unknown>; message_id?: string };
export type TicketDecisionChange = { decision?: Record<string, unknown>; previous?: Record<string, unknown> | null; message_id?: string };
export type InvitationsSent = { invitations?: string[] };
export type BodySaved = { version?: number; changed?: boolean; edited_at?: string };
export type TestSpecItem = { id?: string; title?: string; checked?: boolean; position?: number; source?: string; version?: number };
export type TicketLink = { id?: string; kind?: string; side?: string | null; other?: Record<string, unknown>; can_remove?: boolean; created_at?: string };
export type TicketLinkDeleted = { id?: string };
export type Notification = { id?: string; kind?: string; tag?: string; href?: string | null; ticket_id?: string | null; number?: string | null; title?: string | null; actor?: Record<string, unknown> | null; params?: Record<string, unknown>; read?: boolean; read_at?: string | null; created_at?: string };
export type SavedView = { id?: string; name?: string; share?: string; scope_id?: string | null; filters?: Record<string, unknown>; columns?: string[]; density?: string; member_id?: string; member_name?: string; mine?: boolean; can_edit?: boolean; created_at?: string; updated_at?: string };
export type TicketDeleted = { id?: string; deleted_count?: number; withdrawn_approvals?: number; stopped_runs?: number; restorable_until?: string };
export type TicketField = { id?: string; name?: string; field_type?: string; required?: boolean; description?: string | null; options?: string[]; position?: number };
export type KnowledgeVersionItem = { version?: number; published_at?: string | null; by_name?: string | null };
export type KnowledgeVersion = { version?: number; published_at?: string | null; by_name?: string | null; body?: Record<string, unknown> };
export type KnowledgeFolder = { id?: string; name?: string; shelf?: string; group_id?: string | null; parent_folder_id?: string | null; position?: number };
export type KnowledgeFolderDeleted = { id?: string };
export type KnowledgePageStub = { id?: string; title?: string; desc?: string; state?: string; must?: boolean; place?: Record<string, unknown> };
export type KnowledgeDraftSaved = { saved_at?: string; title?: string; desc?: string };
export type KnowledgeDraftDiscarded = { id?: string; page_deleted?: boolean };
export type KnowledgePublished = { id?: string; version?: number; published_at?: string | null };
export type KnowledgePageDeleted = { id?: string };
export type KnowledgeMustSet = { id?: string; must?: boolean; used?: number; limit?: number };
export type KnowledgeSimilar = { pages?: string[] };
export type UpdateConversationInput = { title?: string | null; participant_member_ids?: string[] | null; area?: string | null; subject_type?: string | null; parent_conversation_id?: string | null; agent_session_id?: string | null; branched_from_message_id?: string | null; owner_member_id?: string | null; closed_at?: string | null; title_auto?: boolean; starred_at?: string | null; incognito?: boolean; last_read_at?: string | null };
export type UpdateMemoryInput = { kind_id?: string | null; owner_member_id?: string | null; title?: string | null; body: string | null; confidence?: string | null; source_type_id?: string | null; source_ref_id?: string | null; approved_by?: string | null; approved_at?: string | null; digest_id?: string | null; superseded_by?: string | null };

export const ENDPOINTS = [
 {
  "id": "EP-001",
  "method": "POST",
  "path": "/api/v1/acceptances/:id/remind",
  "acts": [
   "A123"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-002",
  "method": "GET",
  "path": "/api/v1/action_runs/:id",
  "acts": [
   "A104"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-003",
  "method": "POST",
  "path": "/api/v1/action_runs/:id/stop",
  "acts": [
   "A89"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-004",
  "method": "POST",
  "path": "/api/v1/action_runs/:id/takeover",
  "acts": [
   "A57"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-005",
  "method": "GET",
  "path": "/api/v1/approvals/:id",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-006",
  "method": "POST",
  "path": "/api/v1/approvals/:id/approve",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-007",
  "method": "POST",
  "path": "/api/v1/approvals/:id/edit",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-008",
  "method": "POST",
  "path": "/api/v1/approvals/:id/return",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-009",
  "method": "POST",
  "path": "/api/v1/approvals/:id/stop",
  "acts": [
   "A15",
   "A89"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-010",
  "method": "POST",
  "path": "/api/v1/approvals/:id/withdraw",
  "acts": [
   "A89"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-011",
  "method": "POST",
  "path": "/api/v1/approvals/bulk",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-012",
  "method": "POST",
  "path": "/api/v1/approvals/bulk/preview",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-013",
  "method": "GET",
  "path": "/api/v1/approvals/history",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-014",
  "method": "GET",
  "path": "/api/v1/approvals/queue",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-015",
  "method": "GET",
  "path": "/api/v1/artifact_versions/:id",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-016",
  "method": "POST",
  "path": "/api/v1/artifact_versions/:id/restore",
  "acts": [
   "A95"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-017",
  "method": "PATCH",
  "path": "/api/v1/artifacts/:id",
  "acts": [
   "A95"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-018",
  "method": "GET",
  "path": "/api/v1/audit_events",
  "acts": [
   "A33"
  ],
  "screens": [
   "audit"
  ]
 },
 {
  "id": "EP-019",
  "method": "GET",
  "path": "/api/v1/auth/invitations/:token",
  "acts": [
   "A03"
  ],
  "screens": [
   "invite-accept"
  ]
 },
 {
  "id": "EP-020",
  "method": "POST",
  "path": "/api/v1/auth/invitations/:token/accept",
  "acts": [
   "A03",
   "A96"
  ],
  "screens": [
   "invite-accept"
  ]
 },
 {
  "id": "EP-021",
  "method": "POST",
  "path": "/api/v1/auth/invitations/:token/resend-request",
  "acts": [
   "A03"
  ],
  "screens": [
   "invite-accept"
  ]
 },
 {
  "id": "EP-022",
  "method": "POST",
  "path": "/api/v1/auth/password/forgot",
  "acts": [
   "A31"
  ],
  "screens": [
   "password-reset"
  ]
 },
 {
  "id": "EP-023",
  "method": "POST",
  "path": "/api/v1/auth/password/reset",
  "acts": [
   "A31"
  ],
  "screens": [
   "password-reset"
  ]
 },
 {
  "id": "EP-024",
  "method": "POST",
  "path": "/api/v1/auth/recovery/admin-request",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-025",
  "method": "GET",
  "path": "/api/v1/auth/service-status",
  "acts": [
   "A13",
   "A135"
  ],
  "screens": [
   "help",
   "login"
  ]
 },
 {
  "id": "EP-026",
  "method": "POST",
  "path": "/api/v1/auth/sign-in",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-027",
  "method": "POST",
  "path": "/api/v1/auth/sign-out",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-028",
  "method": "POST",
  "path": "/api/v1/auth/sign-up",
  "acts": [
   "A01",
   "A96"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-029",
  "method": "POST",
  "path": "/api/v1/auth/sign-up/resend",
  "acts": [
   "A01"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-030",
  "method": "GET",
  "path": "/api/v1/auth/sign-up/status",
  "acts": [
   "A01"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-031",
  "method": "POST",
  "path": "/api/v1/auth/sign-up/verify",
  "acts": [
   "A02"
  ],
  "screens": [
   "verify-email"
  ]
 },
 {
  "id": "EP-032",
  "method": "POST",
  "path": "/api/v1/auth/step-up",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-033",
  "method": "POST",
  "path": "/api/v1/auth/terms/consent",
  "acts": [
   "A96"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-034",
  "method": "GET",
  "path": "/api/v1/auth/terms/current",
  "acts": [
   "A96"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-035",
  "method": "POST",
  "path": "/api/v1/auth/two-factor/verify",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-036",
  "method": "POST",
  "path": "/api/v1/bridge/browser",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-037",
  "method": "POST",
  "path": "/api/v1/bridge/claim",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-038",
  "method": "POST",
  "path": "/api/v1/bridge/credentials/:id/check-result",
  "acts": [
   "A10"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-039",
  "method": "POST",
  "path": "/api/v1/bridge/credentials/resolve",
  "acts": [
   "A10"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-040",
  "method": "GET",
  "path": "/api/v1/bridge/devices",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-041",
  "method": "PATCH",
  "path": "/api/v1/bridge/devices/:id",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-042",
  "method": "DELETE",
  "path": "/api/v1/bridge/devices/:id",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-043",
  "method": "POST",
  "path": "/api/v1/bridge/devices/:id/browser-check",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-044",
  "method": "GET",
  "path": "/api/v1/bridge/files/:ref",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-045",
  "method": "POST",
  "path": "/api/v1/bridge/heartbeat",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-046",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/artifacts",
  "acts": [
   "A95"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-047",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/browser",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-048",
  "method": "GET",
  "path": "/api/v1/bridge/jobs/:id/control",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-049",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/conversation-entries",
  "acts": [
   "A20"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-050",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/finish",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-051",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/progress",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-052",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/questions",
  "acts": [
   "A91"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-053",
  "method": "GET",
  "path": "/api/v1/bridge/jobs/:id/questions/:qid",
  "acts": [
   "A91"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-054",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/tools/:name",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-055",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/take",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-056",
  "method": "GET",
  "path": "/api/v1/bridge/mirror-targets",
  "acts": [
   "A20"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-057",
  "method": "POST",
  "path": "/api/v1/bridge/pairing-codes",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-058",
  "method": "GET",
  "path": "/api/v1/bridge/releases/:name/file",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-059",
  "method": "GET",
  "path": "/api/v1/bridge/releases/latest",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-060",
  "method": "POST",
  "path": "/api/v1/bridge/usage",
  "acts": [
   "A94"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-061",
  "method": "POST",
  "path": "/api/v1/checks/:id/human",
  "acts": [
   "A15"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-062",
  "method": "PATCH",
  "path": "/api/v1/client_contacts/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-063",
  "method": "DELETE",
  "path": "/api/v1/client_contacts/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-064",
  "method": "POST",
  "path": "/api/v1/client_contacts/:id/invitation",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-065",
  "method": "GET",
  "path": "/api/v1/client_requests",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-066",
  "method": "GET",
  "path": "/api/v1/client_requests/:id",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-067",
  "method": "PATCH",
  "path": "/api/v1/client_requests/:id",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-068",
  "method": "POST",
  "path": "/api/v1/client_requests/:id/accept",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-069",
  "method": "POST",
  "path": "/api/v1/client_requests/:id/decline",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-070",
  "method": "POST",
  "path": "/api/v1/client_requests/:id/reply",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-071",
  "method": "GET",
  "path": "/api/v1/clients",
  "acts": [
   "A103",
   "A121"
  ],
  "screens": [
   "clients",
   "tickets"
  ]
 },
 {
  "id": "EP-072",
  "method": "POST",
  "path": "/api/v1/clients",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-073",
  "method": "GET",
  "path": "/api/v1/clients/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-074",
  "method": "PATCH",
  "path": "/api/v1/clients/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-075",
  "method": "GET",
  "path": "/api/v1/clients/:id/activity",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-076",
  "method": "POST",
  "path": "/api/v1/clients/:id/contacts",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-077",
  "method": "GET",
  "path": "/api/v1/clients/:id/portal-preview",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-078",
  "method": "PATCH",
  "path": "/api/v1/clients/:id/share",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-079",
  "method": "GET",
  "path": "/api/v1/clients/link-candidates",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-080",
  "method": "GET",
  "path": "/api/v1/clones/me",
  "acts": [
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-081",
  "method": "PATCH",
  "path": "/api/v1/clones/me",
  "acts": [
   "A91"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-082",
  "method": "GET",
  "path": "/api/v1/clones/me/activity",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-083",
  "method": "POST",
  "path": "/api/v1/clones/me/activity/export",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-084",
  "method": "GET",
  "path": "/api/v1/clones/me/growth",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-085",
  "method": "GET",
  "path": "/api/v1/clones/me/knows/counts",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-086",
  "method": "GET",
  "path": "/api/v1/clones/me/now",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-087",
  "method": "GET",
  "path": "/api/v1/conversations",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-088",
  "method": "POST",
  "path": "/api/v1/conversations",
  "acts": [
   "A100",
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-089",
  "method": "GET",
  "path": "/api/v1/conversations/:id",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-090",
  "method": "PATCH",
  "path": "/api/v1/conversations/:id",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-091",
  "method": "DELETE",
  "path": "/api/v1/conversations/:id",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-092",
  "method": "POST",
  "path": "/api/v1/conversations/:id/attachments",
  "acts": [
   "A90"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-093",
  "method": "GET",
  "path": "/api/v1/conversations/:id/messages",
  "acts": [
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-094",
  "method": "POST",
  "path": "/api/v1/conversations/:id/messages",
  "acts": [
   "A100",
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-095",
  "method": "POST",
  "path": "/api/v1/conversations/:id/permissions/:pid",
  "acts": [
   "A91"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-096",
  "method": "POST",
  "path": "/api/v1/conversations/:id/stop",
  "acts": [
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-097",
  "method": "GET",
  "path": "/api/v1/conversations/:id/stream",
  "acts": [
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-098",
  "method": "GET",
  "path": "/api/v1/credentials",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-099",
  "method": "POST",
  "path": "/api/v1/credentials",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-100",
  "method": "PATCH",
  "path": "/api/v1/credentials/:id",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-101",
  "method": "DELETE",
  "path": "/api/v1/credentials/:id",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-102",
  "method": "POST",
  "path": "/api/v1/credentials/:id/login-check",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-103",
  "method": "POST",
  "path": "/api/v1/credentials/:id/login-check/answer",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-104",
  "method": "POST",
  "path": "/api/v1/exports",
  "acts": [
   "A40"
  ],
  "screens": [
   "audit",
   "company-settings"
  ]
 },
 {
  "id": "EP-105",
  "method": "GET",
  "path": "/api/v1/exports/:id",
  "acts": [
   "A40"
  ],
  "screens": [
   "audit"
  ]
 },
 {
  "id": "EP-106",
  "method": "GET",
  "path": "/api/v1/handover_rules",
  "acts": [
   "A110"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-107",
  "method": "GET",
  "path": "/api/v1/inquiries",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-108",
  "method": "POST",
  "path": "/api/v1/inquiries",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-109",
  "method": "GET",
  "path": "/api/v1/inquiries/:id",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-110",
  "method": "POST",
  "path": "/api/v1/inquiries/:id/messages",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-111",
  "method": "POST",
  "path": "/api/v1/inquiries/:id/resolve",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-112",
  "method": "POST",
  "path": "/api/v1/inquiries/attachments",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-113",
  "method": "POST",
  "path": "/api/v1/invitations",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-114",
  "method": "DELETE",
  "path": "/api/v1/invitations/:id",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-115",
  "method": "POST",
  "path": "/api/v1/invitations/:id/resend",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-116",
  "method": "POST",
  "path": "/api/v1/invitations/link",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-117",
  "method": "GET",
  "path": "/api/v1/invoices/:id/pdf",
  "acts": [
   "A69"
  ],
  "screens": [
   "billing"
  ]
 },
 {
  "id": "EP-118",
  "method": "POST",
  "path": "/api/v1/knowledge/ask",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-119",
  "method": "POST",
  "path": "/api/v1/knowledge/ask/feedback",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-120",
  "method": "POST",
  "path": "/api/v1/knowledge/folders",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-121",
  "method": "PATCH",
  "path": "/api/v1/knowledge/folders/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-122",
  "method": "DELETE",
  "path": "/api/v1/knowledge/folders/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-123",
  "method": "GET",
  "path": "/api/v1/knowledge/home",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-124",
  "method": "GET",
  "path": "/api/v1/knowledge/link-targets",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-125",
  "method": "GET",
  "path": "/api/v1/knowledge/proposals",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-126",
  "method": "POST",
  "path": "/api/v1/knowledge/proposals/:id/accept",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-127",
  "method": "POST",
  "path": "/api/v1/knowledge/proposals/:id/decline",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-128",
  "method": "POST",
  "path": "/api/v1/knowledge/similar",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-129",
  "method": "GET",
  "path": "/api/v1/knowledge/tree",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-130",
  "method": "GET",
  "path": "/api/v1/knowledge/verifications",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-131",
  "method": "POST",
  "path": "/api/v1/knowledge_imports",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-132",
  "method": "GET",
  "path": "/api/v1/knowledge_imports/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-133",
  "method": "POST",
  "path": "/api/v1/knowledge_imports/:id/commit",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-134",
  "method": "GET",
  "path": "/api/v1/knowledge_pages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-135",
  "method": "POST",
  "path": "/api/v1/knowledge_pages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-136",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-137",
  "method": "PATCH",
  "path": "/api/v1/knowledge_pages/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-138",
  "method": "DELETE",
  "path": "/api/v1/knowledge_pages/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-139",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/archive",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-140",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/attachments",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-141",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/copy",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-142",
  "method": "PATCH",
  "path": "/api/v1/knowledge_pages/:id/draft",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-143",
  "method": "DELETE",
  "path": "/api/v1/knowledge_pages/:id/draft",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-144",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/links",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-145",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/links",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-146",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/markdown",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-147",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/messages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-148",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/messages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-149",
  "method": "PUT",
  "path": "/api/v1/knowledge_pages/:id/must",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-150",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/publish",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-151",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/unarchive",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-152",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/usage",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-153",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/verify",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-154",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/versions",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-155",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/versions/:v",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-156",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/versions/:v/restore",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-157",
  "method": "POST",
  "path": "/api/v1/layers",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-158",
  "method": "PATCH",
  "path": "/api/v1/layers/:id",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-159",
  "method": "GET",
  "path": "/api/v1/learning_candidates",
  "acts": [
   "A30",
   "A93"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-160",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/accept",
  "acts": [
   "A30",
   "A93"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-161",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/dismiss",
  "acts": [
   "A30",
   "A93"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-162",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/exception-request",
  "acts": [
   "A131"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-163",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/later",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-164",
  "method": "GET",
  "path": "/api/v1/me",
  "acts": [
   "A74"
  ],
  "screens": [
   "account",
   "tickets"
  ]
 },
 {
  "id": "EP-165",
  "method": "PATCH",
  "path": "/api/v1/me",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-166",
  "method": "POST",
  "path": "/api/v1/me/avatar",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-167",
  "method": "POST",
  "path": "/api/v1/me/backup-codes",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-168",
  "method": "POST",
  "path": "/api/v1/me/email-change",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-169",
  "method": "POST",
  "path": "/api/v1/me/email-change/verify",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-170",
  "method": "GET",
  "path": "/api/v1/me/notification-settings",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-171",
  "method": "PATCH",
  "path": "/api/v1/me/notification-settings",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-172",
  "method": "POST",
  "path": "/api/v1/me/notification-settings/copy",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-173",
  "method": "PATCH",
  "path": "/api/v1/me/passkeys/:id",
  "acts": [
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-174",
  "method": "DELETE",
  "path": "/api/v1/me/passkeys/:id",
  "acts": [
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-175",
  "method": "POST",
  "path": "/api/v1/me/password",
  "acts": [
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-176",
  "method": "PATCH",
  "path": "/api/v1/me/password",
  "acts": [
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-177",
  "method": "GET",
  "path": "/api/v1/me/security",
  "acts": [
   "A04",
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-178",
  "method": "GET",
  "path": "/api/v1/me/sessions",
  "acts": [
   "A74"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-179",
  "method": "DELETE",
  "path": "/api/v1/me/sessions/:id",
  "acts": [
   "A74"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-180",
  "method": "POST",
  "path": "/api/v1/me/sessions/revoke-others",
  "acts": [
   "A74"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-181",
  "method": "GET",
  "path": "/api/v1/me/setup-tasks",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-182",
  "method": "POST",
  "path": "/api/v1/me/setup-tasks/dismiss",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-183",
  "method": "GET",
  "path": "/api/v1/me/ticket-drafts",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-184",
  "method": "POST",
  "path": "/api/v1/me/ticket-drafts",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-185",
  "method": "DELETE",
  "path": "/api/v1/me/two-factor",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-186",
  "method": "POST",
  "path": "/api/v1/me/two-factor/confirm",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-187",
  "method": "POST",
  "path": "/api/v1/me/two-factor/enable",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-188",
  "method": "GET",
  "path": "/api/v1/me/usage",
  "acts": [
   "A94"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-189",
  "method": "DELETE",
  "path": "/api/v1/me/workspaces/:id",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-190",
  "method": "GET",
  "path": "/api/v1/members",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-191",
  "method": "GET",
  "path": "/api/v1/members/:id",
  "acts": [
   "A61"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-192",
  "method": "DELETE",
  "path": "/api/v1/members/:id",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-193",
  "method": "PATCH",
  "path": "/api/v1/members/:id/groups",
  "acts": [
   "A61"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-194",
  "method": "POST",
  "path": "/api/v1/members/:id/nudge",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-195",
  "method": "PATCH",
  "path": "/api/v1/members/:id/permissions",
  "acts": [
   "A61"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-196",
  "method": "GET",
  "path": "/api/v1/members/:id/remove-preview",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-197",
  "method": "POST",
  "path": "/api/v1/members/:id/resume",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-198",
  "method": "PATCH",
  "path": "/api/v1/members/:id/role",
  "acts": [
   "A61"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-199",
  "method": "POST",
  "path": "/api/v1/members/:id/suspend",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-200",
  "method": "POST",
  "path": "/api/v1/members/:id/two-factor/reset",
  "acts": [
   "A04"
  ],
  "screens": [
   "member-detail",
   "mfa-setup"
  ]
 },
 {
  "id": "EP-201",
  "method": "GET",
  "path": "/api/v1/memories",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-202",
  "method": "POST",
  "path": "/api/v1/memories",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-203",
  "method": "PATCH",
  "path": "/api/v1/memories/:id",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-204",
  "method": "DELETE",
  "path": "/api/v1/memories/:id",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-205",
  "method": "POST",
  "path": "/api/v1/memories/:id/promote",
  "acts": [
   "A131",
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-206",
  "method": "POST",
  "path": "/api/v1/messages/:id/artifacts",
  "acts": [
   "A95"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-207",
  "method": "GET",
  "path": "/api/v1/notices",
  "acts": [
   "A68"
  ],
  "screens": [
   "notices"
  ]
 },
 {
  "id": "EP-208",
  "method": "POST",
  "path": "/api/v1/notices/:id/read",
  "acts": [
   "A68"
  ],
  "screens": [
   "notices"
  ]
 },
 {
  "id": "EP-209",
  "method": "GET",
  "path": "/api/v1/notifications",
  "acts": [
   "A109"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-210",
  "method": "PATCH",
  "path": "/api/v1/notifications/:id",
  "acts": [
   "A109"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-211",
  "method": "POST",
  "path": "/api/v1/notifications/read-all",
  "acts": [
   "A109"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-212",
  "method": "GET",
  "path": "/api/v1/ops/inquiries",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-213",
  "method": "GET",
  "path": "/api/v1/ops/inquiries/:id",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-214",
  "method": "PATCH",
  "path": "/api/v1/ops/inquiries/:id",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-215",
  "method": "POST",
  "path": "/api/v1/ops/inquiries/:id/notes",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-216",
  "method": "POST",
  "path": "/api/v1/ops/inquiries/:id/replies",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-217",
  "method": "GET",
  "path": "/api/v1/ops/invoices",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-218",
  "method": "POST",
  "path": "/api/v1/ops/invoices/:id/payments",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-219",
  "method": "POST",
  "path": "/api/v1/ops/invoices/export",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-220",
  "method": "POST",
  "path": "/api/v1/ops/invoices/issue",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-221",
  "method": "GET",
  "path": "/api/v1/ops/members",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-222",
  "method": "POST",
  "path": "/api/v1/ops/members",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-223",
  "method": "PATCH",
  "path": "/api/v1/ops/members/:id",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-224",
  "method": "DELETE",
  "path": "/api/v1/ops/members/:id",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-225",
  "method": "GET",
  "path": "/api/v1/ops/notices",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-226",
  "method": "POST",
  "path": "/api/v1/ops/notices",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-227",
  "method": "GET",
  "path": "/api/v1/ops/notices/:id",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-228",
  "method": "PATCH",
  "path": "/api/v1/ops/notices/:id",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-229",
  "method": "POST",
  "path": "/api/v1/ops/notices/:id/publish",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-230",
  "method": "POST",
  "path": "/api/v1/ops/notices/:id/updates",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-231",
  "method": "GET",
  "path": "/api/v1/ops/operations",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-232",
  "method": "DELETE",
  "path": "/api/v1/ops/peeks/:id",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-233",
  "method": "GET",
  "path": "/api/v1/ops/plan_history",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-234",
  "method": "GET",
  "path": "/api/v1/ops/plan_proposals",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-235",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-236",
  "method": "PATCH",
  "path": "/api/v1/ops/plan_proposals/:id",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-237",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals/:id/decide",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-238",
  "method": "GET",
  "path": "/api/v1/ops/plan_proposals/:id/impact",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-239",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals/:id/return",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-240",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals/:id/submit",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-241",
  "method": "GET",
  "path": "/api/v1/ops/plans",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-242",
  "method": "GET",
  "path": "/api/v1/ops/shell",
  "acts": [
   "A60"
  ],
  "screens": [
   "ops-home"
  ]
 },
 {
  "id": "EP-243",
  "method": "GET",
  "path": "/api/v1/ops/templates",
  "acts": [
   "A128"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-244",
  "method": "GET",
  "path": "/api/v1/ops/templates/:id",
  "acts": [
   "A128"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-245",
  "method": "POST",
  "path": "/api/v1/ops/templates/:id/versions",
  "acts": [
   "A128"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-246",
  "method": "POST",
  "path": "/api/v1/ops/work_type_uploads",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-247",
  "method": "GET",
  "path": "/api/v1/ops/work_type_uploads/:id",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-248",
  "method": "GET",
  "path": "/api/v1/ops/work_types",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-249",
  "method": "GET",
  "path": "/api/v1/ops/work_types/:id",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-250",
  "method": "POST",
  "path": "/api/v1/ops/work_types/:id/versions",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-251",
  "method": "POST",
  "path": "/api/v1/ops/work_types/:id/versions/:v/rollback",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-252",
  "method": "GET",
  "path": "/api/v1/ops/workspaces",
  "acts": [
   "A60"
  ],
  "screens": [
   "ops-home"
  ]
 },
 {
  "id": "EP-253",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-254",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/audit",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-255",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/billing",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-256",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/inquiries",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-257",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/members",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-258",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/members/:mid/resend-verification",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-259",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/notices",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-260",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/peeks",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-261",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/plan",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-262",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/resume",
  "acts": [
   "A127"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-263",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/stop",
  "acts": [
   "A127"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-264",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/export",
  "acts": [
   "A60"
  ],
  "screens": [
   "ops-home"
  ]
 },
 {
  "id": "EP-265",
  "method": "GET",
  "path": "/api/v1/portal",
  "acts": [
   "A125"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-266",
  "method": "GET",
  "path": "/api/v1/portal/acceptances/:id",
  "acts": [
   "A126"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-267",
  "method": "POST",
  "path": "/api/v1/portal/acceptances/:id/answer",
  "acts": [
   "A126"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-268",
  "method": "POST",
  "path": "/api/v1/portal/attachments",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-269",
  "method": "GET",
  "path": "/api/v1/portal/notices",
  "acts": [
   "A125"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-270",
  "method": "POST",
  "path": "/api/v1/portal/requests",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-271",
  "method": "GET",
  "path": "/api/v1/portal/requests/:id",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-272",
  "method": "POST",
  "path": "/api/v1/portal/requests/:id/messages",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-273",
  "method": "POST",
  "path": "/api/v1/portal/requests/questions",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-274",
  "method": "GET",
  "path": "/api/v1/portal/tickets/:id",
  "acts": [
   "A125"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-275",
  "method": "GET",
  "path": "/api/v1/rules",
  "acts": [
   "A121",
   "A131"
  ],
  "screens": [
   "clients",
   "rules"
  ]
 },
 {
  "id": "EP-276",
  "method": "POST",
  "path": "/api/v1/rules",
  "acts": [
   "A121",
   "A131"
  ],
  "screens": [
   "clients",
   "rules"
  ]
 },
 {
  "id": "EP-277",
  "method": "GET",
  "path": "/api/v1/rules/:id",
  "acts": [
   "A131"
  ],
  "screens": [
   "rules"
  ]
 },
 {
  "id": "EP-278",
  "method": "PATCH",
  "path": "/api/v1/rules/:id",
  "acts": [
   "A131"
  ],
  "screens": [
   "rules"
  ]
 },
 {
  "id": "EP-279",
  "method": "DELETE",
  "path": "/api/v1/rules/:id",
  "acts": [
   "A131"
  ],
  "screens": [
   "rules"
  ]
 },
 {
  "id": "EP-280",
  "method": "POST",
  "path": "/api/v1/rules/check",
  "acts": [
   "A118",
   "A131"
  ],
  "screens": [
   "masters",
   "rules"
  ]
 },
 {
  "id": "EP-281",
  "method": "GET",
  "path": "/api/v1/saved_views",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-282",
  "method": "POST",
  "path": "/api/v1/saved_views",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-283",
  "method": "PATCH",
  "path": "/api/v1/saved_views/:id",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-284",
  "method": "DELETE",
  "path": "/api/v1/saved_views/:id",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-285",
  "method": "GET",
  "path": "/api/v1/scopes",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-286",
  "method": "POST",
  "path": "/api/v1/scopes",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-287",
  "method": "PATCH",
  "path": "/api/v1/scopes/:id",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-288",
  "method": "GET",
  "path": "/api/v1/scopes/:id/overview",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-289",
  "method": "GET",
  "path": "/api/v1/search",
  "acts": [
   "A21"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-290",
  "method": "GET",
  "path": "/api/v1/service-status",
  "acts": [
   "A68"
  ],
  "screens": [
   "notices"
  ]
 },
 {
  "id": "EP-291",
  "method": "GET",
  "path": "/api/v1/shell",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-292",
  "method": "PATCH",
  "path": "/api/v1/test_specs/:id",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-293",
  "method": "DELETE",
  "path": "/api/v1/test_specs/:id",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-294",
  "method": "GET",
  "path": "/api/v1/ticket-fields",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-295",
  "method": "PATCH",
  "path": "/api/v1/ticket_decisions/:id",
  "acts": [
   "A108"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-296",
  "method": "PATCH",
  "path": "/api/v1/ticket_handovers/:id",
  "acts": [
   "A110"
  ],
  "screens": [
   "approvals",
   "tickets"
  ]
 },
 {
  "id": "EP-297",
  "method": "POST",
  "path": "/api/v1/ticket_imports",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-298",
  "method": "GET",
  "path": "/api/v1/ticket_imports/:id",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-299",
  "method": "POST",
  "path": "/api/v1/ticket_imports/:id/commit",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-300",
  "method": "GET",
  "path": "/api/v1/ticket_kinds",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-301",
  "method": "POST",
  "path": "/api/v1/ticket_kinds/:id/template-from-ticket",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-302",
  "method": "GET",
  "path": "/api/v1/ticket_kinds/template-updates",
  "acts": [
   "A120"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-303",
  "method": "POST",
  "path": "/api/v1/ticket_kinds/template-updates/:id/apply",
  "acts": [
   "A120"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-304",
  "method": "DELETE",
  "path": "/api/v1/ticket_links/:id",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-305",
  "method": "PATCH",
  "path": "/api/v1/ticket_messages/:id",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-306",
  "method": "DELETE",
  "path": "/api/v1/ticket_messages/:id",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-307",
  "method": "POST",
  "path": "/api/v1/ticket_messages/:id/star",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-308",
  "method": "GET",
  "path": "/api/v1/ticket_stages",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-309",
  "method": "GET",
  "path": "/api/v1/tickets",
  "acts": [
   "A113",
   "A58",
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-310",
  "method": "POST",
  "path": "/api/v1/tickets",
  "acts": [
   "A129",
   "A98",
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-311",
  "method": "GET",
  "path": "/api/v1/tickets/:id",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-312",
  "method": "PATCH",
  "path": "/api/v1/tickets/:id",
  "acts": [
   "A103",
   "A113",
   "A115",
   "A17"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-313",
  "method": "DELETE",
  "path": "/api/v1/tickets/:id",
  "acts": [
   "A116"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-314",
  "method": "POST",
  "path": "/api/v1/tickets/:id/acceptances",
  "acts": [
   "A123"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-315",
  "method": "GET",
  "path": "/api/v1/tickets/:id/agent-session",
  "acts": [
   "A20"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-316",
  "method": "POST",
  "path": "/api/v1/tickets/:id/agent-session/apply",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-317",
  "method": "POST",
  "path": "/api/v1/tickets/:id/agent-session/messages",
  "acts": [
   "A20",
   "A91"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-318",
  "method": "GET",
  "path": "/api/v1/tickets/:id/artifacts",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-319",
  "method": "POST",
  "path": "/api/v1/tickets/:id/attachments",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-320",
  "method": "PATCH",
  "path": "/api/v1/tickets/:id/body",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-321",
  "method": "GET",
  "path": "/api/v1/tickets/:id/checks",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-322",
  "method": "PATCH",
  "path": "/api/v1/tickets/:id/client-share",
  "acts": [
   "A123"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-323",
  "method": "POST",
  "path": "/api/v1/tickets/:id/complete",
  "acts": [
   "A106"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-324",
  "method": "GET",
  "path": "/api/v1/tickets/:id/decisions",
  "acts": [
   "A108"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-325",
  "method": "POST",
  "path": "/api/v1/tickets/:id/decisions",
  "acts": [
   "A108"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-326",
  "method": "POST",
  "path": "/api/v1/tickets/:id/delegate",
  "acts": [
   "A104"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-327",
  "method": "GET",
  "path": "/api/v1/tickets/:id/delete-preview",
  "acts": [
   "A116"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-328",
  "method": "POST",
  "path": "/api/v1/tickets/:id/dry-run",
  "acts": [
   "A105"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-329",
  "method": "POST",
  "path": "/api/v1/tickets/:id/handovers",
  "acts": [
   "A111",
   "A112",
   "A48",
   "A51"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-330",
  "method": "GET",
  "path": "/api/v1/tickets/:id/kind-change-preview",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-331",
  "method": "GET",
  "path": "/api/v1/tickets/:id/links",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-332",
  "method": "POST",
  "path": "/api/v1/tickets/:id/links",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-333",
  "method": "POST",
  "path": "/api/v1/tickets/:id/messages",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-334",
  "method": "GET",
  "path": "/api/v1/tickets/:id/references",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-335",
  "method": "POST",
  "path": "/api/v1/tickets/:id/restore",
  "acts": [
   "A116"
  ],
  "screens": [
   "audit",
   "tickets"
  ]
 },
 {
  "id": "EP-336",
  "method": "GET",
  "path": "/api/v1/tickets/:id/runs",
  "acts": [
   "A104"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-337",
  "method": "GET",
  "path": "/api/v1/tickets/:id/test-specs",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-338",
  "method": "POST",
  "path": "/api/v1/tickets/:id/test-specs",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-339",
  "method": "POST",
  "path": "/api/v1/tickets/:id/test-specs/lint",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-340",
  "method": "POST",
  "path": "/api/v1/tickets/:id/test-specs/suggest",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-341",
  "method": "GET",
  "path": "/api/v1/tickets/:id/timeline",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-342",
  "method": "POST",
  "path": "/api/v1/tickets/:id/timeline/seen",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-343",
  "method": "GET",
  "path": "/api/v1/tickets/:id/versions",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-344",
  "method": "POST",
  "path": "/api/v1/tickets/:id/versions/:v/restore",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-345",
  "method": "GET",
  "path": "/api/v1/tickets/:id/work-type-candidates",
  "acts": [
   "A130"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-346",
  "method": "POST",
  "path": "/api/v1/tickets/bulk",
  "acts": [
   "A103",
   "A113"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-347",
  "method": "GET",
  "path": "/api/v1/work_types",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-348",
  "method": "POST",
  "path": "/api/v1/work_types",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-349",
  "method": "GET",
  "path": "/api/v1/work_types/:id",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-350",
  "method": "POST",
  "path": "/api/v1/work_types/:id/copy",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-351",
  "method": "PATCH",
  "path": "/api/v1/work_types/:id/draft",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-352",
  "method": "POST",
  "path": "/api/v1/work_types/:id/release",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-353",
  "method": "POST",
  "path": "/api/v1/work_types/:id/spread-requests",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-354",
  "method": "POST",
  "path": "/api/v1/work_types/:id/try",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-355",
  "method": "GET",
  "path": "/api/v1/work_types/:id/versions",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-356",
  "method": "GET",
  "path": "/api/v1/workspace",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-357",
  "method": "PATCH",
  "path": "/api/v1/workspace",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-358",
  "method": "GET",
  "path": "/api/v1/workspace/billing",
  "acts": [
   "A69"
  ],
  "screens": [
   "billing"
  ]
 },
 {
  "id": "EP-359",
  "method": "PATCH",
  "path": "/api/v1/workspace/billing-contact",
  "acts": [
   "A69"
  ],
  "screens": [
   "billing"
  ]
 },
 {
  "id": "EP-360",
  "method": "POST",
  "path": "/api/v1/workspace/deletion",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-361",
  "method": "DELETE",
  "path": "/api/v1/workspace/deletion",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-362",
  "method": "POST",
  "path": "/api/v1/workspace/escalation-rules",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-363",
  "method": "PATCH",
  "path": "/api/v1/workspace/escalation-rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-364",
  "method": "DELETE",
  "path": "/api/v1/workspace/escalation-rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-365",
  "method": "POST",
  "path": "/api/v1/workspace/escalation-rules/preview",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-366",
  "method": "POST",
  "path": "/api/v1/workspace/logo",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-367",
  "method": "GET",
  "path": "/api/v1/workspace/members",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-368",
  "method": "PATCH",
  "path": "/api/v1/workspace/permissions",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-369",
  "method": "POST",
  "path": "/api/v1/workspace/plan",
  "acts": [
   "A69"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-370",
  "method": "GET",
  "path": "/api/v1/workspace/plans",
  "acts": [
   "A69"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-371",
  "method": "GET",
  "path": "/api/v1/workspace/rules",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-372",
  "method": "POST",
  "path": "/api/v1/workspace/rules",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-373",
  "method": "PATCH",
  "path": "/api/v1/workspace/rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-374",
  "method": "DELETE",
  "path": "/api/v1/workspace/rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-375",
  "method": "GET",
  "path": "/api/v1/workspace/ticket-shape",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-376",
  "method": "PATCH",
  "path": "/api/v1/workspace/ticket-shape",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-377",
  "method": "POST",
  "path": "/api/v1/workspace/ticket-shape/preview",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 }
] as const;
