// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/knowledge_pages/:id
// ページを消せるかは役・必ず守る・頼み・共有で変わる。生成の試験の偽のセッションでは版も所属も作れない（K-681）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/knowledge_pages/:id", () => {
  it("test_delete_knowledge_pages_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/knowledge_pages/:id が「層ごとのページを書く・直す」として呼ばれたとき THEN Kaname は「版を残す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-page-edit.test.ts の「K681-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-edit.test.ts", "utf8")).toContain("K681-API-011");
  });
  it("test_delete_knowledge_pages_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-page-edit.test.ts の「K681-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-edit.test.ts", "utf8")).toContain("K681-API-018");
  });
  it("test_delete_knowledge_pages_id_rejected_403", () => {
    // UNWANTED: IF ページに書けない人なら、Kaname は 403 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-page-edit.test.ts の「K681-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-edit.test.ts", "utf8")).toContain("K681-API-010");
  });
  it("test_delete_knowledge_pages_id_not_found", () => {
    // UNWANTED: IF ページが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-page-edit.test.ts の「K681-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-edit.test.ts", "utf8")).toContain("K681-API-010");
  });
  it("test_delete_knowledge_pages_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-681.ts の「K144-API-109」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-681.ts", "utf8")).toContain("K144-API-109");
  });
  // 当てはまらない（承認待ちの頼み（E-KNW-011）は頼みの置き場（K-687）が入ってから。K-687 が page-guards/pending-request.ts を差し替え、自分の試験に行を足す）：UNWANTED: IF 上げる・共有する頼みが承認待ちなら、Kaname は 409 と E-KNW-011 を返し、ページもフォルダも変えない
  it.todo("test_delete_knowledge_pages_id_conflict");
  it("test_delete_knowledge_pages_id_conflict_2", () => {
    // UNWANTED: IF 必ず守るが付いているなら、Kaname は 409 と E-KNW-050 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-page-edit.test.ts の「K681-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-edit.test.ts", "utf8")).toContain("K681-API-012");
  });
  // 当てはまらない（共有しているページ（E-KNW-051）は共有の置き場（K-689）と確かめ（K-719 が page-guards/shared.ts を差し替える）が入ってから。K-719 が自分の試験に行を足す）：UNWANTED: IF ほかのグループに共有しているなら、Kaname は 409 と E-KNW-051 を返し、ページもフォルダも変えない
  it.todo("test_delete_knowledge_pages_id_conflict_3");
  it("test_delete_knowledge_pages_id_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_knowledge_pages_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-page-edit.test.ts の「K681-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-edit.test.ts", "utf8")).toContain("K681-API-019");
  });
  it("test_delete_knowledge_pages_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_knowledge_pages_id_mfa_pending");
  it("test_delete_knowledge_pages_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_knowledge_pages_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/knowledge_pages/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-page-edit.test.ts の「K681-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-edit.test.ts", "utf8")).toContain("K681-API-011");
  });
});
