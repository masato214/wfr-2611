// K-426「DB の関数を、誰でも（PUBLIC）呼べる形から外す」の試験（本物の DB・migration を全部当てた後）。
//   決まり D-128.171：security definer の関数は、呼んでよい役だけに execute を渡し public から外す。
//   直し方は関数ごとの revoke を並べず、根本を消す：① migration を流す役の既定の権限から PUBLIC の execute を外す（これから作る関数）
//   ② app の関数と public のスキーマの security definer の関数から PUBLIC を一度に外す（今ある関数）
//   ③ 呼び手の権限で動く所（行の守り・呼び手の権限の関数と引き金の本文・アプリの文）が呼ぶ物だけを kaname_app に渡す。
//   行 ID（K426-DB-…）は 11_tickets/K-426.md の表と 1 対 1。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(PKG, "..", "..");
const MIGRATION = join(PKG, "migrations", "20261120160000_function_execute_private.sql");
const T = 60_000;
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;

/** 中だけで使う関数（ほかの security definer の関数か引き金の中からだけ呼ばれる・どの口の文にも出ない）。kaname_app にも渡さない */
const INNER = [
  "app.bridge_pair_new(uuid, uuid)",
  "app.bridge_dev_claim(uuid, text)",
  "app.bridge_claim(text, text)",
  "app.memory_reviewer(uuid, uuid, uuid)",
  "app.agent_tool_audit(uuid, uuid, text, text, uuid, jsonb)",
  "app.agent_unit(uuid, uuid, text)",
  "app.ticket_basics(uuid)",
  "app.refresh_role_bundle_defaults()",
  "app.apply_role_bundles(uuid, uuid)",
  "app.role()",
  "app.scope_tree(uuid)",
  "app.artifact_editable(text)",
];
/** 呼び手の権限で動く所が呼ぶので kaname_app に渡す物（③） */
const NEEDED = [
  "app.tenant_id()",
  "app.user_id()",
  "app.ops_grant_ok(uuid)",
  "app.agent_notify_member(uuid)",
  "public.visible_scopes(uuid)",
  "public.has_permission(uuid, text, uuid, text)",
];
/** PUBLIC が実行できる関数の印（名前つき）。拡張の関数は数えない */
const OPEN_TO_PUBLIC = `
  select p.oid::regprocedure::text as sig
    from pg_proc p
   where p.pronamespace = $1::regnamespace
     and ($2::boolean is false or p.prosecdef)
     and has_function_privilege('public', p.oid, 'execute')
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
   order by 1`;
const openToPublic = async (schema: string, definerOnly: boolean) =>
  (await admin.query<{ sig: string }>(OPEN_TO_PUBLIC, [schema, definerOnly])).rows.map((r) => r.sig);
const can = async (role: string, sig: string) =>
  (await admin.query<{ ok: boolean }>("select has_function_privilege($1, $2, 'execute') as ok", [role, sig])).rows[0]!
    .ok;
/** 呼んで落ちたら、その文言を返す（落ちなければ null） */
const fails = async (pool: pg.Pool, sql: string, p: unknown[] = []) => {
  try {
    await pool.query(sql, p);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};
/** dir の下の .ts を全部（生成物の名前の物は除かない・下の除外は管理者だけが使うファイル） */
function tsFiles(dir: string, skip: Set<string>): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p, skip));
    else if (name.endsWith(".ts") && !skip.has(name)) out.push(p);
  }
  return out;
}

beforeAll(async () => {
  await migrate(DB_URL, PKG);
  app = new pg.Pool({ connectionString: APP_URL, max: 1 });
}, T);
afterAll(async () => {
  await app?.end();
  await admin.end();
});

describe("K-426 DB の関数は、誰でも（PUBLIC）呼べない", () => {
  it("K426-DB-001 app の security definer の関数で、PUBLIC が実行できる物は 0 件", async () => {
    const open = await openToPublic("app", true);
    expect(open, `PUBLIC が実行できる app の security definer の関数 ${open.length} 件`).toEqual([]);
  });

  it("K426-DB-002 app の関数は security definer でない物（引き金を含む）も、PUBLIC が実行できる物は 0 件", async () => {
    const open = await openToPublic("app", false);
    expect(open, `PUBLIC が実行できる app の関数 ${open.length} 件`).toEqual([]);
  });

  it("K426-DB-003 public のスキーマの security definer の関数（拡張の物を除く）も PUBLIC が実行できる物は 0 件。visible_scopes と has_permission は kaname_app が実行できる", async () => {
    const open = await openToPublic("public", true);
    expect(open, `PUBLIC が実行できる public の security definer の関数 ${open.length} 件`).toEqual([]);
    for (const sig of ["public.visible_scopes(uuid)", "public.has_permission(uuid, text, uuid, text)"])
      expect(await can("kaname_app", sig), `${sig} を kaname_app が実行できる`).toBe(true);
  });

  it("K426-DB-004 これから作る関数も初めから PUBLIC に渡らない：migration を流す役（管理者の接続）が app・public・kaname_auth に新しく作った関数は、PUBLIC も kaname_app も実行できない（渡すまで）", async () => {
    const acl = (
      await admin.query<{ acl: string | null }>(
        `select defaclacl::text as acl from pg_default_acl
          where defaclrole = current_user::regrole and defaclnamespace = 0 and defaclobjtype = 'f'`,
      )
    ).rows[0]?.acl;
    expect(acl ?? "", "migration を流す役の、スキーマを付けない既定の権限（関数）が在る").not.toBe("");
    expect(acl ?? "", "既定の権限に PUBLIC の execute が無い").not.toMatch(/(^|[{,])=X/);
    const tag = randomUUID().replace(/-/g, "").slice(0, 8);
    const made = ["app", "public", "kaname_auth"].map((s) => `${s}.k426_probe_${tag}()`);
    try {
      for (const sig of made) {
        await admin.query(
          `create function ${sig.replace("()", "")}() returns integer language sql security definer set search_path = pg_temp as 'select 1'`,
        );
        expect(await can("public", sig), `${sig} を PUBLIC が実行できない`).toBe(false);
        expect(await can("kaname_app", sig), `${sig} を kaname_app も（渡すまで）実行できない`).toBe(false);
      }
      const denied = await fails(app, `select ${made[0]} as v`);
      expect(denied ?? "", "kaname_app の接続から呼ぶと権限で止まる").toMatch(/permission denied/);
    } finally {
      for (const sig of made) await admin.query(`drop function if exists ${sig}`);
    }
  });

  it("K426-DB-005 呼び手の権限で動く所（行の守り・列の既定・検査の制約・ビュー・security definer でない関数と引き金の本文）が呼ぶ app と public の関数は、どれも kaname_app が実行できる", async () => {
    const missing = (
      await admin.query<{ sig: string }>(
        `with callee as (
           select p.oid, p.proname from pg_proc p
            where p.pronamespace in ('app'::regnamespace, 'public'::regnamespace)
              and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
         ), src as (
           select coalesce(qual, '') || ' ' || coalesce(with_check, '') as t from pg_policies
           union all select pg_get_expr(adbin, adrelid) from pg_attrdef
           union all select pg_get_constraintdef(oid) from pg_constraint where contype = 'c'
           union all select pg_get_viewdef(c.oid) from pg_class c
                      where c.relkind in ('v', 'm') and c.relnamespace in ('app'::regnamespace, 'public'::regnamespace)
           union all select p.prosrc from pg_proc p join pg_language l on l.oid = p.prolang
                      where not p.prosecdef and l.lanname in ('sql', 'plpgsql')
                        and p.pronamespace in ('app'::regnamespace, 'public'::regnamespace)
                        and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
         )
         select distinct c.oid::regprocedure::text as sig from callee c
           join src on src.t ~ ('\\m' || c.proname || '\\s*\\(')
          where not has_function_privilege('kaname_app', c.oid, 'execute')
          order by 1`,
      )
    ).rows.map((r) => r.sig);
    expect(missing, "呼び手の権限で動く所が呼ぶのに kaname_app が実行できない関数").toEqual([]);
    for (const sig of NEEDED) expect(await can("kaname_app", sig), `${sig} を kaname_app が実行できる`).toBe(true);
  });

  it("K426-DB-006 kaname_app の接続で、行の守りが app.tenant_id・app.user_id・app.ops_grant_ok・visible_scopes・has_permission を呼ぶ表を全部読める（権限の誤りにならない）", async () => {
    const tables = (
      await admin.query<{ t: string }>(
        `select distinct format('%I.%I', schemaname, tablename) as t from pg_policies
          where (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(tenant_id|user_id|ops_grant_ok|visible_scopes|has_permission)\\s*\\('
            and has_table_privilege('kaname_app', format('%I.%I', schemaname, tablename), 'select')
          order by 1`,
      )
    ).rows.map((r) => r.t);
    expect(tables.length, "行の守りがその関数を呼ぶ表が在る").toBeGreaterThan(0);
    const c = await app.connect();
    const errors: string[] = [];
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'owner', true)",
        [randomUUID(), randomUUID()],
      );
      for (const t of tables) {
        await c.query("savepoint k426");
        try {
          await c.query(`select count(*) from ${t}`);
          await c.query("release savepoint k426");
        } catch (e) {
          errors.push(`${t}: ${(e as Error).message}`);
          await c.query("rollback to savepoint k426");
        }
      }
    } finally {
      await c.query("rollback");
      c.release();
    }
    expect(errors, "kaname_app で読めなかった表").toEqual([]);
  });

  it("K426-DB-007 口の文（apps/api/src・packages/auth/src・packages/contracts/src・packages/db/src の業務の接続のファイル）に出る app の関数は、どの形も kaname_app が実行できる", async () => {
    const adminOnly = new Set(["cli.ts", "matrix.ts", "seeds.ts", "migrate.ts", "ci.ts"]);
    const files = ["apps/api/src", "packages/auth/src", "packages/contracts/src", "packages/db/src"].flatMap((d) =>
      tsFiles(join(ROOT, d), adminOnly),
    );
    const names = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/\bapp\.([a-z_0-9]+)\(/g)) names.add(m[1]!);
    const rows = (
      await admin.query<{ sig: string; ok: boolean }>(
        `select p.oid::regprocedure::text as sig, has_function_privilege('kaname_app', p.oid, 'execute') as ok
           from pg_proc p where p.pronamespace = 'app'::regnamespace and p.proname = any($1) order by 1`,
        [[...names]],
      )
    ).rows;
    expect(rows.length, "口の文に出る app の関数が DB に在る").toBeGreaterThan(50);
    expect(
      rows.filter((r) => !r.ok).map((r) => r.sig),
      "口の文に出るのに kaname_app が実行できない関数",
    ).toEqual([]);
  });

  it("K426-DB-008 中だけで使う関数は kaname_app にも渡さない（今より狭い）。kaname_app の接続から呼ぶと権限で止まり、行は増えない", async () => {
    for (const sig of INNER) {
      expect(await can("public", sig), `${sig} を PUBLIC が実行できない`).toBe(false);
      expect(await can("kaname_app", sig), `${sig} を kaname_app も実行できない`).toBe(false);
    }
    const count = async () =>
      Number((await admin.query<{ n: string }>("select count(*) as n from app.bridge_pairings")).rows[0]!.n);
    const before = await count();
    expect(
      await fails(app, "select app.bridge_pair_new($1::uuid, $2::uuid)", [randomUUID(), randomUUID()]),
      "kaname_app から接続コードを作る関数は呼べない",
    ).toMatch(/permission denied/);
    expect(await count(), "接続コードの行は増えない").toBe(before);
    expect(
      await fails(app, "select app.apply_role_bundles($1::uuid, $2::uuid)", [randomUUID(), randomUUID()]),
      "kaname_app から権限の束を当てる関数は呼べない",
    ).toMatch(/permission denied/);
  });

  it("K426-DB-009 kaname_auth は今までどおり app のスキーマを使えない。kaname_auth のスキーマの関数も PUBLIC が実行できる物は 0 件", async () => {
    const usage = (
      await admin.query<{ ok: boolean }>("select has_schema_privilege('kaname_auth', 'app', 'usage') as ok")
    ).rows[0]!.ok;
    expect(usage, "kaname_auth に app のスキーマの usage を渡さない").toBe(false);
    const open = await openToPublic("kaname_auth", false);
    expect(open, `PUBLIC が実行できる kaname_auth の関数 ${open.length} 件`).toEqual([]);
  });

  it("K426-DB-010 migration をもう一度当てても落ちず、数は 0 のまま（2 回流しても同じ）", async () => {
    await admin.query(readFileSync(MIGRATION, "utf8"));
    expect(await openToPublic("app", false), "app の関数は PUBLIC に開いていない").toEqual([]);
    expect(await openToPublic("public", true), "public の security definer の関数も開いていない").toEqual([]);
    for (const sig of NEEDED) expect(await can("kaname_app", sig), `${sig} を kaname_app が実行できる`).toBe(true);
  });

  it("K426-DB-011 失敗 S1・S2・S3：migration の文の後ろで落ちたら全部戻る（半分だけ外した形・既定の権限だけ変えた形を残さない）", async () => {
    const c = await admin.connect();
    const defaults = async () =>
      (
        await c.query<{ acl: string | null }>(
          `select defaclacl::text as acl from pg_default_acl
            where defaclrole = current_user::regrole and defaclnamespace = 0 and defaclobjtype = 'f'`,
        )
      ).rows[0]?.acl ?? null;
    const roleOpen = async () =>
      (await c.query<{ ok: boolean }>("select has_function_privilege('public', 'app.role()', 'execute') as ok"))
        .rows[0]!.ok;
    try {
      await c.query("begin");
      // 前の形を 1 つ作る（app.role() を PUBLIC に開き、既定の権限を PUBLIC に戻す）
      await c.query("grant execute on function app.role() to public");
      await c.query("alter default privileges grant execute on functions to public");
      const before = await defaults();
      await c.query("savepoint k426");
      let failed: string | null = null;
      try {
        await c.query(`${readFileSync(MIGRATION, "utf8")}\n;select app.k426_no_such_function();`);
      } catch (e) {
        failed = String((e as Error).message);
      }
      expect(failed ?? "", "後ろの文で落ちる").toMatch(/does not exist/);
      await c.query("rollback to savepoint k426");
      expect(await roleOpen(), "前の文で外した PUBLIC が戻っている").toBe(true);
      expect(await defaults(), "既定の権限も前のまま").toBe(before);
    } finally {
      await c.query("rollback");
      c.release();
    }
    expect(
      await can("public", "app.role()"),
      "外の取引を戻した後は、migration を当てた形（PUBLIC に開いていない）",
    ).toBe(false);
  });

  it("K426-DB-013 持ち主・kaname_app・kaname_auth のほかの役（何も渡していない役を作って数える）は、app の関数も public の security definer の関数も実行できない", async () => {
    const c = await admin.connect();
    const plain = `k426_plain_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    try {
      await c.query("begin");
      await c.query(`create role ${plain} nologin`);
      const rows = (
        await c.query<{ role: string; sig: string | null }>(
          `select r.rolname as role, p.oid::regprocedure::text as sig
             from pg_roles r
             left join pg_proc p
               on (p.pronamespace = 'app'::regnamespace
                   or (p.pronamespace = 'public'::regnamespace and p.prosecdef
                       and not exists (select 1 from pg_depend d
                                        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')))
              and r.oid <> p.proowner and not pg_has_role(r.oid, p.proowner, 'member')
              and has_function_privilege(r.oid, p.oid, 'execute')
            where not r.rolsuper and r.rolname !~ '^pg_'
              and r.oid not in ('kaname_app'::regrole, 'kaname_auth'::regrole)
            order by 1, 2`,
        )
      ).rows;
      expect(
        rows.map((r) => r.role),
        "作った役も数えた中に入る",
      ).toContain(plain);
      const open = rows.filter((r) => r.sig !== null).map((r) => `${r.role}: ${r.sig}`);
      expect(open, `ほかの役が実行できる関数 ${open.length} 組`).toEqual([]);
    } finally {
      await c.query("rollback");
      c.release();
    }
    const left = (await admin.query("select 1 from pg_roles where rolname = $1", [plain])).rowCount;
    expect(left, "取引を戻すと作った役も消える").toBe(0);
  });

  it("K426-DB-014 ほかの役に明示で渡した実行権と既定の権限（Supabase の anon の形）も migration で外れ、kaname_app と kaname_auth の明示の権限は残る", async () => {
    const c = await admin.connect();
    const other = `k426_other_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const probe = `public.k426_probe_${randomUUID().replace(/-/g, "").slice(0, 8)}()`;
    const canIn = async (role: string, sig: string) =>
      (await c.query<{ ok: boolean }>("select has_function_privilege($1, $2, 'execute') as ok", [role, sig])).rows[0]!
        .ok;
    try {
      await c.query("begin");
      await c.query(`create role ${other} nologin`);
      await c.query(`grant execute on function app.tenant_id(), public.visible_scopes(uuid) to ${other}`);
      await c.query(`alter default privileges in schema public grant execute on functions to ${other}`);
      expect(await canIn(other, "public.visible_scopes(uuid)"), "前の形：その役は呼べる").toBe(true);
      await c.query(readFileSync(MIGRATION, "utf8"));
      expect(await canIn(other, "app.tenant_id()"), "app.tenant_id() の明示の権限が外れる").toBe(false);
      expect(await canIn(other, "public.visible_scopes(uuid)"), "visible_scopes の明示の権限が外れる").toBe(false);
      await c.query(
        `create function ${probe.replace("()", "")}() returns integer language sql security definer set search_path = pg_temp as 'select 1'`,
      );
      expect(await canIn(other, probe), "後から public に作った関数も、その役には渡らない").toBe(false);
      expect(await canIn("kaname_app", "app.tenant_id()"), "kaname_app の明示の権限は残る").toBe(true);
      expect(
        await canIn("kaname_auth", "app.open_session(text, text, text, text, text)"),
        "kaname_auth の明示の権限は残る",
      ).toBe(true);
    } finally {
      await c.query("rollback");
      c.release();
    }
    const left = (await admin.query("select 1 from pg_roles where rolname = $1", [other])).rowCount;
    expect(left, "取引を戻すと作った役も消える").toBe(0);
  });
});
