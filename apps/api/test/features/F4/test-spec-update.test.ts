// K-435「確認項目にチェックを付ける・外す・文を直す口（updateTestSpec）と、行を外す口（deleteTestSpec）」の単体の試験（口と DB・本物の Postgres）。2026-11-21 の作り直し。
// テストの名前の頭の行 ID（K435-API-…）は 11_tickets/K-435.md の表の行に 1 対 1 で結ぶ。土台は K-434 の test-spec.harness.ts。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.d/K-435.py で作る）:
//   updateTestSpec  PATCH /api/v1/test_specs/:id  200 { data: SpecItem }（SpecItem は K-434 と同じ：鍵ちょうど 6・id・title・checked・position・source・version）
//     体 { version（必須・1 以上の整数）, checked（真偽）か title（文）のどちらか 1 つ }（strict・両方もどちらも無いも 422）
//     version が今の版と違えば 409・E-SPEC-020。何かが変わったときだけ版が +1・updated_by・updated_at が変わる。同じ値は 200 で何も動かない
//     チェックを付ける＝checked_at と checked_by_member_id（付けた人）を入れる／外す＝checked_at・checked_by_member_id・checked_by_ai を空に戻す
//     判定の順：完了（409・E-SPEC-001）→ 版（409・E-SPEC-020）→ 文で出どころが knowledge（409・E-SPEC-022）→ 同じ文なら何も変えない → チェックが付いていれば 409・E-SPEC-021
//     文を直せるのはチェックが付いていない間だけ（付いている行の文は 409・E-SPEC-021）。文は前後の空白を落とし 1〜200 字（K-434 の app.test_spec_title_check）
//     出どころ source が knowledge（ナレッジの「必ず守る」から入った行）は、人は文を直せない・行を外せない（409・E-SPEC-022・体は error と code だけ・版も行も変えない）。チェックの付け外しはできる
//       source が manual・ai の行は同じ扱い（直せる・外せる）。機械・AI が外す道（DB の関数）はこの口の話ではない（作らない）
//     完了したチケットでは付ける・外す・直す・外すのどれも 409・E-SPEC-001（K-434 の番号）。消されたチケット・消した行・無い id は 404
//   deleteTestSpec  DELETE /api/v1/test_specs/:id  200 { data: SpecItem（外す前の姿・position は外す前の番号） }。論理削除（deleted_at）。体も版も受けない
//   やり取りの変更の 1 行（ticket_messages の kind change・どの操作も同じ取引で 1 行・app.test_spec_log が書く）:
//     付ける「〈名前〉が確認項目『〈文〉』にチェックを付けました」changes [{field: test_spec, from: false, to: true, note: 〈文〉}]（どの行も note に確認項目の文を入れる＝画面 K-574 が文を作れる）
//     外す\u3000「〈名前〉が確認項目『〈文〉』のチェックを外しました」changes [{…from: true, to: false, note: 〈文〉}]
//     直す\u3000「〈名前〉が確認項目『〈新しい文〉』を直しました」changes [{…from: 前の文, to: 新しい文, note: 新しい文}]
//     消す\u3000「〈名前〉が確認項目『〈文〉』を外しました」changes [{…from: 文, to: null, note: 文}]
//     author_member_id は人が操作したらその人。機械・AI がチェックを付ける道（DB の関数）は author が空で名前は「AI」（packages/db/test/test_spec_check_ai.test.ts）
//   証跡：test_spec.update（payload { ticket_id, changed: ["checked"] か ["title"] }）・test_spec.delete（payload { ticket_id }）。題名の文は入れない
//   404・409 の答えの体は { error, code } だけ（field・details・detail を付けない・控え帳 2026-11-21 01:15 K-385）。422 だけが details を持つ
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { BARE, bareKeys, setupSpecs, type Json, type SpecRow, type World } from "./test-spec.harness.js";

const h = setupSpecs(["test-specs-create", "test-specs-edit"]);

const KEYS = ["checked", "id", "position", "source", "title", "version"];
interface Item {
  id: string;
  title: string;
  checked: boolean;
  position: number;
  source: string;
  version: number;
}

let w: World; // 会社 A
let wb: World; // 会社 B（別の会社）
const fieldsOf = (j: Json): string[] => ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);
const patch = (who: World["writer"] | null, id: string, body: unknown, headers?: Record<string, string>) =>
  h.call(who, "PATCH", `/test_specs/${id}`, { body, ...(headers ? { headers } : {}) });
const del = (who: World["writer"] | null, id: string) => h.call(who, "DELETE", `/test_specs/${id}`);
const item = async (r: Response) => (await h.json(r)).data as Item;
const updatedAt = async (id: string) =>
  (
    await h.f.admin.query<{ u: Date }>("select updated_at as u from test_specs where id = $1", [id])
  ).rows[0]!.u.toISOString();
const ver = async (id: string) => (await h.row(id))!.version;
const audits = (id: string, op: "update" | "delete") => h.audits(w.tenantId, `test_spec.${op}`, id);

/** チケットと確認項目 1 行（準備は DB に直に入れる） */
async function setup(o: Parameters<typeof h.seed>[1] = {}): Promise<{ t: { id: string }; s: SpecRow }> {
  const t = await h.ticket(w);
  return { t, s: await h.seed(t.id, { title: "宛名を確かめる", ...o }) };
}

beforeAll(async () => {
  w = await h.world("K435 会社 A");
  wb = await h.world("K435 会社 B");
}, 60_000);

describe("K-435 チェックを付ける・外す・文を直す（updateTestSpec）", () => {
  it("K435-API-001 チェックを付ける：200・checked true・版 +1・付けた人が入る・やり取りに 1 行・証跡 1（題名の文は入れない）・鍵はちょうど 6", async () => {
    const { t, s } = await setup();
    const me = await h.name(w.writer);
    const r = await patch(w.writer, s.id, { version: s.version, checked: true });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await item(r);
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({
      id: s.id,
      title: "宛名を確かめる",
      checked: true,
      position: 1,
      source: "manual",
      version: s.version + 1,
    });
    const row = (await h.row(s.id))!;
    expect(row).toMatchObject({
      version: s.version + 1,
      checked_by_member_id: w.writer.id,
      checked_by_ai: false,
      updated_by: w.writer.id,
    });
    expect(row.checked_at).not.toBeNull();
    const ms = await h.messages(t.id);
    expect(ms.length).toBe(1);
    expect(ms[0]).toMatchObject({
      kind: "change",
      author_member_id: w.writer.id,
      body: `${me}が確認項目『宛名を確かめる』にチェックを付けました`,
      changes: [{ field: "test_spec", from: false, to: true, note: "宛名を確かめる" }],
    });
    const a = await h.f.admin.query<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'test_spec.update' and target_id = $2",
      [w.tenantId, s.id],
    );
    expect(a.rows.length).toBe(1);
    expect(a.rows[0]!.payload).toMatchObject({ ticket_id: t.id, changed: ["checked"] });
    expect(JSON.stringify(a.rows[0]!.payload)).not.toContain("宛名");
  });

  it("K435-API-002 チェックを外す：人が付けた行も AI が付けた行も 200・チェックの 3 つの列が空に戻る・版 +1・やり取りに「チェックを外しました」の 1 行", async () => {
    const t = await h.ticket(w);
    const byMember = await h.seed(t.id, { title: "人が付けた行", checked: "member" });
    const byAi = await h.seed(t.id, { title: "AI が付けた行", checked: "ai" });
    const me = await h.name(w.writer);
    for (const s of [byMember, byAi]) {
      const r = await patch(w.writer, s.id, { version: s.version, checked: false });
      expect(r.status, await r.clone().text()).toBe(200);
      expect((await item(r)).checked).toBe(false);
      expect(await h.row(s.id)).toMatchObject({
        checked_at: null,
        checked_by_member_id: null,
        checked_by_ai: false,
        version: s.version + 1,
        updated_by: w.writer.id,
      });
    }
    const ms = await h.messages(t.id);
    expect(ms.map((m) => m.body)).toEqual([
      `${me}が確認項目『人が付けた行』のチェックを外しました`,
      `${me}が確認項目『AI が付けた行』のチェックを外しました`,
    ]);
    expect(ms[0]!.changes).toEqual([{ field: "test_spec", from: true, to: false, note: "人が付けた行" }]);
    expect(ms[1]!.changes).toEqual([{ field: "test_spec", from: true, to: false, note: "AI が付けた行" }]);
    expect(ms.every((m) => m.author_member_id === w.writer.id)).toBe(true);
  });

  it("K435-API-003 変わらない体（付いている行に付ける・外れている行に外す・同じ文を送る）：200・版も updated_at もやり取りも証跡も動かない", async () => {
    const t = await h.ticket(w);
    const on = await h.seed(t.id, { title: "付いている行", checked: "member" });
    const off = await h.seed(t.id, { title: "外れている行" });
    for (const [s, body] of [
      [on, { version: on.version, checked: true }],
      [off, { version: off.version, checked: false }],
      [off, { version: off.version, title: "外れている行" }],
    ] as const) {
      const at = await updatedAt(s.id);
      const r = await patch(w.writer, s.id, body);
      expect(r.status, JSON.stringify(body)).toBe(200);
      expect(await updatedAt(s.id)).toBe(at);
      expect((await h.row(s.id))!.version).toBe(s.version);
    }
    expect((await h.messages(t.id)).length).toBe(0);
    expect(await audits(on.id, "update")).toBe(0);
    expect(await audits(off.id, "update")).toBe(0);
  });

  it("K435-API-004 文を直す（チェックが付いていない行）：200・前後の空白（全角も）を落とす・版 +1・チェックと並びと出どころはそのまま・やり取りに「直しました」の 1 行（前の文 → 新しい文）・証跡 1", async () => {
    const t = await h.ticket(w);
    await h.seed(t.id, { title: "最初の行" });
    const s = await h.seed(t.id, { title: "宛名を確かめる" });
    const me = await h.name(w.writer);
    const r = await patch(w.writer, s.id, { version: s.version, title: "　請求書の宛名を確かめる " });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await item(r)).toMatchObject({
      id: s.id,
      title: "請求書の宛名を確かめる",
      checked: false,
      position: 2,
      source: "manual",
    });
    expect(await h.row(s.id)).toMatchObject({
      title: "請求書の宛名を確かめる",
      version: s.version + 1,
      updated_by: w.writer.id,
      created_by: s.created_by,
    });
    const ms = await h.messages(t.id);
    expect(ms.length).toBe(1);
    expect(ms[0]).toMatchObject({
      author_member_id: w.writer.id,
      body: `${me}が確認項目『請求書の宛名を確かめる』を直しました`,
      changes: [
        { field: "test_spec", from: "宛名を確かめる", to: "請求書の宛名を確かめる", note: "請求書の宛名を確かめる" },
      ],
    });
    const a = await h.f.admin.query<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'test_spec.update' and target_id = $2",
      [w.tenantId, s.id],
    );
    expect(a.rows[0]!.payload).toMatchObject({ ticket_id: t.id, changed: ["title"] });
    expect(JSON.stringify(a.rows[0]!.payload)).not.toContain("宛名");
  });

  it("K435-API-005 チェックが付いている間は文を直せない：409・E-SPEC-021（体は error と code だけ）・行は変わらない。チェックを外してからなら直せる", async () => {
    const { t, s } = await setup({ checked: "member" });
    const r = await patch(w.writer, s.id, { version: s.version, title: "直したい文" });
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j["code"]).toBe("E-SPEC-021");
    expect(bareKeys(j), "field・details・detail を付けない").toEqual(BARE);
    expect(await h.row(s.id)).toMatchObject({ title: "宛名を確かめる", version: s.version });
    expect((await h.messages(t.id)).length).toBe(0);
    expect((await patch(w.writer, s.id, { version: s.version, checked: false })).status).toBe(200);
    const again = await patch(w.writer, s.id, { version: s.version + 1, title: "直したい文" });
    expect(again.status, await again.clone().text()).toBe(200);
    expect((await item(again)).title).toBe("直したい文");
  });

  it("K435-API-006 文の形：空・空白だけ（全角・タブも）・201 字・文字でない値は 422・VALIDATION_ERROR・details に title・行も版もやり取りも変わらない。200 字ちょうどは通る", async () => {
    const { t, s } = await setup();
    for (const bad of ["", "   ", "　\t\n　", "あ".repeat(201), 5, null, ["a"]]) {
      const r = await patch(w.writer, s.id, { version: s.version, title: bad });
      const j = await h.json(r);
      expect(r.status, JSON.stringify(bad).slice(0, 20)).toBe(422);
      expect(j["code"]).toBe("VALIDATION_ERROR");
      if (typeof bad === "string") expect(fieldsOf(j)).toContain("title"); // 文字でない値は契約の形の誤り（欄は口の入口が決める）
    }
    expect(await h.row(s.id)).toMatchObject({ title: "宛名を確かめる", version: s.version });
    expect((await h.messages(t.id)).length).toBe(0);
    const ok = await patch(w.writer, s.id, { version: s.version, title: "あ".repeat(200) });
    expect(ok.status).toBe(200);
    expect((await item(ok)).title).toBe("あ".repeat(200));
  });

  it("K435-API-007 体の形：checked か title のどちらか 1 つ・version が要る・知らない欄は 422（行は変わらない）", async () => {
    const { t, s } = await setup();
    const v = s.version;
    for (const [label, body] of [
      ["どちらも無い", { version: v }],
      ["両方", { version: v, checked: true, title: "両方" }],
      ["version が無い", { checked: true }],
    ] as const) {
      const r = await patch(w.writer, s.id, body);
      expect(r.status, label).toBe(422);
      expect((await h.json(r))["code"], label).toBe("VALIDATION_ERROR");
    }
    for (const bad of [0, -1, 1.5, "1", null]) {
      const r = await patch(w.writer, s.id, { version: bad, checked: true });
      expect(r.status, `version ${JSON.stringify(bad)}`).toBe(422);
      expect(fieldsOf(await h.json(r))).toContain("version");
    }
    for (const bad of ["yes", 1, null, "true"]) {
      const r = await patch(w.writer, s.id, { version: v, checked: bad });
      expect(r.status, `checked ${JSON.stringify(bad)}`).toBe(422);
      expect(fieldsOf(await h.json(r))).toContain("checked");
    }
    for (const extra of [
      { source: "ai" },
      { source_ref_id: randomUUID() },
      { checked_by_ai: true },
      { checked_at: "2026-01-01T00:00:00Z" },
      { id: randomUUID() },
      { ticket_id: randomUUID() },
      { check_kind: "human" },
      { judge_type: "required_field" },
      { off_reason: "手で見る" },
      { tenant_id: randomUUID() },
      { deleted_at: "2026-01-01T00:00:00Z" },
      { 知らない欄: 1 },
    ]) {
      const r = await patch(w.writer, s.id, { version: v, checked: true, ...extra });
      expect(r.status, JSON.stringify(extra)).toBe(422);
    }
    expect(await h.row(s.id)).toMatchObject({ checked_at: null, version: v });
    expect((await h.messages(t.id)).length).toBe(0);
  });

  it("K435-API-008 先に変えられた（版が今と違う）：今より小さくても大きくても 409・E-SPEC-020・体は error と code だけ・行も版もやり取りも証跡も変わらない", async () => {
    const { t, s } = await setup();
    const r1 = await patch(w.writer, s.id, { version: s.version, checked: true });
    expect(r1.status).toBe(200);
    const now = await ver(s.id);
    const before = await audits(s.id, "update");
    for (const stale of [now - 1, now + 1, now + 100]) {
      const r = await patch(w.writer, s.id, { version: stale, checked: false });
      expect(r.status, `版 ${stale}`).toBe(409);
      const j = await h.json(r);
      expect(j["code"]).toBe("E-SPEC-020");
      expect(bareKeys(j)).toEqual(BARE);
      const r2 = await patch(w.writer, s.id, { version: stale, title: "古い画面から直す" });
      expect(r2.status).toBe(409);
      expect((await h.json(r2))["code"]).toBe("E-SPEC-020");
    }
    expect(await h.row(s.id)).toMatchObject({ title: "宛名を確かめる", version: now });
    expect((await h.row(s.id))!.checked_at).not.toBeNull();
    expect((await h.messages(t.id)).length).toBe(1);
    expect(await audits(s.id, "update")).toBe(before);
  });

  it("K435-API-009 同じ版から同時に 2 人が直す：1 人は 200・もう 1 人は 409・E-SPEC-020。版は +1 だけ・題名は勝った方・やり取りは 1 行", async () => {
    const { t, s } = await setup();
    const [r1, r2] = await Promise.all([
      patch(w.writer, s.id, { version: s.version, title: "一人目" }),
      patch(w.writer, s.id, { version: s.version, title: "二人目" }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const lose = r1.status === 409 ? r1 : r2;
    expect((await h.json(lose))["code"]).toBe("E-SPEC-020");
    const row = (await h.row(s.id))!;
    expect(row.version).toBe(s.version + 1);
    expect(["一人目", "二人目"]).toContain(row.title);
    expect((await h.messages(t.id)).length).toBe(1);
  });

  it("K435-API-010 出どころ：ai・manual の行は付ける・外す・文を直す・行を外すが 200。knowledge の行はチェックの付け外しだけ 200 で、文を直す・行を外すは 409・E-SPEC-022（体は error と code だけ・行もやり取りも変わらない）", async () => {
    const t = await h.ticket(w);
    for (const source of ["manual", "ai"]) {
      const s = await h.seed(t.id, { title: `出どころ ${source}`, source, source_ref_id: randomUUID() });
      const c = await patch(w.writer, s.id, { version: s.version, checked: true });
      expect(c.status, source).toBe(200);
      expect((await item(c)).source).toBe(source);
      expect((await patch(w.writer, s.id, { version: s.version + 1, checked: false })).status, source).toBe(200);
      const e = await patch(w.writer, s.id, { version: s.version + 2, title: `直した ${source}` });
      expect(e.status, source).toBe(200);
      expect(await item(e)).toMatchObject({ title: `直した ${source}`, source });
      expect((await del(w.writer, s.id)).status, source).toBe(200);
      expect(await h.row(s.id)).toMatchObject({ source, deleted_at: expect.anything() });
    }
    const k = await h.seed(t.id, { title: "必ず守る宛名の確認", source: "knowledge", source_ref_id: randomUUID() });
    const on = await patch(w.writer, k.id, { version: k.version, checked: true });
    expect(on.status, await on.clone().text()).toBe(200);
    expect((await item(on)).source).toBe("knowledge");
    const off = await patch(w.writer, k.id, { version: k.version + 1, checked: false });
    expect(off.status).toBe(200);
    const before = { row: await h.row(k.id), messages: (await h.messages(t.id)).length };
    for (const [label, res] of [
      ["文を直す", await patch(w.writer, k.id, { version: k.version + 2, title: "書き換えた文" })],
      ["同じ文を送る", await patch(w.writer, k.id, { version: k.version + 2, title: "必ず守る宛名の確認" })],
      ["行を外す", await del(w.writer, k.id)],
    ] as const) {
      expect(res.status, label).toBe(409);
      const j = await h.json(res);
      expect(j["code"], label).toBe("E-SPEC-022");
      expect(bareKeys(j), `${label}：field・details・detail を付けない`).toEqual(BARE);
    }
    expect(await h.row(k.id), "行は変わらない").toEqual(before.row);
    expect((await h.messages(t.id)).length, "やり取りも増えない").toBe(before.messages);
  });

  it("K435-API-011 完了した後・消されたチケット：付ける・外す・直す・外すは完了後 409・E-SPEC-001・消されたチケットは 404（体は error と code だけ）・行もやり取りも証跡も変わらない", async () => {
    const done = await setup({ title: "完了前の行" });
    const checked = await h.seed(done.t.id, { title: "完了前にチェックした行", checked: "member" });
    await h.finish(done.t.id);
    const beforeMsgs = (await h.messages(done.t.id)).length;
    const calls: [string, () => Promise<Response>][] = [
      ["付ける", () => patch(w.writer, done.s.id, { version: done.s.version, checked: true })],
      ["外す", () => patch(w.writer, checked.id, { version: checked.version, checked: false })],
      ["直す", () => patch(w.writer, done.s.id, { version: done.s.version, title: "完了後に直す" })],
      ["行を外す", () => del(w.writer, done.s.id)],
    ];
    for (const [label, call] of calls) {
      const r = await call();
      expect(r.status, label).toBe(409);
      const j = await h.json(r);
      expect(j["code"], label).toBe("E-SPEC-001");
      expect(bareKeys(j), label).toEqual(BARE);
    }
    expect(await h.row(done.s.id)).toMatchObject({
      title: "完了前の行",
      checked_at: null,
      deleted_at: null,
      version: done.s.version,
    });
    expect((await h.row(checked.id))!.checked_at).not.toBeNull();
    expect((await h.messages(done.t.id)).length).toBe(beforeMsgs);
    const gone = await setup();
    await h.removeTicket(gone.t.id);
    for (const r of [
      await patch(w.writer, gone.s.id, { version: gone.s.version, checked: true }),
      await patch(w.writer, gone.s.id, { version: gone.s.version, title: "消されたチケット" }),
      await del(w.writer, gone.s.id),
    ]) {
      expect(r.status).toBe(404);
      expect(bareKeys(await h.json(r))).toEqual(BARE);
    }
    expect((await h.row(gone.s.id))!.deleted_at).toBeNull();
  });

  it("K435-API-012 変えられない人：読むだけの人 403・見えない人 404・別の会社の人 404・ログインなし 401（付ける・直す・外す とも）。行は変わらない", async () => {
    const { t, s } = await setup();
    const body = { version: s.version, checked: true };
    for (const [who, status, label] of [
      [w.viewer, 403, "読むだけ"],
      [w.stranger, 404, "見えない"],
      [wb.writer, 404, "別の会社"],
      [null, 401, "ログインなし"],
    ] as const) {
      expect((await patch(who, s.id, body)).status, `付ける ${label}`).toBe(status);
      expect((await patch(who, s.id, { version: s.version, title: "直す" })).status, `直す ${label}`).toBe(status);
      expect((await del(who, s.id)).status, `外す ${label}`).toBe(status);
    }
    for (const who of [w.stranger, wb.writer]) {
      const r = await patch(who, s.id, body);
      expect(bareKeys(await h.json(r))).toEqual(BARE);
    }
    expect(await h.row(s.id)).toMatchObject({ checked_at: null, deleted_at: null, version: s.version });
    expect((await h.messages(t.id)).length).toBe(0);
  });

  it("K435-API-013 消した行・無い id：付ける・直す・外すとも 404（体は error と code だけ）・版は変わらない・もう一度外しても 404", async () => {
    const { t, s } = await setup();
    expect((await del(w.writer, s.id)).status).toBe(200);
    const before = (await h.messages(t.id)).length;
    for (const id of [s.id, randomUUID()]) {
      for (const r of [
        await patch(w.writer, id, { version: 1, checked: true }),
        await patch(w.writer, id, { version: 1, title: "消した行を直す" }),
        await del(w.writer, id),
      ]) {
        expect(r.status).toBe(404);
        expect(bareKeys(await h.json(r))).toEqual(BARE);
      }
    }
    expect(await ver(s.id)).toBe(s.version);
    expect((await h.messages(t.id)).length).toBe(before);
  });

  it("K435-API-014 手順 S1 失敗（行・やり取り・証跡を書く所で落ちる）：付ける・直すとも 503・E-PAGE-003・チェックも文も版も変わらず、やり取りも証跡も無い。ログに文が出ない", async () => {
    const { t, s } = await setup();
    const undo = await h.breakAudit(w.tenantId, "test_spec.update");
    try {
      for (const body of [
        { version: s.version, checked: true },
        { version: s.version, title: "秘密の題名XYZ" },
      ]) {
        let status = 0;
        let code: unknown;
        const logs = await h.captureLogs(async () => {
          const r = await patch(w.writer, s.id, body);
          status = r.status;
          code = (await h.json(r))["code"];
        });
        expect(status, JSON.stringify(body)).toBe(503);
        expect(code).toBe("E-PAGE-003");
        expect(logs).not.toContain("XYZ");
        expect(logs).not.toContain("宛名");
      }
    } finally {
      await undo();
    }
    expect(await h.row(s.id)).toMatchObject({ title: "宛名を確かめる", checked_at: null, version: s.version });
    expect((await h.messages(t.id)).length).toBe(0);
    expect(await audits(s.id, "update")).toBe(0);
  });

  it("K435-API-015 上限：1 分あたりの上限を超えた「付ける・直す」は 429・retry_after_sec が付き、行は 2 回分だけ変わっている", async () => {
    const { s } = await setup();
    const me = await h.f.person(w.tenantId, w.rootScope, { name: "数える人 3", ticketAbility: "edit" });
    h.limit("updateTestSpec", 2);
    try {
      expect((await patch(me, s.id, { version: s.version, checked: true })).status).toBe(200);
      expect((await patch(me, s.id, { version: s.version + 1, checked: false })).status).toBe(200);
      const r = await patch(me, s.id, { version: s.version + 2, checked: true });
      expect(r.status).toBe(429);
      expect(typeof (await h.json(r))["retry_after_sec"]).toBe("number");
    } finally {
      h.limit("updateTestSpec", 100_000);
    }
    expect(await h.row(s.id)).toMatchObject({ checked_at: null, version: s.version + 2 });
  });
});

describe("K-435 行を外す（deleteTestSpec）", () => {
  it("K435-API-016 行を外す：200・外す前の姿を返す（position は外す前の番号）・deleted_at が入り行は残る・版はそのまま・一覧から消えて番号が詰まる・やり取りに「外しました」の 1 行・証跡 1。チェックが付いた行も外せる", async () => {
    const t = await h.ticket(w);
    const a = await h.seed(t.id, { title: "最初の行" });
    const b = await h.seed(t.id, { title: "チェックした真ん中の行", checked: "member" });
    const c = await h.seed(t.id, { title: "最後の行" });
    const me = await h.name(w.writer);
    const r = await del(w.writer, b.id);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await item(r);
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({ id: b.id, title: "チェックした真ん中の行", checked: true, position: 2 });
    const row = (await h.row(b.id))!;
    expect(row.deleted_at).not.toBeNull();
    expect(row.version).toBe(b.version);
    const list = await h.json(await h.call(w.writer, "GET", `/tickets/${t.id}/test-specs`));
    expect((list.data as Item[]).map((x) => [x.id, x.position])).toEqual([
      [a.id, 1],
      [c.id, 2],
    ]);
    const ms = await h.messages(t.id);
    expect(ms.length).toBe(1);
    expect(ms[0]).toMatchObject({
      author_member_id: w.writer.id,
      body: `${me}が確認項目『チェックした真ん中の行』を外しました`,
      changes: [{ field: "test_spec", from: "チェックした真ん中の行", to: null, note: "チェックした真ん中の行" }],
    });
    const au = await h.f.admin.query<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'test_spec.delete' and target_id = $2",
      [w.tenantId, b.id],
    );
    expect(au.rows.length).toBe(1);
    expect(au.rows[0]!.payload).toMatchObject({ ticket_id: t.id });
    expect(JSON.stringify(au.rows[0]!.payload)).not.toContain("真ん中");
  });

  it("K435-API-017 同時に 2 本で外す：200 が 1 つと 404 が 1 つ・やり取りも証跡も 1 つだけ。もう一度外すと 404", async () => {
    const { t, s } = await setup();
    const [r1, r2] = await Promise.all([del(w.writer, s.id), del(w.writer, s.id)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 404]);
    expect(await audits(s.id, "delete")).toBe(1);
    expect((await h.messages(t.id)).length).toBe(1);
    expect((await del(w.writer, s.id)).status).toBe(404);
  });

  it("K435-API-018 確かめの結果（checks）を持つ行を外す：200・checks の行は残り、行は deleted_at が入ったまま読める", async () => {
    const { t, s } = await setup();
    await h.f.admin.query(
      `insert into checks (tenant_id, ticket_id, test_spec_id, spec_version, result, runner, checked_by_member_id)
       values ($1, $2, $3, 1, 'pass', 'human', $4)`,
      [w.tenantId, t.id, s.id, w.writer.id],
    );
    const r = await del(w.writer, s.id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await h.count("select count(*) as n from checks where test_spec_id = $1", [s.id])).toBe(1);
    expect((await h.row(s.id))!.deleted_at).not.toBeNull();
  });

  it("K435-API-019 手順 S2 失敗（行を外す所・証跡を書く所で落ちる）：503・E-PAGE-003・行は残り、やり取りも証跡も無い", async () => {
    const { t, s } = await setup();
    const undo = await h.breakAudit(w.tenantId, "test_spec.delete");
    try {
      const r = await del(w.writer, s.id);
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await undo();
    }
    expect((await h.row(s.id))!.deleted_at).toBeNull();
    expect(await audits(s.id, "delete")).toBe(0);
    expect((await h.messages(t.id)).length).toBe(0);
  });

  it("K435-API-020 上限：1 分あたりの上限を超えた「外す」は 429・retry_after_sec が付き、3 つ目の行は残る", async () => {
    const t = await h.ticket(w);
    const ids = [(await h.seed(t.id)).id, (await h.seed(t.id)).id, (await h.seed(t.id)).id];
    const me = await h.f.person(w.tenantId, w.rootScope, { name: "数える人 4", ticketAbility: "edit" });
    h.limit("deleteTestSpec", 2);
    try {
      expect((await del(me, ids[0]!)).status).toBe(200);
      expect((await del(me, ids[1]!)).status).toBe(200);
      const r = await del(me, ids[2]!);
      expect(r.status).toBe(429);
      expect(typeof (await h.json(r))["retry_after_sec"]).toBe("number");
    } finally {
      h.limit("deleteTestSpec", 100_000);
    }
    expect((await h.row(ids[2]!))!.deleted_at).toBeNull();
  });
});

describe("K-435 完了の確定と同時", () => {
  it("K435-API-021 完了の確定と同時に付ける・直す・外す：チケットの行のロックを待ち、完了が確定した後は 409・E-SPEC-001（行は変わらず証跡も増えない）", async () => {
    for (const op of ["check", "edit", "delete"] as const) {
      const { t, s } = await setup();
      const act = op === "delete" ? "delete" : "update";
      const before = await audits(s.id, act);
      const c = await h.f.admin.connect();
      let committed = false;
      try {
        await c.query("begin");
        await c.query("select 1 from tickets where id = $1 for update", [t.id]);
        const pending =
          op === "check"
            ? patch(w.writer, s.id, { version: s.version, checked: true })
            : op === "edit"
              ? patch(w.writer, s.id, { version: s.version, title: "完了と同時に直す" })
              : del(w.writer, s.id);
        await h.untilLockWaiter(`test_spec_${act}`);
        await c.query(
          `update tickets t set stage_id = d.id, completed_at = now(), completed_by = t.assignee_member_id
             from ticket_stages d where t.id = $1 and d.tenant_id = t.tenant_id and d.key = 'done'`,
          [t.id],
        );
        await c.query("commit");
        committed = true;
        const r = await pending;
        expect(r.status, op).toBe(409);
        const j = await h.json(r);
        expect(j["code"], op).toBe("E-SPEC-001");
        expect(bareKeys(j), `${op}：field・details・detail を付けない`).toEqual(BARE);
      } finally {
        if (!committed) await c.query("rollback");
        c.release();
      }
      expect(await h.row(s.id), op).toMatchObject({
        title: "宛名を確かめる",
        checked_at: null,
        version: s.version,
        deleted_at: null,
      });
      expect(await audits(s.id, act), op).toBe(before);
      expect((await h.messages(t.id)).length, op).toBe(0);
    }
  });
});
