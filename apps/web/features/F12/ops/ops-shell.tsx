// 運営の外枠の入口（K-941）。本体は外枠の名前を使うので components/k/ops-shell.tsx（class_gate の shell）。
//   運営だけの見た目（k-op-）はこのフォルダの ops-shell.css。呼ぶ側はこれまでどおり "@/features/F12/ops/ops-shell" を読む。
import "./ops-shell.css";

export { OPS_NAV, OPS_TEAM_NAV, OpsShell } from "@/components/k/ops-shell";
export type { OpsNavItem, OpsScreen, OpsShellProps } from "@/components/k/ops-shell";
