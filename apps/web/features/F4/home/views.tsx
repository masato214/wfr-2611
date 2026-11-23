"use client";
// 空の一覧のおすすめ 3 つ（K-453・段 5 の下絵・部品先行）。今の ticket-list/list-empty.tsx と同じ並び（あいさつ・点線の空の箱・主ボタン・
//   おすすめ）で、おすすめの 3 つを押せる字にする。押すと題名に入れて作る面を開く（代表に聞くことのおすすめ）。
//   「分身と話して作る」はまだ使えない（押せない形のまま）。値と関数を受け取って描くだけで、口は呼ばない
import { Button } from "@/components/k";
import "../ticket-list/ticket-list.css";
import "./home.css";

export interface HomeEmptyProps {
  /** あいさつの名前（無ければあいさつを出さない） */
  name: string;
  /** 書けるグループがある（主ボタンを出す） */
  canCreate: boolean;
  /** おすすめの題名（3 つ） */
  suggestions: readonly string[];
  /** 主ボタン「＋ チケットを作る」 */
  onCreate?: () => void;
  /** おすすめを押したとき（その題名を入れて作る面を開く） */
  onSuggest?: (title: string) => void;
}

export function HomeEmpty({ name, canCreate, suggestions, onCreate, onSuggest }: HomeEmptyProps) {
  return (
    <div className="k-list-first">
      {name ? <p className="k-list-greet">ようこそ、{name}さん</p> : null}
      <section className="k-state k-list-empty" data-state="empty" aria-labelledby="k-f4-home-title">
        <span className="k-list-empty-mark" aria-hidden="true">
          ＋
        </span>
        <h2 id="k-f4-home-title" className="k-state-title">
          まだチケットはありません
        </h2>
        <p className="k-list-empty-desc">
          チケットは仕事の 1 単位。担当・期限・完了の条件を書くと、分身があなたの代わりに進め、確かめてから承認を待つ
        </p>
        <div className="k-state-actions">
          {canCreate ? (
            <Button className="k-list-act" onClick={onCreate}>
              ＋ チケットを作る
            </Button>
          ) : null}
          <span
            className="k-btn k-list-act"
            data-variant="outlined"
            aria-disabled="true"
            title="分身と話して作る（まだ使えません）"
          >
            分身と話して作る
          </span>
        </div>
        <p className="k-list-suggest">
          はじめての 1 枚におすすめ：
          {suggestions.map((t, i) => (
            <span key={t}>
              {i ? " ・ " : null}
              <button type="button" className="k-f4-home-suggest" onClick={() => onSuggest?.(t)}>
                {t}
              </button>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
