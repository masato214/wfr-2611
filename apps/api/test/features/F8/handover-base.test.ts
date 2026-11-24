// K-401「渡しの口の置き場と、渡す前の下見の口」の単体の試験（口・本物の DB）。名前の頭の行 ID（K401-…）は 11_tickets/K-401.md の表に 1 対 1。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台は ./handover.harness.ts。
// この葉の口は、種類ごとのファイルの空の形（まだ使えません）を見ない：振り分けの前で止まる行（入力・見える・権限・止まり・相手・切り替え）と、
//   上へ上げる（渡す口は契約の外の種類で 422・答える口は今の状態ではできないで 409・E-HND-001）だけを見る（空の形を見ると、後ろの葉 K-402〜K-410 が入ったときに赤になる）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupHandover, msg, type World } from "./handover.harness.js";

/** 体から 1 つの欄を外した写し（元は変えない） */
const without = (body: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([k]) => k !== key));

const h = setupHandover("K401");

const PREVIEW_KEYS = [
  "blocked",
  "candidates",
  "children",
  "default_reply_due",
  "group",
  "groups",
  "kinds",
  "links",
  "rules",
  "waiting",
].sort();
const CANDIDATE_KEYS = [
  "current",
  "email",
  "group",
  "id",
  "in_group",
  "manager",
  "name",
  "self",
  "state",
  "week",
].sort();
const RULE_KEYS = ["axis_id", "axis_name", "id", "mode", "target"].sort();
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
type Cand = Record<string, unknown> & { id: string };
const addDays = (d: string, n: number) =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const future = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

/** 渡しの行が増えていないこと（その会社の分） */
const handoverCount = (w: World) =>
  h.num("select count(*) as n from ticket_handovers where tenant_id = $1", [w.co.tenantId]);
/** 断られた答えの code と欄 */
async function refused(r: Response, status: number, code: string, field?: string) {
  const j = await h.json(r);
  expect(r.status, JSON.stringify(j)).toBe(status);
  expect(j.code).toBe(code);
  if (field) expect(j.details?.map((d) => d.field) ?? [j.field]).toContain(field);
  return j;
}
/** 入口の形の 422（VALIDATION_ERROR）で、その欄の理由がある */
async function shape422(r: Response, field: string) {
  const j = await h.json(r);
  expect(r.status, JSON.stringify(j)).toBe(422);
  expect((j.details ?? []).map((d) => d.field)).toContain(field);
}

describe("K-401 渡す前の下見（previewTicketHandover）", () => {
  it("K401-API-001 担当者が下見を開く：200・鍵がちょうど 10・kinds pass・止まり無し・決まり 3 行・グループ・既定の返事の期限・貯めない", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const r = await h.preview(w.boss, t.id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(PREVIEW_KEYS);
    expect(d["kinds"]).toEqual(["pass"]);
    expect(d["blocked"]).toBeNull();
    expect(d["waiting"]).toBeNull();
    expect(d["groups"]).toEqual([]);
    const rules = d["rules"] as Record<string, unknown>[];
    expect(rules.map((x) => [x["target"], x["mode"], x["axis_id"]])).toEqual([
      ["children", "ask", null],
      ["links", "ask", null],
      ["group", "ask", null],
    ]);
    expect(d["group"]).toEqual({ id: w.co.eg, name: "営業", code: "EG" });
    expect(String(d["default_reply_due"])).toMatch(ISO);
  });

  it("K401-API-002 候補の人：同じ会社の人だけ・今の担当者が先頭・自分・止まっている／招待中の状態・メール・同じグループか・管理する人か", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    await h.f.admin.query("update members set deleted_at = now() where id = $1", [w.suzuki.id]);
    const noMail = await h.f.person(w.co.tenantId, w.co.eg, { name: "メール無し", ticketAbility: "edit" });
    const d = (await h.json(await h.preview(w.sato, t.id))).data!;
    const c = d["candidates"] as Cand[];
    const ids = c.map((x) => x.id);
    expect(ids[0]).toBe(w.boss.id);
    expect(ids).not.toContain(w.suzuki.id); // 消した人
    expect(ids).not.toContain(w.left.id); // 抜けた人
    expect(ids).not.toContain(w.outsider.id); // 別の会社
    const by = (id: string) => c.find((x) => x.id === id)!;
    for (const x of c) expect(Object.keys(x).sort()).toEqual(CANDIDATE_KEYS);
    expect(by(w.boss.id)["current"]).toBe(true);
    expect(by(w.sato.id)["self"]).toBe(true);
    expect(by(w.sato.id)["current"]).toBe(false);
    expect(by(w.stopped.id)["state"]).toBe("suspended");
    expect(by(w.invited.id)["state"]).toBe("invited");
    expect(by(w.mgr.id)["state"]).toBe("active");
    expect(by(w.sato.id)["email"]).toBe(w.sato.email);
    expect(by(noMail.id)["email"]).toBeNull();
    expect(by(w.sato.id)["in_group"]).toBe(true);
    expect(by(w.jdMember.id)["in_group"]).toBe(false);
    expect(by(w.mgr.id)["manager"]).toBe(true);
    expect(by(w.sato.id)["manager"]).toBe(false);
    expect(by(w.jdMember.id)["group"]).toEqual({ id: w.co.jd, name: "受託開発", code: "JD" });
  });

  it("K401-API-003 今週の件数：担当者で開いている・期限が今週（日本時間の月〜日）の物だけ数える", async () => {
    await h.ready();
    const w = await h.world();
    const mon = h.jstMonday();
    for (const due of [mon, addDays(mon, 3), addDays(mon, 6)]) await h.ticket(w, { assignee: w.sato, due });
    await h.ticket(w, { assignee: w.sato, due: addDays(mon, -1) }); // 先週
    await h.ticket(w, { assignee: w.sato, due: addDays(mon, 7) }); // 来週
    await h.ticket(w, { assignee: w.sato, due: null }); // 期限なし
    await h.ticket(w, { assignee: w.sato, due: addDays(mon, 1), completed: true });
    await h.ticket(w, { assignee: w.sato, due: addDays(mon, 1), deleted: true });
    await h.ticket(w, { assignee: w.suzuki, due: addDays(mon, 1) }); // ほかの人の担当
    const t = await h.ticket(w);
    const c = (await h.json(await h.preview(w.boss, t.id))).data!["candidates"] as Cand[];
    expect(c.find((x) => x.id === w.sato.id)!["week"]).toBe(3);
    expect(c.find((x) => x.id === w.suzuki.id)!["week"]).toBe(1);
    expect(c.find((x) => x.id === w.jdMember.id)!["week"]).toBe(0);
  });

  it("K401-API-004 子と関連の数：自分が担当で開いている物は mine・ほかの人の物は others・完了と消した物は数えない・関連は両向き", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const c1 = await h.ticket(w, { parent: t.id });
    await h.ticket(w, { parent: c1.id }); // 孫（自分）
    await h.ticket(w, { parent: t.id, assignee: w.sato });
    await h.ticket(w, { parent: t.id, completed: true });
    await h.ticket(w, { parent: t.id, deleted: true });
    const x1 = await h.ticket(w);
    const x2 = await h.ticket(w);
    const x3 = await h.ticket(w, { assignee: w.sato });
    const x4 = await h.ticket(w, { completed: true });
    await h.link(w, t.id, x1.id, "related");
    await h.link(w, x2.id, t.id, "related"); // 逆向き
    await h.link(w, t.id, x3.id, "derived_from");
    await h.link(w, t.id, x4.id, "related");
    const d = (await h.json(await h.preview(w.boss, t.id))).data!;
    expect(d["children"]).toEqual({ mine: 2, others: 1 });
    expect(d["links"]).toEqual({ mine: 2, others: 1 });
  });

  it("K401-API-005 役ごとの種類：管理する人は distribute・offer とグループの並び／同じグループのメンバーは offer／管理する人でも担当者なら pass", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const gone = await h.one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id, deleted_at) values ($1, '消したグループ', 'XX', $2, now()) returning id",
      [w.co.tenantId, w.co.eg],
    );
    const m = (await h.json(await h.preview(w.mgr, t.id))).data!;
    expect(m["kinds"]).toEqual(["distribute", "offer"]);
    const groups = m["groups"] as { id: string; name: string; code: string }[];
    expect(groups.map((g) => g.id).sort()).toEqual([w.co.eg, w.co.jd].sort());
    expect(groups.map((g) => g.id)).not.toContain(gone.id);
    for (const g of groups) expect(Object.keys(g).sort()).toEqual(["code", "id", "name"]);
    const s = (await h.json(await h.preview(w.sato, t.id))).data!;
    expect(s["kinds"]).toEqual(["offer"]);
    expect(s["groups"]).toEqual([]);
    const own = await h.ticket(w, { assignee: w.mgr });
    expect((await h.json(await h.preview(w.mgr, own.id))).data!["kinds"]).toEqual(["pass"]);
  });

  it("K401-API-006 できる種類が無い人（閲覧のみ）：403・E-HND-002・中身を返さない", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const j = await refused(await h.preview(w.viewer, t.id), 403, "E-HND-002");
    expect(j.data).toBeUndefined();
    expect(JSON.stringify(j)).not.toContain(w.sato.name);
  });

  it("K401-API-007 止まり：AI が動いている・承認待ち・待っている渡し・完了したは 200 で blocked と waiting の中身を返す", async () => {
    await h.ready();
    const w = await h.world();
    const ai = await h.ticket(w);
    await h.aiRunning(w, ai.id, w.boss);
    const ap = await h.ticket(w);
    await h.approvalWaiting(w, ap.id, w.boss);
    const wt = await h.ticket(w);
    const due = future(60 * 24);
    const hid = await h.waiting(w, { ticketId: wt.id, to: w.suzuki, replyDue: due });
    const done = await h.ticket(w, { completed: true });
    const get = async (id: string) => {
      const r = await h.preview(w.boss, id);
      expect(r.status, await r.clone().text()).toBe(200);
      return (await h.json(r)).data!;
    };
    expect((await get(ai.id))["blocked"]).toBe("ai_running");
    expect((await get(ap.id))["blocked"]).toBe("approval");
    const d = await get(wt.id);
    expect(d["blocked"]).toBe("waiting");
    const wv = d["waiting"] as Record<string, unknown>;
    expect(wv["id"]).toBe(hid);
    expect(wv["kind"]).toBe("pass");
    expect((wv["to"] as Record<string, unknown>)["id"]).toBe(w.suzuki.id);
    expect((wv["to"] as Record<string, unknown>)["name"]).toBe(w.suzuki.name);
    expect((wv["from"] as Record<string, unknown>)["id"]).toBe(w.boss.id);
    expect(new Date(String(wv["reply_due"])).getTime()).toBe(new Date(due).getTime());
    expect((await get(done.id))["blocked"]).toBe("closed");
    expect((await get(ai.id))["kinds"]).toEqual(["pass"]);
  });

  it("K401-API-008 返事の期限の既定：次の平日（土日を飛ばす）の 18:00（日本時間）。下見の既定は呼んだ時刻の既定と同じ", async () => {
    await h.ready();
    const w = await h.world();
    const due = async (at: string) =>
      new Date(
        (await h.asOwner<{ v: Date }>(w.boss, "select app.handover_default_due($1::timestamptz) as v", [at]))[0]!.v,
      ).toISOString();
    expect(await due("2026-11-20T10:00:00+09:00")).toBe("2026-11-23T09:00:00.000Z"); // 金 → 月 18:00
    expect(await due("2026-11-21T09:00:00+09:00")).toBe("2026-11-23T09:00:00.000Z"); // 土 → 月
    expect(await due("2026-11-22T12:00:00+09:00")).toBe("2026-11-23T09:00:00.000Z"); // 日 → 月
    expect(await due("2026-11-23T19:00:00+09:00")).toBe("2026-11-24T09:00:00.000Z"); // 月 19:00 → 火
    expect(await due("2026-11-26T23:59:00+09:00")).toBe("2026-11-27T09:00:00.000Z"); // 木 23:59 → 金
    const t = await h.ticket(w);
    const before = await due(new Date().toISOString());
    const got = new Date(
      String((await h.json(await h.preview(w.boss, t.id))).data!["default_reply_due"]),
    ).toISOString();
    const after = await due(new Date().toISOString());
    expect([before, after]).toContain(got);
  });

  it("K401-API-009 見えないチケット：別の会社・グループの外で関わりが無い・でたらめ・消したは 404", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const theirs = await h.ticket({ ...w, co: w.other, boss: w.outsider } as World, { assignee: w.outsider });
    const del = await h.ticket(w, { deleted: true });
    for (const [who, id] of [
      [w.boss, theirs.id],
      [w.jdMember, t.id],
      [w.boss, randomUUID()],
      [w.boss, del.id],
    ] as const) {
      const r = await h.preview(who, id);
      expect(r.status, `${who.name} ${id}`).toBe(404);
      expect((await h.json(r)).data).toBeUndefined();
    }
  });

  it("K401-API-010 ログインしていない 4 口とも 401・上限を 1 回にすると 2 回目は 4 口とも 429", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id });
    const calls: [string, string, unknown][] = [
      ["GET", `/tickets/${t.id}/handover-preview`, undefined],
      ["POST", `/tickets/${t.id}/handovers`, h.passBody(w.sato)],
      ["PATCH", `/ticket_handovers/${hid}`, { decision: "accept" }],
      ["GET", "/handover_rules", undefined],
    ];
    for (const [m, p, body] of calls) expect((await h.req(m, p, { body })).status, `${m} ${p}`).toBe(401);
    const ops = ["previewTicketHandover", "createTicketHandover", "answerTicketHandover", "listHandoverRules"];
    const who = [w.boss, w.boss, w.sato, w.boss];
    try {
      for (const op of ops) h.limits[op] = 1;
      for (let i = 0; i < calls.length; i++) {
        const [m, p, body] = calls[i]!;
        await h.req(m, p, { body, headers: who[i]!.auth });
        const r = await h.req(m, p, { body, headers: who[i]!.auth });
        expect(r.status, `${m} ${p}`).toBe(429);
        const sec = (await h.json(r))["retry_after_sec"];
        expect(Number.isInteger(sec)).toBe(true);
        expect(sec as number).toBeGreaterThanOrEqual(1);
        expect(sec as number).toBeLessThanOrEqual(60);
      }
    } finally {
      for (const op of ops) h.limits[op] = 10_000;
    }
  });
});

describe("K-401 渡す口の振り分けの前の確かめ（createTicketHandover）", () => {
  it("K401-API-011 上へ上げる（escalate）：422・E-HND-001・欄 kind。渡しの行・知らせ・証跡は増えない", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const audits = await h.num("select count(*) as n from audit_events where tenant_id = $1", [w.co.tenantId]);
    const j = await refused(
      await h.create(w.boss, t.id, h.passBody(w.sato, { kind: "escalate" })),
      422,
      "E-HND-001",
      "kind",
    );
    expect(j["message"]).toBe(msg("E-HND-001"));
    expect(await handoverCount(w)).toBe(0);
    expect(await h.handoverNotes(w.co.tenantId)).toBe(0);
    expect(await h.num("select count(*) as n from audit_events where tenant_id = $1", [w.co.tenantId])).toBe(audits);
  });

  it("K401-API-012 入力の形：kind が無い・知らない値・知らない欄・期限が日時でない・切り替えの形・申し出に相手・人とグループの両方は 422", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const noKind = without(h.passBody(w.sato), "kind");
    await shape422(await h.create(w.boss, t.id, noKind), "kind");
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { kind: "hand" })), "kind");
    expect((await h.create(w.boss, t.id, h.passBody(w.sato, { from_member_id: w.sato.id }))).status).toBe(422);
    expect((await h.create(w.boss, t.id, h.passBody(w.sato, { state: "accepted" }))).status).toBe(422);
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { reply_due: "明日" })), "reply_due");
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { reply_due: "2026-11-23" })), "reply_due");
    await shape422(
      await h.create(w.boss, t.id, h.passBody(w.sato, { reply_due: "2099-11-23T18:00+09:00" })),
      "reply_due",
    ); // 秒が無い形は契約（date-time）と同じく受けない
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { switch: { owner: true } })), "switch");
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { switch: { children: "yes" } })), "switch");
    await shape422(
      await h.create(w.sato, t.id, { kind: "offer", to_member_id: w.boss.id, reason: "手が空いたので" }),
      "to_member_id",
    );
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { to_scope_id: w.co.jd })), "to_member_id");
    expect(await handoverCount(w)).toBe(0);
  });

  it("K401-API-013 理由：無い・空・空白だけ（全角・改行・タブ）・制御文字だけは 422・E-HND-007", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const noReason = without(h.passBody(w.sato), "reason");
    for (const body of [
      noReason,
      h.passBody(w.sato, { reason: "" }),
      h.passBody(w.sato, { reason: "　 \n\t" }),
      h.passBody(w.sato, { reason: "\u0001\u0007" }),
    ]) {
      const j = await refused(await h.create(w.boss, t.id, body), 422, "E-HND-007", "reason");
      expect(j["message"]).toBe("理由を書いてください");
    }
    // NUL は黙って取り除かず 422（answer=c8b3f4c3aef8）
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { reason: "あ\u0000い" })), "reason");
    await shape422(await h.create(w.boss, t.id, h.passBody(w.sato, { ask: "お\u0000願い" })), "ask");
    expect(await handoverCount(w)).toBe(0);
  });

  it("K401-API-014 返事の期限が今より前は 409・E-HND-008（時刻で決まる断り・欄なし）", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    for (const due of [future(-1), future(-60 * 24)]) {
      const j = await refused(await h.create(w.boss, t.id, h.passBody(w.sato, { reply_due: due })), 409, "E-HND-008");
      expect(j["details"], "409 に欄・details を付けない").toBeUndefined();
      expect(j["field"], "409 に欄・details を付けない").toBeUndefined();
      expect(j["message"]).toBe("返事の期限は今より後にしてください");
    }
    expect(await handoverCount(w)).toBe(0);
  });

  it("K401-API-015 相手：選んでいないは 422・E-HND-013／自分・止まっている・招待中は 409（E-HND-010・006）／見つからない人・グループは 404（E-HND-014・012）", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const noTo = without(h.passBody(w.sato), "to_member_id");
    await refused(await h.create(w.boss, t.id, noTo), 422, "E-HND-013", "to_member_id");
    await refused(await h.create(w.boss, t.id, h.passBody(w.boss)), 409, "E-HND-010");
    const s = await refused(await h.create(w.boss, t.id, h.passBody(w.stopped)), 409, "E-HND-006");
    expect(String(s.detail?.["名前"])).toContain("田中");
    expect(s.detail?.["訳"]).toBe("止まっています");
    const i = await refused(await h.create(w.boss, t.id, h.passBody(w.invited)), 409, "E-HND-006");
    expect(i.detail?.["訳"]).toBe("招待中です");
    for (const p of [w.outsider, w.left, { ...w.sato, id: randomUUID() }])
      await refused(await h.create(w.boss, t.id, h.passBody(p)), 404, "E-HND-014");
    // グループが無い（配る・管理する人が選んだ id がどのグループでもない）→ 404・E-HND-012
    await refused(
      await h.create(w.mgr, t.id, { kind: "distribute", to_scope_id: randomUUID(), reason: "展示会の準備を優先" }),
      404,
      "E-HND-012",
    );
    // 申し出（offer）の相手は今の担当者：止まった・招待中は 409・E-HND-006（渡すと同じ）／抜けた人は 404・E-HND-014。申し出は作らない
    const offer = { kind: "offer", reason: "手が空いたので" };
    const os = await refused(
      await h.create(w.sato, (await h.ticket(w, { assignee: w.stopped })).id, offer),
      409,
      "E-HND-006",
    );
    expect(os.detail?.["訳"]).toBe("止まっています");
    const oi = await refused(
      await h.create(w.sato, (await h.ticket(w, { assignee: w.invited })).id, offer),
      409,
      "E-HND-006",
    );
    expect(oi.detail?.["訳"]).toBe("招待中です");
    await refused(await h.create(w.sato, (await h.ticket(w, { assignee: w.left })).id, offer), 404, "E-HND-014");
    expect(await handoverCount(w)).toBe(0);
  });

  it("K401-API-016 種類の権限：担当者でない人の pass・管理しない人の distribute は 403・E-HND-002。閲覧のみは 403", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    await refused(await h.create(w.sato, t.id, h.passBody(w.suzuki)), 403, "E-HND-002");
    await refused(
      await h.create(w.sato, t.id, { kind: "distribute", to_member_id: w.suzuki.id, reason: "展示会の準備を優先" }),
      403,
      "E-HND-002",
    );
    expect((await h.create(w.viewer, t.id, h.passBody(w.sato))).status).toBe(403);
    expect(await handoverCount(w)).toBe(0);
  });

  it("K401-API-017 止まり：AI が動いている・承認待ちは 409・E-HND-003／待っている渡しは 409・E-HND-004（相手の名前）／完了したは 409・E-HND-009", async () => {
    await h.ready();
    const w = await h.world();
    const ai = await h.ticket(w);
    await h.aiRunning(w, ai.id, w.boss);
    const a = await refused(await h.create(w.boss, ai.id, h.passBody(w.sato)), 409, "E-HND-003");
    expect(a["message"]).toBe("AI の実行（承認）が終わってから渡してください");
    const ap = await h.ticket(w);
    await h.approvalWaiting(w, ap.id, w.boss);
    await refused(await h.create(w.boss, ap.id, h.passBody(w.sato)), 409, "E-HND-003");
    const wt = await h.ticket(w);
    await h.waiting(w, { ticketId: wt.id, to: w.suzuki });
    const j = await refused(await h.create(w.boss, wt.id, h.passBody(w.sato)), 409, "E-HND-004");
    expect(String(j.detail?.["名前"])).toContain("鈴木");
    const done = await h.ticket(w, { completed: true });
    await refused(await h.create(w.boss, done.id, h.passBody(w.sato)), 409, "E-HND-009");
    expect(await handoverCount(w)).toBe(1); // 置いた 1 本だけ
  });

  it("K401-API-018 一緒に切り替える：決まりが never の物・相手がいるグループへ移す・軸を選ぶと 409・E-HND-011", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    await h.f.admin.query("update handover_rules set mode = 'never' where tenant_id = $1 and target = 'children'", [
      w.co.tenantId,
    ]);
    await refused(await h.create(w.boss, t.id, h.passBody(w.sato, { switch: { children: true } })), 409, "E-HND-011");
    await refused(await h.create(w.boss, t.id, h.passBody(w.sato, { switch: { group: true } })), 409, "E-HND-011");
    await refused(
      await h.create(w.boss, t.id, h.passBody(w.jdMember, { switch: { axes: [randomUUID()] } })),
      409,
      "E-HND-011",
    );
    expect(await handoverCount(w)).toBe(0);
  });

  it("K401-API-019 見えないチケットに渡す：別の会社・でたらめは 404", async () => {
    await h.ready();
    const w = await h.world();
    const theirs = await h.ticket({ ...w, co: w.other, boss: w.outsider } as World, { assignee: w.outsider });
    expect((await h.create(w.boss, theirs.id, h.passBody(w.sato))).status).toBe(404);
    expect((await h.create(w.boss, randomUUID(), h.passBody(w.sato))).status).toBe(404);
    expect(await h.num("select count(*) as n from ticket_handovers where ticket_id = $1", [theirs.id])).toBe(0);
  });
});

describe("K-401 答える口の振り分けの前の確かめ（answerTicketHandover）", () => {
  it("K401-API-020 無い渡し・別の会社の渡しに答えると 404", async () => {
    await h.ready();
    const w = await h.world();
    const theirs = await h.ticket({ ...w, co: w.other, boss: w.outsider } as World, { assignee: w.outsider });
    const hid = await h.waiting({ ...w, co: w.other } as World, {
      ticketId: theirs.id,
      from: w.outsider,
      to: w.outsider,
    });
    expect((await h.answer(w.sato, randomUUID(), { decision: "accept" })).status).toBe(404);
    expect((await h.answer(w.sato, hid, { decision: "accept" })).status).toBe(404);
    expect((await h.handover(hid))!["state"]).toBe("waiting");
    // 待っている間にチケットが消された：答えは 404（欄なし）で、担当者は替わらず・渡しは待っているまま・知らせの行は増えない
    const gone = await h.ticket(w);
    const gid = await h.waiting(w, { ticketId: gone.id, to: w.sato });
    await h.f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const before = await h.num("select count(*) as n from notifications where tenant_id = $1", [w.co.tenantId]);
    const r = await h.answer(w.sato, gid, { decision: "accept" });
    expect(r.status, await r.clone().text()).toBe(404);
    const gj = await h.json(r);
    expect(gj.code).toBe("E-PAGE-001");
    for (const key of ["field", "details"]) expect(gj, `404 に ${key} を付けない`).not.toHaveProperty(key);
    expect(await h.assigneeOf(gone.id)).toBe(w.boss.id);
    expect((await h.handover(gid))!["state"]).toBe("waiting");
    expect(await h.num("select count(*) as n from notifications where tenant_id = $1", [w.co.tenantId])).toBe(before);
  });

  it("K401-API-021 答える人でない：渡した人・同じグループの関係ない人・閲覧のみは 403。グループ宛てを管理する人は 403 にならない", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato });
    expect((await h.answer(w.boss, hid, { decision: "accept" })).status).toBe(403);
    expect((await h.answer(w.suzuki, hid, { decision: "accept" })).status).toBe(403);
    expect((await h.handover(hid))!["state"]).toBe("waiting");
    const g = await h.ticket(w);
    const gid = await h.waiting(w, { ticketId: g.id, kind: "distribute", from: w.mgr, toScope: w.co.jd });
    expect((await h.answer(w.viewer, gid, { decision: "accept" })).status).toBe(403);
    const r = await h.answer(w.jdMgr, gid, { decision: "accept" });
    expect([403, 404]).not.toContain(r.status);
  });

  it("K401-API-022 もう決まった（受けた・断られた・取り消された）渡しに答えると 409・E-HND-005。行と担当者は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    for (const state of ["accepted", "declined", "withdrawn"] as const) {
      const t = await h.ticket(w);
      const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, state });
      for (const body of [{ decision: "accept" }, { decision: "decline", decline_reason: "手が回らない" }]) {
        const j = await refused(await h.answer(w.sato, hid, body), 409, "E-HND-005");
        expect(j.detail?.["状態"]).toBe(state);
      }
      expect((await h.handover(hid))!["state"]).toBe(state);
      expect(await h.assigneeOf(t.id)).toBe(w.boss.id);
    }
  });

  it("K401-API-023 答える形：decision が無い・知らない値・断る理由が空・NUL を含む・知らない欄は 422", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato });
    await shape422(await h.answer(w.sato, hid, {}), "decision");
    await shape422(await h.answer(w.sato, hid, { decision: "yes" }), "decision");
    for (const reason of [undefined, "", "　\n"])
      await refused(
        await h.answer(w.sato, hid, {
          decision: "decline",
          ...(reason === undefined ? {} : { decline_reason: reason }),
        }),
        422,
        "E-HND-007",
        "decline_reason",
      );
    expect((await h.answer(w.sato, hid, { decision: "accept", state: "accepted" })).status).toBe(422);
    await shape422(
      await h.answer(w.sato, hid, { decision: "decline", decline_reason: "手が\u0000回らない" }),
      "decline_reason",
    );
    expect((await h.handover(hid))!["state"]).toBe("waiting");
  });

  it("K401-API-024 上へ上げるの渡し（kind escalate）に答えると 409・E-HND-001。行は待っているまま", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id, kind: "escalate", to: w.mgr });
    const j = await refused(await h.answer(w.mgr, hid, { decision: "accept" }), 409, "E-HND-001");
    expect(j["message"]).toBe(msg("E-HND-001"));
    expect(j["details"], "409 に欄・details を付けない").toBeUndefined();
    expect(j["field"], "409 に欄・details を付けない").toBeUndefined();
    expect((await h.handover(hid))!["state"]).toBe("waiting");
  });
});

describe("K-401 決まりを読む口（listHandoverRules）", () => {
  it("K401-API-025 3 行・鍵がちょうど 5・別の会社の行は出ない・会社が直した mode を返す・貯めない", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query("update handover_rules set mode = 'always' where tenant_id = $1 and target = 'links'", [
      w.co.tenantId,
    ]);
    const r = await h.rules(w.boss);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const rows = (await h.json(r)).data as unknown as Record<string, unknown>[];
    for (const x of rows) expect(Object.keys(x).sort()).toEqual(RULE_KEYS);
    expect(rows.map((x) => [x["target"], x["mode"], x["axis_id"], x["axis_name"]])).toEqual([
      ["children", "ask", null, null],
      ["links", "always", null, null],
      ["group", "ask", null, null],
    ]);
    const theirs = await h.f.admin.query<{ id: string }>("select id from handover_rules where tenant_id = $1", [
      w.other.tenantId,
    ]);
    const ids = rows.map((x) => x["id"]);
    for (const x of theirs.rows) expect(ids).not.toContain(x.id);
  });
});

describe("K-401 共通の判定の DB の関数", () => {
  it("K401-DB-026 答える人：相手 true・渡した人／関係ない人／決まった渡し／止まっている相手 false・グループ宛ては管理する人だけ true", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const ans = async (hid: string, who: World["boss"]) =>
      (await h.asMember<{ v: boolean }>(w.boss, "select app.handover_answerer($1, $2) as v", [hid, who.id]))[0]!.v;
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato });
    expect(await ans(hid, w.sato)).toBe(true);
    expect(await ans(hid, w.boss)).toBe(false);
    expect(await ans(hid, w.suzuki)).toBe(false);
    const decided = await h.waiting(w, { ticketId: (await h.ticket(w)).id, to: w.sato, state: "declined" });
    expect(await ans(decided, w.sato)).toBe(false);
    const toStopped = await h.waiting(w, { ticketId: (await h.ticket(w)).id, to: w.stopped });
    expect(await ans(toStopped, w.stopped)).toBe(false);
    const gid = await h.waiting(w, {
      ticketId: (await h.ticket(w)).id,
      kind: "distribute",
      from: w.boss,
      toScope: w.co.jd,
    });
    expect(await ans(gid, w.jdMgr)).toBe(true);
    expect(await ans(gid, w.jdMember)).toBe(false);
    const other = await h.f.person(w.co.tenantId, w.co.eg, { name: "営業の人（管理しない）", ticketAbility: "edit" });
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [w.co.tenantId, w.co.jd, w.jdMember.id],
    );
    expect(await ans(gid, w.jdMember)).toBe(true); // 管理する人になったら true
    expect(await ans(gid, { ...other, name: "", email: null })).toBe(false);
  });

  it("K401-DB-027 読める人：グループ宛ての渡しが待っている間、宛てのグループのマネージャーはチケットを読める・取り消したら読めない", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const seen = async () =>
      Number(
        (await h.asMember<{ n: string }>(w.jdMgr, "select count(*) as n from tickets where id = $1", [t.id]))[0]!.n,
      );
    expect(await seen()).toBe(0);
    const gid = await h.waiting(w, { ticketId: t.id, kind: "distribute", from: w.mgr, toScope: w.co.jd });
    expect(await seen()).toBe(1);
    await h.f.admin.query("update ticket_handovers set state = 'withdrawn', decided_at = now() where id = $1", [gid]);
    expect(await seen()).toBe(0);
  });

  it("K401-DB-028 種類と止まり：担当者 {pass}・管理する人 {distribute,offer}・メンバー {offer}・閲覧のみ／止まっている人／下書き {}・止まりは p_except の渡しを数えない", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const kinds = async (ticket: string, who: World["boss"]) =>
      (await h.asOwner<{ v: string[] }>(w.boss, "select app.handover_kinds($1, $2) as v", [ticket, who.id]))[0]!.v;
    expect(await kinds(t.id, w.boss)).toEqual(["pass"]);
    expect(await kinds(t.id, w.mgr)).toEqual(["distribute", "offer"]);
    expect(await kinds(t.id, w.sato)).toEqual(["offer"]);
    expect(await kinds(t.id, w.viewer)).toEqual([]);
    expect(await kinds(t.id, w.stopped)).toEqual([]);
    const draft = await h.ticket(w, { draft: w.boss });
    expect(await kinds(draft.id, w.boss)).toEqual([]);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato });
    const blocked = async (except: string | null) =>
      (await h.asOwner<{ v: string | null }>(w.boss, "select app.handover_blocked($1, $2) as v", [t.id, except]))[0]!.v;
    expect(await blocked(null)).toBe("waiting");
    expect(await blocked(hid)).toBeNull();
  });

  it("K401-DB-029 関数の守り：kaname_app が直に呼べるのは渡した関数だけ。中だけの関数は permission denied", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato });
    await h.asMember(w.boss, "select app.handover_rules_list() as v");
    await h.asMember(w.boss, "select app.handover_answerer($1, $2) as v", [hid, w.sato.id]);
    await h.asMember(w.boss, "select app.handover_preview($1) as v", [t.id]);
    await h.asMember(w.boss, "select app.handover_gate($1, $2::jsonb) as v", [
      t.id,
      JSON.stringify(h.passBody(w.sato)),
    ]);
    await h.asMember(w.sato, "select app.handover_answer_gate($1) as v", [hid]);
    await h.asMember(w.boss, "select app.handover_mail_mark($1::uuid[], $2::uuid[])", [[], []]);
    for (const [sql, params] of [
      ["select app.handover_kinds($1, $2)", [t.id, w.sato.id]],
      ["select app.handover_member_state($1)", [w.sato.id]],
      ["select app.handover_switch_normalize($1, $2, '{}'::jsonb)", [t.id, w.sato.id]],
    ] as const)
      await expect(h.asMember(w.boss, sql, [...params])).rejects.toThrow(/permission denied/);
    await expect(
      h.asMember(w.boss, "select app.handover_apply_switch($1, $2, $3)", [hid, w.boss.id, w.sato.id]),
    ).rejects.toThrow(/permission denied/);
  });

  it("K401-DB-030 送った印：渡しの知らせの行だけ sent_at／failed_at を入れる。ほかの会社・ほかの種類・印のある行は変えない", async () => {
    await h.ready();
    const w = await h.world();
    const add = async (tenant: string, member: string, kind: string, sent = false) =>
      (
        await h.one<{ id: string }>(
          `insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, sent_at)
           values ($1, $2, 'inapp', $3, '{}'::jsonb, case when $4 then now() - interval '1 hour' end) returning id`,
          [tenant, member, kind, sent],
        )
      ).id;
    const ok = await add(w.co.tenantId, w.sato.id, "handover.requested");
    const bad = await add(w.co.tenantId, w.sato.id, "handover.declined");
    const otherKind = await add(w.co.tenantId, w.sato.id, "ticket.assigned");
    const otherCo = await add(w.other.tenantId, w.outsider.id, "handover.requested");
    const marked = await add(w.co.tenantId, w.sato.id, "handover.requested", true);
    const before = (await h.one<{ sent_at: Date }>("select sent_at from notifications where id = $1", [marked]))
      .sent_at;
    await h.asMember(w.boss, "select app.handover_mail_mark($1::uuid[], $2::uuid[])", [
      [ok, otherKind, otherCo, marked],
      [bad],
    ]);
    const row = (id: string) =>
      h.one<{ sent_at: Date | null; failed_at: Date | null }>(
        "select sent_at, failed_at from notifications where id = $1",
        [id],
      );
    expect((await row(ok)).sent_at).not.toBeNull();
    expect((await row(bad)).failed_at).not.toBeNull();
    expect((await row(bad)).sent_at).toBeNull();
    expect((await row(otherKind)).sent_at).toBeNull();
    expect((await row(otherCo)).sent_at).toBeNull();
    expect((await row(marked)).sent_at!.getTime()).toBe(before.getTime());
  });
});
