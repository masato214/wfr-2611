// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets/:id/handovers
// 渡す口は、種類（渡す・申し出・配る）と、担当・役・止まり・相手の状態・ワークスペースの決まりの組み合わせで断り方が変わり、種類ごとの振る舞いは葉ごとのファイル（K-402・K-408・K-409・K-410）にある。生成の試験の種では作れない（K-401）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets/:id/handovers", () => {
  // 本物の試験はまだ無い（apps/api/test/features/F8/handover-base.test.ts）：EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/handovers が「人かグループを選んで配る」として呼ばれたとき THEN Kaname は「層ごとの合意の要否に沿って知らせる」を行い 2xx を返す
  it.todo("test_post_tickets_id_handovers_ok");
  // 当てはまらない（上へ上げる（判断を仰ぐ・上位の承認・詰まり）は段 9 では作らない（D-148.1）。422・E-HND-001 は K401-API-011）：EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/handovers が「判断を仰ぐ・上位の承認を付ける・詰まっていますと上げる」として呼ばれたとき THEN Kaname は「上位に知らせる」を行い 2xx を返す
  it.todo("test_post_tickets_id_handovers_ok_2");
  // 本物の試験はまだ無い（apps/api/test/features/F8/handover-base.test.ts）：EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/handovers が「引き取りを申し出る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
  it.todo("test_post_tickets_id_handovers_ok_3");
  // 本物の試験はまだ無い（apps/api/test/features/F8/handover-base.test.ts）：EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/handovers が「相手・理由・お願い・返事の期限を書いて渡す」として呼ばれたとき THEN Kaname は「渡し中にして相手に知らせる」を行い 2xx を返す
  it.todo("test_post_tickets_id_handovers_ok_4");
  it("test_post_tickets_id_handovers_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-010");
  });
  it("test_post_tickets_id_handovers_rejected_403", () => {
    // UNWANTED: IF その人がその種類で渡せないなら、Kaname は 403 と E-HND-002 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-016");
  });
  it("test_post_tickets_id_handovers_not_found", () => {
    // UNWANTED: IF 見えないチケット・無い相手・無いグループに渡そうとしたなら、Kaname は 404 と E-PAGE-001／E-HND-014／E-HND-012 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-019");
  });
  it("test_post_tickets_id_handovers_conflict", () => {
    // UNWANTED: IF そのチケットが今は渡せない状態なら、Kaname は 409 と E-HND-001／E-HND-003／E-HND-004／E-HND-005／E-HND-006／E-HND-008／E-HND-009／E-HND-010／E-HND-011 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-017");
  });
  it("test_post_tickets_id_handovers_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-012");
  });
  it("test_post_tickets_id_handovers_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_tickets_id_handovers_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-010");
  });
  it("test_post_tickets_id_handovers_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_tickets_id_handovers_mfa_pending");
  it("test_post_tickets_id_handovers_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F8/handover-base.test.ts）：UBIQUITOUS: POST /api/v1/tickets/:id/handovers の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_tickets_id_handovers_shape");
});
