"use client";
// 自分の AI まわりの設定の見本（いつも許可・使用量・通知）。置き場の画面ができるまでここで押して確かめる。
// 本物の API につながる（ログインが要る）
import { AlwaysAllowList, NotifyToggles, UsagePanel } from "@/components/ai";
import { RequireSession } from "@/lib/auth/session";

export default function DevAiSettings() {
  return (
    <RequireSession fallback={<p className="p-8">ログインを確かめています</p>}>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <h1 className="text-h1 font-bold">AI まわりの設定（見本）</h1>
        <AlwaysAllowList />
        <UsagePanel />
        <NotifyToggles />
      </main>
    </RequireSession>
  );
}
