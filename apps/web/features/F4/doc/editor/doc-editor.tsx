"use client";
// 本文を見たまま編集する部品（K-567）の入口。Tiptap と ProseMirror は編集のときだけ遅く読む（next/dynamic・ssr なし）。
//   読み込みの間は下絵と同じ枠（帯の場所と本文の箱）を先に出して、画面が跳ねないようにする。
//   使う側は doc を渡して onChange(doc) を受けるだけ（Tiptap・ProseMirror の型を見ない）
import dynamic from "next/dynamic";
import type { Doc } from "@kaname/contracts";
import { DocBar } from "../views";
import "../doc.css";
import "../extra.css";
import "./editor.css";

export interface DocEditorProps {
  doc: Doc;
  onChange: (doc: Doc) => void;
  /** 本文の編集欄の名前（既定『本文』） */
  ariaLabel?: string;
}

function Loading() {
  return (
    <div className="k-f4d-ed2" aria-busy="true">
      <div className="k-f4d-editor">
        <div className="k-f4d-barwrap" inert>
          <DocBar />
        </div>
        <div className="k-f4d-doc k-f4d-big" />
      </div>
    </div>
  );
}

export const DocEditor = dynamic<DocEditorProps>(() => import("./doc-editor-live"), {
  ssr: false,
  loading: () => <Loading />,
});
