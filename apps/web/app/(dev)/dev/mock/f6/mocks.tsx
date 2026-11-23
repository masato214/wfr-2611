"use client";
// 段 7（F6 自分で進める・話す・決める）の下絵のモック（部品先行・枝 c/段7）。本番と同じ部品（features/F6/{progress,thread,decisions}/views.tsx・
//   詳細の部品 features/F4/create-ticket/detail-head.tsx・components/k）を、決めた値で並べる。1 つの id ＝ 1 つの状態。
//   代表の答え（段7-代表に聞くこと.md の末尾・answer=eaa451436670・f5cd1647389f）：⑤ 開き直すを入れる／⑧ 読める人は書ける／⑨ 知らせる人の欄を残す／
//   ⑬「新しい」の印とタブの数を出す／⑯ AI の決定の案は人が書く所まで（AI の案の欄はグレー）／⑰ 決定の取り消しは印と理由を付けて残す／残りの 17 個は勧めのとおり
//   本番の詳細の部品（ticket-detail.tsx・detail-panel.tsx）はここでは使わない。詳細の並びはここで同じクラスで組む（差し込み口は K-380・その先の入れ物は K-382）。
//   ticket はその状態を本物にする画面の葉（K-382・K-392〜K-398・段 7 の切る段で決めた番号）
//   製品の時点（ps）：PS0 登録直後（PC なし）／PS2 使っている（AI の実行・承認待ちが在る）
import { PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { Band, DocTools, Prose, Shell, Toaster } from "@/components/k";
import { DetailTitle, InertButton } from "@/features/F4/create-ticket/detail-head";
import "@/features/F4/create-ticket/ticket-detail.css";
import { completedLine } from "@/features/F5/approve-complete/complete-model";
import {
  ActualTime,
  ActualTimeEdit,
  HoldBand,
  HoldDialog,
  HoldReason,
  StageMenu,
  type StageView,
} from "@/features/F6/progress/views";
import {
  Composer,
  DeleteMessageConfirm,
  Mention,
  TalkJump,
  TalkTabs,
  ThreadEmpty,
  ThreadFailed,
  ThreadFilters,
  ThreadList,
  type ComposerProps,
  type Filter,
  type Person,
  type PostView,
  type ThreadItem,
} from "@/features/F6/thread/views";
import {
  CancelDecisionConfirm,
  DecisionDialog,
  DecisionLog,
  ReviseDialog,
  type DecisionView,
} from "@/features/F6/decisions/views";
import type { Theme } from "@/lib/theme";

export type ProductState = "PS0" | "PS2";
export interface MockEntry {
  id: string;
  screen: "tickets";
  /** 製品の時点 */
  ps: ProductState;
  label: string;
  /** この状態を本物にする画面の葉（K-382・K-392〜K-398。頭の欄 mock: と両向きで合う・canvas_field_gate） */
  ticket: string;
}

export const MOCKS: readonly MockEntry[] = [
  {
    id: "prog-overview",
    screen: "tickets",
    ps: "PS0",
    label: "詳細の全体：段 7 で生きる 4 つの所",
    ticket: "K-382",
  },
  {
    id: "prog-menu",
    screen: "tickets",
    ps: "PS0",
    label: "段の札を押した（未着手のチケット・選ぶ物は色つきの札）",
    ticket: "K-395",
  },
  {
    id: "prog-hold-dialog",
    screen: "tickets",
    ps: "PS0",
    label: "保留にする小窓（再開の条件が空で押した）",
    ticket: "K-395",
  },
  {
    id: "prog-hold-band",
    screen: "tickets",
    ps: "PS0",
    label: "保留中のチケット（題名の下の帯）",
    ticket: "K-395",
  },
  {
    id: "prog-locked",
    screen: "tickets",
    ps: "PS2",
    label: "承認待ちの間は段を変えられない（鍵の札）",
    ticket: "K-395",
  },
  {
    id: "prog-time",
    screen: "tickets",
    ps: "PS2",
    label: "実績（人が使った時間）を直す",
    ticket: "K-395",
  },
  {
    id: "prog-readonly",
    screen: "tickets",
    ps: "PS2",
    label: "閲覧のみの人：段は字の札・実績に「直す」が無い",
    ticket: "K-395",
  },
  {
    id: "prog-reopen",
    screen: "tickets",
    ps: "PS2",
    label: "完了したチケットを開き直す（段の札のメニュー）",
    ticket: "K-395",
  },
  {
    id: "prog-hold-reason",
    screen: "tickets",
    ps: "PS2",
    label: "保留中だが承認と実行の帯が出ている：保留の帯は譲り、段の札の横に「理由を見る」（開いた）",
    ticket: "K-395",
  },
  {
    id: "talk-list",
    screen: "tickets",
    ps: "PS2",
    label: "やり取り：ふつう（新しい方から 20 件・前の書き込みを見る・変更の 1 行・AI の実行・新しい印）",
    ticket: "K-392",
  },
  {
    id: "talk-empty",
    screen: "tickets",
    ps: "PS0",
    label: "やり取り：「話だけ」で絞って何も無い",
    ticket: "K-392",
  },
  {
    id: "talk-loading-failed",
    screen: "tickets",
    ps: "PS0",
    label: "やり取り：読めない（もう一度読む）",
    ticket: "K-392",
  },
  {
    id: "talk-compose",
    screen: "tickets",
    ps: "PS0",
    label: "書く欄：@ の候補・知らせる人",
    ticket: "K-393",
  },
  {
    id: "talk-compose-stage",
    screen: "tickets",
    ps: "PS0",
    label: "書く欄：状態 ▾ で保留を選んだ（理由と再開の条件）",
    ticket: "K-396",
  },
  {
    id: "talk-edit",
    screen: "tickets",
    ps: "PS0",
    label: "自分の書き込みの「…」・直した印・その場で直す",
    ticket: "K-394",
  },
  {
    id: "talk-delete",
    screen: "tickets",
    ps: "PS0",
    label: "書き込みを消す確かめと、消した跡の 1 行",
    ticket: "K-394",
  },
  {
    id: "talk-send",
    screen: "tickets",
    ps: "PS0",
    label: "送れなかった（書いた字は残る）",
    ticket: "K-393",
  },
  {
    id: "talk-cannot",
    screen: "tickets",
    ps: "PS2",
    label: "完了したチケットの書く欄（書けるが状態 ▾ は押せない）",
    ticket: "K-393",
  },
  {
    id: "talk-narrow",
    screen: "tickets",
    ps: "PS2",
    label: "狭い幅：題名の下に「やり取り 3 ↓」・パネルは本文の下",
    ticket: "K-392",
  },
  {
    id: "dec-log",
    screen: "tickets",
    ps: "PS0",
    label: "本文の決定ログ：一覧（改められた・取り消した・元の書き込みへ）",
    ticket: "K-397",
  },
  { id: "dec-empty", screen: "tickets", ps: "PS0", label: "決定がまだ無い", ticket: "K-397" },
  {
    id: "dec-from-message",
    screen: "tickets",
    ps: "PS0",
    label: "書き込みを決定にする小窓（AI の案はグレー）",
    ticket: "K-398",
  },
  {
    id: "dec-add",
    screen: "tickets",
    ps: "PS0",
    label: "決定を足す小窓（直接書く・空で押した）",
    ticket: "K-397",
  },
  {
    id: "dec-no-section",
    screen: "tickets",
    ps: "PS0",
    label: "作るときに決定ログを書かなかったチケット：決定が在れば本文の最後に決定ログが出る（作るときの字は無い）",
    ticket: "K-1119",
  },
  { id: "dec-revise", screen: "tickets", ps: "PS0", label: "決定を改める小窓", ticket: "K-398" },
  {
    id: "dec-cancel",
    screen: "tickets",
    ps: "PS0",
    label: "決定を取り消す確かめ（理由が空で押した）",
    ticket: "K-398",
  },
  {
    id: "dec-conflict",
    screen: "tickets",
    ps: "PS0",
    label: "同時にほかの人が改めていた",
    ticket: "K-398",
  },
];

// ---- 見本の値 ----
const ME = "高本";
const TAKA: Person = { name: "高本 聖斗", initial: "高" };
const SUZU: Person = { name: "鈴木 一郎", initial: "鈴", tone: "indigo" };
const SATO: Person = { name: "佐藤 花子", initial: "佐", tone: "teal" };
const TITLE = "セイコー様へ 11 月分の請求書を送る";
const ST: Record<string, StageView> = {
  todo: { key: "todo", name: "未着手" },
  doing: { key: "doing", name: "作業中" },
  hold: { key: "hold", name: "保留" },
  awaiting: { key: "awaiting_approval", name: "承認待ち" },
  done: { key: "done", name: "完了" },
};
const DEFAULT_NOTIFY = ["鈴木", "佐藤"] as const; // 担当者と承認する人（自分は除く）

/** 決定の小窓の「決めた人」の見本（本番は口が返す今のメンバー） */
const DECISION_PEOPLE = [
  { value: "me", label: "高本 聖斗" },
  { value: "suzuki", label: "鈴木 一郎" },
  { value: "sato", label: "佐藤 花子" },
];

const DECISIONS: DecisionView[] = [
  {
    id: "d3",
    text: "10/19 の追加対応は無償。11 月分の請求から外す",
    by: "11/01 鈴木 一郎（先方と合意）",
    reason: "先方の都合による作業のため",
    source: "やり取り 11/01 10:20",
    status: "live",
  },
  {
    id: "d2",
    text: "支払期日は月末締め翌月末",
    by: "10/28 高本 聖斗",
    reason: "山田様から了承",
    source: "やり取り 10/28 14:02",
    status: "live",
    revises: true,
    note: "10/20 の決定を改めた",
  },
  {
    id: "d1",
    text: "支払期日は月末締め翌々月 10 日",
    by: "10/20 高本 聖斗",
    status: "revised",
    note: "新しい決定：支払期日は月末締め翌月末 ↑",
  },
  {
    id: "d0",
    text: "請求書は郵送もする",
    by: "10/21 佐藤 花子",
    status: "cancelled",
    note: "取り消し 10/22 佐藤：先方がメールだけでよいと言ったため",
  },
];

const P_TAKA: PostView = {
  id: "m1",
  who: TAKA,
  time: "14:02",
  body: (
    <>
      山田様から、支払期日は<b>月末締め翌月末</b>でよいと返事がありました。
    </>
  ),
  notified: "鈴木",
  stars: 1,
  decided: true,
  menu: "own",
};
const P_SUZU: PostView = {
  id: "m2",
  who: SUZU,
  time: "10:20",
  body: (
    <>
      10/19 の追加対応は無償にした件、反映が要るかもしれません。<Mention>@高本</Mention> さん確認お願いします
    </>
  ),
  notified: "高本・佐藤",
  menu: "none",
};
const P_SATO_NEW: PostView = {
  id: "m3",
  who: SATO,
  time: "10:41",
  body: "無償で合意済みなら外して OK です。今日中に出せると助かります",
  changes: ["状態：作業中 → 保留"],
  notified: "高本・鈴木",
  isNew: true,
  menu: "none",
};
const CREATED: ThreadItem = {
  kind: "line",
  who: TAKA,
  text: (
    <>
      <b>高本</b> がチケットを作った
    </>
  ),
  time: "17:44",
};
const THREAD_FULL: ThreadItem[] = [
  { kind: "day", label: "10/28（火）" },
  { kind: "post", post: P_TAKA },
  { kind: "day", label: "10/30（木）" },
  CREATED,
  {
    kind: "line",
    who: TAKA,
    text: (
      <>
        <b>高本</b> が状態を <b>未着手 → 作業中</b> に変えた
      </>
    ),
    time: "17:50",
  },
  { kind: "day", label: "11/01（土）" },
  {
    kind: "run",
    title: (
      <>
        <b>高本のAI</b> が請求書を作り、確認を流した
      </>
    ),
    meta: "09:00 → 09:12 ・ 12 分",
    result: "通った",
  },
  { kind: "post", post: P_SUZU },
  { kind: "post", post: P_SATO_NEW },
];
const THREAD_PS0: ThreadItem[] = [{ kind: "day", label: "10/30（木）" }, CREATED];

// ---- 詳細の並び（本番の DetailView と同じクラス） ----
function MockMeta({ stage }: { stage: ReactNode }) {
  return (
    <div className="k-detail-meta">
      <span data-part="kind" className="k-detail-kind" data-tone="primary">
        タスク
      </span>
      <span data-part="number" className="k-detail-number">
        EG-128
      </span>
      <span data-part="created" className="k-detail-created">
        作成 10/30 17:44
      </span>
      <span className="k-detail-meta-side">
        <span data-part="start">
          開始日 <b>10/30</b>
        </span>
        <span data-part="due">
          期限 <b>11/05</b>
        </span>
        {stage}
      </span>
    </div>
  );
}

function Fields({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="k-detail-fields">
      {rows.map(([k, v]) => (
        <div key={k} className="k-detail-field">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 右のパネルの「属性」（実績の所だけ段 7 の部品） */
function AttrBody({ time }: { time: ReactNode }) {
  return (
    <div className="k-detail-panel-body">
      <section aria-label="担当" className="k-detail-panel-sec">
        <h2>担当</h2>
        <Fields
          rows={[
            ["担当者", "鈴木 一郎"],
            ["業務の型", ""],
            ["承認する人", "佐藤 花子"],
          ]}
        />
      </section>
      <section aria-label="日付と時間" className="k-detail-panel-sec">
        <h2>日付と時間</h2>
        <Fields
          rows={[
            ["開始日", "10/30（木）"],
            ["期限", "11/05（水）"],
            ["予定", "30 分"],
            ["実績", time],
          ]}
        />
      </section>
    </div>
  );
}

interface TalkProps {
  filter?: Filter;
  items?: readonly ThreadItem[] | "empty" | "failed";
  composer?: ComposerProps;
  /** 新しい方から 20 件より前の書き込みの数（「前の書き込みを見る（あと N 件）」） */
  older?: number;
}
function TalkBody({ filter = "all", items = THREAD_PS0, composer = { notify: DEFAULT_NOTIFY }, older }: TalkProps) {
  return (
    <div className="k-talk">
      <ThreadFilters active={filter} {...(items !== "empty" && items !== "failed" ? { mineCount: 1 } : {})} />
      {items === "empty" ? (
        <ThreadEmpty />
      ) : items === "failed" ? (
        <ThreadFailed />
      ) : (
        <ThreadList items={items} {...(older ? { olderCount: older } : {})} />
      )}
      <Composer {...composer} />
    </div>
  );
}

interface PageProps {
  theme: Theme;
  ps: ProductState;
  stage: ReactNode;
  band?: ReactNode;
  tab?: "attr" | "talk";
  count?: number;
  panel?: ReactNode;
  decisions?: ReactNode;
  dialog?: ReactNode;
  jump?: number;
}

function Page({ theme, ps, stage, band, tab = "talk", count, panel, decisions, dialog, jump }: PageProps) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="tickets"
        crumbs={[{ label: "チケット", href: "/tickets" }, { label: "EG-128" }]}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: ME, initial: "高" }}
        bridgeConnected={ps !== "PS0"}
        theme={theme}
      >
        <div className="k-detail">
          <section className="k-root k-page" aria-labelledby="ticket-title">
            <article className="k-detail-card">
              <MockMeta stage={stage} />
              <DetailTitle title={TITLE} me={ME} />
              {jump ? <TalkJump count={jump} /> : null}
              <div className="k-detail-bands">{band}</div>
              <DocTools label="本文の道具" note="「/」で部品を入れる ・ 本文の版 3">
                <InertButton size="sm" className="k-detail-versions">
                  版と差分
                </InertButton>
              </DocTools>
              <div className="k-detail-doc">
                <section className="k-section" aria-label="目的">
                  <h2 id="sec-goal">目的</h2>
                  <Prose>セイコー様に 11 月分の請求書を、期日までに PDF で送る。</Prose>
                </section>
                <section className="k-section" aria-label="完了の条件">
                  <h2 id="sec-done">完了の条件</h2>
                  <Prose>請求書の PDF を作り、先方の担当（山田様）にメールで送ったこと。</Prose>
                </section>
                {decisions ?? <DecisionLog intro="支払いは銀行振込" items={DECISIONS.slice(0, 2)} canWrite />}
              </div>
            </article>
            <section className="k-detail-links" aria-label="子チケット・つながり">
              <div className="k-detail-links-head">
                <h2>子チケット・つながり</h2>
                <InertButton size="sm">子を足す</InertButton>
                <InertButton size="sm">つながりを足す</InertButton>
              </div>
            </section>
          </section>
          <aside aria-label="チケットのパネル" className="k-detail-panel" id="ticket-talk">
            <button type="button" className="k-detail-panel-close" aria-label="パネルを閉じる" title="パネルを閉じる">
              <PanelRight size={16} aria-hidden="true" />
            </button>
            <TalkTabs active={tab} me={ME} {...(count ? { count } : {})} />
            {panel ?? <TalkBody />}
          </aside>
        </div>
      </Shell>
      {dialog}
    </Toaster>
  );
}

const menu = (stage: StageView, open = false) => <StageMenu stage={stage} canChange open={open} />;

/** 1 つの状態。製品の時点を data-ps に出す（[id]/page.tsx は server なので、MOCKS の値はここで読む） */
export function MockView({ id, theme }: { id: string; theme: Theme }) {
  return <div data-ps={MOCKS.find((m) => m.id === id)?.ps}>{view(id, theme)}</div>;
}

function view(id: string, theme: Theme): ReactNode {
  switch (id) {
    case "prog-overview":
      return <Page theme={theme} ps="PS0" stage={menu(ST.todo!)} />;
    case "prog-menu":
      return <Page theme={theme} ps="PS0" stage={menu(ST.todo!, true)} />;
    case "prog-hold-dialog":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          dialog={
            <HoldDialog
              open
              target={`EG-128 ${TITLE}`}
              reason="先方の検収が終わるまで請求できないため"
              errors={{ resume: "再開の条件を書いてください" }}
            />
          }
        />
      );
    case "prog-hold-band":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.hold!)}
          band={
            <HoldBand
              reason="先方の検収が終わるまで請求できないため"
              resume="検収の完了の連絡が来たら"
              by="11/01 10:41 佐藤 が保留にした"
              canChange
            />
          }
        />
      );
    case "prog-locked":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={<StageMenu stage={ST.awaiting!} canChange locked />}
          band={<Band tone="approval" title="承認待ち ・ 佐藤 花子 が承認します" sub="（承認と実行の帯は今のまま）" />}
          count={1}
          panel={<TalkBody items={THREAD_FULL} composer={{ notify: DEFAULT_NOTIFY, stageLocked: true }} />}
        />
      );
    case "prog-time":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={menu(ST.doing!)}
          tab="attr"
          count={1}
          panel={<AttrBody time={<ActualTimeEdit hours={1} minutes={0} ai={12} />} />}
        />
      );
    case "prog-readonly":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={<StageMenu stage={ST.doing!} canChange={false} />}
          tab="attr"
          count={1}
          panel={<AttrBody time={<ActualTime human={60} ai={12} canEdit={false} />} />}
          decisions={<DecisionLog intro="支払いは銀行振込" items={DECISIONS.slice(0, 2)} canWrite={false} />}
        />
      );
    case "prog-reopen":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={menu(ST.done!, true)}
          band={<Band tone="ok" title={completedLine({ at: "2026-11-02T06:30:00Z", by: "高本 聖斗" })} />}
          panel={<TalkBody items={THREAD_FULL} composer={{ notify: DEFAULT_NOTIFY, stageLocked: true }} />}
        />
      );
    case "prog-hold-reason":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={
            <>
              {menu(ST.hold!)}
              <HoldReason
                reason="先方の検収が終わるまで請求できないため"
                resume="検収の完了の連絡が来たら"
                by="11/01 10:41 佐藤 が保留にした"
                open
              />
            </>
          }
          band={<Band tone="danger" role="alert" title="実行が止まりました" sub="（承認と実行の帯は今のまま）" />}
          count={1}
          panel={<TalkBody items={THREAD_FULL} composer={{ notify: DEFAULT_NOTIFY }} />}
        />
      );
    case "talk-list":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={menu(ST.hold!)}
          count={1}
          jump={3}
          panel={<TalkBody items={THREAD_FULL} older={14} composer={{ notify: DEFAULT_NOTIFY }} />}
        />
      );
    case "talk-empty":
      return <Page theme={theme} ps="PS0" stage={menu(ST.todo!)} panel={<TalkBody filter="talk" items="empty" />} />;
    case "talk-loading-failed":
      return <Page theme={theme} ps="PS0" stage={menu(ST.todo!)} panel={<TalkBody items="failed" />} />;
    case "talk-compose":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          panel={
            <TalkBody
              composer={{
                text: "了解です。@鈴",
                notify: DEFAULT_NOTIFY,
                mentions: [
                  { name: "鈴木 一郎", sub: "担当者" },
                  { name: "鈴木 健", sub: "経理グループ" },
                ],
              }}
            />
          }
        />
      );
    case "talk-compose-stage":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          panel={<TalkBody composer={{ text: "検収が終わるまで止めます", notify: DEFAULT_NOTIFY, stage: "保留…" }} />}
        />
      );
    case "talk-edit": {
      const mine: PostView = {
        id: "m4",
        who: TAKA,
        time: "11:02",
        body: "了解です。10/19 分を外して今日中に送ります",
        edited: "11/01 11:05",
        menu: "own",
        menuOpen: true,
      };
      const items: ThreadItem[] = [
        ...THREAD_PS0,
        { kind: "day", label: "11/01（土）" },
        { kind: "post", post: mine },
        {
          kind: "editing",
          post: { ...mine, id: "m5", time: "11:08" },
          text: "請求書の宛名は経理部 山田様で合っていますか？",
        },
      ];
      return <Page theme={theme} ps="PS0" stage={menu(ST.doing!)} panel={<TalkBody items={items} />} />;
    }
    case "talk-delete": {
      const items: ThreadItem[] = [
        ...THREAD_PS0,
        { kind: "day", label: "11/01（土）" },
        {
          kind: "line",
          who: TAKA,
          text: (
            <>
              <b>高本</b> が書き込みを消しました
            </>
          ),
          time: "11:09",
        },
        {
          kind: "line",
          who: SATO,
          text: (
            <>
              マネージャーの <b>佐藤</b> が <b>鈴木</b> の書き込みを消しました
            </>
          ),
          time: "11:20",
        },
      ];
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          panel={<TalkBody items={items} />}
          dialog={<DeleteMessageConfirm open name="高本" text="了解です。10/19 分を外して今日中に送ります" />}
        />
      );
    }
    case "talk-send":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          panel={
            <TalkBody
              composer={{ text: "了解です。10/19 分を外して今日中に送ります", notify: DEFAULT_NOTIFY, failed: true }}
            />
          }
        />
      );
    case "talk-cannot":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={menu(ST.done!)}
          band={<Band tone="ok" title={completedLine({ at: "2026-11-02T06:30:00Z", by: "高本 聖斗" })} />}
          panel={<TalkBody items={THREAD_FULL} composer={{ notify: DEFAULT_NOTIFY, stageLocked: true }} />}
        />
      );
    case "talk-narrow":
      return (
        <Page
          theme={theme}
          ps="PS2"
          stage={menu(ST.hold!)}
          count={1}
          jump={3}
          panel={<TalkBody items={THREAD_FULL} older={14} composer={{ notify: DEFAULT_NOTIFY }} />}
        />
      );
    case "dec-log":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          decisions={<DecisionLog intro="支払いは銀行振込" items={DECISIONS} canWrite />}
        />
      );
    case "dec-empty":
      return <Page theme={theme} ps="PS0" stage={menu(ST.todo!)} decisions={<DecisionLog items={[]} canWrite />} />;
    case "dec-from-message":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          dialog={
            <DecisionDialog
              open
              people={DECISION_PEOPLE}
              from={{
                who: "鈴木 一郎",
                time: "11/01 10:20",
                text: "10/19 の追加対応は先方の都合で無償にした件、反映が要るかもしれません。",
              }}
              text="10/19 の追加対応は無償。11 月分の請求から外す"
              by="suzuki"
              byNote="先方と合意"
              reason="先方の都合による作業のため"
            />
          }
        />
      );
    case "dec-add":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          // 一覧は 4 件全部（2 件だけだと「10/20 の決定を改めた」の元の決定が一覧に無く、口の答えから作れない形になる・K-397）
          decisions={<DecisionLog intro="支払いは銀行振込" items={DECISIONS} canWrite />}
          dialog={<DecisionDialog open people={DECISION_PEOPLE} errors={{ text: "決めたことを書いてください" }} />}
        />
      );
    case "dec-no-section":
      // 区画の行が無いチケット（K-1119）：版 0 の区画で決定ログを出す。作るときの字（intro）は無く、並びと字は dec-log と同じ
      return (
        <Page theme={theme} ps="PS0" stage={menu(ST.doing!)} decisions={<DecisionLog items={DECISIONS} canWrite />} />
      );
    case "dec-revise":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          dialog={
            <ReviseDialog
              open
              prev={{ by: "10/20 高本", text: "支払期日は月末締め翌々月 10 日" }}
              text="支払期日は月末締め翌月末"
              reason="山田様から了承"
            />
          }
        />
      );
    case "dec-cancel":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          dialog={<CancelDecisionConfirm open text="請求書は郵送もする" error="取り消す理由を書いてください" />}
        />
      );
    case "dec-conflict":
      return (
        <Page
          theme={theme}
          ps="PS0"
          stage={menu(ST.doing!)}
          dialog={
            <ReviseDialog
              open
              conflict
              prev={{ by: "10/20 高本", text: "支払期日は月末締め翌々月 10 日" }}
              text="支払期日は月末締め翌月末"
              reason="山田様から了承"
            />
          }
        />
      );
    default:
      return <p>この状態はありません：{id}</p>;
  }
}
