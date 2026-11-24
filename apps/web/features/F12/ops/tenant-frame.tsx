"use client";
// 1 社の画面の枠（段 13・領域 ops・キャンバス OpWs の頭とタブとワークスペースの情報）。値を受け取って描くだけ
import type { ReactNode } from "react";
import { Band, Button, Menu, MenuItem, MenuPopup, MenuTrigger, Tabs } from "@/components/k";
import { Card, Facts, StatusBadge } from "./ops-parts";
import { WS_INFO } from "./ops-sample";

export type TenantTab = "status" | "members" | "billing" | "inquiries" | "log";

export interface TenantFrameProps {
  tab: TenantTab;
  /** 止めている 1 社（札が赤・上に帯・メニューが「再開する」） */
  stopped?: boolean;
  /** 開いたタブの中身。ほかのタブの中身は描かない */
  children: ReactNode;
}

const TABS: readonly { value: TenantTab; label: string }[] = [
  { value: "status", label: "いまの状態" },
  { value: "members", label: "メンバー 8" },
  { value: "billing", label: "プランと請求" },
  { value: "inquiries", label: "問い合わせ 1" },
  { value: "log", label: "記録" },
];

export function WsInfoCard() {
  return (
    <Card title="ワークスペースの情報">
      <Facts rows={WS_INFO} />
      <p className="k-op-note-text">
        このワークスペースへの運営の操作はすべて「記録」に残り、顧客の「ワークスペースの管理 ›
        記録」にも出る（許可は規約で先にもらっている）
      </p>
    </Card>
  );
}

/** 頭（印・名前・状態・操作）→ 帯 → タブ → 中身と情報 */
export function TenantFrame({ tab, stopped = false, children }: TenantFrameProps) {
  return (
    <section className="k-root k-page" aria-labelledby="op-ws-title">
      <header className="k-page-head">
        <span className="k-op-ws-mark" aria-hidden="true">
          ミ
        </span>
        <h1 id="op-ws-title">合同会社ミナト企画</h1>
        {stopped ? (
          <StatusBadge tone="danger">止めている（11/09〜）</StatusBadge>
        ) : (
          <StatusBadge tone="success">使っている</StatusBadge>
        )}
        <p className="k-page-sub">チーム ・ 8 人</p>
        <div className="k-page-acts">
          <Button variant="outlined">お知らせを送る</Button>
          <Button variant="outlined">中を見る</Button>
          <Menu>
            <MenuTrigger label="そのほかの操作" className="k-op-more">
              ⋯
            </MenuTrigger>
            <MenuPopup>
              <MenuItem>{stopped ? "再開する" : "止める"}</MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </header>
      <div className="k-op-body">
        {stopped ? (
          <Band
            tone="danger"
            role="alert"
            title="このワークスペースは止めています"
            sub="理由：請求が払われない ・ 止めた日 11/09。メンバーは入ると止められた画面になり、分身の実行も止まっています。チケット・記録・分身の記憶はそのまま残っています"
            acts={
              <Button size="sm" variant="primary">
                再開する
              </Button>
            }
          />
        ) : null}
        <div className="k-op-cols">
          <div className="k-op-main">
            <Tabs
              label="1 社の画面"
              value={tab}
              items={TABS.map((t) => ({ ...t, panel: t.value === tab ? children : null }))}
            />
          </div>
          <aside className="k-op-side" aria-label="ワークスペースの情報">
            <WsInfoCard />
          </aside>
        </div>
      </div>
    </section>
  );
}
