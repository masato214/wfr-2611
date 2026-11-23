// やり取りに書き込む口（K-385）：createTicketMessage（POST /api/v1/tickets/:id/messages）。
//   入口は「そのチケットを見られる人」（閲覧のみの人も書ける・⑧）。入口の後、取引の中でもう一度「見えるか」を引いてから（守りの 2 層・判定の例外は 503）、
//   DB の関数 app.ticket_message_post を 1 回呼ぶ。書き込み 1 行と受け箱の行は 1 つの取引。書く所の例外は 503・E-PAGE-003（何も残らない・11-22 の決め）。
//   ログに本文・人の名前・例外の文を出さない（reply.ts が場所と例外の種類だけを出す）。答えは K-383 と同じ 1 件の形（kind post）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { KanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { HOLD_ONLY_MESSAGE, invalid, replyOf } from "../progress/errors.js";
import { progressIssues } from "../progress/fields.js";
import { isBlankBody, toPostPayload } from "./input.js";
import { broke, down, notFound } from "./reply.js";

/** 正本のエラーを 422 の答えにする（欄の名前つき。文言は正本から引く） */
const rejected = (code: string, field: string): HookReply => {
  const e = new KanameError(code);
  return { status: e.status, body: { ...e.toJSON(), field, details: [{ field, message: e.entry.message }] } };
};

/** 見えない物（404・E-PAGE-001）。欄の名前も明細も付けない（前からある 404 E-PAGE-001 と同じ形） */
export const pageNotFound = (): HookReply => {
  const e = new KanameError("E-PAGE-001");
  const body: Record<string, unknown> = { ...e.toJSON() };
  delete body["detail"]; // 空の detail も付けない（欄も明細も無い・試験 006〜008）
  return { status: e.status, body };
};

interface PostResult {
  item?: unknown;
  error?: string;
  fields?: unknown;
}

/** 段の欄を送ったか（stage_key か stage_id） */
const hasStage = (p: { stage_key?: unknown; stage_id?: unknown }): boolean =>
  p["stage_key"] !== undefined || p["stage_id"] !== undefined;

/** 本文が空：入口の前処理で断る（本文が無いのも空と同じ答え・E-VAL-027） */
export function inputPost(raw: unknown): { input: Record<string, unknown> } | { reply: HookReply } {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (isBlankBody(o["body"])) return { reply: rejected("E-VAL-027", "body") };
    // 段の欄の形の決まり（K-387 と同じ・契約に書ける物だけ 422）。段の欄が無ければ見ない（保留の欄だけの断りは関数が見える人にだけ返す）
    if (hasStage(o)) {
      const issue = progressIssues(o);
      if (issue) return { reply: issue };
    }
  }
  return { input: raw as Record<string, unknown> };
}

export function createPostTicketMessage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const payload = toPostPayload(a.input, a.ctx.userId ?? "");
    if (isBlankBody(payload.body)) return rejected("E-VAL-027", "body");
    let stage = "guard" as "guard" | "write";
    let v: PostResult | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        // 守りの判定を先に 1 回（ここで例外なら止める側に倒す）。見えるかの答えは関数の中でもう一度見る
        await cl.query("select app.ticket_visible($1) as ok", [a.id]);
        stage = "write";
        const r = await cl.query<{ v: PostResult | null }>("select app.ticket_message_post($1, $2::jsonb) as v", [
          a.id as string,
          JSON.stringify(payload),
        ]);
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      return stage === "guard" ? down("やり取りに書く（守りの判定）", e) : broke("やり取りに書く", e);
    }
    if (v?.item !== undefined && v.item !== null) return { status: 201, body: { data: v.item } };
    if (v?.error === "not_found") return notFound();
    if (v?.error === "empty") return rejected("E-VAL-027", "body");
    // @・知らせる人・引用元が選べない（見られない・抜けた・止められた・別のチケット・消した）は DB の中身で決まるので 422 にせず 404（欄も明細も付けない＝在るかを漏らさない・控え帳 2026-11-21 01:15）
    if (v?.error === "not_selectable") return pageNotFound();
    if (v?.error === "hold_not_allowed" && !hasStage(payload)) {
      // 段の欄が無いのに保留の欄だけ（理由を直すのは頭の札の口 K-387）：形の誤り・送った欄ごと
      const fs = Array.isArray(v.fields) ? v.fields.map(String) : [];
      return invalid(fs.map((field) => ({ field, message: HOLD_ONLY_MESSAGE })));
    }
    // 段の所の断り（K-387 の関数の言葉）は K-387 と同じ振り分け。知らない言葉は止める側（503）
    if (v?.error !== undefined && hasStage(payload)) return replyOf(v, "やり取りに書く（段）", { ...payload });
    return down("やり取りに書く（知らない答え）", new Error("unknown"));
  };
}
