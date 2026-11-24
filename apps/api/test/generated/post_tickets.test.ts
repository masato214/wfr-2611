// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets
// K-60 の口は本物の振る舞い（hooks）と、種別の必須の区画・期限が今日より前でない・同じ会社の確かめが要る。生成の試験の土台（表の種の入力）では確かめられない（K-60）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets", () => {
  it("test_post_tickets_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets が「過去のチケットを選んで複製し、日付と値だけ直す」として呼ばれたとき THEN Kaname は「新しい番号で写しを作る（元へのつながりを残す）」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-001");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F4/create-ticket.test.ts）：EVENT-DRIVEN: WHEN POST /api/v1/tickets が「見本（自分宛にメールを送る など）を開いて AI に任せてみる」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：見本のチケットを最初から並べる）
  it.todo("test_post_tickets_ok_2");
  it("test_post_tickets_ok_3", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets が「種別を選び、題名・責任者・期限・目的・完了の条件を書く」として呼ばれたとき THEN Kaname は「番号（グループの頭文字＋連番）を振る・版を残す」を行い 2xx を返す（自動側：ルールを当てて既定値を入れる）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-001");
  });
  it("test_post_tickets_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-042");
  });
  it("test_post_tickets_rejected_403", () => {
    // UNWANTED: IF そのグループにチケットを書けないなら、Kaname は 403 と FORBIDDEN を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-005");
  });
  it("test_post_tickets_conflict", () => {
    // UNWANTED: IF 親子が 3 段を超えるなら、Kaname は 409 と E-VAL-015 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket-defaults.test.ts の「K437-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket-defaults.test.ts", "utf8")).toContain("K437-API-017");
  });
  it("test_post_tickets_rejected_422", () => {
    // UNWANTED: IF 区画 sections だけで作り必須の区画が空なら、Kaname は 422 と E-VAL-013 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-008");
  });
  it("test_post_tickets_not_found", () => {
    // UNWANTED: IF 選んだ種別・担当者・知らせる人・親・会社の項目が無いか選べないなら、Kaname は 404 と E-PAGE-001 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-019");
  });
  it("test_post_tickets_conflict_2", () => {
    // UNWANTED: IF 期限が今日より前なら、Kaname は 409 と E-VAL-012 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-023");
  });
  it("test_post_tickets_conflict_3", () => {
    // UNWANTED: IF 開始日が期限より後なら、Kaname は 409 と E-VAL-028 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-022」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-022");
  });
  it("test_post_tickets_conflict_4", () => {
    // UNWANTED: IF その種別に出ない会社の項目に値を付けたなら、Kaname は 409 と E-FLD-001 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket-defaults.test.ts の「K437-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket-defaults.test.ts", "utf8")).toContain("K437-API-007");
  });
  it("test_post_tickets_conflict_5", () => {
    // UNWANTED: IF 会社の項目の選択肢に無い値を付けたなら、Kaname は 409 と E-FLD-002 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket-defaults.test.ts の「K437-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket-defaults.test.ts", "utf8")).toContain("K437-API-007");
  });
  it("test_post_tickets_conflict_6", () => {
    // UNWANTED: IF 会社の項目の型と合わない値を付けたなら、Kaname は 409 と E-FLD-003 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket-defaults.test.ts の「K437-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket-defaults.test.ts", "utf8")).toContain("K437-API-009");
  });
  it("test_post_tickets_conflict_7", () => {
    // UNWANTED: IF 会社が必須にした項目が空なら、Kaname は 409 と E-FLD-004 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/create-ticket-defaults.test.ts の「K437-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket-defaults.test.ts", "utf8")).toContain("K437-API-006");
  });
  it("test_post_tickets_not_found_2", () => {
    // UNWANTED: IF 複製の元のチケットが無いか見えないなら、Kaname は 404 と E-DUP-001 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/ticket-duplicate.test.ts の「K438-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-duplicate.test.ts", "utf8")).toContain("K438-API-017");
  });
  it("test_post_tickets_conflict_8", () => {
    // UNWANTED: IF 子チケットを写すと親子が 3 段を超えるなら、Kaname は 409 と E-DUP-002 を返し、チケットを作らない
    // 本物の試験：apps/api/test/features/F4/ticket-duplicate-children.test.ts の「K438-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/ticket-duplicate-children.test.ts", "utf8")).toContain("K438-API-015");
  });
  it("test_post_tickets_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_tickets_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-031」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-031");
  });
  it("test_post_tickets_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-043」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-043");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_tickets_mfa_pending");
  it("test_post_tickets_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_tickets_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F4/create-ticket.test.ts の「K60-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F4/create-ticket.test.ts", "utf8")).toContain("K60-API-001");
  });
});
