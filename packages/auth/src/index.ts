// 認証（Better Auth 1.7）。境界 B2：better-auth を import してよいのはこのパッケージだけ（CI G7）。
// 表は Postgres の schema "kaname_auth"（RLS の対象の public とは分ける。Supabase は schema auth を自社の認証に使うので同じ名前にしない：T-F-18）。失効の正は public.sessions（app.session_alive）。トークンの期限には頼らない。
import { deviceOf } from "./device.js";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { bearer, twoFactor } from "better-auth/plugins";
import { PostgresDialect } from "kysely";
import pg from "pg";
import { uuidv7 } from "@kaname/db/id";
import { countQueries, markDbSession } from "@kaname/db/pool";
import { optionalEnv } from "@kaname/config";
import { mailTag } from "./signup.js";
import { RESET_PREFIX, resetHash } from "./reset.js";
import { CODE_LOCK, generateBackupCodes } from "./two_factor.js";
import { kanamePasskey, PASSKEY_DISABLED_PATHS } from "./passkey.js";
import { kanamePasskeyManage, PASSKEY_STEP_UP_PATH } from "./passkeys.js";
import { FRAGMENT_DISABLED_PATHS } from "./disabled-paths.generated.js";
export {
  normalizePasskeyName,
  renamePasskeyOf,
  removePasskeyOf,
  verifyPasskeyStepUp,
  PASSKEY_LAST_METHOD,
  PASSKEY_NEED_TWO_FACTOR,
  type RemovePasskeyResult,
} from "./passkeys.js";

export interface AuthOptions {
  /** 認証ロール（kaname_auth）で接続する URL。schema auth に読み書きする */
  authDatabaseUrl: string;
  /** public.sessions を開く／閉じる関数を呼ぶための接続（kaname_app でよい） */
  appPool: pg.Pool;
  secret: string;
  baseURL: string;
  issuer?: string;
  /** メールの送出（関門 C6・packages/notify の transport）。無ければ送らない（開発：ログに出す） */
  mailer?: Mailer;
  /** 画面の URL（メールのリンクの先）。無ければ baseURL */
  webBaseURL?: string;
  /** 認証のプールの本数（既定 5。Vercel の関数は 1 つにつき 2・G-16） */
  poolMax?: number;
}
export interface Mail {
  to: string;
  subject: string;
  text: string;
  url: string;
  /** ops_setup：運営の人がパスキーを付けるリンク（K-945・命令 ops:first と運営の人を足す口）*/
  kind: "verify" | "reset" | "new_device" | "ops_setup";
}
export type Mailer = (m: Mail) => Promise<void>;
/** 2 段階の待ちの印の長さ（秒・K-301） */
export const TWO_FACTOR_PENDING_SEC = 300;
/** 閉じる部品の道（ロックと止めを通らない道・K-301） */
/** パスキーの部品のうち Kaname の決まりを通らない口（一覧・名前・外す）も閉じる（K-304） */
/** パスキーで取り直す内部の口（K-309）も道は閉じる（サーバーの中の auth.api からだけ呼ぶ） */
/** freshAge を 0 にしたので、部品の「1 日以内のセッション」で守っていた口のうち Kaname が使わない 2 つも閉じる（K-309・レビューの指摘）：
 *  list-sessions（その人の全部のセッションの印を返す）・unlink-account（ログインの手段を外す） */
const FRESH_ONLY_PATHS = ["/list-sessions", "/unlink-account"] as const;
/** 再設定の部品の道も閉じる（画面は契約の口 requestPasswordReset・resetPassword だけを呼ぶ・K-320）。
 *  disabledPaths は道とちょうど同じ文字のときだけ閉じるので、/reset-password/… と末尾の「/」は口の入口（apps/api の app.ts）が 404 にする */
/** ログアウトの部品の道（/sign-out）も閉じる（K-317）：画面は契約の口 signOut（K-306・public.sessions も閉じる）だけを使う。sessions を閉じない道を残さない */
/** 前の 2 段階の登録の頁とパスワードを変える頁だけが使っていた部品の道も閉じる（K-319・画面は契約の口 startTwoFactor・confirmTwoFactor・
 *  changePassword・setMyPassword だけを使う）。中身はサーバーの中の auth.api から呼ぶ（道を閉じても auth.api は効く） */
const OLD_SCREEN_PATHS = [
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/change-password",
] as const;
export const DISABLED_PATHS = [
  "/sign-in/email",
  ...OLD_SCREEN_PATHS,
  "/sign-out",
  ...PASSKEY_DISABLED_PATHS,
  PASSKEY_STEP_UP_PATH,
  ...FRESH_ONLY_PATHS,
  "/request-password-reset",
  "/reset-password",
  // チケットごとに足す閉じる道（disabled-paths.d/K-<番号>.ts → 作り手 scripts/ci/gen_ts_registries.py・K-326）
  ...FRAGMENT_DISABLED_PATHS,
] as const;
/** 止めの 1 か所（K-303）の答え → errors.json の id。人の止め・会社の止め・会社の人が無い・抜けた */
export const LOGIN_BLOCKED: Readonly<Record<string, string>> = {
  member_suspended: "E-AUTH-011",
  workspace_suspended: "E-AUTH-012",
  member_left: "E-AUTH-007",
};
/** 止めの確かめができなかった（止めの関数が落ちた）ときの id。止める側に倒す（fail-closed・503） */
export const LOGIN_GATE_DOWN = "E-PAGE-003";
/** 部品の道（パスワード・6 けた・パスキー・直に呼ぶ）が止めで断られたときの印。signInWithLock と口はこの id で見分ける */
/** 運営の人がパスキーでない道（パスワードなど）で入ろうとした（K-944・D-128.70・D-156.2）。運営の場所はパスキーしか使えない（403） */
export const OPS_PASSKEY_ONLY = "E-AUTH-022";
export const LOGIN_BLOCKED_CODES: ReadonlySet<string> = new Set([
  ...Object.values(LOGIN_BLOCKED),
  LOGIN_GATE_DOWN,
  OPS_PASSKEY_ONLY,
]);
/** パスキーで入る部品の道。部品 @better-auth/passkey の版の道の名前。版を上げたらここだけ直す（K944-API-001 が拾う）。
 *  セッションの hook が「パスキーで入ったか」をこの道で見分ける（K-944。置き換える葉もこの定数を使う） */
export const PASSKEY_VERIFY_PATH = "/passkey/verify-authentication";
/** 例外の種類だけ（文や値は出さない） */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
/** 部品のパスワードの段の道（2 段階を付けた人はここではセッションを写さない） */
const PASSWORD_STEP_PATHS = new Set(["/sign-in/email"]);

/** 部品（Better Auth）のログ。パスキーの確かめの失敗（@simplewebauthn の例外の文にチャレンジと期待の値が入る）は、例外の種類だけを出す */
function authLog(level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]): void {
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (/passkey|authentication|registration/i.test(message)) {
    const kind = args[0] instanceof Error ? args[0].name : typeof args[0];
    out(`[Better Auth] ${message}（${kind}）`);
    return;
  }
  out(`[Better Auth] ${message}`, ...args);
}

/** 型は core の Auth（plugin の endpoint 型は使わない＝zod の内部型を .d.ts に出さない） */
export type Auth = ReturnType<typeof betterAuth<BetterAuthOptions>>;

export function createAuth(o: AuthOptions): { auth: Auth; pool: pg.Pool } {
  // 要求ごとの文の数と時間を数える（K-237・口の答えの Server-Timing）。流す文と接続の取り方は変えない
  const pool = countQueries(new pg.Pool({ connectionString: o.authDatabaseUrl, max: o.poolMax ?? 5 }));
  // 送出先が無ければリンクをログに出す（開発）。送出先があっても、本番以外はリンクを残す
  // （実際に送っていても、確かめる人が受信箱を開かずに先へ進めるように）
  const dev = optionalEnv("NODE_ENV") !== "production";
  const mail: Mailer = o.mailer
    ? async (m) => {
        if (dev) console.warn(`[auth] リンク（${m.kind} → ${mailTag(m.to)}）: ${m.url}`);
        await o.mailer!(m);
      }
    : async (m) =>
        // 本番では手がかり入りのリンクをログに残さない（K-313 のレビュー）
        console.warn(`[auth] メールの送出先が無い（${m.kind} → ${mailTag(m.to)}）${dev ? `: ${m.url}` : ""}`);
  // 画面の URL（パスキーの rpID と origin・別の origin の画面から来る Cookie つきの verify を通す trustedOrigins の元・K-304）
  const web = new URL(o.webBaseURL ?? o.baseURL);
  const auth = betterAuth({
    database: { dialect: new PostgresDialect({ pool }), type: "postgres", casing: "snake", schemaName: "kaname_auth" },
    secret: o.secret,
    baseURL: o.baseURL,
    // チャレンジを Cookie にして部品に渡すので verify は Cookie つきの POST になる。部品は Origin を trustedOrigins と比べる
    //   （既定は baseURL＝API の origin だけ）。画面の origin を足す。origin の確かめは切らない（K-304・K304-API-023）
    trustedOrigins: [web.origin],
    // 部品の失敗のログは本文と種類だけ。パスキーの確かめの失敗は、例外の文にチャレンジの値が入るので落とす（K-304・値をログに出さない）
    logger: { log: authLog },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      autoSignIn: true,
      // 入り直す（password-reset）：登録の有無は漏らさない（Better Auth が 200 を返す）。リンクは 30 分
      sendResetPassword: async ({ user, token }) => {
        const url = `${o.webBaseURL ?? o.baseURL}/password-reset?token=${encodeURIComponent(token)}`;
        await mail({
          to: user.email,
          subject: "Kaname のパスワードを再設定する",
          text: `次のリンクから新しいパスワードを設定してください（30 分で失効）。\n${url}`,
          url,
          kind: "reset",
        });
      },
      resetPasswordTokenExpiresIn: 60 * 30,
      // 再設定したら、認証側のほかのセッションも、Kaname の端末（画面・Bridge）も全部切る（G-14・変更と同じ。2026-10-01 QA で抜けていた）
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        await o.appPool.query("select app.revoke_sessions_for_auth_user($1, 'password_changed')", [user.id]);
      },
    },
    emailVerification: {
      sendOnSignUp: false, // 保留の申し込みから自分で送る（D-088.1）。登録の時点では利用者がまだ無い
      autoSignInAfterVerification: true,
      expiresIn: 60 * 30,
      sendVerificationEmail: async ({ user, token }) => {
        const url = `${o.webBaseURL ?? o.baseURL}/verify-email?token=${encodeURIComponent(token)}`;
        await mail({
          to: user.email,
          subject: "Kaname のメールアドレスを確認する",
          text: `次のリンクを押すと本人であることが記録されます（30 分で失効）。\n${url}`,
          url,
          kind: "verify",
        });
      },
    },
    user: {
      additionalFields: {
        company_name: { type: "string", required: false, input: true },
      },
    },
    // freshAge 0：部品の「作ってから 1 日以内のセッション」の確かめ（パスキーを足す口）を使わない。Kaname の決まりは
    //   「直前 15 分の取り直しか、ログインから 15 分の内」で、API の入口（apps/api/src/app.ts）が確かめる（K-309・D-128.141）。
    //   部品の 1 日の確かめが残ると、2 日前に入った人は取り直しても足せない
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60, freshAge: 0 },
    // 再設定のリンクの手がかりは DB に平文で置かない（K-313）。頭（reset-password:）を残したハッシュにし、自分の送る関数
    //   （reset.ts の resetKey）と同じ形にする。部品はこの { default, overrides } と { hash } の形だけを読む
    verification: {
      storeIdentifier: {
        default: "plain",
        overrides: {
          [RESET_PREFIX]: { hash: async (id: string) => RESET_PREFIX + resetHash(id.slice(RESET_PREFIX.length)) },
        },
      },
    },
    advanced: { database: { generateId: () => uuidv7(), joins: true } }, // session と user を 1 本で引く（K-233）
    // 2 段階の待ちの印（パスワードを通った後・6 けたの前）は 5 分（部品の既定 10 分を直す・K-301）
    // 6 けた（とバックアップコード）は 5 回続けて違えたら 15 分止める（人ごと・D-128.141・K-302）。バックアップコードは小文字と数字だけ（answer=6bdcb125e8f7）
    // パスキー（K-304）：パスワードのロックの外・6 けたを聞かない（2 段階の after の hook は /sign-in/email だけ・D-128.60）
    plugins: [
      twoFactor({
        issuer: o.issuer ?? "Kaname",
        twoFactorCookieMaxAge: TWO_FACTOR_PENDING_SEC,
        accountLockout: { ...CODE_LOCK },
        backupCodeOptions: { customBackupCodesGenerate: generateBackupCodes },
      }),
      bearer(),
      ...kanamePasskey({ webBaseURL: web.href, authPool: pool, appPool: o.appPool }),
      // パスキーを足すときの名前・記録・印と、パスキーでの取り直し（K-309）
      kanamePasskeyManage({ webBaseURL: web.href, authPool: pool, appPool: o.appPool }),
    ],
    // ロック（app.login_attempts）を通らない部品のログインの道は閉じる（404・K-301）。サーバーの中の auth.api.signInEmail は道を通らないので動く
    disabledPaths: [...DISABLED_PATHS],
    databaseHooks: {
      user: {
        create: {
          // 登録の直後：会社名があれば会社・根の層・代表・全権限・自分のAI を作る（app.create_company・T-U-01）。招待で入る人は会社名を持たない
          after: async (user) => {
            const company = (user as { company_name?: string | null }).company_name?.trim();
            if (!company) return;
            await o.appPool.query("select app.create_company($1, $2, $3)", [user.id, company, user.name || company]);
          },
        },
      },
      session: {
        create: {
          // 止めの 1 か所（K-303・D-128.91）：どの道（パスワード・2 段階の 6 けた・パスキー・部品を直に呼ぶ）でも、セッションを作る直前にここを通る。
          //   止められた人・止められた会社・抜けた人は APIError（body.code が errors.json の id・文は口が目録から引く）で断り、セッションを作らせない。
          //   止めの関数が落ちたら止める側に倒す（503・E-PAGE-003）。理由の記録（security_events の login_blocked）は関数が書く
          before: async (session, ctx) => {
            let verdict: string | undefined;
            try {
              const r = await o.appPool.query<{ verdict: string }>("select app.login_gate($1) as verdict", [
                session.userId,
              ]);
              verdict = r.rows[0]?.verdict;
            } catch (e) {
              console.error(`[auth] 止めの確かめができなかった（${kindOf(e)}）`); // 文や値は出さない（種類だけ）
              throw new APIError("SERVICE_UNAVAILABLE", { code: LOGIN_GATE_DOWN });
            }
            if (verdict !== "ok") {
              const code = verdict ? LOGIN_BLOCKED[verdict] : undefined;
              // 知らない答え（関数と部品の版ずれ）も止める側に倒す
              if (!code) throw new APIError("SERVICE_UNAVAILABLE", { code: LOGIN_GATE_DOWN });
              throw new APIError("FORBIDDEN", { code });
            }
            // 運営の人はパスキーだけで入る（K-944・D-128.70・D-156.2）：パスキーでない道なら 403・E-AUTH-022 でセッションを作らせない。
            //   運営の人かどうかは DB の関数だけが決める（関門 C2）。関数が落ちたら止める側に倒す（503・E-PAGE-003）
            const viaPasskey = (ctx as { path?: string } | null)?.path === PASSKEY_VERIFY_PATH;
            let ops: string | undefined;
            try {
              const r = await o.appPool.query<{ v: string }>("select app.ops_login_check($1, $2) as v", [
                session.userId,
                viaPasskey,
              ]);
              ops = r.rows[0]?.v;
            } catch (e) {
              console.error(`[auth] 運営の入り方の確かめができなかった（${kindOf(e)}）`);
              throw new APIError("SERVICE_UNAVAILABLE", { code: LOGIN_GATE_DOWN });
            }
            if (ops === "ok") return;
            if (ops === "passkey_only") throw new APIError("FORBIDDEN", { code: OPS_PASSKEY_ONLY });
            throw new APIError("SERVICE_UNAVAILABLE", { code: LOGIN_GATE_DOWN });
          },
          // 認証のセッションができたら public.sessions に写す（失効の正はこちら）。会社に属していない利用者は null（登録の途中）
          after: async (session, ctx) => {
            // 2 段階を付けた人のパスワードの段：部品は一度ふつうにセッションを作ってから消し、待ちの印に替える。
            //   その間は写さない・規約の印も新しい端末の知らせも出さない（6 けたで入ったときのセッションで出す・K-301）
            if (PASSWORD_STEP_PATHS.has((ctx as { path?: string } | null)?.path ?? "")) {
              const u = await pool.query<{ on: boolean | null }>(
                'select "twoFactorEnabled" as on from kaname_auth."user" where id = $1',
                [session.userId],
              );
              if (u.rows[0]?.on) return;
            }
            const ua = session.userAgent ?? "";
            const kind = /Kaname-Bridge/i.test(ua) ? "bridge" : /Kaname-API/i.test(ua) ? "api" : "web";
            try {
              await o.appPool.query("select app.open_session($1, $2, $3, $4, $5)", [
                session.id,
                session.userId,
                kind,
                ua.slice(0, 200) || null,
                null,
              ]);
            } catch (e) {
              // 写せなかったら認証側のセッションも消してから上げる（半分だけ入った状態を残さない・K-301・G-15）
              await pool.query("delete from kaname_auth.session where id = $1", [session.id]).catch(() => undefined);
              throw e;
            }
            // 入り方を残す（K-944）：パスキーで入ったセッションに login_kind 'passkey'。解決は運営の人のこの印のセッションだけを運営として解く（2 層目）。
            //   書けなかったら認証側のセッションを消してから上げる（半分だけ入った状態を残さない）。消すのも落ちたら種類だけをログに出して元の失敗を上げる
            //   （残った認証側のセッションは入り方が無いので、運営として解けない）
            if ((ctx as { path?: string } | null)?.path === PASSKEY_VERIFY_PATH) {
              try {
                await o.appPool.query("select app.mark_session_login_kind($1, 'passkey')", [session.id]);
              } catch (e) {
                await pool
                  .query("delete from kaname_auth.session where id = $1", [session.id])
                  .catch((x: unknown) =>
                    console.error(`[auth] 入り方を書けなかった後の後片付けができなかった（${kindOf(x)}）`),
                  );
                // 元の例外をそのまま投げると、部品 @better-auth/passkey が APIError でない例外を 400 に包む。止めの hook と同じ 503・E-PAGE-003 で上げる
                console.error(`[auth] 入り方を書けなかった（${kindOf(e)}）`);
                throw new APIError("SERVICE_UNAVAILABLE", { code: LOGIN_GATE_DOWN });
              }
            }
            // 同意し直しの印（K-53・D-125.162）：今の版の利用規約かプライバシーポリシーにまだ同意していなければ、このセッションに立てる。
            //   パスワード・パスキー・2 段階の後・確認のメールで確定した直後のどれもこの hook を通る。Bridge のセッションには立てない（D-128.137）
            await o.appPool.query("select app.mark_session_terms($1)", [session.id]);
            // 付けるまで進めない印（K-308・D-128.141）：パスキーも 2 段階も無い人の画面のセッションに立てる。PC のセッションには立てない
            await o.appPool.query("select app.mark_session_mfa($1)", [session.id]);
            // 新しい端末でのログインは本人に知らせる（画面の知らせは DB の関数が作る・メールはここ・D-125.140）
            const nd = await o.appPool.query<{ is_new: boolean }>(
              "select is_new from app.session_first_on_device($1, null, $2, $3)",
              [session.id, deviceOf(ua), (session as { ipAddress?: string | null }).ipAddress ?? null],
            );
            if (nd.rows[0]?.is_new && o.mailer) {
              const u = await pool.query<{ email: string }>('select email from kaname_auth."user" where id = $1', [
                session.userId,
              ]);
              const to = u.rows[0]?.email;
              const url = `${o.webBaseURL ?? o.baseURL}/settings/security`;
              if (to)
                await o
                  .mailer({
                    to,
                    subject: "Kaname に新しい端末からログインしました",
                    text: `新しい端末（${deviceOf(ua) ?? "不明"}）から Kaname にログインしました。心当たりが無ければ、すぐにパスワードを変えて、端末の一覧からこの端末を外してください。`,
                    url,
                    kind: "new_device",
                  })
                  .catch(() => undefined); // 知らせのメールが送れなくてもログインは止めない（画面の知らせは残る）
            }
          },
        },
      },
    },
  });
  // セッションが解けた要求に印を立てる（K-237）。口の答えの Server-Timing は印の立った要求にだけ付く（ログイン・登録・再設定の答えに文の数を出さない）
  const api = auth.api as unknown as { getSession: (...a: unknown[]) => Promise<unknown> };
  const getSession = api.getSession.bind(auth.api);
  api.getSession = async (...a: unknown[]) => {
    const s = await getSession(...a);
    if (s) markDbSession();
    return s;
  };
  return { auth: auth as unknown as Auth, pool };
}

/** 保留の申し込みに確認のリンクを送る（D-088）。文面はここだけに持つ。
 *  送れたかどうかを返す。呼ぶ側はそれを画面と保留の行に反映する（「送りました」と嘘をつかない・G-15） */
export async function sendPendingVerification(
  o: { mailer?: Mailer; baseURL: string; webBaseURL?: string },
  p: { email: string; token: string },
): Promise<{ sent: boolean; error: string | null; url: string }> {
  const url = `${o.webBaseURL ?? o.baseURL}/verify-email?token=${encodeURIComponent(p.token)}`;
  // ログにメールアドレスを出さない（宛先は印にする・K-51・TP-REG-14）。リンクは手元の開発の受信箱（/dev/mail）の代わりにだけ出し、
  // 試験（NODE_ENV=test）と本番には出さない
  const env = optionalEnv("NODE_ENV");
  if (env !== "production" && env !== "test") console.warn(`[auth] リンク（verify → ${mailTag(p.email)}）: ${url}`);
  if (!o.mailer) return { sent: false, error: "メールの送出先が設定されていない", url };
  try {
    await o.mailer({
      to: p.email,
      subject: "Kaname｜メールアドレスの確認（登録を確定する）",
      text: `Kaname の登録を確定するには、次のリンクを押してください。押した時点で登録が終わります。\n${url}\nこのリンクは 30 分で失効します。心当たりが無ければ、このメールは無視してください。`,
      url,
      kind: "verify",
    });
    return { sent: true, error: null, url };
  } catch (e) {
    return { sent: false, error: (e as Error).message || "送れませんでした", url };
  }
}

/** 本人のパスキーの一覧（安全の設定を読む口・K-308）。認証の表は認証の接続（kaname_auth）で読む（D-128.119）。
 *  返すのは画面に出す欄だけ（公開鍵・credential_id・署名の回数は読まない）。作った順 */
export interface PasskeySummary {
  id: string;
  name: string | null;
  createdAt: Date | null;
  backedUp: boolean;
}
export async function listPasskeysOf(authPool: pg.Pool, userId: string): Promise<PasskeySummary[]> {
  const r = await authPool.query<{
    id: string;
    name: string | null;
    created_at: Date | null;
    backed_up: boolean | null;
  }>(
    `select id, name, "createdAt" as created_at, "backedUp" as backed_up from kaname_auth.passkey
      where "userId" = $1 order by "createdAt" asc nulls last, id asc`,
    [userId],
  );
  return r.rows.map((x) => ({ id: x.id, name: x.name, createdAt: x.created_at, backedUp: x.backed_up === true }));
}
