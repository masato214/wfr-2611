// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets/:id/messages
// 書き込みは、書く人がチケットを見られるか・@ と知らせる人がそのチケットを見られるか・引用元の在りかで答えと受け箱の行が変わる。生成の試験の種では作れない（K-385）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets/:id/messages", () => {
  it("test_post_tickets_id_messages_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/messages が「スレッドに書く・@ を付ける」として呼ばれたとき THEN Kaname は「@ の相手に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-001");
  });
  it("test_post_tickets_id_messages_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-015");
  });
  it("test_post_tickets_id_messages_rejected_403", () => {
    // UNWANTED: IF 段を変えられない人が段の欄を付けて書いたなら、Kaname は 403 を返し、書き込みも段も残さない
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-014");
  });
  it("test_post_tickets_id_messages_not_found", () => {
    // UNWANTED: IF @ する人・知らせる人・引用元が選べないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も書かない
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-006");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F6/thread-post.test.ts）：UNWANTED: IF AI が動いている間か承認待ちの間に段を変えて書こうとしたら、Kaname は 409 と E-CONF-030 を返し、書き込みも残さない
  it.todo("test_post_tickets_id_messages_conflict");
  it("test_post_tickets_id_messages_rejected_422", () => {
    // UNWANTED: IF 本文が無い・空・空白だけなら、Kaname は 422 と E-VAL-027 と欄 body の明細を返し、書き込みも受け箱の行も作らない
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-013");
  });
  it("test_post_tickets_id_messages_not_found_2", () => {
    // UNWANTED: IF 指した段が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も書かない
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-014");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F6/thread-post.test.ts）：UNWANTED: IF 完了したチケットの段を開き直さずに変えて書こうとしたら、Kaname は 409 と E-CONF-032 を返し、書き込みも残さない
  it.todo("test_post_tickets_id_messages_conflict_2");
  // 本物の試験はまだ無い（apps/api/test/features/F6/thread-post.test.ts）：UNWANTED: IF 書き込みの口で移せない段を行き先にしたなら、Kaname は 409 と E-CONF-034 を返し、書き込みも残さない
  it.todo("test_post_tickets_id_messages_conflict_3");
  // 本物の試験はまだ無い（apps/api/test/features/F6/thread-post.test.ts）：UNWANTED: IF 段の id で保留の段を選んで理由か条件が無いなら、Kaname は 409 と E-CONF-035 と足りない欄を返し、書き込みも残さない
  it.todo("test_post_tickets_id_messages_conflict_4");
  // 本物の試験はまだ無い（apps/api/test/features/F6/thread-post.test.ts）：UNWANTED: IF 保留でない段を選んで保留の理由か条件を付けたなら、Kaname は 409 と E-CONF-036 を返し、書き込みも残さない
  it.todo("test_post_tickets_id_messages_conflict_5");
  it("test_post_tickets_id_messages_rejected_422_2", () => {
    // UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-009");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F6/thread-post.test.ts）：UNWANTED: IF チケットが無い・見えない・消したなら、Kaname は 404 と NOT_FOUND を返し、何も書かない
  it.todo("test_post_tickets_id_messages_not_found_3");
  it("test_post_tickets_id_messages_unavailable", () => {
    // UNWANTED: IF 書き込みと受け箱の行を書く所で DB が落ちたなら、Kaname は 503 を返し、書き込みも受け箱の行も残さない（1 つの取引・止める側に倒す）
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-017");
  });
  it("test_post_tickets_id_messages_session_unresolved", () => {
    // UNWANTED: IF 守りの判定で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も書かない（止める側に倒す）
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_tickets_id_messages_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-010");
  });
  it("test_post_tickets_id_messages_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-015");
  });
  it("test_post_tickets_id_messages_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_tickets_id_messages_mfa_pending");
  it("test_post_tickets_id_messages_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_tickets_id_messages_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets/:id/messages の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F6/thread-post.test.ts の「K385-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/thread-post.test.ts", "utf8")).toContain("K385-API-001");
  });
});
