// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/ticket_stages/:id
// 状態を書く口は権限（ticket_stages の edit）・名前の一意・使っているチケットの数・仕組みの状態で答えが変わる。生成の試験の偽のセッションでは作れない（K-705）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/ticket_stages/:id", () => {
  it("test_delete_ticket_stages_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/ticket_stages/:id が「タブごとに値を足す・直す」として呼ばれたとき THEN Kaname は「使われている値を消すときは置き換え先を決める」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-011");
  });
  it("test_delete_ticket_stages_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-017");
  });
  it("test_delete_ticket_stages_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-017");
  });
  it("test_delete_ticket_stages_id_not_found", () => {
    // UNWANTED: IF 状態が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-010");
  });
  it("test_delete_ticket_stages_id_rejected_422", () => {
    // UNWANTED: IF :id が uuid でないなら、Kaname は 422 を返し、何も消さない
    // 本物の試験：apps/api/test/features/contract/k144.d/K-705.ts の「K144-API-973」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-705.ts", "utf8")).toContain("K144-API-973");
  });
  it("test_delete_ticket_stages_id_conflict", () => {
    // UNWANTED: IF 始め・終わり・仕組みの状態なら、Kaname は 409 と E-STG-003 を返し、状態を消さない
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-012");
  });
  it("test_delete_ticket_stages_id_conflict_2", () => {
    // UNWANTED: IF その状態のチケットが在るなら、Kaname は 409 と E-STG-005 と枚数を返し、状態を消さない
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-013");
  });
  it("test_delete_ticket_stages_id_session_unresolved", () => {
    // UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、状態も証跡も前のまま残す
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-021");
  });
  it("test_delete_ticket_stages_id_rate_limited", () => {
    // UNWANTED: IF 30/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-019");
  });
  it("test_delete_ticket_stages_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_ticket_stages_id_mfa_pending");
  it("test_delete_ticket_stages_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_ticket_stages_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/ticket_stages/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-011");
  });
});
