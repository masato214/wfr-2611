"use client";
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 5 の下絵（作り直し）の索引。1 行 ＝ 1 つの状態
export default function MockF4V2Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f4v2-title">
      <header className="k-page-head">
        <h1 id="mock-f4v2-title">段 5 のモック（作り直し）</h1>
      </header>
      <ul>
        {MOCKS.map((m) => (
          <li key={m.id}>
            <Link href={`/dev/mock/f4v2/${m.id}`}>{m.label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
