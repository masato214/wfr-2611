// 確認項目の行を外す口（K-435・契約の口 deleteTestSpec・DELETE /api/v1/test_specs/:id・論理削除・D-150.56）。
//   手順 S2：DB の関数 app.test_spec_delete で、チケットの共有ロックと行の排他ロック・完了・出どころの確かめ・deleted_at・やり取りに 1 行・
//            証跡 test_spec.delete を 1 つの取引で書く（関門 C2）。行も確かめの結果（checks）も残る。体も版も受けない。外へは何も出さない。
//   答え：ok → 200 { data: SpecItem（外す前の姿） }／not_found → 404／forbidden → 403／done → 409・E-SPEC-001／locked_source → 409・E-SPEC-022／
//         例外 → 503・E-PAGE-003（行は残る）。ログに題名を出さない（行の id と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { conflictDone, conflictLocked, forbidden, kindOf, notFound, unavailable } from "./reply.js";
import { toSpecItem, type SpecItem } from "./shape.js";

const DELETE_SQL = "select app.test_spec_delete($1) as v";

type Outcome = { ok: true; row: SpecItem } | { error: "not_found" | "forbidden" | "done" | "locked_source" };

export function createDeleteTestSpec(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const id = a.id!;
    let v: Outcome | undefined;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: Outcome }>(DELETE_SQL, [id])).rows[0]?.v);
    } catch (e) {
      console.error(`[test-spec] 外せなかった（${id}・${kindOf(e)}）`);
      return unavailable();
    }
    if (!v) return unavailable();
    if ("ok" in v) return { status: 200, body: { data: toSpecItem(v.row) } };
    if (v.error === "forbidden") return forbidden();
    if (v.error === "done") return conflictDone();
    if (v.error === "locked_source") return conflictLocked();
    return notFound();
  };
}
