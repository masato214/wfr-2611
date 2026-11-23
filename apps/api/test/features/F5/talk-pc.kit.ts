// 段 6「話す」の PC の側の口（K-760 会話の写し・取り戻す先／K-761 ブラウザの様子・仕事に付いたファイル）の試験が使う手助け（K-761 が持ち込む。K-760 が使う）。
//   土台は K-57・K-60 の apps/api/test/features/fixture.ts（本物の Postgres・本物の口の入口・本物の PC の印の解決）。
//   会社・人・PC・会話・仕事は DB に直に入れる（行の守りの外・admin）。口の登録は葉ごとの hooks のファイル
//   （apps/api/src/hooks/talk-mirror.ts・bridge-job-extra.ts の register・K-326）で、最初に叩くときに 1 回だけ読んで f.hooks に足す
//   （準備で読まない：実装の前の切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, vi } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { pairMemberForTest } from "../../bridge_pair.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");

export type { Person };
export type Json = Record<string, unknown> & { data?: unknown; meta?: Record<string, unknown>; code?: string };

/** 試験の会社 1 つ分。me の PC を呼ぶ。other は同じ会社の別の人・outsider は別の会社の人 */
export interface PcWorld {
  tenantId: string;
  scope: string;
  me: Person;
  other: Person;
  outsider: Person;
  outsiderScope: string;
}
export interface Pc {
  /** PC の印（x-bridge-session に載せる） */
  token: string;
  /** PC の行（sessions.id） */
  sid: string;
  owner: Person;
}
export type JobState = "queued" | "running" | "asking" | "done" | "stopped" | "cancelled";
export interface JobOpts {
  /** 会話（無ければ会話の無い仕事＝記憶のまとめ・チケットの仕事）。既定は無し */
  conversation?: string | null;
  state?: JobState;
  /** この仕事を受け取った PC（taken_session_id）。既定は無し（古い行＝その人のアカウントの PC のどれか） */
  takenBy?: Pc | null;
  agentSession?: string | null;
  browser?: string | null;
  /** 付けた資料（attachments の id） */
  attachmentIds?: string[];
  /** 作ったのが何日前か（取り戻す先は 14 日以内だけ） */
  ageDays?: number;
}

export interface PcKit {
  readonly f: Fixture;
  world: (label: string) => Promise<PcWorld>;
  /** その人の PC を 1 台つなぐ（K-57 の関門の関数）。revoked は外した後の印 */
  pc: (p: Person, o?: { revoked?: boolean }) => Promise<Pc>;
  /** 本人の自分の AI との会話を DB に直に 1 つ作る */
  conversation: (p: Person, o?: { deleted?: boolean }) => Promise<string>;
  /** 仕事を DB に直に 1 つ入れる（その人の仕事） */
  job: (w: PcWorld, p: Person, o?: JobOpts) => Promise<string>;
  /** 葉の hooks のファイル（拡張子なし）の register を 1 回だけ読んで足し、PC の口の上限を上げる。deps は口が使う材料の足し分（objects・config など） */
  load: (file: string, o?: { ops?: string[]; deps?: Record<string, unknown> }) => Promise<void>;
  /** PC の口を叩く（path は /api/v1 から） */
  call: (pc: { token: string } | null, method: string, path: string, body?: unknown) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  /** 数を 1 つ返す SQL（列の名前は n）を、行の守りの外で流す */
  count: (sql: string, p?: unknown[]) => Promise<number>;
  /** 1 行返す SQL を、行の守りの外で流す */
  row: <R = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R>;
  /** fn の間の console の出力を貯めて返す */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

/** 各試験のファイルの頭で 1 回呼ぶ */
export function setupPcKit(): PcKit {
  let f: Fixture;
  const loaded = new Map<string, Promise<void>>();

  beforeAll(async () => {
    f = await makeFixture([]);
  }, 60_000);
  afterAll(async () => {
    await f?.close();
  });

  const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;
  let seq = 0;

  const kit: PcKit = {
    get f() {
      return f;
    },
    world: async (label) => {
      const c = await f.company(`${label} ${Math.random().toString(36).slice(2, 7)}`, "EG");
      const o = await f.company(`${label} 別の会社 ${Math.random().toString(36).slice(2, 7)}`, "OT");
      const me = await f.person(c.tenantId, c.rootScope, { name: "高本 聖斗", ticketAbility: "edit" });
      const other = await f.person(c.tenantId, c.rootScope, { name: "佐藤 花子", ticketAbility: "edit" });
      const outsider = await f.person(o.tenantId, o.rootScope, { name: "鈴木 一郎", ticketAbility: "edit" });
      return { tenantId: c.tenantId, scope: c.rootScope, me, other, outsider, outsiderScope: o.rootScope };
    },
    pc: async (p, o = {}) => {
      seq += 1;
      const paired = await pairMemberForTest(f.admin, p.id, `試験の PC ${seq}`);
      if (o.revoked) await f.admin.query("update sessions set revoked_at = now() where id = $1", [paired.sid]);
      return { token: paired.token, sid: paired.sid, owner: p };
    },
    conversation: async (p, o = {}) => {
      const id = await one("select app.agent_new_conversation($1, false) as id", [p.id]);
      if (o.deleted) await f.admin.query("update conversations set deleted_at = now() where id = $1", [id]);
      return id;
    },
    job: async (w, p, o = {}) => {
      const state = o.state ?? "running";
      const scope = p.tenantId === w.tenantId ? w.scope : w.outsiderScope;
      return one(
        `insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, agent_session_id, browser,
                                  attachment_ids, taken_session_id, started_at, created_at, kind)
         values ($1, $2, $3, $4, $5, '（試験）', $6, $7, $8, $9,
                 case when $5 = 'queued' then null else now() end, now() - make_interval(days => $10), 'chat')
         returning id`,
        [
          p.tenantId,
          scope,
          p.id,
          o.conversation ?? null,
          state,
          o.agentSession ?? null,
          o.browser ?? null,
          o.attachmentIds ?? null,
          o.takenBy?.sid ?? null,
          o.ageDays ?? 0,
        ],
      );
    },
    load: (file, o = {}) => {
      let p = loaded.get(file);
      if (!p) {
        p = (async () => {
          const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
          Object.assign(f.hooks, m.register.make({ appPool: f.pool, ...(o.deps ?? {}) } as unknown as HookDeps));
          for (const op of o.ops ?? []) f.limits[op] = 100_000;
        })();
        loaded.set(file, p);
      }
      return p;
    },
    call: (pc, method, path, body) =>
      f.req(method, path, {
        ...(body === undefined ? {} : { body }),
        headers: pc ? { "x-bridge-session": pc.token } : {},
      }),
    json: async (r) => (await r.clone().json()) as Json,
    count: async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n),
    row: async <R>(sql: string, p: unknown[] = []) => (await f.admin.query(sql, p)).rows[0] as R,
    captureLogs: async (fn) => {
      const out: string[] = [];
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
        vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
      );
      try {
        await fn();
      } finally {
        for (const s of spies) s.mockRestore();
      }
      return out.join("\n");
    },
  };
  return kit;
}
