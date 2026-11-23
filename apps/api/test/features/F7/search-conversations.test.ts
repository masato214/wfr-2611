// K-469「探す：自分の会話」の単体の試験（口・本物の DB）。名前の頭の行 ID（K469-API-…）は 11_tickets/K-469.md の行の表と 1 対 1。
// 口：GET /api/v1/search。会話の探し方は features/F7/search/conversations.ts（DB の関数 app.agent_conversations(p_member, p_q)・0041・0061 を使う）。
//   答えの 1 件：{ kind: "conversation", id: 会話の id, title: 会話の名前（無ければ「新しい会話」）, snippet: 当たった本文のまわり（名前だけで当たったら空の字）, url: /ai/chat?c=<id> }
//   見えるのは本人の会話だけ（会社の管理者も他人の会話は読めない）。権限（グループ）には関係しない。
// 前の試験土台の K-468（search.harness.ts・口の置き場）が先に入っている。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ids,
  kindsOf,
  makeTicket,
  makeWorld,
  qs,
  searchOk,
  setRow,
  setupSearch,
  wide,
  type Hit,
  type Person,
  type SearchKit,
  type World,
} from "./search.harness.js";

let k: SearchKit;
const f = () => k.f;
const world = (prefix = "EG") => makeWorld(f(), prefix);
const ok = (who: Person, q = "") => searchOk(f(), who, q);
const make = (w: World, o: Parameters<typeof makeTicket>[2] = {}) => makeTicket(f(), w, o);

beforeAll(async () => {
  k = await setupSearch();
}, 60_000);
afterAll(async () => {
  await k?.f.close();
});

/** 人の会話を 1 つ作る（名前・本文・更新の時刻・星・消した・記憶に残さない を選べる）。返すのは会話の id */
async function conv(
  who: Person,
  o: {
    title?: string | null;
    bodies?: { body: string; kind?: "user" | "ai"; deleted?: boolean }[];
    updated?: string;
    starred?: boolean;
    deleted?: boolean;
    incognito?: boolean;
  } = {},
): Promise<string> {
  const id = (
    await f().admin.query<{ id: string }>("select app.agent_new_conversation($1, $2) as id", [
      who.id,
      o.incognito ?? false,
    ])
  ).rows[0]!.id;
  const cols: Record<string, unknown> = {};
  if (o.title !== undefined) cols["title"] = o.title;
  if (o.starred) cols["starred_at"] = new Date().toISOString();
  if (o.deleted) cols["deleted_at"] = new Date().toISOString();
  if (o.updated) cols["updated_at"] = o.updated;
  if (Object.keys(cols).length) await setRow(f(), "conversations", id, cols);
  for (const m of o.bodies ?? [])
    await f().admin.query(
      "insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, deleted_at) values ($1, $2, $3, $4, $5, $6)",
      [who.tenantId, id, who.id, m.body, m.kind ?? "user", m.deleted ? new Date().toISOString() : null],
    );
  return id;
}
const convHits = (h: Hit[]) => h.filter((x) => x.kind === "conversation");

describe("K-469 探す：自分の会話", () => {
  it("K469-API-001 会話の名前で当たる：鍵は 5 つ・kind conversation・title は名前・snippet は空の字（名前だけで当たったので本文の引用は無い）・url は /ai/chat?c=<id>", async () => {
    const w = await world();
    const c = await conv(w.me, { title: "セイコー様の請求の相談" });
    await conv(w.me, { title: "別の相談" });
    const h = convHits(await ok(w.me, qs("請求")));
    expect(h).toEqual([
      { kind: "conversation", id: c, title: "セイコー様の請求の相談", snippet: "", url: `/ai/chat?c=${c}` },
    ]);
    expect(Object.keys(h[0]!).sort()).toEqual(["id", "kind", "snippet", "title", "url"]);
  });

  it("K469-API-002 本文で当たる：snippet は当たった所のまわり（語を含み、160 字＋語の長さまで）。名前が無い会話の title は「新しい会話」。人の書き込みも AI の返事も当たる", async () => {
    const w = await world();
    const long = `${"あ".repeat(120)}見積の再計算${"い".repeat(120)}`;
    const user = await conv(w.me, { title: null, bodies: [{ body: long, kind: "user" }] });
    const ai = await conv(w.me, { title: "名前あり", bodies: [{ body: "AI の返事：見積の件は完了です", kind: "ai" }] });
    const h = convHits(await ok(w.me, qs("見積")));
    const byId = Object.fromEntries(h.map((x) => [x.id, x]));
    expect(Object.keys(byId).sort()).toEqual([user, ai].sort());
    expect(byId[user]!.title).toBe("新しい会話");
    expect(byId[user]!.snippet).toContain("見積");
    expect([...byId[user]!.snippet].length).toBeLessThanOrEqual(160 + 2);
    expect(byId[ai]!.snippet).toContain("見積の件は完了です");
  });

  it("K469-API-003 他人の会話は出ない：同じ会社の人・権限の強い別の人の会話にも同じ語があっても、本人の分だけ", async () => {
    const w = await world();
    const mine = await conv(w.me, { title: "請求の相談" });
    await conv(w.mate, { title: "請求の相談（山田）", bodies: [{ body: "請求の本文" }] });
    const boss = await f().person(w.tenantId, w.root, { name: "権限の強い人", ticketAbility: "edit" });
    await conv(boss, { title: "請求の相談（権限の強い人）" });
    expect(ids(convHits(await ok(w.me, qs("請求"))))).toEqual([mine]);
    expect(ids(convHits(await ok(w.mate, qs("請求")))).length).toBe(1);
    expect(ids(convHits(await ok(boss, qs("請求"))))).toHaveLength(1);
  });

  it("K469-API-004 別の会社の会話は出ない。同じ人が別の会社に入っていても、別の会社の会話は今の会社で出ない", async () => {
    const w = await world("EG");
    const o = await world("OT");
    const there = await f().alsoIn(w.me, o.tenantId, o.root);
    const theirs = await conv(there, { title: "別の会社の請求の相談" });
    const here = await conv(w.me, { title: "こちらの請求の相談" });
    expect(ids(convHits(await ok(w.me, qs("請求"))))).toEqual([here]);
    expect(ids(convHits(await ok(there, qs("請求"))))).toEqual([theirs]);
  });

  it("K469-API-005 消した会話は出ない（名前でも本文でも）。消した書き込みの字では当たらない", async () => {
    const w = await world();
    await conv(w.me, { title: "消した請求の相談", deleted: true });
    await conv(w.me, { title: "本文を消した相談", bodies: [{ body: "請求の本文", deleted: true }] });
    const live = await conv(w.me, { title: "生きた相談", bodies: [{ body: "請求の本文" }] });
    expect(ids(convHits(await ok(w.me, qs("請求"))))).toEqual([live]);
  });

  it("K469-API-006 表記ゆらぎ：全角・半角・大文字小文字・ハイフンの種類（‐ − など。DB の関数 app.search_norm が直す物）・途中の空白は同じ扱い（名前も本文も）", async () => {
    const w = await world();
    const c1 = await conv(w.me, { title: "ＡＰＩ の相談" });
    const c2 = await conv(w.me, { title: "別", bodies: [{ body: "EG-12  の   ことで" }] });
    expect(ids(convHits(await ok(w.me, qs("api"))))).toEqual([c1]);
    expect(ids(convHits(await ok(w.me, qs(" ＡPI "))))).toEqual([c1]);
    for (const q of ["EG-12", "EG‐12", "EG−12", wide("eg-12"), "eg-12 の"])
      expect(ids(convHits(await ok(w.me, qs(q)))), q).toEqual([c2]);
  });

  it("K469-API-007 q の % ・ _ ・ \\ は文字として探す（ワイルドカードにしない）", async () => {
    const w = await world();
    const pct = await conv(w.me, { title: "割引 10% の相談" });
    await conv(w.me, { title: "割引 10 の相談" });
    const under = await conv(w.me, { title: "a_b の相談" });
    await conv(w.me, { title: "axb の相談" });
    const slash = await conv(w.me, { title: "c\\d の相談" });
    expect(ids(convHits(await ok(w.me, qs("10%"))))).toEqual([pct]);
    expect(ids(convHits(await ok(w.me, qs("a_b"))))).toEqual([under]);
    expect(ids(convHits(await ok(w.me, qs("c\\d"))))).toEqual([slash]);
  });

  it("K469-API-008 並び：星の付いた会話が先、そのあと更新の新しい順。種類ごとの上限（既定 5・limit で 1〜5）で切る", async () => {
    const w = await world();
    const old = await conv(w.me, { title: "請求 古い", updated: "2026-11-01T00:00:00Z" });
    const star = await conv(w.me, { title: "請求 星", updated: "2026-11-02T00:00:00Z", starred: true });
    const fresh = await conv(w.me, { title: "請求 新しい", updated: "2026-11-09T00:00:00Z" });
    expect(ids(convHits(await ok(w.me, qs("請求"))))).toEqual([star, fresh, old]);
    for (let i = 0; i < 4; i += 1)
      await conv(w.me, { title: `請求 追加 ${i}`, updated: `2026-11-0${3 + i}T00:00:00Z` });
    expect(convHits(await ok(w.me, qs("請求")))).toHaveLength(5);
    expect(ids(convHits(await ok(w.me, qs("請求", "limit=2"))))).toEqual([star, fresh]);
  });

  it("K469-API-009 kinds：conversation だけ・ticket だけ・空（全部）。チケットと会話が同じ語に当たるときの並びは チケット → 会話。limit は種類ごとに数える", async () => {
    const w = await world();
    const t = await make(w, { title: "請求を送る" });
    const c = await conv(w.me, { title: "請求の相談" });
    expect(ids(await ok(w.me, qs("請求", "kinds=conversation")))).toEqual([c]);
    expect(ids(await ok(w.me, qs("請求", "kinds=ticket")))).toEqual([t.id]);
    const all = await ok(w.me, qs("請求"));
    expect(kindsOf(all)).toEqual(["ticket", "conversation"]);
    expect(ids(all)).toEqual([t.id, c]);
    for (let i = 0; i < 6; i += 1) {
      await make(w, { title: `請求 ${i}` });
      await conv(w.me, { title: `請求の相談 ${i}` });
    }
    const many = await ok(w.me, qs("請求"));
    expect(many.filter((x) => x.kind === "ticket")).toHaveLength(5);
    expect(many.filter((x) => x.kind === "conversation")).toHaveLength(5);
  });

  it("K469-API-010 記憶に残さない会話も本人の探すには出る。チケットの権限を外しても、自分の会話は出続ける", async () => {
    const w = await world();
    const hidden = await conv(w.me, { title: "記憶に残さない請求の相談", incognito: true });
    const solo = await f().person(w.tenantId, w.root, { name: "権限なしの人" });
    const mine = await conv(solo, { title: "権限なしでも請求の相談" });
    expect(ids(convHits(await ok(w.me, qs("請求"))))).toContain(hidden);
    expect(ids(convHits(await ok(solo, qs("請求"))))).toEqual([mine]);
    await f().admin.query("delete from permissions where grantee_member_id = $1", [w.me.id]);
    expect(ids(convHits(await ok(w.me, qs("請求"))))).toContain(hidden);
  });

  it("K469-API-011 探す言葉が無い・空のとき、会話の一覧を丸ごと返さない（0 件）", async () => {
    const w = await world();
    await conv(w.me, { title: "請求の相談" });
    for (const q of ["", "q=", `q=${encodeURIComponent("   ")}`])
      expect(await ok(w.me, q), JSON.stringify(q)).toEqual([]);
  });

  it("K469-API-012 ログに会話の名前・本文・探す言葉が出ない", async () => {
    const w = await world();
    await conv(w.me, { title: "ログに出ない会話の名前", bodies: [{ body: "ログに出ない本文" }] });
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    try {
      await ok(w.me, qs("ログに出ない"));
    } finally {
      for (const s of spies) s.mockRestore();
    }
    expect(out.join("\n")).not.toContain("ログに出ない");
  });
});
