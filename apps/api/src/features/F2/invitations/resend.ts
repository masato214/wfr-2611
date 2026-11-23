// K-334 送り直しを頼む（契約の口 requestInvitationResend・POST /api/v1/auth/invitations/:token/resend-request・誰でも呼べる）。
//   期限（7 日）が過ぎた招待を開いた人が「送り直しを頼む」を押すと、招いた人（もう居なければワークスペースの管理者全員）に知らせる
//   （D-128.63・answer=7fe1f09fdab4 ⑤）。同じ招待で 1 日 1 回。送り直すのは招いた人が新しい招待を出すことで、この口は招待を変えない。
//   上限（10 回／分／IP）と体の形（空・strict）は契約の入口（op.ts）が先に確かめる。順：
//   ⓪ 下見の関数 app.invitation_preview2 で状態を見る：無い 404・E-INV-001／revoked 410・E-INV-002／used 410・E-INV-004／ok 409・E-INV-008
//   ① 1 つの取引で宛てを引き（app.invitation_resend_targets）、24 時間の内に頼まれていれば 201 already。
//      そうでなければ知らせの行を入れる（app.invitation_resend_record・送り中の行があれば空＝already）。例外なら 503・E-PAGE-003（何も残らない）
//      前の回に送れなかった宛てがあれば、record はその宛ての行だけを返す（押し直しで届いた人に 2 通目を出さない）
//   ③ 宛てごとに関門 C6 の送出の口（mailer）でメールを 1 通。送れたか／送れなかったかを知らせの行に書く（app.invitation_resend_mark）
//   ④ 全員に届いたときだけ頼んだ時刻を書く（app.invitation_resend_stamp）→ 201 sent。1 つでも送れなければ時刻は触らず 201 failed
//      （502 にしない・知らせの行は画面の中の知らせとして残す・1 日 1 回に数えない）。
//      時刻を書けなかったら、送ったメールは取り消せないので 201 sent のまま、ログに招待の id と「時刻を書けなかった」
//   ログにトークン・メールは出さない（宛先は mailTag の印・例外は種類だけ）
import { createHash } from "node:crypto";
import { mailTag } from "@kaname/auth/signup";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { InvitationDeps } from "./deps.js";
import { TOKEN_MAX, type InvitationState } from "./preview.js";
import { resendRequestMail } from "./resend-mail.js";

type Result = "sent" | "already" | "failed";

interface TargetRow {
  member_id: string;
  last_requested_at: Date | null;
}
interface RecordRow {
  notification_id: string;
  member_id: string;
  email: string;
  invitation_id: string;
  invitee_email: string | null;
  invited_at: Date;
  expires_at: Date;
  workspace_name: string | null;
}

/** 同じ招待で頼める間あけ（1 日 1 回・DB の関数 app.invitation_resend_record と同じ 24 時間） */
const DAY_MS = 24 * 60 * 60 * 1000;

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
const done = (result: Result): HookReply => ({ status: 201, body: { data: { result } } });

/** 下見の状態 → 断る答え（期限切れだけが頼める） */
const refuse: Record<Exclude<InvitationState, "expired">, () => HookReply> = {
  ok: () => reply(409, "E-INV-008", "conflict"),
  revoked: () => reply(410, "E-INV-002", "gone"),
  used: () => reply(410, "E-INV-004", "gone"),
};

export function invitationResendFeature(d: Pick<InvitationDeps, "appPool" | "mailer">) {
  /** ⓪ 状態（行が無ければ null） */
  const stateOf = async (a: HookArgs, hash: string): Promise<InvitationState | null> =>
    withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ state: InvitationState }>("select state from app.invitation_preview2($1, null)", [
        hash,
      ]);
      return r.rows[0]?.state ?? null;
    });

  /** ① 宛てを引き、知らせの行を入れる（1 つの取引）。already か、入れた行（空なら宛てが居ない） */
  const record = async (a: HookArgs, hash: string): Promise<"already" | RecordRow[]> =>
    withTenant(d.appPool, a.ctx, async (cl) => {
      const t = await cl.query<TargetRow>(
        "select member_id, last_requested_at from app.invitation_resend_targets($1)",
        [hash],
      );
      if (t.rows.length === 0) return [];
      const last = t.rows[0]!.last_requested_at;
      if (last && Date.now() - new Date(last).getTime() < DAY_MS) return "already";
      const r = await cl.query<RecordRow>("select * from app.invitation_resend_record($1)", [hash]);
      return r.rows.length === 0 ? "already" : r.rows;
    });

  /** ③ 宛てごとに送る。送れなかった知らせの行の id を返す（失敗は宛先の印つきでログに残し、投げない） */
  const sendAll = async (rows: RecordRow[]): Promise<string[]> => {
    const failed: string[] = [];
    for (const r of rows) {
      try {
        if (!d.mailer) throw new Error("メールの送出先が無い");
        await d.mailer({ to: r.email, ...resendRequestMail(r) });
      } catch (e) {
        console.error(`[invitation] 送り直しの頼みを送れなかった → ${mailTag(r.email)}: ${kindOf(e)}`);
        failed.push(r.notification_id);
      }
    }
    return failed;
  };

  /** ③ の後：届いた・届かないを知らせの行に書き、全員に届いたら ④ 頼んだ時刻を書く。どちらも落ちても答えは変えない（メールは取り消せない） */
  //   mark が落ちたら 1 回だけやり直す（つながりが切れただけなら、次の 1 回で書ける。mark はまだ印の無い行だけを書くので、2 回流しても同じ）。
  //   それでも落ちたら、その回の行は送り中のまま 2 分残り、その間の押し直しは already になる（2 分たてば押し直せる・DB が落ちたままのときだけの道）
  const finish = async (hash: string, invitationId: string, rows: RecordRow[], failed: string[]): Promise<void> => {
    const sent = rows.map((r) => r.notification_id).filter((id) => !failed.includes(id));
    const mark = () =>
      d.appPool.query("select app.invitation_resend_mark($1, $2::uuid[], $3::uuid[])", [hash, sent, failed]);
    try {
      await mark().catch((e: unknown) => {
        console.error(
          `[invitation] 招待 ${invitationId} の知らせに届いた印を書けなかった（${kindOf(e)}）。もう 1 回書く`,
        );
        return mark();
      });
    } catch (e) {
      console.error(`[invitation] 招待 ${invitationId} の知らせに届いた印を書けなかった（${kindOf(e)}）`);
    }
    if (failed.length > 0) return;
    try {
      const r = await d.appPool.query<{ ok: boolean }>("select app.invitation_resend_stamp($1) as ok", [hash]);
      if (!r.rows[0]?.ok)
        console.error(`[invitation] 招待 ${invitationId} の頼んだ時刻を書けなかった（届いた知らせが見つからない）`);
    } catch (e) {
      console.error(`[invitation] 招待 ${invitationId} の頼んだ時刻を書けなかった（${kindOf(e)}）`);
    }
  };

  const request = async (a: HookArgs): Promise<HookReply> => {
    const token = a.c.req.param("token") ?? "";
    if (token.length < 1 || token.length > TOKEN_MAX) return reply(404, "E-INV-001", "not_found");
    const hash = sha256(token);
    let rows: "already" | RecordRow[];
    try {
      const state = await stateOf(a, hash);
      if (state === null) return reply(404, "E-INV-001", "not_found");
      if (state !== "expired") return refuse[state]();
      rows = await record(a, hash);
    } catch (e) {
      console.error(`[invitation] 送り直しの頼みを受けられなかった（${kindOf(e)}）`);
      return reply(503, "E-PAGE-003", "unavailable");
    }
    if (rows === "already") return done("already");
    if (rows.length === 0) {
      console.error("[invitation] 送り直しの頼みの宛て（招いた人・管理者）が居ない");
      return done("failed");
    }
    const failed = await sendAll(rows);
    await finish(hash, rows[0]!.invitation_id, rows, failed);
    return done(failed.length > 0 ? "failed" : "sent");
  };

  return { request };
}
