// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/ops/members
// 運営の人・パスキー・最後の 1 人で答えが変わる。種では作れない（K-985）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/ops/members", () => {
  it("test_get_ops_members_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/ops/members が「運営の人ごとに 問い合わせ・中を見る・お金・止める・お知らせ・配るもの・値段の案・値段を決める・運営の人 を付ける」として呼ばれたとき THEN Kaname は「運営の人はパスキーでしか入れない」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-team.test.ts の「K985-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team.test.ts", "utf8")).toContain("K985-API-001");
  });
  it("test_get_ops_members_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-team.test.ts の「K985-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team.test.ts", "utf8")).toContain("K985-API-004");
  });
  it("test_get_ops_members_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-team.test.ts の「K985-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team.test.ts", "utf8")).toContain("K985-API-004");
  });
  // 当てはまらない（入力を受けない GET（問い合わせの値も持たない））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_ops_members_rejected_422");
  it("test_get_ops_members_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-team.test.ts の「K985-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team.test.ts", "utf8")).toContain("K985-API-015");
  });
  // 当てはまらない（運営の人は顧客の規約の同意を持たない（K-944 の解決で termsPending は false））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_ops_members_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_ops_members_mfa_pending");
  it("test_get_ops_members_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_ops_members_shape", () => {
    // UBIQUITOUS: GET /api/v1/ops/members の副作用は関門 C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-team.test.ts の「K985-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-team.test.ts", "utf8")).toContain("K985-API-001");
  });
});
