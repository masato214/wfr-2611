// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets/:id/complete
// 承認と完了は、本物の DB の関数（app.approval_decide・app.ticket_complete）と本物の PC の印（K-57）と差し込んだ受け箱（関門 C6）で確かめる。生成の試験の偽のセッションと土台では確かめられない（K-63 の孫 K-161〜K-166・行は孫ごとのファイル）。同意し直し（terms_pending）は K-53 の共通の前処理が全部の口に効き、K-63 の行は無い（it.todo のまま）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets/:id/complete", () => {
  it("test_post_tickets_id_complete_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/complete が「完了の条件と申し送りを確かめて完了にする」として呼ばれたとき THEN Kaname は「完了を記録・知らせる・セッションを閉じる」を行い 2xx を返す（自動側：ナレッジ更新の候補を出す・実行後の確認の結果を添える）
    // 本物の試験：apps/api/test/features/F5/approve-complete-complete.test.ts の「K63-API-027」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-complete.test.ts", "utf8")).toContain("K63-API-027");
  });
  it("test_post_tickets_id_complete_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/approve-complete-guard.test.ts の「K63-API-026」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-guard.test.ts", "utf8")).toContain("K63-API-026");
  });
  it("test_post_tickets_id_complete_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/approve-complete-complete.test.ts の「K63-API-034」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-complete.test.ts", "utf8")).toContain("K63-API-034");
  });
  it("test_post_tickets_id_complete_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F5/approve-complete-guard.test.ts の「K63-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-guard.test.ts", "utf8")).toContain("K63-API-025");
  });
  it("test_post_tickets_id_complete_conflict", () => {
    // UNWANTED: IF 完了にできない状態（承認待ち・実行中・確認中・もう完了・作業中でない）なら、Kaname は 409 とその理由（E-CONF-016・018・019）を返し、何も書かない
    // 本物の試験：apps/api/test/features/F5/approve-complete-complete.test.ts の「K63-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-complete.test.ts", "utf8")).toContain("K63-API-032");
  });
  it("test_post_tickets_id_complete_rejected_422", () => {
    // UNWANTED: IF 終わっていない子があるなら、Kaname は 422 と子ごとの理由（E-VAL-024）を返し、何も書かない
    // 本物の試験：apps/api/test/features/F5/approve-complete-complete.test.ts の「K63-API-030」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-complete.test.ts", "utf8")).toContain("K63-API-030");
  });
  it("test_post_tickets_id_complete_rejected_422_2", () => {
    // UNWANTED: IF 完了の条件を確かめた印が無いか、入力の形が違うなら、Kaname は 422 と欄ごとの理由（E-VAL-023）を返し、何も書かない
    // 本物の試験：apps/api/test/features/F5/approve-complete-complete.test.ts の「K63-API-029」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-complete.test.ts", "utf8")).toContain("K63-API-029");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-complete.test.ts）：UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）
  it.todo("test_post_tickets_id_complete_unavailable");
  it("test_post_tickets_id_complete_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_tickets_id_complete_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/approve-complete-guard.test.ts の「K63-API-045」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-guard.test.ts", "utf8")).toContain("K63-API-045");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F5/approve-complete-complete.test.ts）：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_tickets_id_complete_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_tickets_id_complete_mfa_pending");
  it("test_post_tickets_id_complete_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_tickets_id_complete_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets/:id/complete の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/approve-complete-complete.test.ts の「K63-API-027」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/approve-complete-complete.test.ts", "utf8")).toContain("K63-API-027");
  });
});
