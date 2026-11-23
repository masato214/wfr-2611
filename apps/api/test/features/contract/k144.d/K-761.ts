// 葉 K-761「PC の側：ブラウザの様子と仕事に付いたファイル」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 口の登録は葉の hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-761
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["bridge-job-extra"]); // K-761（ブラウザの様子を送る口：K144-API-926・仕事に付いたファイルを受け取る口：K144-API-931）
  },
  UUID_PARAM_CASES: [
    ["K144-API-926", "reportBrowserState", "path", "id"], // K-761
    ["K144-API-931", "getFileForBridge", "query", "job_id"], // K-761
  ],
  BODIES: {
    reportBrowserState: { browser: "chrome", state: "using" }, // K-761
  },
};
