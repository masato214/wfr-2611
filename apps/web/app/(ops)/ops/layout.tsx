import type { ReactNode } from "react";
import { OpsFrame } from "@/features/F12/ops/ops-frame";

// 運営の場所 /ops（K-946・D-156.1）。頁は本文だけを持ち、運営の外枠はこの入れ物が包む（/ops/login と /ops/setup は包まない）
export default function OpsLayout({ children }: { children: ReactNode }) {
  return <OpsFrame>{children}</OpsFrame>;
}
