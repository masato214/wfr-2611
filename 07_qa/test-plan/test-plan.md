# Kaname テスト計画（v3・2026-11-23・機械生成）

> 05_flow/build_testplan.py が生成。信頼源は test-plan.json。根拠の決定：D-001 D-002 D-004 D-007 D-008 D-010 D-012 D-013 D-014 D-015 D-015.7 D-017 D-024 D-024.7 D-025 D-026 D-029 D-030 D-037 D-038 D-040 D-040.5 D-041 D-041.6 D-042 D-043 D-043.3 D-044 D-045 D-047 D-050 D-051.2 D-055 D-062 D-064 D-065.2 D-066 D-068 D-069 D-069.8 D-070 D-073.1 D-074.1 D-074.5 D-075.2 D-075.3 D-075.4 D-075.5 D-076 D-076.3 D-076.4 D-077.1 D-077.8 D-081.2 D-081.3 D-081.4 D-081.5 D-087 D-087.1 D-088 D-088.2 D-088.3 D-088.4 D-088.5 D-088.9 D-089 D-090 D-091 D-092 D-092.1 D-092.2 D-093 D-093.1 D-093.2 D-093.3 D-093.4 D-094 D-095 D-096 D-096.1 D-096.2 D-096.3 D-096.4 D-096.5 D-097 D-097.1 D-097.6 D-101 D-101.1 D-101.2 D-102 D-102.2 D-102.5 D-104.14 D-105 D-107 D-107.2 D-108 D-109 D-110 D-117 D-119 D-120 D-122.1 D-123.1 D-124 D-125.1 D-125.102 D-125.103 D-125.105 D-125.106 D-125.107 D-125.108 D-125.110 D-125.111 D-125.115 D-125.117 D-125.118 D-125.12 D-125.121 D-125.122 D-125.123 D-125.124 D-125.125 D-125.126 D-125.127 D-125.128 D-125.13 D-125.130 D-125.131 D-125.132 D-125.135 D-125.136 D-125.137 D-125.138 D-125.139 D-125.14 D-125.140 D-125.141 D-125.142 D-125.143 D-125.144 D-125.145 D-125.146 D-125.147 D-125.148 D-125.149 D-125.150 D-125.151 D-125.152 D-125.153 D-125.154 D-125.155 D-125.156 D-125.157 D-125.158 D-125.159 D-125.162 D-125.164 D-125.165 D-125.166 D-125.167 D-125.17 D-125.19 D-125.24 D-125.27 D-125.29 D-125.30 D-125.31 D-125.32 D-125.33 D-125.36 D-125.38 D-125.39 D-125.4 D-125.40 D-125.41 D-125.42 D-125.43 D-125.44 D-125.49 D-125.50 D-125.51 D-125.52 D-125.53 D-125.55 D-125.56 D-125.57 D-125.58 D-125.59 D-125.6 D-125.60 D-125.61 D-125.62 D-125.63 D-125.64 D-125.67 D-125.68 D-125.7 D-125.70 D-125.71 D-125.72 D-125.76 D-125.79 D-125.82 D-125.83 D-125.85 D-125.97 D-125.98 D-126.1 D-126.12 D-126.13 D-126.15 D-126.16 D-126.17 D-126.18 D-126.19 D-126.2 D-126.22 D-126.23 D-126.3 D-126.5 D-127.1 D-127.11 D-127.3 D-127.4 D-127.6 D-127.8 D-127.9 D-128.10 D-128.100 D-128.101 D-128.102 D-128.103 D-128.104 D-128.105 D-128.106 D-128.108 D-128.109 D-128.11 D-128.110 D-128.111 D-128.112 D-128.113 D-128.114 D-128.115 D-128.116 D-128.117 D-128.118 D-128.119 D-128.12 D-128.120 D-128.121 D-128.122 D-128.123 D-128.124 D-128.125 D-128.126 D-128.127 D-128.128 D-128.129 D-128.130 D-128.131 D-128.132 D-128.133 D-128.134 D-128.135 D-128.136 D-128.137 D-128.138 D-128.139 D-128.14 D-128.140 D-128.141 D-128.142 D-128.143 D-128.144 D-128.145 D-128.146 D-128.147 D-128.148 D-128.149 D-128.15 D-128.150 D-128.151 D-128.152 D-128.153 D-128.154 D-128.155 D-128.156 D-128.157 D-128.158 D-128.159 D-128.16 D-128.160 D-128.161 D-128.162 D-128.163 D-128.164 D-128.165 D-128.166 D-128.167 D-128.168 D-128.169 D-128.170 D-128.171 D-128.172 D-128.173 D-128.174 D-128.175 D-128.176 D-128.177 D-128.178 D-128.179 D-128.20 D-128.22 D-128.23 D-128.24 D-128.25 D-128.26 D-128.30 D-128.32 D-128.33 D-128.36 D-128.37 D-128.38 D-128.39 D-128.40 D-128.41 D-128.42 D-128.43 D-128.44 D-128.45 D-128.46 D-128.49 D-128.50 D-128.51 D-128.52 D-128.53 D-128.54 D-128.55 D-128.57 D-128.58 D-128.59 D-128.60 D-128.61 D-128.62 D-128.63 D-128.65 D-128.67 D-128.68 D-128.69 D-128.70 D-128.71 D-128.72 D-128.75 D-128.76 D-128.77 D-128.78 D-128.80 D-128.81 D-128.83 D-128.84 D-128.85 D-128.86 D-128.87 D-128.88 D-128.89 D-128.9 D-128.90 D-128.91 D-128.92 D-128.93 D-128.94 D-128.95 D-128.96 D-128.97 D-128.98 D-129.1 D-129.10 D-129.11 D-129.12 D-129.13 D-129.14 D-129.15 D-129.16 D-129.2 D-129.3 D-129.32 D-129.4 D-129.42 D-129.43 D-129.44 D-129.45 D-129.46 D-129.47 D-129.48 D-129.49 D-129.5 D-129.50 D-129.51 D-129.52 D-129.53 D-129.6 D-129.7 D-129.8 D-129.9 D-130.1 D-130.2 D-130.3 D-130.4 D-130.5 D-131.1 D-131.10 D-131.11 D-131.12 D-131.13 D-131.14 D-131.2 D-131.3 D-131.4 D-131.5 D-131.6 D-131.7 D-131.8 D-131.9 D-132.1 D-132.2 D-132.3 D-132.4 D-132.5 D-133 D-133.1 D-133.2 D-133.3 D-133.4 D-133.5 D-133.6 D-133.7 D-134.1 D-135.1 D-135.2 D-135.3 D-135.4 D-135.5 D-136.1 D-136.2 D-136.3 D-136.4 D-136.5 D-138.1 D-138.2 D-139.1 D-140.1 D-140.2 D-140.3 D-140.4 D-141.1 D-141.2 D-141.3 D-142.1 D-142.2 D-142.3 D-142.4 D-142.5 D-143.1 D-143.2 D-143.3 D-143.4 D-143.5 D-143.6 D-144.1 D-144.2 D-144.3 D-144.4 D-144.5 D-144.6 D-144.7 D-144.8 D-145.1 D-145.10 D-145.11 D-145.12 D-145.13 D-145.14 D-145.15 D-145.16 D-145.17 D-145.18 D-145.2 D-145.3 D-145.4 D-145.5 D-145.6 D-145.7 D-145.8 D-145.9 D-146.1 D-146.2 D-146.3 D-146.4 D-146.5 D-146.6 D-146.7 D-146.8 D-147.1 D-147.2 D-147.3 D-147.4 D-148.1 D-148.10 D-148.11 D-148.12 D-148.13 D-148.14 D-148.15 D-148.16 D-148.17 D-148.18 D-148.19 D-148.2 D-148.20 D-148.21 D-148.22 D-148.23 D-148.24 D-148.25 D-148.26 D-148.27 D-148.28 D-148.29 D-148.3 D-148.30 D-148.31 D-148.32 D-148.33 D-148.34 D-148.35 D-148.36 D-148.37 D-148.38 D-148.39 D-148.4 D-148.40 D-148.41 D-148.42 D-148.43 D-148.44 D-148.45 D-148.46 D-148.47 D-148.48 D-148.49 D-148.5 D-148.50 D-148.51 D-148.6 D-148.7 D-148.8 D-148.9 D-149.1 D-149.10 D-149.11 D-149.12 D-149.13 D-149.14 D-149.15 D-149.16 D-149.17 D-149.18 D-149.19 D-149.2 D-149.20 D-149.21 D-149.22 D-149.23 D-149.24 D-149.25 D-149.26 D-149.27 D-149.3 D-149.4 D-149.5 D-149.6 D-149.7 D-149.8 D-149.9 D-150.1 D-150.10 D-150.11 D-150.12 D-150.13 D-150.14 D-150.15 D-150.16 D-150.17 D-150.18 D-150.19 D-150.2 D-150.20 D-150.21 D-150.22 D-150.23 D-150.24 D-150.25 D-150.26 D-150.27 D-150.28 D-150.29 D-150.3 D-150.30 D-150.31 D-150.32 D-150.33 D-150.34 D-150.35 D-150.36 D-150.37 D-150.38 D-150.39 D-150.4 D-150.40 D-150.41 D-150.42 D-150.43 D-150.44 D-150.45 D-150.46 D-150.47 D-150.48 D-150.49 D-150.5 D-150.50 D-150.51 D-150.52 D-150.53 D-150.54 D-150.55 D-150.56 D-150.57 D-150.58 D-150.59 D-150.6 D-150.60 D-150.61 D-150.7 D-150.8 D-150.9 D-151.1 D-151.10 D-151.11 D-151.12 D-151.13 D-151.14 D-151.15 D-151.16 D-151.17 D-151.18 D-151.19 D-151.2 D-151.20 D-151.3 D-151.4 D-151.5 D-151.6 D-151.7 D-151.8 D-151.9 D-152.1 D-152.10 D-152.11 D-152.12 D-152.13 D-152.14 D-152.15 D-152.16 D-152.17 D-152.18 D-152.19 D-152.2 D-152.20 D-152.21 D-152.22 D-152.23 D-152.24 D-152.25 D-152.26 D-152.27 D-152.28 D-152.29 D-152.3 D-152.30 D-152.31 D-152.32 D-152.33 D-152.34 D-152.35 D-152.36 D-152.37 D-152.4 D-152.5 D-152.6 D-152.7 D-152.8 D-152.9 D-153.1 D-153.10 D-153.11 D-153.12 D-153.13 D-153.14 D-153.15 D-153.16 D-153.17 D-153.18 D-153.19 D-153.2 D-153.20 D-153.21 D-153.22 D-153.23 D-153.24 D-153.25 D-153.26 D-153.27 D-153.28 D-153.29 D-153.3 D-153.30 D-153.31 D-153.32 D-153.33 D-153.4 D-153.5 D-153.6 D-153.7 D-153.8 D-153.9

## 入力

| 項目 | 数 |
|---|---|
| tickets | 218 |
| l1_rows | 5094 |
| ears_endpoints | 366 |
| ears_tests | 4015 |
| entities | 145 |
| policies | 418 |
| access_cases | 1562 |
| errors | 262 |
| journey_rows | 88 |
| critical_tasks | 88 |

## 3-tier AC ↔ テストの段

| 3-tier | 段 | 道具 | ゲート | 梯子 |
|---|---|---|---|---|
| structural（モック・契約と一致） | mock-impl drift lint／OpenAPI 契約 | pnpm ci:mock-impl-diff（h1・状態・第2ナビ・列の値）／pnpm ci:openapi-diff | ui-mock-impl-diff・G11 | L1 |
| functional.api（EARS EVENT-DRIVEN） | 契約＋結合（実 Postgres） | pnpm test（EARS から生成した test）＋ Schemathesis（openapi.yaml → fuzz） | backend-coverage・G3 | L1 |
| functional.unwanted 401/403（EARS UNWANTED） | 認可・RLS（role × operation） | access-matrix.json → pnpm ci:access-matrix（他テナント・権限なし・本人のみ） | backend-access-matrix・G4/G6 | L1 |
| functional.unwanted 422/409/429 | unit（検証・冪等・レート） | pnpm test（正規化の入出力表＝表記ゆらぎ・境界値） | backend-coverage・G3 | L1 |
| functional.unwanted 502（G-15） | 結合（外部を故意に切る） | pnpm test（Bridge／外部のスタブが完了信号なしで終わる） | backend-coverage | L1 |
| functional.acceptance（行為が最後まで通る） | E2E（staging） | Playwright（journeys/plan.json の流れ・runnable_after が揃った順） | e2e・G15 | L2 |
| regression.coverage | coverage | pnpm test -- --coverage（lines 80／branches 70） | backend-coverage・G3 | L1 |
| regression.lint／type | 静的 | pnpm lint／pnpm type-check／AC validator | static・G1/G2/G14 | L1 |
| regression.choke（関門の迂回） | 静的解析（import グラフ） | pnpm ci:choke -- --id C1..C8／no-dynamic-call／例外台帳 | static・G16〜G25 | L1 |
| regression.spec（仕様の層） | 仕様ゲート（Python） | layer_audit --run／qa-ladder validate／error_catalog gate／skill_pkg_gate | spec・G27〜G31 | L1 |
| regression.task（そのタスクの L1 行） | 正本の行 | qa-ladder gate --task <ブランチのタスク> | task-gate・G32 | L1 |
| L3〜L5（Wave・リリース・全体） | 回帰（差分） | completion_gate.sh／qa-coverage.py／負荷（k6・L4 のみ） | 締め（CI 外・手動起動） | L3-L5 |

## リスク

| 領域 | リスク | 理由 | テスト | 優先 |
|---|---|---|---|---|
| テナント越え（RLS・SET LOCAL） | 高 | 1 社のデータが別の会社に見える。旧製品の死因の 1 つ | access-matrix 全行（G33）・G4/G6・上流を故意に壊す行（rls-matrix.md） | 最優先 |
| 関門の迂回（外に出る操作・資格情報） | 高 | 承認前の送信・課金・資格情報の露出 | G16〜G25（静的解析）・UNWANTED 403 の副作用なし | 最優先 |
| 口座状態の波及（退会・停止・権限変更） | 高 | 退会後もセッション・Bridge が生きる（G-14） | leave 表の行（7 出来事）・sessions revoked 0 秒 | 最優先 |
| AI の無言終了・Bridge 切断（G-15／G-12） | 中 | exit 0 で空応答が完了扱いになる／切断直後 90 秒の誤表示 | 502 の UNWANTED（外部を切る）・切替直後 0 秒の行 | 優先 |
| 契約のずれ（画面 ↔ API ↔ 型） | 中 | 3 クライアントが同じ契約を叩く。ずれると UI 断線（G-03） | G11 openapi-diff・Schemathesis（G36）・mock-impl-diff | 優先 |
| 表記ゆらぎ・境界値 | 中 | 全角で入れた利用者がログインできず離脱した事故 | unit の入出力表（screens/*.md 表記ゆらぎ行） | 優先 |
| 見た目の細部（色・余白） | 低 | 治具（状態・横溢れ・レイアウト）で既に測っている | mock-impl-diff だけ。スナップショット比較は入口画面 3 枚に限定 | 後回し |

## テストしないもの（理由つき）

- 画面の見た目のスナップショット全画面（治具の実測で代替。入口 3 画面だけ）
- 負荷の実測（L1〜L3 では静的検査 G35 のみ。L4 リリース前に k6 で同時 50・集中時 rps・失敗率を実測）
- 本番データを触る通し（本番は L4 のスモークだけ。通しは staging）
- Bridge 経由の実 LLM 応答の内容評価（AI 実動は ai-runtime-matrix の行で見る。CI では完了信号の有無と形だけ）

## 枠組み

| 用途 | 道具 |
|---|---|
| unit_contract | Vitest |
| contract_fuzz | {'library': 'Schemathesis 4.33.0', 'license': 'MIT', 'rationale': 'G36 の契約 fuzz。CI の database で pip から入れる（K-35）'} |
| consumer_contract | なし（段階 1。OpenAPI 生成型＋openapi-diff で代替） |
| e2e | Playwright |
| access | 実 Postgres（pgvector/pg16）で SET LOCAL を切り替えて流す（pnpm ci:access-matrix） |
| load | k6（L4 リリース前のみ） |
| ci | GitHub Actions（.github/workflows/v3-gate.yml） |

## モックの方針

| 対象 | 方針 |
|---|---|
| db | モックしない。CI は実 Postgres（migration＋seed）。RLS はモックで再現できない |
| external | C1/C6/C7 の外は記録済み応答のスタブ（関門の中で差し替え）。完了信号なし・タイムアウトのケースを必ず 1 本 |
| llm | C3 は Bridge のスタブ（決まった応答・無言終了・途中切断）。実 LLM は staging の L2 で |
| storage | C4 はローカルのバケット代替。G-11 の存在確認は staging と production で実施 |

## テスト・ラダー

| 段 | 何を | どこで | いつ | ゲート |
|---|---|---|---|---|
| L1 | tickets qa_rows.l1（正本の行 3,000 超）＋ EARS の test ＋ access-matrix | staging（単体・契約はローカル可） | 実装した本人が merge 前 | qa-ladder gate --task（G32） |
| L2 | journeys/plan.json 88 行（流れ 9） | staging | runnable_after が揃った最後のタスクが merge 前 | 同上（揃った流れを自動で含む） |
| L3 | Wave の L1＋L2 全部 ＋ 前 Wave の回帰（差分） | staging | Wave 締め | completion_gate.sh |
| L4 | 正本 full ＋ 本番スモーク（prod-smoke.md）＋ 負荷実測 | staging ＋ 本番（スモークのみ） | リリース前 | qa-coverage.py STATUS 完了 |
| L5 | full ＋ 正本の鮮度監査 | staging | 年次・大改修 | 同上 |

## CI ゲート 71 本（.github/workflows/v3-gate.yml）

| # | 名前 | script | job | 致命 |
|---|---|---|---|---|
| G1 | lint | `pnpm lint` | static |  |
| G2 | type check | `pnpm type-check` | static |  |
| G3 | unit test + coverage（分けて流した結果を合わせ、閾値を当て、決めた試験が全部流れたかを見る） | `[ -n "$CI_UNIT_SHARDS" ] ／／ { echo "★ FAIL static の出力が空（G0 が流れていない）"; exit 1; }
if [ "$CI_UNIT_SHARDS" = "0" ]; then echo "流す試験 0 本（チケットの CI の範囲・G0）"; exit 0; fi
n=$(ls .vitest-reports/blob-*-"$CI_UNIT_SHARDS".json 2>/dev/null ／ wc -l)
[ "$n" -eq "$CI_UNIT_SHARDS" ] ／／ { echo "★ FAIL 分けた単体の試験の結果が $CI_UNIT_SHARDS つのうち $n つしか無い"; exit 1; }
python3 scripts/ci/ci_scope.py run-merge && python3 scripts/ci/ci_scope.py check-count --report .vitest-reports/merged.json
` | unit |  |
| G4 | RLS 全テーブル有効 | `pnpm ci:rls-enabled` | database | ★ |
| G5 | auth.uid() 検出 | `pnpm ci:no-vendor-sql` | static | ★ |
| G6 | テナント文脈の網羅 | `pnpm ci:context-set` | database | ★ |
| G7 | import 境界検査 | `pnpm ci:boundary` | static | ★ |
| G8 | Open Core ee/ 検出 | `pnpm ci:license-boundary` | static |  |
| G9 | ポータビリティ台帳の整合 | `pnpm ci:ledger-sync` | static |  |
| G10 | 動的クエリの文字列連結禁止 | `pnpm ci:no-sql-concat` | static | ★ |
| G11 | OpenAPI 破壊的変更検出 | `pnpm ci:openapi-diff` | static |  |
| G12 | 実Postgresでmigration+seed適用 | `pnpm ci:migration-integration` | database |  |
| G13 | env 整合 | `pnpm ci:env-audit` | static |  |
| G14 | AC validator（4-tier） | `pnpm ci:ac-validate` | static |  |
| G15 | 統合テスト（staging・Playwright） | `pnpm e2e:staging` | e2e |  |
| G16 | 関門C1 ネットワークの迂回検出 | `pnpm ci:choke -- --id C1` | static | ★ |
| G17 | 関門C2 永続化の迂回検出 | `pnpm ci:choke -- --id C2` | static | ★ |
| G18 | 関門C3 モデル呼び出しの迂回検出 | `pnpm ci:choke -- --id C3` | static |  |
| G19 | 関門C4 ファイルの迂回検出 | `pnpm ci:choke -- --id C4` | static |  |
| G20 | 関門C5 プロセス起動の迂回検出 | `pnpm ci:choke -- --id C5` | static | ★ |
| G21 | 関門C6 通知の迂回検出 | `pnpm ci:choke -- --id C6` | static |  |
| G22 | 関門C7 決済の迂回検出 | `pnpm ci:choke -- --id C7` | static | ★ |
| G23 | 関門C8 秘密の迂回検出 | `pnpm ci:choke -- --id C8` | static | ★ |
| G24 | 動的呼び出し禁止 | `pnpm ci:no-dynamic-call && pnpm ci:test-imports` | static | ★ |
| G25 | 関門例外台帳の整合 | `pnpm ci:choke-exceptions` | static |  |
| G26 | チケットの触る関門の宣言 | `pnpm ci:task-choke-declared` | static |  |
| G27 | 画面の route の生成物が最新（flow.json → apps/web/lib/routes.ts） | `pnpm ci:routes` | static |  |
| G28 | 実ブラウザで押した証拠（操作要素 1 つ＝1 行。行 ID を名前に持つ Playwright が通っている） | `pnpm ci:op-gate` | static |  |
| G39 | 外へ出る口の宛先（apps/bridge・apps/web の fetch は Kaname か Bridge の口だけ・関門 C1 の例外 X-009／X-010 の代替統制） | `pnpm ci:net-boundary && pnpm ci:net-boundary:selftest && pnpm ci:choke:selftest` | static | ★ |
| G40 | ゼロトラストの決まり（設計の赤 0・実装の残りが記録より増えない） | `pnpm ci:zt` | static | ★ |
| G41 | 権限の試験（契約の全 API で、役が合わない人・ログインしていない人を止め、副作用に届かせない） | `pnpm ci:authz` | static | ★ |
| G42 | 契約の外の道すじが無い（登録した道すじ＝契約） | `pnpm ci:endpoints` | static | ★ |
| G43 | 秘密の混入（鍵・トークン・秘密鍵・パスワード入りの DB の URL・.env） | `pnpm ci:secret-scan` | static | ★ |
| G44 | 部品の弱点（本番で使う部品に high 以上の弱点が無い） | `pnpm ci:deps-audit` | static |  |
| G45 | Kaname を作るためのチケットの形（番号・親子 3 段・区画・決定 ID・先に要るもの） | `pnpm ci:tickets` | static |  |
| G27 | 層の棚卸し（G21） | `set -o pipefail; mkdir -p "$RUNNER_TEMP/gate-logs"; python3 scripts/ci/layer_audit.py --run --db-range "${CI_DB_RANGE:-true}" 2>&1 ／ tee "$RUNNER_TEMP/gate-logs/g27.log"` | spec |  |
| G28 | 正本 ↔ tickets の参照整合（qa-ladder validate） | `python3 scripts/ci/qa-ladder.py validate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json` | spec |  |
| G29 | エラー一覧 E1〜E9（引数を省かない） | `python3 scripts/ci/error_catalog.py gate --catalog 07_qa/test-specs/errors.json --mocks 06_mockup/v1 --spec 07_qa/test-specs --choke 03_architecture/choke-points.json` | spec |  |
| G30 | スキル一式 SK1〜SK6 | `python3 scripts/ci/skill_pkg_gate.py 10_skills` | spec |  |
| G31 | テスト計画の整合 TV1〜TV8 | `python3 scripts/ci/tv_gate.py` | spec |  |
| G32 | そのタスクの L1 行（ブランチ task/<ID>） | `python3 scripts/ci/qa-ladder.py gate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json --task "$TASK_ID"` | task-gate |  |
| G33 | RLS の場合表（access-matrix.json 全行） | `pnpm ci:access-matrix -- --matrix 07_qa/test-plan/access-matrix.json` | database |  |
| G34 | EARS → test の対応（mapping の test が全部存在） | `pnpm ci:ears-mapping -- --mapping 07_qa/test-plan/ears-test-mapping.json` | database |  |
| G35 | 有限資源の静的検査（G-16：関門外の生クライアント・タイムアウト無し・冪等キー無しの書込） | `pnpm ci:resource-static` | static |  |
| G36 | 契約 fuzz（Schemathesis・openapi.yaml・作った口を本物の DB の上で叩く。答えの形の元の DB の列の書き出しも確かめる） | `pnpm ci:schemathesis` | database |  |
| G37 | デザインのトークンと新しい部品（正本どおり・明るい／暗いのコントラスト AA・生の値 D1〜D4・部品の値 D5・文字の段 D6／D7・プレビュー） | `python3 04_design/gen_tokens.py --web --check && python3 04_design/gen_preview.py --check && python3 scripts/ci/design_gate.py --design 04_design/DESIGN-kaname.md --mocks apps/web/components/k apps/web/features --css apps/web/styles/k-tokens.css --part --scales --usage apps/web apps/bridge/src && python3 scripts/ci/k218_design_canvas_test.py` | spec |  |
| G38 | 生成物が全部最新（作り手を全部回して、中身が変わる生成物・落ちる作り手・目録に無い生成物を赤にする・D-128.123） | `python3 scripts/ci/generated_gate.py --selftest && python3 scripts/ci/generated_gate.py` | spec |  |
| G46 | 使っている部品が技術の選定の記録と合う（package.json と selected-stack.json の packages を 1 対 1・D-128.123） | `python3 scripts/ci/stack_gate.py --selftest && python3 scripts/ci/stack_gate.py --base-ref "$CI_BASE"` | spec |  |
| G47 | 書いた検査が CI から回る・検査の自己試験（ci_wiring_gate・エラーの参照・自己試験・D-128.123） | `python3 scripts/ci/ci_wiring_gate.py --selftest && python3 scripts/ci/ci_wiring_gate.py && pnpm -s ci:errors-used && pnpm -s ci:errors-used:selftest && pnpm -s ci:sql-guard:selftest && pnpm -s ci:chat-one:selftest && pnpm -s ci:contract:selftest && pnpm -s ci:env-audit:selftest && python3 scripts/ci/qa_delta.py --selftest && python3 scripts/ci/static_screens_test.py && python3 scripts/ci/contract_shape_test.py && python3 scripts/ci/k185_hook_regions_test.py && python3 scripts/ci/fuzz_targets_test.py` | spec |  |
| G51 | 利用者の流れと DB の表の目録（行為はどれも 1 つの流れ・表はどれも目録に・凍結の表をコードが使わない・D-128.126・D-128.127） | `python3 scripts/ci/flow_db_gate.py --selftest && python3 scripts/ci/flow_db_gate.py` | spec |  |
| G48 | 新しい画面の実ブラウザの試験と、押した証拠（本番の形で組み立てた画面の上・行 ID の試験が全部の行で通る・記録なし・K-36。今の回の報告から結果の記録を作り、結果が空の行は今の回の報告で確かめる・K-143） | `BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py g48` | web |  |
| G59 | 中間テスト（いくつかのチケットを合わせた一続きの操作・本物のブラウザと本物の口と DB・試験用の受け箱・K-54 から） | `PLAYWRIGHT_JUNIT_OUTPUT_NAME="$GITHUB_WORKSPACE/junit/web-skeleton.xml" BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py g59` | web |  |
| G70 | キャンバスとの見た目の突き合わせ（入れた組・幅ごと・値の読み方を data: の頁で確かめる・K-238） | `PLAYWRIGHT_JUNIT_OUTPUT_NAME="$GITHUB_WORKSPACE/junit/web-fidelity.xml" BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py gate 70` | web |  |
| G73 | Bridge の輪が Chrome を動かす通しの画面の試験（組み立てた Bridge・頭なしの Chrome・的のログイン画面・K-379） | `PLAYWRIGHT_JUNIT_OUTPUT_NAME="$GITHUB_WORKSPACE/junit/web-bridge.xml" BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py gate 73` | web |  |
| G53 | 試験はどれも 1 つのチケットに属する（単体の試験・実ブラウザの試験・口ごとの権限の試験の持ち主・D-128.140） | `python3 scripts/ci/test_owner_gate.py --selftest && python3 scripts/ci/test_owner_gate.py` | spec |  |
| G54 | 決定のトレース（決定ログの決めたことが導出物から逆引きできる・T1〜T12。手で流していたのを CI に入れた・D-128.147） | `cp 01_hearing/要件一覧.md $RUNNER_TEMP/req.md && python3 scripts/ci/trace_gate.py --index && cmp $RUNNER_TEMP/req.md 01_hearing/要件一覧.md && python3 scripts/ci/trace_gate.py` | spec |  |
| G55 | No Ticket, No Commit（コミットにチケットの番号・D-128.147・K-47） | `python3 scripts/ci/ticket_commit_gate.py --selftest && python3 scripts/ci/ticket_commit_gate.py` | spec |  |
| G56 | 取り込む順（depends_on の実装が先に枝にある・K-94） | `python3 scripts/ci/k341_order_gate_speed_test.py && python3 scripts/ci/ticket_order_gate_test.py && python3 scripts/ci/ticket_order_gate.py --selftest && python3 scripts/ci/ticket_order_gate.py --base-ref "$CI_BASE"` | spec-2 |  |
| G62 | CI の無駄を止める台本の試験（範囲の表の spec・層の棚卸しの elsewhere・部品の出た日の記録・K-156） | `python3 scripts/ci/ci_lean_test.py` | spec |  |
| G57 | チケットの CI の範囲の台本の試験（K-107） | `python3 scripts/ci/ci_scope_test.py && python3 scripts/ci/ticket_affects_test.py` | spec |  |
| G60 | 決める人の決定の行が、決める人への問い合わせの答えの記録と結びつく（130 番の決定から照らす・129 番までは答えの記録が無いので外す・K-103・L-014） | `python3 scripts/ci/decision_source_gate.py --selftest && python3 scripts/ci/decision_source_gate.py --log 01_hearing/決定ログ_進行中.md --answers 01_hearing/decider-answers.jsonl --label 高本さん --since D-130` | spec |  |
| G63 | 決める人の答えの記録は和で移す（前の版にあった答えを落としていない・比べる版が読めない・無いなら赤・K-146） | `python3 scripts/ci/answers_merge.py --selftest && python3 scripts/ci/answers_merge.py check 01_hearing/decider-answers.jsonl --base "$CI_ANSWERS_BASE" --target "$CI_TARGET_REF"` | spec |  |
| G64 | 着手前のチケットの期待結果は起きる結果で・別のチケットに回した機能はそれまでの間を書く（K13・K14・K-146・D-129.52） | `python3 scripts/ci/ticket_rows_gate.py --selftest && python3 scripts/ci/ticket_process_test.py && python3 scripts/ci/ticket_rows_ci.py` | spec |  |
| G65 | CI の形の試験（DB は組の中で・重い検査もチケットの範囲だけ・JUnit の記録・K-172／組ごとの Linux の VM・K-173） | `python3 scripts/ci/k172_ci_shape_test.py && python3 scripts/ci/k173_vm_test.py && python3 scripts/ci/k174_flow_config_test.py && python3 scripts/ci/k175_flow_config_test.py && python3 scripts/ci/k176_web_junit_test.py && python3 scripts/ci/k177_web_scope_test.py && python3 scripts/ci/k178_flow_config_test.py && python3 scripts/ci/k186_web_artifact_test.py && python3 scripts/ci/k187_cut_take_test.py && python3 scripts/ci/k188_human_sheet_test.py && python3 scripts/ci/k191_regen_all_test.py && python3 scripts/ci/k192_scope_deps_test.py && python3 scripts/ci/k193_hook_timeout_test.py && python3 scripts/ci/k195_runner_chrome_test.py && python3 scripts/ci/k196_results_on_mainline_test.py && python3 scripts/ci/k200_staging_health_test.py && python3 scripts/ci/k206_author_gate_test.py && python3 scripts/ci/k204_staging_workflow_test.py && python3 scripts/ci/k97_bridge_build_test.py && python3 scripts/ci/k65_staging_spec_test.py && python3 scripts/ci/k208_staging_expect_test.py && python3 scripts/ci/k210_gate_holes_test.py && python3 scripts/ci/k245_g27_reach_test.py && python3 scripts/ci/k213_design_parent_test.py && python3 scripts/ci/k212_function_region_test.py && python3 scripts/ci/k246_function_config_test.py && python3 scripts/ci/fidelity_config.py --selftest && python3 scripts/ci/k216_fidelity_config_test.py && node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=junit/spec-k216-mjs.xml scripts/ci/k216_fidelity_compare.test.mjs && python3 scripts/ci/k219_canvas_states_test.py && python3 scripts/ci/k257_canvas_boards_test.py && python3 scripts/ci/k258_web_defer_test.py && python3 scripts/ci/k232_fidelity_doc_test.py && python3 scripts/ci/k262_staging_edge_test.py && python3 scripts/ci/k237_perf_ledger_test.py && python3 scripts/ci/k237_staging_perf_test.py && python3 scripts/ci/k330_cut_check_test.py && python3 scripts/ci/k323_spec_split_test.py && python3 scripts/ci/k325_registries_test.py && python3 scripts/ci/k326_ts_registries_test.py && python3 scripts/ci/k327_migrations_gen_test.py && python3 scripts/ci/k328_secrets_parents_test.py && python3 scripts/ci/k343_test_timeout_test.py && python3 scripts/ci/k376_gate_lists_test.py && python3 scripts/ci/k377_fidelity_removed_test.py && python3 scripts/ci/k379_bridge_gate_test.py && python3 scripts/ci/k425_decision_log_test.py && python3 scripts/ci/k430_decision_log_test.py && python3 scripts/ci/k601_decision_log_test.py && python3 scripts/ci/k622_spec_sync_tools_test.py && python3 scripts/ci/k623_decisions_registered_test.py && python3 scripts/ci/k624_d6_mock_only_test.py && python3 scripts/ci/k625_layer_ledgers_test.py && python3 scripts/ci/k626_p_audit_closed_test.py && python3 scripts/ci/k627_db_fresh_run_test.py && python3 scripts/ci/k631_web_types_test.py && python3 scripts/ci/k638_contract_test.py && python3 scripts/ci/k639_contract_test.py && python3 scripts/ci/k640_runs_on_test.py && python3 scripts/ci/k641_hosted_tools_test.py && python3 scripts/ci/k643_merge_not_impl_test.py && python3 scripts/ci/k644_migrate_auth_test.py && python3 scripts/ci/k673_decision_log_test.py && python3 scripts/ci/k780_decision_log_test.py && python3 scripts/ci/k248_scope_reach_test.py` | spec |  |
| G66 | コミットの名義がチームの物（本線との差分のコミットの author のメールのドメイン・K-206） | `python3 scripts/ci/author_gate.py --base-ref "$CI_BASE"` | static |  |
| G67 | 画面のクラスが CSS に在る・外枠の決まりを本文で使わない（台帳は減らすだけ・K-214） | `python3 scripts/ci/class_gate.py --selftest && python3 scripts/ci/class_gate.py --ledger-base-ref "$CI_BASE" && python3 scripts/ci/k214_class_gate_test.py` | spec-3 |  |
| G68 | 画面のチケットに正のモック（突き合わせの組）・組の持ち主と両向き（台帳は減らすだけ・K-215・D-143.5） | `python3 scripts/ci/canvas_field_gate.py --ledger-base-ref "$CI_BASE" --ticket "$CI_TICKET" && python3 scripts/ci/k215_canvas_field_test.py && python3 scripts/ci/k300_mock_field_test.py` | spec |  |
| G69 | キャンバスとの突き合わせの設定（段 1 の組・要る要素と値・入れた組は外せず弱められない・入っていない組の数と持ち主が取り込み済みなのに入っていない組・自己試験と K-216 の試験は G65・K-238） | `python3 scripts/ci/fidelity_config.py --base-ref "$CI_BASE" && python3 scripts/ci/fidelity_config.py --owners-done --base-ref "$CI_BASE" ${CI_TICKET:+--ticket "$CI_TICKET"} && python3 scripts/ci/k238_fidelity_ci_test.py` | spec |  |
| G71 | キャンバスの値が正本の段（色・書体・角丸・文字）・幅の台帳は減らすだけ・台帳の形と作り手の流し直し（K-254） | `python3 scripts/ci/canvas_design_gate.py --ledger-base-ref "$CI_BASE" && python3 scripts/ci/k254_canvas_values_test.py` | spec |  |
| G72 | 画面の CSS の生の長さ（大きさ・余白・間・行の高さ・影・枠の太さが正本のトークンを通る・D8・台帳は減らすだけ・K-261） | `python3 scripts/ci/design_gate.py --design 04_design/DESIGN-kaname.md --mocks apps/web/components/k apps/web/features --css apps/web/styles/k-tokens.css --part --no-components --raw-lengths --ledger-base-ref "$CI_BASE" && python3 scripts/ci/k261_raw_lengths_test.py` | spec |  |
| G61 | 試験の結果の欄の PASS は CI の記録から書いたものだけ（手で書いた PASS は赤・印の無い古い PASS は台帳に載った行だけ・台帳は減らすだけ・K-143・D-129.51） | `python3 scripts/ci/ci_results_test.py && python3 scripts/ci/ci_results_ledger_test.py && python3 scripts/ci/ci_results.py check --specs '07_qa/test-specs/**/*.md' --records 07_qa/ci-results --ledger 07_qa/test-plan/result-ledger.json --ledger-base-ref "$CI_LEDGER_BASE" --target-ref "$CI_TARGET_REF"` | spec |  |

## マージ可能の判断

- G1〜G36 が全部緑（統合テスト（G15）は staging-e2e.yml の回で）
- ears-test-mapping.json の test が全部存在（G34）
- access-matrix.json の全行 PASS（G33）
- そのタスクの qa_rows.l1 が全行 PASS か理由つき BLOCKED（G32）
- 連続 3 回失敗で高本さんへ（foundation_gates.retry_protocol）

## EARS → test（4015 本・ears-test-mapping.json）

| 形 | 本数 |
|---|---|
| EVENT-DRIVEN | 393 |
| UNWANTED | 3275 |
| UBIQUITOUS | 347 |

## RLS の場合表（1562 行・access-matrix.json）

| 役 | policy 数 | 場合 数 |
|---|---|---|
| 会社の人（R1〜R4・権限で分かれる） | 245 | 964 |
| 運営（R6） | 143 | 529 |
| ログイン済み（本人のもの） | 19 | 36 |
| 取引先の人（クライアントの場所） | 8 | 24 |

## 途中変更

仕様・チケットが途中で変わったら qa_delta.py --changed … --gate。EARS の差分は ears-test-mapping.json の差分として出す（全部作り直さない）

## 次

sprint-planning（S13）
