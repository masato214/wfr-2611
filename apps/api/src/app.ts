import { Hono, type Context } from "hono";
import type { TenantContext } from "@kaname/db/context";
import { cors } from "hono/cors";
import { MIGRATIONS, checkMigrationOrder } from "@kaname/db";
import type { Repository } from "@kaname/db/repository";
import { tenantContext, type SessionResolver, type Vars } from "./middleware/tenant.js";
import type { Auth } from "@kaname/auth";
import { DEVICE_TOKEN_HEADER, type Resolved } from "@kaname/auth/resolver";
import { KanameError, recordErrorEvent } from "@kaname/errors";
import { ENDPOINTS } from "@kaname/contracts";
import { countryOf, ipOf } from "@kaname/auth/device";
import { registerAll } from "./routes/index.js";
import {
  DB_INPUT_REPLY,
  dbInputFailure,
  mfaRequired,
  sessionUnresolved,
  stepUpGuards,
  termsRequired,
} from "./contract/op.js";
import { defaultDeps } from "./contract/memory.js";
import type { ContractDeps } from "./contract/deps.js";
import { serverTiming } from "./server-timing.js";
import { CHALLENGE_HEADER, withPasskeyChallenge } from "./auth/passkey-challenge.js";

// 独立 API 層（Hono）。画面は API を叩くだけ。endpoint は T-A-* が 08_api/openapi.yaml どおりに足す（routes/ 配下・c.get("repo") 経由）。
export interface Health {
  ok: boolean;
  version: string;
  migrations: { expected: readonly string[]; order: "ok" | "ng" };
}

const CONTRACT_PATHS = ENDPOINTS.map((e) => ({
  method: e.method,
  literal: !/:[a-z_]/i.test(e.path),
  re: new RegExp(`^${e.path.replace(/:[a-z_]+/gi, "[^/]+")}$`),
}));

/** 閉じた再設定の部品の道（K-320）。disabledPaths が当たらない /reset-password/… と末尾の「/」もここで 404（/api/auth を外した道） */
const AUTH_RESET_CLOSED = /^\/(request-password-reset|reset-password)(\/.*)?$/;

/** 同意し直しの間も通す認証の部品の口（K-53。/api/auth を外した道）。ほかは全部止める（新しく足した道は止まる側に倒す） */
const AUTH_TERMS_OPEN = [
  /^\/sign-in(\/.*)?$/,
  /^\/sign-out$/,
  /^\/get-session$/,
  /^\/two-factor\/verify-(totp|backup-code|otp)$/,
  /^\/ok$/,
];

/** パスキーを足す部品の口（K-309）。始めの口の前で本人確認の取り直し（直前 15 分か、ログインから 15 分の内・D-128.141）を確かめる */
const PASSKEY_REGISTER_OPTIONS = /^\/passkey\/generate-register-options$/;
const PASSKEY_REGISTER = /^\/passkey\/(generate-register-options|verify-registration)$/;
/** 付けるまで進めない（K-321・D-128.141）の間も通す認証の部品の口：セッションを読む・ログアウト・パスキーを足す 2 本。ほかは全部止める
 *  （同意し直しの一覧 AUTH_TERMS_OPEN に当たる道はセッションを解かずに渡すので、ここに来ない） */
const AUTH_MFA_OPEN = [/^\/get-session$/, /^\/sign-out$/, PASSKEY_REGISTER];

export function health(version = "0.1.0"): Health {
  const order = checkMigrationOrder(MIGRATIONS);
  return { ok: order.ok, version, migrations: { expected: MIGRATIONS, order: order.ok ? "ok" : "ng" } };
}

export interface AppOptions {
  version?: string;
  repo?: Repository;
  resolveSession?: (c: Context) => Promise<TenantContext | null>;
  /** 認証（Better Auth）。/api/auth/* をこの handler に渡す */
  auth?: Auth;
  /** 要求の headers → 文脈（packages/auth の createSessionResolver）。resolveSession より優先 */
  resolve?: (headers: Headers) => Promise<Resolved | null>;
  /** 契約の route（08_api/openapi.yaml の 56 endpoint）。repo があれば既定で登録。hooks／上限／冪等の器を差し込める */
  contract?: Partial<ContractDeps> | false;
  /** 認証の拡張（/api/auth-ext/*：登録・ロック付きログイン・招待・Bridge の接続コード・資格情報を預ける） */
  authExt?: Hono;
  /** 画面の origin（別 origin から Bearer で呼ぶ。Cookie は使わない） */
  /** 画面の出どころ（"," 区切りで複数可）。CORS の許可元 */
  corsOrigin?: string | null;
  /** 確かめの口 GET /api/edge/echo を開く（K-262・KANAME_EDGE_ECHO=1・staging の確かめの間だけ）。既定は閉じる（404） */
  edgeEcho?: boolean;
}

/** 口の答えを配り先（画面の中継の CDN）や途中に貯めさせない（K-262）。認証の要る JSON が別の人に見えないように */
const NO_STORE = "private, no-store";

export function createApp(o: AppOptions | string = {}): Hono<Vars> {
  const opts = typeof o === "string" ? { version: o } : o;
  const app = new Hono<Vars>();
  // 要求ごとの DB の文の数と時間を答えの Server-Timing に書く（K-237）。数え器はこの中の全部（下の middleware と口）に掛かるので最初に置く
  app.use("*", serverTiming());
  // 全部の答え（/health・契約の口・認証の口の素の Response・404・onError の 500）に付ける。
  //   next の前の c.header() は、認証の部品が返す素の Response の道で消えるので、next の後に答えへ直に付ける
  app.use("*", async (c, next) => {
    await next();
    try {
      c.res.headers.set("Cache-Control", NO_STORE);
    } catch {
      // 頭を変えられない答え（外から受け取った Response）は写して付け直す
      c.res = new Response(c.res.body, c.res);
      c.res.headers.set("Cache-Control", NO_STORE);
    }
  });
  if (opts.corsOrigin)
    app.use(
      "/api/*",
      cors({
        // 画面の出どころは 1 つとは限らない（本番・staging・プレビュー）。WEB_BASE_URL は "," 区切りで複数書ける
        origin: opts.corsOrigin
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        allowHeaders: [
          "authorization",
          "content-type",
          "idempotency-key",
          "x-screen-id",
          "x-tenant-id",
          "x-signup-token",
          CHALLENGE_HEADER,
        ], // x-signup-token：登録の申し込みの印（K-51）。x-passkey-challenge：パスキーのチャレンジ（K-304）
        exposeHeaders: ["set-auth-token", "content-disposition"], // 成果物を落とすときのファイル名（D-106.7）
        credentials: true,
        maxAge: 600,
      }),
    );
  app.get("/health", (c) => {
    const h = health(opts.version ?? "0.1.0");
    return c.json(h, h.ok ? 200 : 503);
  });
  // 認証の endpoint（sign-in／sign-up／2 段階／セッション）。境界 B2 の handler にそのまま渡す
  //   同意し直し（K-53）：セッションの印が立った要求は、許可の一覧（同意し直しの画面に行くまでに要るもの）のほかを handler に渡さず 403・E-AUTH-010
  //   （パスワードの変更・ほかのセッションの取り消し・2 段階を入れる なども止まる）。セッションの無い要求（ログインの前・再設定のメールから）はそのまま渡す
  if (opts.auth)
    app.on(["GET", "POST"], "/api/auth/*", async (c) => {
      const sub = c.req.path.replace(/^\/api\/auth(?=\/|$)/, "") || "/";
      if (AUTH_RESET_CLOSED.test(sub)) return c.json({ code: "NOT_FOUND" }, 404);
      const h = c.req.raw.headers;
      if (opts.resolve && !AUTH_TERMS_OPEN.some((re) => re.test(sub)) && (h.get("authorization") || h.get("cookie"))) {
        // 解こうとして落ちたら handler に渡さず止める側に倒す（fail-closed・503・E-PAGE-003）。解けて null（セッションが無い）はそのまま渡す
        // 認証の部品の口は画面のログインの口。PC の印の頭（x-bridge-session・K-57）を外して、画面のログインで解く
        //   （頭を付けると PC の印の解決に回り、解けずに null＝「セッションが無い」として同意し直しの止めを抜けてしまう）
        const web = new Headers(h);
        web.delete(DEVICE_TOKEN_HEADER);
        let r: Resolved | null;
        try {
          r = await opts.resolve(web);
        } catch (e) {
          return sessionUnresolved(c, "認証の部品の口", e);
        }
        if (r?.termsPending) return termsRequired(c);
        // 付けるまで進めない（K-321）：同意し直しの次。印が立っていれば、許した道のほかを handler に渡さず 403・MFA_REQUIRED
        if (r?.mfaPending && !AUTH_MFA_OPEN.some((re) => re.test(sub))) return mfaRequired(c);
        // パスキーを足す（K-309）：Kaname のセッション（public.sessions）が生きていなければ、部品のセッションが残っていても通さない。
        //   始めの口は取り直しか、ログインから 15 分の内でなければ 403・STEP_UP_REQUIRED（チャレンジを作らない）
        if (PASSKEY_REGISTER.test(sub)) {
          if (!r) return c.json({ error: "unauthenticated", code: "UNAUTHENTICATED" }, 401);
          const stale = PASSKEY_REGISTER_OPTIONS.test(sub)
            ? stepUpGuards(r.ctx).requireStepUpOrFreshLogin()
            : undefined;
          if (stale) return c.json(stale.body as Record<string, unknown>, stale.status as 403);
        }
      }
      // パスキーのチャレンジは Cookie でなく JSON と頭で受け渡す（K-304）。ほかの道はそのまま
      return withPasskeyChallenge(opts.auth!, c.req.raw, sub, (r) => opts.auth!.handler(r));
    });
  if (opts.authExt) app.route("/api/auth-ext", opts.authExt);
  // 確かめの口（K-262）：口の入口で置き換えた後の IP と国を、セッションの見張りと同じ読み方で返す。
  //   ログインなしで答えるので、/api/* のテナント文脈より前に置く。開いていなければ登録しない（404）。契約の外（/health と同じ）
  if (opts.edgeEcho)
    app.get("/api/edge/echo", (c) => c.json({ ip: ipOf(c.req.raw.headers), country: countryOf(c.req.raw.headers) }));
  // /api/* 配下は全部テナント文脈を通る（SET LOCAL の網羅＝G6）
  //   resolve は同意し直しの印（termsPending・K-53）も返す。resolveSession（文脈だけを返す古い形・試験の土台）は印の無いものとして包む
  const legacy = opts.resolveSession;
  const resolver: SessionResolver | undefined = opts.resolve
    ? async (c) => {
        const r = await opts.resolve!(c.req.raw.headers);
        if (!r) return null;
        // 抜けた人の答え（memberLeft）を持つ解決はそのまま渡し、入口で DB を引き直さない（K-233）
        const mfaPending = r.mfaPending === true; // 付けるまで進めないの印（K-321・入口 op.ts が止める）
        return r.memberLeft === undefined
          ? { ctx: r.ctx, termsPending: r.termsPending, mfaPending }
          : { ctx: r.ctx, termsPending: r.termsPending, mfaPending, memberLeft: r.memberLeft };
      }
    : legacy
      ? async (c) => {
          const ctx = await legacy(c);
          return ctx ? { ctx, termsPending: false } : null;
        }
      : undefined;
  if (opts.repo) app.use("/api/*", tenantContext(opts.repo, resolver));
  // 決まった名前の道（/invitations/link）に、その名前が持たないメソッドで来たら、「:id」の道に当てず 405 を返す（契約の外のメソッド・K-421）
  app.use("/api/*", async (c, next) => {
    const m = c.req.method;
    if (m === "OPTIONS" || m === "HEAD") return next();
    const lit = CONTRACT_PATHS.filter((p) => p.literal && p.re.test(c.req.path));
    if (lit.length && !lit.some((p) => p.method === m)) {
      const allow = [...new Set(lit.map((p) => p.method))].join(", ");
      return c.json({ error: "method_not_allowed", code: "METHOD_NOT_ALLOWED" }, 405, { allow });
    }
    return next();
  });
  if (opts.repo && opts.contract !== false) registerAll(app, defaultDeps(opts.contract ?? {}));
  // 契約にある道すじに、契約に無いメソッド（TRACE など）で来たら 405 と使えるメソッド（Allow）を返す（404 にしない・K-35）
  app.notFound((c) => {
    // 道すじが「/invitations/link」のように決まった名前と「/invitations/:id」の両方に当たるときは、決まった名前の方の使えるメソッドだけを返す（契約はその道すじを別の道として書く・K-421）
    const hit = CONTRACT_PATHS.filter((p) => p.re.test(c.req.path));
    const allow = [...new Set((hit.some((p) => p.literal) ? hit.filter((p) => p.literal) : hit).map((p) => p.method))];
    if (allow.length)
      return c.json({ error: "method_not_allowed", code: "METHOD_NOT_ALLOWED" }, 405, { allow: allow.join(", ") });
    return c.json({ error: "not_found", code: "NOT_FOUND" }, 404);
  });
  // エラーは正本（errors.json）の 1 件として返す（D-069）。出た記録は error_events に（文脈があるときだけ）。正本に無い例外は 500・文言を作らない
  app.onError(async (err, c) => {
    if (err instanceof KanameError) {
      const ctx = c.get("ctx");
      let eventId: string | null = null;
      if (opts.repo && ctx) {
        try {
          eventId = await recordErrorEvent(opts.repo, ctx, err.code, c.req.header("x-screen-id") ?? null, {
            path: c.req.path,
          });
        } catch {
          eventId = null; // 記録に失敗しても応答は返す（記録の失敗で二重に落とさない）
        }
      }
      return c.json({ ...err.toJSON(), event_id: eventId }, err.status as 400);
    }
    // 2 層目（K-145・D-130.2）：入口の確かめをすり抜けた値が DB の決まりに合わずに落ちた（形の違う uuid＝22P02 ほか）。500 でなく 422・決まった文。
    //   記録は番号と制約の名前だけ。道は道の型（routePath）で書く（実際の道には送った値＝形違いの id が入る）。DB の文も送った値を含むので出さない
    const dbIn = dbInputFailure(err);
    if (dbIn) {
      console.error(
        "[api] 422",
        c.req.method,
        c.req.routePath,
        dbIn.code,
        ...(dbIn.constraint ? [dbIn.constraint] : []),
      );
      return c.json(DB_INPUT_REPLY, 422);
    }
    console.error("[api] 500", c.req.method, c.req.path, err instanceof Error ? (err.stack ?? err.message) : err); // 詳細はログにだけ（応答には出さない）
    return c.json(
      {
        error: "internal",
        code: null,
        message: null,
        action: null,
        support_code: c.req.header("x-request-id") ?? null,
      },
      500,
    );
  });
  return app;
}
