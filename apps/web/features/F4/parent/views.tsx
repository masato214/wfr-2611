"use client";
// 親を決める小窓（K-443・段 5 の下絵・部品先行）。値と押したときの関数を受け取って描くだけで、口は呼ばない。
//   決め（代表に聞くことのおすすめ）：親は 3 段まで（3 段目の子は選べない）・親の期限より後にはできない（小窓に注意）・
//   「親の担当・節目を写す」のチェックは既定で入っている・合うチケットが無くても親なしで作れる。
//   探して 1 つ選ぶ並び（PickList・PickSearch）は、複製の元を選ぶ小窓も使う
import { Check, X } from "lucide-react";
import { Button, Callout, Dialog, TextField } from "@/components/k";
import "./parent.css";

/** 探して選ぶ並びの 1 行 */
export interface PickItem {
  id: string;
  /** 1 行目の左の小さな字（番号・出どころ） */
  lead: string;
  /** 本体（題名・型の名前） */
  title: string;
  /** 下の小さな字（グループ・段・使った回数） */
  meta?: string;
  selected?: boolean;
  /** 在れば選べない（押せない形で出し、訳を下に書く） */
  blocked?: string;
}

export function PickSearch({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <TextField
      label={label}
      name="pick_query"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      readOnly={!onChange}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

export function PickList({
  label,
  items,
  onPick,
}: {
  label: string;
  items: readonly PickItem[];
  onPick?: (id: string) => void;
}) {
  return (
    <div className="k-f4-pick" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          className="k-f4-pick-item"
          aria-checked={Boolean(it.selected)}
          {...(it.blocked ? { "aria-disabled": true, tabIndex: -1 } : {})}
          onClick={() => (it.blocked ? undefined : onPick?.(it.id))}
        >
          <span className="k-f4-pick-lead">{it.lead}</span>
          <span className="k-f4-pick-title">{it.title}</span>
          <span className="k-f4-pick-mark" aria-hidden="true">
            {it.selected ? <Check size={14} /> : null}
          </span>
          {it.meta ? <span className="k-f4-pick-meta">{it.meta}</span> : null}
          {it.blocked ? <span className="k-f4-pick-why">{it.blocked}</span> : null}
        </button>
      ))}
    </div>
  );
}

export interface ParentDialogProps {
  open: boolean;
  /** 探す欄に入っている字 */
  query: string;
  items: readonly PickItem[];
  /** 選んだ親の期限（「11/30（月）」の形）。在れば注意の文にそれを入れる */
  parentDue?: string;
  /** この子の今の期限が親の期限より後のときの注意（そのまま出す） */
  lateNote?: string;
  /** 「親の担当・節目を写す」のチェック */
  copyChecked: boolean;
  onQuery?: (v: string) => void;
  onPick?: (id: string) => void;
  onCopy?: (on: boolean) => void;
  onClose?: () => void;
  onConfirm?: () => void;
}

function Empty({ query }: { query: string }) {
  return (
    <p className="k-f4-par-none" role="status">
      {`「${query.trim()}」に合うチケットがありません。番号か題名の一部で探してください。親を決めずに作ることもできます`}
    </p>
  );
}

export function ParentDialog(p: ParentDialogProps) {
  const chosen = p.items.some((i) => i.selected);
  return (
    <Dialog
      title="親チケットを決める"
      description="この子の親になるチケットを選びます"
      open={p.open}
      onOpenChange={(o) => (o ? undefined : p.onClose?.())}
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose}>
            やめる
          </Button>
          <Button disabled={!chosen} onClick={p.onConfirm}>
            親にする
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <PickSearch label="番号か題名で探す" value={p.query} onChange={p.onQuery} />
        {p.items.length === 0 ? (
          <Empty query={p.query} />
        ) : (
          <PickList label="親の候補" items={p.items} onPick={p.onPick} />
        )}
        <p className="k-f4-par-note">
          {p.parentDue
            ? `親にすると、親の期限（${p.parentDue}）より後にはできない。親の進みにこの子が数えられる`
            : "親にすると、親の期限より後にはできない。親の進みにこの子が数えられる"}
        </p>
        {p.lateNote ? <Callout tone="warn">{p.lateNote}</Callout> : null}
        <label className="k-dialog-check">
          <input
            type="checkbox"
            checked={p.copyChecked}
            readOnly={!p.onCopy}
            onChange={(e) => p.onCopy?.(e.target.checked)}
          />
          親の担当・節目を写す
        </label>
      </div>
    </Dialog>
  );
}

/** 作る面の種別の行：親を決める入口。決めたら番号と題名の札と「外す」 */
export function ParentEntry({
  parent,
  onOpen,
  onClear,
}: {
  parent: { number: string; title: string } | null;
  onOpen?: () => void;
  onClear?: () => void;
}) {
  return (
    <span className="k-f4-par-entry">
      {parent ? (
        <span className="k-f4-par-chip">
          <span title={`${parent.number} ${parent.title}`}>{`親：${parent.number} ${parent.title}`}</span>
          <button type="button" className="k-f4-par-remove" aria-label="親を外す" title="親を外す" onClick={onClear}>
            <X size={14} aria-hidden="true" />
          </button>
        </span>
      ) : (
        <Button variant="ghost" size="sm" aria-haspopup="dialog" onClick={onOpen}>
          親チケットを決める
        </Button>
      )}
    </span>
  );
}
