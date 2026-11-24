// 渡す口・答える口の共通の確かめ（K-401）。DB の関数（app.handover_gate・app.handover_answer_gate）を 1 取引・文 1 つで呼ぶ。
//   見えるか・その人ができる種類か・別の人にする・止まり（完了・AI・承認・待っている渡し）・相手・一緒に切り替えるもの を DB の 1 か所で見る。
//   判定の所の例外は止める側（503・E-PAGE-003・ログは場所と例外の種類だけ）
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HandoverDeps } from "./deps.js";
import { down, kindOf, replyOf } from "./errors.js";
import type { AnswerGateOk, CreateInput, GateOk } from "./kinds.js";

type GateAnswer = { ok?: boolean; error?: string; [k: string]: unknown } | null;

/** DB の答え → ok の形か断る答え */
function settle<T>(v: GateAnswer, where: string): T | HookReply {
  if (v && v.ok === true) return v as unknown as T;
  if (v && typeof v.error === "string") return replyOf(v as { error: string }, where);
  return down(where, "答えが無い");
}

/** 渡す口の共通の確かめ（読むだけ） */
export async function createGate(
  d: HandoverDeps,
  a: HookArgs,
  ticketId: string,
  input: CreateInput,
): Promise<GateOk | HookReply> {
  try {
    const v = await withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: GateAnswer }>("select app.handover_gate($1, $2::jsonb) as v", [
        ticketId,
        JSON.stringify(input),
      ]);
      return r.rows[0]?.v ?? null;
    });
    return settle<GateOk>(v, "渡す口の確かめ");
  } catch (e) {
    return down("渡す口の確かめ", `例外（${kindOf(e)}）`);
  }
}

/** 答える口の共通の確かめ（読むだけ） */
export async function answerGate(d: HandoverDeps, a: HookArgs, handoverId: string): Promise<AnswerGateOk | HookReply> {
  try {
    const v = await withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: GateAnswer }>("select app.handover_answer_gate($1) as v", [handoverId]);
      return r.rows[0]?.v ?? null;
    });
    return settle<AnswerGateOk>(v, "答える口の確かめ");
  } catch (e) {
    return down("答える口の確かめ", `例外（${kindOf(e)}）`);
  }
}
