// K-472「一覧の絞り込みの受け皿（12 欄の表）と、人・段・種別・完了で絞る」の単体の試験（口・本物の DB）。名前の頭の行 ID（K472-API-…）は 11_tickets/K-472.md の行の表と 1 対 1。
// 口：GET /api/v1/tickets（listTickets・K-92 が作った口）。新しく受ける欄：assignee_id・stage_id・kind_id（どれも uuid・空の値は指定なし）と done（true＝完了だけ・false＝完了以外）。
//   絞り込みは全部 AND で、見える範囲（行の守り）・自分に関わるもの（view=mine）・題名か番号（q）・グループ（scope_id）と重ねて使える。
//   ほかの欄（期限・開始日・期限切れ・炎・親・並び・見せる欄）は K-473。「受け付ける欄の表と、まだの表」の分かれ方は K-92 の試験の行 K92-API-024（この葉が替えた版）が見る。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addApproval,
  expectUnreadableCursor,
  fieldsOf,
  ids,
  list,
  listOk,
  make as makeT,
  makeWorld,
  outsideGroup,
  readAll,
  setCols,
  setStage,
  setupList,
  type Fixture,
  type World,
} from "./list.harness.js";

let f: Fixture;
const world = (prefix = "EG") => makeWorld(f, prefix);
const make = (w: World, o: Parameters<typeof makeT>[2] = {}) => makeT(f, w, o);
const L = (w: World, q: string) => listOk(f, w.me, q);
const q = (s: string) => encodeURIComponent(s);

beforeAll(async () => {
  f = await setupList();
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-472 一覧の絞り込み：人・段・種別・完了", () => {
  it("K472-API-001 assignee_id：その人が担当のチケットだけ（view=all）。ほかの人のものは出ない", async () => {
    const w = await world();
    const mine = await make(w);
    const theirs = await make(w, { assignee: w.mate });
    expect(ids(await L(w, `view=all&assignee_id=${w.me.id}`))).toEqual([mine.id]);
    expect(ids(await L(w, `view=all&assignee_id=${w.mate.id}`))).toEqual([theirs.id]);
    expect(new Set(ids(await L(w, "view=all")))).toEqual(new Set([mine.id, theirs.id]));
  });

  it("K472-API-002 assignee_id × 自分に関わるもの：自分が承認する山田のチケットは mine & assignee_id=山田 で出る。山田の担当でも自分に関わらないものは mine では出ない", async () => {
    const w = await world();
    const grp = await outsideGroup(f, w);
    const writer = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const approvedByMe = await make({ ...w, me: writer }, { scope: grp, assignee: writer });
    await addApproval(f, w, approvedByMe.id, w.me, grp, writer);
    const mateOnly = await make(w, { assignee: w.mate });
    expect(ids(await L(w, `view=mine&assignee_id=${writer.id}`))).toEqual([approvedByMe.id]);
    expect(ids(await L(w, `view=mine&assignee_id=${w.mate.id}`))).toEqual([]);
    expect(ids(await L(w, `view=all&assignee_id=${w.mate.id}`))).toEqual([mateOnly.id]);
  });

  it("K472-API-003 stage_id：その段のチケットだけ。完了にしたものは完了の段で絞ると出る", async () => {
    const w = await world();
    const a = await make(w);
    const b = await make(w);
    const doneStage = await setStage(f, b.id, "done");
    const todoStage = (await f.admin.query<{ s: string }>("select stage_id as s from tickets where id = $1", [a.id]))
      .rows[0]!.s;
    expect(ids(await L(w, `view=all&stage_id=${todoStage}`))).toEqual([a.id]);
    expect(ids(await L(w, `view=all&stage_id=${doneStage}`))).toEqual([b.id]);
  });

  it("K472-API-004 kind_id：その種別のチケットだけ（種別が 2 つ以上ある会社で）", async () => {
    const w = await world();
    expect(w.kinds.length, "種別が 2 つ以上ある会社の種").toBeGreaterThanOrEqual(2);
    const other = w.kinds.find((k) => k.id !== w.task.id)!;
    const a = await make(w);
    const b = await make(w);
    await setCols(f, b.id, { kind_id: other.id });
    expect(ids(await L(w, `view=all&kind_id=${w.task.id}`))).toEqual([a.id]);
    expect(ids(await L(w, `view=all&kind_id=${other.id}`))).toEqual([b.id]);
  });

  it("K472-API-005 client_id（取引先で絞る）は無い：付けたら 422・VALIDATION_ERROR・欄 client_id（知らない名前・取引先を持たない・answer=4961f0280e9a）", async () => {
    const w = await world();
    await make(w);
    const r = await list(f, w.me, "view=all&client_id=0193c5a0-0000-7000-8000-0000000a4720");
    expect(r.status).toBe(422);
    const body = (await r.json()) as { code?: string; details?: { field: string }[] };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect((body.details ?? []).map((d) => d.field)).toContain("client_id");
  });

  it("K472-API-006 done：true は完了だけ・false は完了以外（「完了以外」で隠す・D-151.20）。付けなければ両方", async () => {
    const w = await world();
    const open = await make(w);
    const closed = await make(w);
    await setStage(f, closed.id, "done");
    expect(ids(await L(w, "view=all&done=false"))).toEqual([open.id]);
    expect(ids(await L(w, "view=all&done=true"))).toEqual([closed.id]);
    expect(new Set(ids(await L(w, "view=all")))).toEqual(new Set([open.id, closed.id]));
  });

  it("K472-API-007 done が true・false 以外（yes・1・True）は 422・欄 done", async () => {
    const w = await world();
    for (const v of ["yes", "1", "True", "完了"]) {
      const r = await list(f, w.me, `done=${q(v)}`);
      expect(r.status, v).toBe(422);
      expect(await fieldsOf(r), v).toContain("done");
    }
  });

  it("K472-API-008 空の値（?kind_id=）は指定なしと同じ：4 つの欄とも、付けなくても付けても同じ答え", async () => {
    const w = await world();
    await make(w);
    await make(w, { assignee: w.mate });
    const base = ids(await L(w, "view=all"));
    for (const name of ["kind_id", "stage_id", "assignee_id", "done"])
      expect(ids(await L(w, `view=all&${name}=`)), name).toEqual(base);
  });

  it("K472-API-009 uuid でない値（3 つの *_id）は 422・欄の名前つき・VALIDATION_ERROR（404 や 500 にしない）", async () => {
    const w = await world();
    for (const name of ["kind_id", "stage_id", "assignee_id"]) {
      const r = await list(f, w.me, `${name}=not-a-uuid`);
      expect(r.status, name).toBe(422);
      expect(await fieldsOf(r), name).toContain(name);
    }
  });

  it("K472-API-010 正しい uuid でも、無い・別の会社の人や段を指したら 200・0 件（あるかないかを答えない・404 にしない）", async () => {
    const w = await world("EG");
    const o = await world("OT");
    await make(w);
    const theirs = await make(o);
    const theirStage = (
      await f.admin.query<{ s: string }>("select stage_id as s from tickets where id = $1", [theirs.id])
    ).rows[0]!.s;
    for (const [name, value] of [
      ["assignee_id", o.me.id],
      ["stage_id", theirStage],
      ["kind_id", o.task.id],
    ] as const) {
      const r = await list(f, w.me, `view=all&${name}=${value}`);
      expect(r.status, name).toBe(200);
      expect(((await r.json()) as { data: unknown[] }).data, name).toEqual([]);
    }
  });

  it("K472-API-011 全部 AND：担当者・段・題名（q）・グループ（scope_id）を重ねると、全部に合うものだけ。完了（done）と段（stage_id）の組も同じ（done=false に完了の段は 0 件）", async () => {
    const w = await world();
    const grp = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '営業', 'SL') returning id",
        [w.tenantId, w.root],
      )
    ).rows[0]!.id;
    const hit = await make(w, { title: "請求の見積", scope: grp });
    await make(w, { title: "請求の見積（別のグループ）" });
    await make(w, { title: "請求の見積（山田）", scope: grp, assignee: w.mate });
    const wrongStage = await make(w, { title: "請求の見積（完了）", scope: grp });
    await setStage(f, wrongStage.id, "done");
    const todoStage = (await f.admin.query<{ s: string }>("select stage_id as s from tickets where id = $1", [hit.id]))
      .rows[0]!.s;
    const query = `view=all&assignee_id=${w.me.id}&stage_id=${todoStage}&q=${q("請求")}&scope_id=${grp}`;
    expect(ids(await L(w, query))).toEqual([hit.id]);
    // done と stage_id を重ねる：完了でない・完了の段の組は 0 件、組が合えば出る
    const doneStage = (
      await f.admin.query<{ s: string }>("select stage_id as s from tickets where id = $1", [wrongStage.id])
    ).rows[0]!.s;
    const inGroup = `view=all&scope_id=${grp}`;
    expect(ids(await L(w, `${inGroup}&done=false&stage_id=${doneStage}`))).toEqual([]);
    expect(ids(await L(w, `${inGroup}&done=true&stage_id=${todoStage}`))).toEqual([]);
    expect(ids(await L(w, `${inGroup}&done=true&stage_id=${doneStage}`))).toEqual([wrongStage.id]);
  });

  it("K472-API-012 見えないものは絞っても出ない：見えないグループ・消した・他の人の下書きのチケットは、担当者の指定でも出ない", async () => {
    const w = await world();
    const grp = await outsideGroup(f, w);
    const acct = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const secret = await make({ ...w, me: acct }, { scope: grp, assignee: acct });
    const outsider = await f.person(w.tenantId, w.root, { name: "外の人", ticketAbility: "view" });
    const gone = await make(w, { assignee: w.mate });
    await setCols(f, gone.id, { deleted_at: new Date().toISOString() });
    const draft = await make(w, { assignee: w.mate });
    const imp = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
        [w.tenantId, w.me.id, w.root],
      )
    ).rows[0]!.id;
    await setCols(f, draft.id, { draft_import_id: imp });
    expect(ids(await listOk(f, outsider, `view=all&assignee_id=${acct.id}`))).toEqual([]);
    expect(ids(await listOk(f, acct, `view=all&assignee_id=${acct.id}`))).toEqual([secret.id]);
    expect(ids(await L(w, `view=all&assignee_id=${w.mate.id}`))).toEqual([draft.id]);
    expect(ids(await listOk(f, w.mate, `view=all&assignee_id=${w.mate.id}`))).toEqual([]);
  });

  it("K472-API-013 次の分：絞り込みを付けたまま 2 件ずつ読むと、合うものが重ならず抜けず、付けずに読んだ並びと同じ", async () => {
    const w = await world();
    const hit: string[] = [];
    for (let i = 0; i < 5; i += 1) hit.push((await make(w, { title: `絞る ${i}`, assignee: w.mate })).id);
    for (let i = 0; i < 3; i += 1) await make(w, { title: `絞らない ${i}` });
    const paged = await readAll(f, w.me, `view=all&assignee_id=${w.mate.id}`, 2);
    expect(paged).toHaveLength(5);
    expect(new Set(paged)).toEqual(new Set(hit));
    expect(paged).toEqual(ids(await L(w, `view=all&assignee_id=${w.mate.id}&limit=100`)));
  });

  it("K472-API-014 答えの形は変わらない：絞り込みを付けても 1 件の鍵は K-92 の 13 個（12 個＋ K-560 の scope）のまま（総数を返さない）", async () => {
    const w = await world();
    await make(w);
    const p = await L(w, `view=all&assignee_id=${w.me.id}&done=false`);
    expect(p.data).toHaveLength(1);
    expect(Object.keys(p.data[0]!).sort()).toEqual(
      [
        "assignee",
        "delegated_to_clone",
        "depth",
        "due_on",
        "id",
        "kind",
        "number",
        "overdue",
        "parent_ticket_id",
        "scope",
        "stage",
        "title",
        "updated_at",
      ].sort(),
    );
  });

  it("K472-API-015 表記ゆらぎの題名の絞り込み（K-92）は絞り込みを足しても同じ：全角の英字・番号のハイフンの種類", async () => {
    const w = await world();
    const t = await make(w, { title: "ＡＰＩの件" });
    const [head, num] = t.number.split("-") as [string, string];
    expect(ids(await L(w, `view=all&assignee_id=${w.me.id}&q=${q("api")}`))).toEqual([t.id]);
    expect(ids(await L(w, `view=all&assignee_id=${w.me.id}&q=${q(`${head}‐${num}`)}`))).toEqual([t.id]);
    expect(ids(await L(w, `view=all&assignee_id=${w.mate.id}&q=${q("api")}`))).toEqual([]);
  });

  it("K472-API-016 続きの鍵：形（base64url の 1〜200 字）に合わない鍵は 422（欄 cursor・入口）。形に合うのに今の状態では読めない鍵（JSON でない・中身が合わない・別の view の鍵）は 409・E-LST-001・欄なし。500 にしない。鍵を付けずに読み直せば 200", async () => {
    const w = await world();
    for (let i = 0; i < 3; i += 1) await make(w);
    const mineKey = (await L(w, "view=mine&limit=1")).meta.next_cursor!;
    const b64 = (v: string) => Buffer.from(v, "utf8").toString("base64url");
    for (const cursor of ["%%%", "a".repeat(201)]) {
      const r = await list(f, w.me, `view=all&cursor=${q(cursor)}`);
      expect(r.status, cursor).toBe(422);
      expect(await fieldsOf(r), cursor).toContain("cursor");
    }
    for (const cursor of [
      b64("これは鍵ではない"),
      b64(JSON.stringify({ x: 1 })),
      b64(JSON.stringify(["all", "いつか", "id でない"])),
      mineKey,
    ])
      await expectUnreadableCursor(await list(f, w.me, `view=all&limit=1&cursor=${q(cursor)}`), cursor);
    expect((await L(w, "view=all&limit=1")).data).toHaveLength(1);
  });

  it("K472-API-017 q の長さは送られたままの文字で数える：101 文字（前後の空白を足した 101 も）は 422・E-VAL-017・欄 q。空白を含めて 100 文字と、正規化で伸びる字（㌔）の 60 文字は 200", async () => {
    const w = await world();
    const hit = await make(w, { title: "あいう" });
    const status = async (value: string) => (await list(f, w.me, `view=all&q=${q(value)}`)).status;
    for (const over of ["あ".repeat(101), ` ${"あ".repeat(100)}`, `${"あ".repeat(100)} `]) {
      const r = await list(f, w.me, `view=all&q=${q(over)}`);
      expect(r.status, over).toBe(422);
      const body = (await r.json()) as { code?: string; details?: { field: string }[] };
      expect(body.code, over).toBe("E-VAL-017");
      expect(
        (body.details ?? []).map((d) => d.field),
        over,
      ).toContain("q");
    }
    expect(await status(`${" ".repeat(10)}${"あ".repeat(90)}`)).toBe(200);
    expect(await status("㌔".repeat(60))).toBe(200);
    // 探すときの扱い（前後の空白・全角半角）は今までどおり
    expect(ids(await L(w, `view=all&q=${q("  あいう  ")}`))).toEqual([hit.id]);
  });
});
