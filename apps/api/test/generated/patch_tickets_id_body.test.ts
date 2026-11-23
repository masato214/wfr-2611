// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/tickets/:id/body
// 本文を書き終えるは、本物の DB の版の合わせ・完了したチケット・書ける人の判定・本文の行と版の行とやり取りと証跡の 1 つの取引で答えが変わる。生成の試験の偽のセッションでは作れない（K-432）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/tickets/:id/body", () => {
  it("test_patch_tickets_id_body_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id/body が「区画ごとに書く」として呼ばれたとき THEN Kaname は「区画ごとに版を残す」を行い 2xx を返す（自動側：抜けを指摘する）
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-001");
  });
  it("test_patch_tickets_id_body_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-017");
  });
  it("test_patch_tickets_id_body_rejected_403", () => {
    // UNWANTED: IF チケットは見えるが書く権限が無いなら、Kaname は 403 と FORBIDDEN を返し、本文も版も変えない
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-015");
  });
  it("test_patch_tickets_id_body_not_found", () => {
    // UNWANTED: IF チケットが別の会社・見えない・無い id・消したチケットなら、Kaname は 404 と NOT_FOUND を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-016");
  });
  it("test_patch_tickets_id_body_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、本文も版も変えない
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-011");
  });
  it("test_patch_tickets_id_body_conflict", () => {
    // UNWANTED: IF 送った version が今の版と違うなら、Kaname は 409 と E-SEC-004 を返し（誰が直したかは答えに入れない）、本文も版も変えない
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-004");
  });
  it("test_patch_tickets_id_body_conflict_2", () => {
    // UNWANTED: IF 完了したチケットの本文を直そうとしたなら、Kaname は 409 と E-SEC-005 を返し、本文も版も変えない
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-014");
  });
  it("test_patch_tickets_id_body_session_unresolved", () => {
    // UNWANTED: IF 本文を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、本文・版・やり取り・証跡のどれも残さない
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-018");
  });
  it("test_patch_tickets_id_body_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（回数は入口の共通の数えで、体を受ける口の型の確かめは K144-API の共通の試験が持つ）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_patch_tickets_id_body_rate_limited");
  it("test_patch_tickets_id_body_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_tickets_id_body_mfa_pending");
  it("test_patch_tickets_id_body_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_tickets_id_body_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/tickets/:id/body の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F4/ticket-body-update.test.ts の「K432-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-body-update.test.ts", "utf8")).toContain("K432-API-001");
  });
});
