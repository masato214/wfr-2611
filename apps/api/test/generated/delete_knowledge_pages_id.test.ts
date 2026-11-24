// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。DELETE /api/v1/knowledge_pages/:id
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe("DELETE /api/v1/knowledge_pages/:id", () => {
  // EVENT-DRIVEN: WHEN DELETE /api/v1/knowledge_pages/:id が「木からページを選び、書く・書き終える・やめる・動かす・消す。必ず守るを付ける・外す」として呼ばれたとき THEN Kaname は「下書きは自動で保存・書き終えると版を残す・必ず守るは上限まで」を行い 2xx を返す
  it.todo("test_delete_knowledge_pages_id_ok");
  // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_delete_knowledge_pages_id_rejected_401");
  // UNWANTED: IF ページに書けない人なら、Kaname は 403 を返し、何も変えない
  it.todo("test_delete_knowledge_pages_id_rejected_403");
  // UNWANTED: IF ページが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない
  it.todo("test_delete_knowledge_pages_id_not_found");
  // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_delete_knowledge_pages_id_rejected_422");
  // UNWANTED: IF 上げる・共有する頼みが承認待ちなら、Kaname は 409 と E-KNW-011 を返し、ページもフォルダも変えない
  it.todo("test_delete_knowledge_pages_id_conflict");
  // UNWANTED: IF 必ず守るが付いているなら、Kaname は 409 と E-KNW-050 を返し、ページもフォルダも変えない
  it.todo("test_delete_knowledge_pages_id_conflict_2");
  // UNWANTED: IF ほかのグループに共有しているなら、Kaname は 409 と E-KNW-051 を返し、ページもフォルダも変えない
  it.todo("test_delete_knowledge_pages_id_conflict_3");
  // UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、ページもフォルダも変えない
  it.todo("test_delete_knowledge_pages_id_session_unresolved");
  // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_knowledge_pages_id_rate_limited");
  // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_delete_knowledge_pages_id_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_knowledge_pages_id_mfa_pending");
  // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
  it.todo("test_delete_knowledge_pages_id_session_unresolved_2");
  // UBIQUITOUS: DELETE /api/v1/knowledge_pages/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_delete_knowledge_pages_id_shape");
});
