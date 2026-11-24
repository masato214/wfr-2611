"use client";
// 運営の画面の補助の部品（段 13・領域 ops）。値を受け取って描くだけ。領域 ops2 も使える。クラスは k-op-（ops.css）
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/k";
import "./ops.css";
import "../shared/choice.css";

/** 数のカード（上の数・1 社の状態）。tone="warn" は気にかける数 */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="k-op-stat" data-tone={tone}>
      <span className="k-op-stat-label">{label}</span>
      <b className="k-op-stat-value">{value}</b>
      {sub ? <span className="k-op-stat-sub">{sub}</span> : null}
    </div>
  );
}
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="k-op-stats">{children}</div>;
}

/** 絞り込みの札（押した形 on）。下絵では押す関数を渡さない */
export function Chip({
  on,
  count,
  children,
  onClick,
}: {
  on?: boolean;
  count?: number;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="k-op-chip" aria-pressed={on ?? false} onClick={onClick}>
      {children}
      {count !== undefined ? <span className="k-op-chip-n">{count}</span> : null}
    </button>
  );
}

/** 白い箱（題・右の操作・中身） */
export function Card({
  title,
  aside,
  children,
  tone,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  tone?: "danger";
}) {
  return (
    <section className="k-op-card" data-tone={tone} aria-label={typeof title === "string" ? title : undefined}>
      {title || aside ? (
        <div className="k-op-card-head">
          {title ? <h3>{title}</h3> : null}
          {aside ? <div className="k-op-card-aside">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** 名前と値の並び（ワークスペースの情報・小窓の中） */
export function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="k-op-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 人の丸（頭の 1 字） */
export function Person({ initial, children, sub }: { initial: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <span className="k-op-person">
      <span className="k-op-avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="k-op-person-text">
        <b>{children}</b>
        {sub ? <span>{sub}</span> : null}
      </span>
    </span>
  );
}

/** できる印（✓ か —）。色だけにせず字を持つ */
export function CapMark({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className="k-op-cap"
      data-on={on || undefined}
      role="img"
      aria-label={`${label}：${on ? "できる" : "できない"}`}
    >
      {on ? "✓" : "—"}
    </span>
  );
}

/** 横に並べた補足の注（表の下・箱の下） */
export function Note({ children }: { children: ReactNode }) {
  return <p className="k-op-note-text">{children}</p>;
}

/** 日時つきの並び（最近のこと・運営の記録） */
export interface FeedItem {
  at: string;
  who?: string;
  text: ReactNode;
  detail?: ReactNode;
}
export function Feed({ items, label }: { items: readonly FeedItem[]; label: string }) {
  return (
    <ul className="k-op-feed" aria-label={label}>
      {items.map((it) => (
        <li key={`${it.at}-${it.who ?? ""}`}>
          <time className="k-op-feed-at">{it.at}</time>
          <span className="k-op-feed-main">
            {it.who ? <b>{it.who}</b> : null}
            <span>{it.text}</span>
            {it.detail ? <span className="k-op-feed-detail">{it.detail}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 状態の札（色と字） */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <Badge tone={tone}>{children}</Badge>;
}

/** 選ぶ小さな丸の欄（ラジオ）。下絵では押す関数なし */
export function RadioChoice({
  name,
  value,
  checked,
  title,
  desc,
  disabled,
}: {
  name: string;
  value: string;
  checked?: boolean;
  title: ReactNode;
  desc?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="k-op-choice" data-disabled={disabled || undefined}>
      <input type="radio" name={name} value={value} defaultChecked={checked} disabled={disabled} />
      <span className="k-op-choice-text">
        <b>{title}</b>
        {desc ? <span>{desc}</span> : null}
      </span>
    </label>
  );
}

/** 箇条の注意（止めると・見るだけ で できること） */
export function Bullets({ items, label }: { items: readonly ReactNode[]; label: string }) {
  return (
    <ul className="k-op-bullets" aria-label={label}>
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
