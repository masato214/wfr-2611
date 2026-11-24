// ログイン後の稼働状況と上の帯（K-955）：getServiceStatusForMember（GET /api/v1/service-status）。読むだけ（DB に書かない・お知らせも鈴も出さない）。
//   上限・認証・社内の人だけ（先方の権限は 403）は契約の入口（op.ts）が先に確かめる。中身は DB の関数 app.member_service_status() の 1 か所
//   （届け先は K-954 の app.notice_for_tenant）。1 取引・文 1 つ。Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。
//   答えが空・形が違う・DB が失敗したときは「ふつう」を返さず 503・E-PAGE-003（G-15）。ログは SQLSTATE だけ（題・本文・id を出さない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { sqlState } from "./errors.js";

/** 読めない（503・E-PAGE-003・欄なし）。ログは SQLSTATE だけ */
const unavailable = (e: unknown): HookReply => {
  console.error(`[service-status] ログイン後の稼働状況の DB が失敗した（${sqlState(e)}）`);
  const j = kanameError("E-PAGE-003").toJSON();
  return {
    status: 503,
    body: {
      error: "unavailable",
      code: j.code,
      message: j.message,
      action: j.action,
      undo: j.undo,
      support_code: j.support_code,
    },
  };
};

const isStatus = (v: unknown): v is Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o["components"]) && Array.isArray(o["bands"]) && "maintenance_now" in o;
};

export function createServiceStatusForMember(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: unknown }>("select app.member_service_status() as v");
        return r.rows[0]?.v;
      });
      if (!isStatus(v)) return unavailable({ name: "答えの形が違う" });
      return { status: 200, body: { data: v } };
    } catch (e) {
      return unavailable(e);
    }
  };
}
