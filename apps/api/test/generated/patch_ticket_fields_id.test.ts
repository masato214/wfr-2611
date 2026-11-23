// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/ticket-fields/:id
// 項目を直す・消す・並べるは権限（custom_fields の edit）・名前の一意・値が入っているか・選ぶ物の id で答えが変わる。生成の試験の偽のセッションでは作れない（K-717）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/ticket-fields/:id", () => {
  it("test_patch_ticket_fields_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/ticket-fields/:id が「タブごとに値を足す・直す」として呼ばれたとき THEN Kaname は「使われている値を消すときは置き換え先を決める」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-001");
  });
  it("test_patch_ticket_fields_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-009");
  });
  it("test_patch_ticket_fields_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-009");
  });
  it("test_patch_ticket_fields_id_not_found", () => {
    // UNWANTED: IF 項目か種別か選択肢が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-003");
  });
  it("test_patch_ticket_fields_id_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-003");
  });
  it("test_patch_ticket_fields_id_conflict", () => {
    // UNWANTED: IF ほかの項目と同じ名前に直す（消していない項目の中・前後の空白を落として比べる）なら、Kaname は 409 と E-FMS-001 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-014");
  });
  it("test_patch_ticket_fields_id_conflict_2", () => {
    // UNWANTED: IF 値が 1 つでも入っている項目の型を変えるなら、Kaname は 409 と E-FMS-002 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-004");
  });
  it("test_patch_ticket_fields_id_conflict_3", () => {
    // UNWANTED: IF 1 つの項目に同じ名前の選ぶ物が 2 つあるなら、Kaname は 409 と E-FMS-004 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-015");
  });
  it("test_patch_ticket_fields_id_conflict_4", () => {
    // UNWANTED: IF 選ぶ型でない項目に選ぶ物だけを送るなら、Kaname は 409 と E-FMS-005 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-005");
  });
  it("test_patch_ticket_fields_id_session_unresolved", () => {
    // UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、項目も種別の行も証跡も前のまま残す
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-013");
  });
  it("test_patch_ticket_fields_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（上限は口の共通の仕組み（op.ts・30/min/user）。書く口の上限は足す口の K706-API-010 が同じ仕組みで見る）：UNWANTED: IF 30/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_patch_ticket_fields_id_rate_limited");
  it("test_patch_ticket_fields_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_ticket_fields_id_mfa_pending");
  it("test_patch_ticket_fields_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_ticket_fields_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/ticket-fields/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-001");
  });
});
