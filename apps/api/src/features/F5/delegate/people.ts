// AI に任せる（K-62）の人が呼ぶ口：delegateTicket（任せる）・listTicketRuns（実行の一覧）・getActionRun（実行の 1 件）と、getTicket の can.delegate。
//   任せられるのはそのチケットを直せる人なら誰でも（D-128.138）。動くのは押した人の AI（その人の PC）。
//   書くのは関門 C2 の app.ticket_delegate（仕事・実行の記録・段・やり取りの 1 行を 1 つの処理で・0091）だけ。
//   守りの所で例外になったら通さず止める側に倒す（503・E-PAGE-003・何も積まない）。ログに本文を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { listQueryIssues } from "../../../contract/list_query.js";
import { SWEEP_TICKET, sweepBeforeRead } from "../approve-complete/sweep.js";

/** PC をつなぐ画面（E-CONN-001 の一手） */
export const SETUP_BRIDGE = "/setup/bridge";
const RUNS_LIMIT = 50;

const fromCatalog = (code: string, status: number, extra: Record<string, unknown> = {}): HookReply => ({
  status,
  body: { ...kanameError(code).toJSON(), ...extra },
});
/** 体から detail を外す（E-CONF-020 は {error, code, message, action, undo, support_code} だけ） */
const noDetail = (r: HookReply): HookReply => ({
  ...r,
  body: Object.fromEntries(Object.entries(r.body as Record<string, unknown>).filter(([k]) => k !== "detail")),
});
const down = (where: string, e: unknown): HookReply => {
  console.error(`[delegate] ${where}：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  return fromCatalog("E-PAGE-003", 503);
};
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });

export function peopleHooks(pool: pg.Pool, base: Record<string, Hook>): Record<string, Hook> {
  const inTenant = <T>(a: HookArgs, sql: string, args: unknown[]) =>
    withTenant(pool, a.ctx, async (cl) => (await cl.query<{ v: T }>(sql, args)).rows[0]?.v);
  const getTicket = base["getTicket"];
  return {
    delegateTicket: {
      before: async (a: HookArgs) => {
        let r: Record<string, unknown> | undefined;
        try {
          r = await inTenant<Record<string, unknown>>(a, "select app.ticket_delegate($1, $2) as v", [
            a.id,
            typeof a.input["no_spec_reason"] === "string" ? a.input["no_spec_reason"] : null,
          ]);
        } catch (e) {
          return down("任せる", e);
        }
        if (!r) return down("任せる", new Error("empty"));
        if (r["ok"] === true)
          return {
            status: 201,
            body: { data: { run_id: r["run_id"], job_id: r["job_id"], status: "queued", pc: r["pc"] } },
          };
        switch (r["code"]) {
          case "RUNNING":
            return fromCatalog("E-CONF-013", 409, { run_id: r["run_id"] });
          case "NOT_DELEGABLE":
            return fromCatalog("E-CONF-014", 409);
          case "NO_PC":
            return fromCatalog("E-CONN-001", 409, { href: SETUP_BRIDGE });
          case "NO_SPEC":
            return noDetail(fromCatalog("E-CONF-020", 409));
          case "REASON_INVALID":
            return {
              status: 422,
              body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "no_spec_reason" }] },
            };
          case "NOT_FOUND":
            return notFound();
          default:
            return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
        }
      },
    },
    listTicketRuns: {
      before: async (a: HookArgs) => {
        const v = await inTenant<{ data: unknown[]; total: number } | null>(a, "select app.ticket_runs_view($1) as v", [
          a.id,
        ]);
        if (!v) return notFound();
        // 形の誤り（422）は、権限（401・403）と見えない物（404）の後（契約の limit・cursor・sort の形だけを受ける・K-429）
        const issues = listQueryIssues(a.c.req.query(), { table: "action_runs", repo: a.repo });
        if (issues.length)
          return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: issues } };
        return { status: 200, body: { data: v.data, meta: { limit: RUNS_LIMIT, total: Number(v.total) } } };
      },
    },
    getActionRun: {
      before: async (a: HookArgs) => {
        const v = await inTenant<Record<string, unknown> | null>(a, "select app.action_run_view($1) as v", [a.id]);
        if (!v) return notFound();
        return { status: 200, body: { data: v } };
      },
    },
    // チケットの詳細（K-60）に「見ている人ができること」を足す（can.delegate・D-128.138）。
    //   読む前に、待っている承認の後の実行の仕事を片付ける（K-164。失敗したら飛ばして読めたものを返す）
    getTicket: {
      ...getTicket,
      before: async (a: HookArgs) => {
        try {
          await withTenant(pool, a.ctx, (cl) => sweepBeforeRead(cl, SWEEP_TICKET, [a.id], "チケットの詳細"));
        } catch (e) {
          // 片付けの取引そのもの（接続・commit）が失敗しても、読む口は止めない（次に開いたときにまた片付ける）
          console.error(
            `[approve-complete] チケットの詳細：読む前の片付けの取引に失敗したので飛ばした（${(e as Error)?.name ?? "Error"}）`,
          );
        }
        const r = getTicket?.before ? await getTicket.before(a) : undefined;
        if (!r || r.status !== 200) return r;
        const body = r.body as { data: Record<string, unknown> };
        const can = await inTenant<boolean>(a, "select app.ticket_can_delegate($1) as v", [a.id]);
        const prev = (body.data["can"] ?? {}) as Record<string, unknown>;
        return { ...r, body: { ...body, data: { ...body.data, can: { ...prev, delegate: can === true } } } };
      },
    },
  };
}
