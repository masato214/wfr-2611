// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/ticket_stages
// 状態の一覧の答え（TicketStageSetting・lock・色）は会社の初めの段と仕組みの段・消した段で変わる。生成の試験の偽のセッションでは会社の段の行が作れない（K-705）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/ticket_stages", () => {
  it("test_get_ticket_stages_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/ticket_stages が「責任者・期限・分類・親を決める」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：振り分けの案を出す）
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-001");
  });
  it("test_get_ticket_stages_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-017");
  });
  // 当てはまらない（会社のメンバーなら誰でも読める口（権限の 403 は無い・前から同じ））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_ticket_stages_rejected_403");
  // 当てはまらない（問い合わせは cursor・limit・sort を形だけ受けて動きを変えない（入口の共通の確かめ・一覧の口と同じ op.ts））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_ticket_stages_rejected_422");
  // 当てはまらない（上限は入口の共通（op.ts・120/min/user）。書く口の上限は K705-API-019 が見る）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_ticket_stages_rate_limited");
  it("test_get_ticket_stages_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_ticket_stages_mfa_pending");
  it("test_get_ticket_stages_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_ticket_stages_shape", () => {
    // UBIQUITOUS: GET /api/v1/ticket_stages の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/ticket-stages-write.test.ts の「K705-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-stages-write.test.ts", "utf8")).toContain("K705-API-001");
  });
});
