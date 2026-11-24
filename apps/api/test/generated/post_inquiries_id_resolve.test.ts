// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/inquiries/:id/resolve
// 本人の問い合わせの状態で答えが変わる（もう済みなら何も変えない）。種では作れない（K-952）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/inquiries/:id/resolve", () => {
  it("test_post_inquiries_id_resolve_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/inquiries/:id/resolve が「問い合わせを書いて送る」として呼ばれたとき THEN Kaname は「受信箱に届ける」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/inquiry-reply.test.ts の「K952-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-reply.test.ts", "utf8")).toContain("K952-API-008");
  });
  it("test_post_inquiries_id_resolve_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/inquiry-reply.test.ts の「K952-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-reply.test.ts", "utf8")).toContain("K952-API-012");
  });
  it("test_post_inquiries_id_resolve_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/inquiry-reply.test.ts の「K952-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-reply.test.ts", "utf8")).toContain("K952-API-012");
  });
  it("test_post_inquiries_id_resolve_not_found", () => {
    // UNWANTED: IF 済みにする問い合わせが本人の物でないか無いなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず状態を変えない
    // 本物の試験：apps/api/test/features/F12/inquiry-reply.test.ts の「K952-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-reply.test.ts", "utf8")).toContain("K952-API-010");
  });
  it("test_post_inquiries_id_resolve_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-991」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-991");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F12/inquiry-reply.test.ts）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_inquiries_id_resolve_rejected_422_2");
  // 当てはまらない（体は空の {} だけ。送る量の守りは入口の共通）：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_post_inquiries_id_resolve_too_large");
  it("test_post_inquiries_id_resolve_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/inquiry-reply.test.ts の「K952-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-reply.test.ts", "utf8")).toContain("K952-API-014");
  });
  it("test_post_inquiries_id_resolve_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_inquiries_id_resolve_mfa_pending");
  it("test_post_inquiries_id_resolve_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_inquiries_id_resolve_shape", () => {
    // UBIQUITOUS: POST /api/v1/inquiries/:id/resolve の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/inquiry-reply.test.ts の「K952-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/inquiry-reply.test.ts", "utf8")).toContain("K952-API-008");
  });
});
