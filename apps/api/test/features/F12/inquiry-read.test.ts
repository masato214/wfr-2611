// K-951 自分の問い合わせを読む（listMyInquiries・GET /api/v1/inquiries／getMyInquiry・GET /api/v1/inquiries/:id）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-948：MyInquiry の 7 欄・1 件は 7 欄と messages（MyInquiryMessage の 6 欄・社内メモは含めない）。
//   見えるのは書いた本人だけ（D-156.25）。開いたら読んだ印（inquiries.asker_read_at）が入る
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startInquiries, isFlat, MY_INQUIRY, MY_MESSAGE, type Inquiries, type World } from "./inquiry.harness.js";

let t: Inquiries;
let w: World;
let far: World;

beforeAll(async () => {
  t = await startInquiries("k951", ["inquiry-read", "inquiry-create"]);
  w = await t.world("山口商事");
  far = await t.world("遠くの会社");
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const list = async (who = w.asker, q = "") => {
  const r = await t.call(who, "GET", `/inquiries${q}`);
  return { r, b: await t.json(r) };
};
const one = async (id: string, who = w.asker) => {
  const r = await t.call(who, "GET", `/inquiries/${id}`);
  return { r, b: await t.json(r) };
};
const byId = (rows: unknown, id: unknown) => (rows as Row[]).find((x) => x["id"] === id);

describe("K-951 自分の問い合わせの一覧", () => {
  it("K951-API-001 本人の問い合わせだけが 7 欄で、やり取りの新しい順に並ぶ", async () => {
    const me = await t.world("並び");
    const a = await t.ask(me.asker, { title: "古い" });
    const b = await t.ask(me.asker, { title: "新しい" });
    await t.opsReply(String(a["id"]), "返事します", { afterSec: 30 });
    const { r, b: body } = await list(me.asker);
    expect(r.status).toBe(200);
    const rows = body.data as Row[];
    expect(rows.map((x) => x["title"])).toEqual(["古い", "新しい"]);
    for (const x of rows) expect(Object.keys(x).sort()).toEqual(MY_INQUIRY);
    expect(rows.map((x) => x["id"])).toEqual([a["id"], b["id"]]);
  });

  it("K951-API-002 同じ会社の管理者の一覧にも、別の会社の人の一覧にも、他人の問い合わせは出ない", async () => {
    const d = await t.ask(w.asker, { title: "本人だけ" });
    expect(byId((await list(w.asker)).b.data, d["id"])).toBeDefined();
    expect(byId((await list(w.admin)).b.data, d["id"])).toBeUndefined();
    expect(byId((await list(far.asker)).b.data, d["id"])).toBeUndefined();
  });

  it("K951-API-003 状態の読み替え：open・later は返事を待っている（waiting）・waiting は返事あり（replied）・done は済み（done）", async () => {
    const d = await t.ask(w.asker);
    const id = String(d["id"]);
    for (const [db, shown] of [
      ["open", "waiting"],
      ["later", "waiting"],
      ["waiting", "replied"],
      ["done", "done"],
    ] as const) {
      await t.setState(id, db);
      expect(byId((await list()).b.data, id)!["state"], db).toBe(shown);
    }
  });

  it("K951-API-004 運営の返事があって開いていないと has_unread_reply は true・last_reply_at は最新の返事の時刻。社内メモだけでは変わらない", async () => {
    const d = await t.ask(w.asker);
    const id = String(d["id"]);
    await t.opsReply(id, "社内メモ", { note: true, afterSec: 5 });
    let x = byId((await list()).b.data, id)!;
    expect(x["has_unread_reply"]).toBe(false);
    expect(x["last_reply_at"]).toBeNull();
    await t.opsReply(id, "確かめます", { afterSec: 10 });
    await t.opsReply(id, "直りました", { afterSec: 20 });
    x = byId((await list()).b.data, id)!;
    expect(x["has_unread_reply"]).toBe(true);
    const latest = await t.row<{ at: Date }>(
      "select max(m.created_at) as at from messages m join inquiries i on i.conversation_id = m.conversation_id where i.id = $1 and m.visibility = 'all' and m.sender_member_id is null",
      [id],
    );
    expect(new Date(String(x["last_reply_at"])).getTime()).toBe(latest!.at.getTime());
  });

  it("K951-API-005 1 件も無ければ 200 で data は空", async () => {
    const empty = await t.world("はじめ");
    const { r, b } = await list(empty.asker);
    expect(r.status).toBe(200);
    expect(b.data).toEqual([]);
  });

  it("K951-API-006 limit=2 で 2 件と次の cursor・次の cursor で残り 1 件（重ならない・抜けない）", async () => {
    const me = await t.world("ページ");
    for (const title of ["1", "2", "3"]) await t.ask(me.asker, { title });
    const p1 = await list(me.asker, "?limit=2");
    expect(p1.r.status).toBe(200);
    const first = p1.b.data as Row[];
    expect(first).toHaveLength(2);
    const next = (p1.b["meta"] as Row | undefined)?.["next_cursor"];
    expect(typeof next).toBe("string");
    const p2 = await list(me.asker, `?limit=2&cursor=${encodeURIComponent(String(next))}`);
    const second = p2.b.data as Row[];
    expect(second).toHaveLength(1);
    expect(new Set([...first, ...second].map((x) => x["title"]))).toEqual(new Set(["1", "2", "3"]));
  });

  it("K951-API-007 消した問い合わせは一覧に出ず、1 件を開くと 404", async () => {
    const d = await t.ask(w.asker);
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [d["id"]]);
    expect(byId((await list()).b.data, d["id"])).toBeUndefined();
    expect((await one(String(d["id"]))).r.status).toBe(404);
  });
});

describe("K-951 問い合わせ 1 件", () => {
  it("K951-API-008 7 欄と messages と context（問い合わせたときの画面の情報・無ければ null・D-156.39）。やり取りは時刻の順で、本人の書き込みは me・運営の返事は ops と名前の写し。社内メモは出ない", async () => {
    const a = await t.attachment(w.asker, { name: "画面.png", size: 3000 });
    const d = await t.ask(w.asker, { body: "最初の内容", attachment_ids: [a] });
    const id = String(d["id"]);
    await t.opsReply(id, "社内メモ：請求の件", { note: true, afterSec: 5 });
    await t.opsReply(id, "確かめます", { afterSec: 10, name: "運営 佐藤" });
    const { r, b } = await one(id);
    expect(r.status).toBe(200);
    const data = b.data as Row;
    expect(Object.keys(data).sort()).toEqual([...MY_INQUIRY, "context", "messages"].sort());
    expect(data["context"]).toBeNull();
    const msgs = data["messages"] as Row[];
    expect(msgs.map((m) => [m["from"], m["body"]])).toEqual([
      ["me", "最初の内容"],
      ["ops", "確かめます"],
    ]);
    for (const m of msgs) expect(Object.keys(m).sort()).toEqual(MY_MESSAGE);
    expect(msgs[0]!["author_name"]).toBe("田中");
    expect(msgs[1]!["author_name"]).toBe("運営 佐藤");
    expect(msgs[0]!["attachments"]).toEqual([{ id: a, name: "画面.png", size: 3000 }]);
    expect(msgs[1]!["attachments"]).toEqual([]);
    expect(JSON.stringify(b)).not.toContain("社内メモ");
    const ctx = { path: "/tickets/abc", at: "2026-11-02T00:38:00Z", browser: "Chrome 130", pc: true };
    await t.f.admin.query("update inquiries set context = $2::jsonb where id = $1", [id, JSON.stringify(ctx)]);
    expect(((await one(id)).b.data as Row)["context"]).toEqual(ctx);
  });

  it("K951-API-009 開くと読んだ印が入り、一覧の has_unread_reply が false になる。後から返事が来るとまた true", async () => {
    const d = await t.ask(w.asker);
    const id = String(d["id"]);
    await t.opsReply(id, "1 回目", { afterSec: -5 });
    expect(byId((await list()).b.data, id)!["has_unread_reply"]).toBe(true);
    expect((await one(id)).r.status).toBe(200);
    expect(
      (await t.row<{ r: Date | null }>("select asker_read_at as r from inquiries where id = $1", [id]))!.r,
    ).not.toBeNull();
    expect(byId((await list()).b.data, id)!["has_unread_reply"]).toBe(false);
    await t.opsReply(id, "2 回目", { afterSec: 120 });
    expect(byId((await list()).b.data, id)!["has_unread_reply"]).toBe(true);
  });

  it("K951-API-010 他人の（同じ会社の管理者が開く）・別の会社の・無い問い合わせは 404（欄・details なし）で、読んだ印も入らない", async () => {
    const d = await t.ask(w.asker);
    const id = String(d["id"]);
    for (const [who, target] of [
      [w.admin, id],
      [far.asker, id],
      [w.asker, randomUUID()],
    ] as const) {
      const { r, b } = await one(target, who);
      expect(r.status).toBe(404);
      expect(b["code"]).toBe("E-PAGE-001");
      expect(isFlat(b)).toBe(true);
    }
    expect(
      (await t.row<{ r: Date | null }>("select asker_read_at as r from inquiries where id = $1", [id]))!.r,
    ).toBeNull();
  });

  it("K951-API-011 ログインしていないと一覧も 1 件も 401・先方の権限の人は 403", async () => {
    const d = await t.ask(w.asker);
    expect((await t.call(null, "GET", "/inquiries")).status).toBe(401);
    expect((await t.call(null, "GET", `/inquiries/${d["id"]}`)).status).toBe(401);
    expect((await t.call(w.guest, "GET", "/inquiries")).status).toBe(403);
    expect((await t.call(w.guest, "GET", `/inquiries/${d["id"]}`)).status).toBe(403);
  });

  it("K951-API-012 上限を超えると 429・retry_after_sec は 1〜60 の整数", async () => {
    t.f.limits["listMyInquiries"] = 1;
    try {
      const ip = "203.0.113.248";
      const send = () => t.f.req("GET", "/inquiries", { headers: w.asker.auth, ip });
      expect((await send()).status).toBe(200);
      const r = await send();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["listMyInquiries"];
    }
  });

  it("K951-API-013 読んだ印を書けない（DB が落ちる）と 503 E-PAGE-003 で、答えに中身を出さない", async () => {
    const d = await t.ask(w.asker, { title: "落ちたとき M4" });
    const restore = await t.breakWrites("inquiries", { tenant_id: w.tenantId });
    try {
      const { r, b } = await one(String(d["id"]));
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(b)).not.toContain("M4");
    } finally {
      await restore();
    }
  });
});
