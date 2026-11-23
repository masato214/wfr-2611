"use client";
// 詳細の組み立て（段 5 の作り直した下絵）。今の詳細（k-detail-*）と同じ外枠・題の行。項目は右のパネル。見た目だけ
import { Bot, PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { Callout, Dialog, Button, Select, TextArea } from "@/components/k";
import { DetailMeta, InertButton } from "@/features/F4/create-ticket/detail-head";
import { SpecsItem, type SpecLine } from "./views";
import { TalkBody } from "./thread-views";
import { Frame, KIND, ME, STAGE, TICKET } from "@/app/(dev)/dev/mock/f4/frame";
import "@/features/F4/create-ticket/ticket-detail.css";
import "@/features/F4/create-ticket/create-ticket.css";
import type { Theme } from "@/lib/theme";
import "./doc.css";
import "./extra.css";

function Item({ k, v, off }: { k: string; v: ReactNode; off?: boolean }) {
  return (
    <div className="k-detail-field" {...(off ? { "aria-disabled": "true", title: "まだ使えません" } : {})}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

/** 項目の並び（右のパネル）。会社が足した項目も、用意してある項目と同じ並びに入れる（見出しを分けない）。
 *  tab が talk のときは「やり取り」の流れ（人のコメントと更新の行）を出す */
export function ItemsPanel({
  specs,
  specsOpen,
  tab = "attr",
  group = false,
  overrides = {},
  specsSlot,
}: {
  specs: readonly SpecLine[];
  specsOpen: boolean;
  tab?: "attr" | "talk";
  /** 関連の先頭に読むだけの「グループ」の行を出す */
  group?: boolean;
  /** 行の名前 → 値の欄の中身（その場で直している入力など） */
  overrides?: Readonly<Record<string, ReactNode>>;
  /** 開いた確認項目の中身を替える */
  specsSlot?: ReactNode;
}) {
  const V = (k: string, v: ReactNode): ReactNode => overrides[k] ?? v;
  return (
    <aside aria-label="チケットのパネル" className="k-detail-panel">
      <button type="button" className="k-detail-panel-close" aria-label="パネルを閉じる" title="パネルを閉じる">
        <PanelRight size={16} aria-hidden="true" />
      </button>
      <nav aria-label="パネルのタブ" className="k-detail-tabs">
        <button type="button" aria-current={tab === "attr" ? "page" : undefined}>
          項目
        </button>
        <button type="button" aria-current={tab === "talk" ? "page" : undefined}>
          やり取り
        </button>
        <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          <Bot size={14} aria-hidden="true" />
          {`${ME.name}のAI`}
        </button>
      </nav>
      {tab === "talk" ? (
        <TalkBody />
      ) : (
        <div className="k-detail-panel-body">
          <section aria-label="担当" className="k-detail-panel-sec">
            <h2>担当</h2>
            <dl className="k-detail-fields">
              <Item k="担当者" v={V("担当者", ME.full)} />
              <Item k="承認する人" v={V("承認する人", ME.full)} />
              <Item k="優先度" v={V("優先度", "中")} />
            </dl>
          </section>
          <section aria-label="日付と時間" className="k-detail-panel-sec">
            <h2>日付と時間</h2>
            <dl className="k-detail-fields">
              <Item k="開始日" v={V("開始日", "11/21（土）")} />
              <Item k="期限" v={V("期限", "12/01（火）")} />
              <Item k="予定時間" v={V("予定時間", "2 時間")} />
              <Item k="支払期日" v={V("支払期日", "12/15（火）")} />
            </dl>
          </section>
          <section aria-label="関連" className="k-detail-panel-sec">
            <h2>関連</h2>
            <dl className="k-detail-fields">
              {group ? <Item k="グループ" v="営業（EG）" /> : null}
              <Item k="節目" v={V("節目", "11 月の締め")} />
              <Item k="親" v={V("親", "")} />
              <Item k="PJコード" v={V("PJコード", "SK-2026-11")} />
              <Item k="請求額" v={V("請求額", "95,000 円")} />
              <Item k="分類" v={V("分類", "請求")} />
            </dl>
          </section>
          <section aria-label="確認項目" className="k-detail-panel-sec">
            <h2>確認項目</h2>
            {specsOpen ? (
              (specsSlot ?? <SpecsItem lines={specs} compact />)
            ) : (
              <p className="k-f4d-hint">
                {`${specs.length} 件 ・ `}
                <button type="button" className="k-f4d-link">
                  開く
                </button>
              </p>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

export function DetailPage({
  theme,
  children,
  dialog,
  acts,
  specs = [],
  specsOpen = false,
  tab = "attr",
  panel = {},
}: {
  theme: Theme;
  children: ReactNode;
  dialog?: ReactNode;
  acts?: ReactNode;
  specs?: readonly SpecLine[];
  specsOpen?: boolean;
  tab?: "attr" | "talk";
  /** 右のパネルに足す物（グループの行・その場で直す入力・確認項目の中身） */
  panel?: { group?: boolean; overrides?: Readonly<Record<string, ReactNode>>; specsSlot?: ReactNode };
}) {
  const title = "セイコー商事の 11 月分の請求書を送る";
  return (
    <Frame theme={theme} crumbs={[{ label: "チケット", href: "/tickets" }, { label: TICKET.number }]} dialog={dialog}>
      <div className="k-detail">
        <section className="k-root k-page" aria-labelledby="ticket-title">
          <article className="k-detail-card">
            <DetailMeta ticket={TICKET} kind={KIND} stage={STAGE} />
            <header className="k-page-head">
              <div className="k-detail-title">
                <h1 id="ticket-title" title={title}>
                  {title}
                </h1>
              </div>
              <div className="k-page-acts">
                {acts ?? (
                  <>
                    <InertButton>複製</InertButton>
                    <InertButton>版と差分</InertButton>
                    <InertButton>
                      <Bot size={13} aria-hidden="true" />
                      AI に任せる
                    </InertButton>
                    <Button className="k-f4d-done">完了にする</Button>
                  </>
                )}
              </div>
            </header>
            {children}
          </article>
        </section>
        <ItemsPanel specs={specs} specsOpen={specsOpen} tab={tab} {...panel} />
      </div>
    </Frame>
  );
}

export function EditBand() {
  return (
    <div className="k-f4d-editband" role="status">
      <span>自動で保存しました（10:42）</span>
      <span className="k-f4d-editband-acts">
        <Button variant="outlined" size="sm">
          やめる
        </Button>
        <Button size="sm">書き終える</Button>
      </span>
    </div>
  );
}

export function CompleteDialog() {
  return (
    <Dialog
      open
      onOpenChange={() => undefined}
      title="完了にする"
      target="EG-119 セイコー商事の 11 月分の請求書を送る"
      actions={
        <>
          <Button variant="outlined">戻って付ける</Button>
          <Button className="k-f4d-done">このまま完了にする</Button>
        </>
      }
    >
      <Callout tone="warn" title="本文に、チェックのないやることが 2 つ残っています">
        完了にしても止めません。このままでよいかを決めてください。
      </Callout>
      <ul className="k-f4d-unchecked">
        <li>☐ 請求書を作って佐藤さんに確かめてもらう</li>
        <li>☐ 送ったあとに入金の予定日を控える</li>
      </ul>
      <Callout tone="warn" title="確認項目にチェックの付いていない物が 1 つあります">
        ☐ 請求額が明細の合計と合っている
      </Callout>
    </Dialog>
  );
}

const VERS = [
  { n: 3, by: "高本", at: "11/21 10:42", s: "本文に、完了の条件を足した" },
  { n: 2, by: "鈴木", at: "11/21 10:05", s: "本文に表と画像を足した" },
  { n: 1, by: "高本", at: "11/21 09:40", s: "作成" },
];
type DiffLine = { kind: "same" | "add" | "del"; text: string };
const DIFFS: Record<string, readonly DiffLine[]> = {
  本文: [
    { kind: "same", text: "目的：セイコー商事に 11 月分の請求を間違いなく届ける" },
    { kind: "add", text: "完了の条件：請求書が送られ、宛先が登録した連絡先と合っている" },
    { kind: "add", text: "完了の条件：支払期日が 12/15 になっている" },
    { kind: "del", text: "☐ 請求書を作る" },
    { kind: "add", text: "☐ 請求書を作って佐藤さんに確かめてもらう" },
    { kind: "add", text: "表：保守費用（11 月分）1 × 80,000 円 ／ 追加対応 2 × 15,000 円" },
    { kind: "add", text: "画像：先月の請求書の見本.png" },
  ],
  項目の変更: [
    { kind: "del", text: "期限：11/27（金）" },
    { kind: "add", text: "期限：12/01（火）" },
    { kind: "del", text: "担当者：鈴木 一郎" },
    { kind: "add", text: "担当者：高本 聖斗" },
    { kind: "add", text: "支払期日：12/15（火）" },
    { kind: "same", text: "優先度：中" },
  ],
};

const VERS_RESTORED = [{ n: 4, by: "高本", at: "11/21 11:20", s: "項目の変更を版 2 の形に戻した" }, ...VERS];
const DIFF_RESTORED: readonly DiffLine[] = [
  { kind: "del", text: "期限：12/01（火）" },
  { kind: "add", text: "期限：11/27（金）" },
  { kind: "del", text: "支払期日：12/15（火）" },
];

/** 項目を戻せなかったときの訳の並び（戻せた項目は並べず、差分の逆向きの行で見える） */
export function SkippedList({ items }: { items: readonly string[] }) {
  return (
    <div className="k-f4d-skipwrap">
      <p className="k-f4d-sub">戻せなかった項目</p>
      <ul className="k-f4d-skipped" aria-label="戻せなかった項目">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** restored：項目を戻した直後（版 4 が先頭・差分は版 3 → 版 4・戻せなかった項目の並び） */
export function VersionsView({ field, restored = false }: { field: "本文" | "項目の変更"; restored?: boolean }) {
  const vers = restored ? VERS_RESTORED : VERS;
  const top = restored ? 4 : 3;
  const from = restored ? 3 : 2;
  const diff = restored ? DIFF_RESTORED : (DIFFS[field] ?? []);
  return (
    <div className="k-f4d-ver">
      <aside className="k-f4d-ver-side" aria-label="版の一覧">
        <p className="k-f4d-sub">比べる物</p>
        <ul className="k-f4d-pick">
          {(["本文", "項目の変更"] as const).map((f) => (
            <li key={f}>
              <button type="button" aria-pressed={f === field}>
                {f}
              </button>
            </li>
          ))}
        </ul>
        <p className="k-f4d-sub k-f4d-vlist-wrap">{field}の版</p>
        <ol className="k-f4d-vlist k-f4d-vlist-wrap">
          {vers.map((v) => (
            <li key={v.n} data-from={v.n === from} data-to={v.n === top}>
              版 {v.n}
              {v.n === top ? "（いま）" : ""}
              <small>{`${v.by} ・ ${v.at} ・ ${v.s}`}</small>
            </li>
          ))}
        </ol>
      </aside>
      <div className="k-f4d-ver-main">
        <div className="k-f4d-items">
          <Select
            label="比べる元"
            name="from"
            value={String(from)}
            options={
              restored
                ? [
                    { value: "3", label: "版 3 ・ 高本 11/21 10:42" },
                    { value: "2", label: "版 2 ・ 鈴木 11/21 10:05" },
                  ]
                : [
                    { value: "2", label: "版 2 ・ 鈴木 11/21 10:05" },
                    { value: "1", label: "版 1 ・ 高本 11/21 09:40" },
                  ]
            }
          />
          <Select
            label="比べる先"
            name="to"
            value={String(top)}
            options={[
              { value: String(top), label: `版 ${top}（いま）・ 高本 ${restored ? "11/21 11:20" : "11/21 10:42"}` },
            ]}
          />
        </div>
        <p className="k-f4d-sub">{`${field}：版 ${from} → 版 ${top}`}</p>
        <ul className="k-f4d-diff" aria-label="差分">
          {diff.map((l) => (
            <li key={l.text} data-kind={l.kind}>
              {l.text}
            </li>
          ))}
        </ul>
        <div className="k-f4d-ver-acts">
          <Button variant="outlined">{`${field}を版 ${from} に戻す`}</Button>
          <Button variant="outlined">この差分をコピー</Button>
        </div>
        <p className="k-f4d-hint">{`戻すと、いまの版は消えずに新しい版（版 ${top + 1}）ができ、確認の結果が古くなります`}</p>
        {restored ? <SkippedList items={["担当者：担当者は「渡す」の流れで変えます"]} /> : null}
      </div>
    </div>
  );
}

/** 「AI に任せる」を押したが確認項目が 0 件：足すか、使わない理由を書くまで止まる */
export function NoSpecsDialog() {
  return (
    <Dialog
      open
      onOpenChange={() => undefined}
      title="AI に任せる"
      target="EG-119 セイコー商事の 11 月分の請求書を送る"
      actions={
        <>
          <Button variant="outlined" className="k-f4d-left">
            やめる
          </Button>
          <Button variant="outlined">確認項目を足す</Button>
          <Button disabled title="理由を書くか、確認項目を足してください">
            理由を書いて任せる
          </Button>
        </>
      }
    >
      <Callout tone="danger" title="確認項目がありません">
        足すか、使わない理由を書いてください。確認項目が無いと、終わったときに機械と人が確かめられません。
      </Callout>
      <TextArea
        label="確認項目を使わない理由"
        name="no_spec_reason"
        rows={3}
        required
        value=""
        readOnly
        placeholder="例：定型の作業で、送ったメールを見れば確かめられる"
      />
    </Dialog>
  );
}

/** 版と差分の頭：チケットの詳細の中で開く物だと分かるように、番号と題名・「詳細に戻る」を出す */
export function VersionsHead() {
  return (
    <header className="k-f4d-vhead">
      <a className="k-f4d-back" href="/dev/mock/f4v2/f4v2-detail-new">
        ← 詳細に戻る
      </a>
      <p className="k-f4d-vticket">
        <b>EG-119</b> セイコー商事の 11 月分の請求書を送る
      </p>
      <h1>版と差分</h1>
    </header>
  );
}

/** 確認項目を足す小窓：確かめることの 1 文だけ（誰が確かめるかは足すときに決めない） */
export function SpecAddDialog() {
  return (
    <Dialog
      open
      onOpenChange={() => undefined}
      title="確認項目を足す"
      target="EG-119 セイコー商事の 11 月分の請求書を送る"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>足す</Button>
        </>
      }
    >
      <TextArea label="確かめること" name="spec_text" required rows={2} value="PDF の合計が請求額と合う" readOnly />
    </Dialog>
  );
}
