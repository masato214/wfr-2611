// ナレッジの下絵の見本の値（木・ページの本文・一覧）。画面に出る字は全部「仮」
import type {
  Block,
  BlockquoteNode,
  BulletListNode,
  Doc,
  HeadingNode,
  Inline,
  ListItemNode,
  OrderedListNode,
  ParagraphNode,
  TableNode,
  TextNode,
} from "@kaname/contracts";
import type {
  ApprovalItem,
  BrokenRow,
  ConflictRow,
  PageBrief,
  PageMark,
  PagePlace,
  TreeData,
  TreeGroup,
  TreeNode,
  UnusedRow,
} from "./types";

export type Viewer = "taka" | "sato" | "suzu" | "tana";

// ---------------------------------------------------------------- 木
const COMPANY: readonly TreeNode[] = [
  {
    kind: "folder",
    id: "f-keiri",
    name: "経理",
    open: true,
    children: [
      { kind: "page", id: "p-invoice", title: "請求書の送り方", must: true },
      { kind: "page", id: "p-expense", title: "経費の精算" },
    ],
  },
  { kind: "folder", id: "f-cs", name: "お客さま対応", children: [] },
  { kind: "page", id: "p-mail", title: "メールの書き方", must: true },
  { kind: "page", id: "p-outbound", title: "外に出す前の確かめ", must: true },
];
const SALES: readonly TreeNode[] = [
  {
    kind: "folder",
    id: "f-quote",
    name: "見積もり",
    open: true,
    children: [
      { kind: "page", id: "p-quote", title: "見積書の出し方" },
      { kind: "page", id: "p-discount", title: "値引きの決まり", must: true },
    ],
  },
  { kind: "page", id: "p-visit", title: "初回の訪問の流れ" },
];
const DEV: readonly TreeNode[] = [
  { kind: "page", id: "p-delivery", title: "納品の前の確かめ", must: true },
  { kind: "page", id: "p-dev", title: "開発の進め方" },
];
const DEV_SHARED: readonly TreeNode[] = [{ kind: "page", id: "p-delivery", title: "納品の前の確かめ", must: true }];
const SALES_SHARED: readonly TreeNode[] = [
  {
    kind: "folder",
    id: "f-quote",
    name: "見積もり",
    open: true,
    children: [{ kind: "page", id: "p-quote", title: "見積書の出し方" }],
  },
];
const D_SALES: TreeGroup = { code: "EG", name: "営業", tone: "teal", nodes: SALES };
const D_DEV_SHARED: TreeGroup = { code: "JD", name: "受託開発", tone: "plum", shared: true, nodes: DEV_SHARED };

const MY: Record<Viewer, readonly TreeNode[]> = {
  taka: [{ kind: "page", id: "p-memo", title: "商談の前に見るメモ" }],
  sato: [{ kind: "page", id: "p-sato-memo", title: "月初にやること" }],
  suzu: [
    { kind: "page", id: "p-my-discount", title: "値引きを頼まれたときの返し方" },
    { kind: "page", id: "p-invoice-copy", title: "請求書の送り方（自分用）", mark: "copy" },
  ],
  tana: [{ kind: "page", id: "p-tana-memo", title: "見積もりを頼むときのメモ" }],
};

export interface TreeOptions {
  /** ページの印を上書きする（id → 印） */
  marks?: Readonly<Record<string, PageMark>>;
  /** 「必ず守る」を足すページ */
  must?: readonly string[];
  /** 自分の棚の先頭に足すページ（書いている途中の新しいページ） */
  myExtra?: { id: string; title: string };
  /** 1 枚も無い会社 */
  empty?: boolean;
}

function apply(nodes: readonly TreeNode[], o: TreeOptions): TreeNode[] {
  return nodes.map((n) =>
    n.kind === "folder"
      ? { ...n, children: apply(n.children, o) }
      : {
          ...n,
          ...(o.must?.includes(n.id) ? { must: true } : {}),
          ...(o.marks?.[n.id] ? { mark: o.marks[n.id] } : {}),
        },
  );
}

/** 見ている人ごとの木（会社は全員同じ・グループは入っているグループと共有された物・自分は本人だけ） */
export function treeFor(viewer: Viewer, o: TreeOptions = {}): TreeData {
  if (o.empty) {
    return {
      company: "ENGINE BASE",
      companyNodes: [],
      groups: [{ code: "EG", name: "営業", tone: "teal", nodes: [] }],
      myNodes: [],
      canWrite: { company: viewer === "taka", group: [], me: true },
    };
  }
  const groups: readonly TreeGroup[] =
    viewer === "tana"
      ? [
          { code: "JD", name: "受託開発", tone: "plum", nodes: DEV },
          { code: "EG", name: "営業", tone: "teal", shared: true, nodes: SALES_SHARED },
        ]
      : [D_SALES, D_DEV_SHARED];
  const mine: readonly TreeNode[] = o.myExtra ? [{ kind: "page", ...o.myExtra }, ...MY[viewer]] : MY[viewer];
  return {
    company: "ENGINE BASE",
    companyNodes: apply(COMPANY, o),
    groups: groups.map((d) => ({ ...d, nodes: apply(d.nodes, o) })),
    myNodes: apply(mine, o),
    canWrite: { company: viewer === "taka", group: viewer === "sato" ? ["EG"] : [], me: true },
  };
}

// ---------------------------------------------------------------- ページの置き場
export const PLACE = {
  invoice: { shelf: "company", shelfName: "会社", folders: ["経理"] },
  expense: { shelf: "company", shelfName: "会社", folders: ["経理"] },
  quote: { shelf: "group", shelfName: "営業", folders: ["見積もり"] },
  mine: { shelf: "me", shelfName: "自分", folders: [] },
} as const satisfies Record<string, PagePlace>;

// ---------------------------------------------------------------- ページの本文（段 5 の文書の木 Doc の値・validateDoc が通す形だけ）
type Inl = Inline | string;
const inl = (x: Inl): Inline => (typeof x === "string" ? { type: "text", text: x } : x);
const b = (text: string): TextNode => ({ type: "text", text, marks: [{ type: "bold" }] });
const code = (text: string): TextNode => ({ type: "text", text, marks: [{ type: "code" }] });
const red = (text: string): TextNode => ({ type: "text", text, marks: [{ type: "color", attrs: { color: "red" } }] });
const hl = (text: string): TextNode => ({ type: "text", text, marks: [{ type: "highlight" }] });
const p = (...xs: Inl[]): ParagraphNode => ({ type: "paragraph", content: xs.map(inl) });
const h2 = (text: string): HeadingNode => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const li = (...xs: Inl[]): ListItemNode => ({ type: "listItem", content: [p(...xs)] });
const ul = (...items: ListItemNode[]): BulletListNode => ({ type: "bulletList", content: items });
const ol = (...items: ListItemNode[]): OrderedListNode => ({ type: "orderedList", content: items });
const quote = (text: string): BlockquoteNode => ({ type: "blockquote", content: [p(text)] });
const table = (head: readonly string[], rows: readonly (readonly string[])[]): TableNode => ({
  type: "table",
  content: [
    { type: "tableRow", content: head.map((c) => ({ type: "tableHeader" as const, content: [p(c)] })) },
    ...rows.map((r) => ({
      type: "tableRow" as const,
      content: r.map((c) => ({ type: "tableCell" as const, content: [p(c)] })),
    })),
  ],
});
const doc = (...content: Block[]): Doc => ({ type: "doc", content });

export const INVOICE = {
  title: "請求書の送り方",
  desc: "請求書を取引先に送る前に確かめることと、送り方の順番。",
  foot: "最後に直した：高本 聖斗 11/18 ・ 版 4 ・ AI がこの 30 日に開いた：12 回",
} as const;

export const INVOICE_DOC: Doc = doc(
  h2("送る前に確かめること"),
  ul(
    li("宛先が、取引先に登録してある経理の連絡先と合っている"),
    li("金額が、見積もりか契約の額と合っている"),
    li("支払期日が入っている（決まりは", b("月末締め・翌月末払い"), "）"),
  ),
  h2("送り方"),
  ol(
    li("請求書は PDF にする。ファイル名は ", code("請求書_取引先名_2026-11.pdf")),
    li("メールの件名は「【請求書】11 月分（ENGINE BASE）」"),
    li("CC に経理（keiri@engine-base.example）を入れる"),
  ),
  h2("取引先ごとの違い"),
  table(
    ["取引先", "締め", "送り先"],
    [
      ["セイコー商事", "月末", "経理の山田様"],
      ["ミナト工業", "20 日", "請求の窓口のアドレス"],
    ],
  ),
  h2("してはいけないこと"),
  ul(li(red("金額を確かめる前に送らない")), li("取引先の担当者の、個人のアドレスに送らない")),
  quote("迷ったら、送る前に経理（佐藤）に聞く。"),
);

export const EXPENSE = {
  title: "経費の精算",
  desc: "立て替えた経費を月末までに精算するときの、出し方と上限。",
  foot: "最後に直した：高本 聖斗 11/20 ・ 版 2 ・ AI がこの 30 日に開いた：3 回",
} as const;

export const EXPENSE_DOC: Doc = doc(
  h2("出し方"),
  ul(
    li("領収書の写真を付けて、月末までに「経費の精算」のチケットを作る"),
    li("1 件 3 万円を超えるときは、使う前にマネージャーに聞く"),
  ),
  h2("精算できないもの"),
  ul(li("領収書の無いもの"), li("2 か月より前のもの")),
);

export const MY_DISCOUNT = {
  title: "値引きを頼まれたときの返し方",
  desc: "お客さまから値引きを頼まれたとき、その場で返してよい範囲と、持ち帰る範囲。",
  foot: "最後に直した：鈴木 一郎 11/21 ・ 版 3 ・ AI がこの 30 日に開いた：5 回",
} as const;

const MY_DISCOUNT_BLOCKS: readonly Block[] = [
  h2("その場で返してよい範囲"),
  ul(li("5% までは、その場で「できます」と返してよい"), li("端数を切るだけ（千円未満）は、値引きに数えない")),
  h2("持ち帰る範囲"),
  p("5% を超えるときは「社内で確かめて、明日までに返事をします」と伝え、", hl("佐藤さんに聞いてから"), "返す。"),
];

export const MY_DISCOUNT_DOC: Doc = doc(
  ...MY_DISCOUNT_BLOCKS,
  quote("値引きの代わりに、納期を延ばす・範囲を減らす案を先に出す。"),
);
/** 書いている途中の本文（終わりの引用はまだ書いていない） */
export const MY_DISCOUNT_DRAFT_DOC: Doc = doc(...MY_DISCOUNT_BLOCKS);

export const QUOTE = {
  title: "見積書の出し方",
  desc: "見積書を作ってお客さまに出すまでの順番と、有効期限の決まり。",
  foot: "最後に直した：佐藤 花子 11/15 ・ 版 6 ・ AI がこの 30 日に開いた：21 回",
} as const;

export const QUOTE_DOC: Doc = doc(
  h2("順番"),
  ol(
    li("ひな形（営業 › 見積もり）から作る"),
    li("金額は、単価の表（会社 › 経理）の額を使う"),
    li("出す前に、マネージャーの承認をもらう"),
  ),
  h2("決まり"),
  ul(li("有効期限は、出した日から 30 日"), li("消費税は別に書く")),
);

// ---------------------------------------------------------------- 小窓・一覧の値
/** 会社の棚で「必ず守る」が付いているページ（上限（30）に届いた形・並べるのは読める量だけで、数は MustFullDialog の count で渡す） */
export const MUST_COMPANY: readonly { id: string; title: string; folder: string }[] = [
  ["請求書の送り方", "経理"],
  ["メールの書き方", "会社"],
  ["外に出す前の確かめ", "会社"],
  ["個人の情報の扱い", "会社"],
  ["取引先の名前の書き方", "お客さま対応"],
  ["お詫びのメールの決まり", "お客さま対応"],
  ["問い合わせへの最初の返事", "お客さま対応"],
  ["契約書を送る前の確かめ", "法務"],
  ["秘密を守る約束のある取引先", "法務"],
  ["値引きの上限", "経理"],
  ["支払いの期日の決まり", "経理"],
  ["休みの日の連絡", "会社"],
  ["ファイルの名前の付け方", "会社"],
  ["外の人に見せてよい資料", "会社"],
  ["AI に任せてはいけないこと", "会社"],
].map(([title, folder], i) => ({
  id: `m${i}`,
  title: title!,
  folder: folder === "会社" ? "会社" : `会社 › ${folder}`,
}));

export const SIMILAR: readonly PageBrief[] = [
  {
    id: "p-invoice",
    title: "請求書の送り方",
    place: "会社 › 経理",
    desc: "請求書を取引先に送る前に確かめることと、送り方の順番。",
  },
  {
    id: "p-payday",
    title: "支払いの期日の決まり",
    place: "会社 › 経理",
    desc: "取引先ごとの締め日と、支払期日の決め方。",
  },
];

export const APPROVALS: readonly ApprovalItem[] = [
  {
    id: "a1",
    kind: "raise",
    from: "鈴木 一郎",
    fromShelf: "鈴木さんの「自分」",
    toShelf: "営業",
    title: "値引きを頼まれたときの返し方",
    desc: "お客さまから値引きを頼まれたとき、その場で返してよい範囲と、持ち帰る範囲。",
    message: "新しく入った人にも同じ返し方をしてほしいので、営業の棚に上げたいです",
    at: "11/21 16:20",
    similar: "営業 › 見積もり の「値引きの決まり」と似ています。先に並べて確かめてください。",
  },
  {
    id: "a2",
    kind: "share",
    from: "受託開発（田中 美咲）",
    fromShelf: "受託開発",
    toShelf: "営業にも見せる",
    title: "納品の前の確かめ",
    desc: "納品の前に、開発と営業の両方で確かめること。",
    message: "営業の人も、お客さまに渡す前に同じ確かめをしてほしいです",
    at: "11/21 10:05",
  },
  {
    id: "a3",
    kind: "raise",
    from: "木村 誠",
    fromShelf: "木村さんの「自分」",
    toShelf: "営業",
    title: "見積もりの出し方（自分のやり方）",
    desc: "見積書を早く出すための、自分なりの順番。",
    at: "11/20 18:42",
    declining: { reason: "営業 › 見積もり に「見積書の出し方」があります。足りない所は、そのページに足してください。" },
  },
];

export const UNUSED: readonly UnusedRow[] = [
  { id: "u1", title: "年賀状の送り先", place: "会社 › お客さま対応", lastOpened: "AI が最後に開いた：2025/12/20" },
  {
    id: "u2",
    title: "旧：見積書のひな形（2024）",
    place: "グループ：営業 › 見積もり",
    lastOpened: "AI が最後に開いた：1 度も無い",
  },
  { id: "u3", title: "展示会の持ち物", place: "グループ：営業", lastOpened: "AI が最後に開いた：2026/06/02" },
  { id: "u4", title: "名刺の発注のしかた", place: "会社", lastOpened: "AI が最後に開いた：2026/07/15" },
];
export const CONFLICTS: readonly ConflictRow[] = [
  {
    id: "c1",
    upper: "請求書の送り方",
    upperPlace: "会社 › 経理",
    lower: "見積書の出し方",
    lowerPlace: "グループ：営業 › 見積もり",
    point: "支払期日：会社は「月末締め・翌月末払い」、営業は「月末締め・翌々月 10 日払い」と書いてあります",
  },
];
export const BROKEN: readonly BrokenRow[] = [
  {
    id: "b1",
    title: "メールの書き方",
    place: "会社",
    count: 7,
    how: "いちばん多い：件名に【 】の種類が入っていない（5 回）",
  },
  {
    id: "b2",
    title: "外に出す前の確かめ",
    place: "会社",
    count: 3,
    how: "いちばん多い：添付のファイル名に取引先の名前が無い（2 回）",
  },
  {
    id: "b3",
    title: "値引きの決まり",
    place: "グループ：営業 › 見積もり",
    count: 2,
    how: "いちばん多い：5% を超える値引きを、承認の前に書いた（2 回）",
  },
];
