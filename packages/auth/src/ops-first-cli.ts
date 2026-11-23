// 命令 ops:first（K-945・D-156.22）：運営の最初の 1 人を作り、パスキーを付けるリンクをメールで送る。
//   使い方：pnpm --filter @kaname/auth ops:first --email <宛先> --name <名前>
//   管理者の接続（adminDatabaseUrl）で動く。印も宛先も出さない（「メールを送りました（宛先#<ハッシュの頭 12 字>）」だけ）。
//   最後の 1 人がパスキーを無くしたときも同じ命令（同じメールなら人を増やさず新しいリンク・前のリンクは使えなくなる）。
//   送れなかったら 0 以外で終わる（もう一度流す）。この台本は読み込むだけで動くので、試験が読む関数は ops-first.ts に置く
import { parseArgs } from "node:util";
import { adminDatabaseUrl, loadConfig } from "@kaname/config";
import { createPool } from "@kaname/db/pool";
import { createAuth } from "./index.js";
import { cliMailer, createFirstOps } from "./ops-first.js";
import { mailTag } from "./signup.js";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } }, strict: true });
const email = values.email?.trim() ?? "";
const name = values.name?.trim() ?? "";
if (!email || !name) {
  console.error("--email と --name を付けて流してください");
  process.exit(2);
}

const config = loadConfig();
const adminUrl = adminDatabaseUrl() ?? config.databaseUrl;
// 接続は関門 createPool を通す（G35・G7：packages/db の外で pg を直に使わない）
const admin = createPool({ databaseUrl: adminUrl, max: 2 });
const appPool = createPool({ databaseUrl: config.databaseUrl, max: 1 });
const { auth, pool: authPool } = createAuth({
  authDatabaseUrl: config.authDatabaseUrl,
  appPool,
  secret: config.authSecret,
  baseURL: config.baseUrl,
});

const done = async (code: number): Promise<never> => {
  await Promise.allSettled([admin.end(), appPool.end(), authPool.end()]);
  process.exit(code);
};

try {
  const r = await createFirstOps(admin, auth, {
    email,
    name,
    webBaseURL: config.webBaseUrl ?? config.baseUrl,
    mailer: cliMailer(config),
  });
  if (r.status === "sent") {
    console.log(`メールを送りました（${mailTag(email)}）`);
    await done(0);
  } else if (r.status === "already") {
    console.error("ほかに運営の人を持つ運営の人が居ます。その人が運営の人の画面から足し直してください");
    await done(3);
  } else {
    console.error("メールを送れませんでした。もう一度流してください");
    await done(1);
  }
} catch (e) {
  const x = e as { code?: unknown; name?: unknown } | null;
  console.error(`運営の人を作れませんでした（${typeof x?.code === "string" ? x.code : String(x?.name ?? "Error")}）`);
  await done(1);
}
