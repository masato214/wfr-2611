// K-386「書き込みを直す・消す・☆ の口（updateTicketMessage・deleteTicketMessage・starTicketMessage）」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K386-API-…）は 11_tickets/K-386.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
// 準備は書き込みの行を DB に直に入れる（書く口 K-385 を使わない）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py の PERMS と 05_flow/screen_api.d/K-386.py で直す）:
//   updateTicketMessage  PATCH  /api/v1/ticket_messages/:id  体 { body: string（必須）, mention_member_ids?: uuid[] }（strict）→ 200 { data: TimelineItem }
//     書いた本人だけ（入口の言葉 self）。消した書き込みは 404。直した時刻 edited_at を今に。前の文は残さない（⑩）。新しく @ した人にだけ知らせる（ticket.mentioned・同じ書き込みで前に知らせた人には 2 通目を出さない）
//   deleteTicketMessage  DELETE /api/v1/ticket_messages/:id  → 200 { data: TimelineItem（kind deleted）}
//     書いた本人か、そのチケットのグループのマネージャー（app.manages_scope）。入口の言葉は read（行が見える）にし、本人かマネージャーかは口と DB の関数の 2 重で見る（scripts/ci/row_rules.mjs は変えない）
//     deleted_at と deleted_by を書き、証跡に 1 行（本文は入れない）。もう消した書き込みは 404。決定の元が消えても決定は残る（⑪）
//   starTicketMessage    POST   /api/v1/ticket_messages/:id/star  体 {}（strict）→ 200 { data: { id, stars, starred } }（画面は ☆ の数だけを書き換える）
//     そのチケットを読める人。押すたびに自分の印が付く・外れる（reactions の star の並び）。誰にも知らせない（⑫）。書き込み（kind post）だけ・消した書き込みは 404
//   どれも、直す・消す・☆ と受け箱の行・証跡は 1 つの取引。チケットを消したら 404（D-136.2）。守りの判定が落ちたら 503（D-136.1）
import { describe, expect, it } from "vitest";
import { setupThread, who, type Item, type Person } from "./thread.harness.js";

const h = setupThread(["ticket-message-edit", "ticket-timeline"]);

const edit = (p: Person | null, id: string, body: unknown, headers: Record<string, string> = {}) =>
  h.req(p, "PATCH", `/ticket_messages/${id}`, body, headers);
const del = (p: Person | null, id: string) => h.req(p, "DELETE", `/ticket_messages/${id}`);
const star = (p: Person | null, id: string, headers: Record<string, string> = {}) =>
  h.req(p, "POST", `/ticket_messages/${id}/star`, {}, headers);
const msg = (id: string) =>
  h.one<{
    body: string;
    mentions: string[];
    edited_at: Date | null;
    deleted_at: Date | null;
    deleted_by: string | null;
    reactions: Record<string, unknown>;
  }>("select body, mentions, edited_at, deleted_at, deleted_by, reactions from ticket_messages where id = $1", [id]);
const inboxOf = (id: string) =>
  h.f.admin
    .query<{ member_id: string; event_kind_id: string }>(
      "select member_id, event_kind_id from notifications where payload->>'message_id' = $1 order by member_id",
      [id],
    )
    .then((r) => r.rows);
const item = async (r: Response) => (await h.json(r)).data as Item;

describe("K-386 直す", () => {
  it("K386-API-001 ふつう：書いた本人が直すと 200。本文が変わり、edited_at が今になる。前の文はどこにも残らない（⑩）", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "見積もりは 10 万円です" });
    const r = await edit(h.writer, id, { body: "見積もりは 12 万円です" });
    expect(r.status).toBe(200);
    const d = await item(r);
    expect(d.id).toBe(id);
    expect(d.message!.body).toBe("見積もりは 12 万円です");
    expect(typeof d.message!.edited_at).toBe("string");
    const m = await msg(id);
    expect(m.body).toBe("見積もりは 12 万円です");
    expect(m.edited_at).not.toBeNull();
    expect(
      await h.num("select count(*) as n from ticket_messages where ticket_id = $1 and body like '%10 万円%'", [t.id]),
    ).toBe(0);
  });

  it("K386-API-002 直して新しく @ した人にだけ知らせる（ticket.mentioned・1 通）。前から @ していた人・自分には知らせない。同じ人を 2 回直して @ しても 2 通目は出さない", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "@高本", mentions: [h.boss] });
    const r = await edit(h.writer, id, {
      body: "@高本 @鈴木 @佐藤",
      mention_member_ids: [h.boss.id, h.viewer.id, h.writer.id],
    });
    expect(r.status).toBe(200);
    expect((await item(r)).message!.mentions.map((x) => x.member_id)).toEqual([h.boss.id, h.viewer.id, h.writer.id]);
    expect(await inboxOf(id)).toEqual([{ member_id: h.viewer.id, event_kind_id: "ticket.mentioned" }]);
    await edit(h.writer, id, { body: "@高本", mention_member_ids: [h.boss.id] });
    await edit(h.writer, id, { body: "@高本 @鈴木", mention_member_ids: [h.boss.id, h.viewer.id] });
    expect(await inboxOf(id)).toHaveLength(1);
  });

  it("K386-API-003 直す守り：書いた本人でない人（マネージャーも）は 403、消した書き込みは 404、変更・仕組みの行は 403。どれも本文は変わらない", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "そのまま" });
    for (const p of [h.boss, h.manager, h.viewer])
      expect((await edit(p, id, { body: "書き換え" })).status, p.id).toBe(403);
    const gone = await h.post(t, h.writer, { body: "消した" });
    await h.f.admin.query("update ticket_messages set deleted_at = now(), deleted_by = $2 where id = $1", [
      gone,
      h.writer.id,
    ]);
    expect((await edit(h.writer, gone, { body: "書き換え" })).status).toBe(404);
    const sys = await h.post(t, null, { kind: "system", body: "仕組みの行" });
    expect((await edit(h.writer, sys, { body: "書き換え" })).status).toBe(403);
    expect((await msg(id)).body).toBe("そのまま");
    expect((await msg(gone)).body).toBe("消した");
  });

  it("K386-API-004 直す入力：本文が空・空白だけ・無いは 422・E-VAL-027（欄 body）。@ に見られない人は 404・E-PAGE-001（欄・details・detail なし）。知らせる人・種類など入れさせない欄は 422。どれも変わらず、知らせも出ない", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "元の文" });
    for (const body of [{}, { body: "" }, { body: "　 " }]) {
      const r = await edit(h.writer, id, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect((await h.json(r))["code"]).toBe("E-VAL-027");
    }
    const bad = await edit(h.writer, id, { body: "@伊藤", mention_member_ids: [h.stranger.id] });
    expect(bad.status).toBe(404);
    const bj = await h.json(bad);
    expect(bj["code"]).toBe("E-PAGE-001");
    expect(bj["field"]).toBeUndefined();
    expect(bj["details"]).toBeUndefined();
    expect(bj["detail"]).toBeUndefined();
    for (const extra of [{ notify_member_ids: [h.boss.id] }, { kind: "system" }, { author_member_id: h.boss.id }])
      expect((await edit(h.writer, id, { body: "x", ...extra })).status, JSON.stringify(extra)).toBe(422);
    const m = await msg(id);
    expect(m.body).toBe("元の文");
    expect(m.edited_at).toBeNull();
    expect(await inboxOf(id)).toHaveLength(0);
  });

  it("K386-API-005 本文は切らない（D-130.1）：30 万字（送る量で 1MB 弱）に直してもそのまま残る。完了したチケットの書き込みも直せる（⑭）", async () => {
    const t = await h.ticket({ stage: "done" });
    const id = await h.post(t, h.writer, { body: "短い" });
    const big = "長".repeat(300_000);
    expect((await edit(h.writer, id, { body: big })).status).toBe(200);
    expect((await msg(id)).body).toBe(big);
  });

  it("K386-API-006 S1 の失敗（直して新しく @ した人の受け箱の行を書く所で DB が落ちた）：503・E-PAGE-003。1 つの取引なので本文も直した時刻も前のまま", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "前の文" });
    await h.f.admin.query(`create or replace function public.k386_break() returns trigger language plpgsql as $$
      begin raise exception 'K386 の試験で書けなくした'; end $$`);
    await h.f.admin.query(
      `create trigger k386_break before insert on notifications for each row when (new.payload->>'message_id' = '${id}') execute function public.k386_break()`,
    );
    try {
      const r = await edit(h.writer, id, { body: "@高本 直す", mention_member_ids: [h.boss.id] });
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await h.f.admin.query("drop trigger if exists k386_break on notifications");
    }
    const m = await msg(id);
    expect(m.body).toBe("前の文");
    expect(m.edited_at).toBeNull();
  });
});

describe("K-386 消す", () => {
  it("K386-API-007 書いた本人が消すと 200・kind deleted の跡（本文を返さない）。deleted_at・deleted_by が入り、読む口では跡だけが出る", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "消す秘密の文" });
    const r = await del(h.writer, id);
    expect(r.status).toBe(200);
    expect(await r.clone().text()).not.toContain("秘密の文");
    const d = await item(r);
    expect(d.kind).toBe("deleted");
    expect(d.message).toBeNull();
    expect(d.deleted).toEqual({ by: who(h.writer, "佐藤"), author: who(h.writer, "佐藤"), by_manager: false });
    const m = await msg(id);
    expect(m.deleted_at).not.toBeNull();
    expect(m.deleted_by).toBe(h.writer.id);
    const list = await h.req(h.boss, "GET", `/tickets/${t.id}/timeline`);
    expect(await list.clone().text()).not.toContain("秘密の文");
    expect((((await h.json(list)).data ?? []) as Item[]).find((x) => x.id === id)!.kind).toBe("deleted");
  });

  it("K386-API-008 マネージャーは人の書き込みを消せる（by_manager true・⑪）。証跡に 1 行（誰が・どの書き込み。本文は入れない）", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "マネージャーが消す文" });
    const r = await del(h.manager, id);
    expect(r.status).toBe(200);
    const d = await item(r);
    expect(d.deleted?.by.member_id).toBe(h.manager.id);
    expect(d.deleted?.author.member_id).toBe(h.writer.id);
    expect(d.deleted?.by_manager).toBe(true);
    const a = await h.one<{ actor_member_id: string; action: string; payload: Record<string, unknown> }>(
      "select actor_member_id, action, payload from audit_events where target_id = $1",
      [id],
    );
    expect(a.actor_member_id).toBe(h.manager.id);
    expect(a.action).toBe("ticket_message.delete");
    expect(JSON.stringify(a.payload)).not.toContain("消す文");
  });

  it("K386-API-009 消す守り：書いた本人でもマネージャーでもない人（書ける人・閲覧のみ）は 403、見えない人・別の会社の人は 404。どれも消えない", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "残る" });
    for (const p of [h.boss, h.viewer]) expect((await del(p, id)).status, p.id).toBe(403);
    for (const p of [h.stranger, h.outsider]) expect((await del(p, id)).status, p.id).toBe(404);
    expect((await msg(id)).deleted_at).toBeNull();
  });

  it("K386-API-010 もう消した書き込みを消す・直す・☆ は 404。決定の元の書き込みを消しても決定は残る", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "決定の元" });
    const dec = await h.one<{ id: string }>(
      "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by, source_message_id) values ($1, $2, '月末締め', $3, $4) returning id",
      [t.tenant, t.id, h.writer.id, id],
    );
    expect((await del(h.writer, id)).status).toBe(200);
    expect((await del(h.writer, id)).status).toBe(404);
    expect((await edit(h.writer, id, { body: "x" })).status).toBe(404);
    expect((await star(h.boss, id)).status).toBe(404);
    const d = await h.one<{ text: string; source_message_id: string; deleted_at: Date | null }>(
      "select text, source_message_id, deleted_at from ticket_decisions where id = $1",
      [dec.id],
    );
    expect(d).toEqual({ text: "月末締め", source_message_id: id, deleted_at: null });
  });

  it("K386-API-011 S2 の失敗（証跡を書く所で DB が落ちた）：503・E-PAGE-003。1 つの取引なので消えていない", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "消せない" });
    await h.f.admin.query(`create or replace function public.k386_audit_break() returns trigger language plpgsql as $$
      begin raise exception 'K386 の試験で証跡を書けなくした'; end $$`);
    await h.f.admin.query(
      `create trigger k386_audit_break before insert on audit_events for each row when (new.target_id = '${id}') execute function public.k386_audit_break()`,
    );
    try {
      const r = await del(h.writer, id);
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await h.f.admin.query("drop trigger if exists k386_audit_break on audit_events");
    }
    expect((await msg(id)).deleted_at).toBeNull();
  });
});

describe("K-386 ☆", () => {
  it("K386-API-012 ☆ を押すと付き、もう一度押すと外れる。2 人が押せば 2。誰にも知らせない（⑫）。本文と直した時刻は変わらない", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "大事" });
    const a = await star(h.boss, id);
    expect(a.status).toBe(200);
    expect(await h.json(a)).toEqual({ data: { id, stars: 1, starred: true } });
    const b = await star(h.viewer, id);
    expect((await h.json(b)).data).toEqual({ id, stars: 2, starred: true });
    const c = await star(h.boss, id);
    expect((await h.json(c)).data).toEqual({ id, stars: 1, starred: false });
    expect((await msg(id)).reactions).toEqual({ star: [h.viewer.id] });
    const m = await msg(id);
    expect(m.body).toBe("大事");
    expect(m.edited_at).toBeNull();
    expect(await inboxOf(id)).toHaveLength(0);
  });

  it("K386-API-013 ☆ を同時に 2 人が押しても両方が残る（stars 2）。同じ人が同じ冪等キーで 2 回送っても 1 回だけ付く", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "同時" });
    await Promise.all([star(h.boss, id), star(h.manager, id)]);
    expect(((await msg(id)).reactions["star"] as string[]).sort()).toEqual([h.boss.id, h.manager.id].sort());
    const key = { "idempotency-key": `k386-${id}` };
    await Promise.all([star(h.viewer, id, key), star(h.viewer, id, key)]);
    expect((await msg(id)).reactions["star"] as string[]).toContain(h.viewer.id);
    expect((await msg(id)).reactions["star"] as string[]).toHaveLength(3);
  });

  it("K386-API-014 ☆ の守り：閲覧のみの人・グループの外の担当者は押せる。見えない人・別の会社の人は 404。変更・仕組みの行は 404", async () => {
    const t = await h.ticket({ assignee: h.stranger });
    const id = await h.post(t, h.writer, { body: "押せる" });
    expect((await star(h.viewer, id)).status).toBe(200);
    expect((await star(h.stranger, id)).status).toBe(200);
    const u = await h.ticket();
    const hidden = await h.post(u, h.writer, { body: "見えない" });
    for (const p of [h.stranger, h.outsider]) expect((await star(p, hidden)).status, p.id).toBe(404);
    const ch = await h.post(u, h.writer, { kind: "change", changes: [{ field: "stage", from: "作業中", to: "保留" }] });
    expect((await star(h.boss, ch)).status).toBe(404);
    expect((await msg(hidden)).reactions).toEqual({});
  });
});

describe("K-386 3 つの口に共通の守り・失敗", () => {
  it("K386-API-015 チケットを消したら、その書き込みの直す・消す・☆ は 404（D-136.2）。取引先の役は 403", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "消したチケットの書き込み" });
    for (const r of [
      await h.req(null, "PATCH", `/ticket_messages/${id}`, { body: "x" }, h.f.as(h.writer, "client")),
      await h.req(null, "DELETE", `/ticket_messages/${id}`, undefined, h.f.as(h.writer, "client")),
      await h.req(null, "POST", `/ticket_messages/${id}/star`, {}, h.f.as(h.writer, "client")),
    ])
      expect(r.status).toBe(403);
    await h.f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [t.id, h.boss.id]);
    expect((await edit(h.writer, id, { body: "x" })).status).toBe(404);
    expect((await del(h.writer, id)).status).toBe(404);
    expect((await star(h.writer, id)).status).toBe(404);
    expect((await msg(id)).body).toBe("消したチケットの書き込み");
    expect((await msg(id)).deleted_at).toBeNull();
  });

  it("K386-API-016 ログインしていない：3 つとも 401。上限を超えたら直す・消す・☆ のどれも 3 回目が 429・retry_after_sec", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "上限" });
    expect((await edit(null, id, { body: "x" })).status).toBe(401);
    expect((await del(null, id)).status).toBe(401);
    expect((await star(null, id)).status).toBe(401);
    const ops = ["updateTicketMessage", "deleteTicketMessage", "starTicketMessage"] as const;
    for (const op of ops) h.f.limits[op] = 2;
    try {
      const thrice = async (call: (i: number) => Promise<Response>) => {
        const codes: number[] = [];
        let last: Response | null = null;
        for (let i = 0; i < 3; i++) {
          last = await call(i);
          codes.push(last.status);
        }
        expect(codes).toEqual([200, 200, 429]);
        const s = Number((await h.json(last!))["retry_after_sec"]);
        expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      };
      // 直す：同じ書き込みを本人が 3 回直す
      await thrice((i) =>
        h.f.req("PATCH", `/ticket_messages/${id}`, {
          body: { body: `上限 ${i}` },
          headers: h.writer.auth,
          ip: "198.51.100.252",
        }),
      );
      // 消す：本人が自分の別々の書き込みを 3 つ消す（同じ物を 2 回消すと 404 になるので別々に）
      const mine = [
        await h.post(t, h.writer, { body: "消す 1" }),
        await h.post(t, h.writer, { body: "消す 2" }),
        await h.post(t, h.writer, { body: "消す 3" }),
      ];
      await thrice((i) =>
        h.f.req("DELETE", `/ticket_messages/${mine[i]}`, { headers: h.writer.auth, ip: "198.51.100.253" }),
      );
      // ☆：同じ書き込みに 3 回
      await thrice(() =>
        h.f.req("POST", `/ticket_messages/${id}/star`, { body: {}, headers: h.boss.auth, ip: "198.51.100.254" }),
      );
    } finally {
      for (const op of ops) h.f.limits[op] = 10_000;
    }
  });

  it("K386-API-017 失敗 × 守りの判定（見えるか）の所で例外になった：直す・消す・☆ はどれも 503・E-PAGE-003 で、何も変わらない（D-136.1）", async () => {
    const title = "K386 守りが壊れる";
    const t = await h.ticket({ title });
    const id = await h.post(t, h.writer, { body: "壊れたとき" });
    await h.breakVisible(title, async () => {
      for (const r of [await edit(h.writer, id, { body: "x" }), await del(h.writer, id), await star(h.writer, id)]) {
        expect(r.status).toBe(503);
        expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      }
    });
    const m = await msg(id);
    expect(m).toMatchObject({ body: "壊れたとき", edited_at: null, deleted_at: null, reactions: {} });
  });

  it("K386-API-018 S3 の失敗（☆ の印を書く所で DB が落ちた）：503・E-PAGE-003。印は前のまま", async () => {
    const t = await h.ticket();
    const id = await h.post(t, h.writer, { body: "☆ が書けない", reactions: { star: [h.viewer.id] } });
    await h.f.admin.query(`create or replace function public.k386_star_break() returns trigger language plpgsql as $$
      begin raise exception 'K386 の試験で印を書けなくした'; end $$`);
    await h.f.admin.query(
      `create trigger k386_star_break before update on ticket_messages for each row when (new.id = '${id}') execute function public.k386_star_break()`,
    );
    try {
      const r = await star(h.boss, id);
      expect(r.status).toBe(503);
      const j = await h.json(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("書けなくした");
    } finally {
      await h.f.admin.query("drop trigger if exists k386_star_break on ticket_messages");
    }
    expect((await msg(id)).reactions).toEqual({ star: [h.viewer.id] });
  });
});
