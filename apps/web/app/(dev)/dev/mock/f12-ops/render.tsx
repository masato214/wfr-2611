"use client";
// 段 13・領域 ops の下絵の 1 つの状態を描く（id → 部品の組み合わせ）。誰も持っていない id は「まだありません」
import type { ReactNode } from "react";
import type { Crumb } from "@/components/k";
import { NoAccess } from "@/components/k";
import { OpsShell, type OpsScreen } from "@/features/F12/ops/ops-shell";
import { PeekBand, PeekPanel, NoticeDialog, PeekDialog, StopDialog } from "@/features/F12/ops/tenant-dialogs";
import { TenantFrame, type TenantTab } from "@/features/F12/ops/tenant-frame";
import { BillingTab, InquiriesTab, LogTab, MembersTab, StatusTab } from "@/features/F12/ops/tenant-tabs";
import { OpsLogin, TeamAddDialog, TeamEditDialog, TeamPage, TeamRemoveConfirm } from "@/features/F12/ops/views-team";
import { PwnedDialog, WsListPage } from "@/features/F12/ops/views-list";
import type { Theme } from "@/lib/theme";

const LIST_HREF = "/dev/mock/f12-ops/op-list";
const TAB_LABEL: Record<TenantTab, string | null> = {
  status: null,
  members: "メンバー",
  billing: "プランと請求",
  inquiries: "問い合わせ",
  log: "記録",
};

function Ops({
  screen,
  crumbs,
  banner,
  children,
}: {
  screen: OpsScreen;
  crumbs: Crumb[];
  banner?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <OpsShell
      screen={screen}
      crumbs={crumbs}
      badges={{ support: 3, billing: 2 }}
      operator={{ name: "高本 聖斗", initial: "高" }}
      notices={3}
      {...(banner ? { banner } : {})}
    >
      {children}
    </OpsShell>
  );
}

/** 1 社の画面：パンくずは タブ名まで */
function Tenant({
  tab,
  stopped,
  banner,
  children,
  below,
}: {
  tab: TenantTab;
  stopped?: boolean;
  banner?: ReactNode | undefined;
  children: ReactNode;
  below?: ReactNode;
}) {
  const crumbs: Crumb[] = [
    { label: "ワークスペース", href: LIST_HREF },
    { label: "合同会社ミナト企画", ...(TAB_LABEL[tab] ? { href: "/dev/mock/f12-ops/op-ws" } : {}) },
  ];
  const t = TAB_LABEL[tab];
  if (t) crumbs.push({ label: t });
  return (
    <Ops screen="ops-tenant" crumbs={crumbs} banner={banner}>
      <TenantFrame tab={tab} {...(stopped ? { stopped } : {})}>
        {children}
      </TenantFrame>
      {below}
    </Ops>
  );
}

const LIST_CRUMBS: Crumb[] = [{ label: "ワークスペース" }];
const TEAM_CRUMBS: Crumb[] = [{ label: "運営の人" }];

export function MockView({ id }: { id: string; theme: Theme }): ReactNode {
  switch (id) {
    case "op-list":
      return (
        <Ops screen="ops-home" crumbs={LIST_CRUMBS}>
          <WsListPage />
        </Ops>
      );
    case "op-list-empty":
      return (
        <Ops screen="ops-home" crumbs={LIST_CRUMBS}>
          <WsListPage rows={[]} query="ほしの" />
        </Ops>
      );
    case "op-list-pwned":
      return (
        <Ops screen="ops-home" crumbs={LIST_CRUMBS}>
          <WsListPage pwned={4} />
        </Ops>
      );
    case "op-pwned":
      return (
        <Ops screen="ops-home" crumbs={LIST_CRUMBS}>
          <WsListPage pwned={4} />
          <PwnedDialog />
        </Ops>
      );
    case "op-ws":
      return (
        <Tenant tab="status">
          <StatusTab />
        </Tenant>
      );
    case "op-ws-members":
      return (
        <Tenant tab="members">
          <MembersTab />
        </Tenant>
      );
    case "op-ws-billing":
      return (
        <Tenant tab="billing">
          <BillingTab />
        </Tenant>
      );
    case "op-ws-inquiries":
      return (
        <Tenant tab="inquiries">
          <InquiriesTab />
        </Tenant>
      );
    case "op-ws-log":
      return (
        <Tenant tab="log">
          <LogTab />
        </Tenant>
      );
    case "op-peek":
      return (
        <Tenant tab="status" below={<PeekDialog />}>
          <StatusTab />
        </Tenant>
      );
    case "op-peek-open":
      return (
        <Tenant tab="status" banner={<PeekBand />}>
          <PeekPanel />
          <StatusTab />
        </Tenant>
      );
    case "op-stop":
      return (
        <Tenant tab="status" below={<StopDialog />}>
          <StatusTab />
        </Tenant>
      );
    case "op-stopped":
      return (
        <Tenant tab="status" stopped>
          <StatusTab />
        </Tenant>
      );
    case "op-ws-notice":
      return (
        <Tenant tab="status" below={<NoticeDialog />}>
          <StatusTab />
        </Tenant>
      );
    case "op-ws-nocap":
      return (
        <Tenant tab="billing">
          <NoAccess />
        </Tenant>
      );
    case "op-team":
      return (
        <Ops screen="ops-team" crumbs={TEAM_CRUMBS}>
          <TeamPage />
        </Ops>
      );
    case "op-team-add":
      return (
        <Ops screen="ops-team" crumbs={TEAM_CRUMBS}>
          <TeamPage />
          <TeamAddDialog />
        </Ops>
      );
    case "op-team-edit":
      return (
        <Ops screen="ops-team" crumbs={TEAM_CRUMBS}>
          <TeamPage />
          <TeamEditDialog />
        </Ops>
      );
    case "op-team-remove":
      return (
        <Ops screen="ops-team" crumbs={TEAM_CRUMBS}>
          <TeamPage />
          <TeamRemoveConfirm />
        </Ops>
      );
    case "op-login":
      return <OpsLogin />;
    default:
      return <p>この状態はまだありません：{id}</p>;
  }
}
