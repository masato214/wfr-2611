// 招待のリンクを作る口（K-421）：createInvitationLink（POST /api/v1/invitations/link・D-148.22・D-148.51）。
//   宛てのメールを持たない、7 日・1 回だけの招待。入口（op.ts）が先に確かめる：ログイン（401）・権限（members の invite・会社全体。マネージャーは 403）・
//   上限・体の形（scope_id・role_key。知らない項目は 422）。順：
//   ⓪ 欠け・決まった値の外（グループを選んでいない・役割が 4 つの外）は 422・VALIDATION_ERROR（形の誤りだけ。グループが会社に無いのは DB の中身で決まるので ② で 404）
//   ① 管理者として入るリンク（role_key admin）だけ、本人確認が直前 15 分の内か（無ければ 403・STEP_UP_REQUIRED）
//   ② 32 バイトの乱数のトークンを作り、1 つの取引（app.create_invitation_link）で招待の行と証跡を書く（DB には sha256 だけ）。
//      グループが会社に無い・消した → 404・E-INV-011／権限が無い → 403／DB が落ちた → 503・E-PAGE-003（何も残らない）
//   ③ 201 { data: { url, expires_at } }・（Cache-Control: private, no-store は入口の app.ts が全部の答えに付ける。答えにトークンが入るので冪等の器には残さない＝hooks の noIdempotency）
//   ログ・証跡にトークンとリンクの住所を書かない（ログは場所と例外の種類だけ）
import { createHash, randomBytes } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";

/** 役割（契約の role_key は決まった 4 つ）。トークンの長さ（バイト・create.ts と同じ形） */
const ROLES = ["member", "manager", "viewer", "admin"] as const;
const TOKEN_BYTES = 32;

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
const pgInfo = (e: unknown): { code: string; hint: string } => {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  return { code: typeof x.code === "string" ? x.code : "", hint: typeof x.hint === "string" ? x.hint : "" };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

const badField = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
const STEP_UP_REQUIRED: HookReply = {
  status: 403,
  body: { error: "step_up_required", code: "STEP_UP_REQUIRED", message: "本人確認を取り直してから" },
};
const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};

/** DB の関数が断った例外 → 答え。分からない例外は 503（何も残らない） */
function refused(e: unknown): HookReply {
  const { code, hint } = pgInfo(e);
  if (code === "42501" && hint === "E-INV-011") {
    const err = kanameError("E-INV-011").toJSON();
    return {
      status: 404,
      body: {
        ...err,
        details: [{ field: "scope_id", code: "E-INV-011", message: kanameError("E-INV-011").entry.message }],
      },
    };
  }
  if (code === "42501") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  console.error(`[invite] リンクを作る取引が落ちた（${kindOf(e)}）`);
  return unavailable();
}

export function createCreateInvitationLink(d: Pick<HookDeps, "appPool" | "config">) {
  return async (a: HookArgs): Promise<HookReply> => {
    const scope = a.input["scope_id"];
    const role = a.input["role_key"];
    if (typeof scope !== "string" || scope === "") return badField("scope_id", "グループを選んでください");
    if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role))
      return badField("role_key", ROLES.join("／"));
    if (role === "admin") {
      // 判定が渡されなければ閉じた側に倒す
      const stale = a.requireStepUp ? a.requireStepUp() : STEP_UP_REQUIRED;
      if (stale) return stale;
    }
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    let expiresAt: Date;
    try {
      expiresAt = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ expires_at: Date }>(
          "select expires_at from app.create_invitation_link($1::uuid, $2, $3)",
          [scope, role, sha256(token)],
        );
        return new Date(r.rows[0]!.expires_at);
      });
    } catch (e) {
      return refused(e);
    }
    return {
      status: 201,
      body: { data: { url: `${d.config.webBaseUrl ?? ""}/invite/${token}`, expires_at: expiresAt.toISOString() } },
    };
  };
}
