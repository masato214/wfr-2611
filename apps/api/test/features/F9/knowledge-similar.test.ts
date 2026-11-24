// K-686「似たページを探す（書き終える前・上げる前。見える棚の中から上位 3 件）（findSimilarKnowledge）」の単体の試験（口・DB の関数・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K686-API-NNN・K686-DB-001（チケット 11_tickets/K-686.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   土台は knowledge.harness.ts（K-675 が運ぶ）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   似ている順の期待は DB の similarity() を直に引いて並べる（点の式は題名＋1 行の説明どうし・本文は頭の 500 字どうし）。題名は日本語。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bodyOf, setupKnowledge, type Person } from "./knowledge.harness.js";

const h = setupKnowledge();

interface World {
  co: { tenantId: string; rootScope: string };
  g1: string;
  g2: string;
  boss: Person;
  mgr1: Person;
  mem1: Person;
  mgr2: Person;
  mem2: Person;
  none: Person;
}

const world = async (label: string): Promise<World> => {
  const co = await h.company(label);
  const g1 = await h.group(co.tenantId, co.rootScope, "営業");
  const g2 = await h.group(co.tenantId, co.rootScope, "受託開発");
  const boss = await h.person(co.tenantId, co.rootScope, { name: "管理者", role: "admin" });
  const mgr1 = await h.person(co.tenantId, g1, { name: "営業マネージャー", role: "manager" });
  const mem1 = await h.person(co.tenantId, g1, { name: "営業メンバー", role: "member" });
  const mgr2 = await h.person(co.tenantId, g2, { name: "開発マネージャー", role: "manager" });
  const mem2 = await h.person(co.tenantId, g2, { name: "開発メンバー", role: "member" });
  const none = await h.person(co.tenantId, co.rootScope, { name: "どこにも入っていない人", role: "member" });
  return { co, g1, g2, boss, mgr1, mem1, mgr2, mem2, none };
};

type Json = Record<string, unknown>;
interface Brief {
  id: string;
  title: string;
  desc: string;
  place: string;
}

const ask = async (p: Person | null, body: unknown): Promise<Response> => {
  await h.ready();
  return h.req("POST", "/knowledge/similar", { ...(p ? { headers: h.as(p) } : {}), body });
};
const found = async (p: Person, body: unknown): Promise<Brief[]> => {
  const r = await ask(p, body);
  expect(r.status).toBe(200);
  return ((await h.json(r)).data as { pages: Brief[] }).pages;
};
const num = async (sql: string, p: unknown[]): Promise<number> =>
  Number((await h.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
/** 題名＋説明の似ている順（DB の similarity）。会社の公開済みページだけを対象にした期待 */
const oracle = async (w: World, q: string, n = 3): Promise<string[]> =>
  (
    await h.admin.query<{ id: string }>(
      `select id from knowledge_pages
        where tenant_id = $1 and state = 'published' and deleted_at is null
          and similarity(lower($2), lower(title || ' ' || summary)) >= 0.3
        order by similarity(lower($2), lower(title || ' ' || summary)) desc, id limit $3`,
      [w.co.tenantId, q, n],
    )
  ).rows.map((r) => r.id);
const addVersion = async (
  w: World,
  page: string,
  version: number,
  kind: "draft" | "published",
  text: string,
  by: Person,
) => {
  await h.admin.query(
    "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, $3, $4, $5::jsonb, $6, case when $4 = 'published' then now() end, case when $4 = 'published' then $6::uuid end)",
    [w.co.tenantId, page, version, kind, JSON.stringify(bodyOf(text)), by.id],
  );
  if (kind === "published")
    await h.admin.query("update knowledge_pages set current_version = $2 where id = $1", [page, version]);
};

describe("K-686 似たページを探す", () => {
  it("K686-API-001 答えの形と置き場の字：200・data の鍵は pages だけ・1 件目の鍵はちょうど 4（id・title・desc・place）・place は「会社 › 経理 › 請求」（フォルダ無しは「会社」・営業は「営業」・自分の棚は「自分」）", async () => {
    const w = await world("K686 形");
    const f1 = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const f2 = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "請求", parent: f1 });
    const deep = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "請求書の送り方",
      summary: "月末締めの請求書を送る手順",
      folder: f2,
    });
    const r = await ask(w.mgr1, { title: "請求書の送り方" });
    expect(r.status).toBe(200);
    const data = (await h.json(r)).data as Json;
    expect(Object.keys(data)).toEqual(["pages"]);
    const first = (data["pages"] as Brief[])[0]!;
    expect(Object.keys(first).sort()).toEqual(["desc", "id", "place", "title"]);
    expect(first).toEqual({
      id: deep,
      title: "請求書の送り方",
      desc: "月末締めの請求書を送る手順",
      place: "会社 › 経理 › 請求",
    });
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "見積もりの出し方（会社）" });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "見積もりの出し方（営業）" });
    await h.page({ scope: w.mgr1.scopeId, owner: w.mgr1, personal: true, title: "見積もりの出し方（自分）" });
    const places = (await found(w.mgr1, { title: "見積もりの出し方" })).map((x) => x.place).sort();
    expect(places).toEqual(["営業", "自分", "会社"].sort());
  });

  it("K686-API-002 上位 3 件・似ている順：似た題名が 4 つと似ていない 1 つあるとき、3 件だけ返り、並びは DB の similarity の大きい順（同じ点なら id の順）。似ていないページは出ない", async () => {
    const w = await world("K686 上位 3 件");
    const q = "請求書の送り方の手順";
    const titles = [
      "請求書の送り方の手順",
      "請求書の送り方の手順書",
      "請求書の送り方",
      "請求書の送り方について（手順）",
    ];
    for (const title of titles) await h.page({ scope: w.co.rootScope, owner: w.boss, title });
    const unrelated = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "見積もりの出し方" });
    const expected = await oracle(w, q);
    expect(expected.length).toBe(3);
    const got = await found(w.mem1, { title: q });
    expect(got.map((x) => x.id)).toEqual(expected);
    expect(got.map((x) => x.id)).not.toContain(unrelated);
    expect(got[0]!.title).toBe("請求書の送り方の手順");
  });

  it("K686-API-003 似たページが無い：関係のない題名・説明で探すと 200 { pages: [] }。ページが 1 つも無い会社でも 200 の空", async () => {
    const w = await world("K686 無い");
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "請求書の送り方" });
    const r = await ask(w.mem1, { title: "ZZZ qqq 関係のない題名", desc: "ほかの話" });
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ pages: [] });
    const empty = await world("K686 無い（空の会社）");
    const r2 = await ask(empty.boss, { title: "請求書の送り方" });
    expect(r2.status).toBe(200);
    expect((await h.json(r2)).data).toEqual({ pages: [] });
  });

  it("K686-API-004 説明・本文でも見つかる：題名が違っても説明が同じなら見つかる。本文だけが同じでも見つかり、本文は頭の 500 字だけ比べる。本文を送らないときは題名と説明で比べる", async () => {
    const w = await world("K686 説明と本文");
    const byDesc = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "ア",
      summary: "顧客への請求書の送り方と締め日のルール",
    });
    expect(
      (await found(w.mem1, { title: "請求書", desc: "顧客への請求書の送り方と締め日のルール" })).map((x) => x.id),
    ).toContain(byDesc);
    const head = "あいうえおかきくけこ".repeat(50);
    const byText = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "全く別の題名ウ",
      text: head + "さしすせそ".repeat(40),
    });
    expect(
      (await found(w.mem1, { title: "検索用の題名エ", text: head + "たちつてと".repeat(40) })).map((x) => x.id),
    ).toContain(byText);
    expect((await found(w.mem1, { title: "検索用の題名エ" })).map((x) => x.id)).not.toContain(byText);
    expect((await found(w.mem1, { title: "検索用の題名エ", text: "" })).map((x) => x.id)).not.toContain(byText);
  });

  it("K686-API-005 見える棚の中だけ：営業のマネージャーが探すと、会社・営業・自分の公開済みページは出て、入っていない受託開発・他人の自分の棚（管理者の物も）・他人のまだ書き終えていないページ・消したページ・別の会社は同じ題名でも出ない", async () => {
    const w = await world("K686 見える範囲");
    const other = await world("K686 見える範囲（別の会社）");
    const title = "請求書の送り方";
    const visible = [
      await h.page({ scope: w.co.rootScope, owner: w.boss, title }),
      await h.page({ scope: w.g1, owner: w.mgr1, title }),
      await h.page({ scope: w.mgr1.scopeId, owner: w.mgr1, personal: true, title }),
    ];
    const hidden = [
      await h.page({ scope: w.g2, owner: w.mgr2, title }),
      await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title }),
      await h.page({ scope: w.boss.scopeId, owner: w.boss, personal: true, title }),
      await h.page({ scope: w.co.rootScope, owner: w.boss, state: "draft", title }),
      await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title }),
      await h.page({ scope: other.co.rootScope, owner: other.boss, title }),
    ];
    const gone = await h.page({ scope: w.co.rootScope, owner: w.boss, title });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const got = (await found(w.mgr1, { title })).map((x) => x.id);
    expect([...got].sort()).toEqual([...visible].sort());
    for (const id of [...hidden, gone]) expect(got).not.toContain(id);
  });

  it("K686-API-006 自分自身を出さない：exclude_page_id のページは出ず、次に似たページが繰り上がる。無い id・別の会社の id・見えない id を入れても 200・入れないときと同じ結果（エラーにせず在るかを漏らさない）", async () => {
    const w = await world("K686 自分自身");
    const other = await world("K686 自分自身（別の会社）");
    const ids: string[] = [];
    for (const title of ["請求書の送り方", "請求書の送り方の手順", "請求書の送り方について", "請求書の送り方の注意"])
      ids.push(await h.page({ scope: w.co.rootScope, owner: w.boss, title }));
    const hiddenPage = await h.page({ scope: w.g2, owner: w.mgr2, title: "請求書の送り方の手順書" });
    const foreignPage = await h.page({ scope: other.co.rootScope, owner: other.boss, title: "請求書の送り方" });
    const base = await found(w.mgr1, { title: "請求書の送り方" });
    expect(base.length).toBe(3);
    expect(base[0]!.id).toBe(ids[0]);
    const without = await found(w.mgr1, { title: "請求書の送り方", exclude_page_id: ids[0] });
    expect(without.map((x) => x.id)).not.toContain(ids[0]);
    expect(without.length).toBe(3);
    for (const ex of [randomUUID(), foreignPage, hiddenPage]) {
      expect(await found(w.mgr1, { title: "請求書の送り方", exclude_page_id: ex }), ex).toEqual(base);
    }
  });

  it("K686-API-007 公開の本文だけを比べる：書いている下書きの版の本文が同じでも公開の本文が違えば出ない。公開の版が複数あるページは最新の公開の本文で比べる（古い版の本文では出ない）", async () => {
    const w = await world("K686 公開の本文");
    const withDraft = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "無関係な題名オ",
      text: "公開の本文はこれ",
    });
    await addVersion(w, withDraft, 2, "draft", "探している本文の中身ですこれ", w.boss);
    expect(
      (await found(w.mem1, { title: "探索 ZZZ", text: "探している本文の中身ですこれ" })).map((x) => x.id),
    ).not.toContain(withDraft);
    const versions = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "無関係な題名カ",
      text: "古い本文古い本文古い本文古い本文",
    });
    await addVersion(w, versions, 2, "published", "新しい本文新しい本文新しい本文新しい本文", w.boss);
    expect(
      (await found(w.mem1, { title: "探索 ZZZ", text: "古い本文古い本文古い本文古い本文" })).map((x) => x.id),
    ).not.toContain(versions);
    expect(
      (await found(w.mem1, { title: "探索 ZZZ", text: "新しい本文新しい本文新しい本文新しい本文" })).map((x) => x.id),
    ).toContain(versions);
  });

  it("K686-API-008 表記ゆれ：全角の英数・全角の空白・大文字小文字・前後の空白が違う題名でも見つかる", async () => {
    const w = await world("K686 表記ゆれ");
    const id = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "abc 見積もり" });
    for (const title of ["ＡＢＣ　見積もり", "ABC 見積もり", "  abc 見積もり  ", "Abc 見積もり"]) {
      expect((await found(w.mem1, { title }))[0]?.id, title).toBe(id);
    }
  });

  it("K686-API-009 入力の形が合わない：題名が空・空白だけ（全角を含む）・201 字・説明が 201 字・本文が 10,001 字・exclude_page_id が uuid でない・知らない欄は 422。200 字・200 字・10,000 字は通る", async () => {
    const w = await world("K686 入力");
    for (const bad of [
      {},
      { title: "" },
      { title: "   " },
      { title: "　　" },
      { title: "あ".repeat(201) },
      { title: "題名", desc: "い".repeat(201) },
      { title: "題名", text: "う".repeat(10_001) },
      { title: "題名", exclude_page_id: "uuid ではない" },
      { title: "題名", extra: 1 },
    ]) {
      expect((await ask(w.mem1, bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(422);
    }
    expect(
      (await ask(w.mem1, { title: "あ".repeat(200), desc: "い".repeat(200), text: "う".repeat(10_000) })).status,
    ).toBe(200);
  });

  it("K686-API-010 ログインしていない要求は 401", async () => {
    expect((await ask(null, { title: "題名" })).status).toBe(401);
  });

  it("K686-API-011 上限を超えると 429（1 分 30 回の上限を 2 に差し替えた口の 3 回目）", async () => {
    const w = await world("K686 上限");
    h.limits["findSimilarKnowledge"] = 2;
    try {
      expect((await ask(w.mem1, { title: "題名" })).status).toBe(200);
      expect((await ask(w.mem1, { title: "題名" })).status).toBe(200);
      const r = await ask(w.mem1, { title: "題名" });
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["findSimilarKnowledge"];
    }
  });

  it("K686-API-012 権限の波及：営業のメンバーがグループを抜けた直後の次の呼びから営業のページが出なくなり、受託開発に入った直後の次の呼びから受託開発のページが出る。会社のページは入っていなくても出る", async () => {
    const w = await world("K686 波及");
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "手順書 会社" });
    const sales = await h.page({ scope: w.g1, owner: w.mgr1, title: "手順書 営業" });
    const dev = await h.page({ scope: w.g2, owner: w.mgr2, title: "手順書 受託" });
    const ids = async () => (await found(w.mem1, { title: "手順書" })).map((x) => x.id).sort();
    expect(await ids()).toEqual([company, sales].sort());
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem1.id, w.co.rootScope]);
    expect(await ids()).toEqual([company]);
    await h.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'member')",
      [w.co.tenantId, w.mem1.id, w.g2],
    );
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem1.id, w.g2]);
    expect(await ids()).toEqual([company, dev].sort());
  });

  it("K686-API-013 何も書かない：呼んでもページ・版・証跡・受け箱の行は増えず、ログに題名・本文を出さない", async () => {
    const w = await world("K686 書かない");
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "請求書の送り方", text: "秘密の本文" });
    const count = async () => ({
      pages: await num("select count(*) as n from knowledge_pages where tenant_id = $1", [w.co.tenantId]),
      versions: await num("select count(*) as n from knowledge_page_versions where tenant_id = $1", [w.co.tenantId]),
      audits: await num("select count(*) as n from audit_events where tenant_id = $1", [w.co.tenantId]),
      notices: await num("select count(*) as n from notifications where tenant_id = $1", [w.co.tenantId]),
    });
    const before = await count();
    const logs = await h.captureLogs(async () => {
      for (let i = 0; i < 3; i++) await found(w.mem1, { title: "秘密の題名 請求書の送り方", text: "秘密の本文" });
    });
    expect(await count()).toEqual(before);
    expect(logs).not.toContain("秘密の");
  });

  it("K686-API-014 1 万ページでの重さ：会社に公開済みページを 1 万入れ、似たページ 3 つを混ぜて探すと、200・3 件・似ている順（1 回の呼びの時間は記録だけ・落とす条件にしない。測った時間を申し送りに書く）", async () => {
    const w = await world("K686 1 万ページ");
    await h.admin.query(
      `with ins as (
           insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, is_must, title, summary, current_version)
           select $1, $2, false, $3, 'published', false, '雑多な題名 ' || g, '', 1 from generate_series(1, 10000) g
           returning id)
         insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by)
         select $1, id, 1, 'published', app.kn_body_from_text(repeat('本文の中身', 60)), $3, now(), $3 from ins`,
      [w.co.tenantId, w.co.rootScope, w.boss.id],
    );
    const q = "請求書の送り方の手順書";
    for (const title of ["請求書の送り方の手順書", "請求書の送り方の手順", "請求書の送り方"])
      await h.page({ scope: w.co.rootScope, owner: w.boss, title });
    const expected = await oracle(w, q);
    expect(expected.length).toBe(3);
    await h.ready();
    const t0 = performance.now();
    const got = await found(w.mem1, { title: q, text: "請求書は月末締めで翌月五日までに送る" });
    const ms = performance.now() - t0;
    expect(got.map((x) => x.id)).toEqual(expected);
    // 時間は落とす条件にしない（台が混むと遅くなる）。作る段が測って申し送りに書く
    console.info(`[K686-API-014] 1 万ページの似たページ探し：${Math.round(ms)} ms`);
  }, 120_000);

  it("K686-DB-001 日本語が数えられる DB か（G-11）：試験の DB に pg_trgm が入っていて、similarity('経費の精算', '経費の精算書') が 0 より大きい。関数 app.kn_similar が在り、呼ぶ人の権限で動く（security invoker）", async () => {
    const ext = await h.admin.query("select extname from pg_extension where extname = 'pg_trgm'");
    expect(ext.rows.length).toBe(1);
    const sim = await h.admin.query<{ s: number }>("select similarity('経費の精算', '経費の精算書') as s");
    expect(sim.rows[0]!.s).toBeGreaterThan(0);
    const fn = await h.admin.query<{ prosecdef: boolean }>(
      "select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'kn_similar'",
    );
    expect(fn.rows.length).toBe(1);
    expect(fn.rows[0]!.prosecdef).toBe(false);
  });
});
