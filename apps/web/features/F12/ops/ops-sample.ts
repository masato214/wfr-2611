// 運営の見本の値（段 13・領域 ops）。本物らしい日本語。値段は仮（無料 ¥0・チーム ¥15,000・ビジネス ¥40,000）。モックと部品の見本で同じ値を使う
export type Care = "stuck" | "overdue" | "pc" | "limit" | "none";
export interface WsRow {
  id: string;
  name: string;
  admin: string;
  plan: "無料" | "チーム" | "ビジネス";
  people: string;
  pc: string;
  runs: string;
  care: string;
  bill: string;
  status: string;
  /** 状態の札の色 */
  tone: "success" | "warning" | "danger" | "neutral";
}

export const WS_ROWS: readonly WsRow[] = [
  {
    id: "minato",
    name: "合同会社ミナト企画",
    admin: "管理者 湊 さくら",
    plan: "チーム",
    people: "8 / 10",
    pc: "6 / 8",
    runs: "1,284",
    care: "止まった実行 3",
    bill: "払われた",
    status: "使っている",
    tone: "success",
  },
  {
    id: "kitamura",
    name: "北村デザイン事務所",
    admin: "管理者 北村 透",
    plan: "チーム",
    people: "4 / 10",
    pc: "4 / 4",
    runs: "512",
    care: "—",
    bill: "期限を過ぎた 9 日",
    status: "使っている",
    tone: "success",
  },
  {
    id: "oota",
    name: "株式会社オオタ物流",
    admin: "管理者 太田 誠",
    plan: "ビジネス",
    people: "27 / 30",
    pc: "19 / 27",
    runs: "6,930",
    care: "—",
    bill: "払われた",
    status: "使っている",
    tone: "success",
  },
  {
    id: "yamada",
    name: "山田工務店",
    admin: "管理者 山田 健二",
    plan: "無料",
    people: "2 / 3",
    pc: "0 / 2",
    runs: "0",
    care: "PC がまだ 14 日",
    bill: "—",
    status: "使っている",
    tone: "success",
  },
  {
    id: "sakura",
    name: "株式会社サクラ会計",
    admin: "管理者 桜井 恵子",
    plan: "ビジネス",
    people: "22 / 30",
    pc: "20 / 22",
    runs: "8,115",
    care: "—",
    bill: "払われた",
    status: "使っている",
    tone: "success",
  },
  {
    id: "enginebase",
    name: "株式会社ENGINE BASE",
    admin: "管理者 高本 聖斗",
    plan: "チーム",
    people: "5 / 10",
    pc: "5 / 5",
    runs: "2,040",
    care: "—",
    bill: "払われた",
    status: "使っている",
    tone: "success",
  },
  {
    id: "haru",
    name: "株式会社ハル製作所",
    admin: "管理者 春日 亮",
    plan: "チーム",
    people: "6 / 10",
    pc: "—",
    runs: "—",
    care: "—",
    bill: "未入金 2 か月",
    status: "止めている（10/20〜）",
    tone: "danger",
  },
  {
    id: "sasaki",
    name: "佐々木 恵",
    admin: "個人",
    plan: "無料",
    people: "1 / 3",
    pc: "1 / 1",
    runs: "86",
    care: "—",
    bill: "—",
    status: "やめる手続き中（あと 12 日）",
    tone: "warning",
  },
];

export interface PwnedRow {
  at: string;
  ws: string;
  person: string;
}
export const PWNED_ROWS: readonly PwnedRow[] = [
  { at: "11/01 14:22", ws: "山田工務店", person: "山田 健二" },
  { at: "11/01 09:05", ws: "佐々木 恵", person: "佐々木 恵" },
  { at: "10/31 18:47", ws: "北村デザイン事務所", person: "北村 透" },
  /** 登録を確定しないまま去った申し込み（まとめて 1 行・D-156.69） */
  { at: "10/30 22:14", ws: "（登録はまだ確定していません）", person: "—" },
];

export const MEMBERS = [
  {
    initial: "湊",
    name: "湊 さくら",
    mail: "minato@minato-kikaku.example",
    role: "管理者",
    last: "11/02 09:31",
    pc: "つながっている",
    login: "パスキー",
  },
  {
    initial: "吉",
    name: "吉田 健",
    mail: "yoshida@…",
    role: "マネージャー",
    last: "11/02 08:50",
    pc: "つながっている",
    login: "パスキー",
  },
  {
    initial: "山",
    name: "山本 由美",
    mail: "yamamoto@…",
    role: "メンバー",
    last: "10/30 18:02",
    pc: "まだつないでいない",
    login: "パスワード＋2 段階",
  },
  {
    initial: "木",
    name: "木下 翔",
    mail: "kinoshita@…",
    role: "メンバー",
    last: "10/12 10:15",
    pc: "まだつないでいない",
    login: "パスワード＋2 段階",
  },
  {
    initial: "小",
    name: "小池 真理",
    mail: "koike@…",
    role: "閲覧のみ",
    last: "11/01 13:40",
    pc: "—（分身なし）",
    login: "パスキー",
  },
] as const;

/** 1 社の情報（getOpsWorkspace が返す物だけ：名前・管理者・プラン・状態） */
export const WS_INFO: readonly (readonly [string, string])[] = [
  ["名前", "合同会社ミナト企画"],
  ["管理者", "湊 さくら"],
  ["プラン", "チーム"],
  ["状態", "使っている"],
];

/** 止める理由（値は契約の reason_key・字は顧客の画面に出す字と同じ） */
export const STOP_REASONS = [
  { value: "unpaid", label: "請求が払われない" },
  { value: "violation", label: "規約に反する" },
  { value: "danger", label: "危ない使い方をしている" },
  { value: "request", label: "管理者から頼まれた" },
] as const;

export interface TeamPerson {
  initial: string;
  name: string;
  role: string;
  caps: readonly boolean[];
}
export const CAP_LABELS = [
  "問い合わせ",
  "中を見る",
  "お金",
  "止める",
  "お知らせ",
  "配るもの",
  "値段の案",
  "値段を決める",
  "運営の人",
] as const;
export const TEAM: readonly TeamPerson[] = [
  {
    initial: "高",
    name: "高本 聖斗",
    role: "運営の管理者",
    caps: [true, true, true, true, true, true, true, true, true],
  },
  {
    initial: "佐",
    name: "佐野 美穂",
    role: "サポート",
    caps: [true, true, true, false, true, false, true, false, false],
  },
  {
    initial: "木",
    name: "木村 直人",
    role: "お金",
    caps: [false, false, true, false, false, false, true, false, false],
  },
];
