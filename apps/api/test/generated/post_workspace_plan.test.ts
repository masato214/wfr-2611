// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/workspace/plan
// 今の契約・人数・本人確認の取り直しで答えが変わる。種では作れない（K-961）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/workspace/plan", () => {
  it("test_post_workspace_plan_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/workspace/plan が「プラン・利用量・請求書を見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-007");
  });
  it("test_post_workspace_plan_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-016");
  });
  it("test_post_workspace_plan_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-006");
  });
  it("test_post_workspace_plan_conflict", () => {
    // UNWANTED: IF 今のプランか人数が上限を超えるプランを選んだなら、Kaname は 409 と E-PLAN-001／E-PLAN-002 を返し、契約も頼みの行も変えない
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-010");
  });
  it("test_post_workspace_plan_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-012");
  });
  it("test_post_workspace_plan_not_found", () => {
    // UNWANTED: IF 無いプランの鍵を選んだなら、Kaname は 404 と E-PAGE-001 を返し、契約も頼みの行も変えない
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-011");
  });
  // 当てはまらない（送る量の守り（1MB）は入口の共通（op.ts・K-144））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_post_workspace_plan_too_large");
  it("test_post_workspace_plan_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-018");
  });
  it("test_post_workspace_plan_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_workspace_plan_mfa_pending");
  it("test_post_workspace_plan_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_workspace_plan_shape", () => {
    // UBIQUITOUS: POST /api/v1/workspace/plan の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/plans.test.ts の「K961-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/plans.test.ts", "utf8")).toContain("K961-API-007");
  });
});
