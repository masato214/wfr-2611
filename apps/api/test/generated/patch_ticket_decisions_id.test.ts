// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/ticket_decisions/:id
// 改める・取り消すは決定の今の状態（生きている・改められた・取り消した）と書けるかの組み合わせで答えが変わり、生成の試験の種では作れない（K-391）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/ticket_decisions/:id", () => {
  it("test_patch_ticket_decisions_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/ticket_decisions/:id が「決めたこと・理由を書く／AI の候補を確定する」として呼ばれたとき THEN Kaname は「決定と改めた先を残す」を行い 2xx を返す（自動側：スレッドから決定の候補を出す）
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-001");
  });
  it("test_patch_ticket_decisions_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-012");
  });
  it("test_patch_ticket_decisions_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-012");
  });
  it("test_patch_ticket_decisions_id_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-012");
  });
  it("test_patch_ticket_decisions_id_rejected_422", () => {
    // UNWANTED: IF 改めるのに新しい決定が空か、取り消すのに理由が空なら、Kaname は 422（E-VAL-042・E-VAL-045）を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-002");
  });
  it("test_patch_ticket_decisions_id_conflict", () => {
    // UNWANTED: IF 決定がすでに改められているか取り消されているなら、Kaname は 409（E-CONF-031・E-CONF-033）を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-004");
  });
  it("test_patch_ticket_decisions_id_unavailable", () => {
    // UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-014");
  });
  it("test_patch_ticket_decisions_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_ticket_decisions_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-016");
  });
  it("test_patch_ticket_decisions_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_ticket_decisions_id_mfa_pending");
  it("test_patch_ticket_decisions_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_ticket_decisions_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/ticket_decisions/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F6/decision-update.test.ts の「K391-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/decision-update.test.ts", "utf8")).toContain("K391-API-001");
  });
});
