// K-566「完了の口の直し」のうち、実施事項の番号の入力 todo_checked・todo_version と前の区画の道を見る行（K566-API-006・007・009・014）。名前の頭の行 ID は 11_tickets/K-566.md の表と 1 対 1。
//   K-566 が入ってから K-578 が契約と関数から外すまでの間の姿を見る（todo_* は契約に残るが中身は見ない・本文の行が無ければ前の実施事項の区画の「- 」の行を数える・関数は 4 引数）。
//   K-578 がこのファイルごと消す（その後の姿は K578-API-015〜018）。ほかの行は complete-unchecked.test.ts（区画の道が在っても無くても同じ姿）。
//   土台は approve-complete.harness.ts。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  setupApproveComplete,
  f,
  T,
  boss,
  json,
  one,
  complete,
  stageKeyOf,
  ticket,
  executed,
  completeBody,
  type Ticket,
} from "./approve-complete.harness.js";

setupApproveComplete();

type Node = Record<string, unknown>;
const para = (t: string): Node => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const task = (t: string, checked?: unknown, extra: Node[] = []): Node => ({
  type: "taskItem",
  ...(checked === undefined ? {} : { attrs: { checked } }),
  content: [para(t), ...extra],
});
const taskList = (...items: Node[]): Node => ({ type: "taskList", content: items });
const docOf = (...content: Node[]) => ({ type: "doc", content });

/** 本文の行（鍵 body）を置く。区画の行は消さない（前の形の todo も残る） */
async function putBody(t: Ticket, doc: Node): Promise<void> {
  const body = { doc, text: "本文" };
  const s = await one<{ id: string }>(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, 'body', 0, $3, 1) returning id",
    [t.tenant, t.id, JSON.stringify(body)],
  );
  await f.admin.query(
    "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body) values ($1, $2, $3, 1, $4)",
    [t.tenant, t.id, s.id, JSON.stringify(body)],
  );
}
let tick = 0;
async function addSpec(t: Ticket, title: string, o: { checked?: boolean; deleted?: boolean } = {}): Promise<void> {
  tick += 1;
  await f.admin.query(
    `insert into test_specs (tenant_id, ticket_id, check_kind, title, checked_at, deleted_at, created_at)
     values ($1, $2, 'human', $3, case when $4 then now() end, case when $5 then now() end, now() + make_interval(secs => $6))`,
    [t.tenant, t.id, title, o.checked === true, o.deleted === true, tick],
  );
}
/** 完了にして、答えの unchecked を返す */
async function completeAndCount(t: Ticket, extra: Record<string, unknown> = {}) {
  const r = await complete(boss, t.id, await completeBody(t, extra));
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await json(r)).data as { unchecked: { body: number; specs: number } }).unchecked;
}

describe("K-566 完了の口の直し：実施事項の番号の入力と前の区画の道（K-578 が外すまで）", () => {
  it("K566-API-006 止めない：未チェックが残っていても、todo_checked が空・todo_version が古い・範囲の外の番号でも 201 で、E-VAL-022・E-CONF-017 は出ない", async () => {
    for (const extra of [{ todo_checked: [] }, { todo_version: 0 }, { todo_checked: [-5, 99], todo_version: 7 }]) {
      const t = await ticket();
      await executed(t);
      await putBody(t, docOf(taskList(task("未", false))));
      await addSpec(t, "未の確認項目");
      const r = await complete(boss, t.id, await completeBody(t, extra));
      expect(r.status, JSON.stringify(extra) + (await r.clone().text())).toBe(201);
      const text = JSON.stringify(await json(r));
      expect(text).not.toContain("E-VAL-022");
      expect(text).not.toContain("E-CONF-017");
    }
  });

  it("K566-API-007 入力：todo_checked と todo_version を送らず conditions_confirmed だけで 201。形の誤り（文字の並び・文字の版）は 422 のまま", async () => {
    const t = await ticket();
    await executed(t);
    const ok = await complete(boss, t.id, { conditions_confirmed: true });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const u = await ticket();
    await executed(u);
    for (const bad of [{ todo_checked: ["a"] }, { todo_checked: "0,1" }, { todo_version: "1" }]) {
      const r = await complete(boss, u.id, { conditions_confirmed: true, ...bad });
      expect(r.status, JSON.stringify(bad)).toBe(422);
    }
    expect(await stageKeyOf(u.id)).toBe("doing");
  });

  it("K566-API-009 本文の行が無い（前の形）：実施事項の区画の「- 」の行のうち「- [x]」でない行を数える（body 1）。区画は書き換えない", async () => {
    const t = await ticket({ todo: "- 請求書を作る\n- [x] 先方に送る\n- [X] 控える\n説明の行" });
    await executed(t);
    const before = await one<{ version: number; text: string }>(
      "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'todo'",
      [t.id],
    );
    expect(await completeAndCount(t)).toEqual({ body: 1, specs: 0 });
    expect(
      await one(
        "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'todo'",
        [t.id],
      ),
    ).toEqual(before);
  });

  it("K566-API-014 DB の関数を直に呼ぶ（2 層目）：app.ticket_complete は前の引数（uuid・integer[]・integer・boolean）のまま答えに unchecked を持つ。app.ticket_body_unchecked は null・空の jsonb・文字を 0 と数え、入れ子を数える", async () => {
    const t = await ticket();
    await executed(t);
    await putBody(t, docOf(taskList(task("未", false))));
    const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
    const out = await withTenant(f.pool, ctx, (cl) =>
      cl.query<{ v: { unchecked?: { body: number; specs: number } } }>(
        "select app.ticket_complete($1, null::integer[], null::integer, true) as v",
        [t.id],
      ),
    );
    expect(out.rows[0]!.v.unchecked).toEqual({ body: 1, specs: 0 });
    const sig = await f.admin.query<{ args: string }>(
      "select pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ticket_complete'",
    );
    expect(sig.rows.map((x) => x.args)).toEqual([
      "p_ticket uuid, p_todo_checked integer[], p_todo_version integer, p_confirmed boolean",
    ]);
    const cnt = async (j: unknown) =>
      Number(
        (await f.admin.query<{ n: number }>("select app.ticket_body_unchecked($1::jsonb) as n", [JSON.stringify(j)]))
          .rows[0]!.n,
      );
    expect(await cnt(null)).toBe(0);
    expect(await cnt({})).toBe(0);
    expect(await cnt("文字")).toBe(0);
    expect(await cnt(docOf(taskList(task("a", false, [taskList(task("b", false))]))))).toBe(2);
  });
});
