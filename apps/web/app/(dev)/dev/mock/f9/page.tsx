"use client";
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 10 の下絵（作り直し 2026-11-21）の索引。1 行 ＝ 1 つの状態
export default function MockF9Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f9-title">
      <header className="k-page-head">
        <h1 id="mock-f9-title">段 10 のモック（作り直し）</h1>
      </header>
      <ul>
        {MOCKS.map((m) => (
          <li key={m.id}>
            <Link href={`/dev/mock/f9/${m.id}`}>{`${m.no} ${m.label}`}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
