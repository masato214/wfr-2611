// K-564「updateTicket の組『会社の項目の値』」の単体の試験（口と DB・本物の Postgres）。
//   マスタ（custom_fields・custom_field_kinds）と表 ticket_field_values は K-563 が作る。マスタを作る・直す口は段 10（この葉の準備は DB に直に入れる）。
// テストの名前の頭の行 ID（K564-API-…）は 11_tickets/K-564.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（口と欄ごとの処理の表は段 7 の K-387・K-440 が作る。この葉が組 ticketFields を足す）:
//   updateTicket  PATCH /api/v1/tickets/:id   body：fields = { "<項目の id（uuid）>": 値 }（送った項目だけ変える。空にするのは null）
//     値の形は項目の型ごと：short_text・long_text＝文字／number＝数／date＝YYYY-MM-DD の文字／select＝選択肢の id／multi_select＝選択肢の id の並び／check＝true・false
//     200 { data: { ticket: { id, number, updated_at, fields: { "<id>": 保存した値か null } }, changed, message_id } }（送った組の列だけ ticket に載る）
//     断る：契約に書ける形の誤り（fields が object でない・空・鍵が uuid でない・値が文字・数・真偽・文字の並び・null のどれでもない・NUL）は 422・欄 fields
//           マスタで決まる断りは 404／409（体は { error, code } だけ・field・details・detail なし）：
//             無い・消した・別の会社の項目 → 404 E-PAGE-001／その種別に出ない項目 → 409 E-FLD-001／選択肢に無い値 → 409 E-FLD-002／
//             項目の型と合わない値（数でない・日付でない・真偽でない など）→ 409 E-FLD-003／必須の項目を空にする → 409 E-FLD-004
//           403 FORBIDDEN（書けない人）／404 E-PAGE-001（無い・見えない・消した・別の会社のチケット）／503 E-PAGE-003（書く所の DB の失敗）
//     1 回の要求は全部通るか全部戻る（どれか 1 つが断られたら、同じ要求の別の組の欄も書かない）
//     空にする＝null・空の文字・空白だけ・空の並び（行は deleted_at を入れて消す。入れ直せる）。同じ値は何も書かず changed false
//     必須の「チェック」の項目は、チェックが付いていない（false・null）と必須を満たさない（409 E-FLD-004）
//     完了したチケットでも変えられる（K-387 の実績・K-440 の優先度・親と同じ。段を変えるのだけが完了後は 409）
//   やり取りの変更の 1 行（ticket_messages の kind change・1 回の要求に 1 行）：
//     「〈名前〉が〈項目の名前〉を〈前〉 → 〈後〉に変えました」。2 つ以上は「〈名前〉が〈項目 A〉を a → b に、〈項目 B〉を c → d に変えました」
//     前が空は「（空）」・値の見せ方：文字はそのまま（本文では 40 字で切って「…」・changes は全文）・数は String・日付は YYYY-MM-DD・
//     選択肢は名前（複数は「、」でつなぐ）・チェックは「チェックあり」「チェックなし」
//     changes は [{ field: "field:<項目の id>", from: 見せ方の字か null, to: 見せ方の字か null, raw_from: 保存した生の値か null, raw_to: 保存した生の値か null }]（項目の id の昇順）。生の値は項目の型どおり（文字・数・日付の字・選択肢の id・選択肢の id の並び・真偽）で、版と差分の戻す葉 K-576 が戻すのに使う
//   証跡 audit_events の action は ticket.field_values（payload は { fields: [項目の id…] }・値の字は入れない）
//   担当者への知らせ（D-150.32）：担当者でない人が変えたとき、担当者の受け箱に ticket.sort_changed の行を 1 つ（payload は { ticket_id, number, url, message_id, fields }・
//     fields は ["field:<項目の id>"…]・値と題名の字を入れない・メールなし）
// DB の関数（packages/db/migrations/20261122100400_ticket_field_values_set.sql）:
//   app.ticket_fields_set(p_ticket uuid, p jsonb, p_create boolean default false) returns jsonb … p は fields の中身 { "<id>": 値 }。
//     p_create = true は作る口（K-437）が同じ取引で呼ぶ形：その種別の必須の項目が全部入っていなければ required_empty・値の行だけ書き、やり取り・知らせ・証跡・更新時刻は書かない。失敗は
//     { error: not_member | not_found | not_writable | field_not_found | not_in_kind | bad_type | bad_option | required_empty }
//
// 口の振る舞い（K-387 の apps/api/src/hooks/ticket-update.ts の register）は、試験の本体（it の中）の ready() で 1 回だけ読む。
//   実装の前（切る段の smoke）に、まだ無いファイルを準備で読んで準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
let loaded = false;
async function ready(): Promise<void> {
  if (loaded) return;
  const m = (await import(join(HOOKS_DIR, "ticket-update.ts"))) as { register: HookModule };
  Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
  loaded = true;
}

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type Json = Record<string, unknown>;
const asJson = async (r: Response): Promise<Json> => (await r.json()) as Json;
const sorted = (o: object): string[] => Object.keys(o).sort();
/** 404・409 の答えは field・details・detail を付けない（在るかを漏らさない・控え帳 2026-11-21 01:15・20:50） */
const bare = (j: Json): void => {
  for (const k of ["field", "details", "detail"]) expect(Object.keys(j), `${k} を付けない`).not.toContain(k);
};
const jst = (days = 0): string => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

interface World {
  tenantId: string;
  root: string;
  kindId: string;
  /** 全体に書ける。名前は「高本」 */
  boss: Person;
  /** もう 1 人の書く人（担当者でない人として使う） */
  mate: Person;
  viewer: Person;
  stranger: Person;
}
async function world(): Promise<World> {
  await ready();
  const c = await f.company(`K564 の会社 ${Math.random().toString(36).slice(2, 7)}`, "FV");
  const kindId = (
    await f.admin.query<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [c.tenantId],
    )
  ).rows[0]!.id;
  const boss = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const mate = await f.person(c.tenantId, c.rootScope, { name: "営業の人", ticketAbility: "edit" });
  const viewer = await f.person(c.tenantId, c.rootScope, { name: "読むだけの人", ticketAbility: "view" });
  // 見えない人は、根の下の別のグループの席に置く（根の席の人は権限が無くても根のチケットが見える＝visible_scopes は席のグループとその下を見せる。2026-11-22 K-434・K-563 の作る段で出た誤り）
  const otherScope = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '別のグループ', 'OT', $2) returning id",
      [c.tenantId, c.rootScope],
    )
  ).rows[0]!.id;
  const stranger = await f.person(c.tenantId, otherScope, { name: "見えない人", ticketAbility: null });
  return { tenantId: c.tenantId, root: c.rootScope, kindId, boss, mate, viewer, stranger };
}

interface Fld {
  id: string;
  options: { id: string; name: string; position: number }[];
}
/** 会社の項目を管理の接続で直に入れる（マスタの口は段 10）。kinds を渡すとその種別だけに出す（無ければ全部の種別） */
async function fld(
  w: World,
  o: { name?: string; type?: string; required?: boolean; options?: string[]; kinds?: string[]; deleted?: boolean } = {},
): Promise<Fld> {
  const options = (o.options ?? []).map((name, i) => ({ id: randomUUID(), name, position: i + 1 }));
  const id = (
    await f.admin.query<{ id: string }>(
      `insert into custom_fields (tenant_id, name, field_type, required, options, deleted_at)
       values ($1, $2, $3, $4, $5::jsonb, $6) returning id`,
      [
        w.tenantId,
        o.name ?? `項目 ${randomUUID().slice(0, 6)}`,
        o.type ?? "short_text",
        o.required ?? false,
        JSON.stringify(options),
        o.deleted ? new Date().toISOString() : null,
      ],
    )
  ).rows[0]!.id;
  for (const k of o.kinds ?? [])
    await f.admin.query("insert into custom_field_kinds (tenant_id, field_id, kind_id) values ($1, $2, $3)", [
      w.tenantId,
      id,
      k,
    ]);
  return { id, options };
}
async function mk(
  w: World,
  o: { assignee?: string | null; kind?: string } = {},
): Promise<{ id: string; number: string }> {
  const r = await f.admin.query<{ id: string; number: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, due_on, assignee_member_id)
     select $1, $2, 'pending', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '項目を入れるチケット', $4::date, $5
     returning id, number`,
    [w.tenantId, w.root, o.kind ?? w.kindId, jst(3), o.assignee ?? null],
  );
  return r.rows[0]!;
}
const live = async (ticket: string): Promise<Record<string, unknown>> =>
  Object.fromEntries(
    (
      await f.admin.query<{ field_id: string; value: unknown }>(
        "select field_id, value from ticket_field_values where ticket_id = $1 and deleted_at is null",
        [ticket],
      )
    ).rows.map((r) => [r.field_id, r.value]),
  );
const rowsOf = async (ticket: string): Promise<number> =>
  Number(
    (await f.admin.query<{ n: string }>("select count(*) as n from ticket_field_values where ticket_id = $1", [ticket]))
      .rows[0]!.n,
  );
const lines = async (id: string) =>
  (
    await f.admin.query<{
      body: string;
      changes: { field: string; from: unknown; to: unknown; raw_from: unknown; raw_to: unknown }[];
      author_member_id: string | null;
    }>(
      "select body, changes, author_member_id from ticket_messages where ticket_id = $1 and kind = 'change' order by created_at, id",
      [id],
    )
  ).rows;
const audits = async (tenantId: string): Promise<Json[]> =>
  (
    await f.admin.query(
      "select * from audit_events where tenant_id = $1 and action = 'ticket.field_values' order by occurred_at",
      [tenantId],
    )
  ).rows as Json[];
const notesOf = async (ticketId: string): Promise<Json[]> =>
  (
    await f.admin.query(
      "select * from notifications where event_kind_id = 'ticket.sort_changed' and payload->>'ticket_id' = $1 order by created_at, id",
      [ticketId],
    )
  ).rows as Json[];

const patch = (who: Person | null, id: string, body: unknown) =>
  f.req("PATCH", `/tickets/${id}`, { headers: who ? who.auth : {}, body });
async function patchOk(who: Person, id: string, body: unknown): Promise<Json> {
  const r = await patch(who, id, body);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await asJson(r))["data"] ?? {}) as Json;
}
const set = (who: Person, id: string, fields: unknown) => patch(who, id, { fields });
async function refuse(r: Response, status: 404 | 409, code: string, label: string): Promise<void> {
  const text = await r.clone().text();
  expect(r.status, `${label}: ${text}`).toBe(status);
  const j = await asJson(r);
  expect(j["code"], label).toBe(code);
  bare(j);
}
const fieldsSet = (who: { id: string; tenantId: string }, ticket: string, p: object, create = false): Promise<Json> =>
  withTenant(
    f.pool,
    { tenantId: who.tenantId, userId: who.id, role: "member", stepUpAt: null },
    async (cl) =>
      (
        await cl.query<{ v: Json }>("select app.ticket_fields_set($1::uuid, $2::jsonb, $3::boolean) as v", [
          ticket,
          JSON.stringify(p),
          create,
        ])
      ).rows[0]!.v,
  );

/** 指定した表への insert だけを、その条件のときに落とす引き金（ほかの会社・ほかの試験に当たらない） */
async function failingInsert(table: string, cond: string, body: () => Promise<void>): Promise<void> {
  const name = `k564_fail_${Math.random().toString(36).slice(2, 8)}`;
  await f.admin.query(
    `create function public.${name}() returns trigger language plpgsql as $$ begin raise exception 'K-564 の試験でわざと落とした'; end $$`,
  );
  await f.admin.query(
    `create trigger ${name} before insert on ${table} for each row when (${cond}) execute function public.${name}()`,
  );
  try {
    await body();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists public.${name}()`);
  }
}
const failingAudit = (tenantId: string, body: () => Promise<void>): Promise<void> =>
  failingInsert("audit_events", `new.tenant_id = '${tenantId}' and new.action = 'ticket.field_values'`, body);
const failingNote = (tenantId: string, body: () => Promise<void>): Promise<void> =>
  failingInsert("notifications", `new.tenant_id = '${tenantId}' and new.event_kind_id = 'ticket.sort_changed'`, body);

describe("K-564 会社の項目の値（updateTicket の fields）", () => {
  it("K564-API-001 短い文字を入れる → 200・保存した値（前後の空白を落とす）・DB の行・変更の 1 行・証跡 1（値の字は入れない）", async () => {
    const w = await world();
    const cust = await fld(w, { name: "顧客名" });
    const t = await mk(w);
    const d = await patchOk(w.boss, t.id, { fields: { [cust.id]: "　山田商事 " } });
    expect(d["changed"]).toBe(true);
    const tk = d["ticket"] as Json;
    expect(sorted(tk)).toEqual(["fields", "id", "number", "updated_at"]);
    expect(tk["fields"]).toEqual({ [cust.id]: "山田商事" });
    expect(await live(t.id)).toEqual({ [cust.id]: "山田商事" });
    const ls = await lines(t.id);
    expect(ls.length).toBe(1);
    expect(ls[0]!.author_member_id).toBe(w.boss.id);
    expect(ls[0]!.body).toBe("高本が顧客名を（空） → 山田商事に変えました");
    expect(ls[0]!.changes).toEqual([
      { field: `field:${cust.id}`, from: null, to: "山田商事", raw_from: null, raw_to: "山田商事" },
    ]);
    expect(typeof d["message_id"]).toBe("string");
    const a = await audits(w.tenantId);
    expect(a.length).toBe(1);
    expect(a[0]).toMatchObject({ target_id: t.id });
    expect(a[0]!["payload"]).toEqual({ fields: [cust.id] });
    expect(JSON.stringify(a[0])).not.toContain("山田商事");
  });

  it("K564-API-002 7 つの型の保存の形：文字・長い文章（改行はそのまま）・数・日付・1 つ選ぶ（選択肢の id）・複数選ぶ（並びのまま・重なりは 1 つに）・チェック（true・false）", async () => {
    const w = await world();
    const short = await fld(w, { type: "short_text" });
    const long = await fld(w, { type: "long_text" });
    const num = await fld(w, { type: "number" });
    const day = await fld(w, { type: "date" });
    const one = await fld(w, { type: "select", options: ["営業", "開発"] });
    const many = await fld(w, { type: "multi_select", options: ["A", "B", "C"] });
    const chk = await fld(w, { type: "check" });
    const t = await mk(w);
    const body = {
      [short.id]: "短い",
      [long.id]: "一行目\n二行目",
      [num.id]: 12.5,
      [day.id]: "2026-11-30",
      [one.id]: one.options[1]!.id,
      [many.id]: [many.options[2]!.id, many.options[0]!.id, many.options[2]!.id],
      [chk.id]: false,
    };
    const d = await patchOk(w.boss, t.id, { fields: body });
    const expected = {
      ...body,
      [many.id]: [many.options[2]!.id, many.options[0]!.id],
    };
    expect(await live(t.id)).toEqual(expected);
    expect((d["ticket"] as Json)["fields"]).toEqual(expected);
    // false も「値」（空ではない）：行が残る
    expect((await live(t.id))[chk.id]).toBe(false);
    const d2 = await patchOk(w.boss, t.id, { fields: { [chk.id]: true, [num.id]: 0 } });
    expect(d2["changed"]).toBe(true);
    expect(await live(t.id)).toMatchObject({ [chk.id]: true, [num.id]: 0 });
  });

  it("K564-API-003 空にする（null・空の文字・空白だけ・空の並び）→ 200・行が消える（入れ直せる）・変更の 1 行は「→（空）」・必須でなければ通る", async () => {
    const w = await world();
    const a = await fld(w, { name: "メモ" });
    const b = await fld(w, { name: "タグ", type: "multi_select", options: ["X", "Y"] });
    const c = await fld(w, { name: "備考", type: "long_text" });
    const t = await mk(w);
    await patchOk(w.boss, t.id, { fields: { [a.id]: "最初のメモ", [b.id]: [b.options[0]!.id], [c.id]: "備考の文" } });
    const d = await patchOk(w.boss, t.id, { fields: { [a.id]: null, [b.id]: [], [c.id]: "　\t " } });
    expect(d["changed"]).toBe(true);
    expect((d["ticket"] as Json)["fields"]).toEqual({ [a.id]: null, [b.id]: null, [c.id]: null });
    expect(await live(t.id)).toEqual({});
    const ls = await lines(t.id);
    expect(ls.length).toBe(2);
    expect(ls[1]!.body).toContain("メモを最初のメモ → （空）に");
    expect(ls[1]!.changes.every((x) => x.to === null && x.from !== null)).toBe(true);
    expect(ls[1]!.changes.every((x) => x.raw_to === null && x.raw_from !== null)).toBe(true); // 空に戻したときの生の値は null
    // 入れ直せる（消した行を生き返らせず、新しい行になる）
    await patchOk(w.boss, t.id, { fields: { [a.id]: "入れ直した" } });
    expect(await live(t.id)).toEqual({ [a.id]: "入れ直した" });
    expect(await rowsOf(t.id)).toBe(4);
  });

  it("K564-API-004 変わらない（同じ値・もともと空の項目を空にする）→ 200・changed false・行も updated_at もやり取りも証跡も知らせも動かない", async () => {
    const w = await world();
    const cust = await fld(w);
    const empty = await fld(w);
    const t = await mk(w, { assignee: w.mate.id });
    await patchOk(w.boss, t.id, { fields: { [cust.id]: "山田商事" } });
    const at = (
      await f.admin.query<{ u: Date }>("select updated_at as u from tickets where id = $1", [t.id])
    ).rows[0]!.u.toISOString();
    const d = await patchOk(w.boss, t.id, { fields: { [cust.id]: " 山田商事 ", [empty.id]: null } });
    expect(d["changed"]).toBe(false);
    expect(d["message_id"]).toBeNull();
    expect(
      (
        await f.admin.query<{ u: Date }>("select updated_at as u from tickets where id = $1", [t.id])
      ).rows[0]!.u.toISOString(),
    ).toBe(at);
    expect((await lines(t.id)).length).toBe(1);
    expect((await audits(w.tenantId)).length).toBe(1);
    expect((await notesOf(t.id)).length).toBe(1);
    expect(await rowsOf(t.id)).toBe(1);
  });

  it("K564-API-005 必須の項目を空にする（null・空の文字・空白・空の並び）→ 409・E-FLD-004（欄なし）・同じ要求の別の項目も書かない。必須にした後でもともと空のチケットは、別の項目を直せる", async () => {
    const w = await world();
    const must = await fld(w, { name: "契約番号", required: true });
    const mustMulti = await fld(w, {
      name: "担当部署",
      type: "multi_select",
      required: true,
      options: ["営業", "開発"],
    });
    const other = await fld(w, { name: "メモ" });
    const mustChk = await fld(w, { name: "同意済み", type: "check", required: true });
    const t = await mk(w);
    await patchOk(w.boss, t.id, {
      fields: { [must.id]: "K-100", [mustMulti.id]: [mustMulti.options[0]!.id], [mustChk.id]: true },
    });
    for (const empty of [null, "", "　 ", [] as unknown[]]) {
      const body = { [must.id]: empty, [other.id]: "一緒に書くメモ" };
      await refuse(await set(w.boss, t.id, body), 409, "E-FLD-004", `契約番号を ${JSON.stringify(empty)}`);
    }
    await refuse(await set(w.boss, t.id, { [mustMulti.id]: [] }), 409, "E-FLD-004", "必須の複数選ぶを空に");
    // 必須のチェックは、チェックが付いていない（false・null）と必須を満たさない
    await refuse(await set(w.boss, t.id, { [mustChk.id]: false }), 409, "E-FLD-004", "必須のチェックを false に");
    await refuse(await set(w.boss, t.id, { [mustChk.id]: null }), 409, "E-FLD-004", "必須のチェックを null に");
    expect(await live(t.id)).toEqual({
      [must.id]: "K-100",
      [mustMulti.id]: [mustMulti.options[0]!.id],
      [mustChk.id]: true,
    });
    expect((await lines(t.id)).length).toBe(1);
    // 値を入れた後でも、必須でない項目だけを送れば空にできる／必須の項目に別の値を入れ直すのは通る
    await patchOk(w.boss, t.id, { fields: { [must.id]: "K-200" } });
    // マスタが後から必須になった項目：もともと空のチケットでも、その項目を送らなければ別の項目を直せる（D-150.12）
    const later = await fld(w, { name: "あとから必須", required: true });
    const t2 = await mk(w);
    await patchOk(w.boss, t2.id, { fields: { [other.id]: "メモ" } });
    expect(await live(t2.id)).toEqual({ [other.id]: "メモ" });
    expect((await live(t2.id))[later.id]).toBeUndefined();
  });

  it("K564-API-006 無い項目（無い id・消した項目・別の会社の項目）→ 404・E-PAGE-001（欄なし）・同じ要求の別の項目も書かない", async () => {
    const w = await world();
    const other = await world();
    const mine = await fld(w);
    const gone = await fld(w, { deleted: true });
    const theirs = await fld(other);
    const t = await mk(w);
    for (const [id, label] of [
      [randomUUID(), "無い id"],
      [gone.id, "消した項目"],
      [theirs.id, "別の会社の項目"],
    ] as const) {
      await refuse(await set(w.boss, t.id, { [mine.id]: "一緒に書く", [id]: "x" }), 404, "E-PAGE-001", label);
    }
    expect(await live(t.id)).toEqual({});
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K564-API-007 その種別に出ない項目 → 409・E-FLD-001（欄なし）。全部の種別に出る項目・その種別に出る項目は通る。唯一の種別の行を消した項目（消した行しか無い）は、どの種別にも出ないので 409・E-FLD-001（全部の種別に出直さない）", async () => {
    const w = await world();
    const otherKind = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_kinds (tenant_id, name, position) values ($1, 'QA 風', 50) returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const everywhere = await fld(w, { name: "どの種別にも" });
    const onlyTask = await fld(w, { name: "タスクだけ", kinds: [w.kindId] });
    const onlyOther = await fld(w, { name: "別の種別だけ", kinds: [otherKind] });
    const t = await mk(w);
    await refuse(await set(w.boss, t.id, { [onlyOther.id]: "x" }), 409, "E-FLD-001", "別の種別だけの項目");
    await refuse(
      await set(w.boss, t.id, { [everywhere.id]: "一緒", [onlyOther.id]: "x" }),
      409,
      "E-FLD-001",
      "一緒に送っても全部戻る",
    );
    expect(await live(t.id)).toEqual({});
    await patchOk(w.boss, t.id, { fields: { [everywhere.id]: "ある", [onlyTask.id]: "ある" } });
    expect(await live(t.id)).toEqual({ [everywhere.id]: "ある", [onlyTask.id]: "ある" });
    // 消した種別の行しか無い項目：行が 1 つも無い項目（全部の種別）とは別。どの種別のチケットにも入れられない
    const dropped = await fld(w, { name: "種別から外した", kinds: [w.kindId] });
    await f.admin.query("update custom_field_kinds set deleted_at = now() where field_id = $1", [dropped.id]);
    await refuse(await set(w.boss, t.id, { [dropped.id]: "x" }), 409, "E-FLD-001", "消した種別の行しか無い項目");
    expect(await live(t.id)).toEqual({ [everywhere.id]: "ある", [onlyTask.id]: "ある" });
  });

  it("K564-API-008 選択肢に無い値（1 つ選ぶ・複数選ぶ）→ 409・E-FLD-002（欄なし）・別の項目の選択肢の id も同じ・消した選択肢は選べない", async () => {
    const w = await world();
    const one = await fld(w, { type: "select", options: ["営業", "開発"] });
    const many = await fld(w, { type: "multi_select", options: ["A", "B"] });
    const t = await mk(w);
    await refuse(await set(w.boss, t.id, { [one.id]: randomUUID() }), 409, "E-FLD-002", "知らない id");
    await refuse(await set(w.boss, t.id, { [one.id]: many.options[0]!.id }), 409, "E-FLD-002", "別の項目の選択肢");
    await refuse(
      await set(w.boss, t.id, { [many.id]: [many.options[0]!.id, randomUUID()] }),
      409,
      "E-FLD-002",
      "複数の 1 つが外れ",
    );
    await refuse(
      await set(w.boss, t.id, { [many.id]: [one.options[0]!.id] }),
      409,
      "E-FLD-002",
      "別の項目の選択肢（複数）",
    );
    // マスタで選択肢を外した後は、その id を新しく入れられない（もう入っている値は残る）
    await patchOk(w.boss, t.id, { fields: { [one.id]: one.options[0]!.id } });
    await f.admin.query("update custom_fields set options = $2::jsonb where id = $1", [
      one.id,
      JSON.stringify([one.options[1]]),
    ]);
    await refuse(await set(w.boss, t.id, { [one.id]: one.options[0]!.id }), 409, "E-FLD-002", "消した選択肢");
    expect(await live(t.id)).toEqual({ [one.id]: one.options[0]!.id });
  });

  it("K564-API-009 項目の型と合わない値 → 409・E-FLD-003（欄なし）：数に文字・日付に暦に無い日や別の書き方・チェックに文字・選ぶ型に数・短い文字に数・複数選ぶに文字", async () => {
    const w = await world();
    const num = await fld(w, { type: "number" });
    const day = await fld(w, { type: "date" });
    const chk = await fld(w, { type: "check" });
    const one = await fld(w, { type: "select", options: ["営業"] });
    const many = await fld(w, { type: "multi_select", options: ["A"] });
    const txt = await fld(w, { type: "short_text" });
    const t = await mk(w);
    const cases: [string, Fld, unknown][] = [
      ["数に文字", num, "12"],
      ["数に真偽", num, true],
      ["日付に暦に無い日", day, "2026-02-30"],
      ["日付に別の書き方", day, "2026/11/30"],
      ["日付に数", day, 20261130],
      ["チェックに文字", chk, "true"],
      ["チェックに数", chk, 1],
      ["1 つ選ぶに数", one, 5],
      ["1 つ選ぶに並び", one, [one.options[0]!.id]],
      ["短い文字に数", txt, 5],
      ["短い文字に真偽", txt, false],
      ["複数選ぶに文字", many, many.options[0]!.id],
    ];
    for (const [label, field, value] of cases)
      await refuse(await set(w.boss, t.id, { [field.id]: value }), 409, "E-FLD-003", label);
    expect(await live(t.id)).toEqual({});
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K564-API-010 契約の形（422・欄 fields）：fields が object でない・空・鍵が uuid でない・値が文字・数・真偽・文字の並び・null のどれでもない・NUL → 行は書かない", async () => {
    const w = await world();
    const cust = await fld(w);
    const t = await mk(w);
    const bads: [string, unknown][] = [
      ["文字", "x"],
      ["数", 5],
      ["null", null],
      ["並び", []],
      ["空の object", {}],
      ["鍵が uuid でない", { "not-a-uuid": "x" }],
      ["値が object", { [cust.id]: { a: 1 } }],
      ["値が数の並び混じり", { [cust.id]: ["a", 1] }],
      ["値に NUL", { [cust.id]: "a\u0000b" }],
    ];
    for (const [label, fields] of bads) {
      const r = await set(w.boss, t.id, fields);
      const text = await r.text();
      expect(r.status, `${label}: ${text}`).toBe(422);
      expect(text, label).toContain("fields");
    }
    expect(await live(t.id)).toEqual({});
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K564-API-011 2 つ以上を一緒に送る：全部通れば 1 回の要求に変更の行は 1 つ（「、」でつなぐ）・どれか 1 つが断られたら全部戻る（項目の id の昇順で最初の断りを返す）", async () => {
    const w = await world();
    const cust = await fld(w, { name: "顧客名" });
    const num = await fld(w, { name: "人数", type: "number" });
    const t = await mk(w);
    const both = [cust, num].sort((a, b) => (a.id < b.id ? -1 : 1));
    const body = { [cust.id]: "山田商事", [num.id]: 3 };
    await patchOk(w.boss, t.id, { fields: body });
    const ls = await lines(t.id);
    expect(ls.length).toBe(1);
    const names = both.map((x) => (x.id === cust.id ? "顧客名を（空） → 山田商事に" : "人数を（空） → 3に"));
    expect(ls[0]!.body).toBe(`高本が${names.join("、")}変えました`);
    expect(ls[0]!.changes.map((c) => c.field)).toEqual(both.map((x) => `field:${x.id}`));
    // 1 つが断られたら全部戻る
    const t2 = await mk(w);
    await refuse(
      await set(w.boss, t2.id, { [cust.id]: "書かれない", [num.id]: "数でない" }),
      409,
      "E-FLD-003",
      "数に文字",
    );
    expect(await live(t2.id)).toEqual({});
    expect((await lines(t2.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(1);
  });

  it("K564-API-012 ほかの組（優先度・親）と一緒に送る：全部通れば組ごとに変更の 1 行・断られたら優先度も書かない・組に無い欄と一緒なら 422・E-VAL-018 で fields も書かない", async () => {
    const w = await world();
    const cust = await fld(w);
    const t = await mk(w);
    const d = await patchOk(w.boss, t.id, {
      priority: "high",
      priority_reason: "急ぎ",
      fields: { [cust.id]: "山田商事" },
    });
    expect(d["changed"]).toBe(true);
    expect(await live(t.id)).toEqual({ [cust.id]: "山田商事" });
    expect(
      ((await f.admin.query("select priority from tickets where id = $1", [t.id])).rows[0] as Json)["priority"],
    ).toBe("high");
    expect((await lines(t.id)).length).toBe(2);
    const t2 = await mk(w);
    await refuse(
      await patch(w.boss, t2.id, { priority: "high", priority_reason: "急ぎ", fields: { [cust.id]: 5 } }),
      409,
      "E-FLD-003",
      "fields が断られる",
    );
    expect(
      ((await f.admin.query("select priority from tickets where id = $1", [t2.id])).rows[0] as Json)["priority"],
    ).toBe("mid");
    expect((await lines(t2.id)).length).toBe(0);
    const t3 = await mk(w);
    const r = await patch(w.boss, t3.id, { number: "ZZ-1", fields: { [cust.id]: "書かれない" } });
    const text = await r.text();
    expect(r.status, text).toBe(422);
    expect((JSON.parse(text) as Json)["code"]).toBe("E-VAL-018");
    expect(await live(t3.id)).toEqual({});
  });

  it("K564-API-013 完了したチケットでも変えられる（段を変えるのだけが完了後は断られる・K-387・K-440 と同じ）→ 200・値と変更の 1 行が書かれる", async () => {
    const w = await world();
    const cust = await fld(w);
    const t = await mk(w);
    await f.admin.query(
      `update tickets t set stage_id = s.id, completed_at = now(), completed_by = $2
         from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = 'done'`,
      [t.id, w.boss.id],
    );
    const d = await patchOk(w.boss, t.id, { fields: { [cust.id]: "完了後の値" } });
    expect(d["changed"]).toBe(true);
    expect(await live(t.id)).toEqual({ [cust.id]: "完了後の値" });
    expect((await lines(t.id)).length).toBe(1);
  });

  it("K564-API-014 変えられない人：読むだけ 403・見えない 404・別の会社 404・無い・消されたチケット 404・ログインなし 401 → 値は書かれない（404 の体は error と code だけ）", async () => {
    const w = await world();
    const other = await world();
    const cust = await fld(w);
    const t = await mk(w);
    const gone = await mk(w);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const body = { [cust.id]: "x" };
    expect((await set(w.viewer, t.id, body)).status).toBe(403);
    for (const [r, label] of [
      [await set(w.stranger, t.id, body), "見えない人"],
      [await set(other.boss, t.id, body), "別の会社の人"],
      [await set(w.boss, randomUUID(), body), "無いチケット"],
      [await set(w.boss, gone.id, body), "消されたチケット"],
    ] as const) {
      expect(r.status, label).toBe(404);
      const j = await asJson(r);
      expect(["NOT_FOUND", "E-PAGE-001"], label).toContain(j["code"]);
      bare(j);
    }
    expect((await patch(null, t.id, { fields: body })).status).toBe(401);
    expect(await live(t.id)).toEqual({});
    expect(await live(gone.id)).toEqual({});
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K564-API-015 担当者への知らせ（D-150.32）：担当者でない人が変えると担当者の受け箱に 1 通（値と題名の字なし・メールなし）・2 つ一緒でも 1 通。本人・担当者なし・止められた・変わらないは知らせない", async () => {
    const w = await world();
    const a = await fld(w, { name: "顧客名" });
    const b = await fld(w, { name: "人数", type: "number" });
    const t = await mk(w, { assignee: w.mate.id });
    await patchOk(w.boss, t.id, { fields: { [a.id]: "秘密の値その一", [b.id]: 3 } });
    const one = await notesOf(t.id);
    expect(one.length).toBe(1);
    expect(one[0]).toMatchObject({ member_id: w.mate.id, channel_id: "inapp", event_kind_id: "ticket.sort_changed" });
    const payload = one[0]!["payload"] as { fields: string[]; message_id: string } & Json;
    expect(sorted(payload)).toEqual(["fields", "message_id", "number", "ticket_id", "url"]);
    expect(payload.fields).toEqual([a.id, b.id].sort().map((id) => `field:${id}`));
    expect(one[0]!["dedupe_key"]).toBe(`ticket.sort_changed:${payload.message_id}`);
    expect(JSON.stringify(payload)).not.toContain("秘密の値");
    expect(JSON.stringify(payload)).not.toContain("項目を入れるチケット");
    const stopped = await f.person(w.tenantId, w.root, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    const own = await mk(w, { assignee: w.boss.id });
    const nobody = await mk(w);
    const gone = await mk(w, { assignee: stopped.id });
    for (const x of [own, nobody, gone]) await patchOk(w.boss, x.id, { fields: { [a.id]: "値" } });
    for (const x of [own, nobody, gone]) expect((await notesOf(x.id)).length, x.number).toBe(0);
    await patchOk(w.boss, t.id, { fields: { [a.id]: "秘密の値その一" } });
    expect((await notesOf(t.id)).length).toBe(1);
    expect(
      (
        await f.admin.query(
          "select count(*)::int as n from notifications where tenant_id = $1 and channel_id <> 'inapp'",
          [w.tenantId],
        )
      ).rows[0].n,
    ).toBe(0);
  });

  it("K564-API-016 変更の 1 行の値の見せ方：選択肢は名前・複数は「、」・チェックは「チェックあり／なし」・数と日付はそのまま・長い文は本文で 40 字に切る（changes は全文）・生の値 raw_from・raw_to は型どおり", async () => {
    const w = await world();
    const one = await fld(w, { name: "部署", type: "select", options: ["営業", "開発"] });
    const many = await fld(w, { name: "タグ", type: "multi_select", options: ["A", "B", "C"] });
    const chk = await fld(w, { name: "確認済み", type: "check" });
    const day = await fld(w, { name: "納品日", type: "date" });
    const long = await fld(w, { name: "経緯", type: "long_text" });
    const t = await mk(w);
    const longText = "あ".repeat(60);
    await patchOk(w.boss, t.id, { fields: { [one.id]: one.options[0]!.id } });
    await patchOk(w.boss, t.id, { fields: { [one.id]: one.options[1]!.id } });
    await patchOk(w.boss, t.id, { fields: { [many.id]: [many.options[0]!.id, many.options[2]!.id] } });
    await patchOk(w.boss, t.id, { fields: { [chk.id]: true } });
    await patchOk(w.boss, t.id, { fields: { [day.id]: "2026-11-30" } });
    await patchOk(w.boss, t.id, { fields: { [long.id]: longText } });
    const ls = await lines(t.id);
    expect(ls.map((l) => l.body)).toEqual([
      "高本が部署を（空） → 営業に変えました",
      "高本が部署を営業 → 開発に変えました",
      "高本がタグを（空） → A、Cに変えました",
      "高本が確認済みを（空） → チェックありに変えました",
      "高本が納品日を（空） → 2026-11-30に変えました",
      `高本が経緯を（空） → ${"あ".repeat(40)}…に変えました`,
    ]);
    expect(ls[1]!.changes).toEqual([
      { field: `field:${one.id}`, from: "営業", to: "開発", raw_from: one.options[0]!.id, raw_to: one.options[1]!.id },
    ]);
    expect(ls[2]!.changes).toEqual([
      {
        field: `field:${many.id}`,
        from: null,
        to: "A、C",
        raw_from: null,
        raw_to: [many.options[0]!.id, many.options[2]!.id],
      },
    ]);
    expect(ls[3]!.changes).toEqual([
      { field: `field:${chk.id}`, from: null, to: "チェックあり", raw_from: null, raw_to: true },
    ]);
    expect(ls[4]!.changes).toEqual([
      { field: `field:${day.id}`, from: null, to: "2026-11-30", raw_from: null, raw_to: "2026-11-30" },
    ]);
    expect(ls[5]!.changes).toEqual([
      { field: `field:${long.id}`, from: null, to: longText, raw_from: null, raw_to: longText },
    ]);
  });

  it("K564-API-017 失敗（手順 S1・書く所）：証跡を書く所で DB が落ちる → 503・E-PAGE-003・値・変更の 1 行・証跡が前のまま・答えにもログにも値の字が出ない", async () => {
    const w = await world();
    const cust = await fld(w);
    const t = await mk(w);
    await patchOk(w.boss, t.id, { fields: { [cust.id]: "前の値" } });
    const before = (await lines(t.id)).length;
    await failingAudit(w.tenantId, async () => {
      const r = await set(w.boss, t.id, { [cust.id]: "秘密の値XYZ" });
      const text = await r.text();
      expect(r.status).toBe(503);
      expect(JSON.parse(text).code).toBe("E-PAGE-003");
      expect(text).not.toContain("XYZ");
      expect(text).not.toContain("わざと落とした");
    });
    expect(await live(t.id)).toEqual({ [cust.id]: "前の値" });
    expect((await lines(t.id)).length).toBe(before);
  });

  it("K564-API-018 失敗（手順 S2・知らせ）：担当者の受け箱の行を書く所で DB が落ちる → 503・E-PAGE-003・取引ごと戻る（値・変更の 1 行・証跡・知らせが前のまま）", async () => {
    const w = await world();
    const cust = await fld(w);
    const t = await mk(w, { assignee: w.mate.id });
    await failingNote(w.tenantId, async () => {
      const r = await set(w.boss, t.id, { [cust.id]: "秘密の値XYZ" });
      const text = await r.text();
      expect(r.status).toBe(503);
      expect(JSON.parse(text).code).toBe("E-PAGE-003");
      expect(text).not.toContain("XYZ");
    });
    expect(await live(t.id)).toEqual({});
    expect((await lines(t.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(0);
    expect((await notesOf(t.id)).length).toBe(0);
  });

  it("K564-API-019 関数を直に叩く：読むだけ not_writable・止められた not_member・別の会社 not_found・項目の断り（field_not_found・not_in_kind・bad_type・bad_option・required_empty）→ 何も変わらない", async () => {
    const w = await world();
    const other = await world();
    const otherKind = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_kinds (tenant_id, name, position) values ($1, '別の種別', 50) returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const txt = await fld(w);
    const num = await fld(w, { type: "number" });
    const one = await fld(w, { type: "select", options: ["営業"] });
    const must = await fld(w, { required: true });
    const only = await fld(w, { kinds: [otherKind] });
    const t = await mk(w);
    const stopped = await f.person(w.tenantId, w.root, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    expect(await fieldsSet(w.viewer, t.id, { [txt.id]: "x" })).toMatchObject({ error: "not_writable" });
    expect(await fieldsSet(stopped, t.id, { [txt.id]: "x" })).toMatchObject({ error: "not_member" });
    expect(await fieldsSet(other.boss, t.id, { [txt.id]: "x" })).toMatchObject({ error: "not_found" });
    expect(await fieldsSet(w.boss, t.id, { [randomUUID()]: "x" })).toMatchObject({ error: "field_not_found" });
    expect(await fieldsSet(w.boss, t.id, { [only.id]: "x" })).toMatchObject({ error: "not_in_kind" });
    expect(await fieldsSet(w.boss, t.id, { [num.id]: "数でない" })).toMatchObject({ error: "bad_type" });
    expect(await fieldsSet(w.boss, t.id, { [one.id]: randomUUID() })).toMatchObject({ error: "bad_option" });
    expect(await fieldsSet(w.boss, t.id, { [must.id]: null })).toMatchObject({ error: "required_empty" });
    expect(await live(t.id)).toEqual({});
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K564-API-020 同じ項目を同時に 2 本で書く：どちらも 200・生きた値の行は 1 つだけ（一意の守り）・値は後に書いた方", async () => {
    const w = await world();
    const cust = await fld(w);
    const t = await mk(w);
    const rs = await Promise.all([
      set(w.boss, t.id, { [cust.id]: "一人目" }),
      set(w.mate, t.id, { [cust.id]: "二人目" }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    const v = await live(t.id);
    expect(Object.keys(v)).toEqual([cust.id]);
    expect(["一人目", "二人目"]).toContain(v[cust.id]);
    expect(
      Number(
        (
          await f.admin.query<{ n: string }>(
            "select count(*) as n from ticket_field_values where ticket_id = $1 and deleted_at is null",
            [t.id],
          )
        ).rows[0]!.n,
      ),
    ).toBe(1);
  });

  it("K564-API-021 上限：1 分あたりの上限を超えた updateTicket は 429・retry_after_sec が付き、3 回目は書かれない", async () => {
    const w = await world();
    const cust = await fld(w);
    const t = await mk(w);
    const me = await f.person(w.tenantId, w.root, { name: "数える人", ticketAbility: "edit" });
    f.limits["updateTicket"] = 2;
    try {
      expect((await set(me, t.id, { [cust.id]: "1" })).status).toBe(200);
      expect((await set(me, t.id, { [cust.id]: "2" })).status).toBe(200);
      const r = await set(me, t.id, { [cust.id]: "3" });
      expect(r.status).toBe(429);
      expect(typeof (await asJson(r))["retry_after_sec"]).toBe("number");
    } finally {
      f.limits["updateTicket"] = 100_000;
    }
    expect(await live(t.id)).toEqual({ [cust.id]: "2" });
  });

  it("K564-API-022 作るときの使い方（p_create = true・K-437 が同じ取引で呼ぶ）：その種別の必須の項目が全部入っていなければ required_empty（送らなかった必須も・必須のチェックの false も）。揃えば値の行だけが入り、やり取り・知らせ・証跡・更新時刻は動かない", async () => {
    const w = await world();
    const otherKind = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_kinds (tenant_id, name, position) values ($1, '別の種別', 50) returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const must = await fld(w, { name: "契約番号", required: true });
    const mustChk = await fld(w, { name: "同意済み", type: "check", required: true });
    const optional = await fld(w, { name: "メモ" });
    const otherMust = await fld(w, { name: "別の種別の必須", required: true, kinds: [otherKind] });
    const t = await mk(w, { assignee: w.mate.id });
    const at = (
      await f.admin.query<{ u: Date }>("select updated_at as u from tickets where id = $1", [t.id])
    ).rows[0]!.u.toISOString();
    expect(await fieldsSet(w.boss, t.id, { [optional.id]: "メモ" }, true)).toMatchObject({ error: "required_empty" });
    expect(await fieldsSet(w.boss, t.id, { [must.id]: "K-1", [mustChk.id]: false }, true)).toMatchObject({
      error: "required_empty",
    });
    expect(
      await fieldsSet(w.boss, t.id, { [must.id]: "K-1", [mustChk.id]: true, [otherMust.id]: "x" }, true),
    ).toMatchObject({ error: "not_in_kind" });
    expect(await live(t.id)).toEqual({});
    const ok = await fieldsSet(w.boss, t.id, { [must.id]: "K-1", [mustChk.id]: true, [optional.id]: "メモ" }, true);
    expect(ok).toMatchObject({ changed: true });
    expect(ok["fields"]).toEqual({ [must.id]: "K-1", [mustChk.id]: true, [optional.id]: "メモ" });
    expect(await live(t.id)).toEqual({ [must.id]: "K-1", [mustChk.id]: true, [optional.id]: "メモ" });
    expect((await lines(t.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(0);
    expect((await notesOf(t.id)).length).toBe(0);
    expect(
      (
        await f.admin.query<{ u: Date }>("select updated_at as u from tickets where id = $1", [t.id])
      ).rows[0]!.u.toISOString(),
    ).toBe(at);
    // 直すとき（既定）は、送らなかった必須の項目は断らない
    const t2 = await mk(w);
    expect(await fieldsSet(w.boss, t2.id, { [optional.id]: "メモ" })).toMatchObject({ changed: true });
  });
  it("K564-API-023 知らせは 1 回の要求で 1 人に 1 通：担当者でない人が項目の値を段・優先度と一緒に変えても、担当者の受け箱の行は 1 つで、変えた欄の名前が全部入る（代表の答え ⑮7）", async () => {
    const w = await world();
    const cust = await fld(w, { name: "顧客名" });
    const t = await mk(w, { assignee: w.mate.id });
    await patchOk(w.boss, t.id, {
      stage_key: "doing",
      priority: "high",
      priority_reason: "一緒に",
      fields: { [cust.id]: "秘密の値その二" },
    });
    const all = (
      await f.admin.query(
        "select event_kind_id, payload from notifications where payload->>'ticket_id' = $1 and member_id = $2 order by created_at, id",
        [t.id, w.mate.id],
      )
    ).rows as { event_kind_id: string; payload: { fields?: string[] } }[];
    expect(all.length, "受け箱の行は 1 つ").toBe(1);
    expect(all[0]!.event_kind_id, "段の組が先に書いた行に足される").toBe("ticket.stage_changed");
    expect(all[0]!.payload).toHaveProperty("stage");
    expect(all[0]!.payload.fields).toEqual(["priority", `field:${cust.id}`]);
    expect(JSON.stringify(all[0]!.payload)).not.toContain("秘密の値");
  });
});
