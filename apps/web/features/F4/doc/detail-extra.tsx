"use client";
// 詳細・確認項目に足した状態の部品（段 5・K-450・K-569・K-447）：確認項目の文をその場で直す・作る面のチェックの箱は押せない形・
//   詳細のパネルで会社の項目の値をその場で直す・本文を直す入口と帯と確かめの小窓。見た目だけ（値は props・口は呼ばない）
import type { ReactNode } from "react";
import { Band, Button, Dialog, NoticeBox, Select, TextArea, TextField } from "@/components/k";
import type { SpecLine } from "./views";
import "./extra.css";

const LOCKED = "チェックを外すと直せます";
const AFTER = "作ったあとに付けます";

// ---------------------------------------------------------------- 確認項目（文を直す・作る面の箱）
/** 確認項目の行。詳細は文を押して直す（チェックの付いた行は押せない）／作る面は箱を押せない形。editing の行は入力に替わっている */
export function SpecsItemV3({
  lines,
  mode,
  editing,
  compact = false,
  editText,
}: {
  lines: readonly SpecLine[];
  mode: "detail" | "create";
  editing?: string;
  compact?: boolean;
  /** 入力に替わった行に入れている字 */
  editText?: string;
}) {
  const create = mode === "create";
  return (
    <div className="k-f4d-specs" data-compact={compact}>
      <ul className="k-f4d-spec-list" aria-label="確認項目">
        {lines.map((l) => {
          const done = l.done === true;
          return (
            <li key={l.text} data-done={done}>
              <input
                type="checkbox"
                className="k-f4d-spec-box"
                defaultChecked={done}
                aria-label={l.text}
                {...(create
                  ? {
                      "aria-disabled": true,
                      title: AFTER,
                      onClick: (e: { preventDefault: () => void }) => e.preventDefault(),
                    }
                  : {})}
              />
              {editing === l.text ? (
                <div className="k-f4d-spec-edit">
                  <TextField label="確認項目の文" name="spec_edit" value={editText ?? l.text} readOnly />
                </div>
              ) : create ? (
                <span className="k-f4d-spec-text">{l.text}</span>
              ) : (
                <button
                  type="button"
                  className="k-f4d-spec-btn"
                  aria-label={`${l.text}を直す`}
                  {...(done ? { "aria-disabled": true, title: LOCKED, tabIndex: -1 } : {})}
                >
                  {l.text}
                </button>
              )}
              <Button variant="ghost" size="sm" aria-label={`${l.text}を外す`}>
                外す
              </Button>
            </li>
          );
        })}
      </ul>
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

/** 確認項目を足す小窓：書かずに「足す」を押した形（欄の下の赤い字） */
export function SpecAddErrorDialog() {
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
      <TextArea
        label="確かめること"
        name="spec_text"
        required
        rows={2}
        value=""
        readOnly
        error="確かめることを書いてください"
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------- 詳細のパネルで会社の項目の値をその場で直す
const val = (t: string): ReactNode => (
  <button type="button" className="k-f4d-valbtn" aria-label={`${t}を直す`}>
    {t}
  </button>
);
const BASE_VALUES: Record<string, ReactNode> = {
  支払期日: val("12/15（火）"),
  PJコード: val("SK-2026-11"),
  請求額: val("95,000 円"),
  分類: val("請求"),
};
const PJ = [
  { value: "a", label: "SK-2026-11 セイコー商事 保守" },
  { value: "b", label: "SK-2026-12 セイコー商事 追加開発" },
];

/** edit：請求額を直している／error：支払期日を空にして決めた（手元の確かめ）・PJコードの選び直し（口の断り） */
export function itemOverrides(kind: "edit" | "error"): Readonly<Record<string, ReactNode>> {
  if (kind === "edit") {
    return {
      ...BASE_VALUES,
      請求額: (
        <div className="k-f4d-editcell">
          <TextField label="請求額" name="c_amt" inputMode="numeric" value="95000" readOnly />
        </div>
      ),
    };
  }
  return {
    ...BASE_VALUES,
    支払期日: (
      <div className="k-f4d-editcell">
        <TextField
          label="支払期日"
          name="c_due"
          type="date"
          required
          value=""
          readOnly
          error="支払期日を選んでください"
        />
      </div>
    ),
    PJコード: (
      <div className="k-f4d-editcell">
        <Select
          label="PJコード"
          name="c_pj"
          required
          value="a"
          error="選べない値が含まれています。選択肢から選び直してください"
          options={PJ}
        />
      </div>
    ),
  };
}

// ---------------------------------------------------------------- 本文を直す（入口・帯・確かめの小窓）
export function EnterButton() {
  return (
    <Button variant="ghost" size="sm">
      本文を直す
    </Button>
  );
}

/** 上の帯：自動保存の印（失敗のときは字が替わる）・やめる・書き終える。印の title は「この PC」の注 */
export function EditBandMark({ failed = false }: { failed?: boolean }) {
  return (
    <div className="k-f4d-editband" role="status">
      <span
        data-kind={failed ? "failed" : "saved"}
        className={failed ? "k-f4d-savefail" : undefined}
        title="この PC のブラウザの中に残しています。ほかの端末では続きを書けません"
      >
        {failed
          ? "自動で保存できませんでした。書き終えるまで、この画面を閉じないでください"
          : "自動で保存しました（10:42）"}
      </span>
      <span className="k-f4d-editband-acts">
        <Button variant="outlined" size="sm">
          やめる
        </Button>
        <Button size="sm">書き終える</Button>
      </span>
    </div>
  );
}

export function ConflictBand() {
  return (
    <div className="k-f4d-notice">
      <Band
        tone="wait"
        role="alert"
        title="ほかの人が先に直しました"
        sub="読み直してから、もう一度直してください。"
        acts={
          <>
            <Button variant="outlined" size="sm">
              比べる
            </Button>
            <Button variant="outlined" size="sm">
              読み直す
            </Button>
          </>
        }
      />
    </div>
  );
}

export function SessionLostBand() {
  return (
    <div className="k-f4d-notice">
      <Band
        tone="danger"
        role="alert"
        title="ログインが切れました"
        sub="入り直すと、いま書いている内容は消えます。必要なら、先に別の場所へ写してください。"
        acts={
          <Button variant="outlined" size="sm">
            ログインし直す
          </Button>
        }
      />
    </div>
  );
}

export function FailBox() {
  return (
    <div className="k-f4d-notice">
      <NoticeBox>この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください</NoticeBox>
    </div>
  );
}

/** やめる確かめ：直した後に「やめる」を押したときだけ出る */
export function DiscardDialog() {
  return (
    <Dialog
      open
      onOpenChange={() => undefined}
      title="書いた内容を捨てますか"
      target="EG-119 セイコー商事の 11 月分の請求書を送る"
      actions={
        <>
          <Button variant="outlined">書き続ける</Button>
          <Button variant="danger">捨てる</Button>
        </>
      }
    >
      <p>やめると、いま書いている内容は消えます。</p>
    </Dialog>
  );
}
