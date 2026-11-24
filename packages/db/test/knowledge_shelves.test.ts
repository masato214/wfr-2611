// K-674 ナレッジの置き場（DB）：棚は 3 つ（会社・グループ・自分）・フォルダ・ページの印と並び・本文の形・見える／書けるの関数と行の守り。
//   行 ID は K674-DB-NNN（チケット 11_tickets/K-674.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   会社の人は、管理者（会社の棚）・グループのマネージャー（そのグループの棚）・メンバーと閲覧のみ（自分の棚だけ）。権限の束（permissions）は使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { withTenant, type TenantContext } from "../src/context.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 3 });
let app: pg.Pool;

interface Person {
  id: string;
  ctx: TenantContext;
  scope: string;
}
interface Company {
  tenant: string;
  root: string;
  g1: string;
  g2: string;
}
let A: Company;
let B: { tenant: string; root: string };
let adminA: Person, mgr1: Person, mgr1b: Person, mgr2: Person, mem1: Person, view1: Person, mem2: Person, out: Person;
let adminB: Person;

const BODY = {
  doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "本文" }] }] },
  text: "本文",
};
const BODY_JSON = JSON.stringify(BODY);

const one = async (sql: string, p: unknown[] = []) => (await admin.query<{ id: string }>(sql, p)).rows[0]!.id;
const q = async <T = Record<string, unknown>>(ctx: TenantContext, sql: string, p: unknown[] = []) =>
  withTenant(app, ctx, async (c) => (await c.query(sql, p)).rows as T[]);
/** 失敗した文の言葉（成功なら null）。行の守りの外（admin）で流す物は adminFails */
const fails = async (ctx: TenantContext, sql: string, p: unknown[] = []) => {
  try {
    await q(ctx, sql, p);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};
const adminFails = async (sql: string, p: unknown[] = []) => {
  try {
    await admin.query(sql, p);
    return null;
  } catch (e) {
    return `${(e as { code?: string }).code ?? ""} ${String((e as Error).message)}`;
  }
};
const rows = async (ctx: TenantContext, table: string, id: string) =>
  (await q(ctx, `select id from "${table}" where id = $1`, [id])).length;

const mkPerson = async (
  tenant: string,
  scope: string,
  name: string,
  tenantRole: "admin" | "member",
  group?: { scope: string; role: "manager" | "member" | "viewer" },
): Promise<Person> => {
  const id = await one(
    "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', $3) returning id",
    [tenant, scope, name],
  );
  await admin.query("insert into tenant_memberships (tenant_id, member_id, role) values ($1, $2, $3)", [
    tenant,
    id,
    tenantRole,
  ]);
  if (group)
    await admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, $4)",
      [tenant, id, group.scope, group.role],
    );
  return { id, scope, ctx: { tenantId: tenant, userId: id, role: "member" } };
};
const mkScope = (tenant: string, name: string, parent: string | null) =>
  one("insert into scopes (tenant_id, parent_id, name) values ($1, $2, $3) returning id", [tenant, parent, name]);
const mkTenant = (name: string) =>
  one("insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id", [name]);

/** ページを行の守りの外で入れる（管理の接続・引き金は働く）。自分の棚のページの scope は持ち主の主の所属 */
const page = (o: {
  scope: string;
  owner: Person;
  personal?: boolean;
  state?: "draft" | "published";
  title?: string;
  must?: boolean;
  folder?: string | null;
  tenant?: string;
}) =>
  one(
    "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, is_must, title, folder_id, current_version) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id",
    [
      o.tenant ?? o.owner.ctx.tenantId,
      o.scope,
      o.personal ?? false,
      o.owner.id,
      o.state ?? "published",
      o.must ?? false,
      o.title ?? "ページ",
      o.folder ?? null,
      (o.state ?? "published") === "published" ? 1 : 0,
    ],
  );
const folder = (o: {
  scope: string;
  owner: Person;
  name: string;
  personal?: boolean;
  parent?: string | null;
  tenant?: string;
}) =>
  one(
    "insert into knowledge_folders (tenant_id, scope_id, is_personal, owner_member_id, parent_folder_id, name) values ($1, $2, $3, $4, $5, $6) returning id",
    [o.tenant ?? o.owner.ctx.tenantId, o.scope, o.personal ?? false, o.owner.id, o.parent ?? null, o.name],
  );
const version = (pageId: string, o: { kind: "draft" | "published"; n: number; author: Person; body?: string }) =>
  one(
    `insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id${o.kind === "published" ? ", published_at, published_by" : ""})
     select tenant_id, $1::uuid, $2::int, $3::text, $4::jsonb, $5::uuid${o.kind === "published" ? ", now(), $5::uuid" : ""} from knowledge_pages where id = $1::uuid returning id`,
    [pageId, o.n, o.kind, o.body ?? BODY_JSON, o.author.id],
  );
const insertPage = (p: Person, scope: string, personal: boolean, owner = p.id) =>
  q(
    p.ctx,
    "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title) values ($1, $2, $3, $4, 'x') returning id",
    [p.ctx.tenantId, scope, personal, owner],
  );

beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  app = new pg.Pool({ connectionString: APP_URL, max: 4 });
  const ta = await mkTenant("会社 A");
  const root = await mkScope(ta, "会社 A の全体", null);
  const g1 = await mkScope(ta, "営業", root);
  const g2 = await mkScope(ta, "受託開発", root);
  A = { tenant: ta, root, g1, g2 };
  adminA = await mkPerson(ta, root, "管理者", "admin");
  mgr1 = await mkPerson(ta, g1, "営業マネージャー", "member", { scope: g1, role: "manager" });
  mgr1b = await mkPerson(ta, g1, "営業マネージャー 2", "member", { scope: g1, role: "manager" });
  mgr2 = await mkPerson(ta, g2, "開発マネージャー", "member", { scope: g2, role: "manager" });
  mem1 = await mkPerson(ta, g1, "営業メンバー", "member", { scope: g1, role: "member" });
  view1 = await mkPerson(ta, g1, "営業の閲覧", "member", { scope: g1, role: "viewer" });
  mem2 = await mkPerson(ta, g2, "開発メンバー", "member", { scope: g2, role: "member" });
  out = await mkPerson(ta, root, "どこにも入っていない人", "member");
  const tb = await mkTenant("会社 B");
  const rootB = await mkScope(tb, "会社 B の全体", null);
  B = { tenant: tb, root: rootB };
  adminB = await mkPerson(tb, rootB, "別会社の管理者", "admin");
}, 90_000);
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("K-674 ナレッジの置き場（DB）", () => {
  it("K674-DB-001 列と表：ページに 1 行の説明・必ず守る・写しの元・フォルダ・並びが足され、フォルダの表があり、前の列は残る", async () => {
    const cols = async (t: string) =>
      Object.fromEntries(
        (
          await admin.query<{ column_name: string; column_default: string | null; is_nullable: string }>(
            "select column_name, column_default, is_nullable from information_schema.columns where table_schema = 'public' and table_name = $1",
            [t],
          )
        ).rows.map((r) => [r.column_name, r]),
      );
    const p = await cols("knowledge_pages");
    expect(p["summary"]?.column_default).toMatch(/''/);
    expect(p["summary"]?.is_nullable).toBe("NO");
    expect(p["is_must"]?.column_default).toBe("false");
    expect(p["position"]?.column_default).toBe("0");
    expect(p["copied_from_page_id"]?.is_nullable).toBe("YES");
    expect(p["folder_id"]?.is_nullable).toBe("YES");
    for (const old of ["parent_page_id", "form", "topics", "verify_interval_days", "archived_at", "current_version"])
      expect(p[old], old).toBeDefined();
    const f = await cols("knowledge_folders");
    for (const c of [
      "id",
      "tenant_id",
      "scope_id",
      "is_personal",
      "owner_member_id",
      "parent_folder_id",
      "name",
      "position",
      "deleted_at",
    ])
      expect(f[c], c).toBeDefined();
  });

  it("K674-DB-002 1 行の説明は 200 字まで", async () => {
    const ok = await page({ scope: A.g1, owner: mgr1 });
    await admin.query("update knowledge_pages set summary = $2 where id = $1", [ok, "あ".repeat(200)]);
    expect(
      (await admin.query<{ summary: string }>("select summary from knowledge_pages where id = $1", [ok])).rows[0]!
        .summary.length,
    ).toBe(200);
    expect(await adminFails("update knowledge_pages set summary = $2 where id = $1", [ok, "あ".repeat(201)])).toMatch(
      /23514|check/,
    );
  });

  it("K674-DB-003 「必ず守る」は公開済みのページだけに付く", async () => {
    expect(await page({ scope: A.g1, owner: mgr1, state: "published", must: true })).toBeTruthy();
    expect(
      await adminFails(
        "insert into knowledge_pages (tenant_id, scope_id, owner_member_id, title, state, is_must) values ($1, $2, $3, 'x', 'draft', true)",
        [A.tenant, A.g1, mgr1.id],
      ),
    ).toMatch(/23514|check/);
    const d = await page({ scope: A.g1, owner: mgr1, state: "draft" });
    expect(await adminFails("update knowledge_pages set is_must = true where id = $1", [d])).toMatch(/23514|check/);
  });

  it("K674-DB-004 本文は {doc, text} の形だけ。前の形の文字は kn_body_from_text が段落にする", async () => {
    const p = await page({ scope: A.g1, owner: mgr1 });
    const bad = [
      `{}`,
      `{"doc":{"type":"doc","content":"x"},"text":""}`,
      `{"doc":{"type":"doc","content":[]},"text":5}`,
    ];
    for (const b of bad)
      expect(
        await adminFails(
          "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body) values ($1, $2, 2, 'draft', $3::jsonb)",
          [A.tenant, p, b],
        ),
        b,
      ).toMatch(/23514|check/);
    const good = await version(p, { kind: "draft", n: 2, author: mgr1 });
    expect(good).toBeTruthy();
    const conv = (
      await admin.query<{
        b: { doc: { type: string; content: { type: string; content?: unknown[] }[] }; text: string };
        ok: boolean;
      }>("select app.kn_body_from_text($1) as b, app.ticket_body_valid(app.kn_body_from_text($1)) as ok", [
        "一行目\n\n三行目",
      ])
    ).rows[0]!;
    expect(conv.ok).toBe(true);
    expect(conv.b.text).toBe("一行目\n\n三行目");
    expect(conv.b.doc.content.map((n) => n.type)).toEqual(["paragraph", "paragraph", "paragraph"]);
    expect(conv.b.doc.content[1]!.content).toBeUndefined();
    const empty = (
      await admin.query<{ b: { doc: { content: unknown[] }; text: string } }>("select app.kn_body_from_text('') as b")
    ).rows[0]!;
    expect(empty.b.doc.content).toEqual([]);
    expect(empty.b.text).toBe("");
    const nul = (
      await admin.query<{ b: { doc: { content: unknown[] }; text: string }; ok: boolean }>(
        "select app.kn_body_from_text(null) as b, app.ticket_body_valid(app.kn_body_from_text(null)) as ok",
      )
    ).rows[0]!;
    expect(nul.ok, "前の形の {} の行（text が null）も移せる").toBe(true);
    expect(nul.b.doc.content).toEqual([]);
    expect(nul.b.text).toBe("");
  });

  it("K674-DB-005 下書きの版は 1 ページに 1 つ。捨てた後は同じ番号で作り直せる。公開の版の番号は重ならない", async () => {
    const p = await page({ scope: A.g1, owner: mgr1 });
    const d1 = await version(p, { kind: "draft", n: 2, author: mgr1 });
    expect(
      await adminFails(
        "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 3, 'draft', $3::jsonb, $4)",
        [A.tenant, p, BODY_JSON, mgr1b.id],
      ),
    ).toMatch(/23505|unique|duplicate/);
    await admin.query("update knowledge_page_versions set deleted_at = now() where id = $1", [d1]);
    const d2 = await version(p, { kind: "draft", n: 2, author: mgr1b });
    await admin.query("update knowledge_page_versions set deleted_at = now() where id = $1", [d2]);
    expect(await version(p, { kind: "draft", n: 2, author: mgr1 })).toBeTruthy();
    const q2 = await page({ scope: A.g1, owner: mgr1 });
    await version(q2, { kind: "published", n: 1, author: mgr1 });
    expect(
      await adminFails(
        "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, 1, 'published', $3::jsonb, $4, now(), $4)",
        [A.tenant, q2, BODY_JSON, mgr1.id],
      ),
    ).toMatch(/23505|unique|duplicate/);
  });

  it("K674-DB-006 フォルダの名前は 1〜100 字で、同じ棚の同じ親の中では重ならない（棚が違う・自分の棚の持ち主が違う・消した物は重ならない）", async () => {
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, owner_member_id, name) values ($1, $2, $3, '')",
        [A.tenant, A.g1, mgr1.id],
      ),
    ).toMatch(/23514|check/);
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, owner_member_id, name) values ($1, $2, $3, $4)",
        [A.tenant, A.g1, mgr1.id, "あ".repeat(101)],
      ),
    ).toMatch(/23514|check/);
    expect(await folder({ scope: A.g1, owner: mgr1, name: "い".repeat(100) })).toBeTruthy();
    const docs = await folder({ scope: A.g1, owner: mgr1, name: "Docs" });
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, owner_member_id, name) values ($1, $2, $3, 'docs')",
        [A.tenant, A.g1, mgr1b.id],
      ),
    ).toMatch(/23505|unique|duplicate/);
    expect(await folder({ scope: A.g2, owner: mgr2, name: "Docs" })).toBeTruthy();
    expect(await folder({ scope: A.g1, owner: mgr1, name: "Docs", parent: docs })).toBeTruthy();
    await admin.query("update knowledge_folders set deleted_at = now() where id = $1", [docs]);
    expect(await folder({ scope: A.g1, owner: mgr1, name: "Docs" })).toBeTruthy();
    expect(await folder({ scope: mem1.scope, owner: mem1, personal: true, name: "メモ" })).toBeTruthy();
    expect(await folder({ scope: view1.scope, owner: view1, personal: true, name: "メモ" })).toBeTruthy();
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, is_personal, owner_member_id, name) values ($1, $2, true, $3, 'メモ')",
        [A.tenant, mem1.scope, mem1.id],
      ),
    ).toMatch(/23505|unique|duplicate/);
  });

  it("K674-DB-007 フォルダの深さは 6 まで・自分の中へは動かせない・親は同じ棚・同じ会社", async () => {
    let parent: string | null = null;
    const chain: string[] = [];
    for (let i = 1; i <= 6; i++) {
      parent = await folder({ scope: A.g2, owner: mgr2, name: `深さ${i}`, parent });
      chain.push(parent);
    }
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, owner_member_id, parent_folder_id, name) values ($1, $2, $3, $4, '深さ7')",
        [A.tenant, A.g2, mgr2.id, chain[5]],
      ),
    ).toMatch(/KNW_FOLDER_DEPTH/);
    expect(
      await adminFails("update knowledge_folders set parent_folder_id = $2 where id = $1", [chain[0], chain[2]]),
    ).toMatch(/KNW_FOLDER_CYCLE/);
    const f1 = await folder({ scope: A.g1, owner: mgr1, name: "別の棚の親" });
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, owner_member_id, parent_folder_id, name) values ($1, $2, $3, $4, '子')",
        [A.tenant, A.g2, mgr2.id, f1],
      ),
    ).toMatch(/KNW_FOLDER_SHELF/);
    const fb = await folder({ scope: B.root, owner: adminB, name: "別の会社の親" });
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, owner_member_id, parent_folder_id, name) values ($1, $2, $3, $4, '子')",
        [A.tenant, A.g1, mgr1.id, fb],
      ),
    ).toMatch(/同じ会社/);
  });

  it("K674-DB-008 ページのフォルダは同じ棚の物だけ（別の棚・別の人の自分のフォルダは入れられない）", async () => {
    const g1f = await folder({ scope: A.g1, owner: mgr1, name: "営業の箱" });
    expect(await page({ scope: A.g1, owner: mgr1, folder: g1f })).toBeTruthy();
    expect(
      await adminFails(
        "insert into knowledge_pages (tenant_id, scope_id, owner_member_id, title, folder_id) values ($1, $2, $3, 'x', $4)",
        [A.tenant, A.g2, mgr2.id, g1f],
      ),
    ).toMatch(/KNW_FOLDER_SHELF/);
    const mine = await folder({ scope: mem1.scope, owner: mem1, personal: true, name: "自分の箱" });
    expect(
      await adminFails(
        "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title, folder_id) values ($1, $2, true, $3, 'x', $4)",
        [A.tenant, view1.scope, view1.id, mine],
      ),
    ).toMatch(/KNW_FOLDER_SHELF/);
  });

  it("K674-DB-009 写しの元は同じ会社のページだけ", async () => {
    const orig = await page({ scope: A.root, owner: adminA });
    const other = await page({ scope: B.root, owner: adminB });
    const ok = await one(
      "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title, copied_from_page_id) values ($1, $2, true, $3, 'x', $4) returning id",
      [A.tenant, mem1.scope, mem1.id, orig],
    );
    expect(ok).toBeTruthy();
    expect(
      await adminFails(
        "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title, copied_from_page_id) values ($1, $2, true, $3, 'x', $4)",
        [A.tenant, mem1.scope, mem1.id, other],
      ),
    ).toMatch(/同じ会社/);
  });

  it("K674-DB-010 自分の棚のページ・フォルダの scope は持ち主の主の所属でなければならない", async () => {
    expect(
      await adminFails(
        "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title) values ($1, $2, true, $3, 'x')",
        [A.tenant, A.g2, mem1.id],
      ),
    ).toMatch(/KNW_PERSONAL_SCOPE/);
    expect(
      await adminFails(
        "insert into knowledge_folders (tenant_id, scope_id, is_personal, owner_member_id, name) values ($1, $2, true, $3, 'x')",
        [A.tenant, A.g2, mem1.id],
      ),
    ).toMatch(/KNW_PERSONAL_SCOPE/);
  });

  it("K674-DB-011 会社の棚：公開済みは社内の全員が読み、下書きは持ち主だけ、別の会社は読めない", async () => {
    const pub = await page({ scope: A.root, owner: adminA });
    const draft = await page({ scope: A.root, owner: adminA, state: "draft" });
    for (const p of [adminA, mgr1, mem1, view1, mem2, out]) {
      expect(await rows(p.ctx, "knowledge_pages", pub), p.id).toBe(1);
      expect(await rows(p.ctx, "knowledge_pages", draft), p.id).toBe(p === adminA ? 1 : 0);
    }
    expect(await rows(adminB.ctx, "knowledge_pages", pub)).toBe(0);
  });

  it("K674-DB-012 グループの棚：そのグループの人（マネージャー・メンバー・閲覧のみ）だけが読む。管理者でも入っていなければ読めない", async () => {
    const p = await page({ scope: A.g1, owner: mgr1 });
    for (const who of [mgr1, mgr1b, mem1, view1]) expect(await rows(who.ctx, "knowledge_pages", p), who.id).toBe(1);
    for (const who of [mem2, mgr2, out, adminA, adminB])
      expect(await rows(who.ctx, "knowledge_pages", p), who.id).toBe(0);
  });

  it("K674-DB-013 自分の棚：持ち主だけ（管理者・マネージャーにも見えない）", async () => {
    const p = await page({ scope: mem1.scope, owner: mem1, personal: true });
    expect(await rows(mem1.ctx, "knowledge_pages", p)).toBe(1);
    for (const who of [adminA, mgr1, mgr1b, view1, mem2, out])
      expect(await rows(who.ctx, "knowledge_pages", p), who.id).toBe(0);
  });

  it("K674-DB-014 会社の棚に書けるのは管理者だけ（マネージャー・メンバー・閲覧のみは作れず直せない）", async () => {
    expect(await insertPage(adminA, A.root, false)).toHaveLength(1);
    for (const who of [mgr1, mem1, view1, out])
      expect(
        await fails(
          who.ctx,
          "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title) values ($1, $2, false, $3, 'x')",
          [A.tenant, A.root, who.id],
        ),
        who.id,
      ).toMatch(/row-level security/);
    const pub = await page({ scope: A.root, owner: adminA, title: "会社の決まり" });
    expect(
      await q(adminA.ctx, "update knowledge_pages set title = '直した' where id = $1 returning id", [pub]),
    ).toHaveLength(1);
    expect(
      await q(mgr1.ctx, "update knowledge_pages set title = '横取り' where id = $1 returning id", [pub]),
    ).toHaveLength(0);
    expect(
      (await admin.query<{ title: string }>("select title from knowledge_pages where id = $1", [pub])).rows[0]!.title,
    ).toBe("直した");
  });

  it("K674-DB-015 グループの棚に書けるのはそのグループのマネージャーだけ（メンバー・閲覧のみ・管理者・別のグループのマネージャーは書けない）", async () => {
    expect(await insertPage(mgr1, A.g1, false)).toHaveLength(1);
    for (const who of [mem1, view1, adminA, mgr2])
      expect(
        await fails(
          who.ctx,
          "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title) values ($1, $2, false, $3, 'x')",
          [A.tenant, A.g1, who.id],
        ),
        who.id,
      ).toMatch(/row-level security/);
    const pub = await page({ scope: A.g1, owner: mgr1, title: "営業の決まり" });
    expect(
      await q(mgr1b.ctx, "update knowledge_pages set title = '別のマネージャーが直した' where id = $1 returning id", [
        pub,
      ]),
    ).toHaveLength(1);
    expect(
      await q(mem1.ctx, "update knowledge_pages set title = '横取り' where id = $1 returning id", [pub]),
    ).toHaveLength(0);
    expect(
      (await admin.query<{ title: string }>("select title from knowledge_pages where id = $1", [pub])).rows[0]!.title,
    ).toBe("別のマネージャーが直した");
  });

  it("K674-DB-016 自分の棚には本人が書ける（閲覧のみ・管理者も自分の棚だけ）。他人の自分の棚は直せない", async () => {
    for (const who of [mem1, view1, adminA]) expect(await insertPage(who, who.scope, true), who.id).toHaveLength(1);
    expect(
      await fails(
        mem1.ctx,
        "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title) values ($1, $2, true, $3, 'x')",
        [A.tenant, view1.scope, view1.id],
      ),
    ).toMatch(/row-level security/);
    const mine = await page({ scope: mem1.scope, owner: mem1, personal: true });
    for (const who of [adminA, mgr1, view1])
      expect(
        await q(who.ctx, "update knowledge_pages set title = '横取り' where id = $1 returning id", [mine]),
        who.id,
      ).toHaveLength(0);
    expect(
      await q(mem1.ctx, "update knowledge_pages set title = '直した' where id = $1 returning id", [mine]),
    ).toHaveLength(1);
  });

  it("K674-DB-017 作るのは下書きだけ・持ち主は自分だけ（公開済みで作る・人を持ち主にして作るは断られる）", async () => {
    expect(
      await fails(
        mgr1.ctx,
        "insert into knowledge_pages (tenant_id, scope_id, owner_member_id, title, state) values ($1, $2, $3, 'x', 'published')",
        [A.tenant, A.g1, mgr1.id],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(
        mgr1.ctx,
        "insert into knowledge_pages (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'x')",
        [A.tenant, A.g1, mgr1b.id],
      ),
    ).toMatch(/row-level security/);
  });

  it("K674-DB-018 まだ書き終えていないページは持ち主だけ（同じグループのマネージャーも読めず直せない）", async () => {
    const d = await page({ scope: A.g1, owner: mgr1, state: "draft" });
    expect(await rows(mgr1.ctx, "knowledge_pages", d)).toBe(1);
    for (const who of [mgr1b, mem1, view1, adminA]) expect(await rows(who.ctx, "knowledge_pages", d), who.id).toBe(0);
    expect(
      await q(mgr1b.ctx, "update knowledge_pages set title = '横取り' where id = $1 returning id", [d]),
    ).toHaveLength(0);
    expect(
      await q(mgr1.ctx, "update knowledge_pages set title = '直した' where id = $1 returning id", [d]),
    ).toHaveLength(1);
  });

  it("K674-DB-019 版を読む：公開の版はページが読める人、下書きの版は書いた人だけ", async () => {
    const p = await page({ scope: A.g1, owner: mgr1 });
    const pub = await version(p, { kind: "published", n: 1, author: mgr1 });
    const dr = await version(p, { kind: "draft", n: 2, author: mgr1 });
    expect(await rows(mem1.ctx, "knowledge_page_versions", pub)).toBe(1);
    expect(await rows(mem2.ctx, "knowledge_page_versions", pub)).toBe(0);
    expect(await rows(mgr1.ctx, "knowledge_page_versions", dr)).toBe(1);
    for (const who of [mgr1b, mem1, adminA]) expect(await rows(who.ctx, "knowledge_page_versions", dr), who.id).toBe(0);
  });

  it("K674-DB-020 版を書く：下書きは書ける人が自分として足し、書いた人が公開に更新する。メンバー・他人名義は断られる", async () => {
    const p = await page({ scope: A.g1, owner: mgr1 });
    const ins = (who: Person, author: string) =>
      q(
        who.ctx,
        "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 2, 'draft', $3::jsonb, $4) returning id",
        [A.tenant, p, BODY_JSON, author],
      );
    expect(
      await fails(
        mem1.ctx,
        "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 2, 'draft', $3::jsonb, $4)",
        [A.tenant, p, BODY_JSON, mem1.id],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(
        mgr1.ctx,
        "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 2, 'draft', $3::jsonb, $4)",
        [A.tenant, p, BODY_JSON, mgr1b.id],
      ),
    ).toMatch(/row-level security/);
    const [row] = await ins(mgr1, mgr1.id);
    const id = (row as { id: string }).id;
    expect(
      await q(
        mem1.ctx,
        "update knowledge_page_versions set kind = 'published', published_at = now(), published_by = $2 where id = $1 returning id",
        [id, mem1.id],
      ),
    ).toHaveLength(0);
    expect(
      await q(
        mgr1.ctx,
        "update knowledge_page_versions set kind = 'published', published_at = now(), published_by = $2 where id = $1 returning id",
        [id, mgr1.id],
      ),
    ).toHaveLength(1);
    expect(await rows(mem1.ctx, "knowledge_page_versions", id)).toBe(1);
  });

  it("K674-DB-021 グループから抜けたら、そのグループの棚はもう読めない（入り直さなくても効く）", async () => {
    const m3 = await mkPerson(A.tenant, A.g1, "営業から抜ける人", "member", { scope: A.g1, role: "member" });
    const p = await page({ scope: A.g1, owner: mgr1 });
    expect(await rows(m3.ctx, "knowledge_pages", p)).toBe(1);
    await admin.query("update members set scope_id = $2 where id = $1", [m3.id, A.root]);
    await admin.query("delete from scope_memberships where member_id = $1", [m3.id]);
    expect(await rows(m3.ctx, "knowledge_pages", p)).toBe(0);
    expect((await q<{ v: boolean }>(m3.ctx, "select app.kpage_visible($1) as v", [p]))[0]!.v).toBe(false);
  });

  it("K674-DB-022 版は消さない（消す権限が無い）", async () => {
    const p = await page({ scope: A.g1, owner: mgr1 });
    const v = await version(p, { kind: "published", n: 1, author: mgr1 });
    expect(await fails(mgr1.ctx, "delete from knowledge_page_versions where id = $1", [v])).toMatch(
      /permission denied/,
    );
  });

  it("K674-DB-023 共有の器：kn_shared_visible・kn_shared_folder_visible がこの葉では必ず false（K-689 が差し替える）", async () => {
    const p = await page({ scope: A.g2, owner: mgr2 });
    const f = await folder({ scope: A.g2, owner: mgr2, name: "共有の器" });
    const r = (
      await q<{ a: boolean; b: boolean }>(
        mem1.ctx,
        "select app.kn_shared_visible($1) as a, app.kn_shared_folder_visible($2) as b",
        [p, f],
      )
    )[0]!;
    expect(r).toEqual({ a: false, b: false });
  });

  it("K674-DB-024 関数と行の守りが同じ答え：kpage_visible と select の見え方・kpage_writable と update の通り方が、6 種のページ × 7 人で全部一致する", async () => {
    const pages = [
      await page({ scope: A.root, owner: adminA }),
      await page({ scope: A.root, owner: adminA, state: "draft" }),
      await page({ scope: A.g1, owner: mgr1 }),
      await page({ scope: A.g1, owner: mgr1, state: "draft" }),
      await page({ scope: mem1.scope, owner: mem1, personal: true }),
      await page({ scope: A.g2, owner: mgr2 }),
    ];
    for (const who of [adminA, mgr1, mem1, view1, mem2, out, adminB])
      for (const id of pages) {
        const seen = (await rows(who.ctx, "knowledge_pages", id)) === 1;
        const fnSee = (await q<{ v: boolean }>(who.ctx, "select app.kpage_visible($1) as v", [id]))[0]!.v;
        expect(fnSee, `visible ${who.id} ${id}`).toBe(seen);
        const wrote =
          (await q(who.ctx, "update knowledge_pages set updated_at = now() where id = $1 returning id", [id]))
            .length === 1;
        const fnWrite = (await q<{ v: boolean }>(who.ctx, "select app.kpage_writable($1) as v", [id]))[0]!.v;
        expect(fnWrite, `writable ${who.id} ${id}`).toBe(wrote);
      }
  });

  it("K674-DB-025 補助の関数：棚の名前・棚の種類・フォルダの名前の並び・必ず守るの字数の上限", async () => {
    const f1 = await folder({ scope: A.g1, owner: mgr1, name: "経理" });
    const f2 = await folder({ scope: A.g1, owner: mgr1, name: "請求", parent: f1 });
    const r = (
      await q<Record<string, unknown>>(
        mem1.ctx,
        `select app.kn_shelf_name($1, false) as g, app.kn_shelf_name($2, false) as c, app.kn_shelf_name($1, true) as me,
        app.kn_shelf_kind($1, false) as kg, app.kn_shelf_kind($2, false) as kc, app.kn_shelf_kind($1, true) as km,
        app.kn_folder_names($3) as names, app.kn_must_text_max() as must_max`,
        [A.g1, A.root, f2],
      )
    )[0]!;
    expect(r).toMatchObject({
      g: "営業",
      c: "会社",
      me: "自分",
      kg: "group",
      kc: "company",
      km: "me",
      names: ["経理", "請求"],
      must_max: 2000,
    });
  });

  it("K674-DB-026 別の会社：読めず・作れず・直せない", async () => {
    const p = await page({ scope: A.g1, owner: mgr1 });
    const c = await page({ scope: A.root, owner: adminA });
    expect(await rows(adminB.ctx, "knowledge_pages", p)).toBe(0);
    expect(
      await q(adminB.ctx, "update knowledge_pages set title = '横取り' where id = $1 returning id", [c]),
    ).toHaveLength(0);
    expect(
      await fails(
        adminB.ctx,
        "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title) values ($1, $2, false, $3, 'x')",
        [A.tenant, A.root, adminB.id],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(
        adminB.ctx,
        "insert into knowledge_folders (tenant_id, scope_id, is_personal, owner_member_id, name) values ($1, $2, false, $3, 'x')",
        [A.tenant, A.root, adminB.id],
      ),
    ).toMatch(/row-level security/);
  });

  it("K674-DB-027 マネージャーの役を外したら、すぐ書けなくなる（役は毎回その時の scope_memberships から決まる）", async () => {
    const attempt = () => insertPage(mgr1b, A.g1, false);
    expect(await attempt()).toHaveLength(1);
    await admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      mgr1b.id,
      A.g1,
    ]);
    try {
      expect(
        await fails(
          mgr1b.ctx,
          "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, title) values ($1, $2, false, $3, 'x')",
          [A.tenant, A.g1, mgr1b.id],
        ),
      ).toMatch(/row-level security/);
    } finally {
      await admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
        mgr1b.id,
        A.g1,
      ]);
    }
    expect(await attempt()).toHaveLength(1);
  });

  it("K674-DB-028 棚は同じ会社のグループだけ（別の会社のグループを棚にしたページは入らない）", async () => {
    expect(
      await adminFails(
        "insert into knowledge_pages (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'x')",
        [A.tenant, B.root, mgr1.id],
      ),
    ).toMatch(/同じ会社/);
  });

  it("K674-DB-029 S1 migration の流し直し：同じ migration をもう 1 度当てても失敗せず、中身も変わらない", async () => {
    const sql = readFileSync(join(here, "..", "migrations", "20261125011400_knowledge_shelves.sql"), "utf8");
    const count = async () =>
      Number(
        (
          await admin.query<{ n: string }>(
            "select (select count(*) from knowledge_pages) + (select count(*) from knowledge_folders) + (select count(*) from knowledge_page_versions) as n",
          )
        ).rows[0]!.n,
      );
    const before = await count();
    await admin.query(sql);
    expect(await count()).toBe(before);
    const fn = await admin.query(
      "select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'app' and p.proname in ('kpage_visible', 'kpage_writable', 'kn_shelf_readable', 'kn_shelf_writable')",
    );
    expect(fn.rows[0]!.n).toBe(4);
  });
});
