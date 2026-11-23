// 自分で直す口（K-485・契約の口 takeoverActionRun・POST /api/v1/action_runs/:id/takeover・体は空・D-129.11・D-151.17・関門 C2）。
//   書くのは DB の関数 app.run_takeover の 1 取引だけ（実行の taken_over_at・動いていれば仕事と実行を止める・段と旗・やり取りの 1 行・証跡を 1 つの取引で）。
//   外には出ない。失敗（関数が使えない・証跡が書けない・DB が落ちた）は取引ごと戻り、503・E-PAGE-003（止める側に倒す・ログに本文を出さない）。
//   201 の答えは実行の 1 件（ActionRunView の 16 欄）。DB の関数は reason_kind を持たないので、口で withReasonKind を掛けて足す（読む口と同じ 1 つ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { withReasonKind } from "./reason-kind.js";

type Takeover =
  | { ok: true; run: { status: string; stopped_reason?: string | null } }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND" | "ALREADY" | "DECIDED" | "STALE" };

const fromCatalog = (code: string, status: number): HookReply => ({ status, body: kanameError(code).toJSON() });
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const down = (e: unknown): HookReply => {
  console.error(`[stopped] 自分で直す：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  return fromCatalog("E-PAGE-003", 503);
};

export function createTakeover(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let r: Takeover | undefined;
    try {
      r = await withTenant(
        pool,
        a.ctx,
        async (cl) => (await cl.query<{ v: Takeover }>("select app.run_takeover($1) as v", [a.id])).rows[0]?.v,
      );
    } catch (e) {
      return down(e);
    }
    if (!r) return down(new Error("empty"));
    if (r.ok) return { status: 201, body: { data: withReasonKind(r.run) } };
    switch (r.code) {
      case "NOT_FOUND":
        return notFound();
      case "ALREADY":
        return fromCatalog("E-STP-003", 409);
      case "DECIDED":
        return fromCatalog("E-STP-002", 409);
      case "STALE":
        return fromCatalog("E-STP-004", 409);
      default:
        return fromCatalog("E-STP-001", 403);
    }
  };
}
