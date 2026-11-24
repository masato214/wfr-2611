import { Suspense } from "react";
import { WsListScreen } from "@/features/F12/ops/ws-list-screen";

// 運営のワークスペースの一覧（K-965）。入れ物（layout・運営の外枠）は K-946。URL の絞り込みを読むので Suspense で包む
export default function OpsHomePage() {
  return (
    <Suspense fallback={null}>
      <WsListScreen />
    </Suspense>
  );
}
