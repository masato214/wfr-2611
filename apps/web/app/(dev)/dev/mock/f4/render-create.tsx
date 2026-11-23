"use client";
// 作る面の背景に重なる小窓と、空の一覧の下絵の描き分け（K-443〜K-446・K-453）。持っていない id は null を返す。
//   作る面の背景は下絵 v2（features/F4/doc の CreateForm）。小窓は features/F4/<区画>/views.tsx（本番の部品と同じ物）。
//   見本の日付は「今日 ＝ 11/23（月）」で固定する（期限の小窓の今日・今週の金曜・来週の月曜を毎回同じにする）
import type { ReactNode } from "react";
import { CreateForm, SPEC_LINES } from "@/features/F4/doc/views";
import { ListViews } from "@/features/F4/ticket-list/list-views";
import { FirstSide } from "@/features/F4/ticket-list/list-side";
import type { SetupTasks } from "@/features/F4/ticket-list/use-ticket-list";
import "@/features/F4/ticket-list/ticket-list.css";
import { DueDialog } from "@/features/F4/due/views";
import { mmddWeek } from "@/features/F4/due/dates";
import { DuplicateDialog, DuplicatePickDialog, type CopyRow } from "@/features/F4/duplicate/views";
import { HomeEmpty } from "@/features/F4/home/views";
import { ParentDialog, type PickItem } from "@/features/F4/parent/views";
import type { Theme } from "@/lib/theme";
import { DetailFrame, Frame, TICKET } from "./frame";

const TODAY = "2026-11-23";
const NEW_TITLE = "セイコー様へ 12月分の請求書を送る";
const CREATE_CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "作る" }];
const PAST = "期限は今日か、それより後の日にしてください";

// ---------------------------------------------------------------- 小窓の見本
const row = (id: string, lead: string, title: string, meta: string, more: Partial<PickItem> = {}): PickItem => ({
  id,
  lead,
  title,
  meta,
  ...more,
});
const PARENTS: PickItem[] = [
  row("p1", "EG-124", "【親】セイコー様 保守契約の更新", "営業 ・ 作業中", { selected: true }),
  row("p2", "EG-097", "セイコー様 保守契約の見積", "営業 ・ 完了"),
  row("p3", "JD-150", "京蟻 保守運用（年間）", "受託開発 ・ 作業中"),
];
const LIMIT_ITEMS: PickItem[] = [
  row("p4", "EG-131", "請求の確認（EG-124 の下）", "営業 ・ 作業中 ・ 2 段目", { selected: true }),
  row("p5", "EG-141", "請求書の宛名を確かめる", "営業 ・ 作業中 ・ 3 段目", {
    blocked: "3 段目のチケットの下には作れません",
  }),
];
const SOURCES: PickItem[] = [
  row("s1", "EG-128", "セイコー様へ 11月分の請求書を送る", "営業 ・ 完了 ・ 期限 11/01", { selected: true }),
  row("s2", "EG-103", "セイコー様へ 10月分の請求書を送る", "営業 ・ 完了 ・ 期限 10/01"),
  row("s3", "KR-024", "10月分 請求書をまとめて出す", "経理 ・ 完了 ・ 期限 10/25"),
];
const COPIES: CopyRow[] = [
  {
    key: "body",
    label: "本文",
    checked: true,
    note: "本文の中のチェックの箱は外して写します。日付や金額は、写したあとで直してください",
  },
  { key: "people", label: "担当者・承認する人", checked: true },
  { key: "fields", label: "項目（期限・優先度・会社の項目）", checked: true },
  { key: "spec", label: "確認項目", checked: true, note: "チェックは外して写します" },
  { key: "links", label: "つながり", checked: true },
  { key: "children", label: "子チケット（0 件）", checked: true },
  { key: "files", label: "添付", checked: false, unavailable: "まだ使えません" },
];
const SETUP: SetupTasks = {
  show: true,
  done: 0,
  total: 2,
  pending: null,
  close: () => undefined,
  skip: () => undefined,
  tasks: [
    {
      key: "passkey",
      label: "パスキーを付ける",
      desc: "まだ付けられません。数には入れていません",
      done: false,
      href: null,
      available: false,
      optional: false,
      skipped: false,
    },
    {
      key: "pc",
      label: "PC をつなぐ",
      desc: "分身はあなたの PC で動く。つなぐまで、分身は話すだけで実行はしない",
      done: false,
      href: "/setup/bridge",
      available: true,
      optional: false,
      skipped: false,
    },
    {
      key: "credentials",
      label: "ログイン情報を預ける",
      desc: "分身に使わせるメール・サービスのログイン。値は誰にも見せない",
      done: false,
      href: "/settings/credentials",
      available: true,
      optional: true,
      skipped: false,
    },
  ],
};

// ---------------------------------------------------------------- 状態ごとの組み立て
/** 作る面（下絵 v2 の形）に小窓を重ねる */
function create(theme: Theme, dialog?: ReactNode): ReactNode {
  return (
    <Frame theme={theme} crumbs={CREATE_CRUMBS} dialog={dialog}>
      <div className="k-root">
        <CreateForm titleValue={NEW_TITLE} body="free" specs={SPEC_LINES} />
      </div>
    </Frame>
  );
}

function dueDialog(mode: "create" | "change", over: Partial<Parameters<typeof DueDialog>[0]> = {}): ReactNode {
  return <DueDialog open mode={mode} today={TODAY} month="2026-12" selected="2026-12-01" {...over} />;
}

function home(theme: Theme): ReactNode {
  return (
    <Frame theme={theme} crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}>
      <div className="k-root k-list-page">
        <header className="k-page-head k-list-head">
          <div className="k-list-head-row">
            <h1 id="tickets-title">チケット</h1>
            <span className="k-list-dim">すべてのグループ</span>
          </div>
          <ListViews view="mine" />
        </header>
        <div className="k-list-body" data-first>
          <HomeEmpty name="高本" canCreate suggestions={["今月の請求書を送る", "問い合わせに返す", "見積を作る"]} />
          <FirstSide setup={SETUP} />
        </div>
      </div>
    </Frame>
  );
}

const DUP_TARGET = `${TICKET.number} ${TICKET.title}`;
const dup = (theme: Theme, notice?: string): ReactNode => (
  <DetailFrame
    theme={theme}
    dialog={
      <DuplicateDialog
        open
        sourceNumber={TICKET.number}
        title={TICKET.title}
        groupName="営業（EG）"
        dueLabel={mmddWeek(TICKET.due_on)}
        copies={COPIES}
        {...(notice ? { notice } : {})}
      />
    }
  />
);

type Builder = (theme: Theme) => ReactNode;
const BUILDERS: Record<string, Builder> = {
  "f4-parent-dialog": (t) =>
    create(
      t,
      <ParentDialog
        open
        query="保守"
        items={PARENTS}
        parentDue={mmddWeek("2026-11-30")}
        lateNote={`この子の期限（${mmddWeek("2026-12-01")}）が親の期限（${mmddWeek("2026-11-30")}）より後です。親にしたあと、期限を 11/30 までに直してください`}
        copyChecked
      />,
    ),
  "f4-parent-none": (t) => create(t, <ParentDialog open query="請求書 12月" items={[]} copyChecked />),
  "f4-parent-limit": (t) =>
    create(t, <ParentDialog open query="請求" items={LIMIT_ITEMS} parentDue={mmddWeek("2026-12-10")} copyChecked />),
  "f4-due-dialog": (t) => create(t, dueDialog("create")),
  "f4-due-reason": (t) => (
    <DetailFrame
      theme={t}
      dialog={dueDialog("change", {
        month: "2026-11",
        selected: "2026-11-30",
        target: `${DUP_TARGET} ・ いまの期限 ${mmddWeek(TICKET.due_on)}`,
        notice: "期限を延ばすと、承認する人（高本）にお知らせが出る",
        reason: "先方の返事が来週になると連絡があったため",
      })}
    />
  ),
  "f4-due-past": (t) => create(t, dueDialog("create", { month: "2026-11", selected: null, dateError: PAST })),
  "f4-dup-pick": (t) => create(t, <DuplicatePickDialog open query="請求書" items={SOURCES} />),
  "f4-dup-dialog": (t) => dup(t),
  "f4-dup-error": (t) =>
    dup(
      t,
      "複製できませんでした。ネットがつながっていないか、Kaname が混み合っています。もう一度「複製して開く」を押してください",
    ),
  "f4-home-empty": home,
};

export function renderCreate(id: string, theme: Theme): ReactNode | null {
  const build = BUILDERS[id];
  return build ? build(theme) : null;
}
