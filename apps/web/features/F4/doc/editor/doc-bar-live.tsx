"use client";
// 本文の道具の帯（本物・K-567）。道具の並びと名前は下絵と同じ BAR_GROUPS（features/F4/doc/bar-tools.tsx）を読む。
//   この葉で動くのは 戻す・やり直す・太字・斜体・下線・取り消し線・行の中のコード・リンク の 8 つ。ほかは並びに置いて押せない形（隠さない・K-587・K-568 が動かす）。
//   Tab の停止点は 1 つ（最初は『太字』・押した後は最後にいた道具）で、← → で隣の道具へ移る（roving tabindex）。押された道具は aria-pressed
import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { BAR_GROUPS, TOOL_NAMES, type BarTool } from "../bar-tools";
import { useMarkButton, type MarkType } from "./bar/use-mark-button";
import { useUndoRedo, type UndoRedoAction } from "./bar/use-undo-redo";

const WHY = "まだ使えません";
const MARKS: Record<string, MarkType> = {
  太字: "bold",
  斜体: "italic",
  下線: "underline",
  取り消し線: "strike",
  行の中のコード: "code",
};
const HISTORY: Record<string, UndoRedoAction> = { 戻す: "undo", やり直す: "redo" };
const FIRST_STOP = "太字";

interface ToolProps {
  tool: BarTool;
  stop: string;
  onFocusTool: (name: string) => void;
  children?: ReactNode;
}

function Chev({ tool }: { tool: BarTool }) {
  return tool.pop ? (
    <svg className="k-f4d-chev" viewBox="0 0 10 6" aria-hidden="true" focusable="false">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ) : null;
}

/** 道具のボタン。編集の選びを崩さないよう押し下げでは焦点を移さない。キーボードで押したときは焦点を道具に残す（← → で続けて動けるように） */
function ToolButton({
  tool,
  stop,
  onFocusTool,
  off,
  pressed,
  extra,
  onAct,
}: ToolProps & { off: boolean; pressed?: boolean; extra?: Record<string, unknown>; onAct?: () => void }) {
  const onClick = (e: MouseEvent<HTMLButtonElement>): void => {
    if (off || !onAct) return;
    const el = e.currentTarget;
    const byKey = e.detail === 0;
    onAct();
    if (byKey) el.focus();
  };
  return (
    <button
      type="button"
      aria-label={tool.name}
      title={off && !onAct ? WHY : tool.name}
      tabIndex={tool.name === stop ? 0 : -1}
      data-tool={tool.name}
      {...(tool.pop ? { "aria-haspopup": tool.pop } : {})}
      {...(off ? { "aria-disabled": true } : {})}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      {...extra}
      onMouseDown={(e) => e.preventDefault()}
      onFocus={() => onFocusTool(tool.name)}
      onClick={onClick}
    >
      {tool.label}
      <Chev tool={tool} />
    </button>
  );
}

function MarkTool(p: ToolProps & { editor: Editor | null; type: MarkType }) {
  const m = useMarkButton(p.editor, p.type);
  return <ToolButton {...p} off={!m.canToggle} pressed={m.isActive} onAct={m.handleMark} />;
}
function HistoryTool(p: ToolProps & { editor: Editor | null; action: UndoRedoAction }) {
  const h = useUndoRedo(p.editor, p.action);
  return <ToolButton {...p} off={!h.canExecute} onAct={h.handleAction} />;
}

export interface DocBarLiveProps {
  editor: Editor | null;
  /** リンクの小さな入力を開く・閉じる */
  onLink: () => void;
  linkOpen: boolean;
  linkActive: boolean;
}

export function DocBarLive({ editor, onLink, linkOpen, linkActive }: DocBarLiveProps) {
  const [stop, setStop] = useState(FIRST_STOP);
  const bar = useRef<HTMLDivElement>(null);
  const onFocusTool = useCallback((name: string) => setStop(name), []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const at = TOOL_NAMES.indexOf(stop);
    const last = TOOL_NAMES.length - 1;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? last
          : e.key === "ArrowRight"
            ? (at + 1) % TOOL_NAMES.length
            : (at - 1 + TOOL_NAMES.length) % TOOL_NAMES.length;
    const name = TOOL_NAMES[next]!;
    setStop(name);
    bar.current?.querySelector<HTMLButtonElement>(`button[data-tool="${name}"]`)?.focus();
  };
  const render = (t: BarTool): ReactNode => {
    const common = { tool: t, stop, onFocusTool };
    const mark = MARKS[t.name];
    if (mark) return <MarkTool key={t.name} {...common} editor={editor} type={mark} />;
    const action = HISTORY[t.name];
    if (action) return <HistoryTool key={t.name} {...common} editor={editor} action={action} />;
    if (t.name === "リンク")
      return (
        <ToolButton
          key={t.name}
          {...common}
          off={!editor}
          pressed={linkActive}
          extra={{ "aria-haspopup": "dialog", "aria-expanded": linkOpen }}
          onAct={onLink}
        />
      );
    return <ToolButton key={t.name} {...common} off />;
  };
  return (
    <div ref={bar} role="toolbar" aria-label="本文の道具" className="k-f4d-bar" onKeyDown={onKeyDown}>
      {BAR_GROUPS.map((group, gi) => (
        <span key={gi} className="k-f4d-bar-group" role="group">
          {group.map(render)}
        </span>
      ))}
    </div>
  );
}
