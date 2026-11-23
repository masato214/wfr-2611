"use client";
// 段 5 の下絵の共通の枠と見本の値（作る面・詳細の両方が使う）。今の本線の外枠（Shell）・詳細の頭（detail-head.tsx）・
//   右のパネル（detail-panel.tsx と同じクラスと並び）をここで組む
import { Bot, PanelRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { DocTools, Prose, Shell, Toaster, useNotify, type Crumb, type Group } from "@/components/k";
import { DetailMeta, InertButton } from "@/features/F4/create-ticket/detail-head";
import "@/features/F4/create-ticket/create-ticket.css";
import "@/features/F4/create-ticket/ticket-detail.css";
import type { Theme } from "@/lib/theme";

// ---------------------------------------------------------------- 見本の値（全部の状態で同じ人・同じチケットにそろえる）
export const ME = { name: "高本", full: "高本 聖斗", initial: "高" } as const;
export const TICKET = {
  number: "EG-119",
  title: "問い合わせ（山田様）に一次返信する",
  created_at: "2026-11-20T00:40:00Z",
  start_on: "2026-11-20",
  due_on: "2026-11-27",
};
export const KIND = { name: "タスク", color: "#22345C" };
export const STAGE = { key: "doing", name: "作業中" };
export const GROUPS: Group[] = [
  { code: "EG", name: "営業", href: "/tickets?scope=eg", pending: true, tone: "teal" },
  { code: "JD", name: "受託開発", href: "/tickets?scope=jd", pending: true, tone: "plum" },
];
/** 詳細の見本の区画（種別タスクの先頭 2 つ＋実施事項） */
export const SECTIONS = [
  { key: "goal", label: "目的", text: "山田様の問い合わせ（保守の範囲）に、今日中に一次返信する" },
  { key: "done", label: "完了の条件", text: "山田様に一次返信のメールが届いている\n詳しい回答の期日を伝えている" },
];

// ---------------------------------------------------------------- 画面の組み立て
export function Frame({
  theme,
  crumbs,
  children,
  dialog,
}: {
  theme: Theme;
  crumbs: Crumb[];
  children: ReactNode;
  dialog?: ReactNode;
}) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="tickets"
        crumbs={crumbs}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: ME.name, initial: ME.initial }}
        groups={GROUPS}
        badges={{}}
        bridgeConnected={false}
        theme={theme}
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}

/** 小さな知らせ。開いたときに 1 回出す */
export function Toast({ title }: { title: string }) {
  const notify = useNotify();
  useEffect(() => {
    notify(title);
  }, [notify, title]);
  return null;
}

export interface PanelValues {
  /** 期限の行の中身（作る面の小窓・詳細の小窓を開く物） */
  due?: ReactNode;
  /** 親の行の中身 */
  parent?: ReactNode;
}

/** 詳細の右のパネル（今の detail-panel.tsx と同じクラスと並び） */
export function Panel({ values = {} }: { values?: PanelValues }) {
  const rows: [string, ReactNode][] = [
    ["担当者", ME.full],
    ["承認する人", ME.full],
  ];
  return (
    <aside aria-label="チケットのパネル" className="k-detail-panel">
      <button type="button" className="k-detail-panel-close" aria-label="パネルを閉じる" title="パネルを閉じる">
        <PanelRight size={16} aria-hidden="true" />
      </button>
      <nav aria-label="パネルのタブ" className="k-detail-tabs">
        <button type="button" aria-current="page">
          属性
        </button>
        <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          やり取り
        </button>
        <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          <Bot size={14} aria-hidden="true" />
          {`${ME.name}のAI`}
        </button>
      </nav>
      <div className="k-detail-panel-body">
        <section aria-label="担当" className="k-detail-panel-sec">
          <h2>担当</h2>
          <dl className="k-detail-fields">
            {rows.map(([k, val]) => (
              <div key={k} className="k-detail-field">
                <dt>{k}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-label="日付と時間" className="k-detail-panel-sec">
          <h2>日付と時間</h2>
          <dl className="k-detail-fields">
            <div className="k-detail-field">
              <dt>開始日</dt>
              <dd>11/20（金）</dd>
            </div>
            <div className="k-detail-field">
              <dt>期限</dt>
              <dd>{values.due ?? "11/27（金）"}</dd>
            </div>
          </dl>
        </section>
        <section aria-label="分類" className="k-detail-panel-sec">
          <h2>分類</h2>
          <dl className="k-detail-fields">
            <div className="k-detail-field">
              <dt>グループ</dt>
              <dd>営業（EG）</dd>
            </div>
            <div className="k-detail-field">
              <dt>優先度</dt>
              <dd>中</dd>
            </div>
            <div className="k-detail-field">
              <dt>親</dt>
              <dd>{values.parent ?? ""}</dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  );
}

/** 詳細の題名の行（今の detail-head.tsx の DetailTitle と同じクラスと並び。「…」だけ差し込める） */
function MockTitle({ title, me, more }: { title: string; me: string; more?: ReactNode }) {
  return (
    <header className="k-page-head">
      <div className="k-detail-title">
        <h1 id="ticket-title" title={title}>
          {title}
        </h1>
      </div>
      <div className="k-page-acts">
        <InertButton>複製</InertButton>
        <InertButton>
          <Bot size={13} aria-hidden="true" />
          {`${me}のAI と話す`}
        </InertButton>
        {more ?? (
          <InertButton label="ほかの操作" className="k-detail-more">
            …
          </InertButton>
        )}
      </div>
    </header>
  );
}

export interface DetailFrameProps {
  theme: Theme;
  /** 本文の区画の並び（無ければ見本の 2 区画を読むだけで出す） */
  doc?: ReactNode;
  /** 「本文の道具」の帯の右の物（版と差分のボタンなど。無ければ押せない版と差分） */
  tools?: ReactNode;
  /** 題名の行の「…」の差し込み（無ければ押せない「…」） */
  more?: ReactNode;
  /** 子・つながりの区画（無ければ押せない 2 つのボタン） */
  links?: ReactNode;
  panel?: PanelValues;
  dialog?: ReactNode;
  toast?: string;
}

/** チケットの詳細（今の ticket-detail.tsx と同じクラスと並び。差し込む物だけ props） */
export function DetailFrame({ theme, doc, tools, more, links, panel, dialog, toast }: DetailFrameProps) {
  return (
    <Frame
      theme={theme}
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: TICKET.number }]}
      dialog={
        <>
          {dialog}
          {toast ? <Toast title={toast} /> : null}
        </>
      }
    >
      <div className="k-detail">
        <section className="k-root k-page" aria-labelledby="ticket-title">
          <article className="k-detail-card">
            <DetailMeta ticket={TICKET} kind={KIND} stage={STAGE} />
            <MockTitle title={TICKET.title} me={ME.name} more={more} />
            <DocTools label="本文の道具" note="「/」で部品を入れる ・ 本文の版 1">
              {tools ?? (
                <InertButton size="sm" className="k-detail-versions">
                  版と差分
                </InertButton>
              )}
            </DocTools>
            <div className="k-detail-doc">
              {doc ??
                SECTIONS.map((s) => (
                  <section key={s.key} className="k-section" aria-label={s.label}>
                    <h2 id={`sec-${s.key}`}>{s.label}</h2>
                    <Prose>{s.text}</Prose>
                  </section>
                ))}
            </div>
          </article>
          {links ?? (
            <section className="k-detail-links" aria-label="子チケット・つながり">
              <div className="k-detail-links-head">
                <h2>子チケット・つながり</h2>
                <InertButton size="sm">子を足す</InertButton>
                <InertButton size="sm">つながりを足す</InertButton>
              </div>
            </section>
          )}
        </section>
        <Panel values={panel} />
      </div>
    </Frame>
  );
}
