"use client";
// 段 10 の下絵の 1 つの状態を描く（持ち主ごとの描き手に順に聞く。誰も持っていない id は「まだありません」）
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { renderAdmin } from "./render-admin";
import { renderKnowledge } from "./render-knowledge";
import { renderTreeOps } from "./render-tree-ops";
import { renderTicket } from "./ticket-mocks";
import { renderWorkspace } from "./ws-mocks";

export function MockView({ id, theme }: { id: string; theme: Theme }): ReactNode {
  return (
    renderKnowledge(id, theme) ??
    renderTreeOps(id, theme) ??
    renderAdmin(id, theme) ??
    renderTicket(id, theme) ??
    renderWorkspace(id, theme) ?? <p>この状態はまだありません：{id}</p>
  );
}
