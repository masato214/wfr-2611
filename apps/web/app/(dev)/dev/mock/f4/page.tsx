"use client";
// MOCKS は "use client" の mocks.tsx の値なので、索引も client で読む
import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 5（F4 チケットを作って中身を決める）の下絵のモックの索引（部品先行・枝 c/段5）。1 行 ＝ 1 つの状態
export default function MockF4Index() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f4-title">
      <header className="k-page-head">
        <h1 id="mock-f4-title">段 5 のモック（チケットを作って中身を決める）</h1>
        <p className="k-desc">本番と同じ部品で並べた画面。幅を変えて見る（375・768・1440）</p>
      </header>
      <section aria-label="states">
        <h2>状態</h2>
        <ul>
          {MOCKS.map((m) => (
            <li key={m.id}>
              <Link href={`/dev/mock/f4/${m.id}`}>{m.label}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
