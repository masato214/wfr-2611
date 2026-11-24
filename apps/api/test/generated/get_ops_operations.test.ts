// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。GET /api/v1/ops/operations
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("GET /api/v1/ops/operations", () => {
  // EVENT-DRIVEN: WHEN GET /api/v1/ops/operations が「配るもの › 操作で、ブラウザで操作する の版と中身を見る（上げる・版を出すは押せない形）」として呼ばれたとき THEN Kaname は「操作の版はコードで出す（運営の画面からは上げない）」を行い 2xx を返す
  it.todo("test_get_ops_operations_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_get_ops_operations_rejected_401");
  // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_ops_operations_rejected_403");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_ops_operations_rejected_422");
  // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_ops_operations_rate_limited");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_ops_operations_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_ops_operations_mfa_pending");
  // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
  it.todo("test_get_ops_operations_session_unresolved");
  // UNWANTED: IF スキルの一式に資格情報・会社名・個人名が混ざっている、テストの場面が 1 つでも失敗している、または版のメモが空のまま「出す」を押した THEN Kaname は「この版は出せません。テストで失敗した場面があります（外部サービスの規約変更）。直して再テストしてください」を返し、失敗した場面を見る／直して「上げてテストで動かす」（E-ACT-041）
  it.todo("test_get_ops_operations_rejected_422_2");
});
