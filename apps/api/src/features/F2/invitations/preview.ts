// K-331 招待の下見（契約の口 getInvitation・GET /api/v1/auth/invitations/:token・誰でも呼べる）。
//   招待のリンクを開いた人に、招いたワークスペース・招いた人・グループ・役割・ひとこと（D-128.62）と、招待の状態（ok・expired・revoked・used）、
//   宛てのメールにアカウントがあるか・ログイン中ならメールが合うか・もう入っているか を返す。画面はこの答えだけで形を決める（answer=becc3d3aa526・7fe1f09fdab4）。
//   中身は DB の関数 app.invitation_preview2（0112・security definer・読むだけ）。上限（10 回／分／IP）は契約の入口（op.ts）が先に確かめる。
//   セッションは入口の resolver が解いた文脈で見る：会社の人として解けたときだけ部品のセッションから本人を引く。
//   無い・壊れた・切れたはログインしていない扱い（401 にしない）。
//   状態が使えない招待も 200 で state を返す（410 にしない・D-128.63）。行が無いときだけ 404・E-INV-001。
//   読めないときは 503・E-PAGE-003（ログには例外の種類だけ。トークン・メールは出さない）。何も書かない
import { createHash } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { InvitationDeps } from "./deps.js";

/** トークンの長さの上限（これを超える・空は関数を呼ばずに 404） */
export const TOKEN_MAX = 512;
/** 招待の状態（DB の関数が決める） */
export type InvitationState = "ok" | "expired" | "revoked" | "used";

interface PreviewRow {
  state: InvitationState;
  workspace_name: string;
  inviter_name: string | null;
  group_name: string | null;
  role: string;
  message: string | null;
  email: string | null;
  expires_at: Date;
  account_exists: boolean;
  signed_email: string | null;
  email_matches: boolean | null;
  already_member: boolean | null;
}

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const reply = (status: number, code: string, error: string): HookReply => {
  const e = kanameError(code).toJSON() as { message?: string; action?: string };
  return { status, body: { error, code, message: e.message ?? "", action: e.action ?? "" } };
};
const notFound = (): HookReply => reply(404, "E-INV-001", "not_found");
const unavailable = (): HookReply => reply(503, "E-PAGE-003", "unavailable");

export function invitationPreviewFeature(d: Pick<InvitationDeps, "auth" | "appPool">) {
  /** ログイン中の本人（認証のアカウントの id）。入口が会社の人として解けたときだけ。無ければ null */
  const signedInUser = async (a: HookArgs): Promise<string | null> => {
    if (a.ctx.role !== "member") return null;
    const s = await d.auth.api.getSession({ headers: a.c.req.raw.headers });
    return s?.user.id ?? null;
  };

  const read = async (a: HookArgs): Promise<HookReply> => {
    const token = a.c.req.param("token") ?? "";
    if (token.length < 1 || token.length > TOKEN_MAX) return notFound();
    let row: PreviewRow | undefined;
    try {
      const authUserId = await signedInUser(a);
      row = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<PreviewRow>("select * from app.invitation_preview2($1, $2)", [
          sha256(token),
          authUserId,
        ]);
        return r.rows[0];
      });
    } catch (e) {
      console.error(`[invitation] 招待の下見を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!row) return notFound();
    const signedIn =
      row.email_matches === null
        ? null
        : {
            email: row.signed_email ?? "",
            email_matches: row.email_matches,
            already_member: row.already_member === true,
          };
    return {
      status: 200,
      body: {
        data: {
          state: row.state,
          workspace_name: row.workspace_name,
          inviter_name: row.inviter_name,
          group_name: row.group_name,
          role: row.role,
          message: row.message,
          email: row.email,
          expires_at: new Date(row.expires_at).toISOString(),
          account_exists: row.account_exists,
          signed_in: signedIn,
        },
      },
    };
  };

  return { read };
}
