"use client";
// 複製（K-446・段 5 の下絵・部品先行）。値と押したときの関数を受け取って描くだけで、口は呼ばない。
//   1 詳細の複製の小窓（DuplicateDialog）：写すものを選んで新しいチケットを作る。
//      写すものの既定は全部 ON（本文・担当者と承認する人・テスト仕様・参照するもの・子チケット・添付）。実施事項のチェックは外して写す（文を添える）。
//      やり取りと記録は写さず、元へのつながりだけ残す。複製した直後の期限は元のまま・題名に「（複製）」を付けない。添付はまだ使えない（押せない形）
//   2 作る面の「過去のチケットから複製」：作り方の切り替え（CreateHow）と、元を選ぶ小窓（DuplicatePickDialog・親の小窓と同じ検索の形）
import { Button, Dialog, NoticeBox, Select, TextField } from "@/components/k";
import { PickList, PickSearch, type PickItem } from "../parent/views";
import "./duplicate.css";

/** 写すものの 1 行 */
export interface CopyRow {
  key: string;
  label: string;
  checked: boolean;
  /** 在れば押せない形（まだ使えない）。訳を title に出す */
  unavailable?: string;
  /** 行の下の小さな字（実施事項のチェックは外して写す など） */
  note?: string;
}

export interface DuplicateDialogProps {
  open: boolean;
  /** 元の番号と題名（頭の下の行「EG-119 から新しいチケットを作る」） */
  sourceNumber: string;
  title: string;
  groupName: string;
  /** 期限の字（元のまま・「11/27（金）」の形） */
  dueLabel: string;
  copies: readonly CopyRow[];
  /** 口が断ったときの赤い知らせ（書いた中身は消さない） */
  notice?: string;
  busy?: boolean;
  onTitle?: (v: string) => void;
  onToggle?: (key: string, on: boolean) => void;
  onDue?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
}

function CopyItem({ r, onToggle }: { r: CopyRow; onToggle: DuplicateDialogProps["onToggle"] }) {
  const off = Boolean(r.unavailable);
  return (
    <div className="k-f4-dup-row" {...(off ? { "aria-disabled": true, title: r.unavailable } : {})}>
      <label className="k-dialog-check">
        <input
          type="checkbox"
          checked={r.checked}
          readOnly={!onToggle}
          disabled={off}
          onChange={(e) => onToggle?.(r.key, e.target.checked)}
        />
        {r.label}
      </label>
      {r.note ? <p className="k-f4-dup-note">{r.note}</p> : null}
    </div>
  );
}

/** 詳細の複製の小窓 */
export function DuplicateDialog(p: DuplicateDialogProps) {
  return (
    <Dialog
      title="複製する"
      open={p.open}
      onOpenChange={(o) => (o ? undefined : p.onClose?.())}
      target={`${p.sourceNumber} から新しいチケットを作る`}
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose}>
            やめる
          </Button>
          <Button loading={p.busy} onClick={p.onConfirm}>
            複製して開く
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {p.notice ? <NoticeBox>{p.notice}</NoticeBox> : null}
        <TextField
          label="題名"
          name="dup_title"
          hint="元の題名のままです。直せます"
          value={p.title}
          readOnly={!p.onTitle}
          onChange={(e) => p.onTitle?.(e.target.value)}
        />
        <Select label="グループ" name="dup_scope" value="g" options={[{ value: "g", label: p.groupName }]} />
        <div className="k-field">
          <span className="k-label">期限（元のまま）</span>
          <button type="button" className="k-select-trigger k-f4-dup-due" aria-haspopup="dialog" onClick={p.onDue}>
            <span>{p.dueLabel}</span>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
        <fieldset className="k-dialog-group">
          <legend>写すもの</legend>
          {p.copies.map((r) => (
            <CopyItem key={r.key} r={r} onToggle={p.onToggle} />
          ))}
        </fieldset>
        <fieldset className="k-dialog-group">
          <legend>写さないもの</legend>
          <p className="k-f4-dup-skip">やり取りと記録は写さず、元のチケットへのつながりだけ残します</p>
        </fieldset>
      </div>
    </Dialog>
  );
}

/** 作る面の頭の「作り方」の切り替え。AI と話して作るは押せない形、過去のチケットから複製は押せる（小窓で元を選ぶ） */
export function CreateHow({ onDuplicate }: { onDuplicate?: () => void }) {
  return (
    <span className="k-create-how" aria-label="作り方">
      <span aria-current="true">自分で書く</span>
      <span aria-disabled="true" title="AI と話して作る（まだ使えません）">
        AI と話して作る
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={onDuplicate}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onDuplicate?.() : undefined)}
      >
        過去のチケットから複製
      </span>
    </span>
  );
}

export interface DuplicatePickDialogProps {
  open: boolean;
  query: string;
  items: readonly PickItem[];
  onQuery?: (v: string) => void;
  onPick?: (id: string) => void;
  onClose?: () => void;
  onConfirm?: () => void;
}

/** 作る面から開く、複製の元を選ぶ小窓 */
export function DuplicatePickDialog(p: DuplicatePickDialogProps) {
  const chosen = p.items.some((i) => i.selected);
  return (
    <Dialog
      title="過去のチケットから複製"
      description="元にするチケットを選ぶと、その中身を写して書き始められます"
      open={p.open}
      onOpenChange={(o) => (o ? undefined : p.onClose?.())}
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose}>
            やめる
          </Button>
          <Button disabled={!chosen} onClick={p.onConfirm}>
            この元から作る
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <PickSearch label="番号か題名で探す" value={p.query} onChange={p.onQuery} />
        <PickList label="複製の元の候補" items={p.items} onPick={p.onPick} />
      </div>
    </Dialog>
  );
}
