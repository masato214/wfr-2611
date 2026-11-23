// 段 8「知らせの口」（K-461 読む・K-462 既読・K-463 承認待ちの知らせ・K-464 止まった知らせ・K-465 外枠 getShell）の試験の共通の土台。
//   行（it）は葉ごとのファイル notifications-list.test.ts（K-461）・notifications-read.test.ts（K-462）・notify-approval.test.ts（K-463）・
//   notify-stopped.test.ts（K-464）・shell.test.ts（K-465）にある。土台は各ファイルの頭で setupNotify() を 1 回呼ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては段 1 の承認と完了の土台（F5/approve-complete.harness.ts・本物の Postgres・本物の口の入口・本物の PC の印・AI に任せる／PC の口）をそのまま使い、
//   その上に段 8 の口の振る舞い（葉ごとの hooks のファイル apps/api/src/hooks/notifications-*.ts・shell.ts の register・K-326）を足す。
//   口の振る舞いの読み込みは、試験の本体（it の中）の ready() で 1 回だけする（実装の前の切る段の smoke で、まだ無いファイルを準備で読んで
//   準備ごと落とさないため・準備の赤と本体の赤を分ける・answer=8f745003d023）。
//
// 試験が決める振る舞いの差し込み口（口の登録は葉ごとの hooks のファイル・K-326）:
//   apps/api/src/hooks/notifications-list.ts（K-461）・notifications-read.ts（K-462）・shell.ts（K-465）
//     export const register = defineHooks({ name, make: (d: HookDeps) => …, fuzz: "same" })
//   土台は在るファイルを全部読み、make に { appPool, repo, config } を渡す（知らせの口は預かり先・メール・PC の関門を使わない）。
//   あわせてチケットの一覧の口 listTickets（K-92・本物）を差す（外枠の件数と一覧の件数を見比べる K-465 の試験が使う）
//
// 知らせの行は、書き手（段 1〜9 の DB の関数・K-463・K-464 の引き金）を通さずに管理の接続で直に置く（notice）。
//   書き手の確かめは書き手の葉の試験（K-463・K-464 と、前の段の葉）が持つ。ここは「読む側」の入力を作るだけ。
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRepository } from "@kaname/db/repository";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Fixture, Person } from "../fixture.js";
import { auth, f, hooks, json, req, setupApproveComplete, T } from "../F5/approve-complete.harness.js";

export {
  ARTIFACT,
  approved,
  auth,
  boss,
  breakWritable,
  delegated,
  f,
  finish,
  hooks,
  jstDate,
  json,
  lastSeen,
  limits,
  manager,
  num,
  O,
  one,
  outsider,
  req,
  stageKeyOf,
  stageOf,
  take,
  team,
  ticket,
  T,
  viewer,
  writer,
} from "../F5/approve-complete.harness.js";
export type { Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
/** 口の振る舞いの在りか（試験の本体で読む） */
const HOOKS_DIR = join(HERE, "..", "..", "..", "src", "hooks");
const HOOK_FILE = /^(notifications-[a-z-]+|shell)\.ts$/;

/** 各試験のファイルの頭で 1 回呼ぶ。本物の DB・会社 2 つ・人 5 人は F5 の土台が立てる */
export function setupNotify(): void {
  setupApproveComplete();
}

let loaded = false;
/** 段 8 の口の振る舞いを読み込む（各 it の頭で呼ぶ。2 回目からは何もしない） */
export async function ready(): Promise<void> {
  if (loaded) return;
  const repo = await createRepository(f.pool);
  const d = { appPool: f.pool, repo, config: { env: "test" } } as unknown as HookDeps;
  for (const n of readdirSync(HOOKS_DIR)
    .filter((x) => HOOK_FILE.test(x))
    .sort()) {
    const m = (await import(join(HOOKS_DIR, n))) as { register: HookModule };
    Object.assign(hooks, m.register.make(d));
  }
  // 外枠の件数を一覧と見比べる試験（K-465）のため、チケットの一覧の口（K-92）も本物を差す（F5 の土台は入れていない）
  const lists = ticketHooks(f.pool);
  if (!hooks["listTickets"]) hooks["listTickets"] = lists["listTickets"]!;
  loaded = true;
}

/** 共有の試験 k144-contract.test.ts の土台（fixture.ts の Fixture）に、葉の hooks のファイル（apps/api/src/hooks/<file>.ts の register・K-326）を足す。
 *  葉ごとのファイル（contract/k144.d/K-461.ts・K-462.ts の setup）が自分のファイルの名前で 1 回ずつ呼ぶ。
 *  ファイルは最初の要求の前に 1 回だけ読む（準備で読まない・answer=8f745003d023） */
export function addNotifyLeafHooks(fx: Pick<Fixture, "pool" | "hooks" | "req">, file: string): void {
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    const repo = await createRepository(fx.pool);
    const d = {
      appPool: fx.pool,
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9)),
      config: { env: "test" },
    } as unknown as HookDeps;
    const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
    Object.assign(fx.hooks, m.register.make(d));
  };
  const base = fx.req;
  fx.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
}

let seq = 0;
/** 同じ会社（T）の新しい人（試験どうしで知らせの行を混ぜない）。ability は tickets の権限（既定 edit・null は何も無い） */
export const member = (
  name: string,
  o: { ability?: "edit" | "view" | null; co?: { tenantId: string; rootScope: string } } = {},
): Promise<Person> => {
  const co = o.co ?? T;
  return f.person(co.tenantId, co.rootScope, {
    name: `${name} ${++seq}`,
    ticketAbility: o.ability === undefined ? "edit" : o.ability,
  });
};

export interface NoticeOpt {
  /** event_kind_id（既定 ticket.assigned） */
  kind?: string;
  /** payload（既定は空の {}・チケットの種類は ticket_id・number・title を渡す） */
  payload?: Record<string, unknown>;
  /** 知らせを起こした人（created_by） */
  actor?: string | null;
  /** channel_id（既定 inapp） */
  channel?: string;
  /** 読んだ印：何日前に読んだか（null＝未読・既定） */
  readAgoDays?: number | null;
  /** 知らせができた時刻（既定は ageMin 分前） */
  createdAt?: Date;
  ageMin?: number;
  /** 消した行（deleted_at） */
  deleted?: boolean;
  /** 段 9 のメールの印（鈴は読まない・P1） */
  sentAt?: Date | null;
  failedAt?: Date | null;
}

/** 知らせの行を管理の接続で直に置く（行の守りの外）。返すのは行の id */
export async function notice(to: { id: string; tenantId: string }, o: NoticeOpt = {}): Promise<string> {
  const created = o.createdAt ?? new Date(Date.now() - (o.ageMin ?? 1) * 60_000);
  const readAt =
    o.readAgoDays === undefined || o.readAgoDays === null ? null : new Date(Date.now() - o.readAgoDays * 86_400_000);
  const r = await f.admin.query<{ id: string }>(
    `insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, failed_at, read_at, created_at, created_by, deleted_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
    [
      to.tenantId,
      to.id,
      o.channel ?? "inapp",
      o.kind ?? "ticket.assigned",
      JSON.stringify(o.payload ?? {}),
      `k8-${Date.now().toString(36)}-${++seq}`,
      o.sentAt ?? null,
      o.failedAt ?? null,
      readAt,
      created,
      o.actor ?? null,
      o.deleted ? new Date() : null,
    ],
  );
  return r.rows[0]!.id;
}

/** 知らせの行を管理の接続でそのまま読む */
export const rowOf = async (id: string): Promise<Record<string, unknown> | undefined> =>
  (await f.admin.query("select * from notifications where id = $1", [id])).rows[0];

/** チケットの種類の知らせの payload（題名と番号と id・チケットの種類は行き先がチケットなので要る） */
export const ticketPayload = (
  t: { id: string; number: string },
  title: string,
  extra: Record<string, unknown> = {},
) => ({
  ticket_id: t.id,
  number: t.number,
  title,
  ...extra,
});

const ctxOf = (p: { id: string; tenantId: string }): TenantContext => ({
  tenantId: p.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
/** 行の守りの中（kaname_app・その人の文脈）で SQL を流す。断られたら "denied"、それ以外は動いた行の数 */
export async function asApp(
  p: { id: string; tenantId: string },
  sql: string,
  params: unknown[] = [],
): Promise<number | "denied"> {
  try {
    return await withTenant(f.pool, ctxOf(p), async (cl) => (await cl.query(sql, params)).rowCount ?? 0);
  } catch (e) {
    if (/row-level security|permission denied/.test(String(e))) return "denied";
    throw e;
  }
}
/** 行の守りの中でその人が読める行（select の答え） */
export async function rowsAs<R = Record<string, unknown>>(
  p: { id: string; tenantId: string },
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  return withTenant(f.pool, ctxOf(p), async (cl) => (await cl.query(sql, params)).rows as R[]);
}

export type Item = {
  id: string;
  kind: string;
  tag: string;
  href: string | null;
  ticket_id: string | null;
  number: string | null;
  title: string | null;
  actor: { id: string; name: string } | null;
  params: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
};
export type Page = { data: Item[]; meta: { next_cursor: string | null; actors: { id: string; name: string }[] } };

/** 鈴の一覧を叩く（q は ? の後ろ） */
export const listNotices = (p: Person, q = "") => req("GET", `/notifications${q ? `?${q}` : ""}`, { headers: auth(p) });
/** 200 を確かめて答えを返す */
export async function pageOf(p: Person, q = ""): Promise<Page> {
  const r = await listNotices(p, q);
  if (r.status !== 200) throw new Error(`listNotifications が ${r.status}：${await r.clone().text()}`);
  return (await json(r)) as unknown as Page;
}

/** 管理の接続で、その人の鈴の行を全部消す（試験どうしで数えるものを混ぜない後片付け） */
export const clearNotices = (to: { id: string }) =>
  f.admin.query("delete from notifications where member_id = $1", [to.id]);
