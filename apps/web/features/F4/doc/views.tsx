"use client";
// 段 5 の作り直した下絵の部品（項目の表＋自由な本文＋確認項目）。見た目だけ・値は props・口は呼ばない。
//   本番では段 5 の葉が本物のデータと動きをつなぐ。色・字・余白は doc.css（正本のトークンだけ）
import type { ReactNode } from "react";
import { Button, Select, TextArea, TextField } from "@/components/k";
import { ParentEntry } from "@/features/F4/parent/views";
import { NotifyPicker } from "@/features/F4/create-ticket/notify-picker";
import { BAR_GROUPS } from "./bar-tools";
import "./doc.css";
import "./extra.css";

const noop = (): void => undefined;
export const WHY = "まだ使えません";
export const PEOPLE = [
  { value: "m1", label: "高本 聖斗" },
  { value: "m2", label: "鈴木 一郎" },
  { value: "m3", label: "佐藤 花子" },
];

// ---------------------------------------------------------------- 本文の道具の帯（道具の並びと名前は ./bar-tools.tsx）
export function DocBar({ active }: { active?: string }) {
  return (
    <div role="toolbar" aria-label="本文の道具" className="k-f4d-bar">
      {BAR_GROUPS.map((group, gi) => (
        <span key={gi} className="k-f4d-bar-group" role="group">
          {group.map((t) => (
            <button
              key={t.name}
              type="button"
              aria-label={t.name}
              title={t.off ? WHY : t.name}
              {...(t.pop ? { "aria-haspopup": t.pop } : {})}
              {...(t.off ? { "aria-disabled": true, tabIndex: -1 } : {})}
              {...(active === t.name ? { "aria-expanded": true } : {})}
            >
              {t.label}
              {t.pop ? (
                <svg className="k-f4d-chev" viewBox="0 0 10 6" aria-hidden="true" focusable="false">
                  <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              ) : null}
            </button>
          ))}
        </span>
      ))}
    </div>
  );
}

/** 帯＋文書（作る面・書いている詳細） */
export function DocEditor({
  children,
  writing = false,
  note,
}: {
  children: ReactNode;
  writing?: boolean;
  note?: ReactNode;
}) {
  return (
    <div className="k-f4d-editor" data-writing={writing}>
      <DocBar />
      <div className="k-f4d-doc" aria-label="本文">
        {children}
      </div>
      {note ? <p className="k-f4d-md-note">{note}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- 文書の中身（見たままの描き）
export function Checks({ items }: { items: readonly { text: string; done: boolean }[] }) {
  return (
    <ul className="k-f4d-checks">
      {items.map((c) => (
        <li key={c.text} data-done={c.done}>
          <input type="checkbox" defaultChecked={c.done} aria-label={c.text} />
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}
export function Img({ caption }: { caption: string }) {
  return (
    <figure className="k-f4d-img">
      <div className="k-f4d-img-box" role="img" aria-label={caption}>
        画像
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
export function BillTable({ caret = false }: { caret?: boolean }) {
  return (
    <div className="k-f4d-tablewrap">
      <table>
        <thead>
          <tr>
            <th {...(caret ? { "data-caret": true } : {})}>項目</th>
            <th>数量</th>
            <th>単価</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>保守費用（11 月分）</td>
            <td>1</td>
            <td>80,000 円</td>
          </tr>
          <tr>
            <td>追加対応</td>
            <td>2</td>
            <td>15,000 円</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 種別のひな形（見出しと薄い字の説明。目的・完了の条件も本文の中の見出し） */
export function Template() {
  const g: readonly [string, string][] = [
    ["目的", "このチケットで何を実現したいかを書きます"],
    ["完了の条件", "どうなれば終わりかを書きます"],
    ["実施事項", "やることを 1 行ずつ書き、済んだらチェックを付けます"],
    ["前提と制約", "守ってほしい条件や、決まっている範囲があれば書きます"],
    ["参考", "元のメールや資料のリンクを貼ります"],
  ];
  return (
    <>
      {g.map(([h, t]) => (
        <section key={h}>
          <h2 className="k-f4d-ghost-h">{h}</h2>
          <p className="k-f4d-ghost">{t}</p>
        </section>
      ))}
    </>
  );
}

/** ひな形を消して白紙から自由に書いた本文（見出しなし・普通の文章と箇条書きだけ） */
export function BlankDoc() {
  return (
    <>
      <p>セイコー商事の 11 月分の請求書を、今週中に佐藤さんの確認を通して送る。</p>
      <p>支払期日は 12/15。先月と同じ書式でよい。</p>
      <ul>
        <li>明細を集める</li>
        <li>請求書を作って佐藤さんに見てもらう</li>
        <li>送ったら入金の予定日を控える</li>
      </ul>
    </>
  );
}

/** 自由に書いた本文。long で長く書いたとき（補足の節・表・画像を足す） */
export function FreeDoc({ writing = false, long = false }: { writing?: boolean; long?: boolean }) {
  return (
    <>
      <h2>目的</h2>
      <p>セイコー商事に 11 月分の請求を間違いなく届ける。</p>
      <h2>完了の条件</h2>
      <ul>
        <li>請求書が送られ、宛先が登録した連絡先と合っている</li>
        <li>支払期日が 12/15 になっている</li>
      </ul>
      <h2>実施事項</h2>
      <Checks
        items={[
          { text: "セイコー商事の 11 月分の明細を集める", done: true },
          { text: "請求書を作って佐藤さんに確かめてもらう", done: false },
          { text: "送ったあとに入金の予定日を控える", done: false },
        ]}
      />
      <h2>前提と制約</h2>
      <p>
        <b>支払期日は 12/15</b>。<span data-c="red">月末の締めを過ぎると翌月分になる</span>ので、
        <mark>今週中</mark>に送る。
        {writing ? <span className="k-f4d-caret" aria-hidden="true" /> : null}
      </p>
      <BillTable />
      <h2>参考</h2>
      <blockquote className="k-f4d-quote">先月と同じ書式でお願いします（セイコー商事・経理）</blockquote>
      <Img caption="先月の請求書の見本.png" />
      {long ? (
        <>
          <h2>補足：過去の経緯</h2>
          <p>
            10 月分は追加対応が<span data-c="teal">3 件</span>あり、明細を分けて載せた。<b>今月も同じ形</b>にする。
          </p>
          <ul>
            <li>先方の経理担当は山田さん（変わっていないか送る前に確かめる）</li>
            <li>請求書の宛名は「セイコー商事 株式会社 御中」</li>
            <li>送付はメールに PDF を添付する（郵送は不要）</li>
          </ul>
          <h2>補足：確かめたい点</h2>
          <Checks
            items={[
              { text: "追加対応の単価が見積と合っている", done: false },
              { text: "消費税の計算が合っている", done: false },
            ]}
          />
          <Img caption="10 月分の送付メール.png" />
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- 項目の表（2 列・左に薄い字の名前、右に入力）
/** 1 つの組（名前と入力）。入力は k の部品で、その部品の名前（label）は見えない形にして、左の名前に読み上げをつなぐ */
export function Pair({
  name,
  required = false,
  children,
  full = false,
}: {
  name: string;
  required?: boolean;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className="k-f4d-pair" data-full={full}>
      <span className="k-f4d-name" aria-hidden="true">
        {name}
        {required ? <span className="k-f4d-req-mark"> ＊</span> : null}
      </span>
      <div className="k-f4d-cell">{children}</div>
    </div>
  );
}

export interface SpecLine {
  /** 確かめること */
  text: string;
  /** チェックが付いている（済み） */
  done?: boolean;
}
export const SPEC_LINES: readonly SpecLine[] = [
  { text: "請求書が宛先に届いている" },
  { text: "支払期日が 12/15 になっている" },
  { text: "請求額が明細の合計と合っている" },
  { text: "送る前に文面を目で見る" },
];
/** 詳細の見本：チェックの付いた行と付いていない行 */
export const SPEC_DETAIL: readonly SpecLine[] = [
  { text: "請求書が宛先に届いている", done: true },
  { text: "PDF の合計が請求額と合う", done: true },
  { text: "請求額が明細の合計と合っている" },
  { text: "承認する人が中身を見る", done: true },
  { text: "送る前に文面を目で見る" },
];

/** 確認項目（項目の表の中の 1 つの項目）。行は「チェックの箱＋確かめること」と右に「外す」だけ。0 件は 1 行の説明 */
export function SpecsItem({ lines, compact = false }: { lines: readonly SpecLine[]; compact?: boolean }) {
  return (
    <div className="k-f4d-specs" data-compact={compact}>
      {lines.length === 0 ? (
        <p className="k-f4d-hint">確認項目はまだありません。足すと、終わったときに機械と人が確かめます</p>
      ) : (
        <ul className="k-f4d-spec-list" aria-label="確認項目">
          {lines.map((l) => (
            <li key={l.text} data-done={l.done === true}>
              <label className="k-f4d-spec-text">
                <input type="checkbox" className="k-f4d-spec-box" defaultChecked={l.done === true} />
                <span>{l.text}</span>
              </label>
              <Button variant="ghost" size="sm" aria-label={`${l.text}を外す`}>
                外す
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="k-f4d-spec-acts">
        <Button variant="outlined" size="sm">
          ＋ 確認項目を足す
        </Button>
        <Button variant="outlined" size="sm" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          AI の案を出す
        </Button>
      </div>
    </div>
  );
}

export function ItemsTable({
  specs,
  all = false,
  errors = {},
  customSlot,
  specsSlot,
}: {
  specs: readonly SpecLine[];
  all?: boolean;
  errors?: CustomErrors;
  /** 会社の項目の行を、この並びに替える（必須の型ごとの誤りの下絵） */
  customSlot?: ReactNode;
  /** 確認項目の中身を替える（作る面でチェックの箱を押せない形にした下絵） */
  specsSlot?: ReactNode;
}) {
  return (
    <div className="k-f4d-grid" role="group" aria-label="項目">
      <Pair name="状態">
        <Select
          label="状態"
          name="stage"
          value="todo"
          options={[
            { value: "todo", label: "未着手" },
            { value: "doing", label: "作業中" },
          ]}
        />
      </Pair>
      <Pair name="担当者" required>
        <div className="k-f4d-inline">
          <Select label="担当者" name="assignee" required value="m1" options={PEOPLE} />
          <Button variant="outlined" size="sm">
            私が担当
          </Button>
        </div>
      </Pair>
      <Pair name="優先度">
        <Select
          label="優先度"
          name="priority"
          value="mid"
          options={[
            { value: "mid", label: "中" },
            { value: "high", label: "高" },
          ]}
        />
      </Pair>
      <Pair name="節目">
        <Select label="節目" name="milestone" placeholder="選ぶ" options={[{ value: "m", label: "11 月の締め" }]} />
      </Pair>
      <Pair name="開始日">
        <TextField label="開始日" name="start_on" type="date" value="2026-11-21" readOnly />
      </Pair>
      <Pair name="期限" required>
        <div className="k-f4d-inline">
          <TextField label="期限" name="due_on" type="date" required value="2026-12-01" readOnly />
          <Button variant="outlined" size="sm">
            期限の早見
          </Button>
        </div>
      </Pair>
      <Pair name="予定時間">
        <TextField
          label="予定時間"
          name="est"
          value="2"
          description="このチケットにかかる見込みの時間です。例：1、0.25、36"
          readOnly
        />
      </Pair>
      <Pair name="実績時間">
        <TextField label="実績時間" name="act" value="" description="かかった作業時間です" readOnly />
      </Pair>
      <Pair name="親">
        <ParentEntry parent={null} onOpen={noop} />
      </Pair>
      {customSlot ?? <CustomPairs all={all} errors={errors} />}
      <Pair name="確認項目" full>
        {specsSlot ?? <SpecsItem lines={specs} />}
      </Pair>
    </div>
  );
}

// ---------------------------------------------------------------- 会社が足した項目（分けず、用意してある項目と同じ表に続けて並べる）
export interface CustomErrors {
  due?: string;
  pj?: string;
}
function CustomPairs({ all, errors }: { all: boolean; errors: CustomErrors }) {
  return (
    <>
      <Pair name="支払期日" required>
        <TextField
          label="支払期日"
          name="c_due"
          type="date"
          required
          description="請求書に書く支払の期日"
          error={errors.due}
          value=""
          readOnly
        />
      </Pair>
      <Pair name="PJコード" required>
        <Select
          label="PJコード"
          name="c_pj"
          required
          placeholder="選ぶ"
          description="案件ごとのコードを選びます"
          error={errors.pj}
          options={[
            { value: "a", label: "SK-2026-11 セイコー商事 保守" },
            { value: "b", label: "SK-2026-12 セイコー商事 追加開発" },
          ]}
        />
      </Pair>
      <Pair name="請求額">
        <TextField label="請求額" name="c_amt" inputMode="numeric" description="税込の金額（円）" value="" readOnly />
      </Pair>
      {all ? (
        <>
          <Pair name="先方の担当者名">
            <TextField label="先方の担当者名" name="t1" description="請求書の宛名に入れます" value="" readOnly />
          </Pair>
          <Pair name="分類">
            <Select
              label="分類"
              name="t4"
              placeholder="選ぶ"
              description="請求・問い合わせ・手続きなど"
              options={[{ value: "a", label: "請求" }]}
            />
          </Pair>
          <Pair name="送る書類">
            <fieldset className="k-f4d-multi">
              <legend className="k-f4d-sr">送る書類</legend>
              <label>
                <input type="checkbox" defaultChecked /> 請求書
              </label>
              <label>
                <input type="checkbox" defaultChecked /> 明細
              </label>
              <label>
                <input type="checkbox" /> 納品書
              </label>
              <p className="k-f4d-hint">送るものをすべて選びます</p>
            </fieldset>
          </Pair>
          <Pair name="原本の郵送">
            <label className="k-f4d-check">
              <input type="checkbox" /> 原本を郵送する
            </label>
          </Pair>
          <Pair name="社内メモ" full>
            <TextArea label="社内メモ" name="t7" rows={2} description="社内だけで共有する補足" value="" readOnly />
          </Pair>
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- 作る面（Backlog の「課題の追加」と同じ並び）
export interface CreateProps {
  titleValue?: string;
  body: "template" | "free" | "long" | "blank";
  specs?: readonly SpecLine[];
  allCustom?: boolean;
  errors?: { title?: string; due?: string; pj?: string };
  /** 頭を替える（作り方・下書きの保存の状態・「下書きのまま閉じる」を足した形） */
  head?: ReactNode;
  /** 種別の左に出すグループの欄 */
  group?: ReactNode;
  /** 本文の欄を替える（本文の道具の小さな画面を開いた形） */
  editor?: ReactNode;
  /** 「＋ つながりを足す」の行を替える（足した相手の並びつき） */
  links?: ReactNode;
  specsSlot?: ReactNode;
  customSlot?: ReactNode;
}

export function CreateForm({
  titleValue = "",
  body,
  specs = [],
  allCustom = false,
  errors = {},
  head,
  group,
  editor,
  links,
  specsSlot,
  customSlot,
}: CreateProps) {
  return (
    <form className="k-f4d-page" noValidate>
      {head ?? (
        <header className="k-f4d-head">
          <h1 id="create-ticket-title">チケットを作る</h1>
          <Button>作る</Button>
        </header>
      )}
      <div className="k-f4d-parent">
        <ParentEntry parent={null} onOpen={noop} />
      </div>
      {group ? (
        <div className="k-f4d-kind-row">
          {group}
          <div className="k-f4d-kind">
            <Select label="種別" name="kind" required value="task" options={[{ value: "task", label: "タスク" }]} />
          </div>
        </div>
      ) : (
        <div className="k-f4d-kind">
          <Select label="種別" name="kind" required value="task" options={[{ value: "task", label: "タスク" }]} />
        </div>
      )}
      <TextField
        label="題名"
        name="title"
        required
        value={titleValue}
        readOnly
        placeholder="題名"
        error={errors.title}
      />
      <section className="k-f4d-box" aria-label="本文">
        {body === "blank" ? null : (
          <div className="k-f4d-tplnote">
            <span>種別「タスク」のひな形が入っています。消しても、自由に書き換えても構いません</span>
            <Button variant="ghost" size="sm">
              ひな形を消す
            </Button>
          </div>
        )}
        {editor ?? (
          <DocEditor note="Markdown を貼ると変換します">
            <div className="k-f4d-big" data-long={body === "long"}>
              {body === "template" ? (
                <Template />
              ) : body === "blank" ? (
                <BlankDoc />
              ) : (
                <FreeDoc long={body === "long"} />
              )}
            </div>
          </DocEditor>
        )}
        {links ?? (
          <button type="button" className="k-f4d-addlink">
            ＋ つながりを足す<span className="k-f4d-hint">関連・派生元のチケットを足します</span>
          </button>
        )}
        <ItemsTable
          specs={specs}
          all={allCustom}
          errors={{ ...(errors.due ? { due: errors.due } : {}), ...(errors.pj ? { pj: errors.pj } : {}) }}
          {...(customSlot ? { customSlot } : {})}
          {...(specsSlot ? { specsSlot } : {})}
        />
      </section>
      <div className="k-create-drop" role="group" aria-label="ファイルを置く" aria-disabled="true">
        ファイルをここに置くか、貼り付ける
        <Button variant="outlined" size="sm" disabled title="ファイルを選ぶ（まだ使えません）">
          ファイルを選ぶ
        </Button>
      </div>
      <NotifyPicker
        people={[
          { id: "m2", display_name: "鈴木 一郎" },
          { id: "m3", display_name: "佐藤 花子" },
        ]}
        chosen={[]}
        onChange={() => undefined}
      />
    </form>
  );
}

// ---------------------------------------------------------------- 詳細
export function BodyView({
  children,
  writing = false,
  enter,
}: {
  children: ReactNode;
  writing?: boolean;
  enter?: ReactNode;
}) {
  return (
    <section className="k-f4d-body-wrap" aria-label="本文">
      {enter ? <div className="k-f4d-enter">{enter}</div> : null}
      {writing ? <DocEditor writing>{children}</DocEditor> : <div className="k-f4d-doc">{children}</div>}
    </section>
  );
}
export function Results() {
  return (
    <>
      <section className="k-f4d-result" aria-label="成果物">
        <h2>成果物</h2>
        <ul>
          <li className="k-f4d-file">
            <b>請求書.pdf</b>
            <small>184 KB ・ AI が作成 11/21 09:12</small>
          </li>
        </ul>
      </section>
      <section className="k-f4d-result" aria-label="決定ログ">
        <h2>決定ログ</h2>
        <ul>
          <li className="k-f4d-log">
            <span>追加対応は 2 件を明細に分けて載せる</span>
            <small>11/21 09:05 ・ 高本</small>
          </li>
          <li className="k-f4d-log">
            <span>支払期日は先方の締めに合わせて 12/15 にする</span>
            <small>11/21 09:08 ・ AI（高本の分身）</small>
          </li>
        </ul>
      </section>
      <section className="k-f4d-result" aria-label="申し送り">
        <h2>申し送り</h2>
        <p className="k-f4d-handoff">
          宛先の経理担当が変わっていないか、送る前に佐藤さんが目で確かめてください（11/21 高本）
        </p>
      </section>
    </>
  );
}
