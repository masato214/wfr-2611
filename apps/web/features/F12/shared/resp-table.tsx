// 幅で出し分ける表（段 13 の表を持つ状態の全部が使う）。
//   置き場の幅が 720 以上なら共通の表（components/k の Table）、それより狭いと行を縦の組（1 行 1 枚）にする（スマホは必ず組）。表を縮めて字を 1 字ずつ折らない。
//   組の頭は「title」の列（無ければ最初の列）、ボタンだけの列は「action」で組の下に置き、残りは「見出し：値」で並べる
import type { ReactNode } from "react";
import { Table, type Column } from "@/components/k";
import "./resp-table.css";

export type RespColumn<R> = Column<R> & {
  /** 組（スマホ）での置き方。title＝組の頭・action＝組の下のボタン・hide＝組では出さない。無ければ「見出し：値」 */
  card?: "title" | "action" | "hide";
  /** 組での見出し（表の見出しが読み上げ用の字だけのときなど）。無ければ表の見出し */
  cardLabel?: ReactNode;
  /** 表（PC）で折り返さない短い値（役割・日時・状態など）。長い字の列に幅を譲らせ、短い語を 1 語の途中で折らない */
  nowrap?: boolean;
};

export interface RespTableProps<R> {
  caption: string;
  columns: RespColumn<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  /** 列の多い表は "wide"：置き場が 1024 未満でも組にする（既定は 720 未満で組） */
  stack?: "wide";
}

export function RespTable<R>({ caption, columns, rows, rowKey, stack }: RespTableProps<R>) {
  const title = columns.find((c) => c.card === "title") ?? columns[0];
  const rest = columns.filter((c) => c !== title && c.card !== "hide" && c.card !== "action");
  const acts = columns.filter((c) => c.card === "action");
  return (
    <div className="k-f12-rt" {...(stack ? { "data-stack": stack } : {})}>
      <div className="k-f12-rt-table">
        <Table
          caption={caption}
          columns={columns.map((c) =>
            c.nowrap ? { ...c, cell: (r: R) => <span className="k-f12-rt-nw">{c.cell(r)}</span> } : c,
          )}
          rows={rows}
          rowKey={rowKey}
        />
      </div>
      <ul className="k-f12-rt-cards" aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)} className="k-f12-rt-card">
            {title ? <div className="k-f12-rt-head">{title.cell(r)}</div> : null}
            {rest.length > 0 ? (
              <dl className="k-f12-rt-list">
                {rest.map((c) => (
                  <div key={c.key} className="k-f12-rt-row">
                    <dt>{c.cardLabel ?? c.header}</dt>
                    <dd>{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {acts.length > 0 ? (
              <div className="k-f12-rt-acts">
                {acts.map((c) => (
                  <span key={c.key}>{c.cell(r)}</span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
