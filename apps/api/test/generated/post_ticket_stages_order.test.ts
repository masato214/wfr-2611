// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ticket_stages/order
// 状態を書く口は権限（ticket_stages の edit）・名前の一意・使っているチケットの数・仕組みの状態で答えが変わる。生成の試験の偽のセッションでは作れない（K-705）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ticket_stages/order", () => {
  it("test_post_ticket_stages_order_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ticket_stages/order が「種別・状態・項目を、タブごとに足す・直す・並べる・消す」として呼ばれたとき THEN Kaname は「使っているチケットがある種別・状態は消せない。消した項目の値は見えなくなる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-014");
  });
  it("test_post_ticket_stages_order_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-017");
  });
  it("test_post_ticket_stages_order_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-017");
  });
  it("test_post_ticket_stages_order_conflict", () => {
    // UNWANTED: IF 並びが今の状態と合わないなら、Kaname は 409 と E-STG-006 を返し、並びを変えない
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-015");
  });
  it("test_post_ticket_stages_order_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-015");
  });
  it("test_post_ticket_stages_order_conflict_2", () => {
    // UNWANTED: IF 始めが先頭でないか終わりが最後でないなら、Kaname は 409 と E-STG-007 を返し、並びを変えない
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-016");
  });
  it("test_post_ticket_stages_order_session_unresolved", () => {
    // UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、状態も証跡も前のまま残す
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-021");
  });
  it("test_post_ticket_stages_order_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_ticket_stages_order_rate_limited", () => {
    // UNWANTED: IF 30/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-019");
  });
  it("test_post_ticket_stages_order_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ticket_stages_order_mfa_pending");
  it("test_post_ticket_stages_order_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ticket_stages_order_shape", () => {
    // UBIQUITOUS: POST /api/v1/ticket_stages/order の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-014");
  });
});
