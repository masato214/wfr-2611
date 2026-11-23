// K-985 運営の人を足したときの招待のメール（関門 C6・@kaname/notify の NotifyGateway だけ・D-156.22）。
//   取引を閉じてから 1 通。本文にパスキーを付けるリンク（24 時間・1 回だけ）を書く。
//   API の送り出し（HookMailer）は本文しか送らない（K-945 の命令の送り出し cliMailer のように url を後ろに付ける所が無い）ので、リンクはここで本文に入れる。
//   印は件名・ログに出さない。送れなくても運営の人は残す（送れたとは言わない・G-15）。ログは「招待のメールを送れなかった」だけ（宛先・印を出さない）
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { NotifyGateway, type Transport } from "@kaname/notify";
import { OPS_TENANT_ID } from "../../F1/sign-up/index.js";
import type { HookMailer } from "../../../hooks/registry.js";

export const OPS_INVITE_SUBJECT = "【Kaname】運営の場所に招待されました";
export const OPS_INVITE_KIND = "ops_member.invited";

/** 本文（リンク・24 時間・1 回だけ・パスキーを付けてから入る） */
export function opsInviteText(url: string): string {
  return [
    "Kaname の運営の場所に招待されました。",
    "",
    "下のリンクを開き、この端末にパスキーを付けてから入ってください。名前はそのときに付けられます。",
    "リンクは 24 時間、1 回だけ使えます。",
    "",
    url,
    "",
    "心当たりが無い場合は、このメールを捨ててください。",
  ].join("\n");
}

export interface OpsInviteMail {
  repo: Repository;
  mailer?: HookMailer;
  /** 足した運営の人（運営の会社の members.id） */
  memberId: string;
  email: string;
  url: string;
  /** 重ならない鍵（リンクの行ごと。印そのものは入れない） */
  dedupeKey: string;
  /** 足した運営の人（呼んだ人）の members.id */
  byMemberId: string;
}

const failed = (): false => {
  console.error("[ops-team] 招待のメールを送れなかった");
  return false;
};

/** 招待のメールを送る。送れたら true */
export async function sendOpsInviteMail(m: OpsInviteMail): Promise<boolean> {
  if (!m.mailer) return failed();
  const mailer = m.mailer;
  const transport: Transport = {
    send: async (_ch, address) => {
      if (!address) throw new Error("宛先が無い");
      await mailer({ to: address, subject: OPS_INVITE_SUBJECT, text: opsInviteText(m.url) });
    },
  };
  // 運営の会社の中の出来事として残す（関門の記録は運営の会社の audit_events）
  const ctx: TenantContext = { tenantId: OPS_TENANT_ID, userId: m.byMemberId, role: "ops" };
  const gw = new NotifyGateway(
    m.repo,
    transport,
    { resolve: async () => [{ memberId: m.memberId, kind: "human", address: m.email }] },
    { channelsOf: () => ["email"], maxAttempts: 2 },
  );
  try {
    const r = await gw.notify(
      { kind: OPS_INVITE_KIND, payload: {}, dedupeKey: m.dedupeKey },
      { memberIds: [m.memberId] },
      ctx,
    );
    return r.deliveries.some((x) => x.status === "sent") || failed();
  } catch {
    return failed();
  }
}
