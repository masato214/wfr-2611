// K-437「作る口 createTicket を新しい形に（本文 body.doc・会社の項目 fields・確認項目 specs[]）」の単体の試験（口・本物の DB）。
// 名前の頭の行 ID（K437-API-…）は 11_tickets/K-437.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
// 段 5 の作り直し（2026-11-21）の形：
//   入力 body ＝ { doc }（任意。無ければ空の本文）。text は口が doc から作る（画面から受けない）。区画の入力 sections は K-578 が外すまで今までどおり受ける（body があれば body だけを書き sections は捨てる・body が無く sections だけなら前の区画の道）。その前の道の行（K437-API-027〜029）は create-ticket-legacy-sections.test.ts にまとめた（K-578 がそのファイルごと消す）
//   入力 fields ＝ { "<項目の id>": 値 }（会社の項目の値）・specs ＝ 確認項目の文の並び（0〜50 件・文だけ）
//   書く先：本文は ticket_sections の鍵 body（版 1・版の表にも 1 行）・項目の値は ticket_field_values・確認項目は test_specs（check_kind なし・チェック無し・source manual）
//   作るときに止めるのは 題名・種別・担当者・期限・会社が必須にした項目だけ（body の道では必須の区画で止めない。sections だけで来た作り方の E-VAL-013 は K-578 まで残る）
//   断る番号：422＝契約に書ける形の誤りだけ（欄つき）／404＝無い・見えない（欄なし・E-PAGE-001）／409＝今の状態ではできない（欄なし。会社の項目の 4 つ E-FLD-001〜004 を含む）
//   入力 links（作るときにつなぐ）は K-581 の試験（create-ticket-links.test.ts）が持つ
//   前からの createTicket の試験（create-ticket.test.ts・K-60）は K-437 が carry で替えた版。ここは足す分だけ
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { TITLE_MAX } from "../../../src/features/F4/create-ticket/input.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

/** 会社の項目の値の確かめの断りの番号（409・欄なし）。K-564 の `app.ticket_fields_set(p_ticket, p, true)` が返す番号と同じ（値を書くのは同じ関数 1 つ・K-437 は呼ぶだけ） */
const FLD = { notInKind: "E-FLD-001", option: "E-FLD-002", type: "E-FLD-003", required: "E-FLD-004" } as const;

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let writer: Person;
let mate: Person;
let viewer: Person;
let outsider: Person;
let task: { id: string };
let issue: { id: string };
let otherTask: { id: string };

type J = Record<string, unknown> & { data?: Record<string, unknown> };
const json = async (r: Response) => (await r.json()) as J;
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const para = (...t: string[]) => ({
  type: "doc",
  content: t.map((x) => ({ type: "paragraph", content: [{ type: "text", text: x }] })),
});
const body = (extra: Record<string, unknown> = {}) => ({
  scope_id: T.rootScope,
  kind_id: task.id,
  title: "請求書を送る",
  assignee_member_id: mate.id,
  due_on: jst(3),
  ...extra,
});
const create = (who: Person, b: unknown = body(), headers: Record<string, string> = {}) =>
  f.req("POST", "/tickets", { body: b, headers: { ...who.auth, ...headers } });
const createOk = async (who: Person, b: unknown = body()) => {
  const r = await create(who, b);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as Record<string, unknown>;
};
const count = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const ticketsIn = (tenant: string) => count("select count(*) as n from tickets where tenant_id = $1", [tenant]);
const bodyRow = async (ticketId: unknown) =>
  (
    await f.admin.query<{ body: { doc: unknown; text: string }; version: number; position: number }>(
      "select body, version, position from ticket_sections where ticket_id = $1 and section_key = 'body' and deleted_at is null",
      [ticketId],
    )
  ).rows;
const specsOf = async (ticketId: unknown) =>
  (
    await f.admin.query<{
      title: string;
      check_kind: string | null;
      checked_at: string | null;
      checked_by_member_id: string | null;
      checked_by_ai: boolean;
      source: string;
      version: number;
      created_by: string | null;
      tenant_id: string;
    }>(
      "select title, check_kind, checked_at, checked_by_member_id, checked_by_ai, source, version, created_by, tenant_id from test_specs where ticket_id = $1 and deleted_at is null order by created_at, id",
      [ticketId],
    )
  ).rows;
const valuesOf = async (ticketId: unknown) =>
  Object.fromEntries(
    (
      await f.admin.query<{ field_id: string; value: unknown }>(
        "select field_id, value from ticket_field_values where ticket_id = $1 and deleted_at is null",
        [ticketId],
      )
    ).rows.map((r) => [r.field_id, r.value]),
  );
const changeLines = (ticketId: unknown) =>
  count("select count(*) as n from ticket_messages where ticket_id = $1 and kind = 'change'", [ticketId]);
/** 会社の項目を入れる（kinds＝出す種別。空なら全部の種別） */
async function putField(
  tenant: string,
  o: {
    name: string;
    type: string;
    required?: boolean;
    options?: { id: string; name: string; position: number }[];
    kinds?: string[];
    gone?: boolean;
  },
): Promise<string> {
  const id = (
    await f.admin.query<{ id: string }>(
      "insert into custom_fields (tenant_id, name, field_type, required, options, position, deleted_at) values ($1, $2, $3, $4, $5::jsonb, 1, $6) returning id",
      [
        tenant,
        o.name,
        o.type,
        o.required ?? false,
        JSON.stringify(o.options ?? []),
        o.gone ? new Date().toISOString() : null,
      ],
    )
  ).rows[0]!.id;
  for (const k of o.kinds ?? [])
    await f.admin.query("insert into custom_field_kinds (tenant_id, field_id, kind_id) values ($1, $2, $3)", [
      tenant,
      id,
      k,
    ]);
  return id;
}
/** 404・409 の体は欄（field）・details・detail を付けない（在るかを漏らさない・控え帳 2026-11-21 01:15・20:50） */
const noFields = (j: Record<string, unknown>, label = "") => {
  for (const k of ["field", "details", "detail"]) expect(k in j, `${label} ${k}`).toBe(false);
};
const gone = (status: number, j: Record<string, unknown>, label = "") => {
  expect(status, label).toBe(404);
  expect(j["code"], label).toBe("E-PAGE-001");
  noFields(j, label);
};
const conflict = (status: number, j: Record<string, unknown>, code: string, label = "") => {
  expect(status, label).toBe(409);
  expect(j["code"], label).toBe(code);
  noFields(j, label);
};
const fieldsOf = (j: Record<string, unknown>) =>
  ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);
const OPT = [
  { id: randomUUID(), name: "A 社", position: 1 },
  { id: randomUUID(), name: "B 社", position: 2 },
];

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  T = await f.company("K437 の会社", "EG");
  O = await f.company("K437 の別の会社", "OT");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  viewer = await f.person(T.tenantId, T.rootScope, { name: "見るだけの人", ticketAbility: "view" });
  outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
  const mine = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as unknown as {
    id: string;
    name: string;
  }[];
  task = mine.find((k) => k.name === "タスク")!;
  issue = mine.find((k) => k.name === "課題")!;
  const theirs = (await json(await f.req("GET", "/ticket_kinds", { headers: outsider.auth }))).data as unknown as {
    id: string;
    name: string;
  }[];
  otherTask = theirs.find((k) => k.name === "タスク")!;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-437 本文 body.doc", () => {
  it("K437-API-001 本文を付けて作る：ticket_sections の鍵 body に 1 行（位置 0・版 1・doc は渡した物・text は口が doc から作った素の文）・版の表に版 1 が 1 行・区画の行は 0", async () => {
    const doc = para("月末の請求を出す", "先方に送る");
    const t = await createOk(writer, body({ body: { doc } }));
    const rows = await bodyRow(t["id"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: 1, position: 0 });
    expect(rows[0]!.body.doc).toEqual(doc);
    expect(rows[0]!.body.text).toBe("月末の請求を出す\n先方に送る");
    expect(
      await count("select count(*) as n from ticket_section_versions where ticket_id = $1 and version = 1", [t["id"]]),
    ).toBe(1);
    expect(
      await count("select count(*) as n from ticket_sections where ticket_id = $1 and section_key <> 'body'", [
        t["id"],
      ]),
    ).toBe(0);
    // 別の取得で読み直しても同じ（作った答えだけで合格にしない）
    const again = await bodyRow(t["id"]);
    expect(again[0]!.body).toEqual(rows[0]!.body);
  });

  it("K437-API-002 本文が無い・空の木：どちらも 201（本文は空でも作れる）。鍵 body の行ができて text は空・必須の区画で止まらない（E-VAL-013 は無い）", async () => {
    const a = await createOk(writer, body({ kind_id: issue.id }));
    const b = await createOk(writer, body({ kind_id: task.id, body: { doc: { type: "doc", content: [] } } }));
    for (const t of [a, b]) {
      const rows = await bodyRow(t["id"]);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.body.text).toBe("");
      expect(rows[0]!.version).toBe(1);
    }
    // 前の版で必須だった区画（タスクの目的・完了の条件・実施事項）の行は作られない
    expect(
      await count(
        "select count(*) as n from ticket_sections where tenant_id = $1 and section_key in ('purpose', 'done', 'todo') and ticket_id = any($2)",
        [T.tenantId, [a["id"], b["id"]]],
      ),
    ).toBe(0);
  });

  it("K437-API-003 text は画面から受けない：body に text や知らない鍵を付けると 422（欄 body）・何も作られない。body の外の知らない欄も 422", async () => {
    const before = await ticketsIn(T.tenantId);
    const r1 = await create(writer, body({ body: { doc: para("本文"), text: "すり替えた素の文" } }));
    expect(r1.status).toBe(422);
    expect(fieldsOf(await json(r1)).some((x) => x.startsWith("body"))).toBe(true);
    const r2 = await create(writer, body({ body: { doc: para("本文"), extra: 1 } }));
    expect(r2.status).toBe(422);
    expect(fieldsOf(await json(r2)).some((x) => x.startsWith("body"))).toBe(true);
    const r3 = await create(writer, body({ not_a_field: "x" }));
    expect(r3.status).toBe(422);
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K437-API-004 形の違う木（知らない節・見出しの level が 5・javascript: のリンク・入れ子が深すぎる・doc でない）は 422・欄 body。何も作られない・段落 6,000 個の正しい木は通る（節の数に上限は無い）", async () => {
    const before = await ticketsIn(T.tenantId);
    const para1 = (marks: unknown[]) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks }] }],
    });
    const deep = (n: number): unknown =>
      n === 0 ? { type: "paragraph" } : { type: "bulletList", content: [{ type: "listItem", content: [deep(n - 1)] }] };
    const bad: unknown[] = [
      { type: "doc", content: [{ type: "scriptBlock" }] },
      { type: "doc", content: [{ type: "heading", attrs: { level: 5 }, content: [{ type: "text", text: "x" }] }] },
      para1([{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
      { type: "doc", content: [deep(8)] },
      { type: "paragraph" },
    ];
    for (const doc of bad) {
      const r = await create(writer, body({ body: { doc } }));
      expect(r.status, JSON.stringify(doc)).toBe(422);
      expect(fieldsOf(await json(r)).some((x) => x.startsWith("body"))).toBe(true);
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
    await createOk(
      writer,
      body({ body: { doc: { type: "doc", content: Array.from({ length: 6000 }, () => ({ type: "paragraph" })) } } }),
    );
  });

  it("K437-API-030 K-584 が足した節と印を含む本文を付けて作れ、読み直しても同じ：番号つき・区切りの線・見出し 4・寄せ・結合セル・下線・取り消し線・コード・上付き・下付き・#rrggbb の色と背景。契約が先に断る形（#FF0000・rgb()・start 0・colspan 51・知らない寄せ）は 422・欄 body。何も作られない", async () => {
    const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
    const p = (...c: unknown[]) => ({ type: "paragraph", content: c });
    // K432-API-022（本文を書き終える口）と同じ文書：2 つの口の契約の木が食い違わないことを同じ値で見る
    const rich = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 4, textAlign: "center" }, content: [t("小さな見出し")] },
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(t("三つ目"))] }] },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          attrs: { textAlign: "justify" },
          content: [
            t("下線", [{ type: "underline" }]),
            t("消す", [{ type: "strike" }]),
            t("x = 1", [{ type: "code" }]),
            t("2", [{ type: "superscript" }]),
            t("i", [{ type: "subscript" }]),
            t("赤", [{ type: "color", attrs: { color: "#e11d48" } }]),
            t("黄", [{ type: "highlight", attrs: { color: "#fde68a" } }]),
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", attrs: { colspan: 2, colwidth: [120, 80] }, content: [p(t("項目"))] },
                { type: "tableHeader", content: [p(t("金額"))] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [p(t("保守"))] },
                { type: "tableCell", attrs: { rowspan: 2 }, content: [p(t("月額"))] },
                { type: "tableCell", content: [p(t("10,000"))] },
              ],
            },
          ],
        },
      ],
    };
    const made = await createOk(writer, body({ body: { doc: rich } }));
    const rows = await bodyRow(made["id"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: 1, position: 0 });
    expect(rows[0]!.body.doc).toEqual(rich);
    expect(rows[0]!.body.text).toContain("小さな見出し");
    expect(rows[0]!.body.text).toContain("- 三つ目");
    expect(rows[0]!.body.text).not.toContain("3.");
    // 別の取得で読み直しても同じ（作った答えだけで合格にしない）
    expect((await bodyRow(made["id"]))[0]!.body).toEqual(rows[0]!.body);

    const before = await ticketsIn(T.tenantId);
    const mk = (node: unknown) => ({ type: "doc", content: [node] });
    const bad: Record<string, unknown> = {
      大文字の色: mk(p(t("x", [{ type: "color", attrs: { color: "#FF0000" } }]))),
      "rgb() の背景": mk(p(t("x", [{ type: "highlight", attrs: { color: "rgb(255,0,0)" } }]))),
      "start 0": mk({
        type: "orderedList",
        attrs: { start: 0 },
        content: [{ type: "listItem", content: [p(t("x"))] }],
      }),
      "colspan 51": mk({
        type: "table",
        content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 51 }, content: [p(t("x"))] }] }],
      }),
      知らない寄せ: mk({ type: "paragraph", attrs: { textAlign: "start" }, content: [t("x")] }),
    };
    for (const [why, doc] of Object.entries(bad)) {
      const r = await create(writer, body({ body: { doc } }));
      expect(r.status, why).toBe(422);
      expect(
        fieldsOf(await json(r)).some((x) => x.startsWith("body")),
        why,
      ).toBe(true);
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });
});

describe("K-437 会社の項目 fields", () => {
  it("K437-API-005 7 つの型の値を付けて作る：ticket_field_values に項目ごとの値が入る（短い文字・長い文章・数・日付・1 つ選ぶ・複数選ぶ・チェック）。別の取得で読み直しても同じ", async () => {
    const ids = {
      short: await putField(T.tenantId, { name: "K437 短い文字", type: "short_text" }),
      long: await putField(T.tenantId, { name: "K437 長い文章", type: "long_text" }),
      num: await putField(T.tenantId, { name: "K437 数", type: "number" }),
      date: await putField(T.tenantId, { name: "K437 日付", type: "date" }),
      sel: await putField(T.tenantId, { name: "K437 選ぶ", type: "select", options: OPT }),
      multi: await putField(T.tenantId, { name: "K437 複数選ぶ", type: "multi_select", options: OPT }),
      chk: await putField(T.tenantId, { name: "K437 チェック", type: "check" }),
    };
    const fields = {
      [ids.short]: "請求先",
      [ids.long]: "1 行目\n2 行目",
      [ids.num]: 12000.5,
      [ids.date]: "2026-12-15",
      [ids.sel]: OPT[1]!.id,
      [ids.multi]: [OPT[0]!.id, OPT[1]!.id],
      [ids.chk]: true,
    };
    const t = await createOk(writer, body({ fields }));
    expect(await valuesOf(t["id"])).toEqual(fields);
    expect(await count("select count(*) as n from ticket_field_values where ticket_id = $1", [t["id"]])).toBe(7);
  });

  it("K437-API-006 会社が必須にした項目が空だと 409（欄なし・何も作られない）：渡さない・空の文字・空の並び・null のどれも。値を入れれば作れる。必須のチェックは付けないと作れない", async () => {
    const need = await putField(T.tenantId, {
      name: "K437 必須の文字",
      type: "short_text",
      required: true,
      kinds: [issue.id],
    });
    const multi = await putField(T.tenantId, {
      name: "K437 必須の複数",
      type: "multi_select",
      required: true,
      options: OPT,
      kinds: [issue.id],
    });
    const chk = await putField(T.tenantId, {
      name: "K437 必須のチェック",
      type: "check",
      required: true,
      kinds: [issue.id],
    });
    const full = { [need]: "ある", [multi]: [OPT[0]!.id], [chk]: true };
    const before = await ticketsIn(T.tenantId);
    for (const fields of [
      {},
      { ...full, [need]: "" },
      { ...full, [need]: "　 " },
      { ...full, [multi]: [] },
      { ...full, [multi]: null },
      { ...full, [chk]: false },
    ]) {
      const r = await create(writer, body({ kind_id: issue.id, fields }));
      conflict(r.status, await json(r), FLD.required, JSON.stringify(fields));
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
    // 出さない種別（タスク）では必須にならない・満たせば課題でも作れる
    await createOk(writer, body({ kind_id: task.id }));
    const ok = await createOk(writer, body({ kind_id: issue.id, fields: full }));
    expect(await valuesOf(ok["id"])).toEqual(full);
  });

  it("K437-API-007 選択肢に無い値・その種別に出ない項目は 409（欄なし）：1 つ選ぶ・複数選ぶの外の id・別の項目の選択肢・タスクだけの項目を課題に付ける。何も作られない", async () => {
    const sel = await putField(T.tenantId, { name: "K437 選ぶ 2", type: "select", options: OPT });
    const multi = await putField(T.tenantId, { name: "K437 複数 2", type: "multi_select", options: OPT });
    const only = await putField(T.tenantId, { name: "K437 タスクだけ", type: "short_text", kinds: [task.id] });
    const before = await ticketsIn(T.tenantId);
    const stray = randomUUID();
    for (const fields of [
      { [sel]: stray },
      { [multi]: [OPT[0]!.id, stray] },
      { [sel]: OPT[0]!.id, [multi]: [stray] },
    ]) {
      const r = await create(writer, body({ fields }));
      conflict(r.status, await json(r), FLD.option, JSON.stringify(fields));
    }
    const r2 = await create(writer, body({ kind_id: issue.id, fields: { [only]: "課題には出ない" } }));
    conflict(r2.status, await json(r2), FLD.notInKind, "出ない項目");
    expect(await ticketsIn(T.tenantId)).toBe(before);
    await createOk(writer, body({ kind_id: task.id, fields: { [only]: "タスクには出る" } }));
  });

  it("K437-API-008 無い項目・消した項目・別の会社の項目の id は 404・E-PAGE-001（欄なし・相手の名前を返さない）。何も作られない", async () => {
    const gonef = await putField(T.tenantId, { name: "K437 消した項目", type: "short_text", gone: true });
    const theirs = await putField(O.tenantId, { name: "K437 相手だけの項目", type: "short_text" });
    const before = await ticketsIn(T.tenantId);
    for (const id of [randomUUID(), gonef, theirs]) {
      const r = await create(writer, body({ fields: { [id]: "x" } }));
      const j = await json(r);
      gone(r.status, j, id);
      expect(JSON.stringify(j)).not.toContain("相手だけの項目");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K437-API-009 値の誤りの分け方：契約に書ける形の誤り（鍵が項目の id でない・値が object・fields が object でない）は 422（欄 fields…）／項目の型と合わない値（数が文字・暦に無い日付・複数選ぶが並びでない・チェックが真偽でない・文字が数）は 409・E-FLD-003（欄なし・型はマスタで決まる）。どちらも何も作られない", async () => {
    const num = await putField(T.tenantId, { name: "K437 数 2", type: "number" });
    const date = await putField(T.tenantId, { name: "K437 日付 2", type: "date" });
    const multi = await putField(T.tenantId, { name: "K437 複数 3", type: "multi_select", options: OPT });
    const chk = await putField(T.tenantId, { name: "K437 チェック 2", type: "check" });
    const txt = await putField(T.tenantId, { name: "K437 文字 2", type: "short_text" });
    const before = await ticketsIn(T.tenantId);
    for (const fields of [{ "not-a-uuid": "x" }, { [num]: { a: 1 } }, "文字", [num]]) {
      const r = await create(writer, body({ fields }));
      expect(r.status, JSON.stringify(fields)).toBe(422);
      expect(fieldsOf(await json(r)).some((x) => x.startsWith("fields"))).toBe(true);
    }
    for (const fields of [
      { [num]: "12000" },
      { [date]: "2026-02-30" },
      { [multi]: OPT[0]!.id },
      { [chk]: "yes" },
      { [txt]: 5 },
    ]) {
      const r = await create(writer, body({ fields }));
      conflict(r.status, await json(r), FLD.type, JSON.stringify(fields));
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K437-API-010 必須でない項目の空（null・空の文字・空の並び）は値の行を作らない・値のある項目だけ入る", async () => {
    const a = await putField(T.tenantId, { name: "K437 任意の文字", type: "short_text" });
    const b = await putField(T.tenantId, { name: "K437 任意の複数", type: "multi_select", options: OPT });
    const c = await putField(T.tenantId, { name: "K437 任意の数", type: "number" });
    const t = await createOk(writer, body({ fields: { [a]: "", [b]: [], [c]: 0 } }));
    expect(await valuesOf(t["id"])).toEqual({ [c]: 0 });
  });
});

describe("K-437 確認項目 specs[]", () => {
  it("K437-API-011 specs を付けて作る：test_specs に文の数だけ行（前後の空白を落とした文・check_kind なし・チェック無し・出どころ manual・版 1・作った人・同じ会社）が渡した順に入る", async () => {
    const t = await createOk(writer, body({ specs: ["  金額が一致する  ", "宛名が正しい", "　送付先を確かめる\t"] }));
    const rows = await specsOf(t["id"]);
    expect(rows.map((r) => r.title)).toEqual(["金額が一致する", "宛名が正しい", "送付先を確かめる"]);
    for (const r of rows)
      expect(r).toMatchObject({
        check_kind: null,
        checked_at: null,
        checked_by_member_id: null,
        checked_by_ai: false,
        source: "manual",
        version: 1,
        created_by: writer.id,
        tenant_id: T.tenantId,
      });
  });

  it("K437-API-012 specs が無い・空の並び：確認項目は 0 件。種別の既定のテスト仕様（kind_sections.default_test_specs）は写さない（作るときは specs[] だけ）", async () => {
    await f.admin.query(
      "update kind_sections set default_test_specs = $2::jsonb where kind_id = $1 and section_key = 'done'",
      [task.id, JSON.stringify([{ check_kind: "human", title: "既定の確認" }])],
    );
    try {
      const a = await createOk(writer);
      const b = await createOk(writer, body({ specs: [] }));
      expect(await specsOf(a["id"])).toHaveLength(0);
      expect(await specsOf(b["id"])).toHaveLength(0);
    } finally {
      await f.admin.query("update kind_sections set default_test_specs = null where kind_id = $1", [task.id]);
    }
  });

  it("K437-API-013 文の誤り（空白だけ・生の字で 201 字・文字でない・51 件）は 422（欄 specs…）。何も作られない。200 字ちょうど・同じ文が 2 つは入る", async () => {
    const before = await ticketsIn(T.tenantId);
    for (const specs of [["良い文", "　 "], ["あ".repeat(201)], [5], Array.from({ length: 51 }, (_, i) => `文 ${i}`)]) {
      const r = await create(writer, body({ specs }));
      expect(r.status, JSON.stringify(specs).slice(0, 40)).toBe(422);
      expect(fieldsOf(await json(r)).some((x) => x.startsWith("specs"))).toBe(true);
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
    const t = await createOk(writer, body({ specs: ["あ".repeat(200), "同じ文", "同じ文"] }));
    expect((await specsOf(t["id"])).map((r) => r.title)).toEqual(["あ".repeat(200), "同じ文", "同じ文"]);
    const many = await createOk(writer, body({ specs: Array.from({ length: 50 }, (_, i) => `文 ${i}`) }));
    expect(await specsOf(many["id"])).toHaveLength(50);
  });

  it("K437-API-014 作るときはやり取りに更新の行を足さない（本文・項目・確認項目を付けて作っても kind change の行は 0）・知らせは担当者への 1 通のまま", async () => {
    const fld = await putField(T.tenantId, { name: "K437 行の確かめ", type: "short_text" });
    const t = await createOk(
      writer,
      body({ body: { doc: para("本文") }, fields: { [fld]: "値" }, specs: ["確認 1", "確認 2"] }),
    );
    expect(await changeLines(t["id"])).toBe(0);
    expect(
      await count(
        "select count(*) as n from notifications where tenant_id = $1 and payload->>'ticket_id' = $2 and event_kind_id = 'ticket.assigned'",
        [T.tenantId, String(t["id"])],
      ),
    ).toBe(1);
  });
});

describe("K-437 断り・守り・前からの決め", () => {
  it("K437-API-015 選べない選び先（種別が消えた・担当者が抜けた・知らせる人が抜けた）は 404・E-PAGE-001（欄なし）。何も作られない（本文・項目・確認項目も残らない）", async () => {
    const k = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_kinds (tenant_id, name) values ($1, '消す種別') returning id",
        [T.tenantId],
      )
    ).rows[0]!.id;
    await f.admin.query("update ticket_kinds set deleted_at = now() where id = $1", [k]);
    const left = await f.person(T.tenantId, T.rootScope, { name: "抜ける人", ticketAbility: "edit" });
    await f.admin.query("update members set status = 'left' where id = $1", [left.id]).catch(() => undefined);
    await f.admin.query("update members set deleted_at = now() where id = $1", [left.id]);
    const before = await ticketsIn(T.tenantId);
    const sections = await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId]);
    const specs = await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId]);
    const extra = { body: { doc: para("残らない") }, specs: ["残らない確認"] };
    for (const [label, over] of [
      ["種別", { kind_id: k }],
      ["担当者", { assignee_member_id: left.id }],
      ["知らせる人", { notify_member_ids: [left.id] }],
    ] as const) {
      const r = await create(writer, body({ ...over, ...extra }));
      gone(r.status, await json(r), label);
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
    expect(await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId])).toBe(sections);
    expect(await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId])).toBe(specs);
  });

  it("K437-API-016 別の会社の種別・担当者・知らせる人・親を直に：4 つとも 404・E-PAGE-001（欄なし・相手の名前を返さない）。何も作られない", async () => {
    const theirParent =
      (await f.admin.query<{ id: string }>("select id from tickets where tenant_id = $1 limit 1", [O.tenantId])).rows[0]
        ?.id ?? randomUUID();
    const before = await ticketsIn(T.tenantId);
    for (const over of [
      { kind_id: otherTask.id },
      { assignee_member_id: outsider.id },
      { notify_member_ids: [outsider.id] },
      { parent_ticket_id: theirParent },
    ]) {
      const r = await create(writer, body(over));
      const j = await json(r);
      gone(r.status, j, JSON.stringify(over));
      expect(JSON.stringify(j)).not.toContain("別の会社の人");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K437-API-017 親が 3 段目なら 409・E-VAL-015（欄なし）。2 段目までは 201", async () => {
    const root = await createOk(writer, body({ title: "根" }));
    const c1 = await createOk(writer, body({ title: "子", parent_ticket_id: root["id"] }));
    const c2 = await createOk(writer, body({ title: "孫", parent_ticket_id: c1["id"] }));
    const r = await create(writer, body({ title: "ひ孫", parent_ticket_id: c2["id"] }));
    conflict(r.status, await json(r), "E-VAL-015");
  });

  it("K437-API-018 作るときの担当者は書ける人なら誰でも指定できる（D-150.7）：見るだけの権限の人を担当者にしても 201・その人の受け箱に ticket.assigned が 1 つ", async () => {
    const t = await createOk(writer, body({ assignee_member_id: viewer.id }));
    expect(t["assignee_member_id"]).toBe(viewer.id);
    expect(
      await count(
        "select count(*) as n from notifications where tenant_id = $1 and payload->>'ticket_id' = $2 and event_kind_id = 'ticket.assigned'",
        [T.tenantId, String(t["id"])],
      ),
    ).toBe(1);
  });

  it("K437-API-019 見るだけの人・別の会社のグループ・ログインなしは 403・403・401。何も作られない", async () => {
    const before = await ticketsIn(T.tenantId);
    expect((await create(viewer)).status).toBe(403);
    expect((await create(outsider)).status).toBe(403);
    expect((await f.req("POST", "/tickets", { body: body() })).status).toBe(401);
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K437-API-020 正本と契約：createTicket の入力に body・fields・specs があり・題名の maxLength は口の TITLE_MAX と同じ・4xx に 404 E-PAGE-001・409 E-VAL-015・E-VAL-012・E-VAL-028・E-FLD-001〜004 があり 404 の E-VAL-014 は無い（正本の E-VAL-014 は残す。正本から消すのと画面の比べは K-442・PM 2026-11-24）（links は K-581・sections の残りは K-437-API-029）", async () => {
    const root = fileURLToPath(new URL("../../../../../", import.meta.url));
    const ep = JSON.parse(readFileSync(`${root}08_api/endpoints.json`, "utf8")) as unknown;
    const op = (JSON.stringify(ep).match(/"createTicket"[\s\S]{0,40000}/) ?? [""])[0];
    for (const code of [
      "E-PAGE-001",
      "E-VAL-015",
      "E-VAL-012",
      "E-VAL-028",
      "E-FLD-001",
      "E-FLD-002",
      "E-FLD-003",
      "E-FLD-004",
    ])
      expect(op, code).toContain(code);
    expect(op).not.toContain("E-VAL-014");
    const yaml = readFileSync(`${root}08_api/openapi.yaml`, "utf8");
    const m = /TicketCreateInput:[\s\S]*?(?=\n {4}[A-Z][A-Za-z]*:)/.exec(yaml)?.[0] ?? "";
    for (const k of ["body:", "fields:", "specs:"]) expect(m, k).toContain(k);
    expect(m).toContain(`maxLength: ${TITLE_MAX}`);
  });

  it("K437-API-021 失敗（手順 S1）：確認項目を書く所で DB が落ちる：503・E-PAGE-003・チケット・本文・項目の値・確認項目・受け箱の行が前のまま（全部戻る）", async () => {
    await f.admin.query(`create or replace function app.k437_fail1() returns trigger language plpgsql as $$ begin
      if new.title = '途中で落ちる確認' then raise exception 'k437 試験の失敗 1'; end if; return new; end $$`);
    await f.admin.query(
      "create trigger k437_fail1 before insert on test_specs for each row execute function app.k437_fail1()",
    );
    const fld = await putField(T.tenantId, { name: "K437 戻る項目", type: "short_text" });
    const before = {
      t: await ticketsIn(T.tenantId),
      s: await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId]),
      v: await count("select count(*) as n from ticket_field_values where tenant_id = $1", [T.tenantId]),
      n: await count("select count(*) as n from notifications where tenant_id = $1", [T.tenantId]),
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await create(
        writer,
        body({ body: { doc: para("戻る") }, fields: { [fld]: "戻る" }, specs: ["途中で落ちる確認"] }),
      );
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await f.admin.query("drop trigger k437_fail1 on test_specs");
      await f.admin.query("drop function app.k437_fail1()");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before.t);
    expect(await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId])).toBe(before.s);
    expect(await count("select count(*) as n from ticket_field_values where tenant_id = $1", [T.tenantId])).toBe(
      before.v,
    );
    expect(await count("select count(*) as n from notifications where tenant_id = $1", [T.tenantId])).toBe(before.n);
  });

  it("K437-API-022 失敗（手順 S2）：担当者への受け箱の行を書く所で DB が落ちる：503・E-PAGE-003・書いたはずの本文・項目の値・確認項目も残らない", async () => {
    await f.admin.query(`create or replace function app.k437_fail2() returns trigger language plpgsql as $$ begin
      if new.event_kind_id = 'ticket.assigned' and new.payload->>'title' = '知らせで落ちる' then raise exception 'k437 試験の失敗 2'; end if; return new; end $$`);
    await f.admin.query(
      "create trigger k437_fail2 before insert on notifications for each row execute function app.k437_fail2()",
    );
    const before = {
      t: await ticketsIn(T.tenantId),
      sp: await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId]),
      s: await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId]),
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await create(
        writer,
        body({ title: "知らせで落ちる", body: { doc: para("戻る") }, specs: ["戻る確認"] }),
      );
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await f.admin.query("drop trigger k437_fail2 on notifications");
      await f.admin.query("drop function app.k437_fail2()");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before.t);
    expect(await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId])).toBe(before.sp);
    expect(await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId])).toBe(before.s);
  });

  it("K437-API-023 二度押し（同じ冪等キー）：2 回とも 201・同じ id・本文の行は 1 つ・確認項目は 1 回分だけ", async () => {
    const key = { "idempotency-key": randomUUID() };
    const b = body({ body: { doc: para("二度押し") }, specs: ["確認 A", "確認 B"] });
    const r1 = await create(writer, b, key);
    const r2 = await create(writer, b, key);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    const id = ((await json(r1)).data as Record<string, unknown>)["id"];
    expect(((await json(r2)).data as Record<string, unknown>)["id"]).toBe(id);
    expect(await bodyRow(id)).toHaveLength(1);
    expect(await specsOf(id)).toHaveLength(2);
  });

  it("K437-API-024 同時に 2 人が作る：どちらも 201・番号が違う・それぞれに本文と確認項目が 1 回ずつ", async () => {
    const [a, b] = await Promise.all([
      create(writer, body({ title: "同時 1", body: { doc: para("1") }, specs: ["確認 1"] })),
      create(mate, body({ title: "同時 2", body: { doc: para("2") }, specs: ["確認 2"] })),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const ta = (await json(a)).data as Record<string, unknown>;
    const tb = (await json(b)).data as Record<string, unknown>;
    expect(ta["number"]).not.toBe(tb["number"]);
    for (const [t, n] of [
      [ta, "確認 1"],
      [tb, "確認 2"],
    ] as const) {
      expect((await specsOf(t["id"])).map((r) => r.title)).toEqual([n]);
      expect(await bodyRow(t["id"])).toHaveLength(1);
    }
  });

  it("K437-API-025 ログに題名・本文・項目の値・確認項目の文が出ない（成功も断りも）", async () => {
    const fld = await putField(T.tenantId, { name: "K437 ログの項目", type: "short_text" });
    const logs: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" "))),
    );
    try {
      await createOk(
        writer,
        body({
          title: "ログに出ない題名",
          body: { doc: para("ログに出ない本文") },
          fields: { [fld]: "ログに出ない値" },
          specs: ["ログに出ない確認"],
        }),
      );
      await create(writer, body({ title: "ログに出ない題名", due_on: jst(-3) }));
    } finally {
      for (const s of spies) s.mockRestore();
    }
    expect(logs.join("\n")).not.toMatch(/ログに出ない/);
  });

  it("K437-API-026 行の守り：アプリの役は本文・項目の値・確認項目の行を作る内側の関数を直に呼べない（作る関数 app.ticket_create だけが実行できる）", async () => {
    const can = async (sig: string) =>
      (await f.admin.query<{ ok: boolean }>("select has_function_privilege('kaname_app', $1, 'execute') as ok", [sig]))
        .rows[0]!.ok;
    expect(await can("app.ticket_create(jsonb)")).toBe(true);
    const inner = (
      await f.admin.query<{ sig: string }>(
        "select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname in ('ticket_default_specs_copy')",
      )
    ).rows;
    expect(inner).toHaveLength(0);
  });
  it("K437-API-031 開始 start_on が暦に無い日（0000-00-00・2026-02-30）は 422・欄 start_on・何も作られない／空の文字は 201・開始は null。契約の start_on の値域は anyOf [{maxLength: 0}, {format: date}]（期限と同じ format: date）", async () => {
    const before = await ticketsIn(T.tenantId);
    for (const start_on of ["0000-00-00", "2026-02-30"]) {
      const r = await create(writer, body({ start_on }));
      expect(r.status, start_on).toBe(422);
      expect(fieldsOf(await json(r)), start_on).toContain("start_on");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
    const t = await createOk(writer, body({ start_on: "" }));
    const rows = (
      await f.admin.query<{ start_on: string | null }>("select start_on::text as start_on from tickets where id = $1", [
        t["id"],
      ])
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.start_on).toBeNull();
    const root = fileURLToPath(new URL("../../../../../", import.meta.url));
    const yaml = readFileSync(`${root}08_api/openapi.yaml`, "utf8");
    const input = /TicketCreateInput:[\s\S]*?(?=\n {4}[A-Z][A-Za-z]*:)/.exec(yaml)?.[0] ?? "";
    const start = /\n {8}start_on:[\s\S]*?(?=\n {8}[a-z_]+:)/.exec(input)?.[0] ?? "";
    expect(start).toMatch(/anyOf:\n\s+- maxLength: 0\n\s+- format: date/);
  });
});
