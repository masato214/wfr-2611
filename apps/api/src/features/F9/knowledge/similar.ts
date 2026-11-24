// 似たページを探す口（K-686・契約の口 findSimilarKnowledge・POST /api/v1/knowledge/similar）。読むだけ（DB に書かない・証跡なし）。
//   書き終える前（K-691）・上げる前（K-692）に呼ぶ。見える棚の公開済みのページから、点が SIMILAR_MIN 以上の上位 SIMILAR_LIMIT 件。
//   点の計算と見える範囲は DB の関数 app.kn_similar（security invoker・行の守り）の 1 か所。exclude_page_id は見えない・無い id でもそのまま渡す。
//   入力の整え（NFKC・前後の空白）は入口・大文字小文字は関数がそろえる。取引は 1 つ・文は 1 つ。DB の失敗は 503。ログに題名・本文を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { checkKnowledgeInput } from "./input.js";
import { unavailable } from "./reply.js";
import { placeText, type PageBrief } from "./shape.js";

/** 点の下限（関数の既定と同じ・口が明示して渡す） */
export const SIMILAR_MIN = 0.3;
/** 返す件数（関数の limit と同じ） */
export const SIMILAR_LIMIT = 3;
/** 本文の比べる頭の字数（コードポイント） */
export const BODY_HEAD = 500;

const SIMILAR_SQL = "select id, title, summary, shelf_name, folders from app.kn_similar($1, $2, $3::uuid, $4::real)";

interface SimilarInput {
  title: string;
  desc?: string;
  text?: string;
  exclude_page_id?: string;
}
interface SimilarRow {
  id: string;
  title: string;
  summary: string;
  shelf_name: string;
  folders: string[];
}

export function createFindSimilarKnowledge(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const bad = checkKnowledgeInput("findSimilarKnowledge", a.input);
    if (bad) return bad;
    const input = a.input as unknown as SimilarInput;
    const head = input.desc ? `${input.title} ${input.desc}` : input.title;
    const body = [...(input.text ?? "")].slice(0, BODY_HEAD).join("");
    let rows: SimilarRow[];
    try {
      rows = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<SimilarRow>(SIMILAR_SQL, [head, body, input.exclude_page_id ?? null, SIMILAR_MIN])).rows,
      );
    } catch (e) {
      // ログには例外の種類だけ（題名・本文を出さない）
      console.error(`[knowledge] 似たページを探せなかった（${e instanceof Error ? e.name : typeof e}）`);
      return unavailable();
    }
    const pages: PageBrief[] = rows.slice(0, SIMILAR_LIMIT).map((r) => ({
      id: r.id,
      title: r.title,
      desc: r.summary ?? "",
      place: placeText(r.shelf_name, r.folders ?? []),
    }));
    return { status: 200, body: { data: { pages } } };
  };
}
