// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/ticket-fields/:id
// 項目を直す・消す・並べるは権限（custom_fields の edit）・名前の一意・値が入っているか・選ぶ物の id で答えが変わる。生成の試験の偽のセッションでは作れない（K-717）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/ticket-fields/:id", () => {
  it("test_delete_ticket_fields_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/ticket-fields/:id が「種別・状態・項目を、タブごとに足す・直す・並べる・消す」として呼ばれたとき THEN Kaname は「使っているチケットがある種別・状態は消せない。消した項目の値は見えなくなる」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-006");
  });
  it("test_delete_ticket_fields_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-009");
  });
  it("test_delete_ticket_fields_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-009");
  });
  it("test_delete_ticket_fields_id_not_found", () => {
    // UNWANTED: IF 項目か種別か選択肢が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も変えない
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-003");
  });
  // 当てはまらない（道の id の形は入口の共通の uuid の確かめ（共有の試験 k144 の K144-API-975 が見る））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_delete_ticket_fields_id_rejected_422");
  it("test_delete_ticket_fields_id_session_unresolved", () => {
    // UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、項目も種別の行も証跡も前のまま残す
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-012");
  });
  // 当てはまらない（上限は口の共通の仕組み（op.ts・30/min/user）。書く口の上限は足す口の K706-API-010 が同じ仕組みで見る）：UNWANTED: IF 30/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_ticket_fields_id_rate_limited");
  it("test_delete_ticket_fields_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_ticket_fields_id_mfa_pending");
  it("test_delete_ticket_fields_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_ticket_fields_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/ticket-fields/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F9/ticket-fields-edit.test.ts の「K717-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F9/ticket-fields-edit.test.ts", "utf8")).toContain("K717-API-006");
  });
});
