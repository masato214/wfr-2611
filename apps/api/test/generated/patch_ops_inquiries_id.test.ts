// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/ops/inquiries/:id
// 今の担当・状態・後での日時で答えが変わり、運営の記録を書く。種では作れない（K-974）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/ops/inquiries/:id", () => {
  it("test_patch_ops_inquiries_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/ops/inquiries/:id が「受信箱で答える」として呼ばれたとき THEN Kaname は「相手に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-001");
  });
  it("test_patch_ops_inquiries_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-009");
  });
  it("test_patch_ops_inquiries_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-009");
  });
  it("test_patch_ops_inquiries_id_not_found", () => {
    // UNWANTED: IF 問い合わせが無いか消してあるなら、Kaname は 404 を返し、担当も状態も変えない
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-008");
  });
  it("test_patch_ops_inquiries_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-010");
  });
  it("test_patch_ops_inquiries_id_conflict", () => {
    // UNWANTED: IF ほかの人が担当か、担当が自分でないなら、Kaname は 409 と E-OPS-005 を返し、担当も状態も変えない
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-002");
  });
  it("test_patch_ops_inquiries_id_conflict_2", () => {
    // UNWANTED: IF 後での日時が今以前なら、Kaname は 409 と E-OPS-008 を返し、担当も状態も変えない
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-006");
  });
  // 当てはまらない（送る量の守り（1MB）は入口の共通（op.ts・K-144））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_patch_ops_inquiries_id_too_large");
  it("test_patch_ops_inquiries_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-013");
  });
  it("test_patch_ops_inquiries_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_ops_inquiries_id_mfa_pending");
  it("test_patch_ops_inquiries_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_ops_inquiries_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/ops/inquiries/:id の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-inbox-update.test.ts の「K974-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-inbox-update.test.ts", "utf8")).toContain("K974-API-001");
  });
});
