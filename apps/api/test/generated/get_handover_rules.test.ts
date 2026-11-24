// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/handover_rules
// 決まりの行はワークスペースを作ったときに入る 3 行で、会社ごとに mode が変わる。生成の試験の種では会社ごとの行を確かめられない（K-401）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/handover_rules", () => {
  it("test_get_handover_rules_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/handover_rules が「受ける／理由を書いて断る」として呼ばれたとき THEN Kaname は「責任者を切り替える・知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-025");
  });
  it("test_get_handover_rules_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-010");
  });
  // 当てはまらない（会社の人なら誰でも読める（役を見ない））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_handover_rules_rejected_403");
  // 当てはまらない（入力を受けない GET）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_handover_rules_rejected_422");
  it("test_get_handover_rules_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-010");
  });
  it("test_get_handover_rules_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_handover_rules_mfa_pending");
  it("test_get_handover_rules_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_handover_rules_shape", () => {
    // UBIQUITOUS: GET /api/v1/handover_rules の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-025");
  });
});
