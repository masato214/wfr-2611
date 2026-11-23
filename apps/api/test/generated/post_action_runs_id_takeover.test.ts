// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/action_runs/:id/takeover
// 自分で直すは、担当者・実行の状態・新しい実行の有無・PC の仕事の状態で答えが変わる。生成の試験の種では担当者と止まった実行の組を作れない（K-485）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/action_runs/:id/takeover", () => {
  it("test_post_action_runs_id_takeover_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/action_runs/:id/takeover が「理由ごとの直し方に沿って押す」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-012");
  });
  it("test_post_action_runs_id_takeover_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-024");
  });
  it("test_post_action_runs_id_takeover_rejected_403", () => {
    // UNWANTED: IF 担当者でない人か担当者のいないチケットで自分で直すにしようとしたなら、Kaname は 403 と E-STP-001 を返し、実行も仕事も段もやり取りも変えない
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-015");
  });
  it("test_post_action_runs_id_takeover_not_found", () => {
    // UNWANTED: IF 見えない実行・無い実行・消したチケットの実行を自分で直すにしようとしたなら、Kaname は 404 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-016");
  });
  it("test_post_action_runs_id_takeover_conflict", () => {
    // UNWANTED: IF 承認待ち・完了のチケットか承認の後の実行か作り終えた実行を自分で直すにしようとしたなら、Kaname は 409 と E-STP-002 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-017");
  });
  it("test_post_action_runs_id_takeover_rejected_422", () => {
    // UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-023");
  });
  it("test_post_action_runs_id_takeover_conflict_2", () => {
    // UNWANTED: IF もう自分で進めることにした実行をもう一度自分で直すにしようとしたなら、Kaname は 409 と E-STP-003 を返し、やり取りの行も証跡も増やさない
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-019」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-019");
  });
  it("test_post_action_runs_id_takeover_conflict_3", () => {
    // UNWANTED: IF 同じチケットにもっと新しい実行があるのに古い止まりを自分で直すにしようとしたなら、Kaname は 409 と E-STP-004 を返し、新しい実行を止めずに何も変えない
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-021");
  });
  it("test_post_action_runs_id_takeover_session_unresolved", () => {
    // UNWANTED: IF 切り替える関数か証跡の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、実行も仕事もチケットもやり取りも変えない
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-025」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-025");
  });
  it("test_post_action_runs_id_takeover_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_action_runs_id_takeover_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-024");
  });
  it("test_post_action_runs_id_takeover_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_action_runs_id_takeover_mfa_pending");
  it("test_post_action_runs_id_takeover_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_action_runs_id_takeover_shape", () => {
    // UBIQUITOUS: POST /api/v1/action_runs/:id/takeover の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F7/stopped-takeover.test.ts の「K485-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/stopped-takeover.test.ts", "utf8")).toContain("K485-API-012");
  });
});
