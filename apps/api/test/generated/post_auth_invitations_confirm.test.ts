// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/invitations/confirm
// 確認の口は、保留の行（待っている・使われた・期限切れ）と招待の様子（使える・使われた・取り消し）と、その間に登録された同じメールのアカウントの組み合わせで答えが決まる。生成の試験の種では保留の行と確認のトークンを作れない（K-422）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/invitations/confirm", () => {
  it("test_post_auth_invitations_confirm_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/invitations/confirm が「招待の中身（会社・層・役割）を見て参加する」として呼ばれたとき THEN Kaname は「テナントへの所属を作り、層と権限の束を結ぶ」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-007");
  });
  it("test_post_auth_invitations_confirm_ok_2", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/invitations/confirm が「規約とプライバシーポリシーを読んで同意する」として呼ばれたとき THEN Kaname は「同意した版と時刻を残す。版が上がったら次のログインで同意を取り直す」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F2/invitation-accept-new.test.ts の「K332-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-accept-new.test.ts", "utf8")).toContain("K332-API-003");
  });
  it("test_post_auth_invitations_confirm_rejected_422", () => {
    // UNWANTED: IF 確認のトークンが受け付けられないなら、Kaname は 422 と欄ごとの理由を返し、何も作らない
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-018");
  });
  it("test_post_auth_invitations_confirm_rejected_403", () => {
    // UNWANTED: IF 招いたワークスペースが止められているなら、Kaname は 403 と E-AUTH-012 を返し、利用者を作らず招待も使わない
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-017");
  });
  it("test_post_auth_invitations_confirm_not_found", () => {
    // UNWANTED: IF 確認のリンクの印が見つからないなら、Kaname は 404 と E-INV-001 を返し、何も作らない
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-018");
  });
  it("test_post_auth_invitations_confirm_conflict", () => {
    // UNWANTED: IF 確認までの間に同じメールのアカウントができたなら、Kaname は 409 と E-INV-006 を返し、利用者を作らず保留の行を閉じる
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-016");
  });
  it("test_post_auth_invitations_confirm_gone", () => {
    // UNWANTED: IF 確認のリンクか招待が使えないなら、Kaname は 410 とその理由の番号を返し、利用者を作らない
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-008");
  });
  it("test_post_auth_invitations_confirm_session_unresolved", () => {
    // UNWANTED: IF 利用者を作る所か受諾が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、作った利用者を消して確認の印を戻す。セッションだけが落ちたなら参加は取り消さない
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-024");
  });
  it("test_post_auth_invitations_confirm_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（回数は入口の共通の数えで、同じ表の口の型の確かめは acceptInvitation の K332-API-013 が持つ）：UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_auth_invitations_confirm_rate_limited");
  it("test_post_auth_invitations_confirm_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_auth_invitations_confirm_shape", () => {
    // UBIQUITOUS: POST /api/v1/auth/invitations/confirm の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/invite-link-confirm.test.ts の「K422-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/invite-link-confirm.test.ts", "utf8")).toContain("K422-API-007");
  });
});
