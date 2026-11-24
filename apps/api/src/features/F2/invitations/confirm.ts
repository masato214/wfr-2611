// K-422 確認のリンクを押す（契約の口 confirmInvitationJoin・POST /api/v1/auth/invitations/confirm・ログインしていない人・体 { token }）。
//   招待のリンクで新しく入る人は、参加を押した時点では利用者も所属も無い（保留の行 kaname_auth.invitation_link_joins と確認のメールだけ）。
//   ここで初めて認証の利用者（メールは確かめ済み）・所属・招待を使った印を作り、ログインの印を返す（D-148.51）。
//   順：① トークン → 保留の行に印を付ける（1 文・同時に何回押しても 1 回だけ・期限切れには付けない）
//         無い・閉じた 404・E-INV-001／もう印がある 410・E-INV-015／期限切れ 410・E-INV-014
//       ② 招待の様子（使われた 410・E-INV-004・取り消し 410・E-INV-002・期限切れ 410・E-INV-003）・止められたワークスペース 403・E-AUTH-012
//         （どれも印は戻さず保留の行を閉じる）
//       ③ 包んだパスワードを開く → 利用者を作る（S4・もうアカウントがあれば 409・E-INV-006 で保留の行を閉じる）
//       ④ 受諾（S5・app.accept_invitation の 1 取引）→ 使われた・取り消し・期限切れの断りは利用者を消して保留の行を閉じ 410。
//         それ以外の失敗は利用者を消して印を戻し 503（もう一度押せる）
//       ⑤ セッションを作る（S6）：失敗しても参加は取り消さない（503・押し直すと 410・E-INV-015・パスワードでログインできる）→ 201
//   冪等の器は使わない（2 回目にログインの印を渡すと、リンクを持つ人なら誰でも入れてしまう）。ログインの印・メール・パスワードはログに出さない
import {
  acceptInvitationAgreeingByHash,
  acceptRefusal,
  claimLinkJoin,
  closeLinkJoin,
  createInvitedUser,
  invitationForAcceptByHash,
  openLinkJoinPassword,
  openSessionFor,
  releaseLinkJoin,
  sealOffLinkJoin,
  type ClaimedLinkJoin,
  type InvitationForAccept,
} from "@kaname/auth/invitations";
import { deleteAuthUser } from "@kaname/auth/pending";
import { mailTag } from "@kaname/auth/signup";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { InvitationDeps } from "./deps.js";
import { NEXT_AFTER_JOIN } from "./accept.js";

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const reply = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const unavailable = (): HookReply => reply(503, "E-PAGE-003");
/** 招待の状態ごとの答え（D-128.63） */
const GONE: Record<Exclude<InvitationForAccept["state"], "ok">, string> = {
  revoked: "E-INV-002",
  expired: "E-INV-003",
  used: "E-INV-004",
};
/** 確認のリンクの断り（保留の行の様子） */
const CLAIM_REFUSAL = {
  missing: reply(404, "E-INV-001"),
  used: reply(410, "E-INV-015"),
  expired: reply(410, "E-INV-014"),
} as const;
const NO_TOKEN: HookReply = {
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "token", message: "確認のトークンが要る" }],
  },
};

export function invitationConfirmFeature(d: InvitationDeps) {
  const pool = d.authPool;

  /** 参加が決まらないと分かった保留の行を閉じて、その答えを返す（閉じるのが落ちても答えは変えない） */
  const closeAnd = async (row: ClaimedLinkJoin, r: HookReply): Promise<HookReply> => {
    try {
      await closeLinkJoin(pool, row.id);
    } catch (e) {
      console.error(`[invite-link] 保留の行を閉じられなかった（${kindOf(e)}）`);
    }
    return r;
  };
  /** 印を戻して 503（もう一度押せる）。戻すのが落ちたらログに 1 行 */
  const releaseAndFail = async (row: ClaimedLinkJoin): Promise<HookReply> => {
    try {
      await releaseLinkJoin(pool, row.id);
    } catch (e) {
      console.error(`[invite-link] 確認の印を戻せなかった（${kindOf(e)}）`);
    }
    return unavailable();
  };
  /** S4 で作った利用者を id で消す（落ちたら、メールの字は出さずログに 1 行） */
  const dropUser = async (row: ClaimedLinkJoin, userId: string): Promise<void> => {
    try {
      await deleteAuthUser(pool, userId);
    } catch (e) {
      console.error(`[invite-link] 作った利用者を消せなかった → ${mailTag(row.email)}: ${kindOf(e)}`);
    }
  };

  const confirm = async (a: HookArgs): Promise<HookReply> => {
    const raw = a.input["token"];
    const token = typeof raw === "string" ? raw.trim() : "";
    if (!token) return NO_TOKEN;
    let claim: Awaited<ReturnType<typeof claimLinkJoin>>;
    try {
      claim = await claimLinkJoin(pool, token);
    } catch (e) {
      console.error(`[invite-link] 確認のリンクを読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (claim.kind !== "ok") return CLAIM_REFUSAL[claim.kind];
    const row = claim.row;

    let inv: InvitationForAccept | null;
    try {
      inv = await invitationForAcceptByHash(d.appPool, row.invitationTokenHash);
    } catch (e) {
      console.error(`[invite-link] 招待を読めなかった（${kindOf(e)}）`);
      return releaseAndFail(row);
    }
    if (!inv) return closeAnd(row, reply(404, "E-INV-001"));
    if (inv.state !== "ok") return closeAnd(row, reply(410, GONE[inv.state]));
    if (inv.workspaceSuspended) return closeAnd(row, reply(403, "E-AUTH-012"));

    let password: string;
    try {
      password = openLinkJoinPassword(d.config.secretsMasterKey, row.sealed);
    } catch (e) {
      console.error(`[invite-link] 包んだパスワードを開けなかった（${kindOf(e)}）`);
      return releaseAndFail(row);
    }

    // 手順 S4：認証の利用者を作る［残る］。メールは確認のリンクを押したことで確かめ済み
    let made: Awaited<ReturnType<typeof createInvitedUser>>;
    try {
      made = await createInvitedUser(d.auth, pool, { email: row.email, name: row.name, password });
    } catch (e) {
      const half = (e as { madeUserId?: unknown } | null)?.madeUserId;
      if (typeof half === "string") await dropUser(row, half);
      console.error(`[invite-link] 利用者を作れなかった → ${mailTag(row.email)}: ${kindOf(e)}`);
      return releaseAndFail(row);
    }
    // 確認までの間に同じメールでアカウントができた：何も作らず何も消さない。保留の行は閉じる
    if (made.kind === "exists") return closeAnd(row, reply(409, "E-INV-006"));

    // 手順 S5：受諾（所属・グループ・規約の同意・出来事・招待を使った印を 1 つの取引）。失敗したら S4 の利用者を消す
    try {
      await acceptInvitationAgreeingByHash(d.appPool, row.invitationTokenHash, made.userId, row.name);
    } catch (e) {
      await dropUser(row, made.userId);
      const why = acceptRefusal(e);
      if (why === "used" || why === "revoked" || why === "expired") return closeAnd(row, reply(410, GONE[why]));
      if (why === "not_found") return closeAnd(row, reply(404, "E-INV-001"));
      console.error(`[invite-link] 受諾できなかった → ${mailTag(row.email)}: ${kindOf(e)}`);
      return releaseAndFail(row);
    }

    // 参加が決まった：包んだパスワードを保留の行から消す（落ちても答えは変えない・ログに種類だけ）
    try {
      await sealOffLinkJoin(pool, row.id);
    } catch (e) {
      console.error(`[invite-link] 包んだパスワードを空にできなかった（${kindOf(e)}）`);
    }

    // 手順 S6：セッションを作る。失敗しても参加は取り消さない（パスワードでログインできる）
    let sessionToken: string;
    try {
      sessionToken = await openSessionFor(d.auth, made.userId);
    } catch (e) {
      console.error(`[invite-link] 参加は決まったがセッションを作れなかった → ${mailTag(row.email)}: ${kindOf(e)}`);
      return unavailable();
    }
    return {
      status: 201,
      body: { data: { token: sessionToken, workspace_id: row.tenantId, next: NEXT_AFTER_JOIN } },
    };
  };

  return { confirm };
}
