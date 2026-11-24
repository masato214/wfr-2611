"use client";
// 運営のログイン（K-946・下絵 op-login）。「パスキーで入る」で部品の口（K-304・K-944）を通して入り、next（/ops の中の道だけ）か /ops に移る。
//   入っている人を get-session で飛ばさない（押せば入り直す）。失敗と本人がやめたは同じ失敗の文（下絵の文）
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { refreshSession, signInWithPasskey } from "@/lib/auth/client";
import { OpsLogin } from "@/features/F12/ops/views-team";
import { safeOpsNext } from "@/features/F12/ops/ops-frame";
import { OPS_QUERY_ROOT } from "@/features/F12/ops/use-ops-shell";

function OpsLoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const next = useSearchParams().get("next");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const onPasskey = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const r = await signInWithPasskey();
    if (!r.ok) {
      setFailed(true);
      setBusy(false);
      return;
    }
    qc.removeQueries({ queryKey: [OPS_QUERY_ROOT] }); // 前の印で読んだ外枠の答えを捨てる
    refreshSession();
    router.replace(safeOpsNext(next));
  };
  return <OpsLogin failed={failed} busy={busy} onPasskey={() => void onPasskey()} />;
}

export default function Page() {
  return (
    <Suspense fallback={<OpsLogin />}>
      <OpsLoginPage />
    </Suspense>
  );
}
