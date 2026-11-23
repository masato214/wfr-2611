// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/knowledge_pages/:id/draft
// 下書きをやめるかは役・下書きの有無・書き終えたことがあるかで答えが変わる。生成の試験の偽のセッションでは版も所属も作れない（K-679）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/knowledge_pages/:id/draft", () => {
  it("test_delete_knowledge_pages_id_draft_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/knowledge_pages/:id/draft が「層ごとのページを書く・直す」として呼ばれたとき THEN Kaname は「版を残す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-draft.test.ts の「K679-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-draft.test.ts", "utf8")).toContain("K679-API-017");
  });
  it("test_delete_knowledge_pages_id_draft_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-draft.test.ts の「K679-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-draft.test.ts", "utf8")).toContain("K679-API-021");
  });
  it("test_delete_knowledge_pages_id_draft_rejected_403", () => {
    // UNWANTED: IF ページに書けない人なら、Kaname は 403 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-draft.test.ts の「K679-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-draft.test.ts", "utf8")).toContain("K679-API-020");
  });
  it("test_delete_knowledge_pages_id_draft_not_found", () => {
    // UNWANTED: IF ページが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-draft.test.ts の「K679-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-draft.test.ts", "utf8")).toContain("K679-API-018");
  });
  it("test_delete_knowledge_pages_id_draft_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-679.ts の「K144-API-106」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-679.ts", "utf8")).toContain("K144-API-106");
  });
  it("test_delete_knowledge_pages_id_draft_conflict", () => {
    // UNWANTED: IF 捨てる下書きが無いなら、Kaname は 409 と E-KNW-030 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-draft.test.ts の「K679-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-draft.test.ts", "utf8")).toContain("K679-API-019");
  });
  it("test_delete_knowledge_pages_id_draft_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_knowledge_pages_id_draft_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-draft.test.ts の「K679-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-draft.test.ts", "utf8")).toContain("K679-API-016");
  });
  it("test_delete_knowledge_pages_id_draft_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_knowledge_pages_id_draft_mfa_pending");
  it("test_delete_knowledge_pages_id_draft_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_knowledge_pages_id_draft_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/knowledge_pages/:id/draft の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-draft.test.ts の「K679-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-draft.test.ts", "utf8")).toContain("K679-API-017");
  });
});
