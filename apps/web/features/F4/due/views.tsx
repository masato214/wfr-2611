"use client";
// 期限を決める小窓（K-444・段 5 の下絵・部品先行）。値と押したときの関数を受け取って描くだけで、口は呼ばない。
//   決め：日付だけ（時刻の行は押せない形）・今日から（過去は選べない）・期限をなくす道は作らない。
//   作る面（create）は日付を選ぶだけ。詳細から変える（change）ときは理由の欄が要る（絵に足した・代表に聞くことのおすすめ）
//   今日は引数で受ける（時計に触らない）。日付の計算は ./dates
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { Button, Dialog, TextArea } from "@/components/k";
import { WEEKDAYS, mmdd, mmddWeek, monthLabel, monthWeeks, quickDates, shiftMonth, spoken } from "./dates";
import "./due.css";

const PAST_WHY = "今日より前の日は選べません";

export interface DueDialogProps {
  open: boolean;
  /** create＝作る面（理由なし）／change＝詳細から変える（理由が要る） */
  mode: "create" | "change";
  /** 頭の下の行（どのチケットか・いまの期限） */
  target?: string;
  /** 今日（YYYY-MM-DD） */
  today: string;
  /** 出している月（YYYY-MM） */
  month: string;
  selected: string | null;
  /** 日付の下に赤で出す理由（今日より前を入れた など） */
  dateError?: string;
  /** 変えるときの注記（承認する人に知らせが出る など。そのまま出す） */
  notice?: string;
  reason?: string;
  reasonError?: string;
  onPick?: (ymd: string) => void;
  onMonth?: (month: string) => void;
  onReason?: (v: string) => void;
  onClose?: () => void;
  onConfirm?: () => void;
}

const off = (past: boolean) => (past ? { "aria-disabled": true, tabIndex: -1, title: PAST_WHY } : {});

function Quick({ p }: { p: DueDialogProps }) {
  return (
    <div className="k-f4-due-quick" role="group" aria-label="すぐ決める">
      {quickDates(p.today).map((q) => (
        <button
          key={q.label}
          type="button"
          className="k-f4-due-q"
          aria-pressed={p.selected === q.ymd}
          onClick={() => p.onPick?.(q.ymd)}
        >
          {q.label}
          <small>{mmddWeek(q.ymd)}</small>
        </button>
      ))}
    </div>
  );
}

function Calendar({ p }: { p: DueDialogProps }) {
  const thisMonth = p.today.slice(0, 7);
  const prevOff = p.month <= thisMonth;
  return (
    <div className="k-f4-due-cal" role="group" aria-label="カレンダー">
      <div className="k-f4-due-month">
        <button
          type="button"
          className="k-f4-due-nav"
          aria-label="前の月"
          {...(prevOff ? { "aria-disabled": true, tabIndex: -1 } : {})}
          onClick={() => (prevOff ? undefined : p.onMonth?.(shiftMonth(p.month, -1)))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span aria-live="polite">{monthLabel(p.month)}</span>
        <button
          type="button"
          className="k-f4-due-nav"
          aria-label="次の月"
          onClick={() => p.onMonth?.(shiftMonth(p.month, 1))}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="k-f4-due-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="k-f4-due-wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {monthWeeks(p.month)
          .flat()
          .map((c, i) =>
            c === null ? (
              <span key={`b${i}`} className="k-f4-due-blank" aria-hidden="true" />
            ) : (
              <button
                key={c.ymd}
                type="button"
                className="k-f4-due-day"
                aria-label={spoken(c.ymd)}
                aria-pressed={p.selected === c.ymd}
                aria-current={c.ymd === p.today ? "date" : undefined}
                {...off(c.ymd < p.today)}
                onClick={() => (c.ymd < p.today ? undefined : p.onPick?.(c.ymd))}
              >
                {c.day}
              </button>
            ),
          )}
      </div>
    </div>
  );
}

export function DueDialog(p: DueDialogProps) {
  const change = p.mode === "change";
  return (
    <Dialog
      title={change ? "期限を変える" : "期限を決める"}
      open={p.open}
      onOpenChange={(o) => (o ? undefined : p.onClose?.())}
      {...(p.target ? { target: p.target } : {})}
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose}>
            やめる
          </Button>
          <Button disabled={!p.selected} onClick={p.onConfirm}>
            {p.selected ? `${mmdd(p.selected)} にする` : "決める"}
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <Quick p={p} />
        <Calendar p={p} />
        {p.dateError ? (
          <p className="k-err" role="alert">
            {p.dateError}
          </p>
        ) : null}
        <div className="k-f4-due-time" aria-disabled="true" title="まだ使えません">
          <span>時刻</span>
          <span aria-hidden="true">18:00 ▾</span>
        </div>
        {change && p.notice ? <p className="k-f4-due-note">{p.notice}</p> : null}
        {change ? (
          <TextArea
            label="理由"
            name="due_reason"
            required
            rows={3}
            placeholder="例：先方の返事が来週になるため"
            value={p.reason ?? ""}
            readOnly={!p.onReason}
            onChange={(e) => p.onReason?.(e.target.value)}
            error={p.reasonError}
          />
        ) : null}
      </div>
    </Dialog>
  );
}

/** 作る面の振り分けの行の「期限」の欄（押すと小窓）。value が無ければ「日付を選ぶ」 */
export function DueField({ value, error, onOpen }: { value: string | null; error?: string; onOpen?: () => void }) {
  const id = useId();
  return (
    <div className="k-create-assign-row">
      <div className="k-field">
        <span className="k-label" id={`${id}-l`}>
          期限
          <span className="k-req" aria-hidden="true">
            *
          </span>
        </span>
        <button
          type="button"
          className="k-select-trigger k-f4-due-field"
          data-empty={!value}
          aria-haspopup="dialog"
          aria-labelledby={`${id}-l`}
          aria-invalid={error ? true : undefined}
          onClick={onOpen}
        >
          <span>{value ? mmddWeek(value) : "日付を選ぶ"}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {error ? <span className="k-err">{error}</span> : null}
      </div>
    </div>
  );
}
