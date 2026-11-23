// K-945 パスキーを付けるリンクの口（契約の口 startOpsSetup・POST /api/v1/auth/ops-setup・ログインしていない人・D-156.22・D-156.12・D-156.17）。
//   使えるリンクの印なら、パスキーを付けるだけのセッション（入り方 'ops_setup'）を返す。解決はこのセッションを role ops・mfaPending true で解き、
//   運営の口には届かない（403 MFA_REQUIRED）。パスキーを付けたら、パスキーで入り直す（K-1003 の画面）。
//   手順：印（と任意の名前・K-985）→ sha256 → app.ops_setup_consume（使った印を付ける・1 回だけ・名前があれば同じ取引で付ける）→ 部品でセッションを作る（hook を通る）→ 入り方 'ops_setup' を書く
//   断る番号：無い・使った・期限切れは同じ 409 E-PAGE-006（欄・details なし）。印が無い・形が違うはこの口が 422、余計な欄は契約の入口が 422（strict）。DB の失敗は 503 E-PAGE-003。
//   入り方を書けなければ、認証側のセッションを消してから 503（消すのも落ちたら「後片付け」と種類だけをログに出す。印と id は出さない）。
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { hashToken, openSessionFor } from "@kaname/auth/invitations";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export interface OpsSetupDeps {
  auth: Auth;
  /** 業務の接続（app.ops_setup_consume・app.mark_session_login_kind） */
  appPool: pg.Pool;
  /** 認証の接続（後片付けで認証側のセッションを消す） */
  authPool: pg.Pool;
}

/** 例外の種類だけ（文や値は出さない） */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const reply = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const unusable = (): HookReply => reply(409, "E-PAGE-006");
/** 印の形：32 バイトの乱数の base64url（43 字）。契約の値域（screen_api.d/K-945.py の VALUE_RANGES）と同じ字 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
/** 印が無い・文字でない・形が違う（契約の形の 422。入口の zod は token を任意にして、無いときの答えを口に任せている・K144-SHAPE-021） */
const badToken = (): HookReply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "token", message: "token が要る" }],
  },
});
/** 名前（K-985・任意・D-156.66）：入口が前後の空白を落とした後で 1〜40 字・空白だけでない。契約の値域（screen_api.d/K-945.py の VALUE_RANGES）と同じ数 */
const NAME_MAX = 40;
const badName = (): HookReply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "name", message: `空白だけでない 1〜${NAME_MAX} 字` }],
  },
});
/** 送られた名前。送らなければ null（名前は変えない）。形が違えば undefined */
const nameOf = (raw: unknown): string | null | undefined => {
  if (raw === undefined) return null;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  return v.length >= 1 && v.length <= NAME_MAX && /\S/.test(v) ? v : undefined;
};
const down = (where: string, e: unknown): HookReply => {
  console.error(`[ops-setup] ${where}が落ちた（${kindOf(e)}）`);
  return reply(503, "E-PAGE-003");
};

export function createStartOpsSetup(d: OpsSetupDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const token = (a.input as { token?: unknown }).token;
    if (typeof token !== "string" || !TOKEN_SHAPE.test(token)) return badToken();
    const name = nameOf((a.input as { name?: unknown }).name);
    if (name === undefined) return badName();
    let userId: string | null;
    try {
      // リンクが使えたときだけ、同じ取引（関数の中）で運営の会社の members.display_name を送られた名前にする（K-985・D-156.66）
      const r = await d.appPool.query<{ u: string | null }>("select app.ops_setup_consume($1, $2) as u", [
        hashToken(token),
        name,
      ]);
      userId = r.rows[0]?.u ?? null;
    } catch (e) {
      return down("リンクを見る所", e);
    }
    if (!userId) return unusable();

    let session: { id: string; token: string };
    try {
      const st = await openSessionFor(d.auth, userId);
      const r = await d.authPool.query<{ id: string }>("select id from kaname_auth.session where token = $1", [st]);
      if (!r.rows[0]) throw new Error("セッションが見つからない");
      session = { id: r.rows[0].id, token: st };
    } catch (e) {
      return down("セッションを作る所", e);
    }
    try {
      // まだ入り方の無い行だけを埋める（K-944 の関数）。書けなければ例外で上がる
      await d.appPool.query("select app.mark_session_login_kind($1, 'ops_setup')", [session.id]);
    } catch (e) {
      await d.authPool
        .query("delete from kaname_auth.session where id = $1", [session.id])
        .catch((x: unknown) =>
          console.error(`[ops-setup] 入り方を書けなかった後の後片付けができなかった（${kindOf(x)}）`),
        );
      return down("入り方を書く所", e);
    }
    a.c.header("Cache-Control", "no-store");
    return { status: 201, body: { data: { token: session.token } } };
  };
}
