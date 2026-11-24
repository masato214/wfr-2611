// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/knowledge_pages/:id
// ページは棚・役・下書きの持ち主・必ず守るの字数で答えが変わる。生成の試験の偽のセッションでは棚も所属も版も作れない（K-677）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/knowledge_pages/:id", () => {
  it("test_get_knowledge_pages_id_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/knowledge_pages/:id が「層ごとのページを書く・直す」として呼ばれたとき THEN Kaname は「版を残す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-page-read.test.ts の「K677-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-read.test.ts", "utf8")).toContain("K677-API-002");
  });
  it("test_get_knowledge_pages_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-page-read.test.ts の「K677-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-read.test.ts", "utf8")).toContain("K677-API-021");
  });
  // 当てはまらない（見えない物は 403 でなく 404（在るかを漏らさない・K677-API-012））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_knowledge_pages_id_rejected_403");
  it("test_get_knowledge_pages_id_not_found", () => {
    // UNWANTED: IF ページが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-page-read.test.ts の「K677-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-read.test.ts", "utf8")).toContain("K677-API-012");
  });
  // 当てはまらない（道の id が uuid でない行は共有の試験 K144-API-100（この葉の葉のファイル k144.d/K-677.ts）が受ける）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_knowledge_pages_id_rejected_422");
  it("test_get_knowledge_pages_id_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_knowledge_pages_id_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-page-read.test.ts の「K677-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-read.test.ts", "utf8")).toContain("K677-API-023");
  });
  it("test_get_knowledge_pages_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_knowledge_pages_id_mfa_pending");
  it("test_get_knowledge_pages_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_knowledge_pages_id_shape", () => {
    // UBIQUITOUS: GET /api/v1/knowledge_pages/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-page-read.test.ts の「K677-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-page-read.test.ts", "utf8")).toContain("K677-API-001");
  });
});
