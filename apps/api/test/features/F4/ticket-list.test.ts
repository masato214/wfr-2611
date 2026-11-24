// K-92「チケットの一覧の口」の単体の試験（口・本物の DB）。名前の頭の行 ID（K92-API-…）は 11_tickets/K-92.md の行の表と 1 対 1。
// 口：GET /api/v1/tickets（listTickets）。問い合わせ view（mine／all・既定 mine）・q・scope_id・limit（1〜100・既定 50）・cursor（keyset）。
//   答え：{ data: [{ id, number, title, kind:{id,name}, stage:{id,name,key}, assignee:{id,display_name}|null, delegated_to_clone,
//                   due_on, overdue, updated_at, parent_ticket_id, depth }], meta: { next_cursor } }（総数を返さない）
// 試験ごとに別の会社を作り、ほかの試験のチケットを混ぜない。チケットは作る口（K-60）で作り、並びの値（期限・更新・段）は管理の接続で直す。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTenant } from "@kaname/db/context";
import { NOT_YET } from "../../../src/features/F4/ticket-list/query.js";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

type Item = {
  id: string;
  number: string;
  title: string;
  kind: { id: string; name: string };
  stage: { id: string; name: string; key: string };
  assignee: { id: string; display_name: string } | null;
  delegated_to_clone: boolean;
  due_on: string | null;
  overdue: boolean;
  updated_at: string;
  parent_ticket_id: string | null;
  depth: number;
};
type Page = { data: Item[]; meta: { next_cursor: string | null; counts?: Record<string, number> } };
interface World {
  tenantId: string;
  root: string;
  me: Person;
  mate: Person;
  task: { id: string; sections: { key: string; mode: string }[] };
}

const jst = (days = 0, base = Date.now()) =>
  new Date(base + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const asJson = async (r: Response) => (await r.json()) as Record<string, unknown>;

async function world(prefix = "EG"): Promise<World> {
  const c = await f.company(`K92 の会社 ${Math.random().toString(36).slice(2, 7)}`, prefix);
  const me = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const mate = await f.person(c.tenantId, c.rootScope, { name: "山田", ticketAbility: "edit" });
  const kinds = (await asJson(await f.req("GET", "/ticket_kinds", { headers: me.auth })))["data"] as {
    id: string;
    name: string;
    sections: { key: string; mode: string }[];
  }[];
  return { tenantId: c.tenantId, root: c.rootScope, me, mate, task: kinds.find((k) => k.name === "タスク")! };
}

/** 作る口でチケットを 1 件作る（担当者・グループ・親は選べる）。返すのは id と番号 */
async function make(
  w: World,
  o: { title?: string; by?: Person; assignee?: Person; scope?: string; parent?: string } = {},
): Promise<{ id: string; number: string }> {
  const by = o.by ?? w.me;
  const r = await f.req("POST", "/tickets", {
    body: {
      scope_id: o.scope ?? w.root,
      kind_id: w.task.id,
      title: o.title ?? "請求書を送る",
      assignee_member_id: (o.assignee ?? w.me).id,
      due_on: jst(3),
      body: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "書いた" }] }] } },
      ...(o.parent ? { parent_ticket_id: o.parent } : {}),
    },
    headers: by.auth,
  });
  expect(r.status, await r.clone().text()).toBe(201);
  const d = (await asJson(r))["data"] as { id: string; number: string };
  return { id: d.id, number: d.number };
}

/** 管理の接続でチケットの列を直す（期限・更新・段・消した・任せた）。
 *  tickets には updated_at をいつも今の時刻にする引き金（app.set_updated_at）があるので、引き金を止めた 1 つのトランザクションで書き、
 *  書いた updated_at が本当に入ったことを読み直して確かめる */
async function setCols(id: string, cols: Record<string, unknown>) {
  const keys = Object.keys(cols);
  const c = await f.admin.connect();
  try {
    await c.query("begin");
    await c.query("set local session_replication_role = replica");
    await c.query(`update tickets set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`, [
      id,
      ...keys.map((k) => cols[k]),
    ]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
  if ("updated_at" in cols) {
    const got = (await f.admin.query<{ u: Date }>("select updated_at as u from tickets where id = $1", [id])).rows[0]!
      .u;
    expect(got.toISOString(), "書いた updated_at が入っていない").toBe(
      new Date(String(cols["updated_at"])).toISOString(),
    );
  }
}
async function setStage(id: string, key: string) {
  await f.admin.query(
    "update tickets t set stage_id = s.id from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = $2",
    [id, key],
  );
}
const list = (who: Person, q = "", headers: Record<string, string> = {}) =>
  f.req("GET", `/tickets${q ? `?${q}` : ""}`, { headers: { ...who.auth, ...headers } });
async function listOk(who: Person, q = ""): Promise<Page> {
  const r = await list(who, q);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await r.json()) as Page;
}
const ids = (p: Page) => p.data.map((x) => x.id);
/** 次の分を最後まで読んで、全部の id を並びのまま返す */
async function readAll(who: Person, q: string, limit: number): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 100; i += 1) {
    const p = await listOk(who, `${q}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    out.push(...ids(p));
    cursor = p.meta.next_cursor;
    if (!cursor) return out;
  }
  throw new Error("次の分が終わらない");
}

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  f.limits["listTickets"] = 10_000; // 1 分 120 回の上限は K92-API-029 だけで確かめる
}, 60_000);
afterEach(() => {
  vi.useRealTimers();
});
afterAll(async () => {
  await f?.close();
});

describe("K-92 一覧の口：状態 × 見る人", () => {
  it("K92-API-001 0 件：200・data は空・meta は next_cursor が null（足せる鍵は counts だけ）", async () => {
    const w = await world();
    const p = await listOk(w.me);
    expect(p.data).toEqual([]);
    expect(p.meta.next_cursor).toBeNull();
    expect(Object.keys(p.meta).filter((key) => key !== "next_cursor" && key !== "counts")).toEqual([]); // 足せる鍵は counts だけ（K-474・自分に関わるものの 1 回目）
  });

  it("K92-API-002 自分に関わるもの（既定）と すべて：担当者が他の人のチケットは mine に出ず all に出る。作った直後に読み直すと出る", async () => {
    const w = await world();
    const mine = await make(w);
    const others = await make(w, { assignee: w.mate });
    expect(ids(await listOk(w.me))).toEqual([mine.id]);
    expect(ids(await listOk(w.me, "view=mine"))).toEqual([mine.id]);
    expect(new Set(ids(await listOk(w.me, "view=all")))).toEqual(new Set([mine.id, others.id]));
    const next = await make(w);
    expect(ids(await listOk(w.me))).toContain(next.id);
  });

  it("K92-API-003 mine は期限の近い順・期限の無いものは最後・同じ期限は更新の新しい順 → id／all は更新の新しい順 → id", async () => {
    const w = await world();
    const a = await make(w, { title: "a" });
    const b = await make(w, { title: "b" });
    const c = await make(w, { title: "c" });
    const d = await make(w, { title: "d" });
    await setCols(a.id, { due_on: jst(5), updated_at: "2026-11-01T00:00:00Z" });
    await setCols(b.id, { due_on: jst(1), updated_at: "2026-11-01T00:00:00Z" });
    await setCols(c.id, { due_on: null, updated_at: "2026-11-09T00:00:00Z" });
    await setCols(d.id, { due_on: jst(5), updated_at: "2026-11-05T00:00:00Z" });
    expect(ids(await listOk(w.me))).toEqual([b.id, d.id, a.id, c.id]);
    // all は更新の新しい順 → id（担当者が他の人の物も入る）
    const e = await make(w, { assignee: w.mate });
    await setCols(e.id, { updated_at: "2026-11-07T00:00:00Z" });
    const all = ids(await listOk(w.me, "view=all"));
    expect(all.slice(0, 3)).toEqual([c.id, e.id, d.id]);
    expect(new Set(all.slice(3))).toEqual(new Set([a.id, b.id])); // 同じ更新の 2 つは id で決まる（並びの揺れは 018 が見る）
  });

  it("K92-API-004 一覧の口は画面を持たないチケットになったので、正のモックの欄の台帳（canvas_field_ledger.json）に K-92 の行が無い", () => {
    const ledger = JSON.parse(readFileSync(join(ROOT, "scripts/ci/canvas_field_ledger.json"), "utf8")) as {
      entries: { ticket: string }[];
    };
    expect(ledger.entries.map((e) => e.ticket)).not.toContain("K-92");
  });

  it("K92-API-005 自分が答える渡し（待っている）と、自分が作っただけのもの：mine に出ず、all に出る", async () => {
    const w = await world();
    const handed = await make(w, { by: w.mate, assignee: w.mate });
    await f.admin.query(
      "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, state) values ($1, $2, 'pass', $3, $4, 'waiting')",
      [w.tenantId, handed.id, w.mate.id, w.me.id],
    );
    const made = await make(w, { assignee: w.mate });
    const mine = ids(await listOk(w.me));
    expect(mine).not.toContain(handed.id);
    expect(mine).not.toContain(made.id);
    const all = ids(await listOk(w.me, "view=all"));
    expect(all).toContain(handed.id);
    expect(all).toContain(made.id);
  });

  it("K92-API-006 自分が承認する（まだ決めていない）はグループの外でも mine に出る。決めた・取り下げた・承認の行を消した後は出ない", async () => {
    const w = await world();
    const grp = (
      await f.admin.query<{ id: string }>(
        // 根の下に置かない（根の権限で下のグループまで見えると「グループの外」にならない）
        "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '経理', 'KR') returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const writer = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const approver = await f.person(w.tenantId, w.root, { name: "承認する人" }); // チケットの権限なし（グループの外）
    const ws: World = { ...w, me: writer };
    const t = [
      await make(ws, { scope: grp }),
      await make(ws, { scope: grp }),
      await make(ws, { scope: grp }),
      await make(ws, { scope: grp }),
    ];
    const ap: string[] = [];
    for (const x of t)
      ap.push(
        (
          await f.admin.query<{ id: string }>(
            "insert into approvals (tenant_id, scope_id, ticket_id, approver_member_id, requested_by) values ($1, $2, $3, $4, $5) returning id",
            [w.tenantId, grp, x.id, approver.id, writer.id],
          )
        ).rows[0]!.id,
      );
    await f.admin.query("update approvals set decision = 'approve', decided_at = now() where id = $1", [ap[1]]);
    await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [ap[2]]);
    await f.admin.query("update approvals set deleted_at = now() where id = $1", [ap[3]]);
    expect(ids(await listOk(approver))).toEqual([t[0]!.id]);
  });

  it("K92-API-007 担当者が自分で AI に任せている：mine に出て delegated_to_clone が true", async () => {
    const w = await world();
    const t = await make(w);
    await setCols(t.id, { delegated_to_clone: true });
    const row = (await listOk(w.me)).data.find((x) => x.id === t.id);
    expect(row?.delegated_to_clone).toBe(true);
    expect(row?.assignee).toEqual({ id: w.me.id, display_name: "高本" });
  });

  it("K92-API-008 期限切れの境目は日本時間の 0 時：今日 23:59:59 は false・翌日 0:00:01 は true・完了は過ぎても false", async () => {
    const w = await world();
    const open = await make(w);
    const done = await make(w);
    await setCols(open.id, { due_on: "2026-11-20" });
    await setCols(done.id, { due_on: "2026-11-20" });
    await setStage(done.id, "done");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T14:59:59Z")); // 日本時間 11/20 23:59:59
    let p = await listOk(w.me, "view=all");
    expect(p.data.find((x) => x.id === open.id)?.overdue).toBe(false);
    vi.setSystemTime(new Date("2026-11-20T15:00:01Z")); // 日本時間 11/21 0:00:01
    p = await listOk(w.me, "view=all");
    expect(p.data.find((x) => x.id === open.id)?.overdue).toBe(true);
    expect(p.data.find((x) => x.id === done.id)?.overdue).toBe(false);
  });

  it("K92-API-009 答えの形：1 件の鍵はちょうど決めた 13 個（12 個＋ K-560 が足した scope。区画の本文・作った人・消した印を返さない）・meta は next_cursor（と counts だけ・総数を返さない）", async () => {
    const w = await world();
    const parent = await make(w);
    await make(w, { parent: parent.id });
    const p = await listOk(w.me, "view=all");
    for (const x of p.data)
      expect(Object.keys(x).sort()).toEqual(
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
    expect(Object.keys(p.meta)).toContain("next_cursor");
    expect(Object.keys(p.meta).filter((key) => key !== "next_cursor" && key !== "counts")).toEqual([]); // 総数を返さない。足せる鍵は counts だけ（K-474）
    const child = p.data.find((x) => x.parent_ticket_id === parent.id)!;
    expect(child.depth).toBe(2);
    expect(child.kind.name).toBe("タスク");
    expect(child.stage.key).toBe("todo");
  });
});

describe("K-92 一覧の口：見える範囲（口と行の守りの 2 重）", () => {
  it("K92-API-010 見えないグループのチケットは出ない。閲覧のみの人は見えるグループのチケットが出る", async () => {
    const w = await world();
    const grp = (
      await f.admin.query<{ id: string }>(
        // 根の下に置かない（根の権限で下のグループまで見えると「グループの外」にならない）
        "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '経理', 'KR') returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const acct = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const secret = await make({ ...w, me: acct }, { scope: grp });
    const outsider = await f.person(w.tenantId, w.root, { name: "外の人", ticketAbility: "view" });
    const open = await make(w);
    const seen = ids(await listOk(outsider, "view=all"));
    expect(seen).toContain(open.id);
    expect(seen).not.toContain(secret.id);
    expect(ids(await listOk(outsider, `view=all&q=${encodeURIComponent(secret.number)}`))).toEqual([]);
  });

  it("K92-API-011 消したチケットは、どの view でも番号で絞っても出ない（消した本人にも）", async () => {
    const w = await world();
    const t = await make(w);
    await setCols(t.id, { deleted_at: new Date().toISOString() });
    expect(ids(await listOk(w.me))).not.toContain(t.id);
    expect(ids(await listOk(w.me, "view=all"))).not.toContain(t.id);
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent(t.number)}`))).toEqual([]);
  });

  it("K92-API-012 取り込みの下書きは取り込んだ本人にだけ出る（番号で絞っても他の人には出ない）", async () => {
    const w = await world();
    const t = await make(w, { assignee: w.mate });
    const imp = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
        [w.tenantId, w.me.id, w.root],
      )
    ).rows[0]!.id;
    await setCols(t.id, { draft_import_id: imp });
    expect(ids(await listOk(w.me, "view=all"))).toContain(t.id);
    expect(ids(await listOk(w.mate, "view=all"))).not.toContain(t.id);
    expect(ids(await listOk(w.mate, `view=all&q=${encodeURIComponent(t.number)}`))).toEqual([]);
  });

  it("K92-API-013 行の守りの 2 つ目：口を通らずに表を読んでも、消したものと他の人の下書きは見えず、app.ticket_visible も false", async () => {
    const w = await world();
    const gone = await make(w);
    const draft = await make(w, { assignee: w.mate });
    const keep = await make(w);
    await setCols(gone.id, { deleted_at: new Date().toISOString() });
    const imp = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
        [w.tenantId, w.mate.id, w.root],
      )
    ).rows[0]!.id;
    await setCols(draft.id, { draft_import_id: imp });
    const ctx = { tenantId: w.tenantId, userId: w.me.id, role: "member" as const, stepUpAt: null };
    const seen = await withTenant(f.pool, ctx, async (c) =>
      (
        await c.query<{ id: string }>("select id from tickets where id = any($1::uuid[])", [
          [gone.id, draft.id, keep.id],
        ])
      ).rows.map((r) => r.id),
    );
    expect(seen).toEqual([keep.id]);
    const vis = await withTenant(
      f.pool,
      ctx,
      async (c) => (await c.query<{ v: boolean }>("select app.ticket_visible($1) as v", [gone.id])).rows[0]!.v,
    );
    expect(vis).toBe(false);
  });

  it("K92-API-014 行の守りに消した条件を足した後、消すのは app.ticket_soft_delete：edit を持つ人は true で消え、権限の無い人は false で消えない", async () => {
    const w = await world();
    const t = await make(w);
    const u = await make(w);
    const outsider = await f.person(w.tenantId, w.root, { name: "見るだけの人", ticketAbility: "view" });
    const del = (who: Person, id: string) =>
      withTenant(
        f.pool,
        { tenantId: w.tenantId, userId: who.id, role: "member" as const, stepUpAt: null },
        async (c) => (await c.query<{ ok: boolean }>("select app.ticket_soft_delete($1) as ok", [id])).rows[0]!.ok,
      );
    expect(await del(w.me, t.id)).toBe(true);
    const row = await f.admin.query<{ d: string | null }>("select deleted_at as d from tickets where id = $1", [t.id]);
    expect(row.rows[0]!.d).not.toBeNull();
    expect(ids(await listOk(w.me, "view=all"))).not.toContain(t.id);
    expect(await del(outsider, u.id)).toBe(false);
    const kept = await f.admin.query<{ d: string | null }>("select deleted_at as d from tickets where id = $1", [u.id]);
    expect(kept.rows[0]!.d).toBeNull();
  });

  it("K92-API-015 親の候補：q と view=all で見えるチケットだけが出て、depth で段が分かる（3 段目は 3）", async () => {
    const w = await world();
    const a = await make(w, { title: "月次の締め" });
    const b = await make(w, { title: "月次の締め 子", parent: a.id });
    const c = await make(w, { title: "月次の締め 孫", parent: b.id });
    await make(w, { title: "ほかの題名" });
    const p = await listOk(w.me, `view=all&q=${encodeURIComponent("月次")}`);
    const depth = Object.fromEntries(p.data.map((x) => [x.id, x.depth]));
    expect(depth).toEqual({ [a.id]: 1, [b.id]: 2, [c.id]: 3 });
  });

  it("K92-API-016 他の会社のチケット：番号で絞っても、どの view でも出ない", async () => {
    const w = await world("EG");
    const o = await world("OT");
    const theirs = await make(o);
    for (const q of ["view=mine", "view=all", `view=all&q=${encodeURIComponent(theirs.number)}`])
      expect(ids(await listOk(w.me, q)), q).toEqual([]);
  });

  it("K92-API-020 取引先の人・運営の人（預かりの許可なし）は 403。ログインなしは 401・同意し直しが要るセッションは 403・E-AUTH-010", async () => {
    const w = await world();
    await make(w);
    for (const role of ["client", "ops"] as const) {
      const r = await list(w.me, "view=all", f.as(w.me, role));
      expect(r.status, role).toBe(403);
    }
    const anon = await f.req("GET", "/tickets?view=all");
    expect(anon.status).toBe(401);
    const pending = await list(w.me, "view=all", f.pending(w.me));
    expect(pending.status).toBe(403);
    expect(((await pending.json()) as { code?: string }).code).toBe("E-AUTH-010");
  });

  it("K92-API-021 グループの見る権限を外した直後は出ず、付けた直後は出る（入り直さなくても）", async () => {
    const w = await world();
    const grp = (
      await f.admin.query<{ id: string }>(
        // 根の下に置かない（根の権限で下のグループまで見えると「グループの外」にならない）
        "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '経理', 'KR') returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const acct = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const t = await make({ ...w, me: acct }, { scope: grp, assignee: acct });
    const viewer = await f.person(w.tenantId, w.root, { name: "見る人" });
    expect(ids(await listOk(viewer, "view=all"))).not.toContain(t.id);
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'view')",
      [w.tenantId, viewer.id, grp],
    );
    expect(ids(await listOk(viewer, "view=all"))).toContain(t.id);
    await f.admin.query("delete from permissions where grantee_member_id = $1 and scope_id = $2", [viewer.id, grp]);
    expect(ids(await listOk(viewer, "view=all"))).not.toContain(t.id);
  });

  it("K92-API-022 2 つの会社に入っている人：今のワークスペースのチケットだけ", async () => {
    const w = await world("EG");
    const o = await world("OT");
    const there = await f.alsoIn(w.me, o.tenantId, o.root);
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'view')",
      [o.tenantId, there.id, o.root],
    );
    const here = await make(w);
    const theirs = await make(o);
    expect(ids(await listOk(w.me, "view=all"))).toEqual([here.id]);
    expect(ids(await listOk(there, "view=all"))).toEqual([theirs.id]);
  });
});

describe("K-92 一覧の口：次の分（keyset）", () => {
  it("K92-API-017 51 件：50 件と次のカーソル → 残り 1 件・カーソル null。抜けも重なりも無い", async () => {
    const w = await world();
    for (let i = 0; i < 51; i += 1) await make(w, { title: `t${i}` });
    const p1 = await listOk(w.me, "view=all");
    expect(p1.data).toHaveLength(50);
    expect(p1.meta.next_cursor).toBeTruthy();
    const p2 = await listOk(w.me, `view=all&cursor=${encodeURIComponent(p1.meta.next_cursor!)}`);
    expect(p2.data).toHaveLength(1);
    expect(p2.meta.next_cursor).toBeNull();
    expect(new Set([...ids(p1), ...ids(p2)]).size).toBe(51);
  });

  it("K92-API-018 並びの値が同じものが多くても、ページをまたいで揺れない（最後に id）", async () => {
    const w = await world();
    const made: string[] = [];
    for (let i = 0; i < 5; i += 1) made.push((await make(w)).id);
    for (const id of made) await setCols(id, { due_on: jst(2), updated_at: "2026-11-05T00:00:00Z" });
    for (const view of ["mine", "all"]) {
      const got = await readAll(w.me, `view=${view}`, 2);
      expect(got, view).toHaveLength(5);
      expect(new Set(got).size, view).toBe(5);
      expect(got, view).toEqual(await readAll(w.me, `view=${view}`, 2));
      expect(got, `${view}：並びの値が同じなら id の小さい順`).toEqual([...made].sort());
    }
  });

  it("K92-API-019 読んでいる間に 1 件が更新されても、次の分に重ならない", async () => {
    const w = await world();
    const made: string[] = [];
    for (let i = 0; i < 4; i += 1) made.push((await make(w)).id);
    for (const [i, id] of made.entries()) await setCols(id, { updated_at: `2026-11-0${i + 1}T00:00:00Z` });
    const p1 = await listOk(w.me, "view=all&limit=2");
    expect(ids(p1)).toEqual([made[3], made[2]]);
    await setCols(made[0]!, { updated_at: "2026-11-09T00:00:00Z" });
    const p2 = await listOk(w.me, `view=all&limit=2&cursor=${encodeURIComponent(p1.meta.next_cursor!)}`);
    expect(ids(p2)).toEqual([made[1]]);
    expect(ids(await listOk(w.me, "view=all"))[0]).toBe(made[0]);
  });
});

describe("K-92 一覧の口：入力・守り", () => {
  it("K92-API-023 view・limit・cursor の受け付けない値は 422（欄ごとの理由）。形に合うのに読めない鍵は 409・E-LST-001", async () => {
    const w = await world();
    for (let i = 0; i < 3; i += 1) await make(w);
    const p = await listOk(w.me, "view=all&limit=1");
    const allCursor = p.meta.next_cursor!;
    for (const [q, field] of [
      ["view=late", "view"],
      ["limit=0", "limit"],
      ["limit=101", "limit"],
      ["limit=abc", "limit"],
      ["cursor=%%%", "cursor"],
    ] as const) {
      const r = await list(w.me, q);
      expect(r.status, q).toBe(422);
      const fields = (((await r.json()) as { details?: { field: string }[] }).details ?? []).map((d) => d.field);
      expect(fields, q).toContain(field);
    }
    // 形に合うのに今の状態では読めない鍵（中身が合わない・別の view の鍵）は 422 でなく 409・E-LST-001・欄なし（K-472・PM 2026-11-21）
    for (const q of ["cursor=eyJ4IjoxfQ", `view=mine&cursor=${encodeURIComponent(allCursor)}`]) {
      const r = await list(w.me, q);
      expect(r.status, q).toBe(409);
      const body = (await r.json()) as { code?: string; field?: unknown; details?: unknown };
      expect(body.code, q).toBe("E-LST-001");
      expect(body.field, q).toBeUndefined();
      expect(body.details, q).toBeUndefined();
    }
  });

  it("K92-API-024 絞り込みの 12 欄（kind_id・stage_id・assignee_id・due_from・due_to・start_from・start_to・overdue・fire・parent・fields・sort）は、口の欄の表にあるか「まだ使えない」のどちらか 1 つ：まだの欄は 422・E-VAL-018（黙って無視しない）、表にある欄は空の値で 200（指定なし）。知らない名前は 422・VALIDATION_ERROR", async () => {
    const w = await world();
    const all = [
      "kind_id",
      "stage_id",
      "assignee_id",
      "due_from",
      "due_to",
      "start_from",
      "start_to",
      "overdue",
      "fire",
      "parent",
      "fields",
      "sort",
    ];
    for (const name of all) {
      const r = await list(w.me, `${name}=`);
      if (NOT_YET.has(name)) {
        expect(r.status, `${name}（まだ）`).toBe(422);
        expect(((await r.json()) as { code?: string }).code, name).toBe("E-VAL-018");
      } else {
        expect(r.status, `${name}（表にある・空は指定なし）`).toBe(200);
      }
    }
    // まだの表は 12 欄の中だけ（知らない名前を混ぜない）。K-472 が入れた 3 欄（種別・段・担当者）は表にある
    for (const name of NOT_YET) expect(all, name).toContain(name);
    for (const name of ["kind_id", "stage_id", "assignee_id"])
      expect(NOT_YET.has(name), `${name} は K-472 で使えるようになった`).toBe(false);
    // 知らない名前は受け付けない（黙って無視しない）
    const unknown = await list(w.me, "no_such_filter=1");
    expect(unknown.status).toBe(422);
    const body = (await unknown.json()) as { code?: string; details?: { field: string }[] };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect((body.details ?? []).map((d) => d.field)).toContain("no_such_filter");
  });

  it("K92-API-025 scope_id：そのグループのチケットだけ。見えないグループは 0 件・uuid でないは 422", async () => {
    const w = await world();
    const grp = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '営業', 'SL') returning id",
        [w.tenantId, w.root],
      )
    ).rows[0]!.id;
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'edit')",
      [w.tenantId, w.me.id, grp],
    );
    const child = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '営業一課', 'SL1') returning id",
        [w.tenantId, grp],
      )
    ).rows[0]!.id;
    const inGrp = await make(w, { scope: grp });
    const inChild = await make(w, { scope: child });
    await make(w);
    expect(new Set(ids(await listOk(w.me, `view=all&scope_id=${grp}`)))).toEqual(new Set([inGrp.id, inChild.id]));
    expect(ids(await listOk(w.me, `view=all&scope_id=${child}`))).toEqual([inChild.id]);
    const hidden = (
      await f.admin.query<{ id: string }>(
        // 根の下に置かない（根の権限で下のグループまで見えると「グループの外」にならない）
        "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '経理', 'KR') returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const outsider = await f.person(w.tenantId, w.root, { name: "外の人", ticketAbility: "view" });
    const acct = await f.person(w.tenantId, hidden, { name: "経理の人", ticketAbility: "edit" });
    await make({ ...w, me: acct }, { scope: hidden, assignee: acct });
    expect(ids(await listOk(outsider, `view=all&scope_id=${hidden}`))).toEqual([]);
    expect((await list(w.me, "scope_id=abc")).status).toBe(422);
  });

  it("K92-API-026 q の表記ゆらぎ（全角・半角・大文字小文字・前後の空白・ハイフンの種類）は正規化して同じ 1 件", async () => {
    const w = await world();
    const t = await make(w, { title: "見積を出す" });
    const [head, num] = t.number.split("-") as [string, string];
    const wide = (s: string) => s.replace(/[!-~]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0));
    for (const q of [
      t.number,
      `${head}‐${num}`,
      `${head}ー${num}`,
      `${head}−${num}`,
      wide(t.number.toLowerCase()),
      `  ${t.number}  `,
    ])
      expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent(q)}`)), q).toEqual([t.id]);
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent("見積")}`))).toEqual([t.id]);
    // 題名の側も同じ形にそろえて比べる（ハイフンのそろえは番号だけ）
    const long = await make(w, { title: "サーバーの移行" });
    const wideApi = await make(w, { title: "ＡＰＩの件" });
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent("サーバー")}`))).toEqual([long.id]);
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent("api")}`))).toEqual([wideApi.id]);
  });

  it("K92-API-027 q の % ・ _ ・ \\ は文字として探す（ワイルドカードにしない）", async () => {
    const w = await world();
    const pct = await make(w, { title: "割引 10% の件" });
    await make(w, { title: "割引 10 の件" });
    const under = await make(w, { title: "a_b の件" });
    await make(w, { title: "axb の件" });
    const slash = await make(w, { title: "c\\d の件" });
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent("10%")}`))).toEqual([pct.id]);
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent("a_b")}`))).toEqual([under.id]);
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent("c\\d")}`))).toEqual([slash.id]);
    expect(ids(await listOk(w.me, `view=all&q=${encodeURIComponent("%")}`))).toEqual([pct.id]);
  });

  it("K92-API-028 q が 100 文字を超えると 422・E-VAL-017。空と空白だけは絞らない", async () => {
    const w = await world();
    const a = await make(w);
    const b = await make(w, { assignee: w.mate });
    const r = await list(w.me, `view=all&q=${encodeURIComponent("あ".repeat(101))}`);
    expect(r.status).toBe(422);
    expect(((await r.json()) as { code?: string }).code).toBe("E-VAL-017");
    expect((await list(w.me, `view=all&q=${encodeURIComponent("あ".repeat(100))}`)).status).toBe(200);
    for (const q of ["q=", `q=${encodeURIComponent("   ")}`])
      expect(new Set(ids(await listOk(w.me, `view=all&${q}`))), q).toEqual(new Set([a.id, b.id]));
  });

  it("K92-API-029 1 分に 121 回：429・待つ秒数", async () => {
    const w = await world();
    const saved = f.limits["listTickets"];
    f.limits["listTickets"] = 120;
    try {
      let last: Response | null = null;
      for (let i = 0; i < 121; i += 1)
        last = await f.req("GET", "/tickets", { headers: w.me.auth, ip: "198.51.100.92" });
      expect(last!.status).toBe(429);
      expect(((await last!.json()) as { retry_after_sec?: number }).retry_after_sec).toBeGreaterThan(0);
    } finally {
      f.limits["listTickets"] = saved!;
    }
  }, 60_000); // 何十回も続けて口を呼ぶ送りすぎの確かめ（重い台でも既定の 5 秒で切らない）

  it("K92-API-030 ログに題名と q が出ない", async () => {
    const w = await world();
    await make(w, { title: "ログに出ない題名" });
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    try {
      await listOk(w.me, `view=all&q=${encodeURIComponent("ログに出ない題名")}`);
      await list(w.me, `view=all&q=${encodeURIComponent("ログに出ない語".repeat(20))}`);
    } finally {
      for (const s of spies) s.mockRestore();
    }
    expect(out.join("\n")).not.toContain("ログに出ない");
  });
});
