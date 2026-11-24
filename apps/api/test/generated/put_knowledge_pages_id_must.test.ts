// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PUT /api/v1/knowledge_pages/:id/must
// 必ず守るを付けられるかは棚（会社・グループ・自分）と役・上限・本文の字数で答えが変わる。生成の試験の偽のセッションでは棚も所属も上限も作れない（K-685）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PUT /api/v1/knowledge_pages/:id/must", () => {
  it("test_put_knowledge_pages_id_must_ok", () => {
    // EVENT-DRIVEN: WHEN PUT /api/v1/knowledge_pages/:id/must が「層ごとのページを書く・直す」として呼ばれたとき THEN Kaname は「版を残す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-001");
  });
  it("test_put_knowledge_pages_id_must_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-011");
  });
  it("test_put_knowledge_pages_id_must_rejected_403", () => {
    // UNWANTED: IF ページに書けない人なら、Kaname は 403 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-010");
  });
  it("test_put_knowledge_pages_id_must_not_found", () => {
    // UNWANTED: IF ページが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-010");
  });
  it("test_put_knowledge_pages_id_must_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-009");
  });
  it("test_put_knowledge_pages_id_must_conflict", () => {
    // UNWANTED: IF ページがまだ書き終わっていない（下書きだけ）なら、Kaname は 409 と E-KNW-010 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-008");
  });
  // 当てはまらない（承認待ちの頼み（E-KNW-011）は頼みの置き場（K-687）が入ってから。K-687 が page-guards/pending-request.ts を差し替え、自分の試験に行を足す）：UNWANTED: IF 上げる・共有する頼みが承認待ちなら、Kaname は 409 と E-KNW-011 を返し、ページもフォルダも変えない
  it.todo("test_put_knowledge_pages_id_must_conflict_2");
  it("test_put_knowledge_pages_id_must_conflict_3", () => {
    // UNWANTED: IF 必ず守るの上限に届いたなら、Kaname は 409 と E-KNW-060 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-004");
  });
  it("test_put_knowledge_pages_id_must_conflict_4", () => {
    // UNWANTED: IF 本文が 2,000 字を超えるなら、Kaname は 409 と E-KNW-061 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-007");
  });
  it("test_put_knowledge_pages_id_must_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_put_knowledge_pages_id_must_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_put_knowledge_pages_id_must_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-012");
  });
  it("test_put_knowledge_pages_id_must_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_put_knowledge_pages_id_must_mfa_pending");
  it("test_put_knowledge_pages_id_must_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_put_knowledge_pages_id_must_shape", () => {
    // UBIQUITOUS: PUT /api/v1/knowledge_pages/:id/must の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-must.test.ts の「K685-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-must.test.ts", "utf8")).toContain("K685-API-001");
  });
});
