// 起動時のブート設定（例外 X-002：process.env をここだけが読む）。1 回だけ読み、型付きで配る。顧客の資格情報は絶対に扱わない（それは関門 C8）。
// .env.example が正本。CI G13（ci:env-audit）がここで読む名前と .env.example の整合を検査する。
export interface Config {
  env: "development" | "staging" | "production" | "test";
  databaseUrl: string;
  /** 会話が変わった知らせを受ける接続（D-113・台帳 X-008）。LISTEN が効く直の接続か Session pooler（5432）。
   *  Transaction pooler（6543）では受けられない。無ければ null（画面は今までどおり見に行く） */
  listenDatabaseUrl: string | null;
  authDatabaseUrl: string;
  authSecret: string;
  baseUrl: string;
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  secretsMasterKey: string;
  resendApiKey: string | null;
  /** 画面の URL（メールのリンクの先・CORS）。無ければ null（API と同じ origin） */
  /** 画面の正の出どころ（メールのリンクはここで組む）。WEB_BASE_URL の 1 つ目 */
  webBaseUrl: string | null;
  /** CORS の許可元（WEB_BASE_URL は "," 区切りで複数書ける：本番・staging・プレビュー） */
  webOrigins: string[];
  /** メールの差出人（Resend の送信ドメイン） */
  mailFrom: string;
  /** 運営（ENGINE BASE）の連絡先。問い合わせの届け先・運営アカウントのログイン名 */
  opsEmail: string;
  /** 返信したときの宛先（D-096.5）。差出人は noreply、返信は問い合わせの窓口へ */
  mailReplyTo: string;
  /** 運営者の情報（D-096）。メールの署名・画面・特商法表記が同じ値を読む。ここ以外に書かない */
  operator: {
    service: string;
    company: string;
    representative: string;
    email: string;
    /** メールには載せない（D-096.3）。特商法表記・請求書で使う */
    phone: string;
    /** まだ持たない（D-096.4）。宣伝メール・有料化の前に決め直す */
    address: string | null;
  };
  /** この接頭辞で始まる宛先には送らない（dev で自動テストが送出先の上限を食い潰さないため）。空なら必ず送る */
  mailSuppressPrefix: string;
  /** Bridge の配布物（インストーラ）の置き場。Kaname のサーバーから配る（D-015.6）。
   *  空なら「まだ配布していません」。顧客に外のサービス（GitHub 等）を見せない */
  bridgeReleaseBase: string;
  /** 配布物を置いた手元のフォルダ（署名・置き場が決まる前でも、ここから配れる）。本番では使わない */
  bridgeReleaseDir: string;
  /** 資格情報の預かり先 Infisical（D-101）。staging／本番は必須（起動時に確かめる）。開発は無くてよい（メモリ） */
  infisical: { siteUrl: string; clientId: string; clientSecret: string; projectId: string; environment: string } | null;
  /** 画面の入口が口へ中継するときの秘密（K-262・KANAME_EDGE_SECRET）。合うときだけ写した IP と国を使う。無ければ undefined（写した頭を消すだけ） */
  edgeSecret?: string | undefined;
  /** 確かめの口 GET /api/edge/echo を開く（K-262・KANAME_EDGE_ECHO=1）。staging の確かめの間だけ。本番は入れない */
  edgeEcho?: boolean;
  /** 請求書の画面の支払い条件と振込先（K-958・D-125.24：直書きしない）。BILLING_TERMS・BILLING_PAYEE（「|」で区切る）。
   *  振込先が空の並びなら、画面は「まだ決まっていません」（K-960） */
  billing: { terms: string; payeeLines: string[] };
  port: number;
}

/** 支払い条件の既定（BILLING_TERMS が無いとき） */
export const BILLING_TERMS_DEFAULT = "請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い";

/** 請求書の支払い条件と振込先を環境変数から読む（K-958）。振込先は「|」で区切った行 */
export function billingFrom(env: Record<string, string | undefined>): Config["billing"] {
  return {
    terms: env["BILLING_TERMS"]?.trim() || BILLING_TERMS_DEFAULT,
    payeeLines: (env["BILLING_PAYEE"] || "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean),
  };
}
const REQUIRED = [
  "DATABASE_URL",
  "AUTH_DATABASE_URL",
  "AUTH_SECRET",
  "BASE_URL",
  "STORAGE_ENDPOINT",
  "STORAGE_REGION",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "SECRETS_MASTER_KEY",
] as const;
export { runStartupChecks, assertStartup, StartupFailed, type StartupCheck, type StartupReport } from "./startup.js";
export const ENV_KEYS = [
  ...REQUIRED,
  "NODE_ENV",
  "RESEND_API_KEY",
  "PORT",
  "STORAGE_FORCE_PATH_STYLE",
  "DATABASE_ADMIN_URL",
  "DATABASE_LISTEN_URL",
  "KANAME_APP_DB_PASSWORD",
  "KANAME_AUTH_DB_PASSWORD",
  "WEB_BASE_URL",
  "MAIL_FROM",
  "INFISICAL_SITE_URL",
  "INFISICAL_CLIENT_ID",
  "INFISICAL_CLIENT_SECRET",
  "INFISICAL_PROJECT_ID",
  "INFISICAL_ENVIRONMENT",
  "KANAME_EDGE_SECRET",
  "KANAME_EDGE_ECHO",
] as const;
export type EnvKey = (typeof ENV_KEYS)[number];
/** migration が役割に入れるパスワード（T-F-18）。process.env を読むのはここだけ（X-002） */
export function rolePasswords(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  return {
    KANAME_APP_DB_PASSWORD: env["KANAME_APP_DB_PASSWORD"],
    KANAME_AUTH_DB_PASSWORD: env["KANAME_AUTH_DB_PASSWORD"],
  };
}
/** migration だけが使う管理者の接続（staging／本番）。無ければ null（ローカルは DATABASE_URL が superuser） */
export function adminDatabaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  return env["DATABASE_ADMIN_URL"] || null;
}
/** 任意の名前を 1 つ読む（無ければ null）。migration の管理者 URL など */
export function optionalEnv(name: EnvKey, env: Record<string, string | undefined> = process.env): string | null {
  return env[name] || null;
}
/** 1 つだけ読む（migration の CLI 等、全部の設定が要らない入口用）。無ければ名前を挙げて落ちる */
export function requireEnv(name: EnvKey, env: Record<string, string | undefined> = process.env): string {
  const v = env[name];
  if (!v) throw new Error(`設定が無い: ${name}（.env.example を見る）`);
  return v;
}

/** 規約・プライバシーポリシーの文面（K-53）に入れる値。運営者の情報（Config.operator と同じ）・返信の宛先・預ける先の事業者と合意の裁判所。
 *  起動に要る値の確かめをしない純粋な関数（画面の文面のページも呼ぶ。loadConfig は起動に要る値が無いと投げるので画面から呼べない）。
 *  預ける先と裁判所は既定を決め打ちしない（事実と違う事業者名を出さない・値は K-86 で専門家と決める）。無ければ null */
export interface LegalValues {
  operator: Config["operator"];
  mailReplyTo: string;
  legal: {
    court: string | null;
    hostingProvider: string | null;
    mailProvider: string | null;
    secretsProvider: string | null;
    storageProvider: string | null;
  };
}
export function legalValues(env: Record<string, string | undefined> = process.env): LegalValues {
  return {
    operator: {
      service: "Kaname",
      company: env["OPERATOR_COMPANY"] || "株式会社ENGINE BASE",
      representative: env["OPERATOR_REPRESENTATIVE"] || "高本聖斗",
      email: env["OPS_EMAIL"] || "info@engine-base.com",
      phone: env["OPERATOR_PHONE"] || "090-1180-5989",
      address: env["OPERATOR_ADDRESS"] || null,
    },
    mailReplyTo: env["MAIL_REPLY_TO"] || env["OPS_EMAIL"] || "info@engine-base.com",
    legal: {
      court: env["LEGAL_COURT"] || null,
      hostingProvider: env["LEGAL_HOSTING_PROVIDER"] || null,
      mailProvider: env["LEGAL_MAIL_PROVIDER"] || null,
      secretsProvider: env["LEGAL_SECRETS_PROVIDER"] || null,
      storageProvider: env["LEGAL_STORAGE_PROVIDER"] || null,
    },
  };
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const legal = legalValues(env);
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`起動に要る設定が無い: ${missing.join(", ")}（.env.example を見る）`);
  const mk = env["SECRETS_MASTER_KEY"]!;
  if (Buffer.from(mk, "base64").length < 32) throw new Error("SECRETS_MASTER_KEY は base64 で 32 バイト以上");
  const e = (env["NODE_ENV"] ?? "development") as Config["env"];
  if (!["development", "staging", "production", "test"].includes(e)) throw new Error(`NODE_ENV が不明: ${e}`);
  // Infisical は全部そろっているか、全部無いか。半端は設定の間違い（黙ってメモリに落とさない）
  const INF = [
    "INFISICAL_CLIENT_ID",
    "INFISICAL_CLIENT_SECRET",
    "INFISICAL_PROJECT_ID",
    "INFISICAL_ENVIRONMENT",
  ] as const;
  const infHave = INF.filter((k) => env[k]);
  if (infHave.length && infHave.length < INF.length)
    throw new Error(`Infisical の設定が半端: ${INF.filter((k) => !env[k]).join(", ")} が無い`);
  return {
    env: e,
    databaseUrl: env["DATABASE_URL"]!,
    listenDatabaseUrl: env["DATABASE_LISTEN_URL"] || null,
    authDatabaseUrl: env["AUTH_DATABASE_URL"]!,
    authSecret: env["AUTH_SECRET"]!,
    baseUrl: env["BASE_URL"]!,
    storage: {
      endpoint: env["STORAGE_ENDPOINT"]!,
      region: env["STORAGE_REGION"]!,
      bucket: env["STORAGE_BUCKET"]!,
      accessKeyId: env["STORAGE_ACCESS_KEY_ID"]!,
      secretAccessKey: env["STORAGE_SECRET_ACCESS_KEY"]!,
      forcePathStyle: (env["STORAGE_FORCE_PATH_STYLE"] ?? "true") === "true",
    },
    secretsMasterKey: mk,
    resendApiKey: env["RESEND_API_KEY"] ?? null,
    webBaseUrl: (env["WEB_BASE_URL"] || "").split(",")[0]?.trim() || null,
    webOrigins: (env["WEB_BASE_URL"] || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    mailFrom: env["MAIL_FROM"] || "Kaname <noreply@engine-base.com>",
    opsEmail: env["OPS_EMAIL"] || "info@engine-base.com",
    mailReplyTo: legal.mailReplyTo,
    operator: legal.operator,
    mailSuppressPrefix: env["MAIL_SUPPRESS_PREFIX"] || "",
    bridgeReleaseBase: (env["BRIDGE_RELEASE_BASE"] || "").replace(/\/$/, ""),
    bridgeReleaseDir: env["BRIDGE_RELEASE_DIR"] || "",
    infisical: infHave.length
      ? {
          siteUrl: (env["INFISICAL_SITE_URL"] || "https://us.infisical.com").replace(/\/$/, ""),
          clientId: env["INFISICAL_CLIENT_ID"]!,
          clientSecret: env["INFISICAL_CLIENT_SECRET"]!,
          projectId: env["INFISICAL_PROJECT_ID"]!,
          environment: env["INFISICAL_ENVIRONMENT"]!,
        }
      : null,
    edgeSecret: env["KANAME_EDGE_SECRET"] || undefined,
    edgeEcho: env["KANAME_EDGE_ECHO"] === "1",
    billing: billingFrom(env),
    port: Number(env["PORT"] ?? 3001),
  };
}
