"use client";
// 1 社の 5 つのタブの中身（段 13・領域 ops・キャンバス OpWs・OpWsMembers・OpWsBilling・OpWsLog）。値を受け取って描くだけ
import { Button } from "@/components/k";
import { Card, Feed, Note, Person, Stat, StatGrid, StatusBadge, type FeedItem } from "./ops-parts";
import { MEMBERS } from "./ops-sample";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";

/** いまの状態：4 つの数・最近のこと（止まった理由は運営に出さない＝中身なので） */
export function StatusTab() {
  const recent: FeedItem[] = [
    {
      at: "11/02 09:40",
      text: "問い合わせ「承認したのに動かない」が届いた",
      detail: "湊 さくら ・ 担当 高本",
    },
    { at: "11/01 09:00", text: "10 月分の請求書を出した ¥16,500", detail: "期限 11/30" },
    { at: "10/28", text: "9 月分の入金を記録した", detail: "振込名義 ミナトキカク" },
    { at: "10/15", text: "メンバーが 1 人増えた（8 人）" },
  ];
  return (
    <>
      <StatGrid>
        <Stat label="PC がつながる人" value="6 / 8" />
        <Stat label="今月の実行" value="1,284" />
        <Stat label="止まった実行" value="3" sub="この 7 日 ・ 先週は 0" tone="warn" />
        <Stat label="ファイル" value="2.1 GB" />
      </StatGrid>
      <Card title="最近のこと">
        <Feed label="最近のこと" items={recent} />
      </Card>
    </>
  );
}

type Member = (typeof MEMBERS)[number];

/** メンバー：人・役割・最後に入った・PC・ログイン。運営は本人確認のメールを送り直すだけ */
export function MembersTab() {
  const cols: RespColumn<Member>[] = [
    {
      key: "who",
      header: "人",
      cell: (m) => (
        <Person initial={m.initial} sub={m.mail}>
          {m.name}
        </Person>
      ),
    },
    { key: "role", header: "役割", nowrap: true, cell: (m) => m.role },
    { key: "last", header: "最後に入った", nowrap: true, cell: (m) => m.last },
    { key: "pc", header: "PC", nowrap: true, cell: (m) => m.pc },
    { key: "login", header: "ログイン", nowrap: true, cell: (m) => m.login },
    {
      key: "act",
      header: "本人確認",
      card: "action",
      cell: (m) => (
        <Button size="sm" variant="outlined" aria-label={`${m.name} さんに本人確認のメールを送り直す`}>
          メールを送り直す
        </Button>
      ),
    },
  ];
  return (
    <Card title="メンバー" aside="8 人 ・ 運営は役割も中身も変えない（変えるのはワークスペースの管理者）">
      <RespTable caption="メンバー" columns={cols} rows={[...MEMBERS]} rowKey={(m) => m.name} />
      <Note>
        ほか 3 人は「すべて見る」。ログインに困っている人は、ワークスペースの管理者が 2
        段階認証を戻せる（運営からは本人確認のメールを送り直すだけ）
      </Note>
    </Card>
  );
}

interface Bill {
  month: string;
  amount: string;
  issued: string;
  due: string;
  state: string;
  paid: string | null;
}
const BILLS: readonly Bill[] = [
  { month: "10 月分", amount: "¥16,500", issued: "11/01", due: "11/30", state: "お支払い待ち", paid: null },
  { month: "9 月分", amount: "¥16,500", issued: "10/01", due: "10/31", state: "払われた", paid: "10/28" },
  { month: "8 月分", amount: "¥16,500", issued: "09/01", due: "09/30", state: "払われた", paid: "09/29" },
  { month: "7 月分", amount: "¥16,500", issued: "08/01", due: "08/31", state: "払われた", paid: "08/27" },
];

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="k-op-meter">
      <span className="k-op-meter-label">{label}</span>
      <b>{value}</b>
      <progress className="k-op-meter-bar" value={pct} max={100} aria-label={`${label} ${value}`} />
    </div>
  );
}

/** プランと請求：プラン・使った量・払い方・請求書（入金を記録）。代わりにプランを変えるは「お金」の人だけ */
export function BillingTab() {
  const cols: RespColumn<Bill>[] = [
    { key: "m", header: "月", cell: (b) => b.month },
    { key: "a", header: "金額（税込）", num: true, cell: (b) => b.amount },
    { key: "i", header: "出した日", cell: (b) => b.issued },
    { key: "d", header: "期限", cell: (b) => b.due },
    {
      key: "s",
      header: "状態",
      cell: (b) => <StatusBadge tone={b.paid ? "success" : "warning"}>{b.state}</StatusBadge>,
    },
    {
      key: "p",
      header: "入金",
      cell: (b) =>
        b.paid ?? (
          <Button size="sm" variant="outlined">
            入金を記録
          </Button>
        ),
    },
  ];
  return (
    <>
      <Card
        title={
          <>
            チーム <StatusBadge tone="neutral">値段は仮</StatusBadge>
          </>
        }
        aside="04-03 から"
      >
        <p className="k-op-price">
          <b>¥15,000</b> ／月（税別）
        </p>
        <div className="k-op-meters">
          <Meter label="人数" value="8 / 10" pct={80} />
        </div>
        <div className="k-op-inline">
          <Button variant="outlined" aria-disabled="true" tabIndex={-1} title="まだ使えません">
            代わりにプランを変える
          </Button>
          <span className="k-op-hint">「お金」ができる運営の人だけ</span>
        </div>
        <Note>
          プランを変えるのはワークスペースの管理者（上げるとすぐ・下げると次の請求日から）。運営は頼まれたときだけ代わりに変え、記録に残す
        </Note>
      </Card>
      <Card title="払い方" aside={<StatusBadge tone="neutral">請求書払い</StatusBadge>}>
        <p className="k-op-note-text">
          月末締め・翌月 1 日に請求書を出す・月末払い。請求書はワークスペースの管理 › 設定 › 請求書
          に出て、請求先のメールにも届く
        </p>
        <p className="k-op-inline">
          <span className="k-op-pill-off" aria-disabled="true" title="まだ使えません">
            カード払いは後のフェーズ
          </span>
        </p>
      </Card>
      <Card title="請求書">
        <RespTable caption="請求書" columns={cols} rows={[...BILLS]} rowKey={(b) => b.month} />
        <Note>
          期限を過ぎると、管理者にお知らせが出る（過ぎた日・7 日後）。7
          日たっても払われないとき、運営に「止める」の案が出る。止めるかは人が決める
        </Note>
      </Card>
    </>
  );
}

interface Inq {
  title: string;
  kind: string;
  who: string;
  owner: string;
  state: string;
  at: string;
}
const INQUIRIES: readonly Inq[] = [
  {
    title: "承認したのに動かない",
    kind: "うまく動かない",
    who: "湊 さくら",
    owner: "高本",
    state: "進行中",
    at: "11/02 09:40",
  },
  {
    title: "請求書の宛名を経理に変えたい",
    kind: "お金・プラン",
    who: "湊 さくら",
    owner: "佐野",
    state: "済み",
    at: "10/20",
  },
  {
    title: "メンバーを 2 人増やしたい",
    kind: "お金・プラン",
    who: "吉田 健",
    owner: "佐野",
    state: "済み",
    at: "10/14",
  },
];

/** 問い合わせ：この 1 社の問い合わせの一覧（受信箱の行の形） */
export function InquiriesTab() {
  const cols: RespColumn<Inq>[] = [
    {
      key: "t",
      header: "題",
      cell: (q) => (
        <a className="k-link" href="/dev/mock/f12-ops2/oq-inbox-thread">
          {q.title}
        </a>
      ),
    },
    { key: "k", header: "種類", cell: (q) => <StatusBadge tone="neutral">{q.kind}</StatusBadge> },
    { key: "w", header: "聞いた人", cell: (q) => q.who },
    { key: "o", header: "担当", cell: (q) => q.owner },
    {
      key: "s",
      header: "状態",
      cell: (q) => <StatusBadge tone={q.state === "済み" ? "success" : "progress"}>{q.state}</StatusBadge>,
    },
    { key: "a", header: "届いた", cell: (q) => q.at },
  ];
  return (
    <Card title="問い合わせ" aside="新しい順 ・ 受信箱と同じもの">
      <RespTable
        caption="このワークスペースの問い合わせ"
        columns={cols}
        rows={[...INQUIRIES]}
        rowKey={(q) => q.title}
      />
    </Card>
  );
}

/** 記録：運営の誰が何をしたか。消せない・直せない */
export function LogTab() {
  const items: FeedItem[] = [
    {
      at: "11/02 10:12",
      who: "高本",
      text: "が 中を見た（見るだけ・38 分）",
      detail: "理由：問い合わせ「承認したのに動かない」・見た画面：チケット 4 件・承認待ち・湊さんの分身の実行の記録",
    },
    { at: "11/02 09:58", who: "高本", text: "が 問い合わせを持った" },
    {
      at: "11/01 09:00",
      who: "請求",
      text: "が 10 月分の請求書を出した ¥16,500",
      detail: "まとめて出した 46 件のうちの 1 件",
    },
    { at: "10/28 15:20", who: "佐野", text: "が 9 月分の入金を記録した ¥16,500", detail: "振込名義 ミナトキカク" },
    {
      at: "04/03 11:05",
      who: "高本",
      text: "が プランを 無料 → チーム にした",
      detail: "管理者 湊 さくら さんの頼み（問い合わせから）",
    },
  ];
  return (
    <Card title="記録">
      <p className="k-op-note-text">このワークスペースに運営の誰が何をしたか。消せない・直せない</p>
      <Feed label="運営の記録" items={items} />
      <Note>全社をまたぐ運営の記録の画面は後のフェーズ。いまは 1 社ずつここで見る</Note>
    </Card>
  );
}
