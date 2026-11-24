// 渡す前の下見の口（previewTicketHandover・GET /tickets/:id/handover-preview・入口の行の言葉は read・K-401・D-148.2）。
//   詳細の右の「担当者 ▾」を押して相手を選ぶ小窓が開くときに 1 回呼ぶ。1 取引・文 1 つ（app.handover_preview）で、
//   その人ができる種類・止まり・待っている渡し・返事の期限の既定・決まり・子と関連の数・グループ・候補の人・配れるグループを返す。
//   見えない・消した・下書きのチケットは 404。できる種類が無い人は 403・E-HND-002（中身を返さない）。候補は 500 人で切る（ログに 1 行・名前とメールは出さない）。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HandoverDeps } from "./deps.js";
import { fromCatalog, notFound } from "./errors.js";

/** 候補の人の上限（DB の関数 app.handover_preview と同じ数） */
export const CANDIDATES_MAX = 500;

export function previewHandover(d: HandoverDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const v = await withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: Record<string, unknown> | null }>("select app.handover_preview($1) as v", [
        a.id ?? "",
      ]);
      return r.rows[0]?.v ?? null;
    });
    if (!v) return notFound();
    const kinds = Array.isArray(v["kinds"]) ? (v["kinds"] as string[]) : [];
    if (kinds.length === 0) return fromCatalog("E-HND-002", 403);
    // 候補の人は DB の関数が 500 人で切る（501 人目があれば印 candidates_over。答えには載せない）
    if (v["candidates_over"] === true) console.warn(`[handover] 下見の候補の人を ${CANDIDATES_MAX} 人で切った`);
    return {
      status: 200,
      body: {
        data: {
          kinds,
          blocked: v["blocked"] ?? null,
          waiting: v["waiting"] ?? null,
          default_reply_due: v["default_reply_due"],
          rules: v["rules"] ?? [],
          children: v["children"],
          links: v["links"],
          group: v["group"],
          candidates: Array.isArray(v["candidates"]) ? v["candidates"] : [],
          groups: v["groups"] ?? [],
        },
      },
    };
  };
}
