// K-717「項目を直す・並べる・消す」の単体の試験（口と DB・本物の Postgres）。足す・マスタを読むは K-706（ticket-fields-write.test.ts）。
// テストの名前の頭の行 ID（K717-API-… / K717-DB-…）は 11_tickets/K-717.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない。実装の前に流して赤を確かめない。
//
// 試験が決める口の形（設計は 07_functional/段10-F9/土台-settings.md。契約は 05_flow/screen_api.d/K-717.py で作る。TicketFieldSetting は K-706 の物）:
//   updateTicketField   PATCH  /api/v1/ticket-fields/:id   { name?, field_type?, required?, description?, options?, kind_ids? }  200 { data: TicketFieldSetting }
//   deleteTicketField   DELETE /api/v1/ticket-fields/:id                                      200 { data: { id } }
//   reorderTicketFields POST   /api/v1/ticket-fields/order { field_ids: uuid[] }               200 { data: TicketFieldSetting[] }
//   options は [{ id?, name }]（id を付けた物は今の選択肢のまま名前を変え、付けない物は新しい選択肢）。値が入っている間は型を変えられない
//   断る：形の誤り 422／無い・見えない（項目・種別・選択肢）404 E-PAGE-001／同じ名前 409 E-FMS-001／型 409 E-FMS-002／並び 409 E-FMS-003／同じ名前の選ぶ物 409 E-FMS-004／
//         選ぶ型でない項目に選ぶ物 409 E-FMS-005／権限なし 403／ログインなし 401／DB の失敗 503 E-PAGE-003
// DB（migration 20261125015700_ticket_field_edit.sql）: app.ticket_field_update / delete / reorder（security definer・答えは jsonb。断りは { error: <言葉> }）
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isFlat, startSettings, type Settings, type World } from "./settings.harness.js";

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
  s = await startSettings(["ticket-fields-read", "ticket-fields-write", "ticket-fields-edit"]);
  await s.world("設定 項目 A"); // 別の会社 A も在る形で流す（A の物は読まない）
  B = await s.world("設定 項目 B");
});
afterAll(async () => {
  await s.close();
});
const create = (w: World, body: unknown, who = w.admin) => s.call(who, "POST", "/ticket-fields", body);
const update = (w: World, id: string, body: unknown, who = w.admin) =>
  s.call(who, "PATCH", `/ticket-fields/${id}`, body);
const del = (w: World, id: string, who = w.admin) => s.call(who, "DELETE", `/ticket-fields/${id}`);
const order = (w: World, ids: string[], who = w.admin) =>
  s.call(who, "POST", "/ticket-fields/order", { field_ids: ids });
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

describe("項目を直す", () => {
  it("K717-API-001 直す：名前・必須・説明・種別が変わり、読み直しと段 5 の読む口で同じ・外した種別には出なくなり足した種別には出る・送らない物は変わらない", async () => {
    const w = await fresh();
    const d = await made(
      await create(w, { name: "直す前", field_type: "number", kind_ids: [w.kinds[0]], description: "前の説明" }),
    );
    const r = await update(w, d.id, { name: "直した後", required: true, kind_ids: [w.kinds[1]] });
    expect(r.status).toBe(200);
    expect(Object.keys(await made(r)).sort()).toEqual(KEYS);
    expect((await master(w)).find((x) => x.id === d.id)).toMatchObject({
      name: "直した後",
      required: true,
      description: "前の説明",
      kind_ids: [w.kinds[1]],
      all_kinds: false,
    });
    expect((await ofKind(w, w.kinds[0]!)).some((x) => x.id === d.id)).toBe(false);
    expect((await ofKind(w, w.kinds[1]!)).some((x) => x.id === d.id)).toBe(true);
    await update(w, d.id, { description: null });
    expect((await master(w)).find((x) => x.id === d.id)!.description).toBeNull();
  });
  it("K717-API-002 選ぶ物を直す：id を付けた物は同じ選択肢のまま名前が変わる・付けない物は新しい選択肢・送らなかった物は外れる・並びは送った順・知らない id は 404", async () => {
    const w = await fresh();
    const d = await made(
      await create(w, {
        name: "分類",
        field_type: "multi_select",
        kind_ids: w.kinds,
        options: [{ name: "経理" }, { name: "営業" }, { name: "開発" }],
      }),
    );
    const [keep, , drop] = d.options;
    const r = await update(w, d.id, {
      options: [{ id: drop!.id, name: "開発部" }, { name: "総務" }, { id: keep!.id, name: "経理" }],
    });
    expect(r.status).toBe(200);
    const got = (await made(r)).options;
    expect(got.map((o) => [o.name, o.position])).toEqual([
      ["開発部", 1],
      ["総務", 2],
      ["経理", 3],
    ]);
    expect(got[0]!.id).toBe(drop!.id);
    expect(got[2]!.id).toBe(keep!.id);
    expect(got.some((o) => o.name === "営業")).toBe(false);
    const bad = await update(w, d.id, { options: [{ id: randomUUID(), name: "知らない" }] });
    expect(bad.status).toBe(404);
    expect(await code(bad)).toBe("E-PAGE-001");
  });
  it("K717-API-003 空の体は 422・無い・消した・別の会社の項目は 404 E-PAGE-001（欄・details なし）・uuid でない道は 422", async () => {
    const w = await fresh();
    const d = await made(await create(w, { name: "あり", field_type: "date", kind_ids: w.kinds }));
    expect((await update(w, d.id, {})).status).toBe(422);
    const gone = await made(await create(w, { name: "消す予定", field_type: "date", kind_ids: w.kinds }));
    await del(w, gone.id);
    const foreign = await seedField(B, "別の会社の項目 2");
    for (const id of [gone.id, foreign, "00000000-0000-4000-8000-000000000000"]) {
      for (const r of [await update(w, id, { name: "x" }), await del(w, id)]) {
        expect(r.status, id).toBe(404);
        const b = await s.json(r);
        expect(b["code"]).toBe("E-PAGE-001");
        expect(isFlat(b)).toBe(true);
      }
    }
    expect((await update(w, "not-a-uuid", { name: "x" })).status).toBe(422);
  });
  it("K717-API-004 型を変える：値が 1 つも無ければ変えられ（選ぶ型 → ほかで選ぶ物は消える・ほかの型 → 選ぶ型は選ぶ物が要る）、値が 1 つでも在れば 409 E-FMS-002・同じ型の送りは通る", async () => {
    const w = await fresh();
    const d = await made(
      await create(w, { name: "型", field_type: "select", kind_ids: w.kinds, options: [{ name: "a" }] }),
    );
    const to = await made(await update(w, d.id, { field_type: "short_text" }));
    expect(to).toMatchObject({ field_type: "short_text", options: [] });
    expect((await update(w, d.id, { field_type: "select" })).status).toBe(422);
    expect((await update(w, d.id, { field_type: "select", options: [{ name: "b" }] })).status).toBe(200);
    await value(w, await s.ticket(w), d.id);
    const r = await update(w, d.id, { field_type: "number" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("E-FMS-002");
    expect((await master(w)).find((x) => x.id === d.id)).toMatchObject({ field_type: "select", value_count: 1 });
    expect((await update(w, d.id, { field_type: "select", required: true })).status).toBe(200);
  });
  it("K717-API-005 選ぶ型でない項目に選ぶ物だけを送ると 409 E-FMS-005（欄なし・何も変わらない）・選ぶ型の選ぶ物を空にする送りは 422（欄 options）", async () => {
    const w = await fresh();
    const num = await made(await create(w, { name: "数", field_type: "number", kind_ids: w.kinds }));
    const sel = await made(
      await create(w, { name: "選ぶ", field_type: "select", kind_ids: w.kinds, options: [{ name: "a" }] }),
    );
    const r = await update(w, num.id, { options: [{ name: "x" }] });
    expect(r.status).toBe(409);
    const b = await s.json(r);
    expect(b["code"]).toBe("E-FMS-005");
    expect(isFlat(b)).toBe(true);
    expect((await master(w)).find((x) => x.id === num.id)!.options).toEqual([]);
    const empty = await update(w, sel.id, { options: [] });
    expect(empty.status).toBe(422);
    expect(JSON.stringify((await s.json(empty)).details)).toContain("options");
  });
  it("K717-API-014 直す：ほかの項目と同じ名前（前後に全角空白・タブがあっても）は 409 E-FMS-001（欄なし・何も変わらない）・自分自身の名前への直しは通る", async () => {
    const w = await fresh();
    const a = await made(await create(w, { name: "先の項目", field_type: "date", kind_ids: w.kinds }));
    const b = await made(await create(w, { name: "後の項目", field_type: "date", kind_ids: w.kinds }));
    for (const name of ["先の項目", "　先の項目\t", " 先の項目 "]) {
      const r = await update(w, b.id, { name });
      expect(r.status, name).toBe(409);
      const body = await s.json(r);
      expect(body["code"]).toBe("E-FMS-001");
      expect(isFlat(body)).toBe(true);
    }
    expect((await master(w)).find((x) => x.id === b.id)!.name).toBe("後の項目");
    const self = await update(w, a.id, { name: "　先の項目　", required: true });
    expect(self.status).toBe(200);
    expect(await made(self)).toMatchObject({ name: "先の項目", required: true });
  });
  it("K717-API-015 直す：選ぶ物の名前が 1 つの項目の中で重なると 409 E-FMS-004（欄なし・何も変わらない）", async () => {
    const w = await fresh();
    const d = await made(
      await create(w, { name: "重なり", field_type: "select", kind_ids: w.kinds, options: [{ name: "経理" }] }),
    );
    const r = await update(w, d.id, { options: [{ name: "営業" }, { name: "　営業　" }] });
    expect(r.status).toBe(409);
    const body = await s.json(r);
    expect(body["code"]).toBe("E-FMS-004");
    expect(isFlat(body)).toBe(true);
    expect((await master(w)).find((x) => x.id === d.id)!.options.map((o) => o.name)).toEqual(["経理"]);
  });
  it("K717-API-016 直す：kind_ids に無い・消した・別の会社の種別を入れると 404 E-PAGE-001（欄・details なし）・何も変わらない", async () => {
    const w = await fresh();
    const d = await made(await create(w, { name: "種別違い", field_type: "date", kind_ids: [w.kinds[0]] }));
    const gone = await s.newKind(w, "消す予定");
    await s.f.admin.query("update ticket_kinds set deleted_at = now() where id = $1", [gone]);
    for (const k of [gone, await s.kindId(B, "タスク"), randomUUID()]) {
      const r = await update(w, d.id, { kind_ids: [w.kinds[1], k] });
      expect(r.status, k).toBe(404);
      const body = await s.json(r);
      expect(body["code"]).toBe("E-PAGE-001");
      expect(isFlat(body)).toBe(true);
    }
    expect((await master(w)).find((x) => x.id === d.id)).toMatchObject({ kind_ids: [w.kinds[0]], all_kinds: false });
  });
});

describe("項目を消す・並べる", () => {
  it("K717-API-006 消す：値が入っていても消せる・読みから消え、値の行は残る（見えなくなるだけ）・名前を使い回せる・答えは id だけ", async () => {
    const w = await fresh();
    const d = await made(await create(w, { name: "消す", field_type: "short_text", kind_ids: w.kinds }));
    await value(w, await s.ticket(w), d.id);
    const r = await del(w, d.id);
    expect(r.status).toBe(200);
    expect(((await s.json(r)).data as { id: string }).id).toBe(d.id);
    expect((await master(w)).some((x) => x.id === d.id)).toBe(false);
    expect((await ofKind(w, w.kinds[0]!)).some((x) => x.id === d.id)).toBe(false);
    expect(
      await s.n("select count(*) n from ticket_field_values where field_id = $1 and deleted_at is null", [d.id]),
    ).toBe(1);
    expect((await create(w, { name: "消す", field_type: "short_text", kind_ids: w.kinds })).status).toBe(201);
  });
  it("K717-API-007 並べる：渡した順になり読み直しも同じ・答えは全部の項目", async () => {
    const w = await fresh();
    const made3 = [];
    for (const n of ["一", "二", "三"])
      made3.push((await made(await create(w, { name: n, field_type: "date", kind_ids: w.kinds }))).id);
    const next = [...made3].reverse();
    const r = await order(w, next);
    expect(r.status).toBe(200);
    expect((((await s.json(r)).data ?? []) as Field[]).map((x) => x.id)).toEqual(next);
    expect((await master(w)).map((x) => x.id)).toEqual(next);
  });
  it("K717-API-008 並びが今と合わない（足りない・余る・重なる・消した項目・別の会社の項目）は 409 E-FMS-003・何も変わらない・uuid でない要素・空は 422", async () => {
    const w = await fresh();
    const a = await made(await create(w, { name: "並べ 1", field_type: "date", kind_ids: w.kinds }));
    const b = await made(await create(w, { name: "並べ 2", field_type: "date", kind_ids: w.kinds }));
    const gone = await made(await create(w, { name: "並べ 3", field_type: "date", kind_ids: w.kinds }));
    await del(w, gone.id);
    const foreign = await seedField(B, "別の会社の項目 3");
    const before = (await master(w)).map((x) => x.id);
    for (const ids of [
      [a.id],
      [a.id, b.id, randomUUID()],
      [a.id, a.id, b.id],
      [a.id, b.id, gone.id],
      [a.id, b.id, foreign],
    ]) {
      const r = await order(w, ids);
      expect(r.status).toBe(409);
      expect(await code(r)).toBe("E-FMS-003");
    }
    expect((await master(w)).map((x) => x.id)).toEqual(before);
    expect((await order(w, ["x"])).status).toBe(422);
    expect((await order(w, [])).status).toBe(422);
  });
});

describe("守り・記録・失敗", () => {
  it("K717-API-009 権限が無い人は直す・消す・並べるが 403・何も変わらない／ログインなしは 401", async () => {
    const w = await fresh();
    const d = await made(await create(w, { name: "守り", field_type: "date", kind_ids: w.kinds }));
    const rs = [
      await update(w, d.id, { name: "権限なし" }, w.member),
      await del(w, d.id, w.member),
      await order(w, [d.id], w.member),
    ];
    for (const r of rs) expect(r.status).toBe(403);
    expect((await master(w)).map((x) => x.name)).toEqual(["守り"]);
    expect((await s.call(null, "PATCH", `/ticket-fields/${d.id}`, { name: "x" })).status).toBe(401);
  });
  it("K717-API-010 別の会社の管理者は触れない：相手の項目は 404（直す・消す）・並びに混ぜると 409・自分の読みに相手の項目は出ない", async () => {
    const w = await fresh();
    const mine = await made(await create(w, { name: "自分の", field_type: "date", kind_ids: w.kinds }));
    const theirs = await seedField(B, "相手の項目");
    expect((await update(w, theirs, { name: "のっとり" })).status).toBe(404);
    expect((await del(w, theirs)).status).toBe(404);
    expect((await order(w, [mine.id, theirs])).status).toBe(409);
    expect((await master(w)).map((x) => x.id)).toEqual([mine.id]);
    expect(await s.n("select count(*) n from custom_fields where id = $1 and name = '相手の項目'", [theirs])).toBe(1);
  });
  it("K717-API-011 手順 1・2：直す・並べる・消すたびに証跡が 1 行・会社・操作した人・C2・対象の項目つき（失敗した書きには残らない）", async () => {
    const w = await fresh();
    const where = "tenant_id = $1 and target_type = 'custom_fields'";
    const id = (await made(await create(w, { name: "証跡", field_type: "date", kind_ids: w.kinds }))).id;
    await update(w, id, { required: true });
    await order(
      w,
      (await master(w)).map((x) => x.id),
    );
    await del(w, id);
    await update(w, id, { required: false });
    const rows = (
      await s.f.admin.query<{ action: string; actor_member_id: string; choke_point_id: string; target_id: string }>(
        `select action, actor_member_id, choke_point_id, target_id from audit_events where ${where} and action <> 'custom_field.create' order by occurred_at, id`,
        [w.tenantId],
      )
    ).rows;
    expect(rows.map((r) => r.action)).toEqual(["custom_field.update", "custom_field.reorder", "custom_field.delete"]);
    expect(rows.every((r) => r.actor_member_id === w.admin.id && r.choke_point_id === "C2")).toBe(true);
    expect(rows[0]!.target_id).toBe(id);
  });
  it("K717-API-012 失敗（手順 2）：証跡を書く所で DB が落ちる → 503 E-PAGE-003・項目の行も前のまま（名前・種別の行が戻る）", async () => {
    const w = await fresh();
    const d = await made(await create(w, { name: "前のまま", field_type: "date", kind_ids: [w.kinds[0]] }));
    const fix = await s.breakWrites("audit_events");
    try {
      const r = await update(w, d.id, { name: "落ちる", kind_ids: [w.kinds[1]] });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect((await master(w)).find((x) => x.id === d.id)).toMatchObject({ name: "前のまま", kind_ids: [w.kinds[0]] });
  });
  it("K717-API-013 失敗（手順 1）：項目の行を書く所で DB が落ちる → 503 E-PAGE-003・名前も種別の行も前のまま・証跡も増えない", async () => {
    const w = await fresh();
    const d = await made(await create(w, { name: "前のまま", field_type: "date", kind_ids: [w.kinds[0]] }));
    const a0 = await s.n(
      "select count(*) n from audit_events where tenant_id = $1 and action = 'custom_field.update'",
      [w.tenantId],
    );
    const fix = await s.breakWrites("custom_fields");
    try {
      const r = await update(w, d.id, { name: "落ちる", kind_ids: [w.kinds[1]] });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect((await master(w)).find((x) => x.id === d.id)).toMatchObject({ name: "前のまま", kind_ids: [w.kinds[0]] });
    expect(
      await s.n("select count(*) n from audit_events where tenant_id = $1 and action = 'custom_field.update'", [
        w.tenantId,
      ]),
    ).toBe(a0);
  });
});

describe("DB の守り", () => {
  it("K717-DB-001 種別の行：保存した種別の組と同じ行が生きており、外した種別の行は消した印が付く（行ごと消さない）・戻すと同じ組の 2 行目を作らない（一意）", async () => {
    const w = await fresh();
    const d = await made(await create(w, { name: "行", field_type: "date", kind_ids: w.kinds }));
    await update(w, d.id, { kind_ids: [w.kinds[0]] });
    const rows = async () =>
      (
        await s.f.admin.query<{ kind_id: string; live: boolean }>(
          "select kind_id, deleted_at is null as live from custom_field_kinds where field_id = $1 order by created_at, id",
          [d.id],
        )
      ).rows;
    expect((await rows()).filter((r) => r.live).map((r) => r.kind_id)).toEqual([w.kinds[0]]);
    expect((await rows()).filter((r) => !r.live).map((r) => r.kind_id)).toEqual([w.kinds[1]]);
    await update(w, d.id, { kind_ids: w.kinds });
    expect(
      (await rows())
        .filter((r) => r.live)
        .map((r) => r.kind_id)
        .sort(),
    ).toEqual([...w.kinds].sort());
    expect(
      await s.n(
        "select count(*) n from (select kind_id from custom_field_kinds where field_id = $1 and deleted_at is null group by kind_id having count(*) > 1) x",
        [d.id],
      ),
    ).toBe(0);
  });
});
