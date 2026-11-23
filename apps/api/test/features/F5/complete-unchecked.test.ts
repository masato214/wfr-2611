// K-566「完了の口の直し」の単体の試験（口・本物の DB・本物の PC の印）。名前の頭の行 ID（K566-API-…）は 11_tickets/K-566.md の表と 1 対 1。
//   完了にするとき、本文のチェックの箱と確認項目の未チェックは「数えて返すだけ」で止めない（D-150.42）。本文の行（鍵 body）が在れば文書の木の taskItem を数える。
//   実施事項の番号の入力 todo_checked・todo_version を送ったときの振る舞い・本文の行が無いチケットの数え方・関数の引数は、
//   区画の道が在る間だけの姿なので、行 006・007・009・014 は complete-unchecked-legacy-sections.test.ts（K-578 がファイルごと消す。その後の姿は K578-API-015〜018）。
//   土台は approve-complete.harness.ts（チケットは DB に直に置く・前の形の区画つき。本文の行はこの試験の中で足す）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { type Transport } from "@kaname/notify";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import {
  setupApproveComplete,
  VAL_NOT_CONFIRMED,
  VAL_CHILDREN,
  CONF_ALREADY,
  f,
  hooks,
  boss,
  writer,
  json,
  one,
  num,
  complete,
  stageKeyOf,
  ticket,
  executed,
  completeBody,
  messagesOf,
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
const bodyRow = (t: Ticket) =>
  one<{ version: number; body: unknown }>(
    "select version, body from ticket_sections where ticket_id = $1 and section_key = 'body'",
    [t.id],
  );
const specRows = (t: Ticket) =>
  f.admin
    .query("select title, checked_at, deleted_at from test_specs where ticket_id = $1 order by created_at, id", [t.id])
    .then((r) => r.rows);

describe("K-566 完了の口の直し：未チェックは数えて返すだけ（本物の DB）", () => {
  it("K566-API-001 本文の行が在る（チェックの箱 未 2・済 1）・確認項目（未 1・済 1）× 完了にする：201・unchecked は body 2・specs 1・段は完了", async () => {
    const t = await ticket();
    await executed(t);
    await putBody(
      t,
      docOf(para("やること"), taskList(task("一つ目", false), task("二つ目", true), task("三つ目", false))),
    );
    await addSpec(t, "未チェックの確認項目");
    await addSpec(t, "チェック済みの確認項目", { checked: true });
    expect(await completeAndCount(t)).toEqual({ body: 2, specs: 1 });
    expect(await stageKeyOf(t.id)).toBe("done");
  });

  it("K566-API-002 完了の前後で、本文の行（版・doc・text）・確認項目の行・実施事項の区画が変わらない。版の行も増えない", async () => {
    const t = await ticket();
    await executed(t);
    await putBody(t, docOf(taskList(task("残す", false))));
    await addSpec(t, "残す確認項目");
    const before = {
      body: await bodyRow(t),
      specs: await specRows(t),
      todo: await one("select version, body from ticket_sections where ticket_id = $1 and section_key = 'todo'", [
        t.id,
      ]),
      versions: await num("select count(*) as n from ticket_section_versions where ticket_id = $1", [t.id]),
    };
    await completeAndCount(t);
    expect(await bodyRow(t)).toEqual(before.body);
    expect(await specRows(t)).toEqual(before.specs);
    expect(
      await one("select version, body from ticket_sections where ticket_id = $1 and section_key = 'todo'", [t.id]),
    ).toEqual(before.todo);
    expect(await num("select count(*) as n from ticket_section_versions where ticket_id = $1", [t.id])).toBe(
      before.versions,
    );
  });

  it("K566-API-003 チェックの箱も確認項目も無い・全部チェック済み：unchecked は 0 と 0", async () => {
    const none = await ticket();
    await executed(none);
    await putBody(none, docOf(para("箱は無い")));
    expect(await completeAndCount(none)).toEqual({ body: 0, specs: 0 });
    const done = await ticket();
    await executed(done);
    await putBody(done, docOf(taskList(task("済み", true))));
    await addSpec(done, "済みの確認項目", { checked: true });
    expect(await completeAndCount(done)).toEqual({ body: 0, specs: 0 });
  });

  it('K566-API-004 本文の数え方：入れ子の箱も数える・attrs が無い箱と checked が真偽の true でない箱（文字の "true"・null）は未チェック・段落の中の「[ ]」の字は数えない', async () => {
    const t = await ticket();
    await executed(t);
    await putBody(
      t,
      docOf(
        para("[ ] これは字だけで箱ではない"),
        taskList(
          task("外側（未）", false, [taskList(task("内側の未", false), task("内側の済", true))]),
          task("attrs が無い"),
          task("文字の true", "true"),
          task("null", null),
          task("済", true),
        ),
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [para("箇条書きの中"), taskList(task("深い未", false))] }],
        },
      ),
    );
    // 未＝外側・内側の未・attrs 無し・文字の true・null・深い未 の 6
    expect((await completeAndCount(t)).body).toBe(6);
  });

  it("K566-API-005 確認項目の数え方：消した行・別のチケットの行・チェック済みの行は未チェックに数えない", async () => {
    const t = await ticket();
    await executed(t);
    const other = await ticket();
    await addSpec(t, "未 1");
    await addSpec(t, "未 2");
    await addSpec(t, "消した未", { deleted: true });
    await addSpec(t, "済み", { checked: true });
    await addSpec(other, "別のチケットの未");
    expect((await completeAndCount(t)).specs).toBe(2);
  });

  it("K566-API-008 conditions_confirmed が無い・false：422・E-VAL-023（欄 conditions_confirmed）。何も書かない（前のまま）", async () => {
    const t = await ticket();
    await executed(t);
    for (const body of [{}, { conditions_confirmed: false }]) {
      const r = await complete(boss, t.id, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const j = await json(r);
      expect(JSON.stringify(j)).toContain(VAL_NOT_CONFIRMED);
      expect(JSON.stringify(j.details)).toContain("conditions_confirmed");
    }
    expect(await stageKeyOf(t.id)).toBe("doing");
  });

  it("K566-API-010 本文の行が在るとき、前の実施事項の区画は数えない（区画に未済みの行が残っていても body は本文の行だけで決まる）", async () => {
    const t = await ticket({ todo: "- 区画の未 1\n- 区画の未 2" });
    await executed(t);
    await putBody(t, docOf(taskList(task("済", true))));
    expect((await completeAndCount(t)).body).toBe(0);
  });

  it("K566-API-011 更新の行・知らせ・証跡は前のまま：やり取りの 1 行「…が完了にしました」が 1 つ・変更の行（kind change）は増えない・知らせは作った人に 1 つ・証跡は 1", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    await putBody(t, docOf(taskList(task("未", false))));
    const changesBefore = (await messagesOf(t.id)).filter((m) => m.kind === "change").length;
    await completeAndCount(t);
    const lines = await messagesOf(t.id);
    expect(lines.filter((m) => m.body.includes("高本が完了にしました"))).toHaveLength(1);
    expect(lines.filter((m) => m.kind === "change")).toHaveLength(changesBefore);
    expect(
      await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
    ).toBe(1);
    expect(
      await num("select count(*) as n from audit_events where action = 'ticket.complete' and target_id = $1", [t.id]),
    ).toBe(1);
  });

  it("K566-API-012 完了を押す間に本文のチェックが付いた：止めず、そのときの本文で数える（古い版を送っても 409 にならない）", async () => {
    const t = await ticket();
    await executed(t);
    await putBody(t, docOf(taskList(task("未", false), task("もう一つの未", false))));
    const old = await completeBody(t);
    await f.admin.query(
      `update ticket_sections set version = version + 1,
              body = jsonb_set(body, '{doc,content,0,content,0,attrs}', '{"checked": true}'::jsonb)
        where ticket_id = $1 and section_key = 'body'`,
      [t.id],
    );
    const r = await complete(boss, t.id, old);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await json(r)).data as { unchecked: { body: number } }).unchecked.body).toBe(1);
  });

  it("K566-API-013 答えの形：data の鍵は ticket・knowledge_candidates・skipped_reason・unchecked の 4 つで、unchecked は鍵ちょうど body と specs（どちらも 0 以上の整数）", async () => {
    const t = await ticket();
    await executed(t);
    const r = await complete(boss, t.id, await completeBody(t));
    expect(r.status).toBe(201);
    const data = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(["knowledge_candidates", "skipped_reason", "ticket", "unchecked"]);
    const u = data["unchecked"] as Record<string, unknown>;
    expect(Object.keys(u).sort()).toEqual(["body", "specs"]);
    for (const v of Object.values(u)) expect(Number.isInteger(v) && (v as number) >= 0).toBe(true);
  });

  it("K566-API-015 ほかの断りが先：未チェックがあっても、終わっていない子が在れば 422・E-VAL-024（完了にならない）。もう完了していれば 409・E-CONF-018", async () => {
    const parent = await ticket();
    await executed(parent);
    await putBody(parent, docOf(taskList(task("未", false))));
    await ticket({ parent: parent.id, stage: "todo", title: "終わっていない子" });
    const r = await complete(boss, parent.id, await completeBody(parent));
    expect(r.status).toBe(422);
    expect(JSON.stringify(await json(r))).toContain(VAL_CHILDREN);
    expect(await stageKeyOf(parent.id)).toBe("doing");
    const t = await ticket();
    await executed(t);
    await completeAndCount(t);
    const again = await complete(boss, t.id, await completeBody(t));
    expect(again.status).toBe(409);
    expect((await json(again))["code"]).toBe(CONF_ALREADY);
  });

  it("K566-API-016 失敗 S1 DB に書く：完了の途中（証跡を書く所）で DB が落ちたら 503・E-PAGE-003。段は完了にならず、完了の時刻も知らせも残らない（未チェックが残っていても同じ）", async () => {
    const t = await ticket({ title: "K566 壊れる 完了", creator: writer });
    await executed(t);
    await putBody(t, docOf(taskList(task("未", false))));
    await f.admin.query(`create or replace function app.k566_boom() returns trigger language plpgsql as $$
      begin
        if new.action = 'ticket.complete' and exists (select 1 from tickets x where x.id::text = new.target_id and x.title like 'K566 壊れる%') then
          raise exception 'K566 の試験で壊した';
        end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k566_boom before insert on audit_events for each row execute function app.k566_boom()",
    );
    try {
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status).toBe(503);
      expect(((await r.json()) as { code?: string }).code).toBe("E-PAGE-003");
      expect(await stageKeyOf(t.id)).toBe("doing");
      expect(
        (await one<{ c: string | null }>("select completed_at as c from tickets where id = $1", [t.id])).c,
      ).toBeNull();
      expect(
        await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
      ).toBe(0);
    } finally {
      await f.admin.query("drop trigger if exists k566_boom on audit_events");
      await f.admin.query("drop function if exists app.k566_boom()");
    }
  });

  it("K566-API-017 失敗 S2 完了の知らせを受け箱に書く：受け箱に書けなくても完了は残る。送れたとは言わず failed_at・retry_count を残す（未チェックが残っていても同じ）", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    await putBody(t, docOf(taskList(task("未", false))));
    const broken: Transport = {
      send: async () => {
        throw new Error("受け箱に書けない");
      },
    };
    const keep = hooks["completeTicket"];
    Object.assign(hooks, { completeTicket: approveHooks(f.pool, { inbox: broken })["completeTicket"] });
    try {
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status, await r.clone().text()).toBe(201);
    } finally {
      hooks["completeTicket"] = keep!;
    }
    expect(await stageKeyOf(t.id)).toBe("done");
    const n = await one<{ sent_at: string | null; failed_at: string | null; retry_count: number | null }>(
      "select sent_at, failed_at, retry_count from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1",
      [`%ticket.completed:${t.id}`],
    );
    expect(n.sent_at).toBeNull();
    expect(n.failed_at).not.toBeNull();
    expect(Number(n.retry_count)).toBeGreaterThanOrEqual(1);
  });
});
