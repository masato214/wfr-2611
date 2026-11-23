// 段 8「検索条件を保存する」の口（K-475 保存する・開く／K-476 直す・消す）の試験の共通の土台。
//   K-475 が carry: で運ぶ（K-476 は K-475 の後なので本線に在る）。行（it）は葉ごとの試験のファイルにある。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては apps/api/test/features/fixture.ts（本物の Postgres に migration を全部当てる・本物の口の入口・偽の画面のログイン）。
//   口の振る舞い（hooks のファイル）は、準備（beforeAll）では読まず、最初の要求の前に 1 回だけ読んで f.hooks に足す（useHooks）。
//   切る段の smoke（実装の前に本物の DB で流す）で、まだ無いファイルを準備で読んで準備ごと落とさないため
//   （準備の赤と本体の赤を分ける・answer=8f745003d023。読み方は K-387 の progress.harness.ts と同じ）。
// 保存した条件・グループ・人は DB に直に置く（口の準備に口を使わない）。時刻は眠らずに now() からずらして置く。
import { afterAll, beforeAll, vi } from "vitest";
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Hook } from "../../../src/contract/deps.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

// ---- 決めた番号と文（11_tickets/K-475.md・K-476.md の表・errors.d/K-475.json・K-476.json）----
export const VWS_NO_NAME = "E-VWS-001"; // 名前を入れてください（422）
export const VWS_NAME_LONG = "E-VWS-002"; // 名前は 60 文字までにしてください（422）
export const VWS_NEED_SCOPE = "E-VWS-003"; // グループの全員に見せるときは、見せるグループを選んでください（422）
export const VWS_NO_SCOPE = "E-VWS-004"; // 見せるグループが見つかりませんでした…（404）
export const VWS_SAME_NAME = "E-VWS-005"; // 同じ名前の保存した条件が、もうあります…（409）
export const VWS_FULL = "E-VWS-006"; // 保存できる条件は 50 件までです…（409）
export const VWS_BAD_SHAPE = "E-VWS-007"; // 条件の形が正しくありません…（422）
export const VWS_CONTROL = "E-VWS-008"; // 名前に改行などの制御文字は使えません（422）
export const VWS_OWNER_ONLY = "E-VWS-020"; // 見せる相手を変えられるのは、作った人だけです（403・K-476）
export const VWS_KEEP_GROUP = "E-VWS-021"; // グループの全員に見せている条件から、見せるグループは外せません（409・K-476）
export const TEXT: Readonly<Record<string, string>> = {
  [VWS_NO_NAME]: "名前を入れてください",
  [VWS_NAME_LONG]: "名前は 60 文字までにしてください",
  [VWS_NEED_SCOPE]: "グループの全員に見せるときは、見せるグループを選んでください",
  [VWS_NO_SCOPE]: "見せるグループが見つかりませんでした。消されたか、見る権限が無いかもしれません",
  [VWS_SAME_NAME]: "同じ名前の保存した条件が、もうあります。別の名前にしてください",
  [VWS_FULL]: "保存できる条件は 50 件までです。いらないものを消してから保存してください",
  [VWS_BAD_SHAPE]: "条件の形が正しくありません。条件・列の並び・大きさを確かめてください",
  [VWS_CONTROL]: "名前に改行などの制御文字は使えません",
  [VWS_OWNER_ONLY]: "見せる相手を変えられるのは、作った人だけです",
  [VWS_KEEP_GROUP]: "グループの全員に見せている条件から、見せるグループは外せません。先に「自分だけ」に変えてください",
};
/** 1 人が持てる保存した条件の数（消していない物・仮・K-475） */
export const MAX_PER_PERSON = 50;
/** 一覧で返す上限（これを超える分は切ってログに 1 行） */
export const LIST_MAX = 500;
/** 答えの 1 件の鍵（この 13 個ちょうど。tenant_id・created_by・deleted_at などの表の列は出さない） */
export const VIEW_KEYS = [
  "can_edit",
  "columns",
  "created_at",
  "density",
  "filters",
  "id",
  "member_id",
  "member_name",
  "mine",
  "name",
  "scope_id",
  "share",
  "updated_at",
] as const;

export let f: Fixture;
export interface World {
  tenantId: string;
  root: string;
  g1: string; // 営業（root の下）
  g2: string; // 開発（root の下）
  owner: Person; // g1 に席がある・保存した条件を作る人
  mate: Person; // g1 に席がある同僚（マネージャーでない）
  manager: Person; // g1 の席・g1 のマネージャー（scope_memberships）で saved_views の edit を持つ
  other: Person; // g2 に席がある（g1 は見えない）
  top: Person; // root に席がある（全部のグループが見える）
  tenantB: string; // 別の会社
  rootB: string;
  outsider: Person; // 別の会社の人
}
export let W: World;

export type J = Record<string, unknown> & {
  data?: Record<string, unknown> & Record<string, unknown>[];
  details?: { field: string; message: string }[];
};
export const json = async (r: Response) => (await r.clone().json()) as J;
export const rowsOf = (j: J): Record<string, unknown>[] => (j.data as unknown as Record<string, unknown>[]) ?? [];
export const rowOf = (j: J): Record<string, unknown> => (j.data as unknown as Record<string, unknown>) ?? {};
export const fields = (j: J) => (j.details ?? []).map((d) => d.field);
export const one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await f.admin.query(sql, p)).rows[0] as R;
export const num = async (sql: string, p: unknown[] = []) => Number((await one<{ n: string }>(sql, p)).n);
export const ctxOf = (p: Person): TenantContext => ({
  tenantId: p.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
/** 行の守りの中（アプリの接続・その人の文脈）で SQL を流す（口を通さない DB の 2 層目の確かめ） */
export const asMember = async <R = Record<string, unknown>>(p: Person, sql: string, args: unknown[] = []) =>
  withTenant(f.pool as pg.Pool, ctxOf(p), async (cl) => (await cl.query(sql, args)).rows as R[]);
/** 同じ SQL が DB に断られたら、その文（断られなければ null） */
export const failsAs = async (p: Person, sql: string, args: unknown[] = []): Promise<string | null> => {
  try {
    await asMember(p, sql, args);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};
/** 口の外に出る行（console）を、流している間だけ集める */
export async function captureLogs(run: () => Promise<void>): Promise<string> {
  const out: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
    vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
  );
  try {
    await run();
  } finally {
    for (const s of spies) s.mockRestore();
  }
  return out.join("\n");
}

// ---- 口の振る舞い（hooks のファイル）を最初の要求の前に 1 回だけ読む ----
const LOADERS: Record<string, () => Promise<Record<string, Hook>>> = {
  // K-475 が作る（listSavedViews・createSavedView）
  "saved-views": async () => {
    const m = (await import("../../../src/hooks/saved-views.js")) as {
      savedViewsHooks: (p: pg.Pool) => Record<string, Hook>;
    };
    return m.savedViewsHooks(f.pool);
  },
  // K-476 が作る（updateSavedView・deleteSavedView）
  "saved-views-edit": async () => {
    const m = (await import("../../../src/hooks/saved-views-edit.js")) as {
      savedViewsEditHooks: (p: pg.Pool) => Record<string, Hook>;
    };
    return m.savedViewsEditHooks(f.pool);
  },
};
function useHooks(names: readonly string[]) {
  let loading: Promise<void> | null = null;
  const load = async () => {
    for (const n of names) {
      const make = LOADERS[n];
      if (!make) throw new Error(`試験の土台が知らない hooks のファイル：${n}`);
      Object.assign(f.hooks, await make());
    }
  };
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
}

/** 土台を立てる（各ファイルの頭で 1 回）。会社 A（グループ 2 つ・人 5 人）と会社 B（人 1 人）を作る */
export function setupSavedViews(names: readonly string[]) {
  beforeAll(async () => {
    f = await makeFixture([]);
    const A = await f.company("K475 の会社 A", "VA");
    const B = await f.company("K475 の会社 B", "VB");
    const scope = async (name: string, prefix: string) =>
      (
        await one<{ id: string }>(
          "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
          [A.tenantId, A.rootScope, name, prefix],
        )
      ).id;
    const g1 = await scope("営業", "VS");
    const g2 = await scope("開発", "VD");
    const owner = await f.person(A.tenantId, g1, { name: "高本" });
    const mate = await f.person(A.tenantId, g1, { name: "山田" });
    const manager = await f.person(A.tenantId, g1, { name: "佐藤" });
    const other = await f.person(A.tenantId, g2, { name: "鈴木" });
    const top = await f.person(A.tenantId, A.rootScope, { name: "全体を見る人" });
    const outsider = await f.person(B.tenantId, B.rootScope, { name: "別の会社の人" });
    // マネージャー：g1 の役割 manager（入口の行の確かめ app.manages_scope）と、saved_views の edit（行の守りの has_permission）の両方
    await f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [A.tenantId, g1, manager.id],
    );
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'saved_views', $3, 'edit')",
      [A.tenantId, manager.id, g1],
    );
    W = {
      tenantId: A.tenantId,
      root: A.rootScope,
      g1,
      g2,
      owner,
      mate,
      manager,
      other,
      top,
      tenantB: B.tenantId,
      rootB: B.rootScope,
      outsider,
    };
    for (const op of ["listSavedViews", "createSavedView", "updateSavedView", "deleteSavedView"]) f.limits[op] = 10_000;
    useHooks(names);
  });
  afterAll(async () => {
    await f?.close();
  });
}

// ---- 種を置く（管理の接続で直に）----
export interface SeedView {
  by: Person;
  name: string;
  share?: "self" | "group";
  scope?: string | null;
  filters?: unknown;
  columns?: unknown;
  density?: "normal" | "compact";
  deleted?: boolean;
  /** 作った時刻を今から何分前にするか（並びを決めるため） */
  minutesAgo?: number;
}
export async function seedView(o: SeedView): Promise<string> {
  const share = o.share ?? "self";
  const scope = o.scope === undefined ? (share === "group" ? W.g1 : null) : o.scope;
  return (
    await one<{ id: string }>(
      `insert into saved_views (tenant_id, member_id, name, share, scope_id, filters, columns, density, deleted_at, created_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, case when $9::boolean then now() else null end, now() - make_interval(mins => $10::int))
       returning id`,
      [
        o.by.tenantId,
        o.by.id,
        o.name,
        share,
        scope,
        JSON.stringify(o.filters ?? {}),
        JSON.stringify(o.columns ?? []),
        o.density ?? "normal",
        o.deleted === true,
        o.minutesAgo ?? 0,
      ],
    )
  ).id;
}
/** 新しいグループを 1 つ作る（会社 A の root の下）。ほかの試験の「グループに見せた条件」と混ざらない席をつくるため */
export const freshScope = async (name = "試験のグループ") =>
  (
    await one<{ id: string }>("insert into scopes (tenant_id, parent_id, name) values ($1, $2, $3) returning id", [
      W.tenantId,
      W.root,
      name,
    ])
  ).id;
/** 人を 1 人増やす。席は scope（無ければ新しいグループ＝ほかの試験の「グループに見せた条件」が見えない席）。W.g1 を渡せば営業の席 */
export const freshPerson = async (name = "新しい人", scope?: string) =>
  f.person(W.tenantId, scope ?? (await freshScope(`${name} の席`)), { name });
/** 保存した条件の数（消していない物・その人が作った物） */
export const viewsOf = (p: Person) =>
  num("select count(*) as n from saved_views where member_id = $1 and deleted_at is null", [p.id]);
export const viewRow = (id: string) => one("select * from saved_views where id = $1", [id]);

// ---- 口を叩く ----
export const listViews = (who: Person, q = "") =>
  f.req("GET", `/saved_views${q ? `?${q}` : ""}`, { headers: who.auth });
export const createView = (who: Person, body: unknown) => f.req("POST", "/saved_views", { body, headers: who.auth });
export const patchView = (who: Person, id: string, body: unknown) =>
  f.req("PATCH", `/saved_views/${id}`, { body, headers: who.auth });
export const deleteView = (who: Person, id: string) => f.req("DELETE", `/saved_views/${id}`, { headers: who.auth });
