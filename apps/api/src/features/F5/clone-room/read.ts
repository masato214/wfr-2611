// 分身の部屋を読む部品（K-753）：withTenant の 1 取引で DB の関数を 1 回呼ぶ。読むだけで何も書かない。
//   null（今のメンバーでない：止められた・外された）は 403（自分の分身の口なので 404 ではない）。DB が落ちたら 503・E-PAGE-003（ログに例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

type Row = Record<string, unknown>;

const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 読む関数ごとの SQL（決まった文だけ。名前を文に埋め込まない・G10） */
export const CLONE_SQL = {
  clone_me: "select app.clone_me() as v",
  clone_now: "select app.clone_now() as v",
} as const;

/** 引数の無い読む関数を 1 回呼んで答えにする（200 { data } ／ 403 ／ 503） */
export async function readOne(pool: pg.Pool, a: HookArgs, op: string, fn: keyof typeof CLONE_SQL): Promise<HookReply> {
  let v: Row | null;
  try {
    const sql = CLONE_SQL[fn];
    v = await withTenant(pool, a.ctx, async (cl) => (await cl.query<{ v: Row | null }>(sql)).rows[0]?.v ?? null);
  } catch (e) {
    console.error(`[clone-room] ${op} の読みで例外：止めた（${kindOf(e)}）`);
    return unavailable();
  }
  if (!v) return forbidden();
  return { status: 200, body: { data: v } };
}
