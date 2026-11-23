---
name: Kaname
colors:
  # Primary — Kaname（中心・収束）
  primary: "#22345C"
  on-primary: "#FFFFFF"
  primary-container: "#DCE4F2"
  on-primary-container: "#101C33"
  # Secondary — 補助操作
  secondary: "#186F69"
  on-secondary: "#FFFFFF"
  secondary-container: "#CFEAE7"
  on-secondary-container: "#0A3330"
  # Tertiary — AI 由来を示す
  tertiary: "#6D4AA6"
  on-tertiary: "#FFFFFF"
  tertiary-container: "#E9E0F5"
  on-tertiary-container: "#33235C"
  # Surface
  surface: "#F7F8FA"
  on-surface: "#131B27"
  surface-variant: "#E9ECF1"
  on-surface-variant: "#4A5563"
  # Error
  error: "#B91C1C"
  on-error: "#FFFFFF"
  # Neutral
  neutral: "#8A94A3"
  on-neutral: "#131B27"
  # 面に使う中立（白文字で 4.5:1 を満たす。--neutral は線と文字用で面には暗さが足りない）
  neutral-strong: "#6B7585"
  # 面と線（D-071：1px の箱を並べず、罫線 1 本と余白で段を区切る）
  card: "#FFFFFF"
  line: "#DDE2E9"
  line-soft: "#EDF0F4"
  side-bg: "#EEF0F4"
  primary-hover: "#1A2848"
  on-code: "#D8DEE9"
  ai-container: "#EDEAF6"
  # 蛍光ペン（D-104.3）。返事の中の大事な所の淡い地。状態の色とは別
  mark: "#FFF1B8"
  # 画面の骨組み（D-128.75）
  page: "#F2F4F7"          # ページの地（白い面の外側）
  select: "#F1F3F6"        # 白い面の中で選んでいる行・項目
  table-head: "#FAFBFC"    # 表の頭の行
  line-strong: "#B8C0CC"   # 点線の枠・使えない線・薄いアイコン
  primary-soft: "#EEF3FD"  # 紺の淡い地（選んだ札・案内）
  primary-line: "#C7D7F5"  # 紺の淡い線
  overlay-shadow: "#131B274D"  # 迫り出す面（小窓）の影：on-surface の 30%（StModal の 0 24px 60px）。暗いテーマは影を使わない（透明）
syntax:
  # コードの色分け（D-104.4）。新しい色は作らず、既存の値を字の色としてだけ使う（面に使わない）
  keyword: "#22345C"
  string: "#186F69"
  number: "#7E570D"
  comment: "#4A5563"
  function: "#6B3F5E"
  type: "#2F4B7C"
state:
  # 状態の色（D-052）。画面に一番長く映るのはここ。濃い文字 / 淡い面 / 面の上の文字 の 3 点で 1 組
  success: "#166534"
  success-container: "#DCFCE7"
  on-success-container: "#2E5B26"
  warning: "#B45309"
  warning-container: "#FCEBD5"
  on-warning-container: "#7A4A05"
  danger: "#B91C1C"
  danger-container: "#FDECEC"
  on-danger-container: "#991B1B"
  progress: "#1D4ED8"
  progress-container: "#DBEAFE"
  on-progress-container: "#1E40AF"
  # 淡い地と線（D-128.75）。帯・案内の箱に使う。札（ピル）は *-container
  success-soft: "#E8F5EC"
  success-line: "#CDE8D5"
  warning-soft: "#FFF8EE"
  warning-line: "#F3D3A7"
  danger-line: "#F3C7C7"
data:
  # データの色（D-023）。点と線だけに使い、面に使わない。状態の色と混ぜない
  indigo: "#2F4B7C"
  teal: "#186F69"
  amber: "#7E570D"
  coral: "#A34A3E"
  sage: "#516F46"
  plum: "#6B3F5E"
  # 人の顔の色・層の札に使う 2 色（D-128.75）
  lavender: "#6B5B99"
  teal-light: "#537E7B"  # 白い字で 4.5:1（もとの #5E8F8B は 3.63:1 で AA に届かなかった・K-24 の確かめで見つけた）
typography:
  # 書体は Noto Sans JP 1 つ（D-128.3）。密度は 1 行 36px・本文 13px（D-128.13）
  h1:
    fontFamily: "Noto Sans JP"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.35
  h2:
    fontFamily: "Noto Sans JP"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.4
  h3:
    fontFamily: "Noto Sans JP"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.5
  # ページの型の見出し（K-217・D-143.2：キャンバスの実測。帯の中のページの見出しと、本文の区画の見出し）
  page-title:
    fontFamily: "Noto Sans JP"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.6
  section-title:
    fontFamily: "Noto Sans JP"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.7
  input:
    fontFamily: "Noto Sans JP"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: "Noto Sans JP"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Noto Sans JP"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Noto Sans JP"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: "Noto Sans JP"
    fontSize: 11px
    fontWeight: 500
  label-xs:
    fontFamily: "Noto Sans JP"
    fontSize: 10px
    fontWeight: 500
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  2xl: 96px
rounded:
  none: 0px
  sm: 4px
  md: 6px
  field: 8px    # 入力・小さな箱・吹き出し（D-128.75）
  card: 10px    # カード・ポップオーバー（D-128.75）
  lg: 12px
  xl: 20px
  full: 9999px
components:
  # ボタン（K-218・D-143.2：値はキャンバスの実測。作業の画面は高さ 32（StModal 34・帯 32・詳細 30 の間）、入口は 44（AuthSignup・AuthVerify））
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    fontWeight: 500
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 {spacing.md}"
  button-primary-lg:    # 入口の画面の大きさ（Button size="lg"）
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    fontWeight: 500
    rounded: "{rounded.field}"
    height: "44px"
    padding: "0 {spacing.lg}"
  button-secondary:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.body}"
    fontWeight: 500
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 {spacing.md}"
  button-outlined:      # 従ボタン（StModal の「やめる」：白地・灰の線・黒字・太さを付けない）
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.line}"
    typography: "{typography.body}"
    fontWeight: 400
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 14px"
  button-inverted:
    backgroundColor: "{colors.on-primary}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    fontWeight: 500
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 {spacing.md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.surface-variant}"
  # 入力欄（K-218：作業の画面は Create・StModal、入口は AuthSignup。幅 767 以下は字を 16px にする・D-144.7・k.css）
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.line-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  input-lg:             # 入口の画面の大きさ（Field size="lg"）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    typography: "{typography.body-md}"
    rounded: "{rounded.field}"
    height: "42px"
    padding: "0 12px"
  field:                # 項目名と欄の組（作業の画面：間 xs＝4px・Create）
    gap: "{spacing.xs}"
  field-lg:             # 入口の画面の組（間 6px・AuthSignup）
    gap: "6px"
  label:                # 項目名（作業の画面：太さを付けない・灰・欄との間 xs）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    fontWeight: 400
  label-lg:             # 項目名（入口：500・黒・欄との間 6px）
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    fontWeight: 500
  # 入口の枠（K-255・キャンバス AuthSignup・AuthVerify・AuthChecking・AuthVerifyLoading の実測。features/F1/sign-up/sign-up.css が読む）
  auth-page:            # 外：余白 32px 16px・ロゴと箱の間 18px
    padding: "32px {spacing.md}"
    gap: "18px"
  auth-logo:            # ロゴ：印と名前の間 10px・字の間 .02em
    gap: "10px"
    letterSpacing: "0.02em"
  auth-card:            # 箱：白・1px line・角丸 lg・余白 26px 28px・段の間 14px・幅 440px まで
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.lg}"
    padding: "26px 28px"
    gap: "14px"
    width: "440px"
  auth-card-wide:       # 文面のページ（規約・プライバシーポリシー）の箱の幅：720px まで（K-232・キャンバス LegalPage。ほかの値は auth-card のまま）
    width: "720px"
  legal-body:           # 文面のページの本文（段落・番号と点の並び）：13px・行の高さ 1.9（K-232・キャンバス LegalPage）
    typography: "{typography.body}"
    lineHeight: 1.9
  auth-lead-sub:        # 見出しのすぐ下の小さな説明（登録・ログイン）：12px・灰・見出しとの間を 8 に詰める（段の間 14 − 6）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    margin: "-6px 0 0"
  auth-lead-body:       # 待つ画面の説明：13px・行の高さ 1.7
    typography: "{typography.body}"
    lineHeight: 1.7
  auth-badge:           # 見出しの上の札（✉）：44×44・紺・角丸 field・18px・700
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.h2}"
    fontWeight: 700
    rounded: "{rounded.field}"
    width: "44px"
    height: "44px"
  auth-alt:             # 「アカウントがある方は ログイン」の行：上に線・線と字の間 12px
    borderTop: "1px solid {colors.line-soft}"
    padding: "12px 0 0"
  auth-foot:            # 足元の行き先：11px・間 12px
    typography: "{typography.label-md}"
    fontWeight: 400
    gap: "12px"
  auth-spin:            # 確かめ中・読み込み中の回る印：16px
    width: "16px"
    height: "16px"
  # ログインの画面だけの形（K-221・キャンバス AuthLogin・Auth2FA の実測。features/F1/login/login.css が読む）
  auth-card-login:      # ログインの箱の幅（登録は 440・ログインは 420）
    width: "420px"
  auth-sep:             # 区切り「またはメールとパスワード」：11px・灰・400・字と線の間 10px
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    fontWeight: 400
    gap: "10px"
  auth-sep-line:        # 区切りの字の左右の線
    borderTop: "1px solid {colors.line-soft}"
  auth-code-row:        # 確認のコードの 6 つの枠の並び：間 10px・上下 1px（キャンバスの枠は線が外に付くので行の高さを 54 にそろえる）
    gap: "10px"
    padding: "1px 0"
  auth-code:            # 確認のコードの枠：44×52・線 1px line・角丸 field・20px・700
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    typography: "{typography.h1}"
    fontWeight: 700
    width: "44px"
    height: "52px"
  auth-alt-col:         # 確認のコードの下の段（認証アプリが使えない・注）：縦に間 6px
    gap: "6px"
  popup-layer:          # メニュー・選ぶ欄の開いた箱の置き場の重なりの順（K-381）。上に貼り付く帯（本文の道具の帯 1・上の帯 20・右のパネル 30・下のタブ 40・引き出し 45・前の外枠 50〜60・成果物の板 61）より上、小窓の後ろの幕（80）より下
    zIndex: "70"
  popup-layer-field:    # 選ぶ欄の開いた一覧の置き場の重なりの順（K-381・K-372 の値を正本へ）。小窓（81）の中の選ぶ欄が小窓の裏に隠れないよう、小窓より上
    zIndex: "82"
  # 小窓（StModal：頭は題と右上の ×・下に線、足は上に線とボタン）
  dialog:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    shadow: "0 0 0 1px {colors.line}, 0 24px 60px {colors.overlay-shadow}"   # 層 2：縁の輪（大きさに足さない）と影。暗いテーマは overlay-shadow が透明なので輪だけ
    margin: "60px auto 0"   # 置き場：上から 60px・左右の真ん中（K-229・キャンバスの StApproveModal・StCompleteModal・StReturnModal）。左右は画面の端から lg 空ける
  dialog-confirm:       # 取り消せない確かめの幅（StApproveModal 380）
    width: "380px"
  dialog-form:          # ふつうの小窓の幅（StCompleteModal・StReturnModal 420）
    width: "420px"
  dialog-button:        # 小窓の足のボタンの高さ（StModal 34）
    height: "34px"
  dialog-caution:       # 取り消せない注意の赤い箱（StApproveModal）
    backgroundColor: "{state.danger-container}"
    textColor: "{state.on-danger-container}"
    border: "1px solid {state.danger-line}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  dialog-target:        # 頭の下の対象の行（「EG-133 11 月分の請求書を送る」・12px・灰・行の高さ 1.6）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    lineHeight: 1.6
  dialog-group:         # 小窓の中の項目の枠（実施事項の fieldset：1px line・角丸 field）
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
  dialog-check:         # 小窓の中のチェック・選ぶ印の行（12px・行の高さ 1.6・印と字の間 6px）
    typography: "{typography.body-sm}"
    lineHeight: 1.6
    gap: "6px"
  dialog-stack:         # 項目の多い小窓（StReturnModal）の段の間 12px
    gap: "12px"
  dialog-select:        # 小窓の中の選ぶ欄の高さ（StReturnModal「どこを直すか」35）
    height: "35px"
  search-focus:         # 探す欄の型（components/k/search-field・段 9）：焦点が中に入ったら枠全体（虫眼鏡ごと）に紺の輪 2px（入力だけに輪を付けない・代表の直し 2026-11-20）
    border: "2px solid {colors.primary}"
  dialog-textarea:      # 小窓の中の複数行の欄の高さ（StReturnModal「理由」64）
    height: "64px"
  field-required:       # 必須の印（StReturnModal「必須」）
    textColor: "{colors.error}"
    typography: "{typography.body-sm}"
  dialog-title:         # 題は h3 の大きさに太さ 700 を重ねる（段を増やさない）。行の高さは本文と同じ 1.6（StModal の頭 53）
    typography: "{typography.h3}"
    fontWeight: 700
    lineHeight: 1.6
  dialog-head:          # 頭：題と右上の ×・下に線
    padding: "14px 18px"
    borderBottom: "1px solid {colors.line}"
  dialog-body:          # 本文：段の間 10px（StApproveModal・StCompleteModal）
    padding: "14px 18px"
    gap: "10px"
  dialog-actions:       # 足：上に線・右寄せのボタン
    padding: "12px 18px"
    borderTop: "1px solid {colors.line}"
  dialog-close:         # 右上の ×（名前「閉じる」）。取り消せない確かめ（Confirm）には付けない
    width: "28px"
    height: "28px"
  # 使えない状態（決める人 answer=78cb822fc1f1：隠さず、薄くして押せない形で出す）。キャンバスに絵が無いので今の実装の値を写した
  button-disabled:
    opacity: 0.55
  input-disabled:
    opacity: 0.55
  tab-disabled:
    opacity: 0.55
  # 空のとき（OnHome・OnClients・OnKnowledge・OnRoom：白地の点線の箱・中央寄せ）
  state-empty:
    backgroundColor: "{colors.card}"
    border: "1px dashed {colors.line-strong}"
    rounded: "{rounded.lg}"
    padding: "36px 28px"
    gap: "12px"
  # ---- 自分のAIとの会話（D-104）。会話を出す 5 か所は全部この部品（AgentChat）
  chat-bubble-me:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
  chat-bubble-ai:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.line}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  chat-composer:
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    typography: "{typography.input}"
    rounded: "{rounded.xl}"
    padding: "{spacing.sm} {spacing.md}"
  chat-work-line:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
  chat-chip:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  code-block:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.line}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  callout-info:
    backgroundColor: "{state.progress-container}"
    textColor: "{state.on-progress-container}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
  callout-warn:
    backgroundColor: "{state.warning-container}"
    textColor: "{state.on-warning-container}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
  callout-danger:
    backgroundColor: "{state.danger-container}"
    textColor: "{state.on-danger-container}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
  kbd:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.line}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  # ページの型（K-217・D-143.2：値はキャンバスの実測。Main・Approvals・TicketDetail）
  page-head:            # 見出しの帯（箱の幅いっぱい・下に線）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    padding: "12px {spacing.lg}"
  page-head-button:     # 帯の中の既定の大きさのボタン（Approvals「続けて裁く」30px）。sm のボタンには当てない
    height: "30px"
    padding: "0 {spacing.lg}"   # 高さは min-height の 30 で決める（上下の余白を置くと字 13px の行で 30 を超える・K-218）
  page-body:            # 本文の箱（下の余白。ほかの子は左右 spacing.lg 内側・帯の下から spacing.md）
    padding: "0 0 40px"
  # 区画の見出し（下に線）
  section-title:
    typography: "{typography.section-title}"
    border: "1px solid {colors.line}"
    margin: "28px 0 {spacing.sm}"
    padding: "0 0 6px"
  section-body:         # 区画の本文（段落・箇条の項目。行の高さ 1.7 は本文の段より広い）
    typography: "{typography.body}"
    lineHeight: 1.7
  section-list:         # 区画の箇条（黒丸の字下げ）
    padding: "0 0 0 20px"
  # 本文の道具の帯（K-226・キャンバス TicketDetail・Create で同じ所の実測）。作る画面の区画（K-225）も同じ部品を使う
  doc-toolbar:          # 帯（地は表の頭の色・下に薄い線）。詳細だけの違い（左右 20px・上の線・上に貼り付く）は詳細の CSS が上書きする
    backgroundColor: "{colors.table-head}"
    borderBottom: "1px solid {colors.line-soft}"
    padding: "6px 12px"
    gap: "2px"
  doc-tool:             # 帯の 1 つの道具（高さ 28。幅は字に合わせ、最小 30 は doc-tool-min）
    height: "28px"
    padding: "0 6px"
  doc-tool-min:         # 道具の最小の幅（min-width）
    width: "30px"
  shell-bar:            # 外枠の上の帯の高さ（K-138・shell.css の .k-bar）。幅 767 以下も同じ高さで出す（D-147）。上に貼り付く物はこの下に置く（K-226）
    height: "48px"
  shell-bar-tool:       # スマホ（幅 767 以下）の上の帯の道具（探す・探すを閉じる・知らせ・右のパネルの開け閉め）の押せる大きさ。指で押せる 44px（D-147・shell.css の 767 以下の .k-bar-tools .k-icon-btn）
    width: "44px"
    height: "44px"
  shell-bar-search:     # スマホの上の帯で、虫眼鏡を押して開いた探す欄の高さ（D-147・shell.css の 767 以下の .k-bar[data-searching] .k-search label）
    height: "36px"
  # チケットの詳細（K-226・キャンバス TicketDetail の実測）
  detail-body:          # 本文の箱（カードと子チケット・つながりのカードを縦に並べる）
    padding: "{spacing.md} {spacing.lg} 40px"
    gap: "12px"
  detail-body-basis:    # 本文の箱がパネルと横に並ぶときの基準の幅（flex-basis）
    width: "640px"
  detail-card:          # 本文の白いカード（子チケット・つながりのカードも同じ）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
  detail-rule:          # 詳細の中の区切りの線（パネルの左・タブの下・狭い幅の上の線・パネルの区画の下の薄い線）
    border: "1px solid {colors.line}"
    borderBottom: "1px solid {colors.line-soft}"
  detail-meta:          # 頭の行（種別の札・番号・コピー・作成・開始日・期限・段の札）
    padding: "12px 20px 0"
    gap: "{spacing.sm}"
    lineHeight: 1.7
  detail-meta-side:     # 頭の行の右（開始日・期限・段の札）
    typography: "{typography.body-sm}"
    lineHeight: 1.7
    gap: "14px"
  detail-kind:          # 種別の札（塗りは種別の色）
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "1px 10px"
  detail-stage:         # 段の札（塗りは段の色・白字）
    typography: "{typography.body-sm}"
    fontWeight: 500
    lineHeight: 1.7
    rounded: "{rounded.full}"
    padding: "2px 12px"
  detail-stage-locked:  # 鍵の印つきの段の札（仕組みの段の間）。印 11px と字の間 2px を左右の余白から引き、札の幅を鍵の無い札と同じにする（7＋2＋11＋4＝12＋12）
    padding: "2px 4px 2px 7px"
    gap: "2px"
  detail-copy:          # 番号をコピー（24 の四角・線）
    width: "24px"
    height: "24px"
    border: "1px solid {colors.line}"
    rounded: "{rounded.sm}"
  detail-head:          # 題名の行（線も地も無い）
    padding: "6px 20px 12px"
    gap: "10px"
  detail-title-basis:   # 題名が操作と横に並ぶときの基準の幅（flex-basis）
    width: "360px"
  detail-title:         # 題名 h1（行の高さは絵のまま 1.45）
    typography: "{typography.h1}"
    lineHeight: 1.45
  detail-acts:          # 題名の行の操作の並び
    gap: "6px"
  detail-act:           # 題名の行の操作（複製・AI と話す・ほかの操作。高さ 30 は page-head-button）
    typography: "{typography.body-sm}"
    fontWeight: 400
    padding: "0 10px"
  detail-more:          # ほかの操作（…）の幅
    width: "32px"
    padding: "0"
  detail-bands:         # 帯の場所（題名の行の下・帯の間と下の余白）
    padding: "0 20px 14px"
    gap: "14px"
  detail-doc:           # 区画の並び（幅は 900 まで。狭ければ箱の幅）
    padding: "4px 28px 28px"
    width: "900px"
  detail-doc-toolbar:   # 詳細の本文の道具の帯だけの違い（左右 20px・上に線。上に貼り付く）
    padding: "6px 20px"
    borderTop: "1px solid {colors.line}"
  detail-links-head:    # 子チケット・つながりの見出しの行
    padding: "10px {spacing.md}"
    gap: "{spacing.sm}"
  detail-links-title:   # 子チケット・つながりの見出し（キャンバスの h2 の太さ 700）
    typography: "{typography.body-md}"
    fontWeight: 700
  detail-link:          # 字のリンクの形のボタン・目次のリンク（押せる高さ 24 以上）
    typography: "{typography.body-sm}"
    fontWeight: 400
    height: "24px"
  detail-reopen:        # パネルを開く（閉じたときだけ・本文の右の 36 の列。幅は flex-basis）
    width: "36px"
    padding: "10px 0 0"
  detail-panel:         # 右の属性パネル（左に線は detail-rule）
    width: "380px"
  detail-panel-close:   # パネルを閉じる（パネルの右上・28 の四角）
    width: "28px"
    height: "28px"
    rounded: "{rounded.md}"
  detail-panel-close-at: # パネルを閉じるの位置（右上から top・right）
    height: "10px"
  detail-tabs:          # パネルのタブの並び（右は閉じるボタンの分）
    padding: "0 44px 0 6px"
  detail-tab:           # パネルのタブ（下に 2px の印・今いるタブは紺）
    padding: "10px 12px"
    gap: "6px"
    borderBottom: "2px solid transparent"
  detail-panel-sec:     # パネルの区画（下に薄い線は detail-rule）
    padding: "12px 0"
  detail-panel-title:   # パネルの区画の見出し
    typography: "{typography.body-sm}"
    fontWeight: 500
    textColor: "{colors.on-surface-variant}"
  detail-fields:        # 項目名と値の格子（項目名の列の幅は detail-fields-label）
    gap: "{spacing.sm}"
  detail-fields-label:  # 項目名の列の幅（grid の列）
    width: "72px"
  detail-due:           # 期限を変える（▾）の最小の幅（min-width）
    width: "28px"
  detail-who:           # 担当者（頭文字の丸と名前）
    gap: "6px"
  detail-avatar:        # 担当者の頭文字の丸
    width: "22px"
    height: "22px"
    rounded: "{rounded.full}"
    typography: "{typography.label-xs}"
    backgroundColor: "{data.lavender}"
    textColor: "{colors.on-primary}"
  # 実行の記録（K-62 の帯・K-226 の小窓「実行の記録」：キャンバス TdRunLog）
  run-band:             # AI に任せるの帯の中の行の間
    gap: "12px"
  run-sheet:            # 小窓「実行の記録」の右から出る板（幅 540・画面が狭ければ画面の幅）
    backgroundColor: "{colors.card}"
    width: "540px"
  run-chip:             # 絞り込みの札
    height: "28px"
    padding: "0 12px"
    border: "1px solid {colors.line}"
    rounded: "{rounded.full}"
    typography: "{typography.body-sm}"
  # 詳細の帯（K-227・キャンバス TicketDetail の main article [role="status"]・D-143.2：値はキャンバスの実測）
  band-approval:        # 承認待ちの帯の箱（淡い橙の地・線・角丸 field・余白 10px 12px。題と要約の塊が 1 行目・右寄せのボタンの並びが次の行・間 10px）
    backgroundColor: "{state.warning-container}"
    textColor: "{state.on-warning-container}"
    border: "1px solid {state.warning-line}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    gap: "10px"
  band-title:           # 帯の題（h3・13px・700・行の高さはキャンバスの本文の 1.7）
    typography: "{typography.body}"
    fontWeight: 700
    lineHeight: 1.7
  band-sub:             # 帯の要約と中の 1 行（12px・行の高さ 1.7）
    typography: "{typography.body-sm}"
    lineHeight: 1.7
  band-acts:            # 帯のボタンの並び（右寄せ・間 6px）
    gap: "6px"
  band-button:          # 帯の白地のボタン（自分で直す・差し戻す・止める）：線は帯の線
    backgroundColor: "{colors.card}"
    border: "1px solid {state.warning-line}"
  band-caution:         # 帯の中の取り消せない注意の赤い箱（小窓の dialog-caution と同じ色・要約の下に 6px あけて・12px）
    backgroundColor: "{state.danger-container}"
    textColor: "{state.on-danger-container}"
    border: "1px solid {state.danger-line}"
    rounded: "{rounded.field}"
    padding: "4px 10px"
    margin: "6px 0 0"
    typography: "{typography.body-sm}"
    lineHeight: 1.7
  band-notice:          # 帯の region の中の口の失敗の知らせ（赤い箱・role=alert は 1 つ）
    backgroundColor: "{state.danger-container}"
    textColor: "{state.on-danger-container}"
    border: "1px solid {state.danger-line}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  # 詳細の帯（2）（K-228・キャンバス StRunning・StFailed・StBefore・StConfirmDone・StDone・StDelegated の main article の帯）
  band-state:           # 作る段・実行・止まった・完了・任せる前の帯の箱の寸法（余白 12px 14px・767 以下も同じ・角丸 field・間 10px）
    rounded: "{rounded.field}"
    padding: "12px 14px"
    gap: "10px"
  band-info:            # 作っています・実行中の帯（淡い青の地・線・濃い青の字）
    backgroundColor: "{colors.primary-soft}"
    textColor: "{state.on-progress-container}"
    border: "1px solid {colors.primary-line}"
  band-danger:          # 止まった帯（role=alert・淡い赤の地・線・濃い赤の字）
    backgroundColor: "{state.danger-container}"
    textColor: "{state.on-danger-container}"
    border: "1px solid {state.danger-line}"
  band-ok:              # 完了の帯（淡い緑の地・線・緑の字）
    backgroundColor: "{state.success-soft}"
    textColor: "{state.success}"
    border: "1px solid {state.success-line}"
  band-wait:            # 任せました・実行待ちの帯（淡い橙の地・線・濃い橙の字）
    backgroundColor: "{state.warning-soft}"
    textColor: "{state.on-warning-container}"
    border: "1px solid {state.warning-line}"
  band-plain:           # 任せる前・完了の確かめの帯（白・線・紺の字）
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    border: "1px solid {colors.line}"
  band-state-button:    # 帯のボタンの形（高さ 30・余白 0 12px・12px・角丸 md。承認待ちの帯だけ 32 のまま）
    height: "30px"
    padding: "0 12px"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  band-button-info:     # 作っていますの帯の白地のボタン（線は灰）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
  band-button-danger:   # 止まった帯の白地のボタン（線は淡い赤）
    backgroundColor: "{colors.card}"
    border: "1px solid {state.danger-line}"
  band-notice-warn:     # 帯の region の中の知らせ（押しすぎ・別のタブで先に任せていた など・淡い橙）
    backgroundColor: "{state.warning-soft}"
    textColor: "{state.on-warning-container}"
    border: "1px solid {state.warning-line}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  run-steps:            # 作っている間の進みの 5 段の並び（間 4px・上に 8px）
    gap: "4px"
    margin: "8px 0 0"
  run-step:             # 進みの 1 段（11px・400・行の高さ 1.7・上の線 3px・灰の字。先の段の線は灰）
    typography: "{typography.label-md}"
    fontWeight: 400
    lineHeight: 1.7
    padding: "4px 0 0"
    textColor: "{colors.on-surface-variant}"
    borderTop: "3px solid {colors.line}"
  run-step-done:        # 済んだ段（上の線は緑）
    borderTop: "3px solid {state.success}"
  run-step-now:         # 今の段（上の線は青・字は濃い青で 700）
    textColor: "{state.on-progress-container}"
    fontWeight: 700
    borderTop: "3px solid {state.progress}"
  check-stack:          # 止まった帯の箱と確認の結果の表を包む縦の並び（間 14px＝キャンバス StFailed の帯の下 14px。region の間 12px に頼らない）
    gap: "14px"
  check-table-head:     # 確認の結果の表の見出し（12px・500・行の高さ 1.7・余白 6px 10px・淡い灰の地・上下の線・灰の字）
    typography: "{typography.body-sm}"
    fontWeight: 500
    lineHeight: 1.7
    padding: "6px 10px"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-variant}"
    borderTop: "1px solid {colors.line}"
    borderBottom: "1px solid {colors.line}"
  check-empty:          # 確認の結果が無いときの文（表の下・12px・行の高さ 1.7・灰・上に 6px）
    typography: "{typography.body-sm}"
    lineHeight: 1.7
    padding: "6px 0 0"
    textColor: "{colors.on-surface-variant}"
  artifact-card:        # 成果物のカード（帯の箱の下・白・線・角丸 field・余白 12・縮小と説明の間 14・狭ければ折り返す）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "12px"
    gap: "14px"
  artifact-head:        # 縮小の絵の代わりの字の頭（180×240 の白い紙・線・角丸 sm・余白 14・12px。長い字は切る）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.sm}"
    padding: "14px"
    width: "180px"
    height: "240px"
    typography: "{typography.body-sm}"
  artifact-info:        # 縮小の右の説明（名前・ボタン）の基準の幅（flex-basis）
    width: "240px"
  artifact-meta:        # 名前の下の 12px の灰の行（成果物の版 N）
    typography: "{typography.body-sm}"
    textColor: "{colors.on-surface-variant}"
  artifact-acts:        # 大きく見る・データを見る…の並び（名前の 8px 下・間 6px）
    gap: "6px"
    margin: "8px 0 0"
  artifact-button:      # 成果物のボタン（高さ 30・余白 0 10px・12px）
    height: "30px"
    padding: "0 10px"
    typography: "{typography.body-sm}"
  shell-tabs:           # スマホの下のタブ（幅 767 以下・キャンバス MobileList の 60px。スマホは上の帯 shell-bar と下のタブの両方を出す・D-147）。画面の下に貼り付く帯はこの高さの上に置く（K-224）
    height: "60px"
  # 作る画面（K-224・D-143.2：値はキャンバス Create の実測）
  create-head:          # 作る画面の帯の中の間（見出し・作り方・保存の状態）
    gap: "12px"
  create-how:           # 帯の作り方の切り替え（自分で書く・AI と話して作る・過去のチケットから複製）
    height: "28px"
    padding: "0 12px"
    border: "1px solid {colors.line}"
    rounded: "{rounded.md}"
    typography: "{typography.body-sm}"
  create-body:          # 本文の器（帯の下。左右 spacing.lg・下は足元の帯の分 spacing.2xl）
    padding: "{spacing.md} {spacing.lg} {spacing.2xl}"
    gap: "{spacing.md}"
  create-cards:         # 白い箱の縦の並び（箱と箱の間）
    gap: "12px"
  create-cards-basis:   # 白い箱の並びが右の列と横に並ぶときの基準の幅（flex-basis）
    width: "640px"
  create-card:          # 白い箱（グループ・種別・題名／本文／振り分け）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "{spacing.md}"
    gap: "12px"
  create-card-title:    # 箱の見出し（振り分け）
    typography: "{typography.body-md}"
    fontWeight: 700
  create-pick:          # グループと種別の選ぶ欄の幅（横に並べる）。間はキャンバスの 10（K-225 で 8 から直した）
    width: "160px"
    gap: "10px"
  create-label:         # 上の白い箱（グループ・種別・題名）の項目名の行の高さ（キャンバスは 12px の 1.6。共通の label の 1.5 はほかの画面のまま・K-225）
    lineHeight: 1.6
  create-number:        # 選ぶ欄の行の右の「番号は作ったときに付く」（キャンバスの下 8・左は寄せる）。幅 767 以下で行が割れたときの高さに効く（K-225）
    margin: "0 0 8px auto"
  create-title:         # 題名の欄（キャンバスは高さ 40・15px・500。入口の欄 input-lg の 42 とは別）
    height: "40px"
    typography: "{typography.h3}"
    fontWeight: 500
  create-assign:        # 振り分けの格子（2 列の間 spacing.lg・行の間は 0）
    gap: "0 {spacing.lg}"
  create-assign-row:    # 振り分けの 1 行（上下 spacing.sm と下の線）
    padding: "{spacing.sm} 0"
    borderBottom: "1px solid {colors.line-soft}"
  create-assign-label:  # 振り分けの 1 行の項目名の列の幅（grid の列）
    width: "96px"
  create-options-max:   # 親の候補の箱の高さの上限（max-height・越えたら中を送る）
    height: "240px"
  create-options:       # 親の候補の箱（影は置かず線だけ）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "{spacing.xs}"
  create-drop:          # ファイルを置く枠（点線）
    backgroundColor: "{colors.card}"
    border: "1px dashed {colors.line-strong}"
    rounded: "{rounded.field}"
    padding: "{spacing.md}"
  create-chip:          # 知らせる人の札
    border: "1px solid {colors.line}"
    rounded: "{rounded.full}"
    padding: "0 0 0 {spacing.sm}"
    gap: "{spacing.xs}"
  create-target:        # 札の × とチェックの行の押せる大きさ（24 以上）
    width: "24px"
    height: "24px"
  create-aside:         # 右の列（作る前に・AI のひとこと）。横に並ぶときの基準の幅 280
    width: "280px"
    gap: "12px"
  create-aside-max:     # 右の列が広がっても超えない幅（340）
    width: "340px"
  create-aside-box:     # 右の列の白い箱
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  create-checks:        # 作る前にの行の間
    gap: "6px"
  create-foot:          # 足元の帯（画面の下に貼り付く）
    backgroundColor: "{colors.card}"
    borderTop: "1px solid {colors.line}"
    padding: "10px {spacing.lg}"
  create-foot-button:   # 足元の帯のボタンの高さ（キャンバス 34）
    height: "34px"
  create-foot-primary:  # 足元の帯の主ボタン「作る」（左右 18・紺の線）
    border: "1px solid {colors.primary}"
    padding: "0 18px"
  # 承認待ち（K-231・D-143.2：値はキャンバス Approvals・ApEmpty の実測）
  approvals-body:       # 本文の箱（帯の下。カードか空の箱を包む）
    padding: "{spacing.md} {spacing.lg}"
    gap: "12px"
  approvals-next:       # 帯の主ボタン「続けて裁く」（高さは page-head-button の 30。左右 12・字 12px）
    padding: "0 12px"
    typography: "{typography.body-sm}"
    fontWeight: 500
  approvals-card:       # カード 1 つ（道具の行・表・注記）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
  approvals-tools:      # 道具の行（絞り込みの札・並べ替え・まとめて承認・決めた履歴）
    padding: "10px 12px"
    borderBottom: "1px solid {colors.line}"
    gap: "{spacing.sm}"
  approvals-chips:      # 絞り込みの札の並び
    gap: "6px"
  approvals-chip:       # 絞り込みの札（今いる札は紺の地に白字）
    height: "26px"
    padding: "0 10px"
    border: "1px solid {colors.line}"
    rounded: "{rounded.full}"
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
  approvals-chip-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    border: "1px solid {colors.primary}"
  approvals-th:         # 表の見出しの行
    height: "32px"
    padding: "0 {spacing.sm}"
    backgroundColor: "{colors.table-head}"
    textColor: "{colors.on-surface-variant}"
    borderBottom: "1px solid {colors.line}"
    typography: "{typography.body-sm}"
    fontWeight: 500
  approvals-td:         # 表の行
    height: "44px"
    padding: "0 {spacing.sm}"
    borderBottom: "1px solid {colors.line-soft}"
  approvals-group:      # 期限の区切りの行（期限切れだけ赤の字・今日は黒）
    height: "28px"
    backgroundColor: "{colors.surface}"
    typography: "{typography.body-sm}"
    fontWeight: 500
  approvals-title:      # 題名のリンク（黒字・下線なし）
    textColor: "{colors.on-surface}"
    fontWeight: 500
  approvals-late:       # 期限の区切りの赤（期限切れだけ）と過ぎた期限の字
    textColor: "{colors.error}"
    fontWeight: 500
  approvals-kind:       # 決めることの線の札
    border: "1.5px solid {colors.primary}"
    rounded: "{rounded.full}"
    padding: "0 {spacing.sm}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
  approvals-avatar:     # 誰からの頭文字の丸
    width: "22px"
    height: "22px"
    rounded: "{rounded.full}"
    backgroundColor: "{colors.on-surface-variant}"
    textColor: "{colors.card}"
    typography: "{typography.label-xs}"
  approvals-from:       # 誰からの列（頭文字の丸と名前の間）
    gap: "5px"
  approvals-acts:       # 行のボタン（従と主の間・字 12px）
    gap: "6px"
    typography: "{typography.body-sm}"
  approvals-note:       # カードの下の注記
    padding: "{spacing.sm} 12px"
    borderTop: "1px solid {colors.line-soft}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
  approvals-empty-title: # 空の箱の見出し（ApEmpty「いま決めるものはありません」16px・700）
    typography: "{typography.section-title}"
  approvals-empty-body: # 空の箱の説明（13px・行の高さ 1.7）
    typography: "{typography.body}"
    lineHeight: 1.7
  state-empty-icon:     # 空の箱の見出しの上の印（ApEmpty の ✓）
    width: "44px"
    height: "44px"
    rounded: "{rounded.field}"
    backgroundColor: "{state.success}"
    textColor: "{colors.card}"
    typography: "{typography.h2}"
  # 作る画面の本文の箱の中（K-225・キャンバス Create の本文の箱）。詳細の区画の見出しは前からの section-title（28・8）のまま、作る画面は名前を分けて持つ（PM の決め）
  create-doc:           # 本文の箱の中の文書（道具の帯の下）。幅 900 は CSS の max-width で持つ
    padding: "8px 28px 24px"
    width: "900px"
  # 作る画面の区画の見出し（16px・700・下に線）。2 つめから上 22
  section-title-form:
    typography: "{typography.section-title}"
    lineHeight: 1.6
    borderBottom: "1px solid {colors.line}"
    margin: "22px 0 6px"
    padding: "0 0 6px"
  # 作る画面の最初の区画の見出し（上 20）
  section-title-form-first:
    margin: "20px 0 6px"
  create-doc-add:       # 文書の下の「＋ 見出しを足す…」（点線の上の線・まだ使えない）
    borderTop: "1px dashed {colors.line}"
    margin: "18px 0 0"
    padding: "10px 0 0"
  create-spec:          # 本文の箱の「テスト仕様」の箱（線・角丸 8）
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
  create-spec-acts:     # テスト仕様の箱の下の行（＋ 項目を足す・抜けを点検する）
    backgroundColor: "{colors.table-head}"
    padding: "7px 10px"
    gap: "12px"
  # PC と使った量・PC をつなぐ（K-230・D-143.2：値はキャンバス EdPC・MePC・MePCInstalled の実測。小窓の置き場・影・余白は dialog の型のまま）
  dialog-connect:       # PC をつなぐの小窓の幅（EdPC 580）
    width: "580px"
  dialog-connect-button: # PC をつなぐの小窓の足のボタンの高さ（EdPC「あとで」30）
    height: "30px"
  dialog-sub:           # 小窓の頭の題の下の補足（「分身はこの PC で動く。3 分ほど」12px・灰）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    lineHeight: 1.6
  pc-step:              # 3 段の 1 段（上に線・上下 12・丸と字の間 12）
    borderTop: "1px solid {colors.line-soft}"
    padding: "12px 0"
    gap: "12px"
  pc-step-dot:          # 段の丸（26・円・12px・700。済は緑・今は紺・まだは灰）
    width: "26px"
    height: "26px"
    rounded: "{rounded.full}"
    typography: "{typography.body-sm}"
    fontWeight: 700
  pc-step-title:        # 段の題（13px・600）
    typography: "{typography.body}"
    fontWeight: 600
  pc-step-desc:         # 段の説明（12px・灰・行の高さ 1.7・題との間 2）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    lineHeight: 1.7
    margin: "2px 0 0"
  pc-code:              # 接続コードの並び（上 6。キャンバスの箱は線の外に 34×42 なので上下に 1 足して行をそろえる）
    margin: "6px 0 0"
    padding: "1px 0"
  pc-code-next:         # 接続コードの 2 つめからの箱の左の間（6・inline の箱で並べるので gap でなく余白）
    margin: "0 0 0 6px"
  pc-code-cell:         # 接続コードの 1 字の箱（34×42・線 紺・角丸 field・20px・700）
    width: "34px"
    height: "42px"
    border: "1px solid {colors.primary}"
    rounded: "{rounded.field}"
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    typography: "{typography.h1}"
  pc-code-foot:         # コードの下の行（上 6・間 8）
    margin: "6px 0 0"
    gap: "{spacing.sm}"
  pc-text-button:       # 字のリンクの形のボタン（新しいコード・12px・紺・400・行の高さ normal）
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    fontWeight: 400
    lineHeight: normal
  pc-note:              # 共用の PC の注意（淡い橙の箱・12px）
    backgroundColor: "{state.warning-soft}"
    border: "1px solid {state.warning-line}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
    typography: "{typography.body-sm}"
    gap: "{spacing.sm}"
  pc-note-mark:         # 共用の PC の注意の「!」（濃い橙）
    textColor: "{state.on-warning-container}"
  pc-wait:              # 足の「アプリからの返事を待っています…」（12px・灰・点との間 6）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    gap: "6px"
  pc-wait-dot:          # 待っている印の点（8・橙）
    width: "8px"
    height: "8px"
    rounded: "{rounded.full}"
    backgroundColor: "{state.warning}"
  pc-button:            # 小さなボタン（高さ 30・左右 12・12px・400・角丸 md）
    height: "30px"
    padding: "0 12px"
    rounded: "{rounded.md}"
    typography: "{typography.body-sm}"
    fontWeight: 400
  pc-button-primary:    # 小さなボタンの主（紺の線）
    border: "1px solid {colors.primary}"
  pc-wake:              # 直し方の箱の中の「Bridge を起こす」（角丸 field・600・上 6）
    rounded: "{rounded.field}"
    fontWeight: 600
    margin: "6px 0 0"
  pc-card:              # 白いカード（線・角丸 card・上下 4 左右 18）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.card}"
    padding: "4px 18px"
  pc-card-wide:         # 余白の大きいカード（この PC の Bridge・使った量：上下 14 左右 18・中の間 10）
    padding: "14px 18px"
    gap: "10px"
  pc-card-head:         # カードの頭（題と右のボタン・上 12 下 4）
    padding: "12px 0 4px"
  pc-card-title:        # カードの題（13px・600）
    typography: "{typography.body}"
    fontWeight: 600
  pc-row:               # カードの行（上に線・上下 12・間 12）
    borderTop: "1px solid {colors.line-soft}"
    padding: "12px 0"
    gap: "12px"
  pc-pill:              # 札（つながっている・切れている・いつも使う：11px・400・丸い）
    padding: "1px 8px"
    rounded: "{rounded.full}"
    typography: "{typography.label-md}"
    fontWeight: 400
  pc-detail:            # 行の補足（11px・400・灰）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-md}"
    fontWeight: 400
  pc-fix:               # 直し方の箱（淡い橙・12px・行の高さ 1.7・上 8）
    backgroundColor: "{state.warning-soft}"
    border: "1px solid {state.warning-line}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
    typography: "{typography.body-sm}"
    lineHeight: 1.7
    margin: "8px 0 0"
  pc-fix-msg:           # 直し方の箱の中の正本の文（上 6）
    margin: "6px 0 0"
  pc-more:              # 行の「…」（高さ 30・左右 12・線・角丸 md）
    height: "30px"
    padding: "0 12px"
    border: "1px solid {colors.line}"
    rounded: "{rounded.md}"
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
  pc-menu-min:          # 行の「…」で開くメニューの箱の幅の下限（min-width 220・外枠の自分のメニューの箱と同じ幅）
    width: "220px"
  pc-usage:             # 使った量の 2 列（間 18）
    gap: "18px"
  pc-usage-col:         # 使った量の列の最小の幅（grid の minmax の 240）
    width: "240px"
  pc-bar:               # 使った量の帯（高さ 8・円・上 6）
    height: "8px"
    rounded: "{rounded.full}"
    backgroundColor: "{colors.side-bg}"
    margin: "6px 0 0"
  pc-bar-fill:          # 帯の中身（紺）
    backgroundColor: "{colors.primary}"
  pc-set-row:           # 超えそうなときの行（上に線・上下 12・間 14・字の列の基準 240）
    borderTop: "1px solid {colors.line-soft}"
    padding: "12px 0"
    gap: "14px"
  pc-set-label:         # 超えそうなときの行の字の列の基準の幅（flex-basis 240）
    width: "240px"
  pc-switch:            # 切り替え（30×16・円・中の余白 2・つまみ 12）
    width: "30px"
    height: "16px"
    rounded: "{rounded.full}"
    padding: "2px"
    backgroundColor: "{colors.line-strong}"
  pc-switch-knob:       # 切り替えのつまみ（12・円・白）
    width: "12px"
    height: "12px"
    rounded: "{rounded.full}"
    backgroundColor: "{colors.card}"
  pc-pick:              # 選ぶ欄（高さ 30・左右 10・線・角丸 md）
    height: "30px"
    padding: "0 10px"
    border: "1px solid {colors.line}"
    rounded: "{rounded.md}"
    backgroundColor: "{colors.card}"
  pc-pick-min:          # 選ぶ欄の幅の下限（min-width 120）
    width: "120px"
  # チケットの一覧（K-251・D-143.2：値はキャンバス OnHome・Main の実測）。帯（page-head）そのものの余白は 0 で、中の行が余白を持つ
  list-head-row:        # 帯の 1 行目（見出し・すべてのグループ）
    padding: "12px {spacing.lg} 0"
    gap: "10px"
  list-views:           # 見え方のタブの並び
    padding: "6px {spacing.lg} 0"
    gap: "2px"
  list-view:            # 今いる見え方のタブ（紺の下線・500）。ほかのタブは下線が透明で字は灰
    padding: "{spacing.sm} 12px"
    borderBottom: "2px solid {colors.primary}"
    textColor: "{colors.primary}"
    fontWeight: 500
  list-body:            # 本文の行（Main：上下 16・左右 24・左と右の列の間 16）
    padding: "{spacing.md} {spacing.lg}"
    gap: "{spacing.md}"
  list-body-first:      # 本文の行（はじめて・OnHome：上下 18）
    padding: "18px {spacing.lg}"
  list-main:            # 本文の左の列（Main：数の札と表の箱の間 12）
    gap: "12px"
  list-main-basis:      # 本文の左の列が右の列と横に並ぶときの基準の幅（flex-basis）
    width: "640px"
  list-first:           # 本文の左の列（はじめて：あいさつと空の箱の間 14）
    gap: "14px"
  list-first-basis:     # はじめての左の列の基準の幅（flex-basis）
    width: "520px"
  list-greet:           # あいさつ（15px・700）
    typography: "{typography.h3}"
    fontWeight: 700
    lineHeight: 1.6
  list-empty-mark:      # 空の箱の ＋ の札（48・紺・角丸 field・20px・700）
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.field}"
    typography: "{typography.h1}"
    fontWeight: 700
    width: "48px"
    height: "48px"
  list-empty-desc:      # 空の箱の説明（13px・灰・行の高さ 1.7）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body}"
    lineHeight: 1.7
  list-empty-desc-max:  # 空の箱の説明の幅の上限（max-width）
    width: "460px"
  list-act:             # 空の箱・はじめにやることのボタン（高さ 30・左右 12・12px・角丸 md）
    height: "30px"
    padding: "0 12px"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  list-suggest:         # 空の箱の「はじめての 1 枚におすすめ」（12px・灰・上 6）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    margin: "6px 0 0"
    lineHeight: 1.6
  list-side:            # 右の列（幅 340・箱の間 12）
    width: "340px"
    gap: "12px"
  list-side-main:       # Main の右の列の基準の幅（flex-basis 300・広がっても 360 まで）
    width: "300px"
  list-side-main-max:   # Main の右の列の幅の上限（max-width）
    width: "360px"
  list-side-box:        # 右の列の白い箱（はじめにやること：角丸 lg・余白 14 16）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.lg}"
    padding: "14px {spacing.md}"
  list-side-title:      # 右の列の箱の見出し（15px・700）
    typography: "{typography.h3}"
    fontWeight: 700
    lineHeight: 1.6
  list-progress:        # 進みの棒（高さ 6・角丸 full・淡い地・上 8 下 4）
    backgroundColor: "{colors.side-bg}"
    rounded: "{rounded.full}"
    height: "6px"
    margin: "{spacing.sm} 0 {spacing.xs}"
  list-task:            # はじめにやることの 1 行（間 12・上下 12・上に線）
    gap: "12px"
    padding: "12px 0"
    borderTop: "1px solid {colors.line-soft}"
  list-task-mark:       # 行の頭の丸（22・まだは線 2px）
    width: "22px"
    height: "22px"
    rounded: "{rounded.full}"
    border: "2px solid {colors.line-strong}"
  list-task-label:      # 行の名前（600）
    fontWeight: 600
  list-setup-foot:      # 箱の足の 1 行（11px・上 8）
    typography: "{typography.label-md}"
    fontWeight: 400
    padding: "{spacing.sm} 0 0"
  list-anytime:         # いつでもできること（淡い地・角丸 lg・余白 12 16・12px・行の高さ 1.8）
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px {spacing.md}"
    typography: "{typography.body-sm}"
    lineHeight: 1.8
  list-target:          # 字だけの小さな操作（いまは閉じる・表のリンク）の押せる高さ（24 以上）
    height: "24px"
  list-cards:           # 数の札の格子（間 10）
    gap: "10px"
  list-card:            # 数の札（白・角丸 field・余白 10 12）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  list-card-value:      # 数の札の数（20px・700）
    typography: "{typography.h1}"
    fontWeight: 700
  list-panel:           # 表の箱（白・角丸 field）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
  list-filter:          # 表の箱の頭の絞り込みの行（余白 10 12・下に線）
    gap: "{spacing.sm}"
    padding: "10px 12px"
    borderBottom: "1px solid {colors.line}"
  list-chip:            # 絞りの札（高さ 26・角丸 full・左右 10・12px）
    height: "26px"
    rounded: "{rounded.full}"
    padding: "0 10px"
    typography: "{typography.body-sm}"
    border: "1px solid {colors.line}"
  list-tool:            # 条件を保存・表示設定（高さ 26・角丸 md・左右 8・12px）
    height: "26px"
    rounded: "{rounded.md}"
    padding: "0 {spacing.sm}"
    typography: "{typography.body-sm}"
    border: "1px solid {colors.line}"
  list-th:              # 表の頭の行（高さ 32・左右 8・12px・500・下に線）
    backgroundColor: "{colors.table-head}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    fontWeight: 500
    height: "32px"
    padding: "0 {spacing.sm}"
    borderBottom: "1px solid {colors.line}"
    lineHeight: 1.6
  list-title-max:       # 表の題名の列の幅の上限（max-width・越えたら「…」）
    width: "360px"
  list-td:              # 表の行（高さ 36・左右 8・下に淡い線）
    height: "36px"
    padding: "0 {spacing.sm}"
    borderBottom: "1px solid {colors.line-soft}"
  list-tag:             # 種別・状態の札（白い字・角丸 full・11px・500）
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "1px {spacing.sm}"
    typography: "{typography.label-md}"
    fontWeight: 500
  list-tag-min:         # 種別・状態の札の幅の下限（min-width）
    width: "44px"
  list-avatar:          # 担当者の頭文字の丸（20・10px）
    backgroundColor: "{data.lavender}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    typography: "{typography.label-xs}"
    width: "20px"
    height: "20px"
    fontWeight: 400
  list-ai:              # 担当者の横の「AI」の札（線・角丸 full・左右 6・11px・間 2）
    textColor: "{colors.on-surface-variant}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.full}"
    padding: "0 6px"
    typography: "{typography.label-md}"
    gap: "2px"
    fontWeight: 400
  list-chips:           # 絞りの札の並び（間 6・件数との間 8 を足して 16）
    gap: "6px"
    margin: "0 0 0 {spacing.sm}"
  list-tools:           # 並び・条件を保存・表示設定の並び（間 6）
    gap: "6px"
  list-who:             # 担当者の頭文字の丸と名前の間（5）
    gap: "5px"
  list-late:            # 期限の横の炎の印（左 3・縦は 1px 下げる）
    margin: "0 0 0 3px"
    verticalAlign: "-1px"
  list-late-icon:       # 炎の絵の大きさ（12）
    width: "12px"
    height: "12px"
  list-ai-icon:         # AI の札のロボットの絵の大きさ（13）
    width: "13px"
    height: "13px"
  list-more:            # 表の下の「もっと見る」の行（余白 8 12）
    padding: "{spacing.sm} 12px"
    gap: "{spacing.sm}"
  list-section:         # 表の期限の区切りの見出しの行（淡い地・高さ 28・12px・500）
    backgroundColor: "{colors.surface}"
    height: "28px"
    typography: "{typography.body-sm}"
    fontWeight: 500
    lineHeight: 1.6
  list-columns:         # 表示設定の箱（白・線だけで影は置かない・角丸 card・余白 10・幅 320）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.card}"
    padding: "10px"
    width: "320px"
    shadow: "0 10px 30px color-mix(in srgb, {colors.overlay-shadow} 60%, transparent)"   # on-surface の 18%（overlay-shadow 30% の 6 割・MnView）。暗いテーマは overlay-shadow が透明なので影なし
    top: "36px"
  list-columns-item:    # 表示設定の箱の 1 行（チェックと名前・上下 4 左右 6・間 8）
    padding: "{spacing.xs} 6px"
    gap: "{spacing.sm}"
  list-box:             # Main の右の列の白い箱（角丸 field）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
  list-box-title:       # 右の列の箱の見出し（13px・余白 10 12・下に線）
    typography: "{typography.body}"
    padding: "10px 12px"
    borderBottom: "1px solid {colors.line}"
    fontWeight: 700
  list-box-row:         # 右の列の箱の 1 行（余白 10 12・下に淡い線）
    padding: "10px 12px"
    borderBottom: "1px solid {colors.line-soft}"
  # ---- 段 2（K-50 の F1 の残り・枝 c/段2）の入口と安全の設定の部品（キャンバス AuthRecover・AuthReset・MeLogin・MeTotp・MeBackup・op の障害の帯の実測）。
  #      components/k/auth-parts.css と components/k/setting-parts.css が読む。カード・行・札・小さなボタン・段は「PC と使った量」の pc-* をそのまま使う
  auth-choice:          # 選ぶカード（端末をなくしたとき：線・角丸 card・上下 12 左右 14・印と字の間 12）
    border: "1px solid {colors.line}"
    rounded: "{rounded.card}"
    padding: "12px 14px"
    gap: "12px"
  auth-choice-title:    # 選ぶカードの題（13px・600）
    typography: "{typography.body}"
    fontWeight: 600
  auth-choice-desc:     # 選ぶカードの説明（12px・灰・行の高さ 1.6）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    lineHeight: 1.6
  auth-icon:            # 絵の印（30・角丸 field・淡い紺の地に紺の絵。済の印は紺の地に白・止めは赤・代表 2026-11-17「色はメインに合わせる」「絵にする」）
    width: "30px"
    height: "30px"
    rounded: "{rounded.field}"
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    fontWeight: 700
  auth-note-box:        # 灰の案内の箱（地 surface・角丸 field・余白 10 12・12px・行の高さ 1.7）
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    typography: "{typography.body-sm}"
    lineHeight: 1.7
  auth-ok-box:          # 済んだ知らせの箱（淡い紺・線・13px・行の高さ 1.7・印と字の間 10。緑にしない・代表 2026-11-17）
    backgroundColor: "{colors.primary-soft}"
    border: "1px solid {colors.primary-line}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    typography: "{typography.body}"
    lineHeight: 1.7
    gap: "10px"
  auth-bad-box:         # 使えない・止められた知らせの箱（淡い赤・線・13px・行の高さ 1.7）
    backgroundColor: "{state.danger-container}"
    textColor: "{state.on-danger-container}"
    border: "1px solid {state.danger-line}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    typography: "{typography.body}"
    lineHeight: 1.7
    gap: "10px"
  auth-ok-icon:         # 済んだ知らせの箱の丸の印（22・角丸 field）
    width: "22px"
    height: "22px"
    rounded: "{rounded.field}"
  status-strip:         # いまの様子の帯（障害：淡い赤・下に線・余白 8 24・12px・間 8）。メンテナンスは status-strip-maint の色
    backgroundColor: "{state.danger-container}"
    textColor: "{state.on-danger-container}"
    borderBottom: "1px solid {state.danger-line}"
    padding: "{spacing.sm} {spacing.lg}"
    typography: "{typography.body-sm}"
    gap: "{spacing.sm}"
  auth-status-page:     # いまの様子の帯を載せた入口の頁の高さ（帯と入口の枠で画面の高さちょうど）
    height: "100dvh"
  status-strip-maint:   # メンテナンスの帯（淡い橙）
    backgroundColor: "{state.warning-soft}"
    textColor: "{state.on-warning-container}"
    borderBottom: "1px solid {state.warning-line}"
  auth-qr:              # QR の箱（白・線・角丸 field・余白 6・120）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "6px"
    width: "120px"
  auth-secret:          # 読み取れないときに手で入れる鍵の文字（地 page・角丸 sm・余白 2 6・13px）
    backgroundColor: "{colors.page}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
    typography: "{typography.body}"
  backup-codes:         # バックアップコード 10 個の並び（2 列・地 surface・角丸 card・余白 14・間 8）
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "14px"
    gap: "{spacing.sm}"
  backup-code:          # バックアップコード 1 つ（白・線・角丸 md・余白 6・15px・字の間 .06em）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.md}"
    padding: "6px"
    typography: "{typography.h3}"
    fontWeight: 400
    letterSpacing: "0.06em"
  sec-summary:          # 安全の状態のカード（安全：淡い紺・線・角丸 card・余白 12 16・間 12）。足りないときは sec-summary-warn の色
    backgroundColor: "{colors.primary-soft}"
    border: "1px solid {colors.primary-line}"
    rounded: "{rounded.card}"
    padding: "12px 16px"
    gap: "12px"
  sec-summary-warn:     # 安全の状態のカード（足りない：淡い橙）
    backgroundColor: "{state.warning-soft}"
    border: "1px solid {state.warning-line}"
  # 一覧（全部）・グループの一覧（K-252・キャンバス List）
  list-scope-mark:      # グループの一覧の見出しの頭の札（26 角・角丸 md・11px・700・白い字。地はグループの色）
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    typography: "{typography.label-md}"
    fontWeight: 700
    width: "26px"
    height: "26px"
  list-search:          # 検索条件の箱（白・角丸 field・余白 12 14・行の間 10）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
    gap: "10px"
  list-search-row:      # 検索条件の箱の頭の行（検索条件・かんたん／詳しく・保存・畳む。間 10）
    gap: "10px"
  list-search-chips:    # 状態・親子の札の行（間 6・12px）
    gap: "6px"
    typography: "{typography.body-sm}"
  list-search-label:    # 札の行の頭の名前（状態の幅 40）
    width: "40px"
  list-search-chip:     # 状態・親子の札（高さ 24・角丸 full・左右 9・12px）
    border: "1px solid {colors.line}"
    rounded: "{rounded.full}"
    padding: "0 9px"
    typography: "{typography.body-sm}"
    height: "24px"
  list-search-seg:      # かんたん・詳しく の箱（線・角丸 md）
    border: "1px solid {colors.line}"
    rounded: "{rounded.md}"
  list-search-seg-item: # かんたん・詳しく の 1 つ（高さ 26・左右 10・12px）
    padding: "0 10px"
    typography: "{typography.body-sm}"
    height: "26px"
  list-search-fields:   # 種別〜言葉の格子（間 10）
    gap: "10px"
  list-search-field:    # 格子の 1 つ（名前と欄の間 3・12px・灰）
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    gap: "3px"
  list-search-input:    # 格子の欄（白・線・角丸 md・高さ 30・左右 8・12px）
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.line-strong}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.sm}"
    typography: "{typography.body-sm}"
    height: "30px"
  list-pick:            # 表の行の頭の選ぶ印の列（幅 32）
    width: "32px"
  list-detail-side:     # 一覧の右に開く詳細（白・線・角丸 field・幅 400・余白 16・D-128.14・D-128.165）
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.field}"
    padding: "{spacing.md}"
    width: "400px"
  list-detail-side-title: # 右に開く詳細の題名（h2・18px・700・余白は詳細の題名の行と同じ）
    typography: "{typography.h2}"
    fontWeight: 700
  # 段 5 の下絵 v2（features/F4/doc の doc.css・extra.css・thread.css・K-431）の線・輪郭・目に見えない名前・入力の印の値。CSS は var(--k-c-f4d-…) だけを読む
  f4d-rule:             # 区切りと箱の線（1px・line）。border・border-top・border-bottom・border-left に同じ値で当てる
    border: "1px solid {colors.line}"
  f4d-rule-soft:        # 淡い区切りの線（1px・line-soft）
    border: "1px solid {colors.line-soft}"
  f4d-rule-strong:      # 濃い枠の線（1px・line-strong）：本文の欄・色の見本の四角
    border: "1px solid {colors.line-strong}"
  f4d-rule-warning:     # 渡しの箱の線（1px・淡い橙の線）
    border: "1px solid {state.warning-line}"
  f4d-quote:            # 引用の左の線（3px・line-strong）
    border: "3px solid {colors.line-strong}"
  f4d-log:              # 記録の左の線（3px・紺の淡い線）と行の間（2）
    border: "3px solid {colors.primary-line}"
    gap: "2px"
  f4d-ring:             # 押せる物の輪郭（2px・primary）。outline に当てる
    border: "2px solid {colors.primary}"
  f4d-ring-done:        # 完了のボタンの輪郭（2px・済の色）
    border: "2px solid {state.success}"
  f4d-ring-out:         # 輪郭の外への離し（outline-offset 2px）
    width: "2px"
  f4d-ring-in:          # 輪郭の内への入れ（outline-offset -2px）
    width: "-2px"
  f4d-ring-near:        # 色の見本の四角の輪郭の離し（outline-offset 1px）
    width: "1px"
  f4d-sr:               # 目に見えない名前（読み上げだけ・幅と高さ 1）
    width: "1px"
    height: "1px"
  f4d-caret:            # 本文の入力の印（幅 2・高さは字と同じ 1em・左 1）
    width: "2px"
    height: "1em"
    margin: "0 0 0 1px"
  f4d-sample-ink:       # 下絵の本文の見本の字の色（利用者が付ける色の見本。正本の進行中の色から選ぶ・PM 2026-11-23）
    textColor: "{state.progress}"
  f4d-sample-mark:      # 下絵の本文の見本の背景の色（同上。正本の注意の淡い面から選ぶ）
    backgroundColor: "{state.warning-container}"
# 暗いテーマ（D-128.55 の「見た目：システム・明るい・暗い」・2026-11-03 高本さん了承・K-24）。明るいテーマと同じ名前を全部持つ。
# 文字と地の組み合わせ 41 組を WCAG で確かめた（全部 AA 以上・最低 6.36:1）。値を変えたら 04_design/gen_tokens.py の確かめが赤になる
dark:
  colors:
    primary: "#9DB5E8"
    on-primary: "#0F1A30"
    primary-container: "#22345C"
    on-primary-container: "#DCE4F2"
    secondary: "#6CC4BC"
    on-secondary: "#062421"
    secondary-container: "#14302D"
    on-secondary-container: "#CFEAE7"
    tertiary: "#B9A2E6"
    on-tertiary: "#22163D"
    tertiary-container: "#2C2240"
    on-tertiary-container: "#E9E0F5"
    surface: "#121820"
    on-surface: "#E6EAF0"
    surface-variant: "#1E2632"
    on-surface-variant: "#B3BCC9"
    error: "#F28B82"
    on-error: "#3B0A08"
    neutral: "#7D8796"
    on-neutral: "#0F141C"
    neutral-strong: "#566070"
    card: "#171E29"
    line: "#2A3443"
    line-soft: "#212A37"
    side-bg: "#141A23"
    primary-hover: "#B4C7EE"
    on-code: "#D8DEE9"
    ai-container: "#251E36"
    mark: "#4A3F12"
    page: "#0F141C"
    select: "#1E2734"
    table-head: "#141B25"
    line-strong: "#3D4858"
    primary-soft: "#1B2638"
    primary-line: "#34476B"
    overlay-shadow: "#00000000"  # 暗いテーマは影が見えないので出さない。迫り出す面は輪（dialog-ring＝line）と地の段で表す
  syntax:
    keyword: "#9DB5E8"
    string: "#6CC4BC"
    number: "#E0B25A"
    comment: "#9AA4B2"
    function: "#D29BC2"
    type: "#8FA6D6"
  state:
    success: "#6FD49A"
    success-container: "#12301F"
    on-success-container: "#A7E8C0"
    warning: "#F0A35A"
    warning-container: "#33240F"
    on-warning-container: "#F5C890"
    danger: "#F28B82"
    danger-container: "#3A1614"
    on-danger-container: "#F7B4AE"
    progress: "#8AB4F8"
    progress-container: "#142640"
    on-progress-container: "#B9D2FB"
    success-soft: "#0F2418"
    success-line: "#1F4A30"
    warning-soft: "#2A1E0E"
    warning-line: "#5A3F18"
    danger-line: "#5C2522"
  data:
    indigo: "#8FA6D6"
    teal: "#6CC4BC"
    amber: "#E0B25A"
    coral: "#EE9A8E"
    sage: "#9CC08E"
    plum: "#D29BC2"
    lavender: "#B1A3DE"
    teal-light: "#8FC2BE"
---

# Kaname Design System

## Overview

**「Kaname ── バラバラのものが、一点に集まる」**（製品名の表記は Kaname だけ。D-011.4）

Kaname は、仕事を「チケット」に集め、人と、その人の分身（「高本のAI」のように名前つきで呼ぶ AI）がいっしょに進める場所（D-125・D-128.38）。営業も経理も取引先とのやり取りも、人も AI も、一つのチケットとワークスペースの決まりに集まる。扇の要 ── 抜けると全部バラバラになる中心の金具 ── がブランドの核である。

このデザインシステムは **業務データを長時間見るための情報設計**として組む。読み物ではなく、チケット・承認待ち・取引先・ナレッジが密度高く並ぶ画面が主戦場になる（土台は Backlog の作り・D-128.7）。したがって装飾を削り、余白と罫線で構造を出し、数値と状態が一目で読めることを最優先する。

姉妹製品 Atelier（工房の静謐・暖かい生成り紙）とは意図的に差別化する。Atelier が「作る場所」なら Kaname は「束ねる中心」であり、扱うものも読み物から数値へ移る。ただし ENGINE BASE の共通作法 ── **絵文字を使わず Lucide で統一する / Material Design 3 の役割ベース命名 / 日本語主体** ── は揃える。

**Design Principles**

1. **数値が主役（Numbers First）** ── 目標の進捗・金額・件数がこの製品の中身。数値は本文と同じ書体で組み、桁だけを揃える。装飾が数値を邪魔しない。
2. **色は二層に分ける（Two Color Layers）** ── システム色（操作・状態）とデータ色（部署・台帳の識別）を混ぜない。混ぜると「オレンジは経理か、それとも警告か」が読めなくなる。
3. **色だけで意味を伝えない（Never Color Alone）** ── 状態には必ずアイコンとテキストを添える。データ色には必ずラベルを添える。色覚特性に依存しない。
4. **AI 由来が一目で分かる（AI is Visible）** ── AI が提案したもの・AI が作ったものは Tertiary（バイオレット）で示す。人が決めたものと AI が提案したものを混同させない。
5. **影より罫線（Rules over Shadows）** ── 密度の高い画面で影を多用すると濁る。境界線と余白で構造を出す。

## Colors

Material Design 3 の役割ベース命名を採用する。加えて Kaname 固有の **2 層構造** を持つ。

### システム色（UI の操作と状態）

#### Primary — `#22345C` ディープインディゴ
**Kaname（中心）の色。** 主要アクション、アクティブなナビゲーション、リンク、目標の達成バー。1 画面に 1 つの Primary ボタンが原則。ENGINE BASE のロゴが持つ黒の硬質さを保ちながら、SaaS として色を持たせた。

#### Secondary — `#186F69` ティール
補助的なアクション、AI 社員に関わる要素、選択状態。Primary を引き立てる位置づけ。

#### Tertiary — `#6D4AA6` バイオレット
**AI 由来を示す専用色。** AI の提案・AI が生成した下書き・AI が書いた改訂案に使う。状態色（緑・橙・赤・青）のどれとも色相が重ならないため、「AI のものか」を状態と独立して読める。

#### Error — `#B91C1C`
破壊的操作の確認、入力エラー、失敗した実行。

### 状態色（semantic）

| 状態 | 色 | 使い方 |
|---|---|---|
| 成功 | `#166534` | 承認済み・完了・習得済み |
| 警告 | `#B45309` | 期限接近・要確認・学習中 |
| 危険 | `#B91C1C` | 期限超過・失敗・未達 |
| 進行中 | `#1D4ED8` | 実行中・承認待ち |

**必ず塗りのピル ＋ Lucide アイコン ＋ テキスト**で表示する。色だけで状態を伝えない。

### データ色（部署・台帳・業務の識別）

ロゴの「多色の線が一点に集まる」を画面上で表現する 6 色。**意味を持たない。ただの区別。**

| 色 | 値 | 想定 |
|---|---|---|
| indigo | `#2F4B7C` | 営業 |
| teal | `#186F69` | 経理 |
| amber | `#7E570D` | CS |
| coral | `#A34A3E` | 人事 |
| sage | `#516F46` | 制作 |
| plum | `#6B3F5E` | 外部ツール |

**使い方の制約（これが色の混同を防ぐ）**

- データ色は **4px の点** または **2px の左罫** としてのみ使う。**塗りに使わない**
- **必ずラベル（部署名・台帳名）を添える**。色だけで識別させない
- 顧客が自分で割り当てる。運営が意味を固定しない

```
   状態色  ▸ 塗りのピル ＋ アイコン ＋ テキスト   （面で見せる）
   データ色 ▸ 4px の点 ／ 2px の左罫 ＋ ラベル     （点と線で見せる）
   → 同じ色相でも、面積と形が違うので読み分けられる
```

### Surface & Neutral

サイドバーは `#EEF0F4`（本文 `surface` より半段暗い中間色）に右の罫線 1 本。文字は `on-surface-variant`、選択中は白い面＋罫線で `on-surface`。紺（primary）の面は使わない（D-072）。

`surface` は **`#F7F8FA`** ── わずかに寒色寄りのオフホワイト。Atelier の暖かい生成り紙と対照的に、数値と表の可読性を優先した。純白より目が疲れず、暖色より数字が締まる。

### WCAG コントラスト（全ペア検証済み）

| ペア | 比率 | 判定 |
|---|---|---|
| primary / on-primary | 12.25:1 | AAA |
| secondary / on-secondary | 5.97:1 | AA |
| tertiary / on-tertiary | 6.60:1 | AA |
| surface / on-surface | 16.28:1 | AAA |
| surface / on-surface-variant | 7.13:1 | AAA |
| surface-variant / on-surface | 14.61:1 | AAA |
| error / on-error | 6.47:1 | AA |
| 状態色（4 色すべて） | 4.73〜7.13:1 | AA 以上 |
| データ色（6 色すべて） | 5.32〜8.17:1 | AA 以上 |
| 暗いテーマ（41 組・D-128.55） | 6.36〜15.29:1 | AA 以上（gen_tokens.py が毎回確かめる） |

**全ペアが AA（4.5:1）以上。** データ色の amber は初案 `#9C6C12` が 4.33:1 で不合格だったため `#7E570D` に修正した。

## Typography

**Noto Sans JP の単一書体（D-128.3）。見出し・本文・ラベル・数値をすべて 1 書体で組む。** M PLUS 2 はやめた。

### なぜ 1 書体か

数値だけ別書体にすると、日本語の文の中に数字が現れたとき **数字だけが浮く**。1 書体に統一すれば、この問題は起こりようがない。桁の揃えは書体ではなく **設定**で担保する（下の「数値の組み方」）。

### Noto Sans JP にした理由（D-128.3）

| 理由 | 内容 |
|---|---|
| 癖が少ない | 1 行 36px・本文 13px まで詰めても崩れにくい（D-128.13） |
| OS をまたいで同じ | Windows・Mac・スマホで字面の差が小さい |
| ライセンス | SIL Open Font License（商用可） |
| 太さ | 400 / 500 / 700 で 本文・ラベル・見出しの階層が作れる |

Atelier と同じ書体になるが、製品の区別は色（紺 `#22345C`）と骨組みでつける。

### 数値の組み方

| 指定 | 役割 | 必須か |
|---|---|---|
| `text-align: right` | 表の数値列を右寄せにする。**桁を縦に合わせているのはこれ** | **必須** |
| `font-variant-numeric: tabular-nums` | 数字 1 文字の幅を等しくする | **必須**（Noto Sans JP の数字は等幅ではない） |

### Scale（D-128.13・D-128.75）

| 段 | 大きさ | 使う所 |
|---|---|---|
| `h1` | 20px | ページの題（チケット・ナレッジ・取引先） |
| `h2` | 18px | 管理の画面の題・数の札の数字 |
| `h3` | 15px | 小窓の題・カードの題 |
| `page-title` | 18px | ページの型の見出しの帯の h1（行 1.6・K-217） |
| `section-title` | 16px | ページの型の区画の見出し h2（行 1.7・下に罫線・K-217） |
| `input` | 16px | スマホの入力欄（拡大を防ぐ） |
| `body-md` | 14px | スマホの本文・長い文 |
| `body` | 13px | **本文の既定**。表の行・左のバー |
| `body-sm` | 12px | 補足・表の頭・札 |
| `label-md` | 11px | 小さな補足・数の下の説明 |
| `label-xs` | 10px | 数のしるし（バッジ）・顔の 1 文字 |

段の間の大きさ（17・19・21px など）は使わない。`tokensnap.py` が寄せる。
段は**大きさの種類で数えて 10 まで**（design-system.md §3）。1 度も使われない段は置かない（K-218 で metric-lg・display・chat を消した）。どちらも design_gate の `--scales`（D6 段・D7）が見る。

## Layout

4px ベースのスペーシング（`xs` 4 / `sm` 8 / `md` 16 / `lg` 24 / `xl` 48 / `2xl` 96）。

### 画面の骨組み（D-128.5〜.24・D-128.46〜.48）

```
┌──────────┬──────────────────────────────────────────────┐
│ 左のバー │ 上の帯 48px：いまの場所 › … ｜探す・ベル・顔   │
│ 216px    ├────────┬──────────────────────────┬──────────┤
│ #EEF0F4  │ 2 つめ │ 中身                     │ 右の     │
│          │ のパネル│（ページの地 #F2F4F7）    │ パネル   │
│          │ 232px  │                          │ 280〜340 │
└──────────┴────────┴──────────────────────────┴──────────┘
```

- **バーとパネルは端から端まで**伸ばす（上下とも画面いっぱい。高本さんの指示 2026-11-02）。中身だけを真ん中に寄せない
- **左のバー**：ワークスペース名と切り替え・＋ チケットを作る・チケット／承認待ち／高本のAI／ナレッジ／取引先・グループ・下に ワークスペースの管理 と PC の状態。開閉できる（畳むと 56px のアイコン）
- **上の帯**：いまの場所（パンくず）・探す・知らせ（ベル）・自分のメニュー（顔）。左右で別々の帯を持たない
  - 幅 767 以下も上の帯を出す（会社の印と名前・探す・知らせ・自分のアイコン。いまの場所は出さない・D-147）。探すは虫眼鏡のボタンで、押すと帯の幅いっぱいに開く。知らせの鈴は帯の 1 つだけで、本文の見出しの右には置かない。自分のメニューは帯の自分のアイコンから開く（下のタブの「メニュー」の引き出しには置かない）
- **2 つめのパネル**（`kn-sub`）：その場所の中の行き先。灰の面（`line-soft`）に、いま開いている項目だけ白いカードが浮く。**中身が無いときは出さない**（D-128.66）
- **右のパネル**：選んだもの・高本のAI・チケットのパネル。開閉でき、閉じると 36px の細い帯（押すと開く）
- **運営の場所**は左上が「Kaname 運営」（黒い印）で、左のバーの中身が変わる。顧客の画面とは別の場所（D-128.67）

### 詰め方（D-128.13・D-128.73）

| もの | 値 |
|---|---|
| 一覧の 1 行 | 36px（チケットの一覧）／ 48px（2 行の名前を持つ表：取引先・運営） |
| 左のバーの項目 | 30〜32px |
| 本文 | 13px |
| 数の札 | 数字 18px・説明 11px |

### 幅（マルチデバイスで機能同等が必須）

| 幅 | 左のバー | そのほか |
|---|---|---|
| 1280px 以上 | 216px（開閉できる） | 2 つめのパネル 232px・右のパネルあり |
| 1024〜1279px | 56px のアイコンに畳む | 詳細を開くと幅 400（D-128.14）・2 つめのパネルは 64px のアイコン |
| 768〜1023px | 56px | 右のパネルは重ねて開く |
| 767px 以下 | **下のタブ**：チケット・承認・＋作る・AI・メニュー（D-128.12） | 2 つめのパネルは上で横に並ぶ |

**スマホで機能が落ちてはならない。** 承認と会話は外出先で使われる中心機能。書く・直すの重い作業は PC に寄せてよい（スマホのナレッジ・取引先は 読む・探す・さばく まで）。**横スクロールは `document.scrollWidth - clientWidth` で数値検証する。**

## Elevation & Depth

**影はほぼ使わない。** 構造は罫線 `line` と余白で出す。例外は 3 つだけ。浮く箱（メニュー・選ぶ欄）は層の順 popup-layer（70）：帯より上・小窓の幕より下。

| レベル | 影 | 用途 |
|---|---|---|
| 0 | なし | カード、テーブル、パネル（既定） |
| 1 | `0 1px 2px rgba(19,27,39,.08), 0 0 0 1px rgba(19,27,39,.06)` | 2 つめのパネルで開いている項目の白いカード |
| 2 | `0 10px 30px rgba(19,27,39,.18)` | 小窓・横から出る引き出し・ポップオーバー |

## Shapes

- `none` (0px) — テーブル、端から端の帯
- `sm` (4px) — タグ、キー表示、データ色の点
- `md` (6px) — **ボタン、入力、左のバーの項目**
- `field` (8px) — 2 つめのパネルの項目・小さな箱・吹き出し（D-128.75）
- `card` (10px) — **カード、ポップオーバー**（D-128.75）
- `lg` (12px) — 小窓、スマホのカード
- `xl` (20px) — 入力欄の箱（会話）
- `full` (pill) — 状態ピル、チップ、顔、数のしるし

## Components

### Buttons
大きさは 2 つ（K-218・キャンバスの実測）。**作業の画面**は高さ 32・字 13px（`body`）・太さ 500・角丸 `md`（`button-primary`）。**入口の画面**（登録・ログイン・確認）は高さ 44・字 14px（`body-md`）・角丸 `field`（`button-primary-lg`・Button `size="lg"`）。表の中や帯の小さな操作は sm（高さ 28）。
- **Primary** — 最重要アクション。**1 画面に 1 つ**が原則（承認画面なら「承認する」）
- **Secondary** — 重要だが補助的（「直す」）
- **Outlined** — 従の操作（「やめる」「下書きのまま閉じる」）。白地・`1px solid line`・黒字・太さを付けない（400）
- **Inverted** — Primary 背景上での使用

### Status Pill（状態ピル）
`rounded.full` の塗り ＋ Lucide アイコン ＋ テキスト。**アイコンとテキストを省略しない。**

### Data Dot / Rail（データ識別）
4px の円、または 2px の左罫。**必ずラベルを伴う。**

### AI Marker（AI 由来）
Tertiary の細い左罫、または `tertiary-container` の淡い背景 ＋ Lucide の `sparkles` 相当のアイコン。「AI が提案しました」を明示する。

### Metric（数値表示）
数の段（数の札は `h2`）＋ `tabular-nums` ＋ 表では `text-align: right`。目標に対する実績は「目標 12,000,000 に対して 69.4%」のように**ラベル付きの日本語**で書き、進捗バーを併記する。「8,330,000 / 12,000,000」のようなスラッシュだけの分数表記は使わない（何が実績で何が目標か読み手に伝わらないため）。

### Cards
白（`card`）の面 ＋ `1px solid line` ＋ 角丸 `card`。ページの地は `page`。影は使わない。

### Inputs
白の面 ＋ 角丸。作業の画面は `1px solid line-strong`・角丸 `md`・字 13px・余白 6px 10px（`input`）。入口の画面は高さ 42・`1px solid line`・角丸 `field`・字 14px・余白 0 12px（`input-lg`・Field `size="lg"`）。**幅 767 以下は字を 16px**（`input` の段・iPhone が入力のたびに拡大するのを防ぐ・D-144.7）。フォーカスと書いている最中は `1px solid primary` ＋ `0 0 0 2px primary-container` の輪。
項目名は欄の上に 12px。作業の画面は太さを付けず `on-surface-variant`・欄との間 4px（`label`）。入口の画面は 500・`on-surface`・間 6px（`label-lg`）。

### 選んでいるもの（2 つめのパネルは「白いカードが浮く」を高本さんが選んだ）
- 白い面の中で選んでいる行・項目：`select` の灰の塗り
- 灰のパネルの中で選んでいる項目：白いカードが浮く（影レベル 1）
- 選んでいるカード：紺の線 ＋ `primary-container` の輪
- 左のバーで開いている場所：紺の塗りに白い字

### タブ
下線のタブ。開いているタブは紺の 2px の下線と太字。タブの数はタブの名前の横に小さく出す（例：メンバー 8）。

### 表
頭の行は `table-head`・12px・`on-surface-variant`。行の境は `line-soft` の 1 本。行を押すと開く。短い札・数・ボタンは折り返さない（D-128.31）。

### 数の札
白いカードに 説明（12px）・数（18px・太字）・補足（11px）。気にかけてほしい数だけ `st-warning`／`st-danger` の字の色。

### 小窓・引き出し・ポップオーバー
小窓は上から 60px・左右の真ん中に置き、左右は画面の端から `lg` 空ける（K-229・キャンバスの StApproveModal・StCompleteModal・StReturnModal）。幅は取り消せない確かめ 380（`dialog-confirm`）・ふつうの小窓 420（`dialog-form`）。白地・角丸 `lg`。足のボタンは高さ 34（`dialog-button`）。取り消せない注意は赤い箱（`dialog-caution`）、頭の下の対象の行は 12px・灰（`dialog-target`）、中の項目の枠は 1px の線・角丸 `field`（`dialog-group`）、必須の印は `field-required`。**頭**は余白 14px 18px・下に `1px solid line`・題は 15px（`h3`）の太さ 700（`dialog-title`）・右上に × の閉じる（28×28・名前「閉じる」）。**足**は上に `1px solid line`・右寄せに やめる（outlined）／決める（primary）。閉じる手段は頭の × と Esc で、足に「閉じる」のボタンを重ねて置かない。開いたときのフォーカスは本文の最初の欄（無ければ足の最初のボタン）に置き、× には置かない。**取り消せない確かめ**（Confirm・キャンバスの StModal「承認して送ります」）は × を持たず、閉じるのは足の「やめる」と Esc。開いたときのフォーカスは「やめる」。引き出しは右から。ポップオーバーは押した所の近くに出し、パネルの外にはみ出しても切れないよう画面に固定して出す。

### 帯（お知らせ・確かめ・運営）
- 注意：`warning-soft` の地 ＋ `warning-line` の線 ＋ 札
- 障害：`danger-container` の地 ＋ `danger-line`（上の帯のすぐ下に 1 行・D-128.71）
- 運営として中を見ている：画面のいちばん上に黒い帯 ＋ 画面のふちに `st-warning` の枠（D-128.68）

### 空のとき
白地の点線の枠（`1px dashed line-strong`・角丸 `lg`・余白 36px 28px・間 12px）の箱を本文の幅いっぱいに置き、中を**中央寄せ**で 印・何がないか・足すと何がうれしいか・最初のボタン（`state-empty`）。2 つめのパネルは出さない（D-128.66）。

### 読み込み中
枠と見出し（帯）を先に描き、中身の所は空けておく。**3 秒たっても終わらないときだけ**「読み込んでいます…」の文を出す（すぐ読めるときにちらつかせない・キャンバスの OnLoading・D-144.8）。

### AI の印（D-128.16）
ロボットの線の絵 ＋「高本のAI」のように名前つき。AI に任せていることは担当者の横に札で出す（実行者の欄は持たない・D-128.26）。

### Chat（自分のAIとの会話・D-104）
会話を出す 5 か所（会話モード・右パネル・はじめの設定の聞き取り・たたき台・AI社員とのやりとり）は全部この部品。落ち着いた道具の空気（余白広め・色は最小・状態だけ色）。

- **吹き出し**：自分は `chat-bubble-me`（淡い灰の面・右寄せ）、AI は `chat-bubble-ai`（白い面＋罫線 1 本）。名前の横はアイコン＋名前（「高本AI」・AI社員の名前）。AI の文は 40 字前後で折り返し、**表・図・コード・カードだけ会話の幅いっぱい**まで広げる
- **作業中**：吹き出しを出さず `chat-work-line`（枠なし・`on-surface-variant`・14px）で「〇〇を調べています…」・手順（済は `st-success` の印）・経過時間・道具の行。終わると「N つの操作・時間」の 1 行に畳む
- **入力欄**：`chat-composer`（下に固定の角丸 20px の箱）。上に文脈と添付の `chat-chip`、下の列に ＋・マイク・モデル・使うもの・許可のモード・送る（動いている間は止める）
- **書式**：コードは `code-block`（字の色は `syntax` の値だけ）、注意の帯は `callout-info／warn／danger`（状態の淡い面）、キー表示は `kbd`、蛍光ペンは `colors.mark`。差分の行は `success-container`／`danger-container`、数式はブラウザの MathML で描く（書体を増やさない）
- 図（流れ図・順序図）・進み具合・予定の流れは既存のデータ色と状態色だけで描く。新しい色は `mark` と、既存値の再利用の `syntax` だけ

## 言葉の決まり（画面に出す呼び方）

| 呼び方 | 使わない言い方 | 根拠 |
|---|---|---|
| ワークスペース | 会社・テナント（画面では） | D-128.46 |
| ワークスペースの管理 | 会社の設定・管理画面 | D-128.48 |
| メンバー | 人・ユーザー | D-128.48 |
| マネージャー | 長・部長・課長 | 決定ログの決まり |
| 担当者 | 責任者・実行者 | D-128.25・.26 |
| 分身／「高本のAI」 | 自分の AI・AI社員 | D-128.38 |
| 記録 | 証跡・ログ（顧客の画面） | D-128.47 |
| 業務の型・操作 | スキル | D-126 |
| 決まり | マスタ・ルール（顧客の画面） | D-128.48 |

文字は画面に直に書かず、あとで言語を足せるようにしておく（`04_design/多言語に備える決まり.md`）。

## Do's and Don'ts

### Do's
- **表の数値列には必ず `text-align: right` を指定する**。桁を縦に揃えているのはこれ（`tabular-nums` は保険）
- **数値を別書体で組まない**。文中の数字が浮く
- **状態は色 ＋ アイコン ＋ テキストの 3 点セット**で示す
- **データ色には必ずラベルを添える**。色だけで部署を識別させない
- **AI 由来のものは Tertiary で明示する**。人が決めたものと混同させない
- スペーシングは必ず `spacing` トークンを使う
- コンポーネントはトークン参照 `{colors.primary}` を使い、直接 hex を書かない
- スマホ幅で機能が落ちていないか、**横スクロール量を数値で測る**

### Don'ts
- **状態色とデータ色を同じ扱いで使わない**（データ色を塗りに使わない）
- **Primary を装飾目的で多用しない**。1 画面 1 つ
- **影で階層を作らない**。罫線と余白で出す
- **絵文字を使わない**。アイコンは Lucide で統一する
- タイポグラフィスケールの段の間の大きさ（17・19・21px など）を使わない
- `surface` 上に `surface-variant` を重ねてコントラストを下げない
- 数値を本文フォント（プロポーショナル）で組まない


---

## 根拠となる決定（トレーサビリティ）

> 正本は `01_hearing/決定ログ_進行中.md`。検査: `python3 scripts/ci/trace_gate.py`

| 決定 | 何を決めたか | この文書のどこに効いているか |
|---|---|---|
| D-052 | デザインシステム確定。Primary #22345C・M PLUS 2 単一書体・色の二層分離（状態色は面／データ色は点と線）・影より罫線・数値列は右寄せ | 全体 |
| D-023 | ロゴ＝バラバラの色（業務／ツール／メンバー）がひとつの中心（かなめ）に留められる。データ色6色の根拠 | Colors（データ色 6色） |
| D-011 | 製品名は Kaname。表記はこれだけ（D-011.4） | name / Overview |
| D-053 | 画面は行為から導出する。デザインシステムは画面数・種類に依存しない | Components（1画面1主アクションの階層） |
| D-070 | 本文は幅 1180 以上で 720px を下回らない | Layout（Grid） |
| D-071 | 本文 15px・見出し 24/20/18・1px の箱を並べず罫線 1 本と余白で段を区切る | Typography / Elevation |
| D-072 | 手本は Linear / Notion。三画面（一覧｜中身｜自分のAI）。サイドバーは中間色 `#EEF0F4`＋罫線、選択中は白い面。三画面の画面ではレール 72px | Layout（Grid）/ Colors（Surface）/ Components（Sidebar） |
| D-073 | 役割ごとに中身が変わる（担当者・閲覧のみ・運営も自分の画面を持つ）。錠前だけの画面は作らない | Components（`data-roles` の塊。トークン追加なし。錠前の空状態は既存の empty） |
| D-074 | 抜ける・退会の依存を全オブジェクトで見せる | Components（依存の表は既存の表・札の色 4 種：消える／残る／移る／止まる） |
| D-075 | 問い合わせ・お知らせ・稼働状況・請求 | Components（状態の点＝既存の st-success／warning／danger。トークン追加なし） |
| D-076 | アカウント・会社の設定・取り込み・外部サービス | Components（フォーム・落とす箱・カードの縁色は既存トークン。追加なし） |
| D-128 | デザインの決め直し（Backlog を土台・Noto Sans JP・1 行 36px／本文 13px・左のバーと上の帯・2 つめのパネル・選んでいるもの・空のとき・運営の場所・言葉の決まり・値の段の整理 D-128.75） | Typography / Layout / Elevation / Shapes / Components / 言葉の決まり / front matter |
| D-077 | 運営の対応は会社の 1 社（8 面）の中で | Layout（第2ナビの段 `data-sec` で 8 面。トークン追加なし） |

> 2026-09-15 凍結時の確認：D-073〜D-077 で新しい色・書体・間隔・角丸は増えていない（新画面は既存トークンと画面内 CSS だけで描けた）。

## 決めたことの文の反映（機械追記）
- D-011.1 製品名
- D-011.2 由来と Hub の一致
- D-023.1 ロゴのコンセプト
- D-052.1 色
- D-052.2 色の二層分離
- D-052.3 コントラスト
- D-052.4 書体
- D-052.5 数値の組み方
- D-052.6 分数表記の禁止
- D-052.7 形
- D-052.8 アイコン
| D-104 | 自分のAIとの会話の作り込み（吹き出し・作業中の行・入力欄の箱・書式・コード・注意の帯・キー表示・蛍光ペン） | Components（`chat-*`・`code-block`・`callout-*`・`kbd`）・colors.mark・syntax |
| D-105 | 記憶の毎朝のまとめ（今日の一番上の帯・結果の群・前と後・食い違いの束） | Components（新しいトークンなし。既存の card・line・tertiary・状態の淡い面だけ） |
| D-079 | 目標と施策のタイムラインは svar-gantt。棒＝期間・線＝前後関係・ひし形＝検証。棒を押すと右に詳細。1023 以下は切り替え | Components（タイムライン：棒は primary-container、進みは primary、検証のひし形は tertiary。詳細パネルは card と同じ縁と角丸） |
