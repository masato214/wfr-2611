// 本文の読む形（K-577・DocView）：文書の木 doc（K-561 を K-584 が広げた形）を、編集の部品を読み込まずに画面に描く。サーバーでも描ける（"use client" を付けない）。
//   見た目は下絵 features/F4/doc/views.tsx の FreeDoc・Checks・BillTable・Img と同じ（doc.css の k-f4d-*）。印は doc-view-marks.tsx。
//   寄せ（textAlign）は 4 つの値のときだけ data-align。番号つきの start・表の colspan／rowspan は整数のときだけ属性にする（外れた値は付けない）。
//   チェックの箱：onToggleTask が無ければ押せない（disabled）。在れば押せて onToggleTask(位置, 押した後の真偽) を呼ぶ。部品の中で文書を書き換えない（表示は渡された doc のまま）。
//   利用者が選んだ #rrggbb の色を持つ文書だけ、読むだけの編集の部品（doc-view-color.tsx が遅く読む doc-view-live.tsx）で描く（色はその部品が付ける。
//     style 属性でも style の要素でも当てない・PM の決め 2026-11-23）。読み込みの間は、ここの色を付けない描きを先に出す。色の無い文書は編集の部品を読まない。
//   dangerouslySetInnerHTML を使わない・口は呼ばない
import type { ChangeEvent, ReactNode } from "react";
import { DOC_ALIGNS, type Doc } from "@kaname/contracts";
import { DocViewColor } from "./doc-view-color";
import { hasHexColor, renderInline, type ViewInline } from "./doc-view-marks";

type ViewNode = ViewInline & { attrs?: Record<string, unknown>; content?: ViewNode[] };

export interface DocViewProps {
  doc: Doc;
  /** チェックの箱を押したとき（index は文書の中の taskItem の出てくる順の位置・0 から・入れ子も数える） */
  onToggleTask?: (index: number, checked: boolean) => void;
  ariaLabel?: string;
}

interface Ctx {
  tasks: Map<ViewNode, number>;
  onToggleTask?: DocViewProps["onToggleTask"];
}

/** 寄せは 4 つの値のときだけ data-align（見た目は editor.css）。外れた値は何も付けない */
const alignOf = (a: unknown): { "data-align"?: string } =>
  (DOC_ALIGNS as readonly unknown[]).includes(a) ? { "data-align": String(a) } : {};
const intAttr = (v: unknown, min: number): number | undefined =>
  typeof v === "number" && Number.isInteger(v) && v >= min ? v : undefined;
const plain = (n: ViewNode): string =>
  n.type === "text" ? (n.text ?? "") : n.type === "hardBreak" ? " " : (n.content ?? []).map(plain).join("");

/** チェックの項目に、描く前に 1 回の走査で位置を振る */
function numberTasks(n: ViewNode, out: Map<ViewNode, number>): Map<ViewNode, number> {
  if (n.type === "taskItem") out.set(n, out.size);
  for (const c of n.content ?? []) numberTasks(c, out);
  return out;
}

function TaskItem({ n, ctx, k }: { n: ViewNode; ctx: Ctx; k: string }) {
  const index = ctx.tasks.get(n) ?? 0;
  const checked = n.attrs?.["checked"] === true;
  const label = plain(n).trim();
  const toggle = ctx.onToggleTask;
  return (
    <li data-done={checked}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={!toggle}
        {...(toggle
          ? { onChange: (e: ChangeEvent<HTMLInputElement>) => toggle(index, e.target.checked) }
          : { readOnly: true })}
      />
      <span>{(n.content ?? []).map((p, i) => renderInline(p.content, `${k}.${i}`))}</span>
    </li>
  );
}

function blocks(nodes: readonly ViewNode[] | undefined, ctx: Ctx, key: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => block(n, ctx, `${key}.${i}`));
}

function cell(n: ViewNode, ctx: Ctx, k: string): ReactNode {
  const span = {
    ...(intAttr(n.attrs?.["colspan"], 2) ? { colSpan: n.attrs!["colspan"] as number } : {}),
    ...(intAttr(n.attrs?.["rowspan"], 2) ? { rowSpan: n.attrs!["rowspan"] as number } : {}),
  };
  const kids = blocks(n.content, ctx, k);
  return n.type === "tableHeader" ? (
    <th key={k} {...span}>
      {kids}
    </th>
  ) : (
    <td key={k} {...span}>
      {kids}
    </td>
  );
}

function block(n: ViewNode, ctx: Ctx, k: string): ReactNode {
  const a = n.attrs ?? {};
  const ghost = a["ghost"] === true;
  switch (n.type) {
    case "paragraph":
      return (
        <p key={k} className={ghost ? "k-f4d-ghost" : undefined} {...alignOf(a["textAlign"])}>
          {renderInline(n.content, k)}
        </p>
      );
    case "heading": {
      const props = { className: ghost ? "k-f4d-ghost-h" : undefined, ...alignOf(a["textAlign"]) };
      const kids = renderInline(n.content, k);
      if (a["level"] === 4)
        return (
          <h4 key={k} {...props}>
            {kids}
          </h4>
        );
      if (a["level"] === 3)
        return (
          <h3 key={k} {...props}>
            {kids}
          </h3>
        );
      return (
        <h2 key={k} {...props}>
          {kids}
        </h2>
      );
    }
    case "bulletList":
      return <ul key={k}>{blocks(n.content, ctx, k)}</ul>;
    case "orderedList": {
      const start = intAttr(a["start"], 1);
      return (
        <ol key={k} {...(start !== undefined && start !== 1 ? { start } : {})}>
          {blocks(n.content, ctx, k)}
        </ol>
      );
    }
    case "listItem":
      return <li key={k}>{blocks(n.content, ctx, k)}</li>;
    case "taskList":
      return (
        <ul key={k} className="k-f4d-checks">
          {(n.content ?? []).map((it, i) => (
            <TaskItem key={`${k}.${i}`} n={it} ctx={ctx} k={`${k}.${i}`} />
          ))}
        </ul>
      );
    case "horizontalRule":
      return <hr key={k} />;
    case "table":
      return (
        <div key={k} className="k-f4d-tablewrap">
          <table>
            <tbody>
              {(n.content ?? []).map((row, i) => (
                <tr key={`${k}.${i}`}>{(row.content ?? []).map((c, j) => cell(c, ctx, `${k}.${i}.${j}`))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "blockquote":
      return (
        <blockquote key={k} className="k-f4d-quote">
          {blocks(n.content, ctx, k)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre key={k}>
          <code>{(n.content ?? []).map((t) => t.text ?? "").join("")}</code>
        </pre>
      );
    case "image": {
      const caption = typeof a["caption"] === "string" ? a["caption"] : "";
      return (
        <figure key={k} className="k-f4d-img">
          <div className="k-f4d-img-box" role="img" aria-label={caption}>
            画像
          </div>
          <figcaption>{caption}</figcaption>
        </figure>
      );
    }
    default:
      return null;
  }
}

/** 文書の木を読む形で描く（編集の部品を読み込まない） */
export function DocView({ doc, onToggleTask, ariaLabel = "本文" }: DocViewProps) {
  const root = doc as unknown as ViewNode;
  const ctx: Ctx = { tasks: numberTasks(root, new Map()), ...(onToggleTask ? { onToggleTask } : {}) };
  const plainView = (
    <div className="k-f4d-doc k-f4d-read" aria-label={ariaLabel}>
      {blocks(root.content, ctx, "d")}
    </div>
  );
  if (!hasHexColor(root)) return plainView;
  return (
    <DocViewColor doc={doc} ariaLabel={ariaLabel} {...(onToggleTask ? { onToggleTask } : {})}>
      {plainView}
    </DocViewColor>
  );
}
