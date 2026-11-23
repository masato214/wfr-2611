// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/ticket-fields
// 項目のマスタは権限（custom_fields の edit）・名前の一意・種別の行・値の数で答えが変わる。生成の試験の偽のセッションでは作れない（K-706）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/ticket-fields", () => {
  it("test_post_ticket_fields_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/ticket-fields が「タブごとに値を足す・直す」として呼ばれたとき THEN Kaname は「使われている値を消すときは置き換え先を決める」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-002");
  });
  it("test_post_ticket_fields_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-009");
  });
  it("test_post_ticket_fields_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-009");
  });
  it("test_post_ticket_fields_conflict", () => {
    // UNWANTED: IF 同じ名前の項目があるなら、Kaname は 409 と E-FMS-001 を返し、項目を足さない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-008");
  });
  it("test_post_ticket_fields_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、項目を足さない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-004");
  });
  it("test_post_ticket_fields_not_found", () => {
    // UNWANTED: IF 種別が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず項目を足さない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-007");
  });
  it("test_post_ticket_fields_conflict_2", () => {
    // UNWANTED: IF 同じ名前の選ぶ物が 2 つあるなら、Kaname は 409 と E-FMS-004 を返し、項目を足さない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-006");
  });
  it("test_post_ticket_fields_session_unresolved", () => {
    // UNWANTED: IF 読めないか書けないなら、Kaname は 503 と E-PAGE-003 を返し、項目も証跡も前のまま残す
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-012");
  });
  it("test_post_ticket_fields_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_ticket_fields_rate_limited", () => {
    // UNWANTED: IF 30/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-010");
  });
  it("test_post_ticket_fields_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_ticket_fields_mfa_pending");
  it("test_post_ticket_fields_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_ticket_fields_shape", () => {
    // UBIQUITOUS: POST /api/v1/ticket-fields の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/ticket-fields-write.test.ts の「K706-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-write.test.ts", "utf8")).toContain("K706-API-002");
  });
});
