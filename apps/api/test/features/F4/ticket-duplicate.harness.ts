// K-438 の試験（ticket-duplicate.test.ts・ticket-duplicate-children.test.ts）が共有する土台（2026-11-22 の作り直し：本文 1 枚・項目・確認項目の形）。
// 会社・人・グループ・会社の項目の準備と、元・子・数える物の道具。元の中身（本文の行・確認項目・項目の値・つながり）は本物の DB の行を直に入れて作る（まだ無い口を使わない）。
// export let は読む側から見ると今の値（setupDup の後に入る）。試験のファイルは 1 つずつ別の流れで動く（会社は試験のファイルごとに新しく作る）
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

export let f: Fixture;
export let T: { tenantId: string; rootScope: string };
export let O: { tenantId: string; rootScope: string };
export let group: string; // T の中の 2 つ目のグループ
export let writer: Person;
export let mate: Person;
export let third: Person; // 子の担当者に使う別の人
export let viewer: Person;
export let outsider: Person;
export let task: { id: string };
export let issue: { id: string };
/** 会社の項目（T の会社・全部 setupDup が入れる）。issueOnly は課題にだけ出る。dept2 は元の値が選択肢から外れている */
export let FLD: { memo: string; amount: string; dept: string; dept2: string; issueOnly: string; free: string };
export const OPT = { o1: randomUUID(), o2: randomUUID(), gone: randomUUID() };

export type Row = Record<string, unknown>;
/** 404・409 の断りは欄（field）・details・detail を付けない（在るかを漏らさない・控え帳 2026-11-21 01:15・20:50） */
export const noFields = (j: Row, label = ""): void => {
  for (const k of ["field", "details", "detail"]) expect(k in j, `${label} ${k}`).toBe(false);
};
export const json = async (r: Response) => (await r.json()) as Row & { data?: Row };
export const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

const text = (t: string) => ({ type: "text", text: t });
export const para = (t: string) => ({ type: "paragraph", content: [text(t)] });
const heading = (t: string) => ({ type: "heading", attrs: { level: 2 }, content: [text(t)] });
const taskItem = (t: string, checked: boolean) => ({ type: "taskItem", attrs: { checked }, content: [para(t)] });
const ghost = { type: "paragraph", attrs: { ghost: true }, content: [text("薄い説明")] };
/** 元の本文：見出し・段落・チェックの箱 3 つ（2 つ済み）・薄い字の説明・表 */
export const SRC_DOC = {
  type: "doc",
  content: [
    heading("目的"),
    para("月末の請求を出す"),
    heading("実施事項"),
    { type: "taskList", content: [taskItem("作る", true), taskItem("送る", true), taskItem("残す", false)] },
    ghost,
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [para("支払期日")] },
            { type: "tableCell", content: [para("翌月末")] },
          ],
        },
      ],
    },
  ],
};
/** 写した後の本文：チェックの箱だけ全部外れ、ほかは元のとおり */
export const COPY_DOC = {
  ...SRC_DOC,
  content: SRC_DOC.content.map((n) =>
    n.type === "taskList"
      ? { type: "taskList", content: [taskItem("作る", false), taskItem("送る", false), taskItem("残す", false)] }
      : n,
  ),
};
export const childDoc = (t: string, checked = false) => ({
  type: "doc",
  content: [
    heading(`${t}の目的`),
    { type: "taskList", content: [taskItem("子の作業", checked), taskItem("子の次", false)] },
  ],
});
export const childCopyDoc = (t: string) => childDoc(t, false);

/** 作る口の体（複製の置き先）。本文は入力の物（copy に body を含まないときに使われる） */
export const newBody = (extra: Row = {}) => ({
  scope_id: T.rootScope,
  kind_id: task.id,
  title: "複製した請求書",
  assignee_member_id: writer.id,
  due_on: jst(5),
  body: { doc: { type: "doc", content: [para("入力の本文")] } },
  ...extra,
});
export const sourceBody = (extra: Row = {}) => ({
  scope_id: T.rootScope,
  kind_id: task.id,
  title: "元の請求書",
  assignee_member_id: mate.id,
  due_on: jst(30),
  priority: "high",
  priority_reason: "月末までに必要",
  estimate_minutes: 90,
  body: { doc: SRC_DOC },
  ...extra,
});
export const create = (who: Person, b: unknown, headers: Record<string, string> = {}) =>
  f.req("POST", "/tickets", { body: b, headers: { ...who.auth, ...headers } });
export const createOk = async (who: Person, b: unknown) => {
  const r = await create(who, b);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as Row;
};
export const q = async <R extends Row = Row>(sql: string, p: unknown[] = []) => (await f.admin.query<R>(sql, p)).rows;
export const count = async (sql: string, p: unknown[] = []) => Number((await q<{ n: string }>(sql, p))[0]!["n"]);
export const ticketsIn = (tenant: string) => count("select count(*) as n from tickets where tenant_id = $1", [tenant]);
/** 本文の行（鍵 body・消していない）。行が無ければ undefined */
export const bodyOf = async (id: unknown) =>
  (
    await q<{ body: { doc: unknown; text: string }; version: number }>(
      "select body, version from ticket_sections where ticket_id = $1 and section_key = 'body' and deleted_at is null",
      [id],
    )
  )[0];
export const specsOf = (id: unknown) =>
  q<{
    title: string;
    check_kind: string | null;
    source: string;
    source_ref_id: string | null;
    checked_at: string | null;
    checked_by_member_id: string | null;
    checked_by_ai: boolean;
    version: number;
    created_by: string | null;
  }>(
    "select title, check_kind, source, source_ref_id, checked_at, checked_by_member_id, checked_by_ai, version, created_by from test_specs where ticket_id = $1 and deleted_at is null order by created_at, id",
    [id],
  );
export const valuesOf = async (id: unknown) =>
  Object.fromEntries(
    (
      await q<{ field_id: string; value: unknown }>(
        "select field_id, value from ticket_field_values where ticket_id = $1 and deleted_at is null",
        [id],
      )
    ).map((r) => [r.field_id, r.value]),
  );
export const linksOf = (id: unknown) =>
  q<{ from_ticket_id: string; to_ticket_id: string; kind: string }>(
    "select from_ticket_id, to_ticket_id, kind from ticket_links where (from_ticket_id = $1 or to_ticket_id = $1) and deleted_at is null order by kind, to_ticket_id",
    [id],
  );
export const derivedFrom = async (id: unknown) =>
  (
    await q<{ to_ticket_id: string }>(
      "select to_ticket_id from ticket_links where from_ticket_id = $1 and kind = 'derived_from' and deleted_at is null",
      [id],
    )
  ).map((r) => r.to_ticket_id);
export const childrenOf = (id: unknown) =>
  q<{
    id: string;
    number: string;
    title: string;
    kind_id: string;
    assignee_member_id: string;
    due_on: string;
    start_on: string | null;
    priority: string;
    estimate_minutes: number | null;
    stage_key: string;
  }>(
    "select t.id, t.number, t.title, t.kind_id, t.assignee_member_id, t.due_on::text as due_on, t.start_on::text as start_on, t.priority, t.estimate_minutes, s.key as stage_key from tickets t join ticket_stages s on s.id = t.stage_id where t.parent_ticket_id = $1 and t.deleted_at is null order by t.title",
    [id],
  );
const seedValue = (ticketId: unknown, fieldId: string, value: unknown) =>
  f.admin.query(
    "insert into ticket_field_values (tenant_id, ticket_id, field_id, value) values ($1, $2, $3, $4::jsonb)",
    [T.tenantId, ticketId, fieldId, JSON.stringify(value)],
  );

/** 複製の元を作る：本文（チェックの箱つき）・確認項目 3（1 つは出どころ knowledge・1 つはチェック済み・1 つは消した）・会社の項目の値・つながり（関連 2・派生元 1・元から派生した 1） */
export async function makeSource(extra: Row = {}) {
  const t = await createOk(writer, sourceBody(extra));
  const id = t["id"] as string;
  const spec = (title: string, source: string, ref: string | null, checked: boolean, del: boolean) =>
    f.admin.query(
      "insert into test_specs (tenant_id, ticket_id, check_kind, title, source, source_ref_id, checked_at, checked_by_member_id, deleted_at, created_by, updated_by) values ($1, $2, 'human', $3, $4, $5, $6, $7, $8, $9, $9)",
      [
        T.tenantId,
        id,
        title,
        source,
        ref,
        checked ? new Date() : null,
        checked ? writer.id : null,
        del ? new Date() : null,
        writer.id,
      ],
    );
  await spec("請求額が見積と一致する", "manual", null, true, false);
  await spec("文面がていねいか", "knowledge", REF.page, false, false);
  await spec("消した項目", "manual", null, false, true);
  await seedValue(id, FLD.memo, "元のメモ");
  await seedValue(id, FLD.amount, 12000.5);
  await seedValue(id, FLD.dept, OPT.o1);
  await seedValue(id, FLD.dept2, OPT.gone);
  await seedValue(id, FLD.issueOnly, "課題だけの値");
  return t;
}
export const REF = { page: randomUUID() };
/** 元に付ける関連のつながりの相手を作る（相手は見える物） */
export async function relate(src: unknown, other: Row, reversed = false) {
  const [a, b] = reversed ? [other["id"], src] : [src, other["id"]];
  await f.admin.query(
    "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind) values ($1, $2, $3, 'related')",
    [T.tenantId, a, b],
  );
}
export const addChild = (parent: unknown, title: string, extra: Row = {}) =>
  createOk(
    writer,
    sourceBody({
      title,
      parent_ticket_id: parent,
      assignee_member_id: third.id,
      due_on: jst(20),
      priority: "mid",
      priority_reason: undefined,
      estimate_minutes: undefined,
      body: { doc: childDoc(title, true) },
      ...extra,
    }),
  );
export const ALL = ["body", "assignee", "fields", "specs", "links", "children"];
/** 数えておく表（失敗の後に前と同じかを見る） */
export const snapshot = async () => ({
  tickets: await ticketsIn(T.tenantId),
  sections: await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId]),
  versions: await count("select count(*) as n from ticket_section_versions where tenant_id = $1", [T.tenantId]),
  specs: await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId]),
  values: await count("select count(*) as n from ticket_field_values where tenant_id = $1", [T.tenantId]),
  links: await count("select count(*) as n from ticket_links where tenant_id = $1", [T.tenantId]),
  notes: await count("select count(*) as n from notifications where tenant_id = $1", [T.tenantId]),
  audits: await count("select count(*) as n from audit_events where tenant_id = $1 and action = 'ticket.duplicate'", [
    T.tenantId,
  ]),
});
export const failOn = async (name: string, table: string, cond: string) => {
  await f.admin.query(`create or replace function app.${name}() returns trigger language plpgsql as $$ begin
    if ${cond} then raise exception 'k438 試験の失敗'; end if; return new; end $$`);
  await f.admin.query(`create trigger ${name} before insert on ${table} for each row execute function app.${name}()`);
  return async () => {
    await f.admin.query(`drop trigger ${name} on ${table}`);
    await f.admin.query(`drop function app.${name}()`);
  };
};

export async function setupDup(): Promise<void> {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  T = await f.company("K438 の会社", "EG");
  O = await f.company("K438 の別の会社", "OT");
  group = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '営業', 'SL') returning id",
      [T.tenantId, T.rootScope],
    )
  ).rows[0]!.id;
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  third = await f.person(T.tenantId, T.rootScope, { name: "子の担当の人", ticketAbility: "edit" });
  viewer = await f.person(T.tenantId, T.rootScope, { name: "見るだけの人", ticketAbility: "view" });
  outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
  const kinds = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as unknown as {
    id: string;
    name: string;
  }[];
  task = kinds.find((k) => k.name === "タスク")!;
  issue = kinds.find((k) => k.name === "課題")!;
  const put = async (
    name: string,
    type: string,
    options: { id: string; name: string; position: number }[] = [],
    kinds: string[] = [],
  ) => {
    const id = (
      await f.admin.query<{ id: string }>(
        "insert into custom_fields (tenant_id, name, field_type, options, position) values ($1, $2, $3, $4::jsonb, 1) returning id",
        [T.tenantId, name, type, JSON.stringify(options)],
      )
    ).rows[0]!.id;
    for (const k of kinds)
      await f.admin.query("insert into custom_field_kinds (tenant_id, field_id, kind_id) values ($1, $2, $3)", [
        T.tenantId,
        id,
        k,
      ]);
    return id;
  };
  const opts = [
    { id: OPT.o1, name: "営業", position: 1 },
    { id: OPT.o2, name: "開発", position: 2 },
  ];
  FLD = {
    memo: await put("メモ", "short_text"),
    amount: await put("金額", "number"),
    dept: await put("部署", "select", opts),
    dept2: await put("旧い選択", "select", opts),
    issueOnly: await put("課題だけの項目", "short_text", [], [issue.id]),
    free: await put("入力だけの項目", "number"),
  };
}
export async function closeDup(): Promise<void> {
  await f?.close();
}
