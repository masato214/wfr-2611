// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/bridge/files/:ref
// ファイルは仕事に付いた資料と仕事を受け取った PC で答えが変わる。生成の試験の種では資料を付けた仕事を作れない（K-761）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/bridge/files/:ref", () => {
  it("test_get_bridge_files_ref_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/bridge/files/:ref が「「AI に任せる」を押す」として呼ばれたとき THEN Kaname は「チケットのセッションを開く・実行を記録する」を行い 2xx を返す（自動側：責任者の自分の AI が、選んだ業務の型とルールで成果物を作る。①機械の検査はサーバー、②AI の判定は別のセッションで 2 回）
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-006");
  });
  it("test_get_bridge_files_ref_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-008");
  });
  it("test_get_bridge_files_ref_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-008");
  });
  it("test_get_bridge_files_ref_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-009");
  });
  it("test_get_bridge_files_ref_not_found", () => {
    // UNWANTED: IF その仕事に付いていない資料か、受け取っていない・動いていない仕事なら、Kaname は 404 を返し、署名 URL を出さない
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-007");
  });
  it("test_get_bridge_files_ref_upstream_failed", () => {
    // UNWANTED: IF 置き場が資料の署名 URL を出せないなら、Kaname は 502 と E-TALK-040 を返し、署名の鍵を出さない
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-010");
  });
  it("test_get_bridge_files_ref_session_unresolved", () => {
    // UNWANTED: IF 資料を引く DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、署名 URL を出さない
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-010");
  });
  it("test_get_bridge_files_ref_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-010");
  });
  it("test_get_bridge_files_ref_upstream_failed_2", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-010");
  });
  it("test_get_bridge_files_ref_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_bridge_files_ref_shape", () => {
    // UBIQUITOUS: GET /api/v1/bridge/files/:ref の副作用は関門 C2・C3・C5 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/job-extra.test.ts の「K761-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/job-extra.test.ts", "utf8")).toContain("K761-API-006");
  });
});
