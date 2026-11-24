// K-473「一覧の絞り込み：期限・開始日の範囲・期限切れ・炎・親・並び・見せる欄」の単体の試験（口・本物の DB）。名前の頭の行 ID（K473-API-…）は 11_tickets/K-473.md の行の表と 1 対 1。
// 口：GET /api/v1/tickets（listTickets）。新しく受ける欄：
//   due_from・due_to・start_from・start_to（YYYY-MM-DD・両端を含む・日の無いチケットは範囲を付けると出ない・空の値は指定なし）
//   overdue・fire（true＝期限切れ・炎のあるものだけ／false＝それ以外。炎は今は期限切れと同じ・期限間近は F9 の後）
//   parent（none＝親の無いもの／any＝親のあるもの／<uuid>＝その直接の子）
//   sort（due_on・start_on＝近い順で日の無いものは最後／updated_at・created_at＝新しい順。同じ値は更新の新しい順 → id）
//   fields（start_on・priority・estimate_minutes・actual_minutes・scope をコンマで。付けた欄だけ 1 件の鍵に足す）
//   due（none＝期限の無いものだけ）・delegated（true＝自分が AI に任せているもの＝担当が自分で delegated_to_clone／false＝それ以外）・
//   approving（true＝自分が承認する決めていないもの／false＝それ以外）。12 欄の外の 3 欄（K-472 の done と同じ）。数の札 ai・approve（K-474）と同じ定義
//   絞り込みは全部 AND で、K-472 の欄・見える範囲・自分に関わるもの（view）・q・scope_id と重ねて使える。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NOT_YET } from "../../../src/features/F4/ticket-list/query.js";
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
  setCols,
  setStage,
  setupList,
  type Fixture,
  type Page,
  type World,
} from "./list.harness.js";

let f: Fixture;
const world = (prefix = "EG") => makeWorld(f, prefix);
const make = (w: World, o: Parameters<typeof makeT>[2] = {}) => makeT(f, w, o);
const L = (w: World, query: string) => listOk(f, w.me, query);
const set = (s: string[]) => new Set(s);

beforeAll(async () => {
  f = await setupList();
}, 60_000);
afterEach(() => {
  vi.useRealTimers();
});
afterAll(async () => {
  await f?.close();
});

/** 期限・開始日を決めたチケットを作る（開始日は期限より後にできない・start が無ければ開始日なし） */
async function dated(w: World, due: string | null, start: string | null = null, o: Parameters<typeof makeT>[2] = {}) {
  const t = await make(w, o);
  await setCols(f, t.id, { due_on: due, start_on: start });
  return t.id;
}

describe("K-473 日付の範囲・期限切れ・炎", () => {
  it("K473-API-001 due_from・due_to：期限が範囲の中（両端を含む）のチケットだけ。期限の無いチケットは範囲を付けると出ない", async () => {
    const w = await world();
    const a = await dated(w, "2026-12-01");
    const b = await dated(w, "2026-12-03");
    const c = await dated(w, "2026-12-05");
    const none = await dated(w, null);
    expect(set(ids(await L(w, "view=all&due_from=2026-12-03")))).toEqual(set([b, c]));
    expect(set(ids(await L(w, "view=all&due_to=2026-12-03")))).toEqual(set([a, b]));
    expect(ids(await L(w, "view=all&due_from=2026-12-03&due_to=2026-12-03"))).toEqual([b]);
    expect(set(ids(await L(w, "view=all")))).toEqual(set([a, b, c, none]));
    expect(ids(await L(w, "view=all&due_from=2000-01-01&due_to=2100-01-01"))).not.toContain(none);
  });

  it("K473-API-002 範囲の始めが終わりより後（due_from > due_to）は、間違いではなく 200・0 件", async () => {
    const w = await world();
    await dated(w, "2026-12-03");
    const r = await list(f, w.me, "view=all&due_from=2026-12-05&due_to=2026-12-01");
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: unknown[] }).data).toEqual([]);
  });

  it("K473-API-003 start_from・start_to：開始日が範囲の中（両端を含む）のチケットだけ。開始日の無いチケットは範囲を付けると出ない", async () => {
    const w = await world();
    const a = await dated(w, "2026-12-20", "2026-12-01");
    const b = await dated(w, "2026-12-20", "2026-12-03");
    const c = await dated(w, "2026-12-20", "2026-12-05");
    const none = await dated(w, "2026-12-20", null);
    expect(set(ids(await L(w, "view=all&start_from=2026-12-03")))).toEqual(set([b, c]));
    expect(set(ids(await L(w, "view=all&start_to=2026-12-03")))).toEqual(set([a, b]));
    expect(ids(await L(w, "view=all&start_from=2026-12-03&start_to=2026-12-03"))).toEqual([b]);
    expect(ids(await L(w, "view=all&start_from=2000-01-01"))).not.toContain(none);
  });

  it("K473-API-004 日付の形：2026/12/01・2026-13-01・2026-02-30・0000-01-01・abc は 422・欄の名前つき（4 つの欄とも）。空の値は指定なし。端の日（0001-01-01・9999-12-31）は 200（契約の format: date と同じ決まり）", async () => {
    const w = await world();
    await dated(w, "2026-12-03");
    for (const name of ["due_from", "due_to", "start_from", "start_to"]) {
      for (const v of ["2026/12/01", "2026-13-01", "2026-02-30", "0000-01-01", "abc"]) {
        const r = await list(f, w.me, `view=all&${name}=${encodeURIComponent(v)}`);
        expect(r.status, `${name}=${v}`).toBe(422);
        expect(await fieldsOf(r), `${name}=${v}`).toContain(name);
      }
      for (const v of ["0001-01-01", "9999-12-31"])
        expect((await list(f, w.me, `view=all&${name}=${v}`)).status, `${name}=${v}`).toBe(200);
      expect(ids(await L(w, `view=all&${name}=`)), `${name}=（空）`).toHaveLength(1);
    }
  });

  it("K473-API-005 overdue=true：期限が日本時間の今日より前で、完了でないものだけ。期限が今日のもの・完了・期限の無いものは出ない（境目は日本時間の 0 時）", async () => {
    const w = await world();
    const open = await dated(w, "2026-11-20");
    const done = await dated(w, "2026-11-20");
    await setStage(f, done, "done");
    const today = await dated(w, "2026-11-21");
    await dated(w, null);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T14:59:59Z")); // 日本時間 11/20 23:59:59
    expect(ids(await L(w, "view=all&overdue=true"))).toEqual([]);
    vi.setSystemTime(new Date("2026-11-20T15:00:01Z")); // 日本時間 11/21 0:00:01
    expect(ids(await L(w, "view=all&overdue=true"))).toEqual([open]);
    expect(ids(await L(w, "view=all&overdue=true"))).not.toContain(today);
  });

  it("K473-API-006 overdue=false：期限切れでないもの（完了・期限の無いもの・期限が今日以降のもの）だけ", async () => {
    const w = await world();
    const open = await dated(w, "2026-11-20");
    const done = await dated(w, "2026-11-20");
    await setStage(f, done, "done");
    const today = await dated(w, "2026-11-21");
    const none = await dated(w, null);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T15:00:01Z"));
    const got = set(ids(await L(w, "view=all&overdue=false")));
    expect(got).toEqual(set([done, today, none]));
    expect(got.has(open)).toBe(false);
  });

  it("K473-API-007 overdue・fire が true・false 以外（yes・1・True）は 422・欄の名前つき", async () => {
    const w = await world();
    for (const name of ["overdue", "fire"])
      for (const v of ["yes", "1", "True", "炎"]) {
        const r = await list(f, w.me, `${name}=${encodeURIComponent(v)}`);
        expect(r.status, `${name}=${v}`).toBe(422);
        expect(await fieldsOf(r), `${name}=${v}`).toContain(name);
      }
  });

  it("K473-API-008 fire=true は炎の付いたもの（今は期限切れと同じ）・fire=false はそれ以外。overdue と同じ集まりになる（期限間近が足されたらここだけ広がる）", async () => {
    const w = await world();
    await dated(w, "2026-11-10");
    await dated(w, "2026-11-30");
    const done = await dated(w, "2026-11-10");
    await setStage(f, done, "done");
    await dated(w, null);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
    const fire = ids(await L(w, "view=all&fire=true"));
    expect(fire).toHaveLength(1);
    expect(set(fire)).toEqual(set(ids(await L(w, "view=all&overdue=true"))));
    expect(set(ids(await L(w, "view=all&fire=false")))).toEqual(set(ids(await L(w, "view=all&overdue=false"))));
  });
});

describe("K-473 親・並び・見せる欄", () => {
  it("K473-API-009 parent=none：親の無いチケットだけ。parent=any：親のあるもの（子・孫）だけ", async () => {
    const w = await world();
    const root = await make(w, { title: "親" });
    const child = await make(w, { title: "子", parent: root.id });
    const grand = await make(w, { title: "孫", parent: child.id });
    const alone = await make(w, { title: "単体" });
    expect(set(ids(await L(w, "view=all&parent=none")))).toEqual(set([root.id, alone.id]));
    expect(set(ids(await L(w, "view=all&parent=any")))).toEqual(set([child.id, grand.id]));
  });

  it("K473-API-010 parent=<uuid>：その直接の子だけ（孫は出ない）。見えない親（子は見える）・別の会社・無い親の uuid は 200・0 件。uuid でも none・any でもない値は 422・欄 parent", async () => {
    const w = await world("EG");
    const o = await world("OT");
    const root = await make(w, { title: "親" });
    const child = await make(w, { title: "子", parent: root.id });
    await make(w, { title: "孫", parent: child.id });
    const theirs = await make(o);
    expect(ids(await L(w, `view=all&parent=${root.id}`))).toEqual([child.id]);
    // 親がグループの外で見えない人の「子」：子は一覧に出るが、親の指定では出さない（親の存在を新しく答えない）
    const grp = await outsideGroup(f, w);
    const acct = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const hiddenParent = await make({ ...w, me: acct }, { scope: grp, assignee: acct, title: "見えない親" });
    const seenChild = await make(w, { title: "見える子" });
    await setCols(f, seenChild.id, { parent_ticket_id: hiddenParent.id });
    expect(ids(await L(w, "view=all"))).toContain(seenChild.id);
    expect(ids(await L(w, `view=all&parent=${hiddenParent.id}`))).toEqual([]);
    for (const p of [theirs.id, "0193c5a0-0000-7000-8000-0000000a4730"])
      expect(ids(await L(w, `view=all&parent=${p}`)), p).toEqual([]);
    for (const v of ["root", "abc", "3fa85f64-5717-0562-b3fc"]) {
      const r = await list(f, w.me, `parent=${encodeURIComponent(v)}`);
      expect(r.status, v).toBe(422);
      expect(await fieldsOf(r), v).toContain("parent");
    }
  });

  it("K473-API-011 sort=due_on（all でも）：期限の近い順・無いものは最後・同じ期限は更新の新しい順 → id。付けない時の並び（mine は期限順・all は更新順）は変わらない", async () => {
    const w = await world();
    const a = await dated(w, "2026-12-05");
    const b = await dated(w, "2026-12-01");
    const c = await dated(w, null);
    const d = await dated(w, "2026-12-05");
    for (const [id, at] of [
      [a, "2026-11-01T00:00:00Z"],
      [b, "2026-11-02T00:00:00Z"],
      [c, "2026-11-09T00:00:00Z"],
      [d, "2026-11-05T00:00:00Z"],
    ] as const)
      await setCols(f, id, { updated_at: at });
    expect(ids(await L(w, "view=all&sort=due_on"))).toEqual([b, d, a, c]);
    expect(ids(await L(w, "view=all"))).toEqual([c, d, b, a]); // all の既定は更新の新しい順
    expect(ids(await L(w, "view=mine"))).toEqual([b, d, a, c]); // mine の既定は期限の近い順
    expect(ids(await L(w, "view=mine&sort=due_on"))).toEqual([b, d, a, c]);
  });

  it("K473-API-012 sort=updated_at（mine でも）：更新の新しい順。sort=created_at：作った新しい順（同じ値は id）", async () => {
    const w = await world();
    const a = await dated(w, "2026-12-01");
    const b = await dated(w, "2026-12-09");
    const c = await dated(w, "2026-12-05");
    for (const [id, upd, cre] of [
      [a, "2026-11-09T00:00:00Z", "2026-10-01T00:00:00Z"],
      [b, "2026-11-01T00:00:00Z", "2026-10-03T00:00:00Z"],
      [c, "2026-11-05T00:00:00Z", "2026-10-02T00:00:00Z"],
    ] as const)
      await setCols(f, id, { updated_at: upd, created_at: cre });
    expect(ids(await L(w, "view=mine&sort=updated_at"))).toEqual([a, c, b]);
    expect(ids(await L(w, "view=all&sort=created_at"))).toEqual([b, c, a]);
  });

  it("K473-API-013 sort=start_on：開始日の近い順・無いものは最後・同じ開始日は更新の新しい順 → id", async () => {
    const w = await world();
    const a = await dated(w, "2026-12-30", "2026-12-05");
    const b = await dated(w, "2026-12-30", "2026-12-01");
    const c = await dated(w, "2026-12-30", null);
    const d = await dated(w, "2026-12-30", "2026-12-05");
    for (const [id, at] of [
      [a, "2026-11-01T00:00:00Z"],
      [b, "2026-11-02T00:00:00Z"],
      [c, "2026-11-09T00:00:00Z"],
      [d, "2026-11-05T00:00:00Z"],
    ] as const)
      await setCols(f, id, { updated_at: at });
    expect(ids(await L(w, "view=all&sort=start_on"))).toEqual([b, d, a, c]);
  });

  it("K473-API-014 sort に使えない値（title・client_share・tenant_id・due・-due_on・DESC）は 422・欄 sort。空の値は指定なし", async () => {
    const w = await world();
    await make(w);
    for (const v of ["title", "client_share", "tenant_id", "due", "-due_on", "DESC", "due_on,updated_at"]) {
      const r = await list(f, w.me, `sort=${encodeURIComponent(v)}`);
      expect(r.status, v).toBe(422);
      expect(await fieldsOf(r), v).toContain("sort");
    }
    expect(ids(await L(w, "view=all&sort="))).toHaveLength(1);
  });

  it("K473-API-015 sort をまたぐ次の分：4 つの並び × view（mine・all）で、同じ値が続く 5 件（と値の無い 2 件）を 2 件ずつ読んで重ならず抜けない。鍵は 200 字以内。別の並び・別の view の鍵（cursor）は 409・E-LST-001・欄なし。形に合わない鍵は 422・欄 cursor", async () => {
    const w = await world();
    const same: string[] = [];
    for (let i = 0; i < 5; i += 1) same.push(await dated(w, "2026-12-30", "2026-12-02"));
    const blank: string[] = [];
    for (let i = 0; i < 2; i += 1) blank.push(await dated(w, null, null));
    const everyone = [...same, ...blank];
    // 更新・作成の時刻も全部同じ（マイクロ秒つき）：続きの条件は最後の id まで進む。鍵が一番長くなる形
    for (const id of everyone)
      await setCols(f, id, { updated_at: "2026-11-05T00:00:00.123456Z", created_at: "2026-10-05T00:00:00.654321Z" });
    const cursorLengths: number[] = [];
    const pageThrough = async (q: string): Promise<string[]> => {
      const out: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 20; i += 1) {
        const p: Page = await L(w, `${q}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        out.push(...ids(p));
        cursor = p.meta.next_cursor;
        if (!cursor) return out;
        cursorLengths.push(cursor.length);
      }
      throw new Error("次の分が終わらない");
    };
    for (const view of ["mine", "all"]) {
      for (const sort of ["due_on", "start_on", "updated_at", "created_at"]) {
        const q = `view=${view}&sort=${sort}`;
        const paged = await pageThrough(q);
        expect(paged, q).toHaveLength(7);
        expect(set(paged), q).toEqual(set(everyone));
        expect(paged, q).toEqual(ids(await L(w, `${q}&limit=100`)));
        expect(paged, `${q}（読み直し）`).toEqual(await pageThrough(q));
        if (sort === "due_on" || sort === "start_on") expect(set(paged.slice(5)), q).toEqual(set(blank));
      }
    }
    expect(Math.max(...cursorLengths), "次の分の鍵の長さ").toBeLessThanOrEqual(200);
    const first = await L(w, "view=all&sort=start_on&limit=2");
    const cur = encodeURIComponent(first.meta.next_cursor!);
    for (const q of [
      `view=all&sort=due_on&limit=2&cursor=${cur}`,
      `view=all&sort=updated_at&limit=2&cursor=${cur}`,
      `view=mine&sort=start_on&limit=2&cursor=${cur}`,
    ]) {
      await expectUnreadableCursor(await list(f, w.me, q), q);
    }
    // 形に合わない鍵は入口が 422（欄 cursor）
    const bad = await list(f, w.me, "view=all&sort=due_on&cursor=!!!");
    expect(bad.status).toBe(422);
    expect(await fieldsOf(bad)).toContain("cursor");
  });

  it("K473-API-016 fields：付けた欄だけ 1 件の鍵に足す（start_on・priority・estimate_minutes・actual_minutes・scope を空白なしでコンマでつなぐ。重なりは 1 つ）。付けなければ K-92 の 13 個（12 個＋ K-560 がいつも付ける scope）のまま。scope はいつも付くので、付けても鍵は増えない", async () => {
    const w = await world();
    const t = await dated(w, "2026-12-30", "2026-12-02");
    await setCols(f, t, { priority: "high", priority_reason: "急ぎ", estimate_minutes: 90, actual_minutes: 30 });
    const rootScope = (
      await f.admin.query<{ name: string; code: string | null }>(
        "select name, nullif(ticket_prefix, '') as code from scopes where id = $1",
        [w.root],
      )
    ).rows[0]!;
    const base = (await L(w, "view=all")).data[0]!;
    expect(Object.keys(base)).toHaveLength(13);
    expect(base["scope"]).toEqual({ id: w.root, name: rootScope.name, code: rootScope.code });
    const one = (await L(w, "view=all&fields=start_on,priority")).data[0]!;
    expect(one["start_on"]).toBe("2026-12-02");
    expect(one["priority"]).toBe("high");
    expect(Object.keys(one)).toHaveLength(15);
    const all = (await L(w, "view=all&fields=start_on,priority,estimate_minutes,actual_minutes,scope,start_on"))
      .data[0]!;
    expect(all["estimate_minutes"]).toBe(90);
    expect(all["actual_minutes"]).toBe(30);
    expect(all["scope"]).toEqual({ id: w.root, name: rootScope.name, code: rootScope.code });
    expect(Object.keys(all)).toHaveLength(17);
    const blank = (await L(w, "view=all&fields=")).data[0]!;
    expect(Object.keys(blank)).toHaveLength(13);
  });

  it("K473-API-017 fields が契約の形（小文字の 5 つの名前を空白なしでコンマでつないだだけ）に合わなければ 422・欄 fields：知らない欄・空の項目・大文字・全角・空白。付けても絞り込み・並び・次の分は変わらない", async () => {
    const w = await world();
    const a = await dated(w, "2026-12-01");
    const b = await dated(w, "2026-12-02");
    for (const v of [
      "title",
      "secret",
      "start_on,foo",
      "start_on,,priority",
      "Scope",
      "START_ON",
      "ｓｃｏｐｅ",
      "start_on, priority",
      " scope",
    ]) {
      const r = await list(f, w.me, `view=all&fields=${encodeURIComponent(v)}`);
      expect(r.status, v).toBe(422);
      expect(await fieldsOf(r), v).toContain("fields");
    }
    const plain = await L(w, "view=all&sort=due_on&limit=1");
    const withFields = await L(w, "view=all&sort=due_on&limit=1&fields=scope,priority");
    expect(ids(withFields)).toEqual(ids(plain));
    expect(ids(plain)).toEqual([a]);
    expect(withFields.meta.next_cursor).toBe(plain.meta.next_cursor);
    expect(
      ids(
        await L(w, `view=all&sort=due_on&limit=1&cursor=${encodeURIComponent(plain.meta.next_cursor!)}&fields=scope`),
      ),
    ).toEqual([b]);
  });

  it("K473-API-024 scope（K-560 からはいつも付く・fields=scope を付けても同じ）：見えるグループは { id, name, code }・担当だけで見えるチケットの見えないグループは null（名前も頭文字も出さない）。付けても行の数・並びは変わらない", async () => {
    const w = await world();
    const grp = await outsideGroup(f, w, "経理だけのグループ");
    const acct = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const seen = await make(w, { title: "見えるグループ" });
    const viaAssignee = await make({ ...w, me: acct }, { scope: grp, assignee: acct, title: "担当だけで見える" });
    await setCols(f, viaAssignee.id, { assignee_member_id: w.me.id });
    const rootScope = (
      await f.admin.query<{ name: string; code: string | null }>(
        "select name, nullif(ticket_prefix, '') as code from scopes where id = $1",
        [w.root],
      )
    ).rows[0]!;
    const plain = await L(w, "view=all");
    const withScope = await L(w, "view=all&fields=scope");
    expect(set(ids(plain))).toEqual(set([seen.id, viaAssignee.id]));
    expect(ids(withScope)).toEqual(ids(plain));
    const scopeOf = Object.fromEntries(withScope.data.map((x) => [x.id, x["scope"]]));
    expect(scopeOf[seen.id]).toEqual({ id: w.root, name: rootScope.name, code: rootScope.code });
    expect(scopeOf[viaAssignee.id]).toBeNull();
    expect(JSON.stringify(withScope)).not.toContain("経理だけのグループ");
    // fields を付けなくても同じ（いつも付く）
    expect(Object.fromEntries(plain.data.map((x) => [x.id, x["scope"]]))).toEqual(scopeOf);
    expect(JSON.stringify(plain)).not.toContain("経理だけのグループ");
  });
});

describe("K-473 重ねて使う・見える範囲・12 欄", () => {
  it("K473-API-018 全部 AND：期限の範囲（遠い先の日付で、試験を流す日に期限切れにならない形）・期限切れでない・親なし・担当者（K-472）を重ねると、全部に合うものだけ", async () => {
    const w = await world();
    const hit = await dated(w, "2099-12-03", null, { title: "合う" });
    await dated(w, "2099-12-03", null, { title: "担当が違う", assignee: w.mate });
    await dated(w, "2099-12-20", null, { title: "範囲の外" });
    const parent = await dated(w, "2099-12-03", null, { title: "親" });
    await dated(w, "2099-12-03", null, { title: "子", parent });
    const query = `view=all&due_from=2099-12-01&due_to=2099-12-10&overdue=false&parent=none&assignee_id=${w.me.id}`;
    expect(set(ids(await L(w, query)))).toEqual(set([hit, parent]));
  });

  it("K473-API-019 見えないものは範囲・並び・親の指定でも出ない：見えないグループ・消した・他の人の下書き。自分に関わるもの（mine）と範囲の AND は mine の中だけ", async () => {
    const w = await world();
    const grp = await outsideGroup(f, w);
    const acct = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const secret = await make({ ...w, me: acct }, { scope: grp, assignee: acct });
    await setCols(f, secret.id, { due_on: "2026-12-03" });
    const outsider = await f.person(w.tenantId, w.root, { name: "外の人", ticketAbility: "view" });
    const gone = await dated(w, "2026-12-03");
    await setCols(f, gone, { deleted_at: new Date().toISOString() });
    const mineIn = await dated(w, "2026-12-03");
    const mateOnly = await dated(w, "2026-12-03", null, { assignee: w.mate });
    const range = "due_from=2026-12-01&due_to=2026-12-10";
    expect(set(ids(await listOk(f, outsider, `view=all&${range}`)))).toEqual(set([mineIn, mateOnly]));
    expect(ids(await listOk(f, outsider, `view=all&${range}&sort=due_on&parent=none`))).not.toContain(secret.id);
    expect(ids(await L(w, `view=mine&${range}`))).toEqual([mineIn]);
    expect(ids(await listOk(f, acct, `view=all&${range}`))).toContain(secret.id);
  });

  it("K473-API-020 12 欄ぜんぶ使えるようになった（取引先で絞る client_id は K-472 で外れた）：どの欄も空の値で 200（まだ使えない欄は残らない）。12 欄の外の 4 欄（done・due・delegated・approving）も空の値で 200。K-92 の 12 の鍵・並び・view の既定は変わらない", async () => {
    const w = await world();
    await make(w);
    for (const name of [
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
      "done",
      "due",
      "delegated",
      "approving",
    ]) {
      const r = await list(f, w.me, `${name}=`);
      expect(r.status, name).toBe(200);
    }
    expect([...NOT_YET]).toEqual([]);
  });
});

describe("K-473 期限なし・AI に任せている・自分が承認", () => {
  it("K473-API-021 due=none：期限の無いチケットだけ。none 以外の値（any・2026-12-01・true）は 422・欄 due。空の値は指定なし。期限の範囲と重ねると期限の無いものは出ない", async () => {
    const w = await world();
    const a = await dated(w, "2026-12-03");
    const none1 = await dated(w, null);
    const none2 = await dated(w, null);
    expect(set(ids(await L(w, "view=all&due=none")))).toEqual(set([none1, none2]));
    expect(set(ids(await L(w, "view=all&due=")))).toEqual(set([a, none1, none2]));
    expect(ids(await L(w, "view=all&due=none&due_from=2000-01-01"))).toEqual([]);
    for (const v of ["any", "2026-12-01", "true"]) {
      const r = await list(f, w.me, `view=all&due=${v}`);
      expect(r.status, v).toBe(422);
      expect(await fieldsOf(r), v).toContain("due");
    }
  });

  it("K473-API-022 delegated=true：担当が自分で AI に任せているものだけ（ほかの人の AI は出ない）。false はそれ以外。true・false 以外は 422・欄 delegated。K-474 の数 ai と同じ集まり", async () => {
    const w = await world();
    const mine = await make(w, { title: "自分の AI" });
    const plain = await make(w, { title: "任せていない" });
    const theirs = await make(w, { title: "山田の AI", assignee: w.mate });
    await setCols(f, mine.id, { delegated_to_clone: true });
    await setCols(f, theirs.id, { delegated_to_clone: true });
    expect(ids(await L(w, "view=all&delegated=true"))).toEqual([mine.id]);
    expect(set(ids(await L(w, "view=all&delegated=false")))).toEqual(set([plain.id, theirs.id]));
    expect(ids(await L(w, "view=mine&delegated=true"))).toEqual([mine.id]);
    for (const v of ["yes", "1", "True", "任せ"]) {
      const r = await list(f, w.me, `view=all&delegated=${encodeURIComponent(v)}`);
      expect(r.status, v).toBe(422);
      expect(await fieldsOf(r), v).toContain("delegated");
    }
  });

  it("K473-API-023 approving=true：自分が承認する決めていないものだけ（決めた・取り下げ・承認の行を消した・チケットを消したものは出ない）。false はそれ以外。true・false 以外は 422・欄 approving。K-474 の数 approve と同じ集まり", async () => {
    const w = await world();
    const grp = await outsideGroup(f, w);
    const writer = await f.person(w.tenantId, grp, { name: "経理の人", ticketAbility: "edit" });
    const ww = { ...w, me: writer };
    const open = await make(ww, { scope: grp, assignee: writer });
    await addApproval(f, w, open.id, w.me, grp, writer);
    const decided = await make(ww, { scope: grp, assignee: writer });
    const dec = await addApproval(f, w, decided.id, w.me, grp, writer);
    await f.admin.query("update approvals set decision = 'approve', decided_at = now() where id = $1", [dec]);
    const withdrawn = await make(ww, { scope: grp, assignee: writer });
    const wd = await addApproval(f, w, withdrawn.id, w.me, grp, writer);
    await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [wd]);
    const rowGone = await make(ww, { scope: grp, assignee: writer });
    const rg = await addApproval(f, w, rowGone.id, w.me, grp, writer);
    await f.admin.query("update approvals set deleted_at = now() where id = $1", [rg]);
    const gone = await make(ww, { scope: grp, assignee: writer });
    await addApproval(f, w, gone.id, w.me, grp, writer);
    await setCols(f, gone.id, { deleted_at: new Date().toISOString() });
    const plain = await make(w);
    expect(ids(await L(w, "view=mine&approving=true"))).toEqual([open.id]);
    expect(ids(await L(w, "view=all&approving=true"))).toEqual([open.id]);
    const rest = ids(await L(w, "view=all&approving=false"));
    expect(rest).toContain(plain.id);
    expect(rest).not.toContain(open.id);
    expect(rest).not.toContain(gone.id);
    for (const v of ["yes", "1", "承認"]) {
      const r = await list(f, w.me, `view=all&approving=${encodeURIComponent(v)}`);
      expect(r.status, v).toBe(422);
      expect(await fieldsOf(r), v).toContain("approving");
    }
  });
});
