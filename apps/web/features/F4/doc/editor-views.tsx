"use client";
// 本文の道具の小さな画面の下絵（段 5・K-567・K-568・K-587）：リンクの入力・文字の色の小さな画面・表のメニュー・貼れなかったときの知らせ。
//   見た目だけ（値は props・口は呼ばない）。帯は本物の下絵の DocBar（23 の道具・画像は押せない形・横に送る）。置く物は作る面の本文の欄に差し込む
import type { ReactNode } from "react";
import { Button, TextField } from "@/components/k";
import { BillTable, DocBar } from "./views";
import { TEXT_SWATCHES, type Swatch } from "./color-swatches";
import "./extra.css";

export type EditorPiece = "base" | "link" | "link-error" | "color" | "table" | "paste-fail";

const BAD_LINK = "http・https・mailto のリンクだけ使えます";

function LinkPop({ bad }: { bad: boolean }) {
  return (
    <div role="dialog" aria-label="リンク" className="k-f4d-pop k-f4d-pop-link" data-at="end">
      <p className="k-f4d-pop-title">リンク</p>
      <TextField
        label="リンク先"
        name="link_href"
        value={bad ? "javascript:alert(1)" : "https://www.seiko-shoji.example/invoice"}
        readOnly
        error={bad ? BAD_LINK : undefined}
      />
      <div className="k-f4d-pop-acts">
        <Button variant="ghost" size="sm">
          リンクを外す
        </Button>
        <Button size="sm">付ける</Button>
      </div>
    </div>
  );
}

/** 文字の色・背景の色の小さな画面：よく使う色の並び＋ほかの色（ブラウザの色の選び方）＋色を外す */
function ColorPop({ name, swatches, current }: { name: string; swatches: readonly Swatch[]; current: string }) {
  return (
    <div role="dialog" aria-label={name} className="k-f4d-pop k-f4d-colors" data-at="start">
      <p className="k-f4d-pop-title">{name}</p>
      <div className="k-f4d-swatches">
        {swatches.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-label={s.name}
            aria-pressed={s.value === current}
            title={s.name}
            className="k-f4d-swatchbtn"
          >
            {/* 色は文書の中身の値（データ）。見本の四角は SVG の塗りで描く（style で当てない・PM 2026-11-22 16:50） */}
            <svg aria-hidden="true" focusable="false" className="k-f4d-swatch-fill">
              <rect width="100%" height="100%" fill={s.value} />
            </svg>
          </button>
        ))}
      </div>
      <label className="k-f4d-othercolor">
        <span>ほかの色</span>
        <input type="color" aria-label="ほかの色" defaultValue={current} />
      </label>
      <Button variant="ghost" size="sm">
        色を外す
      </Button>
    </div>
  );
}

/** 表のメニュー：表を入れる（行と列の数）と、部品の表の命令を全部。表の外では入れる以外は押せない */
const TABLE_ITEMS: readonly (readonly string[])[] = [
  ["表を入れる（3 行 × 3 列）"],
  ["行を上に足す", "行を下に足す", "列を左に足す", "列を右に足す"],
  ["行を消す", "列を消す", "表を消す"],
  ["セルをつなぐ", "セルを分ける"],
  ["見出しの行にする", "見出しの列にする", "見出しのセルにする"],
];
function TableMenu() {
  return (
    <div role="menu" aria-label="表" className="k-f4d-pop k-f4d-menu" data-at="end">
      {TABLE_ITEMS.map((group, gi) => (
        <div key={gi} role="group" className="k-f4d-menu-group">
          {group.map((label) => (
            <button key={label} type="button" role="menuitem" data-active={gi === 0 && label.startsWith("表を入れる")}>
              {label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Doc({ piece }: { piece: EditorPiece }) {
  const sel = (t: string): ReactNode =>
    piece === "color" || piece === "link" || piece === "link-error" ? <span className="k-f4d-sel">{t}</span> : t;
  return (
    <>
      <h2>目的</h2>
      <p>セイコー商事に 11 月分の請求を間違いなく届ける。</p>
      <h2>前提と制約</h2>
      <p>
        <b>支払期日は 12/15</b>。
        {piece === "color" ? sel("月末の締めを過ぎると翌月分になる") : "月末の締めを過ぎると翌月分になる"}ので、
        <span className="k-f4d-sample-ink">今週中</span>に<span className="k-f4d-sample-mark">送る</span>。
      </p>
      <BillTable caret={piece === "table"} />
      <h2>参考</h2>
      <p>
        {piece === "link" || piece === "link-error" ? sel("先月の請求書の見本") : "先月の請求書の見本"}
        を見て書式をそろえる。
      </p>
    </>
  );
}

/** 作る面の本文の欄に差し込む（本文の道具の小さな画面を開いた形） */
export function EditorDemo({ piece }: { piece: EditorPiece }) {
  const active =
    piece === "link" || piece === "link-error"
      ? "リンク"
      : piece === "color"
        ? "文字の色"
        : piece === "table"
          ? "表"
          : undefined;
  return (
    <div className="k-f4d-ed2">
      <div className="k-f4d-editor">
        <div className="k-f4d-barwrap">
          <DocBar {...(active ? { active } : {})} />
          {piece === "link" || piece === "link-error" ? <LinkPop bad={piece === "link-error"} /> : null}
          {piece === "color" ? (
            <ColorPop name="文字の色" swatches={TEXT_SWATCHES} current={TEXT_SWATCHES[2]!.value} />
          ) : null}
          {piece === "table" ? <TableMenu /> : null}
        </div>
        <div className="k-f4d-doc" aria-label="本文">
          <div className="k-f4d-big">
            <Doc piece={piece} />
          </div>
        </div>
        <p className="k-f4d-md-note">Markdown を貼ると変換します</p>
        {piece === "paste-fail" ? (
          <p role="status" className="k-f4d-editnote">
            貼る文が大きすぎるか入れ子が深すぎるため、貼れませんでした
          </p>
        ) : null}
      </div>
    </div>
  );
}
