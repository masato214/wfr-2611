// K-405「渡されたものを承認待ちに並べる・詳細で渡しの今と記録を読む」の単体の試験（口・本物の DB）。名前の頭の行 ID（K405-API-…）は 11_tickets/K-405.md の表に 1 対 1。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 土台は K-63 の approve-complete.harness.ts（本物の Postgres・本物の口の入口・承認待ちの口 listApprovalQueue は K-161 の物をそのまま）。
//   承認待ちの行は、K-161 の作る段が終わった形（delegated）と、渡しの行（ticket_handovers）を DB に直に置いて作る（渡す口 K-402 は通さない・依存を外した）。
//   詳細の口 listTicketHandovers は、この葉の hooks のファイル apps/api/src/hooks/handovers-read.ts の register を、各 it の頭の ready() で読む
//   （実装の前の切る段の smoke で、まだ無いファイルを土台の頭で読みに行って準備ごと落とさないため・answer=8f745003d023）。
//
// 試験が決める口の形（K-405.md の「答えの形」）:
//   listApprovalQueue   GET /approvals/queue（K-161）→ 行に渡しも並ぶ。渡しの行は kind "handover"・handover_kind（pass／offer／distribute）・reply_due・carry_children を持つ。
//                       AI の成果物の行も同じ 3 つの鍵を null で持つ。並びの鍵 due_on は「その行で答える期限の日付」（渡しは返事の期限の日本の日付・無ければチケットの期限）
//   getTicket           GET /tickets/:id → data.handover に今の渡し（待っている 1 件か、無ければ一番新しく作った 1 件・形は listTicketHandovers の 1 件と同じ 17 の鍵）か null。
//                       詳細を開いたときは listTicketHandovers を呼ばない（PM の決め・口は 6 本のまま）。getTicket の読む文は K-387 が 1 文にした物に関数を 1 つ足す
//   listTicketHandovers GET /tickets/:id/handovers → 200 { data: HandoverView[]（新しい順・最大 50）, meta: { limit } }。
//                       1 件の形は画面の葉の道具 apps/web/tests/k/handover-mock.ts の HView（K-400）と同じ入れ子（from・to・to_scope・switch・can）。
//                       帯を 1 回だけ出す・断られた帯を閉じるの覚えは画面の手元（K-400 の use-handovers.ts）で、この口は書かない
// 試験が前提にする DB の形：ticket_handovers の列（0072 と K-401 の reminded_at）・app.handover_answerer（K-401・waiting の間だけ真）。
//   待っている渡しは 1 つの守りは K-401 の決めのとおり作る関数の for update（一意の索引は無い）。この試験は行を直に置くので関わらない。
//   一緒に切り替える物の印は K-401 が整えた形 switch { children, links, group, axes }（違えば下の SWITCH_CHILDREN の 1 つだけを合わせる）
//   詳細の 1 件の switch は { children: 子の数, group: グループも移すか }（K-400 の HView の scope は group に読み替える・まとめ役）
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Person } from "../fixture.js";
import {
  setupApproveComplete,
  f,
  hooks,
  limits,
  T,
  O,
  outsider,
  json,
  one,
  auth,
  req,
  queue,
  ticket,
  delegated,
  jstDate,
  type Ticket,
} from "../F5/approve-complete.harness.js";

setupApproveComplete();

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
/** この葉の hooks のファイル（読むのは it の中だけ） */
const READ_HOOKS = join(HOOKS_DIR, "handovers-read.ts");
let loading: Promise<void> | null = null;
const ready = async () => {
  loading ??= (async () => {
    expect(existsSync(READ_HOOKS), "この葉の hooks のファイル handovers-read.ts").toBe(true);
    const mod = (await import(READ_HOOKS)) as { register: HookModule };
    Object.assign(hooks, mod.register.make({ appPool: f.pool } as unknown as HookDeps));
    limits["listTicketHandovers"] = 10_000;
  })();
  await loading;
};

/** 一緒に移す子の印（K-401 の switch の鍵） */
const SWITCH_CHILDREN = { children: true, links: false, group: false, axes: [] } as const;
const QUEUE_HANDOVER_KEYS = [
  "carry_children",
  "check_summary",
  "created_at",
  "decide_inline",
  "due_on",
  "from_member_id",
  "from_name",
  "handover_kind",
  "id",
  "irreversible",
  "kind",
  "note",
  "primary_action",
  "reply_due",
  "secondary_action",
  "ticket_id",
  "ticket_number",
  "ticket_scope_name",
  "title",
  "to_scope_name",
];
const LIST_KEYS = [
  "can",
  "created_at",
  "decided_at",
  "decline_reason",
  "from",
  "id",
  "kind",
  "overdue",
  "reason",
  "reminded_at",
  "reply_due",
  "state",
  "switch",
  "to",
  "to_scope",
  "ticket_scope",
  "ask",
].sort();

type Row = Record<string, unknown>;
const rowsOf = async (r: Response) => (await json(r)).data as unknown as Row[];
const totalOf = async (r: Response) => ((await json(r)).meta!["counts"] as { total: number }).total;
/** 試験ごとの新しい人（人を試験どうしで使い回さない） */
const person = (name: string, scope = T.rootScope, tenant = T.tenantId, ability: "edit" | "view" = "edit") =>
  f.person(tenant, scope, { name, ticketAbility: ability });
/** 日本の日付 day の 18:00（UTC の 09:00）。返事の期限の既定の形（D-148.4） */
const at18 = (day: string) => `${day}T09:00:00.000Z`;

/** T のいちばん上のグループの下に、新しいグループを 1 つ作る */
const scopeOf = async (name: string, prefix: string) =>
  (
    await one<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
      [T.tenantId, T.rootScope, name, prefix],
    )
  ).id;

/** 渡しの行を DB に直に置く（渡す口 K-402 は通さない） */
async function handover(
  t: Ticket,
  o: {
    kind?: "pass" | "offer" | "distribute" | "escalate";
    from: Person;
    to?: Person | null;
    toScope?: string | null;
    reason?: string;
    ask?: string | null;
    replyDue?: string | null;
    state?: "waiting" | "accepted" | "declined" | "withdrawn";
    declineReason?: string | null;
    sw?: Record<string, unknown>;
    ago?: number; // 作った時刻を何分前にするか
  },
): Promise<string> {
  const state = o.state ?? "waiting";
  const r = await one<{ id: string }>(
    `insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, to_scope_id, reason, ask, reply_due, switch,
                                   state, decline_reason, decided_at, created_at, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
             case when $11 = 'waiting' then null else now() - make_interval(mins => $13) end,
             now() - make_interval(mins => $13), $4) returning id`,
    [
      t.tenant,
      t.id,
      o.kind ?? "pass",
      o.from.id,
      o.to === undefined ? null : (o.to?.id ?? null),
      o.toScope ?? null,
      o.reason ?? "来週から展示会の準備に入るため",
      o.ask ?? null,
      o.replyDue === undefined ? at18(jstDate(1)) : o.replyDue,
      JSON.stringify(o.sw ?? {}),
      state,
      state === "declined" ? (o.declineReason ?? "今週は手が空かないため") : null,
      o.ago ?? 1,
    ],
  );
  return r.id;
}
const list = (p: Person, ticketId: string, headers: Record<string, string> = {}) =>
  req("GET", `/tickets/${ticketId}/handovers`, { headers: { ...auth(p), ...headers } });
async function listOk(p: Person, ticketId: string): Promise<Row[]> {
  const r = await list(p, ticketId);
  expect(r.status, await r.clone().text()).toBe(200);
  return rowsOf(r);
}
/** 詳細の答え getTicket の handover_kinds（見ている人ができる種類・入口の出し分け） */
async function kindsOf(p: Person, ticketId: string): Promise<unknown> {
  const r = await req("GET", `/tickets/${ticketId}`, { headers: auth(p) });
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await json(r)).data as unknown as Row)["handover_kinds"];
}
/** 詳細の答え getTicket（K-60・K-387 の後の形）の handover（今の渡し・PM の決め：詳細を開いたときの口は 6 本のまま） */
async function currentOf(p: Person, ticketId: string): Promise<Row | null> {
  const r = await req("GET", `/tickets/${ticketId}`, { headers: auth(p) });
  expect(r.status, await r.clone().text()).toBe(200);
  const d = (await json(r)).data as unknown as Row;
  expect(Object.keys(d), "getTicket の答えに handover の鍵が在る（無ければ null）").toContain("handover");
  return (d["handover"] as Row | null) ?? null;
}

describe("K-405 承認待ちに渡しも並ぶ（listApprovalQueue・本物の DB）", () => {
  it("K405-API-001 待っている渡し × 承認待ちを開く × 渡された人：渡しの行が 1 つ並ぶ。鍵はちょうど 20 個・種類 handover／pass・受ける／断る・その場で決める・理由が note・返事の期限・期限の日付・数も 1", async () => {
    const who = await person("渡された人 001");
    const from = await person("高本 001");
    const t = await ticket({ assignee: from, due: jstDate(9), title: "見積もりを山田様に送る" });
    const id = await handover(t, { from, to: who, reason: "先方と面識があるので", replyDue: at18(jstDate(1)) });
    const r = await queue(who);
    expect(r.status, await r.clone().text()).toBe(200);
    const rows = await rowsOf(r);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(QUEUE_HANDOVER_KEYS);
    expect(rows[0]).toMatchObject({
      kind: "handover",
      handover_kind: "pass",
      id,
      ticket_id: t.id,
      ticket_number: t.number,
      title: "見積もりを山田様に送る",
      from_member_id: from.id,
      from_name: "高本 001",
      check_summary: "",
      due_on: jstDate(1),
      decide_inline: true,
      irreversible: false,
      primary_action: "accept",
      secondary_action: "decline",
      note: "先方と面識があるので",
      carry_children: 0,
      to_scope_name: null,
    });
    expect(new Date(String(rows[0]!["reply_due"])).toISOString()).toBe(at18(jstDate(1)));
    expect(await totalOf(r)).toBe(1);
  });

  it("K405-API-002 渡しと AI の成果物が混ざる × 承認待ちを開く：その行で答える期限の早い順（渡しは返事の期限の日付・申し出はチケットの期限・期限なしは最後）。数は行の数と同じ", async () => {
    const who = await person("混ざる人 002");
    const from = await person("渡す人 002");
    const art3 = await delegated(await ticket({ assignee: who, due: jstDate(3) }));
    const artNone = await delegated(await ticket({ assignee: who, due: null }));
    const pass1 = await handover(await ticket({ assignee: from, due: jstDate(10) }), {
      from,
      to: who,
      replyDue: at18(jstDate(1)),
    });
    const offer5 = await handover(await ticket({ assignee: who, due: jstDate(5) }), {
      kind: "offer",
      from,
      to: who,
      replyDue: null,
    });
    const r = await queue(who);
    expect(r.status).toBe(200);
    expect((await rowsOf(r)).map((x) => x["id"])).toEqual([pass1, art3.approvalId, offer5, artNone.approvalId]);
    expect(await totalOf(r)).toBe(4);
  });

  it("K405-API-003 申し出（D-148.12）× 担当者の承認待ち：種類は「渡された」のまま handover_kind offer・渡す／断る（give／decline）・返事の期限は null・期限の日付はチケットの期限・note は申し出の理由", async () => {
    const who = await person("担当者 003");
    const offerer = await person("申し出る人 003");
    const t = await ticket({ assignee: who, due: jstDate(6) });
    const id = await handover(t, { kind: "offer", from: offerer, to: who, replyDue: null, reason: "手が空いたので" });
    const row = (await rowsOf(await queue(who))).find((x) => x["id"] === id)!;
    expect(row).toMatchObject({
      kind: "handover",
      handover_kind: "offer",
      from_member_id: offerer.id,
      primary_action: "give",
      secondary_action: "decline",
      reply_due: null,
      due_on: jstDate(6),
      note: "手が空いたので",
      decide_inline: true,
    });
  });

  it("K405-API-004 配る（D-125.92・D-148.16）× 答える人の承認待ち：グループに配った行は claim／assign（そのグループのマネージャー）、合意ありで人に配った行は accept／decline", async () => {
    const jd = await scopeOf("受託開発 004", "JE");
    const jdMgr = await person("受託開発のマネージャー 004", jd);
    await f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [T.tenantId, jd, jdMgr.id],
    );
    const mgr = await person("配る人 004");
    const group = await handover(await ticket({ assignee: mgr }), {
      kind: "distribute",
      from: mgr,
      to: null,
      toScope: jd,
      replyDue: null,
    });
    const toPerson = await handover(await ticket({ assignee: mgr }), {
      kind: "distribute",
      from: mgr,
      to: jdMgr,
      replyDue: at18(jstDate(2)),
    });
    const rows = await rowsOf(await queue(jdMgr));
    expect(rows.find((x) => x["id"] === group)).toMatchObject({
      handover_kind: "distribute",
      primary_action: "claim",
      secondary_action: "assign",
    });
    expect(rows.find((x) => x["id"] === toPerson)).toMatchObject({
      handover_kind: "distribute",
      primary_action: "accept",
      secondary_action: "decline",
      due_on: jstDate(2),
    });
  });

  it("K405-API-005 もう決まった・消した・上へ上げる × 承認待ちを開く：受けた・断られた・取り消された・消した渡し・消したチケットの渡し・上へ上げる（束 C は後・D-148.1）は並ばない。数も 0", async () => {
    const who = await person("並ばない人 005");
    const from = await person("渡す人 005");
    for (const state of ["accepted", "declined", "withdrawn"] as const)
      await handover(await ticket({ assignee: from }), { from, to: who, state });
    const del = await handover(await ticket({ assignee: from }), { from, to: who });
    await f.admin.query("update ticket_handovers set deleted_at = now() where id = $1", [del]);
    const gone = await ticket({ assignee: from });
    await handover(gone, { from, to: who });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    await handover(await ticket({ assignee: from }), { kind: "escalate", from, to: who });
    const r = await queue(who);
    expect(await rowsOf(r)).toEqual([]);
    expect(await totalOf(r)).toBe(0);
  });

  it("K405-API-006 答えるのが自分でない × 承認待ちを開く：渡した人・別の人・別の会社の人の承認待ちには並ばない（数も 0）", async () => {
    const who = await person("渡された人 006");
    const from = await person("渡す人 006");
    const other = await person("別の人 006");
    await handover(await ticket({ assignee: from }), { from, to: who });
    for (const p of [from, other, outsider]) {
      const r = await queue(p);
      expect(r.status).toBe(200);
      expect(await rowsOf(r), "答えるのが自分でない人").toEqual([]);
      expect(await totalOf(r)).toBe(0);
    }
    expect(await totalOf(await queue(who))).toBe(1);
  });

  it("K405-API-007 渡しと成果物が 24 件 × 一覧を続けて読む：1 回 20 件・続きの鍵で残り 4 件。重複・飛びが無く、並びは期限の日付の順（G-16・D-131.9）", async () => {
    const who = await person("続きを読む人 007");
    const from = await person("渡す人 007");
    const want: string[] = [];
    for (let i = 0; i < 24; i++) {
      // 偶数の日はチケットの期限の成果物、奇数の日は返事の期限の渡し（日付が全部違うので並びは日付だけで決まる）
      if (i % 2 === 0) want.push((await delegated(await ticket({ assignee: who, due: jstDate(i + 1) }))).approvalId);
      else
        want.push(
          await handover(await ticket({ assignee: from, due: jstDate(40) }), {
            from,
            to: who,
            replyDue: at18(jstDate(i + 1)),
          }),
        );
    }
    const j1 = await json(await queue(who));
    const page1 = (j1.data as unknown as Row[]).map((x) => String(x["id"]));
    expect(page1).toEqual(want.slice(0, 20));
    expect((j1.meta!["counts"] as { total: number }).total).toBe(24);
    const j2 = await json(await queue(who, `?cursor=${encodeURIComponent(String(j1.meta!["cursor"]))}`));
    const page2 = (j2.data as unknown as Row[]).map((x) => String(x["id"]));
    expect(page2).toEqual(want.slice(20));
    expect(new Set([...page1, ...page2]).size).toBe(24);
    expect(j2.meta!["cursor"]).toBeUndefined();
  });

  it("K405-API-008 AI の成果物の行 × 承認待ちを開く：今の鍵（K-161）に足した 5 つ（handover_kind・reply_due・carry_children・to_scope_name・ticket_scope_name）を null で持つ。ほかの値は今のまま", async () => {
    const who = await person("成果物の人 008");
    const d = await delegated(await ticket({ assignee: who, due: jstDate(2) }), { irreversible: false });
    const row = (await rowsOf(await queue(who)))[0]!;
    expect(Object.keys(row).sort()).toEqual(QUEUE_HANDOVER_KEYS);
    expect(row).toMatchObject({
      kind: "artifact",
      id: d.approvalId,
      handover_kind: null,
      reply_due: null,
      carry_children: null,
      to_scope_name: null,
      ticket_scope_name: null,
      primary_action: "approve",
      secondary_action: "return",
      due_on: jstDate(2),
    });
  });

  it("K405-API-009 一緒に移す子（D-148.11）× 承認待ちの行と詳細：switch に子の印があれば、渡す人が担当の子・孫で終わっていない・消していない物の数。印が無ければ 0", async () => {
    const who = await person("受ける人 009");
    const from = await person("渡す人 009");
    const other = await person("ほかの人 009");
    const parent = await ticket({ assignee: from });
    const child = await ticket({ assignee: from, parent: parent.id });
    await ticket({ assignee: from, parent: child.id }); // 孫（数える）
    await ticket({ assignee: other, parent: parent.id }); // ほかの人の子（数えない）
    const done = await ticket({ assignee: from, parent: parent.id });
    await f.admin.query("update tickets set completed_at = now() where id = $1", [done.id]); // 終わった子（数えない）
    const del = await ticket({ assignee: from, parent: parent.id });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [del.id]); // 消した子（数えない）
    const withKids = await handover(parent, { from, to: who, sw: SWITCH_CHILDREN });
    expect((await rowsOf(await queue(who))).find((x) => x["id"] === withKids)!["carry_children"]).toBe(2);
    await ready();
    expect((await listOk(from, parent.id))[0]!["switch"]).toEqual({ children: 2, group: false });
    await f.admin.query("update ticket_handovers set switch = '{}'::jsonb where id = $1", [withKids]);
    expect((await rowsOf(await queue(who))).find((x) => x["id"] === withKids)!["carry_children"]).toBe(0);
  });
});

describe("K-405 詳細で渡しの今と記録を読む（listTicketHandovers・本物の DB）", () => {
  it("K405-API-010 待っている渡し × 詳細を開く × 渡した人と渡された人：1 件・鍵はちょうど 17 個（入れ子は from・to・to_scope・ticket_scope・switch・can）。渡した人は取り消せる・催促できる・別の人にできる、渡された人は答えられるだけ。理由・お願い・返事の期限・名前", async () => {
    await ready();
    const from = await person("高本 010");
    const to = await person("佐藤 010");
    const t = await ticket({ assignee: from });
    const id = await handover(t, {
      from,
      to,
      reason: "先方と面識があるので",
      ask: "金曜までに一次返信を",
      replyDue: at18(jstDate(2)),
    });
    const mine = await listOk(from, t.id);
    expect(mine).toHaveLength(1);
    expect(Object.keys(mine[0]!).sort()).toEqual(LIST_KEYS);
    expect(mine[0]).toMatchObject({
      id,
      kind: "pass",
      state: "waiting",
      from: { member_id: from.id, display_name: "高本 010" },
      to: { member_id: to.id, display_name: "佐藤 010" },
      to_scope: null,
      ticket_scope: { id: T.rootScope },
      reason: "先方と面識があるので",
      ask: "金曜までに一次返信を",
      overdue: false,
      switch: { children: 0, group: false },
      decline_reason: null,
      decided_at: null,
      reminded_at: null,
      can: { answer: false, withdraw: true, remind: true, reassign: true },
    });
    expect(new Date(String(mine[0]!["reply_due"])).toISOString()).toBe(at18(jstDate(2)));
    expect((await listOk(to, t.id))[0]!["can"]).toEqual({
      answer: true,
      withdraw: false,
      remind: false,
      reassign: false,
    });
  });

  it("K405-API-011 前の渡し（断った理由・取り消し・受けた）× 詳細を開く：全部が新しい順。断られた行は断った理由と決めた時刻を持つ（D-125.90 理由は記録に残る）", async () => {
    await ready();
    const a = await person("高本 011");
    const b = await person("佐藤 011");
    const c = await person("鈴木 011");
    const t = await ticket({ assignee: a });
    const declined = await handover(t, {
      from: a,
      to: b,
      state: "declined",
      declineReason: "今週は手が空かない",
      ago: 40,
    });
    const withdrawn = await handover(t, { from: a, to: c, state: "withdrawn", ago: 30 });
    const accepted = await handover(t, { from: a, to: c, state: "accepted", ago: 20 });
    const waiting = await handover(t, { from: c, to: b, ago: 10 });
    const rows = await listOk(a, t.id);
    expect(rows.map((x) => x["id"])).toEqual([waiting, accepted, withdrawn, declined]);
    expect(rows.at(-1)).toMatchObject({ state: "declined", decline_reason: "今週は手が空かない" });
    expect((rows.at(-1)!["can"] as Record<string, boolean>)["withdraw"]).toBe(false);
    expect(rows.at(-1)!["decided_at"]).not.toBeNull();
  });

  it("K405-API-012 渡しが 51 件 × 詳細を開く：新しい 50 件だけ（上限 50・行ごとに読まない）", async () => {
    await ready();
    const a = await person("高本 012");
    const b = await person("佐藤 012");
    const t = await ticket({ assignee: a });
    const ids: string[] = [];
    for (let i = 0; i < 51; i++) ids.push(await handover(t, { from: a, to: b, state: "withdrawn", ago: 100 - i }));
    const rows = await listOk(a, t.id);
    expect(rows).toHaveLength(50);
    expect(rows.map((x) => x["id"])).toEqual(ids.slice(1).reverse());
  });

  it("K405-API-013 返事の期限の境目（G-12）× 詳細を開く：待っている渡しの期限が 1 秒前に過ぎた → overdue true・1 分後 → false。決まった渡しは期限が過ぎていても false", async () => {
    await ready();
    const a = await person("高本 013");
    const b = await person("佐藤 013");
    const past = await ticket({ assignee: a });
    const pastId = await handover(past, { from: a, to: b });
    await f.admin.query("update ticket_handovers set reply_due = now() - interval '1 second' where id = $1", [pastId]);
    expect((await listOk(a, past.id))[0]!["overdue"]).toBe(true);
    const soon = await ticket({ assignee: a });
    const soonId = await handover(soon, { from: a, to: b });
    await f.admin.query("update ticket_handovers set reply_due = now() + interval '1 minute' where id = $1", [soonId]);
    expect((await listOk(a, soon.id))[0]!["overdue"]).toBe(false);
    const decided = await ticket({ assignee: a });
    await handover(decided, { from: a, to: b, state: "declined", replyDue: "2020-01-01T09:00:00.000Z" });
    expect((await listOk(a, decided.id))[0]!["overdue"]).toBe(false);
  });

  it("K405-API-014 渡した人ができること（can）× 詳細を開く：催促は待っている人宛ての渡し（渡す・人に配る）で、今日（日本の日付）まだ催促していないときだけ（K-406 と同じ式・D-148.8）。別の人にするは、いちばん新しい渡しが待っている・断られたで、今も担当者のときだけ。申し出・グループ宛ては催促できない", async () => {
    await ready();
    const from = await person("高本 014");
    const to = await person("佐藤 014");
    const canOf = async (t: Ticket) => (await listOk(from, t.id))[0]!["can"] as Record<string, boolean>;
    const today = await ticket({ assignee: from });
    const h1 = await handover(today, { from, to });
    await f.admin.query("update ticket_handovers set reminded_at = now() where id = $1", [h1]);
    expect(await canOf(today)).toMatchObject({ remind: false, withdraw: true, reassign: true });
    await f.admin.query("update ticket_handovers set reminded_at = now() - interval '1 day' where id = $1", [h1]);
    expect((await canOf(today))["remind"]).toBe(true);
    const declined = await ticket({ assignee: from });
    await handover(declined, { from, to, state: "declined" });
    expect(await canOf(declined)).toEqual({ answer: false, withdraw: false, remind: false, reassign: true });
    const moved = await ticket({ assignee: to });
    await handover(moved, { from, to, state: "accepted" });
    expect((await canOf(moved))["reassign"]).toBe(false);
    const jd = await scopeOf("グループ 014", "JG");
    const group = await ticket({ assignee: from });
    await handover(group, { kind: "distribute", from, to: null, toScope: jd, replyDue: null });
    expect(await canOf(group)).toMatchObject({ remind: false, withdraw: true });
    const offerT = await ticket({ assignee: to });
    await handover(offerT, { kind: "offer", from, to, replyDue: null });
    expect(await canOf(offerT)).toMatchObject({ remind: false, withdraw: true, reassign: false });
  });

  it("K405-API-015 見える範囲 × 詳細を開く：同じ会社の見るだけの人は読める（取り消せない・答えられない）。チケットのグループを見られない渡された人も、待っている間は読める（D-128.115）。別の会社の人は 404", async () => {
    await ready();
    const from = await person("高本 015");
    const viewer = await person("見るだけの人 015", T.rootScope, T.tenantId, "view");
    const jdB = await scopeOf("チケットのグループ 015", "JB");
    const jdA = await scopeOf("別のグループ 015", "JA");
    const stranger = await f.person(T.tenantId, jdA, { name: "グループの外の人 015", ticketAbility: null });
    const t = await ticket({ assignee: from, scope: jdB });
    await handover(t, { from, to: stranger });
    expect((await listOk(viewer, t.id))[0]!["can"]).toEqual({
      answer: false,
      withdraw: false,
      remind: false,
      reassign: false,
    });
    expect((await listOk(stranger, t.id))[0]!["can"]).toMatchObject({ answer: true, withdraw: false });
    const r = await list(outsider, t.id);
    expect(r.status).toBe(404);
    expect(JSON.stringify(await json(r))).not.toContain("来週から展示会の準備に入るため");
  });

  it("K405-API-016 渡しが無い × 詳細を開く：200・data は空の並び・meta に limit", async () => {
    await ready();
    const a = await person("高本 016");
    const t = await ticket({ assignee: a });
    const r = await list(a, t.id);
    expect(r.status).toBe(200);
    const j = await json(r);
    expect(j.data).toEqual([]);
    expect(j.meta).toMatchObject({ limit: 50 });
  });

  it("K405-API-017 入口 × 詳細の口：ログインしていない 401・無いチケットの id 404・uuid でない 422（欄 id）・消したチケット 404・取引先の人 403", async () => {
    await ready();
    const a = await person("高本 017");
    const t = await ticket({ assignee: a });
    await handover(t, { from: a, to: await person("佐藤 017") });
    expect((await req("GET", `/tickets/${t.id}/handovers`)).status).toBe(401);
    expect((await list(a, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    const bad = await list(a, "not-a-uuid");
    expect(bad.status).toBe(422);
    expect(((await json(bad))["details"] as { field: string }[]).map((x) => x.field)).toContain("id");
    expect((await req("GET", `/tickets/${t.id}/handovers`, { headers: auth(a, { role: "client" }) })).status).toBe(403);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    expect((await list(a, t.id)).status).toBe(404);
  });

  it("K405-API-018 守り × 詳細の口を 1 分に 121 回：429・待つ秒数は 1〜60 の整数", async () => {
    await ready();
    const a = await person("上限 018");
    const t = await ticket({ assignee: a });
    limits["listTicketHandovers"] = 120;
    try {
      for (let i = 0; i < 120; i++) expect((await list(a, t.id)).status).toBe(200);
      const r = await list(a, t.id);
      expect(r.status).toBe(429);
      const sec = Number((await json(r))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      limits["listTicketHandovers"] = 10_000;
    }
  }, 60_000); // 何十回も続けて口を呼ぶ送りすぎの確かめ（重い台でも既定の 5 秒で切らない）

  it("K405-API-019 守り × 詳細の答え：Cache-Control に private と no-store（認証の要る答えを貯めない）", async () => {
    await ready();
    const a = await person("高本 019");
    const t = await ticket({ assignee: a });
    const cc = (await list(a, t.id)).headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });

  it("K405-API-020 守り（2 層目）× DB の関数を直に呼ぶ：別の会社の文脈では app.ticket_handovers_read は null。同じ会社でもチケットが見えず渡しにも関わらない人は null。読む関数は何も書かない（渡しの行の更新時刻が変わらない）", async () => {
    const from = await person("高本 020");
    const to = await person("佐藤 020");
    const jdB = await scopeOf("チケットのグループ 020", "JC");
    const jdA = await scopeOf("別のグループ 020", "JD");
    const stranger = await f.person(T.tenantId, jdA, { name: "見えない人 020", ticketAbility: null });
    const t = await ticket({ assignee: to, scope: jdB });
    const id = await handover(t, { from, to, state: "accepted" });
    const before = await one<{ u: string }>("select updated_at::text as u from ticket_handovers where id = $1", [id]);
    const call = (tenantId: string, userId: string) =>
      withTenant(f.pool, { tenantId, userId, role: "member", stepUpAt: null }, async (cl) => {
        const r = await cl.query<{ v: unknown }>("select app.ticket_handovers_read($1) as v", [t.id]);
        return r.rows[0]?.v ?? null;
      });
    expect(await call(O.tenantId, outsider.id)).toBeNull();
    expect(await call(T.tenantId, stranger.id)).toBeNull();
    expect(await call(T.tenantId, to.id)).not.toBeNull();
    const after = await one<{ u: string }>("select updated_at::text as u from ticket_handovers where id = $1", [id]);
    expect(after.u).toBe(before.u);
  });
  it("K405-API-021 グループの名前 × 承認待ちと詳細：グループ宛ての渡しの行は to_scope_name に宛てのグループ（受託開発）・ticket_scope_name にチケットの今のグループ（営業）。人宛ての行の to_scope_name は null。詳細の 1 件の ticket_scope は { id, name, code } で今のグループ（受けた後の帯の「グループは〇〇のまま」に使う）", async () => {
    await ready();
    const eg = await scopeOf("営業 021", "EM");
    const jd = await scopeOf("受託開発 021", "JM");
    const jdMgr = await person("受託開発のマネージャー 021", jd);
    await f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [T.tenantId, jd, jdMgr.id],
    );
    const mgr = await person("配る人 021");
    const t = await ticket({ assignee: mgr, scope: eg });
    const group = await handover(t, { kind: "distribute", from: mgr, to: null, toScope: jd, replyDue: null });
    const toPerson = await handover(await ticket({ assignee: mgr, scope: eg }), { from: mgr, to: jdMgr });
    const rows = await rowsOf(await queue(jdMgr));
    const g = rows.find((x) => x["id"] === group)!;
    expect(Object.keys(g).sort()).toEqual(QUEUE_HANDOVER_KEYS);
    expect(g).toMatchObject({ to_scope_name: "受託開発 021", ticket_scope_name: "営業 021" });
    expect(rows.find((x) => x["id"] === toPerson)).toMatchObject({
      to_scope_name: null,
      ticket_scope_name: "営業 021",
    });
    const d = await listOk(jdMgr, t.id);
    expect(Object.keys(d[0]!).sort()).toEqual(LIST_KEYS);
    expect(d[0]).toMatchObject({
      id: group,
      to_scope: { id: jd, name: "受託開発 021", code: "JM" },
      ticket_scope: { id: eg, name: "営業 021", code: "EM" },
    });
  });
  it("K405-API-022 getTicket の今の渡し（待っている）× 詳細を開く × 渡した人と渡された人：答えの handover は待っている 1 件（鍵ちょうど 17・can は人ごと）。前に断られた渡しが在っても待っている 1 件。渡しが無いチケットは null", async () => {
    await ready();
    const from = await person("高本 022");
    const to = await person("佐藤 022");
    const other = await person("鈴木 022");
    const t = await ticket({ assignee: from });
    await handover(t, { from, to: other, state: "declined", ago: 30 });
    const waiting = await handover(t, { from, to, replyDue: at18(jstDate(2)), ago: 5 });
    const mine = await currentOf(from, t.id);
    expect(mine).not.toBeNull();
    expect(Object.keys(mine!).sort()).toEqual(LIST_KEYS);
    expect(mine).toMatchObject({
      id: waiting,
      state: "waiting",
      to: { member_id: to.id, display_name: "佐藤 022" },
      can: { answer: false, withdraw: true, remind: true, reassign: true },
    });
    const theirs = await currentOf(to, t.id);
    expect(theirs).toMatchObject({
      id: waiting,
      can: { answer: true, withdraw: false, remind: false, reassign: false },
    });
    expect(await currentOf(from, (await ticket({ assignee: from })).id)).toBeNull();
  });

  it("K405-API-023 getTicket の今の渡し（決まった後）・2 層目：待っている渡しが無ければ一番新しく作った 1 件（断られた帯の元）。消した渡しだけなら null。app.ticket_handover_current を別の会社の文脈で直に呼ぶと null", async () => {
    await ready();
    const from = await person("高本 023");
    const to = await person("佐藤 023");
    const t = await ticket({ assignee: from });
    await handover(t, { from, to, state: "withdrawn", ago: 3 });
    const declined = await handover(t, {
      from,
      to,
      state: "declined",
      declineReason: "今週は手が空かない",
      ago: 1,
    });
    expect(await currentOf(from, t.id)).toMatchObject({
      id: declined,
      state: "declined",
      decline_reason: "今週は手が空かない",
      can: { reassign: true },
    });
    const gone = await ticket({ assignee: from });
    const del = await handover(gone, { from, to });
    await f.admin.query("update ticket_handovers set deleted_at = now() where id = $1", [del]);
    expect(await currentOf(from, gone.id)).toBeNull();
    const call = (tenantId: string, userId: string) =>
      withTenant(f.pool, { tenantId, userId, role: "member", stepUpAt: null }, async (cl) => {
        const r = await cl.query<{ v: unknown }>("select app.ticket_handover_current($1) as v", [t.id]);
        return r.rows[0]?.v ?? null;
      });
    expect(await call(O.tenantId, outsider.id)).toBeNull();
    expect(await call(T.tenantId, from.id)).toMatchObject({ id: declined });
  });

  it("K405-API-024 getTicket の見ている人ができる種類 × 詳細を開く × 担当者・マネージャー・メンバー・閲覧のみ・別の会社：handover_kinds は [pass]・[distribute, offer]・[offer]・[]。別の会社の人は 404。包む関数は kaname_app から呼べ、app.handover_kinds は呼べない", async () => {
    await ready();
    const owner = await person("担当者 024");
    const mgr = await person("マネージャー 024");
    await f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [T.tenantId, T.rootScope, mgr.id],
    );
    const member = await person("メンバー 024");
    const viewer = await person("閲覧 024", T.rootScope, T.tenantId, "view");
    const t = await ticket({ assignee: owner });
    expect(await kindsOf(owner, t.id)).toEqual(["pass"]);
    expect(await kindsOf(mgr, t.id)).toEqual(["distribute", "offer"]);
    expect(await kindsOf(member, t.id)).toEqual(["offer"]);
    expect(await kindsOf(viewer, t.id)).toEqual([]);
    const away = await req("GET", `/tickets/${t.id}`, { headers: auth(outsider) });
    expect(away.status).toBe(404);
    expect((await json(away)).data).toBeUndefined();
    const ctx = { tenantId: T.tenantId, userId: owner.id, role: "member", stepUpAt: null };
    const wrapped = await withTenant(
      f.pool,
      ctx,
      async (cl) => (await cl.query<{ v: string[] }>("select app.ticket_handover_kinds($1) as v", [t.id])).rows[0]?.v,
    );
    expect(wrapped).toEqual(["pass"]);
    await expect(
      withTenant(f.pool, ctx, (cl) => cl.query("select app.handover_kinds($1, $2)", [t.id, owner.id])),
    ).rejects.toThrow(/permission denied/);
  });
});
