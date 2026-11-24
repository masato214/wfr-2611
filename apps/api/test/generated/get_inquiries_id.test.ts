// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/inquiries/:id
// 本人だけ・社内メモを外す・開いたら読んだ印。種では作れない（K-951）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/inquiries/:id", () => {
  it("test_get_inquiries_id_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/inquiries/:id が「問い合わせを書いて送る」として呼ばれたとき THEN Kaname は「受信箱に届ける」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/inquiry-read.test.ts の「K951-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-read.test.ts", "utf8")).toContain("K951-API-008");
  });
  it("test_get_inquiries_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/inquiry-read.test.ts の「K951-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-read.test.ts", "utf8")).toContain("K951-API-011");
  });
  it("test_get_inquiries_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/inquiry-read.test.ts の「K951-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-read.test.ts", "utf8")).toContain("K951-API-011");
  });
  it("test_get_inquiries_id_not_found", () => {
    // UNWANTED: IF 開いた問い合わせが本人の物でないか無いなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず読んだ印も入れない
    // 本物の試験：apps/api/test/features/F12/inquiry-read.test.ts の「K951-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-read.test.ts", "utf8")).toContain("K951-API-010");
  });
  it("test_get_inquiries_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-980」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-980");
  });
  it("test_get_inquiries_id_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/inquiry-read.test.ts の「K951-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-read.test.ts", "utf8")).toContain("K951-API-012");
  });
  it("test_get_inquiries_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_inquiries_id_mfa_pending");
  it("test_get_inquiries_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_inquiries_id_shape", () => {
    // UBIQUITOUS: GET /api/v1/inquiries/:id の副作用は関門 C2・C4・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/inquiry-read.test.ts の「K951-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-read.test.ts", "utf8")).toContain("K951-API-008");
  });
});
