// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/tickets/:id/handover-preview
// 渡す前の下見は、チケットの担当・グループ・役（管理する人・書ける人・閲覧のみ）・止まり（AI・承認・待っている渡し）・候補の人の状態（止まっている・招待中）と今週の件数の組み合わせで答えが変わる。生成の試験の種では作れない（K-401）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/tickets/:id/handover-preview", () => {
  it("test_get_tickets_id_handover_preview_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/tickets/:id/handover-preview が「人かグループを選んで配る」として呼ばれたとき THEN Kaname は「層ごとの合意の要否に沿って知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-001");
  });
  it("test_get_tickets_id_handover_preview_ok_2", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/tickets/:id/handover-preview が「引き取りを申し出る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-005");
  });
  it("test_get_tickets_id_handover_preview_ok_3", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/tickets/:id/handover-preview が「相手・理由・お願い・返事の期限を書いて渡す」として呼ばれたとき THEN Kaname は「渡し中にして相手に知らせる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-001");
  });
  it("test_get_tickets_id_handover_preview_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-010");
  });
  it("test_get_tickets_id_handover_preview_rejected_403", () => {
    // UNWANTED: IF その人ができる種類が無いなら、Kaname は 403 と E-HND-002 を返し、候補の人などの中身を返さない
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-006");
  });
  it("test_get_tickets_id_handover_preview_not_found", () => {
    // UNWANTED: IF 見えないチケットの下見なら、Kaname は 404 と E-PAGE-001 を返し、中身を返さない
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-009");
  });
  // 当てはまらない（体を受けない GET。道の id の形は入口の共通の確かめ（K144-API-900））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_tickets_id_handover_preview_rejected_422");
  it("test_get_tickets_id_handover_preview_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-010");
  });
  it("test_get_tickets_id_handover_preview_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_tickets_id_handover_preview_mfa_pending");
  it("test_get_tickets_id_handover_preview_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_tickets_id_handover_preview_shape", () => {
    // UBIQUITOUS: GET /api/v1/tickets/:id/handover-preview の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F8/handover-base.test.ts の「K401-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F8/handover-base.test.ts", "utf8")).toContain("K401-API-001");
  });
});
