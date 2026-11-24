// 運営が受信箱の問い合わせの担当・状態・後でを変える（updateOpsInquiry・PATCH /api/v1/ops/inquiries/:id）（K-974・関門 C2・D-156.25・D-125.129）。
//   担当を取る・外すは自分だけ（人の id を受けず take・release の真偽）。ほかの人が担当の問い合わせは見るだけ（取り合いは 409 E-OPS-005）。
//   振る舞いの本体は DB の関数 app.ops_inquiry_update（20261128011400_ops_inbox_update.sql）。形と組み合わせ（空の体・取ると外すを両方・
//   state と later_until を一緒）は契約の入口が先に 422 で断り、ここでも確かめる（入口に頼らない 2 層目）。
//   opsTx の 1 取引で関数を 1 回呼ぶ。変えたことの記録（app.record_ops_audit）も同じ取引なので、書けなければ全部戻る（503）。顧客に知らせない
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";
import { toOpsInquiryRow } from "./inbox-shape.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = ["open", "done"] as const;

export interface InquiryUpdate {
  take: boolean;
  release: boolean;
  state: (typeof STATES)[number] | null;
  /** later_until の欄が体に在ったか（null を送って外すのと、送らないのを分ける） */
  setLater: boolean;
  later: string | null;
}

interface Issue {
  field: string;
  message: string;
}

/** 体を整える。決まりに合わなければ欄ごとの理由 */
export function parseInquiryUpdate(
  raw: Record<string, unknown>,
): { ok: true; value: InquiryUpdate } | { ok: false; details: Issue[] } {
  const issues: Issue[] = [];
  const has = (k: string) => Object.hasOwn(raw, k);
  const bool = (k: string): boolean => {
    if (!has(k)) return false;
    if (typeof raw[k] !== "boolean") issues.push({ field: k, message: "真偽" });
    return raw[k] === true;
  };
  const take = bool("take");
  const release = bool("release");
  let state: InquiryUpdate["state"] = null;
  if (has("state")) {
    if ((STATES as readonly unknown[]).includes(raw["state"])) state = raw["state"] as InquiryUpdate["state"];
    else issues.push({ field: "state", message: STATES.join("・") });
  }
  let later: string | null = null;
  if (has("later_until") && raw["later_until"] !== null) {
    const v = raw["later_until"];
    if (typeof v !== "string" || Number.isNaN(Date.parse(v))) issues.push({ field: "later_until", message: "日時" });
    else later = new Date(v).toISOString();
  }
  if (!["take", "release", "state", "later_until"].some(has))
    issues.push({ field: "body", message: "変える欄が 1 つは要る" });
  if (take && release) issues.push({ field: "release", message: "取ると外すは一緒に送れない" });
  if (has("state") && has("later_until")) issues.push({ field: "later_until", message: "state と一緒に送れない" });
  if (issues.length) return { ok: false, details: issues };
  return { ok: true, value: { take, release, state, setLater: has("later_until"), later } };
}

const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 正本のエラー。欄・details・detail を付けない（在るかを漏らさない・控え帳） */
const flat = (code: string, status: number): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status, body };
};

/** 関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
function replyOf(word: string): HookReply {
  if (word === "taken") return flat("E-OPS-005", 409);
  if (word === "later_past") return flat("E-OPS-008", 409);
  console.error(`[ops] inbox-update の知らない断り（${word.slice(0, 40)}）`);
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
}

type Fn = { error?: string; data?: unknown } | null;

export function createUpdateOpsInquiry(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = a.id ?? "";
    if (!UUID.test(id)) return invalid([{ field: "id", message: "uuid の形" }]);
    const parsed = parseInquiryUpdate((a.input ?? {}) as Record<string, unknown>);
    if (!parsed.ok) return invalid(parsed.details);
    const v = parsed.value;
    let r: Fn;
    try {
      r = await opsTx(appPool, a.ctx, async (cl) => {
        const q = await cl.query<{ j: Fn }>(
          "select app.ops_inquiry_update($1::uuid, $2, $3, $4, $5, $6::timestamptz) as j",
          [id, v.take, v.release, v.state, v.setLater, v.later],
        );
        return q.rows[0]?.j ?? null;
      });
    } catch (e) {
      return opsErrorReply(e, "inbox-update");
    }
    if (!r) return replyOf("empty");
    if (r.error) return replyOf(r.error);
    return { status: 200, body: { data: toOpsInquiryRow(r.data) } };
  };
}
