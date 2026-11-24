"use client";
// 運営の外枠（段 13・領域 ops・枝 c/段13・K-941）。外枠の名前（k-shell・k-nav・k-bar）を使うので components/k に置く（class_gate の shell）。
//   運営だけの見た目は features/F12/ops/ops-shell.css（k-op-）で、入口の features/F12/ops/ops-shell.tsx が読み込む。
//  利用者の Shell は使わない：運営は顧客の画面とは別の場所（キャンバス OpList の左のバー・上の帯）。
//   広い幅：左のバー（Kaname 運営・5 つの入口・下に 運営の人 と「別の場所」の注記）／768〜1023 は 56 のレール／767 以下は左のバーを出さず、
//   帯の左のボタンから引き出しを開く。見た目の寸法は外枠の k-shell・k-nav・k-bar（components/k/shell.css）をそのまま使い、運営だけの所は ops-shell.css（k-op-）
//   動きは持たない：行き先は OPS_NAV（本番では呼ぶ側が差し替える）。探す・知らせ・自分のメニューは出すが押せない形（D-145.9）
import {
  Bell,
  Building2,
  Inbox,
  Megaphone,
  Menu as MenuIcon,
  Package,
  ReceiptText,
  Search,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Crumb } from "./shell";

export type OpsScreen =
  "ops-home" | "ops-tenant" | "ops-team" | "ops-support" | "ops-notices" | "ops-billing" | "ops-skills";

export interface OpsNavItem {
  key: "home" | "support" | "notices" | "billing" | "skills" | "team";
  label: string;
  href: string;
  icon: LucideIcon;
  /** この項目が受け持つ screen */
  screens: readonly OpsScreen[];
}

/** 左のバーの入口（上から ワークスペース・問い合わせ・お知らせ・請求・配るもの。運営の人は下） */
export const OPS_NAV: readonly OpsNavItem[] = [
  {
    key: "home",
    label: "ワークスペース",
    href: "/dev/mock/f12-ops/op-list",
    icon: Building2,
    screens: ["ops-home", "ops-tenant"],
  },
  { key: "support", label: "問い合わせ", href: "/dev/mock/f12-ops2/oq-inbox", icon: Inbox, screens: ["ops-support"] },
  {
    key: "notices",
    label: "お知らせ",
    href: "/dev/mock/f12-ops2/oq-notices",
    icon: Megaphone,
    screens: ["ops-notices"],
  },
  { key: "billing", label: "請求", href: "/dev/mock/f12-ops2/oq-bills", icon: ReceiptText, screens: ["ops-billing"] },
  { key: "skills", label: "配るもの", href: "/dev/mock/f12-ops2/oq-plans", icon: Package, screens: ["ops-skills"] },
];
export const OPS_TEAM_NAV: OpsNavItem = {
  key: "team",
  label: "運営の人",
  href: "/dev/mock/f12-ops/op-team",
  icon: Users,
  screens: ["ops-team"],
};
const NOTE = "顧客の画面とは別の場所。操作はすべて運営の記録に残る";

export interface OpsShellProps {
  /** いま見ている画面（左のバーの印がこれで決まる） */
  screen: OpsScreen;
  /** いまの場所（「ワークスペース › 合同会社ミナト企画」）。最後の 1 つは押せない */
  crumbs: Crumb[];
  /** 左のバーの数の印（問い合わせ・請求）。0 や無しなら出さない */
  badges?: { support?: number; billing?: number };
  /** 操作している運営の人（右上の丸に頭の 1 字） */
  operator: { name: string; initial: string };
  /** 鈴の数（無ければ数の印なし） */
  notices?: number;
  /** 帯の上に置く帯（中を見ている間の帯など）。無ければ何も出さない */
  banner?: ReactNode;
  /** 狭い幅の引き出しを最初から開いて描く（見本用） */
  drawerOpen?: boolean;
  children: ReactNode;
}

function NavItem({ it, current, badge }: { it: OpsNavItem; current: boolean; badge?: number | undefined }) {
  const Icon = it.icon;
  return (
    <a className="k-nav-item k-op-nav-item" href={it.href} title={it.label} aria-current={current ? "page" : undefined}>
      <Icon size={16} aria-hidden="true" />
      <span className="k-nav-label">{it.label}</span>
      {badge ? (
        <b className="k-nav-badge" aria-label={`${badge} 件`}>
          {badge}
        </b>
      ) : null}
    </a>
  );
}

function NavList({ p }: { p: OpsShellProps }) {
  const badgeOf = (k: OpsNavItem["key"]) =>
    k === "support" ? p.badges?.support : k === "billing" ? p.badges?.billing : undefined;
  return (
    <>
      <div className="k-op-gap" />
      {OPS_NAV.map((it) => (
        <NavItem key={it.key} it={it} current={it.screens.includes(p.screen)} badge={badgeOf(it.key)} />
      ))}
      <div className="k-nav-fill" />
      <NavItem it={OPS_TEAM_NAV} current={OPS_TEAM_NAV.screens.includes(p.screen)} />
      <p className="k-nav-label k-op-note">{NOTE}</p>
    </>
  );
}

function Brand() {
  return (
    <div className="k-nav-top">
      <span className="k-ws-mark k-op-mark" aria-hidden="true">
        K
      </span>
      <b className="k-nav-label k-op-brand">Kaname</b>
      <span className="k-nav-label k-op-tag">運営</span>
    </div>
  );
}

export function OpsShell(p: OpsShellProps) {
  const [drawer, setDrawer] = useState(p.drawerOpen === true);
  return (
    <div className="k-root k-shell k-op-shell">
      <a className="k-skip" href="#k-main">
        本文へ
      </a>
      <nav aria-label="運営のメニュー" className="k-nav">
        <Brand />
        <NavList p={p} />
      </nav>
      {drawer ? (
        <>
          <div className="k-op-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />
          <nav id="k-op-drawer" aria-label="運営のメニュー（引き出し）" className="k-op-drawer">
            <div className="k-op-drawer-head">
              <Brand />
              <button
                type="button"
                className="k-icon-btn"
                aria-label="メニューを閉じる"
                onClick={() => setDrawer(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <NavList p={p} />
          </nav>
        </>
      ) : null}
      <div className="k-body k-op-shell-body">
        {p.banner ? <div className="k-op-banner">{p.banner}</div> : null}
        <header className="k-bar">
          <button
            type="button"
            className="k-icon-btn k-op-menu-btn"
            aria-label="メニューを開く"
            aria-expanded={drawer}
            aria-controls="k-op-drawer"
            onClick={() => setDrawer(true)}
          >
            <MenuIcon size={18} aria-hidden="true" />
          </button>
          <span className="k-ws-mark k-op-mark k-bar-ws" aria-hidden="true">
            K
          </span>
          <span className="k-bar-ws-name">Kaname 運営</span>
          <nav aria-label="いまの場所" className="k-crumbs">
            <ol>
              {p.crumbs.map((c, i) => (
                <li key={`${c.label}-${i}`}>
                  {i > 0 ? (
                    <span className="k-crumb-sep" aria-hidden="true">
                      ›
                    </span>
                  ) : null}
                  {c.href && i < p.crumbs.length - 1 ? (
                    <a href={c.href}>{c.label}</a>
                  ) : (
                    <span aria-current={i === p.crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <div className="k-bar-tools">
            <form role="search" className="k-search" data-disabled="true" onSubmit={(e) => e.preventDefault()}>
              <label>
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">探す</span>
                <input type="search" name="q" placeholder="探す" disabled aria-disabled="true" title="まだ使えません" />
                <span className="k-search-key" aria-hidden="true">
                  ⌘K
                </span>
              </label>
            </form>
            <button
              type="button"
              className="k-icon-btn k-bell"
              aria-label={p.notices ? `お知らせ（${p.notices} 件）` : "お知らせ"}
              aria-disabled="true"
              tabIndex={-1}
              title="まだ使えません"
            >
              <Bell size={18} aria-hidden="true" />
              {p.notices ? <b aria-hidden="true">{p.notices}</b> : null}
            </button>
            <button
              type="button"
              className="k-me"
              aria-label={`${p.operator.name}のメニュー`}
              aria-disabled="true"
              tabIndex={-1}
              title="まだ使えません"
            >
              <span className="k-avatar" aria-hidden="true">
                {p.operator.initial}
              </span>
              ▾
            </button>
          </div>
        </header>
        <div className="k-work k-op-shell-work">
          <main id="k-main" className="k-main k-op-shell-main" tabIndex={-1}>
            {p.children}
          </main>
        </div>
      </div>
    </div>
  );
}
