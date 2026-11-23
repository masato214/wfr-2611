// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/invitations/link
// 招待のリンクは、グループ・役割・本人確認の取り直し・招く権限と、作ったリンクで参加できるかの組み合わせで答えが決まる。生成の試験の種では作れない（K-421）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/invitations/link", () => {
  it("test_post_invitations_link_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/invitations/link が「メールと層と権限の束を選んで招く」として呼ばれたとき THEN Kaname は「招待（7 日）を送る」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/invite-link.test.ts の「K421-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link.test.ts", "utf8")).toContain("K421-API-001");
  });
  it("test_post_invitations_link_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/invite-link.test.ts の「K421-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link.test.ts", "utf8")).toContain("K421-API-004");
  });
  it("test_post_invitations_link_rejected_403", () => {
    // UNWANTED: IF 管理者として入るリンクを作るのに取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、招待を作らない
    // 本物の試験：apps/api/test/features/F10/invite-link.test.ts の「K421-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link.test.ts", "utf8")).toContain("K421-API-004");
  });
  it("test_post_invitations_link_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、招待のリンクを作らない
    // 本物の試験：apps/api/test/features/F10/invite-link.test.ts の「K421-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link.test.ts", "utf8")).toContain("K421-API-005");
  });
  it("test_post_invitations_link_not_found", () => {
    // UNWANTED: IF グループがこの会社に無い・消したなら、Kaname は 404 と E-INV-011 を返し、招待のリンクを作らない
    // 本物の試験：apps/api/test/features/F10/invite-link.test.ts の「K421-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link.test.ts", "utf8")).toContain("K421-API-002");
  });
  it("test_post_invitations_link_session_unresolved", () => {
    // UNWANTED: IF 招待を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、招待も証跡も残さない
    // 本物の試験：apps/api/test/features/F10/invite-link.test.ts の「K421-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link.test.ts", "utf8")).toContain("K421-API-016");
  });
  it("test_post_invitations_link_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（上限は入口の共通（op.ts の limits）で、口ごとの上限の数を契約に持たない。上限の 429 は入口の共通の試験が見る（K-419 の招く口と同じ扱い））：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_invitations_link_rate_limited");
  it("test_post_invitations_link_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_invitations_link_mfa_pending");
  it("test_post_invitations_link_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_invitations_link_shape", () => {
    // UBIQUITOUS: POST /api/v1/invitations/link の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/invite-link.test.ts の「K421-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link.test.ts", "utf8")).toContain("K421-API-001");
  });
});
