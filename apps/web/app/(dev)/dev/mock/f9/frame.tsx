"use client";
// 段 10 の下絵の外枠（見ている人ごとの外枠・ナレッジの骨組み。ワークスペースの管理の骨組みは ws-frame.tsx＝K-672）
import type { ReactNode } from "react";
import { Shell, Toaster, type Crumb, type Group } from "@/components/k";
import { KnowledgeLayout } from "@/features/F9/knowledge/knowledge-layout";
import type { KnowledgeTreeProps } from "@/features/F9/knowledge/tree";
import type { Viewer } from "@/features/F9/knowledge/samples";
import { BUILT_ROUTES } from "@/lib/built-routes";
import type { RoleId } from "@/lib/nav";
import type { Theme } from "@/lib/theme";

export const VIEWER: Record<Viewer, { name: string; full: string; initial: string; role: RoleId }> = {
  taka: { name: "高本", full: "高本 聖斗", initial: "高", role: "R2" },
  sato: { name: "佐藤", full: "佐藤 花子", initial: "佐", role: "R2" },
  suzu: { name: "鈴木", full: "鈴木 一郎", initial: "鈴", role: "R3" },
  tana: { name: "田中", full: "田中 美咲", initial: "田", role: "R3" },
};
const GROUPS: Group[] = [
  { code: "EG", name: "営業", href: "/tickets?scope=eg", pending: true, tone: "teal" },
  { code: "JD", name: "受託開発", href: "/tickets?scope=jd", pending: true, tone: "plum" },
];
// 段 10 で作る画面は、左のメニューで押せる形にする（本番は作った画面の一覧から出る）
const BUILT = [...BUILT_ROUTES, "/knowledge", "/members", "/workspace/rules"];

export interface FrameProps {
  theme: Theme;
  viewer: Viewer;
  screen: "knowledge" | "tickets" | "members" | "masters";
  crumbs: Crumb[];
  children: ReactNode;
  dialog?: ReactNode;
}

export function Frame({ theme, viewer, screen, crumbs, children, dialog }: FrameProps) {
  const v = VIEWER[viewer];
  return (
    <Toaster>
      <Shell
        role={v.role}
        screen={screen}
        crumbs={crumbs}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: v.name, initial: v.initial }}
        groups={GROUPS}
        bridgeConnected
        theme={theme}
        built={BUILT}
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}

export interface KnowledgeFrameProps extends Omit<FrameProps, "screen" | "crumbs" | "children"> {
  tree: KnowledgeTreeProps;
  /** 上の帯のいまの場所（ナレッジ › …） */
  path: readonly string[];
  children: ReactNode;
}

/** ナレッジの画面：左に木・右に本文（幅 1023 以下は木が引き出し） */
export function KnowledgeFrame({ tree, path, children, ...frame }: KnowledgeFrameProps) {
  const crumbs: Crumb[] = [{ label: "ナレッジ", href: "/knowledge" }, ...path.map((label) => ({ label }))];
  return (
    <Frame {...frame} screen="knowledge" crumbs={crumbs}>
      <KnowledgeLayout tree={tree} place={path.join(" › ") || "ナレッジ"}>
        {children}
      </KnowledgeLayout>
    </Frame>
  );
}
