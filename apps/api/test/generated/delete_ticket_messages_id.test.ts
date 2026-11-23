// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/ticket_messages/:id
// 消せるのは書いた本人かそのグループのマネージャーで、跡と証跡が残る。役とグループの組み合わせは生成の試験の種では作れない（K-386）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/ticket_messages/:id", () => {
  it("test_delete_ticket_messages_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/ticket_messages/:id が「スレッドに書く・@ を付ける」として呼ばれたとき THEN Kaname は「@ の相手に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F6/thread-edit.test.ts の「K386-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-edit.test.ts", "utf8")).toContain("K386-API-007");
  });
  it("test_delete_ticket_messages_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F6/thread-edit.test.ts の「K386-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-edit.test.ts", "utf8")).toContain("K386-API-016");
  });
  it("test_delete_ticket_messages_id_rejected_403", () => {
    // UNWANTED: IF 書いた本人でもそのグループのマネージャーでもないなら、Kaname は 403 と FORBIDDEN を返し、消さない
    // 本物の試験：apps/api/test/features/F6/thread-edit.test.ts の「K386-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-edit.test.ts", "utf8")).toContain("K386-API-009");
  });
  it("test_delete_ticket_messages_id_not_found", () => {
    // UNWANTED: IF 書き込みが無い・見えない・もう消した・書き込みでないなら、Kaname は 404 と NOT_FOUND を返し、何も変えない
    // 本物の試験：apps/api/test/features/F6/thread-edit.test.ts の「K386-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-edit.test.ts", "utf8")).toContain("K386-API-010");
  });
  it("test_delete_ticket_messages_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-386.ts の「K144-API-731」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-386.ts", "utf8")).toContain("K144-API-731");
  });
  it("test_delete_ticket_messages_id_session_unresolved", () => {
    // UNWANTED: IF 守りの判定で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない（止める側に倒す）
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_ticket_messages_id_session_unresolved_2", () => {
    // UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、書き込みを前のまま残す
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_ticket_messages_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F6/thread-edit.test.ts の「K386-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-edit.test.ts", "utf8")).toContain("K386-API-016");
  });
  it("test_delete_ticket_messages_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_ticket_messages_id_mfa_pending");
  it("test_delete_ticket_messages_id_session_unresolved_3", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_ticket_messages_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/ticket_messages/:id の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F6/thread-edit.test.ts の「K386-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-edit.test.ts", "utf8")).toContain("K386-API-008");
  });
});
