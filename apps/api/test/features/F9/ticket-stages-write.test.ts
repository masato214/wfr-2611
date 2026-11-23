// K-705「状態（作業の段）を足す・直す（名前・色）・並べる・消す（色の列を足す・始めと終わりは消せない）」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K705-API-… / K705-DB-…）は 11_tickets/K-705.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない。実装の前に流して赤を確かめない。
//
// 試験が決める口の形（設計は 07_functional/段10-F9/土台-settings.md。契約は 05_flow/screen_api.d/K-705.py で作る）:
//   listTicketStages    GET    /api/v1/ticket_stages        200 { data: TicketStageSetting[], meta }（前は表の行をそのまま返していた。答えの形を決める）
//   createTicketStage   POST   /api/v1/ticket_stages        { name, color_key }              201 { data: TicketStageSetting }
//   updateTicketStage   PATCH  /api/v1/ticket_stages/:id    { name?, color_key? }            200 { data: TicketStageSetting }
//   deleteTicketStage   DELETE /api/v1/ticket_stages/:id                                      200 { data: { id } }
//   reorderTicketStages POST   /api/v1/ticket_stages/order  { stage_ids: uuid[] }            200 { data: TicketStageSetting[] }
//   TicketStageSetting = { id, key, name, color_key, position, lock }（鍵ちょうど 6）。lock は start（key が todo）・end（key が done）・system（仕組みの段）・null
//   足した段は終わりの段の直前に入り、並びは 10 刻みで振り直す。権限は ticket_stages の edit
//   断る：形の誤り 422／無い・見えない 404 E-PAGE-001／同じ名前 409 E-STG-001／作業の段が 9 つ目 409 E-STG-002／始め・終わり・仕組みの段は消せない 409 E-STG-003／
//         仕組みの段の名前は変えられない 409 E-STG-004／使っているチケットが在る 409 E-STG-005（detail.ticket_count）／並びが今と合わない 409 E-STG-006／
//         始めが先頭・終わりが最後でない 409 E-STG-007／権限なし 403／ログインなし 401／上限 429／DB の失敗 503 E-PAGE-003
// DB（migration 20261125014500_ticket_stage_settings.sql）:
//   ticket_stages.color_key（8 つの check・key から初めの色を入れる引き金）・一意の索引 (tenant_id, name) where deleted_at is null・
//   app.ticket_stage_create / update / delete / reorder（security definer・答えは jsonb。断りは { error: <言葉> }）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { isFlat, startSettings, type Json, type Settings, type World } from "./settings.harness.js";

const KEYS = ["color_key", "id", "key", "lock", "name", "position"];
const FIRST: Record<string, string> = {
  todo: "teal-light",
  doing: "indigo",
  hold: "plum",
  checking: "teal",
  awaiting_approval: "amber",
  running: "coral",
  done: "sage",
};
const TONES = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"];
interface Stage {
  id: string;
  key: string | null;
  name: string;
  color_key: string;
  position: number;
  lock: string | null;
}
let s: Settings;
let A: World;
let B: World;
beforeAll(async () => {
  s = await startSettings(["ticket-stages-write"]);
  A = await s.world("設定 状態 A");
  B = await s.world("設定 状態 B");
});
afterAll(async () => {
  await s.close();
});
const create = (w: World, body: unknown, who = w.admin) => s.call(who, "POST", "/ticket_stages", body);
const update = (w: World, id: string, body: unknown, who = w.admin) =>
  s.call(who, "PATCH", `/ticket_stages/${id}`, body);
const del = (w: World, id: string, who = w.admin) => s.call(who, "DELETE", `/ticket_stages/${id}`);
const order = (w: World, ids: string[], who = w.admin) =>
  s.call(who, "POST", "/ticket_stages/order", { stage_ids: ids });
const list = async (w: World): Promise<Stage[]> =>
  ((await s.json(await s.call(w.admin, "GET", "/ticket_stages?sort=position"))).data ?? []) as Stage[];
const ids = async (w: World): Promise<string[]> => (await list(w)).map((x) => x.id);
const fresh = (): Promise<World> => s.world("設定 状態 一時");
const ctxOf = (w: World, p = w.admin): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
const made = async (r: Response): Promise<Stage> => ((await s.json(r)).data ?? {}) as Stage;
const code = async (r: Response): Promise<unknown> => (await s.json(r))["code"];

describe("状態を読む", () => {
  it("K705-API-001 読む：鍵ちょうど 6・並びの順・lock は todo＝start／done＝end／仕組みの 3 つ＝system／ほかは null・色は全部入っている・別の会社と消した段は出ない", async () => {
    const gone = await s.one(
      "insert into ticket_stages (tenant_id, name, position, deleted_at) values ($1, '消した段', 5, now()) returning id",
      [A.tenantId],
    );
    const rows = await list(A);
    expect(rows.every((r) => Object.keys(r).sort().join() === KEYS.join())).toBe(true);
    expect(rows.map((r) => r.position)).toEqual([...rows.map((r) => r.position)].sort((a, b) => a - b));
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect([
      by["todo"]!.lock,
      by["done"]!.lock,
      by["checking"]!.lock,
      by["awaiting_approval"]!.lock,
      by["running"]!.lock,
    ]).toEqual(["start", "end", "system", "system", "system"]);
    expect([by["doing"]!.lock, by["hold"]!.lock]).toEqual([null, null]);
    expect(rows.every((r) => TONES.includes(r.color_key))).toBe(true);
    expect(rows.some((r) => r.id === gone)).toBe(false);
    const other = new Set(await ids(B));
    expect(rows.some((r) => other.has(r.id))).toBe(false);
  });
});

describe("状態を足す", () => {
  it("K705-API-002 足す：201・鍵ちょうど 6・終わりの段の直前に入り終わりは最後のまま・並びは 10 刻み・読み直すと出る", async () => {
    const r = await create(A, { name: "先方の返事待ち", color_key: "amber" });
    expect(r.status).toBe(201);
    const d = await made(r);
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({ key: null, color_key: "amber", lock: null });
    const rows = await list(A);
    expect(rows[rows.length - 1]!.key).toBe("done");
    expect(rows[rows.length - 2]!.id).toBe(d.id);
    expect(rows.map((x) => x.position)).toEqual(rows.map((_, i) => (i + 1) * 10));
  });
  it("K705-API-003 名前の形：前後の空白（全角・タブ）は落とす・空白だけ・21 字・NUL は 422（欄 name）・20 字は通る", async () => {
    const w = await fresh();
    expect((await made(await create(w, { name: "　\t二十　", color_key: "sage" }))).name).toBe("二十");
    for (const name of ["　 \t", "あ".repeat(21), "あ\u0000い", ""]) {
      const r = await create(w, { name, color_key: "sage" });
      expect(r.status, JSON.stringify(name)).toBe(422);
      expect(JSON.stringify((await s.json(r)).details)).toContain("name");
    }
    expect((await create(w, { name: "字".repeat(20), color_key: "sage" })).status).toBe(201);
  });
  it("K705-API-004 色の形：8 つの外・無い・文字でない は 422（欄 color_key）", async () => {
    const w = await fresh();
    for (const color_key of ["red", "#2F4B7C", 7, null, undefined]) {
      const r = await create(w, color_key === undefined ? { name: "色なし" } : { name: "色", color_key });
      expect(r.status, String(color_key)).toBe(422);
      expect(JSON.stringify((await s.json(r)).details)).toContain("color_key");
    }
  });
  it("K705-API-005 同じ名前は 409 E-STG-001（仕組みの段の名前も含む・欄なし）・消した名前は使い回せ・別の会社は混ざらない", async () => {
    const w = await fresh();
    expect((await create(w, { name: "重複", color_key: "plum" })).status).toBe(201);
    for (const name of ["重複", "確認中", "完了"]) {
      const r = await create(w, { name, color_key: "plum" });
      expect(r.status, name).toBe(409);
      const b = await s.json(r);
      expect(b["code"]).toBe("E-STG-001");
      expect(isFlat(b)).toBe(true);
    }
    const id = (await list(w)).find((x) => x.name === "重複")!.id;
    expect((await del(w, id)).status).toBe(200);
    expect((await create(w, { name: "重複", color_key: "plum" })).status).toBe(201);
    expect((await create(B, { name: "重複", color_key: "plum" })).status).toBe(201);
  });
  it("K705-API-006 作業の段（仕組みの段を除く）は 8 まで：9 つ目は 409 E-STG-002・足されない・仕組みの段は数えない", async () => {
    const w = await fresh();
    const plain = () =>
      s.n("select count(*) n from ticket_stages where tenant_id = $1 and deleted_at is null and not is_fixed", [
        w.tenantId,
      ]);
    for (let i = await plain(); i < 8; i += 1)
      expect((await create(w, { name: `段${i}`, color_key: "indigo" })).status).toBe(201);
    const r = await create(w, { name: "あふれ", color_key: "indigo" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("E-STG-002");
    expect(await plain()).toBe(8);
    expect((await create(B, { name: "別の会社の 1 つ", color_key: "indigo" })).status).toBe(201);
  });
});

describe("状態を直す", () => {
  it("K705-API-007 直す：名前と色が変わり読み直しで同じ・送らない物は変わらない・空の体は 422", async () => {
    const w = await fresh();
    const id = (await made(await create(w, { name: "直す前", color_key: "indigo" }))).id;
    const r = await update(w, id, { name: "直した後" });
    expect(r.status).toBe(200);
    expect(Object.keys(await made(r)).sort()).toEqual(KEYS);
    await update(w, id, { color_key: "lavender" });
    expect((await list(w)).find((x) => x.id === id)).toMatchObject({ name: "直した後", color_key: "lavender" });
    expect((await update(w, id, {})).status).toBe(422);
  });
  it("K705-API-008 仕組みの段（確認中・承認待ち・実行中）は色だけ直せる：名前を変えると 409 E-STG-004・同じ名前のままの送りは通る", async () => {
    const w = await fresh();
    const id = await s.stageId(w, "checking");
    expect((await update(w, id, { color_key: "plum" })).status).toBe(200);
    expect((await update(w, id, { name: "確認中", color_key: "sage" })).status).toBe(200);
    const r = await update(w, id, { name: "チェック中" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("E-STG-004");
    expect((await list(w)).find((x) => x.id === id)).toMatchObject({ name: "確認中", color_key: "sage" });
  });
  it("K705-API-009 始め（未着手）と終わり（完了）は名前も色も直せる・key は変わらない（作る・完了にする仕組みが key で探すため）", async () => {
    const w = await fresh();
    const todo = await s.stageId(w, "todo");
    const done = await s.stageId(w, "done");
    expect((await update(w, todo, { name: "着手前", color_key: "coral" })).status).toBe(200);
    expect((await update(w, done, { name: "納品済み", color_key: "teal" })).status).toBe(200);
    const rows = await list(w);
    expect(rows.find((x) => x.id === todo)).toMatchObject({ key: "todo", name: "着手前", lock: "start" });
    expect(rows.find((x) => x.id === done)).toMatchObject({ key: "done", name: "納品済み", lock: "end" });
  });
  it("K705-API-010 無い・消した・別の会社の段は 404 E-PAGE-001（欄・details なし）・uuid でない道は 422", async () => {
    const gone = (await made(await create(A, { name: "消す予定", color_key: "sage" }))).id;
    await del(A, gone);
    const foreign = await s.stageId(B, "doing");
    for (const id of [gone, foreign, "00000000-0000-4000-8000-000000000000"]) {
      for (const r of [await update(A, id, { name: "x" }), await del(A, id)]) {
        expect(r.status, id).toBe(404);
        const b = await s.json(r);
        expect(b["code"]).toBe("E-PAGE-001");
        expect(isFlat(b)).toBe(true);
      }
    }
    expect((await update(A, "not-a-uuid", { name: "x" })).status).toBe(422);
  });
});

describe("状態を消す・並べる", () => {
  it("K705-API-011 使っていない作業の段は消せる：読みから消え、名前を使い回せ、並びの 10 刻みは振り直される", async () => {
    const w = await fresh();
    const id = (await made(await create(w, { name: "使わない", color_key: "sage" }))).id;
    const r = await del(w, id);
    expect(r.status).toBe(200);
    expect(((await s.json(r)).data as { id: string }).id).toBe(id);
    const rows = await list(w);
    expect(rows.some((x) => x.id === id)).toBe(false);
    expect(rows.map((x) => x.position)).toEqual(rows.map((_, i) => (i + 1) * 10));
  });
  it("K705-API-012 始め・終わり・仕組みの段は 409 E-STG-003（欄なし）・消えない", async () => {
    const w = await fresh();
    for (const key of ["todo", "done", "checking", "awaiting_approval", "running"]) {
      const r = await del(w, await s.stageId(w, key));
      expect(r.status, key).toBe(409);
      const b = await s.json(r);
      expect(b["code"]).toBe("E-STG-003");
      expect(isFlat(b)).toBe(true);
    }
    expect(
      await s.n("select count(*) n from ticket_stages where tenant_id = $1 and deleted_at is null", [w.tenantId]),
    ).toBe(7);
  });
  it("K705-API-013 使っているチケットが在る段は 409 E-STG-005・枚数が detail に入る・消したチケットも数える・消えない", async () => {
    const w = await fresh();
    const id = await s.stageId(w, "hold");
    await s.ticket(w, { stageId: id });
    await s.ticket(w, { stageId: id, deleted: true });
    const r = await del(w, id);
    expect(r.status).toBe(409);
    const b = await s.json(r);
    expect(b["code"]).toBe("E-STG-005");
    expect(b["detail"]).toEqual({ ticket_count: 2 });
    expect("field" in b || "details" in b).toBe(false);
    expect(await s.n("select count(*) n from ticket_stages where id = $1 and deleted_at is null", [id])).toBe(1);
  });
  it("K705-API-014 並べる：渡した順になり読み直しも同じ・並びは 10 刻み・始めが先頭で終わりが最後なら仕組みの段はどこでもよい", async () => {
    const w = await fresh();
    const rows = await list(w);
    const mid = rows
      .slice(1, -1)
      .map((x) => x.id)
      .reverse();
    const next = [rows[0]!.id, ...mid, rows[rows.length - 1]!.id];
    const r = await order(w, next);
    expect(r.status).toBe(200);
    expect((((await s.json(r)).data ?? []) as Stage[]).map((x) => x.id)).toEqual(next);
    expect(await ids(w)).toEqual(next);
    expect((await list(w)).map((x) => x.position)).toEqual(next.map((_, i) => (i + 1) * 10));
  });
  it("K705-API-015 並びが今と合わない（足りない・余る・重なる・消した段・別の会社の段）は 409 E-STG-006・何も変わらない・uuid でない要素・空は 422", async () => {
    const w = await fresh();
    const before = await ids(w);
    const gone = (await made(await create(w, { name: "並べ用", color_key: "sage" }))).id;
    await del(w, gone);
    const bad = [
      before.slice(1),
      [...before, "11111111-1111-4111-8111-111111111111"],
      [before[0]!, ...before],
      [...before, gone],
      [...before, await s.stageId(B, "doing")],
    ];
    for (const x of bad) {
      const r = await order(w, x);
      expect(r.status).toBe(409);
      expect(await code(r)).toBe("E-STG-006");
    }
    expect(await ids(w)).toEqual(before);
    expect((await order(w, ["x"])).status).toBe(422);
    expect((await order(w, [])).status).toBe(422);
  });
  it("K705-API-016 始めが先頭でない・終わりが最後でない並びは 409 E-STG-007・何も変わらない", async () => {
    const w = await fresh();
    const before = await ids(w);
    const swapped = [...before.slice(1), before[0]!];
    const endFirst = [before[before.length - 1]!, ...before.slice(0, -1)];
    for (const x of [swapped, endFirst]) {
      const r = await order(w, x);
      expect(r.status).toBe(409);
      expect(await code(r)).toBe("E-STG-007");
    }
    expect(await ids(w)).toEqual(before);
  });
});

describe("守り・記録・失敗", () => {
  it("K705-API-017 権限が無い人は 4 つとも 403・何も変わらない／ログインなしは 401", async () => {
    const w = await fresh();
    const id = await s.stageId(w, "doing");
    const before = await ids(w);
    const rs = [
      await create(w, { name: "権限なし", color_key: "teal" }, w.member),
      await update(w, id, { name: "権限なし" }, w.member),
      await del(w, id, w.member),
      await order(w, before, w.member),
    ];
    for (const r of rs) expect(r.status).toBe(403);
    expect(await ids(w)).toEqual(before);
    expect((await s.call(null, "POST", "/ticket_stages", { name: "x", color_key: "teal" })).status).toBe(401);
  });
  it("K705-API-018 別の会社の管理者は触れない：相手の段は 404（直す・消す）・並びに混ぜると 409", async () => {
    const mine = await ids(B);
    const theirs = await s.stageId(A, "doing");
    expect((await update(B, theirs, { name: "のっとり" }, B.admin)).status).toBe(404);
    expect((await del(B, theirs, B.admin)).status).toBe(404);
    expect((await order(B, [...mine, theirs], B.admin)).status).toBe(409);
    expect((await list(A)).find((x) => x.id === theirs)!.name).toBe("作業中");
  });
  it("K705-API-019 1 分あたりの上限を超えた書きは 429・retry_after_sec が数", async () => {
    s.f.limits["createTicketStage"] = 2;
    const w = await fresh();
    const ip = "198.51.100.78";
    const hit = () =>
      s.f.req("POST", "/ticket_stages", {
        headers: w.admin.auth,
        ip,
        body: { name: `n${Math.random()}`.slice(0, 18), color_key: "teal" },
      });
    await hit();
    await hit();
    const r = await hit();
    delete s.f.limits["createTicketStage"];
    expect(r.status).toBe(429);
    expect(typeof ((await s.json(r)) as Json)["retry_after_sec"]).toBe("number");
  });
  it("K705-API-020 手順 1・2：書くたびに証跡が 1 行・会社・操作した人・C2・対象の段つき（失敗した書きには残らない）", async () => {
    const w = await fresh();
    const where = "tenant_id = $1 and target_type = 'ticket_stages'";
    const before = await s.n(`select count(*) n from audit_events where ${where}`, [w.tenantId]);
    const id = (await made(await create(w, { name: "証跡", color_key: "teal" }))).id;
    await update(w, id, { color_key: "plum" });
    await order(w, await ids(w));
    await del(w, id);
    await create(w, { name: "未着手", color_key: "teal" });
    const rows = (
      await s.f.admin.query<{ action: string; actor_member_id: string; choke_point_id: string; target_id: string }>(
        `select action, actor_member_id, choke_point_id, target_id from audit_events where ${where} order by occurred_at, id`,
        [w.tenantId],
      )
    ).rows;
    expect(rows.length - before).toBe(4);
    expect(rows.map((r) => r.action)).toEqual([
      "ticket_stage.create",
      "ticket_stage.update",
      "ticket_stage.reorder",
      "ticket_stage.delete",
    ]);
    expect(rows.every((r) => r.actor_member_id === w.admin.id && r.choke_point_id === "C2")).toBe(true);
    expect(rows[0]!.target_id).toBe(id);
  });
  it("K705-API-021 失敗（手順 1）：段の行を書く所で DB が落ちる → 503 E-PAGE-003・段も証跡も増えない", async () => {
    const w = await fresh();
    const n0 = (await ids(w)).length;
    const a0 = await s.n("select count(*) n from audit_events where tenant_id = $1", [w.tenantId]);
    const fix = await s.breakWrites("ticket_stages");
    try {
      const r = await create(w, { name: "落ちる", color_key: "teal" });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect((await ids(w)).length).toBe(n0);
    expect(await s.n("select count(*) n from audit_events where tenant_id = $1", [w.tenantId])).toBe(a0);
  });
  it("K705-API-022 失敗（手順 2）：証跡を書く所で DB が落ちる → 503 E-PAGE-003・段の行も前のまま（名前・色が戻る）", async () => {
    const w = await fresh();
    const id = await s.stageId(w, "doing");
    const fix = await s.breakWrites("audit_events");
    try {
      const r = await update(w, id, { name: "証跡で落ちる", color_key: "plum" });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(
      await s.n("select count(*) n from ticket_stages where id = $1 and name = '作業中' and color_key = 'indigo'", [
        id,
      ]),
    ).toBe(1);
  });
});

describe("DB の守り", () => {
  it("K705-DB-001 色：color_key は 8 つ以外を DB が断る（23514）・新しい会社の段には key から初めの色が入る（todo＝teal-light・doing＝indigo・hold＝plum・checking＝teal・awaiting_approval＝amber・running＝coral・done＝sage）・既存の段にも色が入っている", async () => {
    await expect(
      s.f.admin.query("update ticket_stages set color_key = 'red' where id = $1", [await s.stageId(A, "doing")]),
    ).rejects.toMatchObject({ code: "23514" });
    const w = await fresh();
    const got = (
      await s.f.admin.query<{ key: string; color_key: string }>(
        "select key, color_key from ticket_stages where tenant_id = $1",
        [w.tenantId],
      )
    ).rows;
    expect(Object.fromEntries(got.map((r) => [r.key, r.color_key]))).toEqual(FIRST);
    expect(await s.n("select count(*) n from ticket_stages where color_key is null")).toBe(0);
  });
  it("K705-DB-002 名前の一意：同じ会社の消していない同じ名前は DB が断る（23505）・消した名前・別の会社の同じ名前は入る", async () => {
    const w = await fresh();
    const add = (t: string) =>
      s.one("insert into ticket_stages (tenant_id, name, position) values ($1, '一意', 15) returning id", [t]);
    await add(w.tenantId);
    await expect(add(w.tenantId)).rejects.toMatchObject({ code: "23505" });
    await s.f.admin.query("update ticket_stages set deleted_at = now() where tenant_id = $1 and name = '一意'", [
      w.tenantId,
    ]);
    await expect(add(w.tenantId)).resolves.toBeTruthy();
    await expect(add(B.tenantId)).resolves.toBeTruthy();
  });
  it("K705-DB-003 前からの守りはそのまま：仕組みの段の名前を DB で直に変えると 22023・色だけなら通る／関数は edit の権限が無い人には { error: forbidden } で何も書かない", async () => {
    const w = await fresh();
    const id = await s.stageId(w, "running");
    await expect(
      s.f.admin.query("update ticket_stages set name = '動いている' where id = $1", [id]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      s.f.admin.query("update ticket_stages set color_key = 'plum' where id = $1", [id]),
    ).resolves.toBeTruthy();
    const call = (p: typeof w.member) =>
      withTenant(
        s.f.pool,
        ctxOf(w, p),
        async (c) =>
          (await c.query("select app.ticket_stage_create($1, $2) r", ["関数で足す", "teal"])).rows[0]!.r as {
            error?: string;
          },
      );
    const n0 = (await ids(w)).length;
    expect(await call(w.member)).toMatchObject({ error: "forbidden" });
    expect((await ids(w)).length).toBe(n0);
    expect((await call(w.admin)).error).toBeUndefined();
    expect((await ids(w)).length).toBe(n0 + 1);
  });
});
