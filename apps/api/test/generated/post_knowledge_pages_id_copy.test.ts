// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/knowledge_pages/:id/copy
// 写せるかは棚（会社・グループ・共有・自分）と元の状態（公開済み・下書き）・フォルダで答えが変わる。生成の試験の偽のセッションでは棚も所属も共有も作れない（K-690）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/knowledge_pages/:id/copy", () => {
  it("test_post_knowledge_pages_id_copy_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/knowledge_pages/:id/copy が「木からページを選び、書く・書き終える・やめる・動かす・消す。必ず守るを付ける・外す」として呼ばれたとき THEN Kaname は「下書きは自動で保存・書き終えると版を残す・必ず守るは上限まで」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-001");
  });
  it("test_post_knowledge_pages_id_copy_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-015");
  });
  // 当てはまらない（読める人なら誰でも写せる（写しは本人の棚）ので、この口に 403 の道は無い。役が合わない人の止めは入口の共通（op.ts））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_post_knowledge_pages_id_copy_rejected_403");
  it("test_post_knowledge_pages_id_copy_not_found", () => {
    // UNWANTED: IF ページか写す先が無いか見えないなら、Kaname は 404 を返し、何も作らない
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-006");
  });
  it("test_post_knowledge_pages_id_copy_conflict", () => {
    // UNWANTED: IF ページがまだ書き終わっていない（下書きだけ）なら、Kaname は 409 と E-KNW-010 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-005");
  });
  it("test_post_knowledge_pages_id_copy_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-010");
  });
  it("test_post_knowledge_pages_id_copy_conflict_2", () => {
    // UNWANTED: IF 自分の棚のページを写そうとしたなら、Kaname は 409 と E-KNW-080 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-005");
  });
  it("test_post_knowledge_pages_id_copy_session_unresolved", () => {
    // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、ページもフォルダも変えない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（体の大きさの上限は入口の共通（K-144・この口の体は 1 欄））：UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
  it.todo("test_post_knowledge_pages_id_copy_too_large");
  it("test_post_knowledge_pages_id_copy_rate_limited", () => {
    // UNWANTED: IF 30/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-016");
  });
  it("test_post_knowledge_pages_id_copy_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_knowledge_pages_id_copy_mfa_pending");
  it("test_post_knowledge_pages_id_copy_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_knowledge_pages_id_copy_shape", () => {
    // UBIQUITOUS: POST /api/v1/knowledge_pages/:id/copy の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/knowledge-copy.test.ts の「K690-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/knowledge-copy.test.ts", "utf8")).toContain("K690-API-001");
  });
});
