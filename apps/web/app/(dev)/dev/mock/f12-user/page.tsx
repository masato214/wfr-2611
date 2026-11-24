import Link from "next/link";
import { MOCKS } from "./mocks";

// 段 13 の下絵のモック（領域 user）の索引。1 行 ＝ 1 つの状態
export default function MockF12UserIndex() {
  return (
    <main className="k-root k-page" aria-labelledby="mock-f12-user-title">
      <header className="k-page-head">
        <h1 id="mock-f12-user-title">段 13 のモック（利用者の側：困ったとき・請求）</h1>
        <p className="k-desc">本番と同じ部品で並べた状態。幅を変えて見る（375・1440）</p>
      </header>
      <ul>
        {MOCKS.map((m) => (
          <li key={m.id}>
            <Link href={`/dev/mock/f12-user/${m.id}`}>
              {m.no} {m.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
