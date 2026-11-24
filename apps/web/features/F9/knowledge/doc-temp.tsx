"use client";
// 【仮の部品】ナレッジのページの本文（道具の帯＋文書）。段 5 の本文の編集の部品（features/F4/doc/views.tsx の
//   DocBar・DocEditor・Checks と doc.css の .k-f4d-bar・.k-f4d-editor・.k-f4d-doc）と同じ見た目にそろえてある。
//   段 5 が本線に入ったら、この 1 枚と doc-temp.css を消して、そちらの部品に差し替える（受け口の名前と引数は同じ）
import type { ReactNode } from "react";
import "./doc-temp.css";

const TOOLS: readonly (ReactNode | "|")[] = [
  <b key="b">B</b>,
  <i key="i">I</i>,
  <span key="c">
    文字の色
    <span className="k-f9d-swatch" aria-hidden="true" />
  </span>,
  "|",
  "見出し",
  "・ 箇条書き",
  "☐ チェック",
  "表",
  "画像",
  "引用",
  "</>",
  "リンク",
];
const TOOL_NAMES = [
  "太字",
  "斜体",
  "文字の色",
  "見出し",
  "箇条書き",
  "チェック",
  "表",
  "画像",
  "引用",
  "コード",
  "リンク",
];

export function DocBar({ note }: { note?: ReactNode }) {
  let n = 0;
  return (
    <div role="toolbar" aria-label="本文の道具" className="k-f9d-bar">
      {TOOLS.map((t, i) => {
        if (t === "|") return <span key={i} className="k-f9d-bar-sep" aria-hidden="true" />;
        const name = TOOL_NAMES[n++];
        return (
          <button key={i} type="button" aria-label={name} title={name}>
            {t}
          </button>
        );
      })}
      {note ? <span className="k-f9d-bar-note">{note}</span> : null}
    </div>
  );
}

/** 帯＋文書（書いているとき） */
export function DocEditor({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="k-f9d-editor">
      <DocBar note={note} />
      <div className="k-f9d-doc" aria-label="本文">
        {children}
      </div>
    </div>
  );
}

/** 文書（読むとき） */
export function DocRead({ children }: { children: ReactNode }) {
  return (
    <div className="k-f9d-doc" aria-label="本文">
      {children}
    </div>
  );
}

/** 本文の中の、書いている場所の印 */
export function Caret() {
  return <span className="k-f9d-caret" aria-hidden="true" />;
}

/** ひな形の薄い字（例として入るだけ） */
export function Ghost({ children }: { children: ReactNode }) {
  return <p className="k-f9d-ghost">{children}</p>;
}
