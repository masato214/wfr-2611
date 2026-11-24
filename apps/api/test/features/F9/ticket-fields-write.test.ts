// K-706「項目のマスタを読む口（listTicketFieldMaster）と、項目を足す口（createTicketField）」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K706-API-… / K706-DB-…）は 11_tickets/K-706.md の表の行に 1 対 1 で結ぶ。直す・並べる・消すは K-717（ticket-fields-edit.test.ts）。
// テストはチケットを作る人が書き、実装する人は変えない。実装の前に流して赤を確かめない。
//
// 試験が決める口の形（設計は 07_functional/段10-F9/土台-settings.md。契約は 05_flow/screen_api.d/K-706.py で作る）:
//   listTicketFieldMaster GET  /api/v1/ticket-field-master  200 { data: TicketFieldSetting[] }（edit の権限を持つ人だけ。メンバーが読む口は段 5 の listTicketFields のまま）
//   createTicketField     POST /api/v1/ticket-fields        { name, field_type, kind_ids, required?, description?, options? }  201 { data: TicketFieldSetting }
//   TicketFieldSetting = 段 5 の TicketField の鍵 7（id・name・field_type・required・description・options・position）＋ kind_ids・all_kinds・value_count（鍵ちょうど 10）
//   options（入力）は [{ id?, name }]（選ぶ型だけ・1 つ以上）。答えは [{ id, name, position }]。kind_ids は 1 つ以上の種別。保存すると明示の行になり all_kinds は false
//   断る：形の誤り 422／無い・見えない 404 E-PAGE-001／同じ名前 409 E-FMS-001／同じ名前の選ぶ物 409 E-FMS-004／権限なし 403／ログインなし 401／上限 429／DB の失敗 503 E-PAGE-003
// DB（migration 20261125014600_ticket_field_master.sql）: app.ticket_field_settings（読む）・app.ticket_field_create（security definer・答えは jsonb。断りは { error: <言葉> }）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { isFlat, startSettings, type Json, type Settings, type World } from "./settings.harness.js";

const KEYS = [
  "all_kinds",
  "description",
  "field_type",
  "id",
  "kind_ids",
  "name",
  "options",
  "position",
  "required",
  "value_count",
];
interface Opt {
  id: string;
  name: string;
  position: number;
}
interface Field {
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  description: string | null;
  options: Opt[];
  position: number;
  kind_ids: string[];
  all_kinds: boolean;
  value_count: number;
}
let s: Settings;
let B: World;
beforeAll(async () => {
  s = await startSettings(["ticket-fields-read", "ticket-fields-write"]);
  await s.world("設定 項目 A"); // 別の会社 A も在る形で流す（A の物は読まない）
  B = await s.world("設定 項目 B");
});
afterAll(async () => {
  await s.close();
});
const create = (w: World, body: unknown, who = w.admin) => s.call(who, "POST", "/ticket-fields", body);
const master = async (w: World): Promise<Field[]> => {
  const r = await s.call(w.admin, "GET", "/ticket-field-master");
  if (r.status !== 200) throw new Error(`GET /ticket-field-master が ${r.status}`);
  return ((await s.json(r)).data ?? []) as Field[];
};
const made = async (r: Response): Promise<Field> => ((await s.json(r)).data ?? {}) as Field;
const code = async (r: Response): Promise<unknown> => (await s.json(r))["code"];
const fresh = async (): Promise<World & { kinds: string[] }> => {
  const w = await s.world("設定 項目 一時");
  return { ...w, kinds: [await s.kindId(w, "タスク"), await s.kindId(w, "課題")] };
};
const ctxOf = (w: World, p = w.admin): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
const ofKind = async (w: World, kindId: string): Promise<Field[]> =>
  ((await s.json(await s.call(w.member, "GET", `/ticket-fields?kind_id=${kindId}`))).data ?? []) as Field[];
const seedField = (w: World, name: string, kindIds: string[] = []) =>
  s.f.admin
    .query<{ id: string }>(
      "insert into custom_fields (tenant_id, name, field_type, position) values ($1, $2, 'short_text', 5) returning id",
      [w.tenantId, name],
    )
    .then(async (r) => {
      for (const k of kindIds)
        await s.f.admin.query("insert into custom_field_kinds (tenant_id, field_id, kind_id) values ($1, $2, $3)", [
          w.tenantId,
          r.rows[0]!.id,
          k,
        ]);
      return r.rows[0]!.id;
    });
const value = (w: World, ticketId: string, fieldId: string, deleted = false) =>
  s.f.admin.query(
    "insert into ticket_field_values (tenant_id, ticket_id, field_id, value, deleted_at) values ($1, $2, $3, to_jsonb('x'::text), $4)",
    [w.tenantId, ticketId, fieldId, deleted ? new Date().toISOString() : null],
  );

const liveKinds = async (w: World): Promise<string[]> =>
  (
    await s.f.admin.query<{ id: string }>("select id from ticket_kinds where tenant_id = $1 and deleted_at is null", [
      w.tenantId,
    ])
  ).rows.map((r) => r.id);

describe("項目のマスタを読む", () => {
  it("K706-API-001 読む：鍵ちょうど 10・並びの順・値の数は消していない値だけ・行が無い項目は all_kinds が true で全部の種別・消した項目と別の会社の項目は出ない・項目が 0 件の会社は状態 200・data []", async () => {
    const w = await fresh();
    const a = await seedField(w, "前からの項目");
    const b = await seedField(w, "種別つき", [w.kinds[0]!]);
    const gone = await seedField(w, "消した項目");
    await s.f.admin.query("update custom_fields set deleted_at = now() where id = $1", [gone]);
    await seedField(B, "別の会社の項目");
    const t = await s.ticket(w);
    await value(w, t, b);
    await value(w, await s.ticket(w), b, true);
    const rows = await master(w);
    expect(rows.every((r) => Object.keys(r).sort().join() === KEYS.join())).toBe(true);
    expect(rows.map((r) => r.id).sort()).toEqual([a, b].sort());
    const [ra, rb] = [rows.find((r) => r.id === a)!, rows.find((r) => r.id === b)!];
    expect(ra).toMatchObject({ all_kinds: true, value_count: 0 });
    expect([...ra.kind_ids].sort()).toEqual((await liveKinds(w)).sort());
    expect(rb).toMatchObject({ all_kinds: false, kind_ids: [w.kinds[0]], value_count: 1 });
    const none = await fresh();
    const r0 = await s.call(none.admin, "GET", "/ticket-field-master");
    expect(r0.status).toBe(200);
    expect((await s.json(r0)).data).toEqual([]);
  });
});

describe("項目を足す", () => {
  it("K706-API-002 足す：201・鍵ちょうど 10・並びは最後・種別は明示・読み直すと出て、段 5 の読む口（種別を指す）はその種別だけに出す", async () => {
    const w = await fresh();
    const r = await create(w, {
      name: "請求額",
      field_type: "number",
      kind_ids: [w.kinds[0]],
      required: true,
      description: "税抜き",
    });
    expect(r.status).toBe(201);
    const d = await made(r);
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({
      name: "請求額",
      field_type: "number",
      required: true,
      description: "税抜き",
      options: [],
      all_kinds: false,
      kind_ids: [w.kinds[0]],
      value_count: 0,
    });
    expect((await master(w)).some((x) => x.id === d.id)).toBe(true);
    expect((await ofKind(w, w.kinds[0]!)).some((x) => x.id === d.id)).toBe(true);
    expect((await ofKind(w, w.kinds[1]!)).some((x) => x.id === d.id)).toBe(false);
    const second = await made(await create(w, { name: "二つ目", field_type: "date", kind_ids: w.kinds }));
    expect(second.position).toBeGreaterThan(d.position);
  });
  it("K706-API-003 選ぶ型：選択肢に id と並び（1 から）が付き、段 5 の読む口にも同じ id・順で出る", async () => {
    const w = await fresh();
    for (const field_type of ["select", "multi_select"]) {
      const d = await made(
        await create(w, {
          name: `選ぶ ${field_type}`,
          field_type,
          kind_ids: w.kinds,
          options: [{ name: "経理" }, { name: "営業" }, { name: "開発" }],
        }),
      );
      expect(d.options.map((o) => [o.name, o.position])).toEqual([
        ["経理", 1],
        ["営業", 2],
        ["開発", 3],
      ]);
      expect(new Set(d.options.map((o) => o.id)).size).toBe(3);
      expect((await ofKind(w, w.kinds[0]!)).find((x) => x.id === d.id)!.options).toEqual(d.options);
    }
  });
  it("K706-API-004 形：名前（前後の空白は落とす・空白だけ・41 字・NUL・無い）・型（7 つの外）・必須（真偽でない）は 422（欄つき）・説明が空白だけなら null・40 字は通る・前後に全角空白を付けた 40 字も通る（落とした後の長さで数える）", async () => {
    const w = await fresh();
    const ok = await made(
      await create(w, { name: "　四十　", field_type: "short_text", kind_ids: w.kinds, description: " 　" }),
    );
    expect(ok).toMatchObject({ name: "四十", description: null });
    const bad: [Record<string, unknown>, string][] = [
      [{ name: "　 ", field_type: "short_text" }, "name"],
      [{ name: "あ".repeat(41), field_type: "short_text" }, "name"],
      [{ name: "あ\u0000い", field_type: "short_text" }, "name"],
      [{ field_type: "short_text" }, "name"],
      [{ name: "型違い", field_type: "table" }, "field_type"],
      [{ name: "型なし" }, "field_type"],
      [{ name: "必須違い", field_type: "number", required: "はい" }, "required"],
    ];
    for (const [b, field] of bad) {
      const r = await create(w, { kind_ids: w.kinds, ...b });
      expect(r.status, JSON.stringify(b)).toBe(422);
      expect(JSON.stringify((await s.json(r)).details)).toContain(field);
    }
    expect((await create(w, { name: "字".repeat(40), field_type: "date", kind_ids: w.kinds })).status).toBe(201);
    const padded = await create(w, { name: `\u3000${"あ".repeat(40)}\u3000`, field_type: "date", kind_ids: w.kinds });
    expect(padded.status).toBe(201);
    expect((await made(padded)).name).toBe("あ".repeat(40));
  });
  it("K706-API-005 選ぶ物と種別の形：選ぶ型で選ぶ物が無い・選ばない型に選ぶ物が在る・選ぶ物の名前が空・種別が空・uuid でない は 422", async () => {
    const w = await fresh();
    const bad: [Record<string, unknown>, string][] = [
      [{ name: "a", field_type: "select" }, "options"],
      [{ name: "b", field_type: "select", options: [] }, "options"],
      [{ name: "c", field_type: "number", options: [{ name: "x" }] }, "options"],
      [{ name: "d", field_type: "multi_select", options: [{ name: "　" }] }, "options"],
      [{ name: "e", field_type: "number", kind_ids: [] }, "kind_ids"],
      [{ name: "f", field_type: "number", kind_ids: ["x"] }, "kind_ids"],
      [{ name: "g", field_type: "number", kind_ids: undefined }, "kind_ids"],
    ];
    for (const [b, field] of bad) {
      const r = await create(w, { kind_ids: w.kinds, ...b });
      expect(r.status, JSON.stringify(b)).toBe(422);
      expect(JSON.stringify((await s.json(r)).details)).toContain(field);
    }
    expect(await s.n("select count(*) n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(0);
  });
  it("K706-API-006 同じ名前の選ぶ物が 1 つの項目に 2 つあれば 409 E-FMS-004（欄なし）・項目は足されない", async () => {
    const w = await fresh();
    const r = await create(w, {
      name: "かぶり",
      field_type: "select",
      kind_ids: w.kinds,
      options: [{ name: "経理" }, { name: "経理" }],
    });
    expect(r.status).toBe(409);
    const b = await s.json(r);
    expect(b["code"]).toBe("E-FMS-004");
    expect(isFlat(b)).toBe(true);
    expect(await s.n("select count(*) n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(0);
  });
  it("K706-API-007 種別が無い・消した・別の会社なら 404 E-PAGE-001（欄・details なし）・項目は足されない", async () => {
    const w = await fresh();
    const gone = await s.newKind(w, "消す予定");
    await s.f.admin.query("update ticket_kinds set deleted_at = now() where id = $1", [gone]);
    for (const k of [gone, await s.kindId(B, "タスク"), "00000000-0000-4000-8000-000000000000"]) {
      const r = await create(w, { name: "種別違い", field_type: "number", kind_ids: [w.kinds[0], k] });
      expect(r.status, k).toBe(404);
      const b = await s.json(r);
      expect(b["code"]).toBe("E-PAGE-001");
      expect(isFlat(b)).toBe(true);
    }
    expect(await s.n("select count(*) n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(0);
  });
  it("K706-API-008 同じ名前は 409 E-FMS-001（欄なし）・別の会社は混ざらない", async () => {
    const w = await fresh();
    const body = { name: "重複", field_type: "short_text", kind_ids: w.kinds };
    await create(w, body);
    const dup = await create(w, body);
    expect(dup.status).toBe(409);
    const b = await s.json(dup);
    expect(b["code"]).toBe("E-FMS-001");
    expect(isFlat(b)).toBe(true);
    expect((await create(B, { ...body, kind_ids: [await s.kindId(B, "タスク")] })).status).toBe(201);
  });
});

describe("守り・記録・失敗", () => {
  it("K706-API-009 権限が無い人は足す・読むが 403・何も変わらない／ログインなしは 401", async () => {
    const w = await fresh();
    const r1 = await create(w, { name: "権限なし", field_type: "date", kind_ids: w.kinds }, w.member);
    const r2 = await s.call(w.member, "GET", "/ticket-field-master");
    expect([r1.status, r2.status]).toEqual([403, 403]);
    expect(await master(w)).toEqual([]);
    expect((await s.call(null, "GET", "/ticket-field-master")).status).toBe(401);
    expect(
      (await s.call(null, "POST", "/ticket-fields", { name: "x", field_type: "date", kind_ids: w.kinds })).status,
    ).toBe(401);
  });
  it("K706-API-010 1 分あたりの上限を超えた書きは 429・retry_after_sec が数", async () => {
    s.f.limits["createTicketField"] = 2;
    const w = await fresh();
    const ip = "198.51.100.79";
    const hit = () =>
      s.f.req("POST", "/ticket-fields", {
        headers: w.admin.auth,
        ip,
        body: { name: `n${Math.random()}`.slice(0, 20), field_type: "date", kind_ids: w.kinds },
      });
    await hit();
    await hit();
    const r = await hit();
    delete s.f.limits["createTicketField"];
    expect(r.status).toBe(429);
    expect(typeof ((await s.json(r)) as Json)["retry_after_sec"]).toBe("number");
  });
  it("K706-API-011 手順 1・2：足すと証跡が 1 行・会社・操作した人・C2・対象の項目つき（失敗した足すには残らない）", async () => {
    const w = await fresh();
    const where = "tenant_id = $1 and target_type = 'custom_fields'";
    const id = (await made(await create(w, { name: "証跡", field_type: "date", kind_ids: w.kinds }))).id;
    await create(w, { name: "", field_type: "date", kind_ids: w.kinds });
    const rows = (
      await s.f.admin.query<{ action: string; actor_member_id: string; choke_point_id: string; target_id: string }>(
        `select action, actor_member_id, choke_point_id, target_id from audit_events where ${where} order by occurred_at, id`,
        [w.tenantId],
      )
    ).rows;
    expect(rows.map((r) => r.action)).toEqual(["custom_field.create"]);
    expect(rows[0]).toMatchObject({ actor_member_id: w.admin.id, choke_point_id: "C2", target_id: id });
  });
  it("K706-API-012 失敗（手順 1）：項目の行を書く所で DB が落ちる → 503 E-PAGE-003・項目も証跡も増えない", async () => {
    const w = await fresh();
    const fix = await s.breakWrites("custom_fields");
    try {
      const r = await create(w, { name: "落ちる", field_type: "date", kind_ids: w.kinds });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(await master(w)).toEqual([]);
    expect(await s.n("select count(*) n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(0);
    expect(
      await s.n("select count(*) n from audit_events where tenant_id = $1 and target_type = 'custom_fields'", [
        w.tenantId,
      ]),
    ).toBe(0);
  });
  it("K706-API-013 失敗（手順 2）：証跡を書く所で DB が落ちる → 503 E-PAGE-003・項目の行も種別の行も増えない", async () => {
    const w = await fresh();
    const fix = await s.breakWrites("audit_events");
    try {
      const r = await create(w, { name: "証跡で落ちる", field_type: "date", kind_ids: w.kinds });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(await master(w)).toEqual([]);
    expect(await s.n("select count(*) n from custom_field_kinds where tenant_id = $1", [w.tenantId])).toBe(0);
  });
});

describe("DB の守り", () => {
  it("K706-DB-001 関数の守り：edit の権限が無い人が関数を直に呼んでも { error: forbidden } で何も書かない／権限のある人は書ける", async () => {
    const w = await fresh();
    const call = (p: typeof w.member) =>
      withTenant(
        s.f.pool,
        ctxOf(w, p),
        async (c) =>
          (
            await c.query("select app.ticket_field_create($1, $2, '[]'::jsonb, false, null, $3::uuid[]) r", [
              "関数で足す",
              "date",
              w.kinds,
            ])
          ).rows[0]!.r as { error?: string },
      );
    expect(await call(w.member)).toMatchObject({ error: "forbidden" });
    expect(await s.n("select count(*) n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(0);
    expect((await call(w.admin)).error).toBeUndefined();
    expect(await s.n("select count(*) n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(1);
  });
});
