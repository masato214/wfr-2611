// PC の側の口 2 本（K-761）の登録（K-326）：reportBrowserState（ブラウザの様子）・getFileForBridge（仕事に付いた資料の署名 URL）。
//   振る舞いの本体は apps/api/src/features/F5/delegate/browser-state.ts・job-file.ts。
//   置き場と配り先の URL は要求のときに読む（PC の口の試験の土台は appPool だけを渡して作るので、作るときに読まない）。
//   server.ts・fuzz の的には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import type { Hook } from "../contract/deps.js";
import { browserStateHooks } from "../features/F5/delegate/browser-state.js";
import { jobFileHooks } from "../features/F5/delegate/job-file.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function bridgeJobExtraHooks(d: HookDeps): Record<string, Hook> {
  const h = {
    ...browserStateHooks(d.appPool),
    ...jobFileHooks(d.appPool, () => ({ objects: d.objects, baseUrl: d.config.baseUrl })),
  };
  return {
    reportBrowserState: { ...h["reportBrowserState"] },
    getFileForBridge: { ...h["getFileForBridge"] },
  };
}

export const register = defineHooks({
  name: "bridgeJobExtraHooks",
  make: (d) => bridgeJobExtraHooks(d),
  fuzz: "same",
});
