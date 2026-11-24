// 段 13（F12 運営とのやり取り・運営が回す）の領域 ops の下絵のモック：ワークスペースの一覧・1 社・運営の人（部品先行・枝 c/段13）。
//   本番と同じ部品（features/F12/ops/・components/k）を、決めた値で並べる。1 つの id ＝ 1 つの状態。
//   ticket・leaf は持ち主の画面の葉（切り方 1 章）。絵は代表の答え 2026-11-23（D-156.20〜36）の形
export interface MockEntry {
  id: string;
  /** 下絵の番号（段 13 の下絵の表の no） */
  no: string;
  screen: "ops-home" | "ops-tenant" | "ops-team";
  label: string;
  ticket: string;
  leaf: string;
}

export const MOCKS: readonly MockEntry[] = [
  {
    id: "op-list",
    no: "7-1",
    screen: "ops-home",
    label: "ワークスペースの一覧（上の数・気にかけるを上に・探す）",
    ticket: "K-965",
    leaf: "K-965",
  },
  { id: "op-list-empty", no: "7-2", screen: "ops-home", label: "一覧：探して 0 件", ticket: "K-965", leaf: "K-965" },
  {
    id: "op-list-pwned",
    no: "7-3",
    screen: "ops-home",
    label: "一覧の上に「パスワードの照合が使えなかった登録 4 件」の帯",
    ticket: "K-1019",
    leaf: "K-1019",
  },
  {
    id: "op-pwned",
    no: "7-4",
    screen: "ops-home",
    label: "その一覧の小窓（日時・ワークスペース・人・確かめた・確定しなかった申し込みは 1 行）",
    ticket: "K-1019",
    leaf: "K-1019",
  },
  { id: "op-ws", no: "8-1", screen: "ops-tenant", label: "1 社：いまの状態のタブ", ticket: "K-971", leaf: "K-971" },
  {
    id: "op-ws-members",
    no: "8-2",
    screen: "ops-tenant",
    label: "1 社：メンバーのタブ（本人確認のメールを送り直す）",
    ticket: "K-971",
    leaf: "K-971",
  },
  {
    id: "op-ws-billing",
    no: "8-3",
    screen: "ops-tenant",
    label: "1 社：プランと請求のタブ",
    ticket: "K-971",
    leaf: "K-971",
  },
  {
    id: "op-ws-inquiries",
    no: "8-4",
    screen: "ops-tenant",
    label: "1 社：問い合わせのタブ",
    ticket: "K-971",
    leaf: "K-971",
  },
  {
    id: "op-ws-log",
    no: "8-5",
    screen: "ops-tenant",
    label: "1 社：記録のタブ（消せない）",
    ticket: "K-971",
    leaf: "K-971",
  },
  {
    id: "op-peek",
    no: "8-6",
    screen: "ops-tenant",
    label: "中を見る小窓（理由・1 時間・見るだけ・本人確認）",
    ticket: "K-972",
    leaf: "K-972",
  },
  {
    id: "op-peek-open",
    no: "8-7",
    screen: "ops-tenant",
    label: "中を見ている間（残り時間・閉じる）",
    ticket: "K-972",
    leaf: "K-972",
  },
  {
    id: "op-stop",
    no: "8-8",
    screen: "ops-tenant",
    label: "止める小窓（先に知らせて日を決める・すぐ止める）",
    ticket: "K-972",
    leaf: "K-972",
  },
  {
    id: "op-stopped",
    no: "8-9",
    screen: "ops-tenant",
    label: "止めている 1 社（再開する・止めた理由と日）",
    ticket: "K-972",
    leaf: "K-972",
  },
  {
    id: "op-ws-notice",
    no: "8-10",
    screen: "ops-tenant",
    label: "1 社にお知らせを送る小窓",
    ticket: "K-972",
    leaf: "K-972",
  },
  {
    id: "op-ws-nocap",
    no: "8-11",
    screen: "ops-tenant",
    label: "できることが無いタブを開いた（この権限では見えない）",
    ticket: "K-971",
    leaf: "K-971",
  },
  {
    id: "op-team",
    no: "9-1",
    screen: "ops-team",
    label: "運営の人の一覧（できることの印・パスキー）",
    ticket: "K-986",
    leaf: "K-986",
  },
  { id: "op-team-add", no: "9-2", screen: "ops-team", label: "運営の人を足す小窓", ticket: "K-986", leaf: "K-986" },
  {
    id: "op-team-edit",
    no: "9-3",
    screen: "ops-team",
    label: "できることを変える（自分のは変えられない・最後の 1 人は外せない）",
    ticket: "K-986",
    leaf: "K-986",
  },
  {
    id: "op-team-remove",
    no: "9-4",
    screen: "ops-team",
    label: "運営の人を外す確かめ",
    ticket: "K-986",
    leaf: "K-986",
  },
  {
    id: "op-login",
    no: "9-5",
    screen: "ops-team",
    label: "運営のログイン（パスキーで入る）",
    ticket: "K-946",
    leaf: "K-946",
  },
];
