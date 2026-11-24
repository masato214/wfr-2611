// K-985 運営の人を読む口（listOpsMembers）と、運営の人を足す口（addOpsMember）（関門 C2・C6・D-156.22・D-156.34・D-156.66・D-156.12・D-156.17）。
//   読む：opsTx で app.ops_members_list()（ops_people を持つ運営の人だけ・関数の中でも確かめる）→ 200
//   足す：形の確かめ（契約 screen_api.d/K-985.py と同じ数）→ メールをそろえる → 同じメールの認証の利用者を探す → 無ければ作る（パスワードなし・確認済み）
//         → 印 → opsTx で app.ops_member_add（生きている運営の人 409 E-OPS-015・顧客の会社の人 409 E-OPS-016）→ 取引の後に招待のメール → 201
//   この口が作った利用者は、関数が断った・落ちたときに認証の接続で消す（運営の人でない利用者を残さない）。消すのにも落ちたら 1 行だけログに出す
//   ログに宛先・印を出さない
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { newOpsSetupToken, OPS_ALL_CAPS, opsSetupUrl } from "@kaname/auth/ops-first";
import { normalizeEmail } from "@kaname/auth/signup";
import type { Repository } from "@kaname/db/repository";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookMailer } from "../../../hooks/registry.js";
import { opsTx } from "./db.js";
import { sendOpsInviteMail } from "./team-mail.js";

export interface OpsTeamDeps {
  auth: Auth;
  appPool: pg.Pool;
  authPool: pg.Pool;
  repo: Repository;
  mailer?: HookMailer;
  webBaseUrl: string;
}

/** メールの形（契約の VALUE_RANGES と同じ字・長さ） */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMAIL_MIN = 3;
const EMAIL_MAX = 254;
const CAPS_MAX = OPS_ALL_CAPS.length;
const KNOWN_CAPS: ReadonlySet<string> = new Set(OPS_ALL_CAPS);

interface Issue {
  field: string;
  message: string;
}
const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const refuse = (code: string): HookReply => ({ status: 409, body: kanameError(code).toJSON() });
const down = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });

/** DB の断り → 答え。この 2 つの関数（ops_members_list・ops_member_add）は ops_target を呼ばないので P0002（404）は出ない。
 *  ops_require の断り 42501 → 403 FORBIDDEN（欄・details なし）／ほか → 503 E-PAGE-003。ログは場所と SQLSTATE だけ */
function dbReply(e: unknown): HookReply {
  const state = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  if (state === "42501") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  console.error(`[ops] ops-team の DB が失敗した（${state}）`);
  return down();
}

/** 体の形を確かめる（入口の zod は欄を任意にしているので、無い・値域の外はここで 422） */
export function checkAddInput(input: Record<string, unknown>): { email: string; caps: string[] } | Issue[] {
  const issues: Issue[] = [];
  const rawEmail = input["email"];
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (typeof rawEmail !== "string") issues.push({ field: "email", message: "email が要る" });
  else if (email.length < EMAIL_MIN || email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email))
    issues.push({ field: "email", message: `メールの形で ${EMAIL_MIN}〜${EMAIL_MAX} 字` });
  const caps = input["caps"];
  if (!Array.isArray(caps)) issues.push({ field: "caps", message: "caps が要る（並び）" });
  else if (caps.length < 1 || caps.length > CAPS_MAX) issues.push({ field: "caps", message: `1〜${CAPS_MAX} 個` });
  else if (caps.some((c) => typeof c !== "string" || !KNOWN_CAPS.has(c)))
    issues.push({ field: "caps", message: "知らないできること" });
  else if (new Set(caps).size !== caps.length) issues.push({ field: "caps", message: "重なり" });
  if (issues.length) return issues;
  // できることは決まった並びにそろえて残す
  const picked = new Set(caps as string[]);
  return { email: normalizeEmail(email), caps: OPS_ALL_CAPS.filter((c) => picked.has(c)) };
}

const noStore = (a: HookArgs): void => {
  a.c.header("Cache-Control", "private, no-store");
};

export function createListOpsMembers(d: Pick<OpsTeamDeps, "appPool">): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const r = await opsTx(d.appPool, a.ctx, (c) =>
        c.query<{ r: { data: unknown[] } }>("select app.ops_members_list() as r"),
      );
      noStore(a);
      return { status: 200, body: { data: r.rows[0]?.r.data ?? [] } };
    } catch (e) {
      return dbReply(e);
    }
  };
}

/** 同じメールの認証の利用者。無ければ作る（made＝この口が作った） */
async function userFor(d: OpsTeamDeps, email: string): Promise<{ id: string; made: boolean }> {
  const find = async () =>
    (await d.authPool.query<{ id: string }>('select id from kaname_auth."user" where email = $1 limit 1', [email]))
      .rows[0]?.id ?? null;
  const found = await find();
  if (found) return { id: found, made: false };
  const ctx = await d.auth.$context;
  try {
    const user = await ctx.internalAdapter.createUser(
      { email, name: email.split("@")[0] ?? email, emailVerified: true },
      { method: "email-password" },
    );
    return { id: user.id, made: true };
  } catch (e) {
    // 同時に 2 回来た負けの方：先に作られた利用者を使う（作っていないので消さない）
    const again = await find();
    if (again) return { id: again, made: false };
    throw e;
  }
}

/** この口が作った利用者を消す（認証の接続で・まだパスワードもパスキーもセッションも無い）。落ちたらログを 1 行（元の答えはそのまま返す） */
async function dropMadeUser(d: OpsTeamDeps, userId: string): Promise<void> {
  try {
    await d.authPool.query('delete from kaname_auth."user" where id = $1', [userId]);
  } catch {
    console.error("[ops-team] 作りかけの利用者を消せなかった");
  }
}

interface AddResult {
  data?: { member_id: string } & Record<string, unknown>;
  error?: "already" | "customer";
}

export function createAddOpsMember(d: OpsTeamDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const checked = checkAddInput(a.input);
    if (Array.isArray(checked)) return invalid(checked);
    const { email, caps } = checked;
    const name = email.split("@")[0] ?? email;

    let user: { id: string; made: boolean };
    try {
      user = await userFor(d, email);
    } catch {
      console.error("[ops-team] 認証の利用者を作れなかった");
      return down();
    }
    const { token, hash } = newOpsSetupToken();
    let res: AddResult;
    try {
      const r = await opsTx(d.appPool, a.ctx, (c) =>
        c.query<{ r: AddResult }>("select app.ops_member_add($1, $2, $3, $4) as r", [user.id, name, caps, hash]),
      );
      res = r.rows[0]?.r ?? {};
    } catch (e) {
      if (user.made) await dropMadeUser(d, user.id);
      return dbReply(e);
    }
    if (res.error || !res.data) {
      if (user.made) await dropMadeUser(d, user.id);
      if (res.error === "already") return refuse("E-OPS-015");
      if (res.error === "customer") return refuse("E-OPS-016");
      return down();
    }
    // 取引を閉じてから招待のメール（関門 C6）。送れなくても運営の人とリンクは残る
    const mailSent = await sendOpsInviteMail({
      repo: d.repo,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      memberId: res.data.member_id,
      email,
      url: opsSetupUrl(d.webBaseUrl, token),
      dedupeKey: `ops_member.invited:${hash}`,
      byMemberId: a.ctx.userId ?? res.data.member_id,
    });
    noStore(a);
    return { status: 201, body: { data: res.data, meta: { mail_sent: mailSent } } };
  };
}
