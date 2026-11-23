// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/ops-setup
// パスキーを付けるリンクは、命令（createFirstOps）が作った印とその人の運営の行がそろって初めて試せる。生成の試験の種では印を作れない（K-945）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/ops-setup", () => {
  it("test_post_auth_ops_setup_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/ops-setup が「運営の人ごとに 問い合わせ・中を見る・お金・止める・お知らせ・配るもの・値段の案・値段を決める・運営の人 を付ける」として呼ばれたとき THEN Kaname は「運営の人はパスキーでしか入れない」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-setup.test.ts の「K945-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-setup.test.ts", "utf8")).toContain("K945-API-006");
  });
  it("test_post_auth_ops_setup_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、リンクを使わない
    // 本物の試験：apps/api/test/features/F12/ops-setup.test.ts の「K945-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-setup.test.ts", "utf8")).toContain("K945-API-012");
  });
  it("test_post_auth_ops_setup_conflict", () => {
    // UNWANTED: IF リンクの印が使えないなら、Kaname は 409 と E-PAGE-006 を返し、セッションを作らない
    // 本物の試験：apps/api/test/features/F12/ops-setup.test.ts の「K945-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-setup.test.ts", "utf8")).toContain("K945-API-010");
  });
  it("test_post_auth_ops_setup_session_unresolved", () => {
    // UNWANTED: IF セッションを作れないなら、Kaname は 503 と E-PAGE-003 を返し、運営として入れるセッションを残さない
    // 本物の試験：apps/api/test/features/F12/ops-setup.test.ts の「K945-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-setup.test.ts", "utf8")).toContain("K945-API-018");
  });
  it("test_post_auth_ops_setup_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_auth_ops_setup_rate_limited", () => {
    // UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-setup.test.ts の「K945-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-setup.test.ts", "utf8")).toContain("K945-API-015");
  });
  it("test_post_auth_ops_setup_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_auth_ops_setup_shape", () => {
    // UBIQUITOUS: POST /api/v1/auth/ops-setup の副作用は関門 C2・C4 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F12/ops-setup.test.ts の「K945-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-setup.test.ts", "utf8")).toContain("K945-API-006");
  });
});
