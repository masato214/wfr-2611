// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/tickets/:id
// 段・実績・保留の変更は、今の段・行き先の段・走っている実行・担当者の組み合わせで答えが変わる。生成の試験の種では作れない（K-387）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/tickets/:id", () => {
  it("test_patch_tickets_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「責任者・期限・分類・親を決める」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：振り分けの案を出す）
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-001");
  });
  it("test_patch_tickets_id_ok_2", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「印の付いたチケットを開いて手を打つ」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-002");
  });
  it("test_patch_tickets_id_ok_3", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「理由と再開条件を書いて保留にする」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-014");
  });
  it("test_patch_tickets_id_ok_4", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/tickets/:id が「作業の段を動かす」として呼ばれたとき THEN Kaname は「実績時間を記録」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-010");
  });
  it("test_patch_tickets_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-020");
  });
  it("test_patch_tickets_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-020");
  });
  it("test_patch_tickets_id_not_found", () => {
    // UNWANTED: IF チケットか指した段・親が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-020");
  });
  it("test_patch_tickets_id_rejected_422", () => {
    // UNWANTED: IF まだ変えられない欄を送ったなら、Kaname は 422 と E-VAL-018 と欄ごとの理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-018");
  });
  it("test_patch_tickets_id_conflict", () => {
    // UNWANTED: IF AI が動いている間か承認待ちの間に段を変えようとしたら、Kaname は 409 と E-CONF-030 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-011");
  });
  it("test_patch_tickets_id_conflict_2", () => {
    // UNWANTED: IF 完了したチケットの段を、作業中への開き直し以外に変えようとしたら、Kaname は 409 と E-CONF-032 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-012");
  });
  it("test_patch_tickets_id_conflict_3", () => {
    // UNWANTED: IF 段の口で移せない段を行き先にしたなら、Kaname は 409 と E-CONF-034 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-007");
  });
  it("test_patch_tickets_id_conflict_4", () => {
    // UNWANTED: IF 段の id で保留の段を選んで理由か条件が無いなら、Kaname は 409 と E-CONF-035 と足りない欄を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-005");
  });
  it("test_patch_tickets_id_conflict_5", () => {
    // UNWANTED: IF 保留でないのに保留の理由か条件を書こうとしたら、Kaname は 409 と E-CONF-036 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-006");
  });
  it("test_patch_tickets_id_conflict_6", () => {
    // UNWANTED: IF チケット自身を親にしようとしたなら、Kaname は 409 と E-TKT-001 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-sort.test.ts の「K440-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-sort.test.ts", "utf8")).toContain("K440-API-008");
  });
  it("test_patch_tickets_id_conflict_7", () => {
    // UNWANTED: IF 自分の子孫を親にしようとしたなら、Kaname は 409 と E-TKT-002 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-sort.test.ts の「K440-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-sort.test.ts", "utf8")).toContain("K440-API-009");
  });
  it("test_patch_tickets_id_conflict_8", () => {
    // UNWANTED: IF 親子が 3 段を超える親を決めようとしたなら、Kaname は 409 と E-TKT-003 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-sort.test.ts の「K440-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-sort.test.ts", "utf8")).toContain("K440-API-010");
  });
  it("test_patch_tickets_id_conflict_9", () => {
    // UNWANTED: IF 期限が親より後のチケットに親を決めようとしたなら、Kaname は 409 と E-TKT-004 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-sort.test.ts の「K440-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-sort.test.ts", "utf8")).toContain("K440-API-011");
  });
  it("test_patch_tickets_id_conflict_10", () => {
    // UNWANTED: IF そのチケットの種別に出ない項目に値を入れようとしたなら、Kaname は 409 と E-FLD-001 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-field-values.test.ts の「K564-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-field-values.test.ts", "utf8")).toContain("K564-API-007");
  });
  it("test_patch_tickets_id_conflict_11", () => {
    // UNWANTED: IF 選択肢に無い値を項目に入れようとしたなら、Kaname は 409 と E-FLD-002 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-field-values.test.ts の「K564-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-field-values.test.ts", "utf8")).toContain("K564-API-008");
  });
  it("test_patch_tickets_id_conflict_12", () => {
    // UNWANTED: IF 項目の型と合わない値を入れようとしたなら、Kaname は 409 と E-FLD-003 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-field-values.test.ts の「K564-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-field-values.test.ts", "utf8")).toContain("K564-API-009");
  });
  it("test_patch_tickets_id_conflict_13", () => {
    // UNWANTED: IF 必須の項目を空にしようとしたなら、Kaname は 409 と E-FLD-004 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F4/ticket-field-values.test.ts の「K564-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-field-values.test.ts", "utf8")).toContain("K564-API-005");
  });
  it("test_patch_tickets_id_rejected_422_2", () => {
    // UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由（E-VAL-041・E-VAL-047 を含む）を返し、何も書かない
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-028」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-028");
  });
  it("test_patch_tickets_id_unavailable", () => {
    // UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 503 を返し、段・保留の列・変更の 1 行・知らせを前のまま残す
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-029」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-029");
  });
  it("test_patch_tickets_id_unavailable_2", () => {
    // UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-024");
  });
  it("test_patch_tickets_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_tickets_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-025");
  });
  it("test_patch_tickets_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_tickets_id_mfa_pending");
  it("test_patch_tickets_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_tickets_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/tickets/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F6/progress.test.ts の「K387-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F6/progress.test.ts", "utf8")).toContain("K387-API-001");
  });
});
