// API の起動口（T-F-18）。設定（packages/config）→ DB のプール・認証・関門 → 起動時の存在確認（G-11）→ HTTP。
// 画面は API を叩くだけ（D-043.3）。常駐（ローカル・Docker）はこれを `pnpm api:start` で動かし、Vercel は vercel.ts が bootApi だけ使う（D-097）。存在確認に落ちたら起動しない（黙って 502 を返さない）
import { serve, type ServerType } from "@hono/node-server";
import { loadConfig, type Config, type StartupReport } from "@kaname/config";
import { createPool } from "@kaname/db/pool";
import { createMemberHub } from "@kaname/db/listen";
import { createRepository } from "@kaname/db/repository";
import { createAuth } from "@kaname/auth";
import { createDeviceResolver, createSessionResolver } from "@kaname/auth/resolver";
import { mailTag } from "@kaname/auth/signup";
import { withDevice } from "./middleware/tenant.js";
import { HOOK_MODULES } from "./hooks/all.generated.js";
import { buildHooks } from "./hooks/registry.js";
import { ObjectStore, s3Client, s3Driver, s3Presigner, type StorageDriver } from "@kaname/storage";
import { createApp } from "./app.js";
import { edgeRequest } from "./edge.js";
import { authExt } from "./auth/ext.js";
import { InfisicalVault, MemoryVault, SecretsGateway, type Vault } from "@kaname/secrets";
import { resendMail, signedMail, type MailLike } from "@kaname/notify";
import { ActionGateway, RateLimiter } from "@kaname/actions";
import { assertApiStartup } from "./startup.js";
import { nearLimitNotifier } from "./ops-alert.js";
import { inquiryUploadRoute } from "./features/F12/inquiries/upload-route.js";

export interface BootOptions {
  /** 起動時の存在確認の差し替え（テスト用。本番は S3 の HEAD） */
  bucketExists?: () => Promise<boolean>;
  version?: string;
  /** 秘密の保管先（既定 MemoryVault＝開発。staging／本番は Infisical のドライバを差す） */
  vault?: Vault;
  /** DB のプールの本数（業務・認証）。常駐のサーバーは 10／5、Vercel の関数は 1 つにつき 3／2
   *  （関数は同時にいくつも立つ。常駐と同じ本数だと 同時の数 × 15 本で接続の上限を食い潰す・G-16・D-097） */
  poolMax?: { app: number; auth: number };
  /** 資料の置き場のドライバ（既定は S3 互換。開発で S3 が無いときはローカルのフォルダ・dev.ts） */
  storageDriver?: StorageDriver;
  /** メールの送出先（関門 C6 の Resend の代わり・試験用）。署名と返信先は本番と同じく付ける */
  mail?: MailLike;
  /** 外への口（関門 C1）が使う fetch（試験用。本番は実の fetch） */
  outboundFetch?: typeof fetch;
}
/** 外への口（関門 C1）の上限：1 分あたり。登録の照合は運営のテナント × 宛先 1 つにまとまるので、人の速さの既定（30）より大きくする */
const OUTBOUND_PER_MINUTE = 600;
/** 照合など、登録の途中で待つ外の答えの上限（遅い外で登録を止めない・TP-EXT-01） */
const OUTBOUND_TIMEOUT_MS = 5_000;

export interface Booted {
  app: ReturnType<typeof createApp>;
  report: StartupReport;
  close: () => Promise<void>;
}

/** 設定から API を組み立て、存在確認を通す。落ちたら例外（起動しない） */
export async function bootApi(config: Config, o: BootOptions = {}): Promise<Booted> {
  const appPool = createPool({ databaseUrl: config.databaseUrl, max: o.poolMax?.app ?? 10 });
  const repo = await createRepository(appPool);
  // メールの送出（関門 C6）：Resend の鍵があれば送る。無ければ URL をログに出す（開発）
  // 署名（会社名・代表者名・問い合わせ）と返信先（info@）は、ここで全部のメールに付ける（D-096・関門 C6）
  const inner = o.mail ?? (config.resendApiKey ? resendMail(config.resendApiKey) : null);
  const mail = inner ? signedMail(inner, config.operator, config.mailReplyTo) : null;
  // 送出は 1 か所。認証（再設定）と保留の申し込み（確認）の両方がこれを通る
  const mailer = mail
    ? async (m: { to: string; subject: string; text: string }) => {
        // 送れたか／送れなかったかを必ず残す（黙って落ちると「メールが来ない」を誰も再現できない・G-15）
        try {
          // dev の自動テスト宛ては送らない（送出先の 1 日の上限を食い潰すため）。
          // 「送った」とは書かない。リンクは [auth] の行に出るので手順はそのまま通る
          if (config.mailSuppressPrefix && m.to.startsWith(config.mailSuppressPrefix)) {
            console.log(
              `[mail] 送らなかった（dev の抑止 ${config.mailSuppressPrefix}）→ ${mailTag(m.to)}（${m.subject}）`,
            );
            return;
          }
          // send は投げずに { error } を返す。見ないと拒否されても「送った」になる（G-15）
          const r = await mail.send({ from: config.mailFrom, to: m.to, subject: m.subject, text: m.text }); // 署名と返信先は signedMail が付ける
          if (r.error) throw new Error(r.error.message);
          console.log(`[mail] 送った → ${mailTag(m.to)}（${m.subject}）`);
        } catch (e) {
          console.error(`[mail] 送れなかった → ${mailTag(m.to)}（${m.subject}）: ${(e as Error).message}`);
          throw e;
        }
      }
    : undefined;
  const { auth, pool: authPool } = createAuth({
    authDatabaseUrl: config.authDatabaseUrl,
    appPool,
    ...(o.poolMax ? { poolMax: o.poolMax.auth } : {}),
    secret: config.authSecret,
    baseURL: config.baseUrl,
    ...(config.webBaseUrl ? { webBaseURL: config.webBaseUrl } : {}),
    ...(mailer ? { mailer } : {}),
  });
  // 秘密の保管（関門 C8・D-101）：設定があれば Infisical、無ければ MemoryVault（再起動で消える＝開発だけ）。
  // staging／本番で Infisical が無い・入れないなら起動時の確認で落とす（startup.ts の secrets:vault）
  // 上限の 8 割に来たら運営に知らせる（D-102.5）。メールは 1 つの実体につき 1 時間に 1 回まで（ops-alert.ts）
  const onNearLimit = nearLimitNotifier({ ...(mailer ? { mailer } : {}), opsEmail: config.opsEmail });
  const vault =
    o.vault ?? (config.infisical ? new InfisicalVault({ ...config.infisical, onNearLimit }) : new MemoryVault());
  const secrets = new SecretsGateway(repo, vault, Buffer.from(config.secretsMasterKey, "base64"));
  const s3c = s3Client(config.storage);
  const s3 = s3Driver(s3c, config.storage.bucket);
  const bucketExists = o.bucketExists ?? s3.exists;
  // 資料の置き場（関門 C4・D-104.11）。署名は資格情報の鍵とは別の用途の鍵から作る。
  //   外の置き場（Bridge の配布物・BRIDGE_RELEASE_BASE）の期限つき URL は、置き場の仕組み（S3 の署名つき URL）で作る（D-128.160）
  const objects = new ObjectStore(repo, o.storageDriver ?? s3, {
    signingSecret: `${config.authSecret}:files`,
    externalSigner: s3Presigner(s3c, config.storage.endpoint, config.storage.bucket),
  });
  // 会話が変わった知らせを受ける 1 本（D-113・台帳 X-008）。URL が無ければ持たない（画面は見に行く形のまま）
  // 外への口（関門 C1）。登録の漏れたパスワードの照合が通る（K-51）。宛先は照合のサービスだけ
  const outboundHooks = {
    policy: async () => "auto" as const,
    destinationAllowed: async (r: { destination?: string }) => r.destination === "api.pwnedpasswords.com",
  };
  const limiter = new RateLimiter(OUTBOUND_PER_MINUTE);
  const actions = o.outboundFetch
    ? new ActionGateway(repo, outboundHooks, limiter, OUTBOUND_TIMEOUT_MS, o.outboundFetch)
    : new ActionGateway(repo, outboundHooks, limiter, OUTBOUND_TIMEOUT_MS);
  const hub = config.listenDatabaseUrl ? createMemberHub({ url: config.listenDatabaseUrl }) : null;
  const close = async () => {
    await hub?.close();
    await authPool.end();
    await appPool.end();
  };
  let report: StartupReport;
  try {
    report = await assertApiStartup({ config, repo, bucketExists, vault });
  } catch (e) {
    await close();
    throw e;
  }
  // 口の工場に渡す材料（apps/api/src/hooks/registry.ts の HookDeps）
  const hookDeps = { auth, appPool, authPool, repo, actions, objects, secrets, config, ...(mailer ? { mailer } : {}) };
  const app = createApp({
    version: o.version ?? "0.1.0",
    repo,
    auth,
    // 画面のログインか、PC の印（x-bridge-session・K-57）で文脈を決める
    resolve: withDevice(createSessionResolver(auth, appPool), createDeviceResolver(appPool)),
    authExt: authExt({ auth, appPool, authPool, repo, secrets, objects, config, hub, ...(mailer ? { mailer } : {}) }),
    corsOrigin: config.webOrigins.join(","),
    // 確かめの口（K-262・staging の確かめの間だけ）。既定は閉じる
    edgeEcho: config.edgeEcho === true,
    // 会話・記憶の契約の口は画面の口と同じ本体を通す。本人確認の取り直しはログインの部品に頼る（K-19）。登録は K-51、確認のリンクで確定するのは K-52、規約の今の版と同意は K-53
    contract: {
      // 口の振る舞いは apps/api/src/hooks の各ファイルの register（作り手の一覧 all.generated.ts・K-326）。
      //   getTicket は K-60 の詳細に can.delegate を足したもの（delegate の register が replaces で差し替える）
      hooks: buildHooks(HOOK_MODULES, hookDeps, "server"),
    },
  });
  // 問い合わせの添付の上げ終わり（契約の口の外・K-950）。外の置き場が無いときだけローカルの上げ先も持つ
  app.route("/api/uploads", inquiryUploadRoute(hookDeps));
  return { app, report, close };
}

export interface Started {
  server: ServerType;
  port: number;
  close: () => Promise<void>;
}
/** HTTP で待ち受ける。port 0 なら空いている口（テスト）。戻り値の close で止める */
export async function startServer(config: Config, o: BootOptions = {}): Promise<Started> {
  const booted = await bootApi(config, o);
  // listen が終わってから返す（port 0 なら実際に取れた口を返す。閉じるのも listen 後）
  const { server, port } = await new Promise<{ server: ServerType; port: number }>((resolve) => {
    const srv = serve(
      { fetch: (req) => booted.app.fetch(edgeRequest(req, config.edgeSecret)), port: config.port, hostname: "0.0.0.0" },
      (info) => resolve({ server: srv, port: info.port }),
    );
  });
  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else booted.close().then(resolve, reject);
        });
      }),
  };
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("server.ts") || entry.endsWith("server.js")) {
  startServer(loadConfig()).then(
    (s) => console.log(`[api] 起動 port ${s.port}（存在確認 OK）`),
    (e: unknown) => {
      console.error("[api] 起動しない:", (e as Error).message);
      process.exit(1);
    },
  );
}
