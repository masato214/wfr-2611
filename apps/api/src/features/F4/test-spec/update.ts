// 確認項目にチェックを付ける・外す・文を直す口（K-435・契約の口 updateTestSpec・PATCH /api/v1/test_specs/:id・D-150.55・D-150.56・D-150.40）。
//   手順 S1：DB の関数 app.test_spec_update で、入力の確かめ・チケットの共有ロックと行の排他ロック・完了・版・出どころ・チェックの確かめ・行の更新・
//            やり取りに 1 行・証跡 test_spec.update を 1 つの取引で書く（関門 C2）。何も変わらないときは 200 で何も書かない。外へは何も出さない。
//   答え：ok → 200 { data: SpecItem }／invalid → 422・VALIDATION_ERROR（欄 version・checked・title）／not_found → 404／forbidden → 403／
//         done → 409・E-SPEC-001／version → 409・E-SPEC-020／checked_title → 409・E-SPEC-021／locked_source → 409・E-SPEC-022／例外 → 503・E-PAGE-003（何も残らない）。
//   ログに題名を出さない（行の id と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { parseUpdate } from "./update-input.js";
import {
  conflictChecked,
  conflictDone,
  conflictLocked,
  conflictVersion,
  forbidden,
  invalid,
  kindOf,
  notFound,
  unavailable,
} from "./reply.js";
import { toSpecItem, type SpecItem } from "./shape.js";

const UPDATE_SQL = "select app.test_spec_update($1, $2::jsonb) as v";

type Outcome =
  | { ok: true; row: SpecItem }
  | { error: "invalid"; field?: string; message?: string }
  | { error: "not_found" | "forbidden" | "done" | "version" | "checked_title" | "locked_source" };

export function createUpdateTestSpec(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const id = a.id!;
    let v: Outcome | undefined;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: Outcome }>(UPDATE_SQL, [id, JSON.stringify(parseUpdate(a.input))])).rows[0]?.v,
      );
    } catch (e) {
      console.error(`[test-spec] 直せなかった（${id}・${kindOf(e)}）`);
      return unavailable();
    }
    if (!v) return unavailable();
    if ("ok" in v) return { status: 200, body: { data: toSpecItem(v.row) } };
    switch (v.error) {
      case "invalid":
        return invalid(v.field ?? "title", v.message ?? "入力内容を確認してください");
      case "forbidden":
        return forbidden();
      case "done":
        return conflictDone();
      case "version":
        return conflictVersion();
      case "checked_title":
        return conflictChecked();
      case "locked_source":
        return conflictLocked();
      default:
        return notFound();
    }
  };
}
