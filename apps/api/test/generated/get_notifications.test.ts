// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/notifications
// 知らせの一覧は、行の守り（自分宛て）と種類の表とチケットの見え方の組み合わせで答えが変わる。生成の試験の種では知らせの行も人も作れない（K-461）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/notifications", () => {
  it("test_get_notifications_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/notifications が「ベルを押して知らせからチケットへ」として呼ばれたとき THEN Kaname は「既読にする」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F7/notifications-list.test.ts の「K461-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/notifications-list.test.ts", "utf8")).toContain("K461-API-001");
  });
  it("test_get_notifications_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F7/notifications-list.test.ts の「K461-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/notifications-list.test.ts", "utf8")).toContain("K461-API-017");
  });
  it("test_get_notifications_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F7/notifications-list.test.ts の「K461-API-029」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/notifications-list.test.ts", "utf8")).toContain("K461-API-029");
  });
  it("test_get_notifications_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F7/notifications-list.test.ts の「K461-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/notifications-list.test.ts", "utf8")).toContain("K461-API-006");
  });
  it("test_get_notifications_conflict", () => {
    // UNWANTED: IF 続きの鍵が形に合うのに今の状態では読めないなら、Kaname は 409 と E-NTF-001 を返し、最初から読み直すよう促す
    // 本物の試験：apps/api/test/features/F7/notifications-list.test.ts の「K461-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/notifications-list.test.ts", "utf8")).toContain("K461-API-011");
  });
  it("test_get_notifications_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F7/notifications-list.test.ts の「K461-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/notifications-list.test.ts", "utf8")).toContain("K461-API-018");
  });
  it("test_get_notifications_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_notifications_mfa_pending");
  it("test_get_notifications_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
});
