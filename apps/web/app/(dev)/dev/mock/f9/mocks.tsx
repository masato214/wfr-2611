"use client";
// 段 10（F9）の下絵の状態の一覧（正の絵・2026-11-21 の代表とのすり合わせ）。やりたいことは 1 つ：
//   AI がチケットを不備なく進められるよう、会社・グループ・個人のナレッジを貯めて、AI が読んで守る。
//   1 つの id ＝ 1 つの状態。このファイルは一覧（データ）だけ。描くのは render-knowledge.tsx（K-670）・render-admin.tsx（K-671）・
//   ticket-mocks.tsx・ws-mocks.tsx（K-672）。持ち主の葉がまだ入っていない状態は、頁が「この状態はまだありません」を出す。
//   状態の並びは { id, no, screen, label, ticket, leaf } の順と引用符を崩さない（機械が読む）。
//   no は下絵の頁の番号（まとまり-枝）。持ち主（ticket・leaf）は切り方 1 章の画面の葉

export interface MockEntry {
  id: string;
  /** 下絵の頁の番号（まとまり-枝） */
  no: string;
  screen: "knowledge" | "tickets" | "masters" | "members";
  label: string;
  ticket: string;
  leaf: string;
}

export const MOCKS: readonly MockEntry[] = [
  {
    id: "kn-tree",
    no: "1",
    screen: "knowledge",
    label: "ナレッジ：木とページ（会社・グループ・自分の棚）",
    ticket: "K-682",
    leaf: "K-682",
  },
  {
    id: "kn-write",
    no: "2",
    screen: "knowledge",
    label: "ナレッジ：ページを書いている（題名・1 行の説明・本文）",
    ticket: "K-683",
    leaf: "K-683",
  },
  { id: "kn-must", no: "3-1", screen: "knowledge", label: "必ず守る：付けた所", ticket: "K-691", leaf: "K-691" },
  {
    id: "kn-must-full",
    no: "3-2",
    screen: "knowledge",
    label: "必ず守る：上限に届いた",
    ticket: "K-691",
    leaf: "K-691",
  },
  { id: "kn-raise", no: "4-1", screen: "knowledge", label: "上の棚に上げる：頼む小窓", ticket: "K-692", leaf: "K-692" },
  {
    id: "kn-raise-waiting",
    no: "4-2",
    screen: "knowledge",
    label: "上の棚に上げる：承認待ち",
    ticket: "K-692",
    leaf: "K-692",
  },
  {
    id: "kn-raise-declined",
    no: "4-3",
    screen: "knowledge",
    label: "上の棚に上げる：断られた（理由つき）",
    ticket: "K-692",
    leaf: "K-692",
  },
  { id: "kn-approvals", no: "5", screen: "knowledge", label: "管理：承認する側の一覧", ticket: "K-694", leaf: "K-694" },
  {
    id: "kn-share",
    no: "6-1",
    screen: "knowledge",
    label: "グループを選んで共有：選ぶ小窓",
    ticket: "K-693",
    leaf: "K-693",
  },
  {
    id: "kn-shared-view",
    no: "6-2",
    screen: "knowledge",
    label: "グループを選んで共有：共有された側の見え方",
    ticket: "K-693",
    leaf: "K-693",
  },
  { id: "kn-copy", no: "7", screen: "knowledge", label: "写して直す：自分の棚の写し", ticket: "K-693", leaf: "K-693" },
  { id: "kn-similar", no: "8", screen: "knowledge", label: "似たページが出た所", ticket: "K-691", leaf: "K-691" },
  {
    id: "kn-review",
    no: "9",
    screen: "knowledge",
    label: "管理：見直すページ（使われていない・食い違い・よく破られる）",
    ticket: "K-696",
    leaf: "K-696",
  },
  { id: "kn-empty", no: "10-1", screen: "knowledge", label: "まだ 1 枚も無い", ticket: "K-682", leaf: "K-682" },
  { id: "kn-loading", no: "10-2", screen: "knowledge", label: "読み込み中", ticket: "K-682", leaf: "K-682" },
  { id: "kn-failed", no: "10-3", screen: "knowledge", label: "読めなかった", ticket: "K-682", leaf: "K-682" },
  {
    id: "kn-noaccess",
    no: "10-4",
    screen: "knowledge",
    label: "見られないページを開いた",
    ticket: "K-682",
    leaf: "K-682",
  },
  { id: "kn-drawer", no: "11", screen: "knowledge", label: "狭い幅：木は引き出し", ticket: "K-682", leaf: "K-682" },
  // 下の 5 つは下絵 v2 に無かった状態（代表がまだ見ていない絵・字は仮）。木の操作と「…」メニュー（K-684）
  {
    id: "kn-more",
    no: "1-2",
    screen: "knowledge",
    label: "ページの「…」メニューを開いた形（前の版・リンク・動かす・消す）",
    ticket: "K-684",
    leaf: "K-684",
  },
  {
    id: "kn-add",
    no: "1-3",
    screen: "knowledge",
    label: "木の「＋」を押した形（ページかフォルダを足す）",
    ticket: "K-684",
    leaf: "K-684",
  },
  {
    id: "kn-move",
    no: "1-4",
    screen: "knowledge",
    label: "別のフォルダへ動かす小窓",
    ticket: "K-684",
    leaf: "K-684",
  },
  {
    id: "kn-delete",
    no: "1-5",
    screen: "knowledge",
    label: "ページを消す確かめの小窓",
    ticket: "K-684",
    leaf: "K-684",
  },
  {
    id: "kn-versions",
    no: "1-6",
    screen: "knowledge",
    label: "前の版を見る小窓（読むだけ）",
    ticket: "K-684",
    leaf: "K-684",
  },
  {
    id: "tk-guard",
    no: "12",
    screen: "tickets",
    label: "チケット：始める前の「このチケットで守る物」",
    ticket: "K-702",
    leaf: "K-702",
  },
  {
    id: "tk-opened",
    no: "13",
    screen: "tickets",
    label: "チケット：AI が開いたページがやり取りに残る",
    ticket: "K-702",
    leaf: "K-702",
  },
  {
    id: "tk-blocked",
    no: "14",
    screen: "tickets",
    label: "チケット：必ず守る物が付くまで完了に進めない",
    ticket: "K-703",
    leaf: "K-703",
  },
  {
    id: "set-kinds",
    no: "15",
    screen: "masters",
    label: "設定：種別（名前・色・本文のひな形）",
    ticket: "K-707",
    leaf: "K-707",
  },
  {
    id: "set-stages",
    no: "16",
    screen: "masters",
    label: "設定：状態（名前・色・並び）",
    ticket: "K-708",
    leaf: "K-708",
  },
  {
    id: "set-fields",
    no: "17",
    screen: "masters",
    label: "設定：項目（会社が足す項目）",
    ticket: "K-709",
    leaf: "K-709",
  },
  // 下の 2 つは下絵 v2 に無かった状態（代表がまだ見ていない絵・字は仮）。項目を足す・消す（K-720）
  {
    id: "set-field-add",
    no: "17-2",
    screen: "masters",
    label: "設定：項目を足す小窓",
    ticket: "K-720",
    leaf: "K-720",
  },
  {
    id: "set-field-delete",
    no: "17-3",
    screen: "masters",
    label: "設定：項目を消す確かめの小窓（値が見えなくなる）",
    ticket: "K-720",
    leaf: "K-720",
  },
  {
    id: "mem-groups",
    no: "18",
    screen: "members",
    label: "メンバー：グループごと → グループを押すとメンバー",
    ticket: "K-710",
    leaf: "K-710",
  },
];
