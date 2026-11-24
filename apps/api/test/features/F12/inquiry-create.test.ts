// K-949 問い合わせる（createInquiry・POST /api/v1/inquiries）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-948 の「画面が使う答えの形」：MyInquiry の 7 欄（id・title・topic・state・created_at・last_reply_at・has_unread_reply）。
//   DB の関数 app.inquiry_create と列（inquiries の title・topic_key・state・asker_read_at・last_message_at／messages の visibility・author_name）は K-949 の migration
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { startInquiries, isFlat, MY_INQUIRY, type Inquiries, type World } from "./inquiry.harness.js";

let t: Inquiries;
let w: World;
let far: World;

beforeAll(async () => {
  t = await startInquiries("k949", ["inquiry-create"]);
  w = await t.world("山口商事");
  far = await t.world("遠くの会社");
});
afterAll(async () => {
  await t.close();
});

const body = (o: Record<string, unknown> = {}) => ({
  topic: "trouble",
  title: "PC をつけているのに実行待ちのまま",
  body: "朝から実行待ちのままです",
  ...o,
});
const post = (o: Record<string, unknown> = {}, who = w.asker, headers?: Record<string, string>) =>
  headers
    ? t.f.req("POST", "/inquiries", { headers: { ...who.auth, ...headers }, body: body(o) })
    : t.call(who, "POST", "/inquiries", body(o));
const count = (tenantId = w.tenantId) => t.n("select count(*) as n from inquiries where tenant_id = $1", [tenantId]);

describe("K-949 問い合わせる", () => {
  it("K949-API-001 送ると 201 で 7 欄・顧客の状態は返事を待っている・運営の受信箱の「担当なし」に入る形で行ができる", async () => {
    const r = await post();
    expect(r.status).toBe(201);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(MY_INQUIRY);
    expect(d).toMatchObject({
      title: "PC をつけているのに実行待ちのまま",
      topic: "trouble",
      state: "waiting",
      last_reply_at: null,
      has_unread_reply: false,
    });
    const q = await t.row<Record<string, unknown>>(
      "select opened_by_member_id, state, topic_key, title, assignee_ops_member_id, later_until, conversation_id from inquiries where id = $1",
      [d["id"]],
    );
    expect(q).toMatchObject({
      opened_by_member_id: w.asker.id,
      state: "open",
      topic_key: "trouble",
      assignee_ops_member_id: null,
      later_until: null,
    });
    const m = await t.row<Record<string, unknown>>(
      "select body, visibility, sender_member_id from messages where conversation_id = $1",
      [q!["conversation_id"]],
    );
    expect(m).toMatchObject({ body: "朝から実行待ちのままです", visibility: "all", sender_member_id: w.asker.id });
    const c = await t.row<{ o: string }>("select owner_member_id as o from conversations where id = $1", [
      q!["conversation_id"],
    ]);
    expect(c!.o).toBe(w.asker.id);
  });

  it("K949-API-002 何について は 4 つ（usage・trouble・billing・other）が通り、ほかの字は 422 で何も書かない", async () => {
    for (const topic of ["usage", "trouble", "billing", "other"]) {
      const r = await post({ topic });
      expect(r.status, topic).toBe(201);
      expect(((await t.json(r)).data as Record<string, unknown>)["topic"]).toBe(topic);
    }
    const before = await count();
    const bad = await post({ topic: "request" });
    expect(bad.status).toBe(422);
    expect(await count()).toBe(before);
  });

  it("K949-API-003 題と内容は前後の空白を落として残し、空白だけは 422（契約の形）で何も書かない", async () => {
    const r = await post({ title: "　 請求書の宛名 \t", body: "\n宛名を変えたい  " });
    expect(r.status).toBe(201);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(d["title"]).toBe("請求書の宛名");
    const m = await t.row<{ b: string }>(
      "select m.body as b from messages m join inquiries i on i.conversation_id = m.conversation_id where i.id = $1",
      [d["id"]],
    );
    expect(m!.b).toBe("宛名を変えたい");
    const before = await count();
    expect((await post({ title: "　  " })).status).toBe(422);
    expect((await post({ body: " \n " })).status).toBe(422);
    expect(await count()).toBe(before);
  });

  it("K949-API-004 検査の済んだ自分の添付 2 つを付けると、最初の書き込みに名前と大きさが付き、添付はその問い合わせの物になる", async () => {
    const a = await t.attachment(w.asker, { name: "画面.png", size: 3000 });
    const b = await t.attachment(w.asker, { name: "ログ.zip", mime: "application/zip", size: 9000 });
    const r = await post({ attachment_ids: [a, b] });
    expect(r.status).toBe(201);
    const id = ((await t.json(r)).data as Record<string, unknown>)["id"];
    const m = await t.row<{ id: string; at: { id: string; name: string; size: number }[] }>(
      "select m.id, m.attachments as at from messages m join inquiries i on i.conversation_id = m.conversation_id where i.id = $1",
      [id],
    );
    expect(m!.at).toEqual([
      { id: a, name: "画面.png", size: 3000 },
      { id: b, name: "ログ.zip", size: 9000 },
    ]);
    expect(
      await t.n("select count(*) as n from attachments where id = any($1::uuid[]) and owner_id = $2", [[a, b], m!.id]),
    ).toBe(2);
  });

  it("K949-API-005 無い・別の人の・別の会社の・消した添付は 404 E-PAGE-001（欄・details なし）で何も書かない", async () => {
    const otherPerson = await t.attachment(w.asker, { owner: w.admin });
    const otherCompany = await t.attachment(far.asker);
    const deleted = await t.attachment(w.asker, { deleted: true });
    for (const id of [randomUUID(), otherPerson, otherCompany, deleted]) {
      const before = await count();
      const r = await post({ attachment_ids: [id] });
      expect(r.status).toBe(404);
      const b = await t.json(r);
      expect(b["code"]).toBe("E-PAGE-001");
      expect(isFlat(b)).toBe(true);
      expect(await count()).toBe(before);
    }
  });

  it("K949-API-006 検査が済んでいない・もう使った添付は 409 E-INQ-001（欄・details なし）で何も書かず、添付も動かない", async () => {
    const pending = await t.attachment(w.asker, { checked: false });
    const used = await t.attachment(w.asker, { used: true });
    for (const id of [pending, used]) {
      const before = await count();
      const owner = await t.row<{ o: string | null }>("select owner_id as o from attachments where id = $1", [id]);
      const r = await post({ attachment_ids: [id] });
      expect(r.status).toBe(409);
      const b = await t.json(r);
      expect(b["code"]).toBe("E-INQ-001");
      expect(isFlat(b)).toBe(true);
      expect(await count()).toBe(before);
      expect((await t.row<{ o: string | null }>("select owner_id as o from attachments where id = $1", [id]))!.o).toBe(
        owner!.o,
      );
    }
  });

  it("K949-API-007 同じ添付の id を 2 回並べても 1 つとして付ける", async () => {
    const a = await t.attachment(w.asker);
    const r = await post({ attachment_ids: [a, a] });
    expect(r.status).toBe(201);
    const id = ((await t.json(r)).data as Record<string, unknown>)["id"];
    const m = await t.row<{ at: unknown[] }>(
      "select m.attachments as at from messages m join inquiries i on i.conversation_id = m.conversation_id where i.id = $1",
      [id],
    );
    expect(m!.at).toHaveLength(1);
  });

  it("K949-API-008 画面の情報は 道・時刻・ブラウザ・PC の 4 つだけ残し、知らない鍵と型の違う値は落とす。付けなければ空", async () => {
    const r = await post({
      context: {
        path: "/tickets/abc",
        at: "2026-12-01T09:00:00+09:00",
        browser: "Chrome 130",
        pc: true,
        ticket_body: "中身",
        pcx: 1,
      },
    });
    expect(r.status).toBe(201);
    const id = ((await t.json(r)).data as Record<string, unknown>)["id"];
    expect((await t.row<{ c: unknown }>("select context as c from inquiries where id = $1", [id]))!.c).toEqual({
      path: "/tickets/abc",
      at: "2026-12-01T09:00:00+09:00",
      browser: "Chrome 130",
      pc: true,
    });
    const r2 = await post({ context: { path: 5, pc: "はい" } });
    const id2 = ((await t.json(r2)).data as Record<string, unknown>)["id"];
    expect((await t.row<{ c: unknown }>("select context as c from inquiries where id = $1", [id2]))!.c).toEqual({});
    const r3 = await post();
    const id3 = ((await t.json(r3)).data as Record<string, unknown>)["id"];
    expect((await t.row<{ c: unknown }>("select context as c from inquiries where id = $1", [id3]))!.c).toEqual({});
  });

  it("K949-API-009 先方の権限の人（role client）は 403 で何も書かない（書けるのは R1〜R3・D-156.26）", async () => {
    const before = await count();
    const r = await post({}, w.guest);
    expect(r.status).toBe(403);
    expect(await count()).toBe(before);
  });

  it("K949-API-010 ログインしていないと 401 で何も書かない", async () => {
    const before = await count();
    const r = await t.call(null, "POST", "/inquiries", body());
    expect(r.status).toBe(401);
    expect(await count()).toBe(before);
  });

  it("K949-API-011 上限を超えると 429・retry_after_sec は 1〜60 の整数", async () => {
    t.f.limits["createInquiry"] = 1;
    try {
      const ip = "203.0.113.249";
      const send = () => t.f.req("POST", "/inquiries", { headers: w.admin.auth, body: body(), ip });
      expect((await send()).status).toBe(201);
      const r = await send();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["createInquiry"];
    }
  });

  it("K949-API-012 余計な欄（tenant_id・state・opened_by_member_id）と NUL を含む内容は 422 で何も書かない", async () => {
    const before = await count();
    for (const extra of [{ tenant_id: far.tenantId }, { state: "done" }, { opened_by_member_id: w.admin.id }]) {
      expect((await post(extra)).status).toBe(422);
    }
    expect((await post({ body: "途中に\u0000がある" })).status).toBe(422);
    expect(await count()).toBe(before);
  });

  it("K949-API-013 DB が落ちると 503 E-PAGE-003・問い合わせも会話も書き込みも残らず、ログに内容の字が出ない", async () => {
    const restore = await t.breakWrites("messages", { tenant_id: w.tenantId });
    const before = await count();
    const conv = await t.n("select count(*) as n from conversations where tenant_id = $1", [w.tenantId]);
    const errs: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => errs.push(a.map(String).join(" "));
    try {
      const r = await post({ title: "秘密の題 Z9", body: "秘密の内容 Z9" });
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      console.error = orig;
      await restore();
    }
    expect(await count()).toBe(before);
    expect(await t.n("select count(*) as n from conversations where tenant_id = $1", [w.tenantId])).toBe(conv);
    expect(errs.join("\n")).not.toContain("Z9");
  });

  it("K949-API-014 記録に inquiry.create が 1 行（関門 C2・何について だけ。題と内容は入れない）", async () => {
    const d = (await t.ask(w.asker, { title: "記録の題 Q7", body: "記録の内容 Q7", topic: "billing" })) as Record<
      string,
      unknown
    >;
    const a = await t.row<{ n: string; p: Record<string, unknown>; c: string }>(
      "select count(*) over () as n, payload as p, choke_point_id as c from audit_events where target_id = $1 and action = 'inquiry.create'",
      [d["id"]],
    );
    expect(Number(a!.n)).toBe(1);
    expect(a!.c).toBe("C2");
    expect(a!.p["topic"]).toBe("billing");
    expect(JSON.stringify(a!.p)).not.toContain("Q7");
  });

  it("K949-API-015 同じ冪等の鍵で 2 回送ると問い合わせは 1 件で、2 回目も同じ答え", async () => {
    const before = await count();
    const key = randomUUID();
    const r1 = await post({}, w.asker, { "idempotency-key": key });
    const r2 = await post({}, w.asker, { "idempotency-key": key });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(((await t.json(r2)).data as Record<string, unknown>)["id"]).toBe(
      ((await t.json(r1)).data as Record<string, unknown>)["id"],
    );
    expect(await count()).toBe(before + 1);
  });

  it("K949-API-016 同じ添付を 2 つの問い合わせに同時に付けると、片方は 201・もう片方は 409 E-INQ-001", async () => {
    const a = await t.attachment(w.asker);
    const rs = await Promise.all([post({ attachment_ids: [a] }), post({ attachment_ids: [a] })]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    const bad = rs.find((r) => r.status === 409)!;
    expect((await t.json(bad))["code"]).toBe("E-INQ-001");
  });

  it("K949-API-017 同じ会社の管理者は、他人の問い合わせの行を直に読んでも 0 行。本人は 1 行（行の守り・D-156.25）", async () => {
    const d = (await t.ask(w.asker)) as Record<string, unknown>;
    const read = (who: { id: string; tenantId: string }) =>
      withTenant(t.f.pool, { tenantId: who.tenantId, userId: who.id, role: "member", stepUpAt: null }, async (cl) =>
        Number(
          (await cl.query<{ n: string }>("select count(*) as n from inquiries where id = $1", [d["id"]])).rows[0]!.n,
        ),
      );
    expect(await read(w.asker)).toBe(1);
    expect(await read(w.admin)).toBe(0);
    expect(await read(far.asker)).toBe(0);
  });

  it("K949-API-018 本人は、自分の会話の社内メモ（visibility ops_only）を直に読んでも見えない（行の守り）", async () => {
    const d = (await t.ask(w.asker)) as Record<string, unknown>;
    await t.opsReply(String(d["id"]), "社内メモ：請求の件は経理へ", { note: true });
    await t.opsReply(String(d["id"]), "確かめます");
    const bodies = await withTenant(
      t.f.pool,
      { tenantId: w.tenantId, userId: w.asker.id, role: "member", stepUpAt: null },
      async (cl) =>
        (
          await cl.query<{ b: string }>(
            "select m.body as b from messages m join conversations c on c.id = m.conversation_id join inquiries i on i.conversation_id = c.id where i.id = $1 order by m.created_at",
            [d["id"]],
          )
        ).rows.map((x) => x.b),
    );
    expect(bodies).toEqual(["朝から実行待ちのままです", "確かめます"]);
  });
});

describe("K-949 表の守り", () => {
  it("K949-DB-001 問い合わせの状態は open・waiting・later・done、何について は 4 つだけ（ほかは 23514）", async () => {
    const d = (await t.ask(w.asker)) as Record<string, unknown>;
    await expect(
      t.f.admin.query("update inquiries set state = 'answered' where id = $1", [d["id"]]),
    ).rejects.toMatchObject({
      code: "23514",
    });
    await expect(
      t.f.admin.query("update inquiries set topic_key = 'request' where id = $1", [d["id"]]),
    ).rejects.toMatchObject({ code: "23514" });
    for (const s of ["open", "waiting", "later", "done"]) {
      await t.f.admin.query("update inquiries set state = $2 where id = $1", [d["id"], s]);
    }
    expect((await t.row<{ s: string }>("select state as s from inquiries where id = $1", [d["id"]]))!.s).toBe("done");
  });

  it("K949-DB-002 書き込みの見え方は all か ops_only だけ（ほかは 23514・前からの行は all）", async () => {
    const d = (await t.ask(w.asker)) as Record<string, unknown>;
    const q = await t.row<{ c: string }>("select conversation_id as c from inquiries where id = $1", [d["id"]]);
    await expect(
      t.f.admin.query("update messages set visibility = 'secret' where conversation_id = $1", [q!.c]),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await t.n("select count(*) as n from messages where visibility is null")).toBe(0);
  });
});
