// K-952 返事を書く（postInquiryMessage・POST /api/v1/inquiries/:id/messages）と済みにする（resolveMyInquiry・POST /api/v1/inquiries/:id/resolve）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-948：書き込みは MyInquiryMessage の 6 欄・済みは MyInquiry の 7 欄。済みの後に書くと開き直る（D-156.25）。
//   DB の関数 app.inquiry_post・app.inquiry_resolve は K-952 の migration
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startInquiries, isFlat, MY_INQUIRY, MY_MESSAGE, type Inquiries, type World } from "./inquiry.harness.js";

let t: Inquiries;
let w: World;
let far: World;

beforeAll(async () => {
  t = await startInquiries("k952", ["inquiry-reply", "inquiry-create"]);
  w = await t.world("山口商事");
  far = await t.world("遠くの会社");
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const post = (id: string, o: Row = {}, who = w.asker) =>
  t.call(who, "POST", `/inquiries/${id}/messages`, { body: "まだ実行待ちのままです", ...o });
const resolve = (id: string, who = w.asker) => t.call(who, "POST", `/inquiries/${id}/resolve`, {});
const fresh = async () => String((await t.ask(w.asker))["id"]);
const state = async (id: string) =>
  t.row<{ s: string; l: Date | null; m: Date }>(
    "select state as s, later_until as l, last_message_at as m from inquiries where id = $1",
    [id],
  );
const msgs = (id: string) =>
  t.n(
    "select count(*) as n from messages m join inquiries i on i.conversation_id = m.conversation_id where i.id = $1",
    [id],
  );

describe("K-952 返事を書く", () => {
  it("K952-API-001 201 で 6 欄（from me・本人の名前）。書き込みは見え方 all・問い合わせは open に戻り、やり取りの時刻が進む。運営への知らせは作らない", async () => {
    const id = await fresh();
    await t.opsReply(id, "確かめます", { afterSec: -5 });
    const before = (await state(id))!.m;
    const notes = await t.n("select count(*) as n from notifications where tenant_id = $1", [w.tenantId]);
    const r = await post(id);
    expect(r.status).toBe(201);
    const d = (await t.json(r)).data as Row;
    expect(Object.keys(d).sort()).toEqual(MY_MESSAGE);
    expect(d).toMatchObject({ from: "me", author_name: "田中", body: "まだ実行待ちのままです", attachments: [] });
    const m = await t.row<Row>("select visibility, sender_member_id, kind from messages where id = $1", [d["id"]]);
    expect(m).toMatchObject({ visibility: "all", sender_member_id: w.asker.id, kind: "inquiry" });
    const s = (await state(id))!;
    expect(s.s).toBe("open");
    expect(s.m.getTime()).toBeGreaterThan(before.getTime());
    expect(await t.n("select count(*) as n from notifications where tenant_id = $1", [w.tenantId])).toBe(notes);
  });

  it("K952-API-002 済み・後でにされた問い合わせに書くと open に戻り（開き直る）、後での期限も消える", async () => {
    for (const from of ["done", "later"] as const) {
      const id = await fresh();
      await t.setState(id, from);
      await t.f.admin.query("update inquiries set later_until = now() + interval '1 day' where id = $1", [id]);
      expect((await post(id)).status, from).toBe(201);
      const s = (await state(id))!;
      expect(s.s, from).toBe("open");
      expect(s.l, from).toBeNull();
    }
  });

  it("K952-API-003 検査の済んだ自分の添付は付き、使えない添付は 409 E-INQ-001・無い添付は 404 E-PAGE-001。断ったら書き込みは増えない", async () => {
    const id = await fresh();
    const a = await t.attachment(w.asker, { name: "記録.pdf", mime: "application/pdf", size: 500 });
    const r = await post(id, { attachment_ids: [a] });
    expect(r.status).toBe(201);
    expect(((await t.json(r)).data as Row)["attachments"]).toEqual([{ id: a, name: "記録.pdf", size: 500 }]);
    const n0 = await msgs(id);
    const unusable = await post(id, { attachment_ids: [await t.attachment(w.asker, { checked: false })] });
    expect(unusable.status).toBe(409);
    const ub = await t.json(unusable);
    expect(ub["code"]).toBe("E-INQ-001");
    expect(isFlat(ub)).toBe(true);
    const missing = await post(id, { attachment_ids: [randomUUID()] });
    expect(missing.status).toBe(404);
    expect((await t.json(missing))["code"]).toBe("E-PAGE-001");
    expect(await msgs(id)).toBe(n0);
  });

  it("K952-API-004 他人の（同じ会社の管理者が書く）・別の会社の・無い・消した問い合わせは 404 E-PAGE-001（欄・details なし）で何も書かない", async () => {
    const id = await fresh();
    const gone = await fresh();
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    for (const [who, target] of [
      [w.admin, id],
      [far.asker, id],
      [w.asker, randomUUID()],
      [w.asker, gone],
    ] as const) {
      const r = await post(target, {}, who);
      expect(r.status).toBe(404);
      const b = await t.json(r);
      expect(b["code"]).toBe("E-PAGE-001");
      expect(isFlat(b)).toBe(true);
    }
    expect(await msgs(id)).toBe(1);
  });

  it("K952-API-005 内容が空白だけ・NUL を含む・余計な欄（visibility・from）は 422 で何も書かない", async () => {
    const id = await fresh();
    for (const o of [{ body: " \n　" }, { body: "途中に\u0000" }, { visibility: "ops_only" }, { from: "ops" }]) {
      expect((await post(id, o)).status, JSON.stringify(o)).toBe(422);
    }
    expect(await msgs(id)).toBe(1);
  });

  it("K952-API-006 同時に 2 つ書くと、どちらも 201 で 2 つとも残る", async () => {
    const id = await fresh();
    const rs = await Promise.all([post(id, { body: "1 つ目" }), post(id, { body: "2 つ目" })]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    expect(await msgs(id)).toBe(3);
  });

  it("K952-API-007 DB が落ちると 503 E-PAGE-003 で、書き込みも状態も変わらない", async () => {
    const id = await fresh();
    await t.setState(id, "done");
    const restore = await t.breakWrites("messages", { tenant_id: w.tenantId });
    try {
      const r = await post(id);
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(await msgs(id)).toBe(1);
    expect((await state(id))!.s).toBe("done");
  });
});

describe("K-952 済みにする", () => {
  it("K952-API-008 200 で 7 欄・state done。DB の状態も done", async () => {
    const id = await fresh();
    const r = await resolve(id);
    expect(r.status).toBe(200);
    const d = (await t.json(r)).data as Row;
    expect(Object.keys(d).sort()).toEqual(MY_INQUIRY);
    expect(d["state"]).toBe("done");
    expect((await state(id))!.s).toBe("done");
  });

  it("K952-API-009 もう済みのものを済みにしても 200 で done のまま・記録は増えない", async () => {
    const id = await fresh();
    expect((await resolve(id)).status).toBe(200);
    const n = await t.n("select count(*) as n from audit_events where target_id = $1 and action = 'inquiry.resolve'", [
      id,
    ]);
    const r = await resolve(id);
    expect(r.status).toBe(200);
    expect(((await t.json(r)).data as Row)["state"]).toBe("done");
    expect(
      await t.n("select count(*) as n from audit_events where target_id = $1 and action = 'inquiry.resolve'", [id]),
    ).toBe(n);
  });

  it("K952-API-010 他人の・別の会社の・無い問い合わせは 404 E-PAGE-001（欄・details なし）で状態は変わらない", async () => {
    const id = await fresh();
    for (const [who, target] of [
      [w.admin, id],
      [far.asker, id],
      [w.asker, randomUUID()],
    ] as const) {
      const r = await resolve(target, who);
      expect(r.status).toBe(404);
      expect(isFlat(await t.json(r))).toBe(true);
    }
    expect((await state(id))!.s).toBe("open");
  });

  it("K952-API-011 済みにした後に書くと open に戻り、もう一度済みにできる", async () => {
    const id = await fresh();
    expect((await resolve(id)).status).toBe(200);
    expect((await post(id, { body: "もう一度聞きます" })).status).toBe(201);
    expect((await state(id))!.s).toBe("open");
    expect((await resolve(id)).status).toBe(200);
    expect((await state(id))!.s).toBe("done");
  });
});

describe("K-952 共通", () => {
  it("K952-API-012 ログインしていないと 401・先方の権限の人は 403。どちらも何も変えない", async () => {
    const id = await fresh();
    expect((await t.call(null, "POST", `/inquiries/${id}/messages`, { body: "x" })).status).toBe(401);
    expect((await t.call(null, "POST", `/inquiries/${id}/resolve`, {})).status).toBe(401);
    expect((await post(id, {}, w.guest)).status).toBe(403);
    expect((await resolve(id, w.guest)).status).toBe(403);
    expect(await msgs(id)).toBe(1);
    expect((await state(id))!.s).toBe("open");
  });

  it("K952-API-013 記録：書くと inquiry.message・済みにすると inquiry.resolve が 1 行ずつ（C2・内容の字は入れない）", async () => {
    const id = await fresh();
    expect((await post(id, { body: "記録の内容 R8" })).status).toBe(201);
    expect((await resolve(id)).status).toBe(200);
    const rows = (
      await t.f.admin.query<{ a: string; c: string; p: unknown }>(
        "select action as a, choke_point_id as c, payload as p from audit_events where target_id = $1 and action in ('inquiry.message', 'inquiry.resolve') order by created_at",
        [id],
      )
    ).rows;
    expect(rows.map((x) => [x.a, x.c])).toEqual([
      ["inquiry.message", "C2"],
      ["inquiry.resolve", "C2"],
    ]);
    expect(JSON.stringify(rows)).not.toContain("R8");
  });

  it("K952-API-014 上限を超えると 429・retry_after_sec は 1〜60 の整数", async () => {
    const id = await fresh();
    t.f.limits["postInquiryMessage"] = 1;
    try {
      const ip = "203.0.113.247";
      const send = () =>
        t.f.req("POST", `/inquiries/${id}/messages`, { headers: w.asker.auth, body: { body: "x" }, ip });
      expect((await send()).status).toBe(201);
      const r = await send();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["postInquiryMessage"];
    }
  });
});
