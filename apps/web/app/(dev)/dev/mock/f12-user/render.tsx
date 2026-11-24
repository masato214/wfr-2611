"use client";
// 段 13（領域 user）の下絵のモックを描く。本番と同じ部品（features/F12/{help,billing}・components/k）に見本の値を渡すだけ。
//   見本の値：顧客 ENGINE BASE・人は 高本 聖斗・運営は Kaname 運営（佐野）。値段は仮（無料 ¥0・チーム ¥15,000・ビジネス ¥40,000）
import type { ReactNode } from "react";
import { Callout, NoAccess, PageBody, PageHeader, Section, Shell, Toaster } from "@/components/k";
import {
  AskDialog,
  HelpHome,
  NoticeDetail,
  Thread,
  ThreadNotFound,
  type InquiryView,
  type MessageView,
  type NoticeView,
  type StatusView,
} from "@/features/F12/help/views";
import {
  DownView,
  IncidentBand,
  MaintBand,
  MaintenanceView,
  CustomerPeekBand,
  PeekBar,
  StoppedView,
  StopSoonBand,
} from "@/features/F12/help/status-parts";
import {
  Bills,
  ContactDialog,
  PlanBlocked,
  PlanConfirm,
  PlanDialog,
  PriceChange,
  type BillView,
  type ContactView,
  type PlanView,
} from "@/features/F12/billing/views";
import type { Theme } from "@/lib/theme";

const ME = "高本 聖斗";

const NOTICES: readonly NoticeView[] = [
  {
    id: "n1",
    kind: "障害",
    title: "分身の実行が遅れています",
    state: "原因が分かった",
    body: "送る順番の仕組みを入れ替えています。データは消えていません",
    when: "11/02 10:20",
    unread: true,
  },
  {
    id: "n2",
    kind: "メンテ",
    title: "11/10（月）2:00〜3:00 メンテナンス",
    body: "この間は使えません。承認したものは終わってから動きます",
    when: "11/03",
    unread: true,
  },
  {
    id: "n3",
    kind: "リリース",
    title: "チケットにスレッドができました",
    body: "チケットごとに人と話して調整できます",
    when: "10/28",
  },
  {
    id: "n4",
    kind: "リリース",
    title: "先方の人を招けるようにしました",
    body: "先方の人を招いて、依頼と検収をやり取りできます",
    when: "10/14",
  },
];
const STATUSES: readonly StatusView[] = [
  { label: "画面", state: "ふつう" },
  { label: "分身の実行", state: "遅れている" },
  { label: "PC とのつながり", state: "ふつう" },
];
const INQUIRIES: readonly InquiryView[] = [
  { id: "q1", title: "PC をつけているのに実行待ちのまま", kind: "うまく動かない", when: "11/02", replied: true },
  { id: "q2", title: "ナレッジの取り込みの形式", kind: "使い方", when: "10/20", replied: true, done: true },
];
const MESSAGES: readonly MessageView[] = [
  {
    id: "m1",
    from: "me",
    initial: "高",
    name: ME,
    when: "11/02 09:40",
    text: "請求書を送るチケット（EG-128）を承認したのですが、30 分たっても「実行待ち」のままです。PC はつけています。",
    attach: "画面 チケット EG-128 ・ Chrome 130 ・ PC つながっている（09:38）",
  },
  {
    id: "m2",
    from: "ops",
    initial: "運",
    name: "Kaname 運営（佐野）",
    when: "11/02 10:15",
    text: "お問い合わせありがとうございます。実行の記録を確かめたところ、預けている Gmail のログイン情報（GMAIL_WORK）の期限が切れて止まっていました。右上の顔 › 自分の設定 › 預けたログイン情報 から「預け直す」をお願いします。預け直すと、実行待ちのものがすぐ動きます。",
  },
];
const CONTACT: ContactView = {
  company: "株式会社ENGINE BASE",
  attn: "経理 ご担当",
  email: "keiri@engine-base.example",
};
const BANK = ["〇〇銀行 本店 普通 1234567", "カ）エンジンベース", "振込手数料はご負担ください（仮）"];
const TERMS = "請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い";
const BILLS: readonly BillView[] = [
  { month: "10 月分", amount: "¥16,500", issued: "11/01", due: "11/30", state: "お支払い待ち" },
  { month: "9 月分", amount: "¥16,500", issued: "10/01", due: "10/31", state: "払われた", paid: "10/28" },
  { month: "8 月分", amount: "¥16,500", issued: "09/01", due: "09/30", state: "払われた", paid: "09/29" },
];
const OVERDUE_BILLS: readonly BillView[] = [{ ...BILLS[0]!, state: "期限を過ぎた", due: "10/31" }, ...BILLS.slice(1)];
const PLANS: readonly PlanView[] = [
  { id: "free", name: "無料", price: "¥0", limit: "3 人まで ・ チケット・承認・ナレッジ" },
  { id: "team", name: "チーム", price: "¥15,000 ／月", limit: "10 人まで ・ ＋ ゲストを招く", current: true },
  {
    id: "biz",
    name: "ビジネス",
    price: "¥40,000 ／月",
    limit: "30 人まで ・ ＋ ゲストのグループ",
    recommended: true,
  },
];

interface FrameProps {
  theme: Theme;
  screen: string;
  crumbs: { label: string; href?: string }[];
  children: ReactNode;
  dialog?: ReactNode;
}
function Frame({ theme, screen, crumbs, children, dialog }: FrameProps) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen={screen}
        crumbs={crumbs}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: ME, initial: "高" }}
        bridgeConnected
        theme={theme}
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}

const HELP_CRUMBS: { label: string; href?: string }[] = [{ label: "困ったとき・お知らせ", href: "/help" }];
const ADMIN_CRUMBS: { label: string; href?: string }[] = [
  { label: "ワークスペースの管理", href: "/company" },
  { label: "設定", href: "/settings" },
  { label: "請求書" },
];

/** 障害・メンテの帯などの下に出す、ふつうの画面の代わり（チケットの一覧の見本） */
function TicketsStandIn({ bands }: { bands?: ReactNode }) {
  return (
    <>
      {bands ? <div className="k-uh-bands">{bands}</div> : null}
      <PageBody labelledBy="tickets-title">
        <PageHeader id="tickets-title" title="チケット" sub="自分に関わるもの ・ 14 件" />
        <Section title="自分の承認を待っているもの">
          <div className="k-uh-peek-row">
            <b>セイコー様へ 11月分の請求書を送る</b>
            <span>EG-128 ・ 営業 ・ 成果物は高本のAI が作成</span>
          </div>
          <div className="k-uh-peek-row">
            <b>京蟻 追加開発の見積を出す（1,826,000 円）</b>
            <span>JD-204 ・ 受託開発 ・ 佐藤 が上位の承認を依頼</span>
          </div>
        </Section>
      </PageBody>
    </>
  );
}

const helpHome = (p: Partial<Parameters<typeof HelpHome>[0]> = {}) => (
  <HelpHome notices={NOTICES} statuses={STATUSES} inquiries={INQUIRIES} {...p} />
);

export function MockView({ id, theme }: { id: string; theme: Theme }) {
  const help = (body: ReactNode, dialog?: ReactNode, crumbs = HELP_CRUMBS) => (
    <Frame theme={theme} screen="help" crumbs={crumbs} {...(dialog ? { dialog } : {})}>
      {body}
    </Frame>
  );
  const bill = (body: ReactNode, dialog?: ReactNode, screen = "billing", crumbs = ADMIN_CRUMBS) => (
    <Frame theme={theme} screen={screen} crumbs={crumbs} {...(dialog ? { dialog } : {})}>
      {body}
    </Frame>
  );
  const bills = <Bills terms={TERMS} bank={BANK} contact={CONTACT} bills={BILLS} />;
  const thread = {
    title: "PC をつけているのに実行待ちのまま",
    kind: "うまく動かない",
    sentAt: "11/02 09:40",
    messages: MESSAGES,
  };
  const threadCrumbs = [...HELP_CRUMBS, { label: "PC をつけているのに実行待ちのまま" }];
  switch (id) {
    case "uh-help":
      return help(helpHome());
    case "uh-help-empty":
      return help(helpHome({ notices: [], inquiries: [] }));
    case "uh-help-error":
      return help(helpHome({ notices: [], inquiries: [], failed: true }));
    case "uh-notice":
      return help(
        <NoticeDetail
          n={{
            ...NOTICES[1]!,
            unread: false,
            window: "11/10（月）2:00〜3:00",
            impact:
              "この間は使えません。実行中のものは区切りまで進めて止め、承認したものは終わってから動きます。書きかけはこの PC に残ります",
            full: "データベースの入れ替えのため、予定の間はメンテナンスにします。終わると自動で画面が切り替わります。",
          }}
        />,
        undefined,
        [...HELP_CRUMBS, { label: "メンテナンスのお知らせ" }],
      );
    case "uh-ask":
      return help(
        helpHome(),
        <AskDialog
          kind="うまく動かない"
          title="PC をつけているのに実行待ちのまま"
          body="請求書を送るチケット（KN-212）を承認したのですが、30 分たっても「実行待ち」のままです。PC はつけています。"
        />,
      );
    case "uh-ask-invalid":
      return help(
        helpHome(),
        <AskDialog
          kind="うまく動かない"
          title=""
          body=""
          errors={{ title: "題を書いてください", body: "内容を書いてください" }}
        />,
      );
    case "uh-ask-file":
      return help(
        helpHome(),
        <AskDialog
          kind="うまく動かない"
          title="実行待ちのまま止まっています"
          body="画面の写しを付けます。"
          files={[
            { name: "画面の写し.png", size: "1.2MB" },
            { name: "実行の記録.zip", size: "48MB", tooBig: true },
          ]}
        />,
      );
    case "uh-ask-sent":
      return help(
        helpHome({
          sent: "運営に届きました",
          inquiries: [
            {
              id: "q3",
              title: "PC をつけているのに実行待ちのまま",
              kind: "うまく動かない",
              when: "いま",
              waiting: true,
            },
            ...INQUIRIES,
          ],
        }),
      );
    case "uh-thread":
      return help(<Thread {...thread} draft="" />, undefined, threadCrumbs);
    case "uh-thread-done":
      return help(
        <Thread
          {...thread}
          done
          messages={[
            ...MESSAGES,
            {
              id: "m3",
              from: "me",
              initial: "高",
              name: ME,
              when: "11/02 10:40",
              text: "預け直したら、すぐ動きました。ありがとうございました。",
            },
          ]}
        />,
        undefined,
        threadCrumbs,
      );
    case "uh-thread-notfound":
      return help(<ThreadNotFound />, undefined, [...HELP_CRUMBS, { label: "問い合わせ" }]);
    case "uh-band-incident":
      return (
        <Frame
          theme={theme}
          screen="tickets"
          crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
        >
          <TicketsStandIn
            bands={
              <IncidentBand
                title="分身の実行が遅れています（11/02 09:40〜）"
                state="原因が分かった"
                note="データは消えていません。承認したものは順に動きます"
              />
            }
          />
        </Frame>
      );
    case "uh-band-maint":
      return (
        <Frame
          theme={theme}
          screen="tickets"
          crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
        >
          <TicketsStandIn
            bands={
              <MaintBand
                window="11/10（月）2:00〜3:00"
                impact="この間は使えません。承認したものは終わってから動きます"
              />
            }
          />
        </Frame>
      );
    case "uh-maint":
      return <MaintenanceView window="11/10（月）2:00〜3:00" noticed="11/03" />;
    case "uh-down":
      return (
        <DownView
          updated="10:42"
          note="チケットの保存が遅くなっている。読むことはできる。分身の実行は止めている（承認したものは直ったら順に動く）"
          since="10:38"
          no="INC-2611-03"
        />
      );
    case "uh-stopped":
      return <StoppedView since="11/20" reason="規約に反する" contact="info@kaname.example" />;
    case "uh-stop-soon":
      return (
        <Frame
          theme={theme}
          screen="tickets"
          crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
        >
          <TicketsStandIn bands={<StopSoonBand day="11/29" reason="お支払いの確認が取れないため" />} />
        </Frame>
      );
    case "uh-peek":
      return (
        <div>
          <PeekBar
            who="合同会社ミナト企画 ・ 湊 さくら さん"
            reason="問い合わせ「承認したのに動かない」"
            rest="52 分"
          />
          <Frame
            theme={theme}
            screen="tickets"
            crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
          >
            <TicketsStandIn />
          </Frame>
        </div>
      );
    case "uh-peek-customer":
      return (
        <Frame
          theme={theme}
          screen="tickets"
          crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
        >
          <TicketsStandIn bands={<CustomerPeekBand reason="問い合わせ「承認したのに動かない」" rest="52 分" />} />
        </Frame>
      );
    case "ub-bills":
      return bill(bills);
    case "ub-bills-overdue":
      return bill(
        <Bills
          terms={TERMS}
          bank={BANK}
          contact={CONTACT}
          bills={OVERDUE_BILLS}
          overdue="10 月分（¥16,500）の期限（10/31）を過ぎています。振込のご確認をお願いします。"
        />,
      );
    case "ub-bills-empty":
      return bill(<Bills terms="無料のプラン ・ 請求書は出ません" bank={BANK} contact={CONTACT} bills={[]} free />);
    case "ub-contact":
      return bill(bills, <ContactDialog contact={CONTACT} />);
    case "ub-bills-noaccess":
      return bill(
        <PageBody labelledBy="noaccess">
          <NoAccess acts={["/tickets"]} />
        </PageBody>,
      );
    case "ub-plan":
      return bill(
        <PriceChange line="チーム ・ 10 人まで ・ いま 5 人 ・ 次の請求 12/01 ¥15,000" />,
        <PlanDialog workspace="株式会社ENGINE BASE" members={5} plans={PLANS} nextBill="12/01" />,
        "company-settings",
        [{ label: "ワークスペースの管理", href: "/company" }, { label: "設定" }],
      );
    case "ub-plan-confirm":
      return bill(bills, <PlanConfirm plan="ビジネス" days={9} amount="¥7,200" due="12/01" />);
    case "ub-plan-blocked":
      return bill(bills, <PlanBlocked plan="無料" limit={3} members={5} />);
    case "ub-price-change":
      return bill(
        <PriceChange
          line="チーム ・ 10 人まで ・ いま 5 人 ・ 次の請求 12/01 ¥15,000"
          change="2027 年 2 月分から ¥18,000（税別）・ 人数は 12 人まで に広がる。それまでは今のまま"
          noticeDate="11/05"
        />,
        undefined,
        "company-settings",
        [{ label: "ワークスペースの管理", href: "/company" }, { label: "設定" }],
      );
    default:
      return (
        <main className="k-root k-page">
          <Callout tone="info">この状態はまだありません</Callout>
        </main>
      );
  }
}
