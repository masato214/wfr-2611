// 運営の受信箱を読む（listOpsInquiries・GET /api/v1/ops/inquiries／getOpsInquiry・GET /api/v1/ops/inquiries/:id）（K-973・関門 C2・D-125.129・D-156.3・D-156.25）。
//   読むだけ（DB に書かない・運営の記録も顧客の読んだ印も書かない）。振る舞いの本体は DB の関数 app.ops_inquiries・app.ops_inquiry
//   （20261128011300_ops_inbox_read.sql）。上限・認証・inquiry を持つ運営の人だけ（ops:inquiry）・box／topic／limit の値・:id の形は
//   契約の入口（op.ts）が先に確かめる。ここでも値の形を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で関数を 1 回呼ぶ。
//   DB の断りは opsErrorReply（K-947）。関数を呼ぶ権限が無い（落ちている）は 503 にする（空の一覧を返さない・G-15）
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";
import { toOpsInquiryDetail, toOpsInquiryRow } from "./inbox-shape.js";

export const BOXES = ["unassigned", "mine", "waiting", "later", "done"] as const;
export const TOPICS = ["usage", "trouble", "billing", "other"] as const;
/** 一覧の件数（K-468 の QUERY_RANGES・契約の limit の上限） */
export const LIMIT_MAX = 100;
export const LIMIT_DEFAULT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Issue {
  field: string;
  message: string;
}
export interface InboxQuery {
  box: (typeof BOXES)[number];
  topic: (typeof TOPICS)[number] | null;
  limit: number;
}

const pick = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  field: string,
  issues: Issue[],
): T | null => {
  if (raw === undefined || raw === "") return null;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  issues.push({ field, message: allowed.join("・") });
  return null;
};

/** 問い合わせの値を整える。空の値は指定なし（既定 box unassigned・topic 全部・limit 50）。cursor は形だけ（入口が確かめる） */
export function parseInboxQuery(
  raw: Record<string, string>,
): { ok: true; value: InboxQuery } | { ok: false; details: Issue[] } {
  const issues: Issue[] = [];
  const box = pick(raw["box"], BOXES, "box", issues) ?? "unassigned";
  const topic = pick(raw["topic"], TOPICS, "topic", issues);
  const limitRaw = raw["limit"] ?? "";
  let limit = LIMIT_DEFAULT;
  if (limitRaw !== "") {
    limit = /^[0-9]{1,4}$/.test(limitRaw) ? Number(limitRaw) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX)
      issues.push({ field: "limit", message: `1〜${LIMIT_MAX} の整数` });
  }
  if (issues.length) return { ok: false, details: issues };
  return { ok: true, value: { box, topic, limit } };
}

const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 関数を呼ぶ権限が外れている（DB の落ち）は 503。運営の確かめ（app.ops_require）の断りは opsErrorReply の 403 のまま */
function readErrorReply(e: unknown, where: string): HookReply {
  const err = e as { code?: unknown; routine?: unknown } | null;
  if (err?.code === "42501" && err.routine === "aclcheck_error") {
    console.error(`[ops] ${where} の DB の関数を呼べない（42501）`);
    return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
  }
  return opsErrorReply(e, where);
}

export function createListOpsInquiries(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const parsed = parseInboxQuery(a.c.req.query());
    if (!parsed.ok) return invalid(parsed.details);
    const v = parsed.value;
    try {
      const rows = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: unknown[] }>("select app.ops_inquiries($1, $2, $3) as j", [
          v.box,
          v.topic,
          v.limit,
        ]);
        return r.rows[0]!.j ?? [];
      });
      return { status: 200, body: { data: rows.map(toOpsInquiryRow) } };
    } catch (e) {
      return readErrorReply(e, "inbox-read");
    }
  };
}

export function createGetOpsInquiry(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = a.id ?? "";
    if (!UUID.test(id)) return invalid([{ field: "id", message: "uuid の形" }]);
    try {
      const data = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: unknown }>("select app.ops_inquiry($1::uuid) as j", [id]);
        return r.rows[0]!.j;
      });
      return { status: 200, body: { data: toOpsInquiryDetail(data) } };
    } catch (e) {
      return readErrorReply(e, "inbox-read");
    }
  };
}
