"use client";
// 作る面に足した状態の部品（段 5・K-442・K-569・K-580）：頭（作り方・保存の状態・下書きのまま閉じる）・グループの欄・
//   必須の型ごとの誤り・足したつながりの並びと相手を選ぶ小窓。見た目だけ（値は props・口は呼ばない）
import type { ReactNode } from "react";
import { Badge, Button, Dialog, Select, TextArea, TextField } from "@/components/k";
import { Pair } from "./views";
import "@/features/F4/links/links.css";
import "./extra.css";

const NOT_YET = ["AI と話して作る", "過去のチケットから複製"] as const;

/** 頭：見出し・作り方・下書きの保存の状態・右に「下書きのまま閉じる」と「作る」 */
export function CreateHeadFull({ saved }: { saved: string }) {
  return (
    <header className="k-f4d-head k-f4d-headfull">
      <h1 id="create-ticket-title" title="チケットを作る">
        チケットを作る
      </h1>
      <span className="k-create-how" aria-label="作り方">
        <span aria-current="true">自分で書く</span>
        {NOT_YET.map((n) => (
          <span key={n} aria-disabled="true" title={`${n}（準備中）`}>
            {n}
          </span>
        ))}
      </span>
      <span className="k-create-saved" role="status" aria-label="下書きの保存">
        {saved}
      </span>
      <div className="k-f4d-head-acts">
        <Button variant="outlined">下書きのまま閉じる</Button>
        <Button>作る</Button>
      </div>
    </header>
  );
}

/** 書けるグループが 2 つ以上の人にだけ、種別の左に出す */
export function GroupField() {
  return (
    <div className="k-f4d-kind">
      <Select
        label="グループ"
        name="group"
        required
        value="eg"
        options={[
          { value: "eg", label: "営業（EG）" },
          { value: "jd", label: "受託開発（JD）" },
        ]}
      />
    </div>
  );
}

const NEED = {
  text: "を書いてください",
  num: "を入れてください",
  pick: "を選んでください",
  check: "にチェックを付けてください",
} as const;

/** 会社の項目 7 つの型が全部必須で、全部が空のまま「作る」を押した形（型ごとの言い方） */
export function RequiredTypes() {
  return (
    <>
      <Pair name="先方の担当者名" required>
        <TextField
          label="先方の担当者名"
          name="t1"
          required
          description="請求書の宛名に入れます"
          error={`先方の担当者名${NEED.text}`}
          value=""
          readOnly
        />
      </Pair>
      <Pair name="社内メモ" required full>
        <TextArea
          label="社内メモ"
          name="t7"
          required
          rows={2}
          description="社内だけで共有する補足"
          error={`社内メモ${NEED.text}`}
          value=""
          readOnly
        />
      </Pair>
      <Pair name="請求額" required>
        <TextField
          label="請求額"
          name="c_amt"
          required
          inputMode="numeric"
          description="税込の金額（円）"
          error={`請求額${NEED.num}`}
          value=""
          readOnly
        />
      </Pair>
      <Pair name="支払期日" required>
        <TextField
          label="支払期日"
          name="c_due"
          type="date"
          required
          description="請求書に書く支払の期日"
          error={`支払期日${NEED.pick}`}
          value=""
          readOnly
        />
      </Pair>
      <Pair name="分類" required>
        <Select
          label="分類"
          name="t4"
          required
          placeholder="選ぶ"
          description="請求・問い合わせ・手続きなど"
          error={`分類${NEED.pick}`}
          options={[{ value: "a", label: "請求" }]}
        />
      </Pair>
      <Pair name="送る書類" required>
        <fieldset className="k-f4d-multi">
          <legend className="k-f4d-sr">送る書類</legend>
          {["請求書", "明細", "納品書"].map((d) => (
            <label key={d}>
              <input type="checkbox" /> {d}
            </label>
          ))}
          <p className="k-err" role="alert">{`送る書類${NEED.pick}`}</p>
        </fieldset>
      </Pair>
      <Pair name="原本の郵送" required>
        <div className="k-f4d-reqrow">
          <label className="k-f4d-check">
            <input type="checkbox" /> 原本を郵送する
          </label>
          <p className="k-err" role="alert">{`原本の郵送${NEED.check}`}</p>
        </div>
      </Pair>
    </>
  );
}

// ---------------------------------------------------------------- つながり（作る前に相手を選んで、作るとき一緒に張る）
export interface ChosenLink {
  kind: "派生元" | "関連";
  no: string;
  title: string;
  stage: string;
  tone: "success" | "progress" | "neutral";
}
export const CHOSEN: readonly ChosenLink[] = [
  { kind: "派生元", no: "EG-110", title: "山田様からの問い合わせを受ける", stage: "完了", tone: "success" },
  { kind: "関連", no: "EG-097", title: "セイコー様 保守契約の見積", stage: "完了", tone: "success" },
];

/** 「＋ つながりを足す」の行と、足した相手の並び（派生元が関連より前） */
export function ChosenLinks({ rows }: { rows: readonly ChosenLink[] }) {
  return (
    <div className="k-f4d-chosen-wrap">
      <button type="button" className="k-f4d-addlink">
        ＋ つながりを足す<span className="k-f4d-hint">関連・派生元のチケットを足します</span>
      </button>
      <ul className="k-f4d-chosen" aria-label="足したつながり">
        {rows.map((r) => (
          <li key={r.no} className="k-f4d-chosen-row">
            <span className="k-f4d-chosen-kind">{r.kind}</span>
            <b className="k-f4d-chosen-no">{r.no}</b>
            <span className="k-f4d-chosen-title">{r.title}</span>
            <Badge tone={r.tone}>{r.stage}</Badge>
            <Button variant="ghost" size="sm" aria-label={`${r.no} とのつながりを外す`}>
              外す
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KINDS: readonly { k: "related" | "derived"; label: string; help: string }[] = [
  { k: "related", label: "関連", help: "つながりがあるだけ。順番は決めない" },
  { k: "derived", label: "派生元", help: "このチケットは、選んだチケットから生まれた" },
];
const CANDS: readonly {
  no: string;
  title: string;
  group: string;
  stage: string;
  tone: ChosenLink["tone"];
  linked?: boolean;
  on?: boolean;
}[] = [
  {
    no: "EG-110",
    title: "山田様からの問い合わせを受ける",
    group: "営業",
    stage: "完了",
    tone: "success",
    linked: true,
  },
  { no: "EG-097", title: "セイコー様 保守契約の見積", group: "営業", stage: "完了", tone: "success", on: true },
  { no: "JD-150", title: "京蟻 保守運用（年間）", group: "受託開発", stage: "作業中", tone: "progress" },
];

/** つながりを足す小窓の作る面の形：「子チケットを作る」のタブは無く、対象は作成中、主ボタンは「足す」 */
export function CreateLinkAddDialog({ title }: { title: string }): ReactNode {
  return (
    <Dialog
      open
      onOpenChange={() => undefined}
      title="つながりを足す"
      target={`作成中：${title}`}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>足す</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <fieldset className="k-dialog-group">
          <legend>つながりの種類</legend>
          <div className="k-f4-links-types">
            {KINDS.map((x) => (
              <label key={x.k} className="k-dialog-check">
                <input type="radio" name="link-kind" defaultChecked={x.k === "related"} />
                <span>
                  {x.label}
                  <small>{x.help}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <TextField label="チケットを探す" name="link-query" placeholder="番号か題名で探す" value="保守" readOnly />
        <ul className="k-f4-links-cands" aria-label="候補">
          {CANDS.map((c) => (
            <li key={c.no}>
              <button
                type="button"
                className="k-f4-links-cand"
                aria-pressed={c.on === true}
                {...(c.linked ? { "aria-disabled": true, tabIndex: -1 } : {})}
              >
                <span className="k-f4-links-no">{c.no}</span>
                <span className="k-f4-links-title">{c.title}</span>
                <span className="k-f4-links-no">{c.group}</span>
                <Badge tone={c.tone}>{c.stage}</Badge>
                {c.linked ? <span className="k-f4-links-no">もうつながっている</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
