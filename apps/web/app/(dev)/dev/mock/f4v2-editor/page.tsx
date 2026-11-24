"use client";
import Link from "next/link";
import { LIVE_PAGES } from "./live";

// 本文の道具の部品（本物）を置いた開発用の頁の索引（K-567）。正の絵は /dev/mock/f4v2
export default function MockF4V2EditorIndex() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f4v2-editor-title">
      <header className="k-page-head">
        <h1 id="mock-f4v2-editor-title">本文の道具の部品（開発用）</h1>
      </header>
      <ul>
        {LIVE_PAGES.map((id) => (
          <li key={id}>
            <Link href={`/dev/mock/f4v2-editor/${id}`}>{id}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
