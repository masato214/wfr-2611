import { randomUUID } from "node:crypto";
// access-matrix の種を information_schema から機械的に作る（表を足すたびに seeds.ts へ手で足さない＝漏れない）。
// 規則：tenant_id → その会社／scope_id → 会社の根の層／members への FK → その会社の代表／他表への FK → その表の同じ会社の種／マスタ（key）→ 'seed'／NOT NULL は型の既定値
import type pg from "pg";
import type { Seeded } from "./matrix.js";

export interface GenericBase {
  tenantA: string;
  tenantB: string;
  bossA: string;
  bossB: string;
  scopeRootA: string;
  scopeRootB: string;
  opsTenant: string;
  opsMember: string;
  opsScope: string;
}
type Col = { table: string; col: string; type: string; udt: string; nullable: boolean; def: string | null };
type Fk = { table: string; col: string; refTable: string; refCol: string };
type SeedRow = Seeded["rows"][string];
const rnd = () => Math.random().toString(36).slice(2, 8);

export async function seedGenericRows(
  c: pg.PoolClient,
  b: GenericBase,
  explicit: Set<string>,
): Promise<Record<string, SeedRow>> {
  const cols = (
    await c.query<Col>(
      "select table_name as table, column_name as col, data_type as type, udt_name as udt, (is_nullable = 'YES') as nullable, column_default as def from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
    )
  ).rows;
  const fks = (
    await c.query<Fk>(
      `select r.relname::text as "table", a.attname::text as col, fr.relname::text as "refTable", ra.attname::text as "refCol"
from pg_constraint c
join pg_class r on r.oid = c.conrelid
join pg_class fr on fr.oid = c.confrelid
cross join lateral unnest(c.conkey, c.confkey) as k(attnum, refattnum)
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = k.refattnum
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and fr.relnamespace = 'public'::regnamespace`,
    )
  ).rows;
  const pks = new Map<string, string>();
  for (const r of (
    await c.query<{ t: string; c: string }>(
      "select tc.table_name as t, kcu.column_name as c from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'",
    )
  ).rows)
    pks.set(r.t, r.c);
  // 値の候補が CHECK で決まっている列（kind in ('init', …) 等）は、候補の先頭を種にする（"seed" では通らない）
  const allowed = new Map<string, string>(); // `${table}.${col}` → 最初の候補
  for (const r of (
    await c.query<{ t: string; def: string }>(
      "select conrelid::regclass::text as t, pg_get_constraintdef(oid) as def from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace",
    )
  ).rows) {
    const m = /\(?(\w+) = ANY \(ARRAY\['([^']*)'/.exec(r.def);
    if (m) allowed.set(`${r.t}.${m[1]}`, m[2]!);
  }
  // 「この値のときだけ この列が要る」（例：(kind = 'published') = (published_at IS NOT NULL)）：種の値がそうなら、その列も埋める
  const pairs: { t: string; col: string; val: string; other: string }[] = [];
  for (const r of (
    await c.query<{ t: string; def: string }>(
      "select conrelid::regclass::text as t, pg_get_constraintdef(oid) as def from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace",
    )
  ).rows) {
    const m = /\(\((\w+) = '([^']*)'::text\) = \((\w+) IS NOT NULL\)\)/.exec(r.def);
    if (m) pairs.push({ t: r.t, col: m[1]!, val: m[2]!, other: m[3]! });
  }
  const tables = [...new Set(cols.map((x) => x.table))].filter((t) => !explicit.has(t));
  const colsOf = (t: string) => cols.filter((x) => x.table === t);
  const fkOf = (t: string, col: string) => fks.find((f) => f.table === t && f.col === col);
  const hasTenant = (t: string) => colsOf(t).some((x) => x.col === "tenant_id");
  const isOps = (t: string) => colsOf(t).some((x) => x.col === "tenant_id" && (x.def ?? "").includes("ops_tenant_id"));
  const isMaster = (t: string) => pks.get(t) === "key";
  // 依存順（FK の先を先に。自己参照と対象外の表は無視）
  const order: string[] = [];
  const pending = new Set(tables);
  while (pending.size) {
    const ready = [...pending].filter(
      (t) => !fks.some((f) => f.table === t && f.refTable !== t && pending.has(f.refTable)),
    );
    // 行き詰まったら（輪がある）、輪の上にある表から 1 つ崩す。名前順の先頭を選ぶと、輪の外で順番待ちの表
    // （例：bridge_job_events は bridge_jobs の後）を先に出してしまい、親の種が無く FK が null になる
    const deps = (t: string) =>
      fks.filter((f) => f.table === t && f.refTable !== t && pending.has(f.refTable)).map((f) => f.refTable);
    const onCycle = (t: string): boolean => {
      const seen = new Set<string>();
      const stack = deps(t);
      while (stack.length) {
        const u = stack.pop()!;
        if (u === t) return true;
        if (seen.has(u)) continue;
        seen.add(u);
        stack.push(...deps(u));
      }
      return false;
    };
    for (const t of ready.length ? ready : [[...pending].find(onCycle) ?? [...pending][0]!]) {
      order.push(t);
      pending.delete(t);
    }
  }
  // 種の行（表 × 会社）
  const seeded = new Map<string, string>(); // `${table}:${tenant}` → pk
  // 1 つの表が同じ表を 2 回以上指す（例：つながりの元と先のチケット）なら、指される表の種を 2 行目まで作り、別の行を入れる
  const twice = new Set<string>();
  {
    const n = new Map<string, number>();
    for (const f of fks)
      if (f.refTable !== f.table) n.set(`${f.table}>${f.refTable}`, (n.get(`${f.table}>${f.refTable}`) ?? 0) + 1);
    for (const [k, v] of n) if (v >= 2) twice.add(k.split(">")[1]!);
  }
  const seeded2 = new Map<string, string>(); // 2 行目の種
  const masterKey = new Map<string, string>();
  const out: Record<string, SeedRow> = {};
  const tenantOf = (t: string, which: "A" | "B" | "ops") =>
    which === "A" ? b.tenantA : which === "B" ? b.tenantB : b.opsTenant;
  const bossOf = (which: "A" | "B" | "ops") => (which === "A" ? b.bossA : which === "B" ? b.bossB : b.opsMember);
  const scopeOf = (which: "A" | "B" | "ops") =>
    which === "A" ? b.scopeRootA : which === "B" ? b.scopeRootB : b.opsScope;
  const whichOf = (tenant: string): "A" | "B" | "ops" =>
    tenant === b.tenantA ? "A" : tenant === b.tenantB ? "B" : "ops";
  /** 本文の形を DB の check（app.ticket_body_valid）が守る jsonb の列（K-674）。既定の {} では入らない */
  const DOC_BODY_COLS = new Set(["knowledge_page_versions.body"]);
  const EMPTY_DOC_BODY = JSON.stringify({ doc: { type: "doc", content: [] }, text: "" });
  /**
   * INSERT の見本だけに当てる値（K-674）。ナレッジは権限の束を使わず棚で書ける人が決まる（会社＝管理者・グループ＝マネージャー・自分＝本人）。
   * 種の代表は管理者ではないので、「権限あり・自分の範囲」は自分の棚に書く形にする。版は下書きだけを足せる（kind の既定は published）
   */
  const INSERT_AS: Record<string, Record<string, unknown>> = {
    knowledge_pages: { is_personal: true, folder_id: null }, // 種のフォルダは会社の棚（フォルダと同じ棚の引き金に当たる）
    knowledge_folders: { is_personal: true },
    knowledge_page_versions: { kind: "draft" },
  };
  const defaultOf = (x: Col): unknown => {
    if (x.type === "boolean") return false;
    if (["smallint", "integer", "bigint", "numeric", "real", "double precision"].includes(x.type)) return 1;
    if (x.type === "date") return new Date().toISOString().slice(0, 10);
    if (x.type.startsWith("timestamp")) return new Date();
    if (x.type === "jsonb" || x.type === "json") return "{}";
    if (x.type === "ARRAY") return "{}";
    if (x.udt === "uuid") return randomUUID(); // 外部キーでない uuid（つながりの先の id など）は空にできないので、値を作る
    return "seed";
  };
  const build = (t: string, which: "A" | "B" | "ops", fresh: boolean): Record<string, unknown> => {
    const row: Record<string, unknown> = {};
    const used = new Set<string>();
    const tenant = tenantOf(t, which);
    for (const x of colsOf(t)) {
      if (x.col === pks.get(t) && x.col === "id") continue;
      // 自然な主キー（setup_steps の n 等）：新しく足す行は既存と重ならない値にする
      if (x.col === pks.get(t) && fresh) {
        row[x.col] = ["smallint", "integer", "bigint", "numeric"].includes(x.type)
          ? 1000 + Math.floor(Math.random() * 30000)
          : `k9-${rnd()}`;
        continue;
      }
      if (["created_at", "updated_at", "deleted_at", "created_by", "updated_by"].includes(x.col)) continue;
      const fk = fkOf(t, x.col);
      if (x.col === "tenant_id") row[x.col] = tenant;
      // 業務の型の種は運営の全社向け（グループなし・D-126.23）。グループを入れると会社の人が読む全社向けにならない
      else if (t === "skills" && x.col === "scope_id") row[x.col] = null;
      // 取引先の種は「担当グループだけ」にする（担当グループの無い会社 a の担当者からは見えない＝子の表の「親が見えない」を確かめられる・K-12）
      else if (t === "clients" && x.col === "visibility") row[x.col] = "groups";
      else if (x.col === "scope_id" && fk) row[x.col] = scopeOf(which);
      // 先方の人を会社の人に結ぶと、その人は「取引先の人」になり会社の人の守りを通れなくなる（app.member_ok・K-6）。種では結ばない
      else if (t === "client_contacts" && x.col === "member_id") row[x.col] = null;
      else if (fk && fk.refTable === "members") row[x.col] = bossOf(which);
      else if (fk && fk.refTable === "tenants") row[x.col] = tenant;
      else if (fk && fk.refTable === "scopes") row[x.col] = scopeOf(which);
      else if (fk && fk.refTable === t)
        row[x.col] = null; // 自己参照は根
      else if (fk && isMaster(fk.refTable)) row[x.col] = masterKey.get(fk.refTable) ?? "seed";
      else if (fk) {
        let v =
          seeded.get(`${fk.refTable}:${tenant}`) ??
          seeded.get(`${fk.refTable}:${b.opsTenant}`) ??
          seeded.get(`${fk.refTable}:${b.tenantA}`) ??
          null;
        // 同じ行を 2 回指さない：2 行目の種があればそれを、無ければ空でよい列は空にする（例：案を作った人と決めた人）
        if (v && used.has(`${fk.refTable}:${v}`))
          v = seeded2.get(`${fk.refTable}:${tenant}`) ?? (x.nullable ? null : v);
        if (v) used.add(`${fk.refTable}:${v}`);
        row[x.col] = v;
      } else if (x.col === "key") row[x.col] = fresh ? `k9-${rnd()}` : "seed";
      else if (x.col === "version") row[x.col] = fresh ? Math.floor(Math.random() * 1e6) + 2 : 1;
      else if (DOC_BODY_COLS.has(`${t}.${x.col}`))
        // 本文の形を DB が守る列（既定の {} は守りに通らない）：空の文書 {doc, text}
        row[x.col] = EMPTY_DOC_BODY;
      else if (!x.nullable && x.def === null)
        // 新しく足す行の文字の列は重ならない値にする（例：チケットごとに区画の名前は 1 つ）
        row[x.col] = allowed.get(`${t}.${x.col}`) ?? (fresh && x.type === "text" ? `seed-${rnd()}` : defaultOf(x));
    }
    for (const pr of pairs.filter((x) => x.t === t)) {
      const dflt = colsOf(t).find((x) => x.col === pr.col)?.def ?? "";
      const v = row[pr.col] ?? /^'([^']*)'/.exec(String(dflt))?.[1] ?? null;
      const o = colsOf(t).find((x) => x.col === pr.other);
      if (v === pr.val && o && row[pr.other] == null)
        row[pr.other] = o.type.startsWith("timestamp") ? new Date() : o.udt === "uuid" ? null : "seed";
    }
    return row;
  };
  const insertRow = async (t: string, row: Record<string, unknown>): Promise<string> => {
    const pk = pks.get(t) ?? "id";
    const run = async (r0: Record<string, unknown>) => {
      const keys = Object.keys(r0).filter((k) => r0[k] !== null && r0[k] !== undefined);
      const r = await c.query<Record<string, string>>(
        `insert into "${t}" (${keys.map((k) => `"${k}"`).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning "${pk}"`,
        keys.map((k) => r0[k]),
      );
      return r.rows[0]![pk]!;
    };
    // 会社を作ったときに入る初めの行（例：渡すときの決まり）と重なったら、その会社の行を種にする
    const orExisting = async (r0: Record<string, unknown>) => {
      try {
        return await run(r0);
      } catch (e) {
        if ((e as { code?: string }).code !== "23505" || !r0["tenant_id"]) throw e;
        const have = await c.query<Record<string, string>>(
          `select "${pk}" from "${t}" where tenant_id = $1 order by created_at limit 1`,
          [r0["tenant_id"]],
        );
        if (!have.rows[0]) throw e;
        return have.rows[0][pk]!;
      }
    };
    // 種は 1 文ずつ確定する（トランザクションの外）ので、失敗した文は何も残さない
    try {
      return await orExisting(row);
    } catch (e) {
      // 列どうしの決まり（例：target が axis のときだけ axis_id）に当たったら、空でよい外部キーを空にしてもう一度
      if ((e as { code?: string }).code !== "23514") throw e;
      const optional = new Set(
        colsOf(t)
          .filter((x) => x.nullable && fkOf(t, x.col) && x.col !== "tenant_id" && x.col !== "scope_id")
          .map((x) => x.col),
      );
      try {
        return await orExisting(Object.fromEntries(Object.entries(row).filter(([k]) => !optional.has(k))));
      } catch (e2) {
        // 列どうしの決まりが「この種類なら本文が要る」（例：書き込みは本文が必須）なら、空でよい文字の列も埋めてもう一度
        if ((e2 as { code?: string }).code !== "23514") throw e2;
        const filled = { ...row };
        for (const x of colsOf(t)) {
          if (x.type !== "text" || fkOf(t, x.col) || allowed.has(`${t}.${x.col}`)) continue;
          // 空でよい文字の列を埋め、決まりの長さ（例：ハッシュは 32 文字以上）にも当たらないよう長めの値にする
          if (filled[x.col] == null || filled[x.col] === "seed") filled[x.col] = `seed-${rnd()}-${"0".repeat(40)}`;
        }
        return await orExisting(filled);
      }
    }
  };
  for (const t of order) {
    if (isMaster(t)) {
      const existingKey = (await c.query<{ key: string }>(`select key from "${t}" order by key limit 1`)).rows[0]?.key;
      if (!existingKey) await c.query(`insert into "${t}" (key, label) values ('seed', 'seed') on conflict do nothing`);
      const k = existingKey ?? "seed";
      masterKey.set(t, k);
      out[t] = { visible: k, hiddenLayer: null, other: k, insert: () => ({ key: `k9-${rnd()}`, label: "x" }) };
      continue;
    }
    if (!hasTenant(t)) {
      // 自然な主キー（id 以外）で migration が既に中身を入れている表（例：setup_steps の n）は、その 1 行を種にする
      const pkCol = pks.get(t) ?? "id";
      if (pkCol !== "id") {
        const have = (await c.query<Record<string, string>>(`select "${pkCol}" from "${t}" order by 1 limit 1`))
          .rows[0]?.[pkCol];
        if (have !== undefined) {
          const id = String(have);
          seeded.set(`${t}:${b.opsTenant}`, id);
          seeded.set(`${t}:${b.tenantA}`, id);
          out[t] = { visible: id, hiddenLayer: null, other: id, insert: () => build(t, "ops", true) };
          continue;
        }
      }
      // 版の表（親の FK だけ）。親の種（運営 → 会社 a の順）に繋ぐ
      const id = await insertRow(t, build(t, "ops", false));
      seeded.set(`${t}:${b.opsTenant}`, id);
      seeded.set(`${t}:${b.tenantA}`, id);
      out[t] = { visible: id, hiddenLayer: null, other: id, insert: () => build(t, "ops", true) };
      continue;
    }
    if (isOps(t)) {
      const id = await insertRow(t, build(t, "ops", false));
      seeded.set(`${t}:${b.opsTenant}`, id);
      if (twice.has(t)) seeded2.set(`${t}:${b.opsTenant}`, await insertRow(t, build(t, "ops", true)));
      out[t] = { visible: id, hiddenLayer: null, other: id, insert: () => build(t, "ops", true) };
      continue;
    }
    const idA = await insertRow(t, build(t, "A", false));
    const idB = await insertRow(t, build(t, "B", false));
    seeded.set(`${t}:${b.tenantA}`, idA);
    seeded.set(`${t}:${b.tenantB}`, idB);
    if (twice.has(t)) {
      seeded2.set(`${t}:${b.tenantA}`, await insertRow(t, build(t, "A", true)));
      seeded2.set(`${t}:${b.tenantB}`, await insertRow(t, build(t, "B", true)));
    }
    out[t] = {
      visible: idA,
      hiddenLayer: null,
      other: idB,
      insert: (tenant) => ({ ...build(t, whichOf(tenant), true), ...(INSERT_AS[t] ?? {}) }),
    };
  }
  return out;
}
