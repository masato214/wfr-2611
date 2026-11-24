// 決まりを読む口（listHandoverRules・GET /handover_rules・会社の人なら誰でも・K-401・D-125.71）。
//   その会社の handover_rules（消していない）を children・links・group・axis の順に、軸の名前つきで返す（1 取引・文 1 つ）。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HandoverDeps } from "./deps.js";

export function listHandoverRules(d: HandoverDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const rows = await withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: unknown }>("select app.handover_rules_list() as v");
      return r.rows[0]?.v;
    });
    return { status: 200, body: { data: Array.isArray(rows) ? rows : [] } };
  };
}
