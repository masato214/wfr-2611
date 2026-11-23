// 本文 1 枚の口（K-432 本文を書き終える／K-433 版を読む・戻す・項目の変更を比べる）の試験の共通の土台（2026-11-21 の作り直し）。
//   行（it）は葉ごとのファイル ticket-body-update.test.ts（K-432）・ticket-versions.test.ts（K-433）にある。
//   土台は各ファイルの頭で setupBody([自分の hooks のファイル名]) を 1 回呼ぶ（K-433 は K-432 のこの土台を使う）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては K-60・K-434 の土台と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口。画面のログインだけは偽。
//   チケットも本文の行も版の行も DB に直に入れる（チケットを作る口 createTicket は K-437 が作り直すので、この土台は作る口に依らない。準備は行の守りの外・admin）。
//   口の振る舞いは葉ごとの hooks のファイル apps/api/src/hooks/ticket-body.ts（K-432）・ticket-versions.ts（K-433）の register（K-326）。
//   最初の要求のときに 1 回だけ読む（準備で読まない：実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と 05_flow/screen_api.d/K-432.py・K-433.py で作る）:
//   updateTicketBody        PATCH /api/v1/tickets/:id/body                 200 { data: { version, changed, edited_at } }（K-432）
//   listTicketVersions      GET   /api/v1/tickets/:id/versions?from=&to=   200 { data: { versions, from, to }, meta: { limit, truncated } }（K-433）
//   restoreTicketVersion    POST  /api/v1/tickets/:id/versions/:v/restore  201 { data: { version, changed, edited_at } }（K-433）
//   listTicketItemChanges   GET   /api/v1/tickets/:id/item-changes?from=&to=  200 { data: { points, from, to, diff }, meta: { limit, truncated } }（K-433）
//   本文の行 = ticket_sections の section_key 'body'・position 0・body は { doc, text }・版は ticket_section_versions（追記だけ）
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, vi } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");

export type { Person };
export type Json = Record<string, unknown> & { data?: unknown; meta?: Record<string, unknown> };

/** 文書の木（ProseMirror の JSON。K-561 の型）。段落だけの文書を作る */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}
export interface Doc {
  type: "doc";
  content: DocNode[];
}
export const para = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
export const docOf = (...lines: string[]): Doc => ({ type: "doc", content: lines.map(para) });
export const EMPTY_DOC: Doc = { type: "doc", content: [] };
/** 行を足し合わせた text（段落だけの文書なら docToText と同じ。複雑な文書は docToText を使う） */
export const linesText = (...lines: string[]): string => lines.join("\n");

export interface BodyRow {
  version: number;
  position: number;
  body: { doc: Doc; text: string };
  deleted_at: string | null;
}
export interface VersionRow {
  version: number;
  body: { doc: Doc; text: string };
  edited_by: string | null;
  edited_by_clone: boolean;
  restored_from: number | null;
}
export interface MessageRow {
  id: string;
  kind: string;
  author_member_id: string | null;
  body: string | null;
  changes: { field: string; from: unknown; to: unknown; note?: string }[] | null;
}

export interface World {
  tenantId: string;
  rootScope: string;
  kindId: string;
  /** チケットを書ける人（グループの edit） */
  writer: Person;
  /** 担当者になる人（書く権限は無い） */
  assignee: Person;
  /** 読むだけの人 */
  viewer: Person;
  /** 別の会社の人 */
  outsider: Person;
}

export interface BodyHarness {
  readonly f: Fixture;
  call: (
    who: Person | null,
    method: string,
    path: string,
    o?: { body?: unknown; headers?: Record<string, string> },
  ) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  limit: (op: string, perMinute: number) => void;
  world: (label: string) => Promise<World>;
  /** チケットを DB に直に 1 件入れる（段は未着手）。assignee を省くと書ける人 */
  ticket: (w: World, o?: { assignee?: Person; title?: string }) => Promise<{ id: string; number: string }>;
  /**
   * 本文の行と版の行を DB に直に入れる。texts は版 1 から順の文書（最後が今の版）。
   * by は版ごとの書いた人（省くと w.writer）。clone を true にした版は edited_by_clone が立つ
   */
  seedBody: (
    ticketId: string,
    docs: Doc[],
    o?: { by?: (Person | null)[]; clone?: boolean[]; restoredFrom?: (number | null)[] },
  ) => Promise<void>;
  /** 前の形の区画の行を直に入れる（本文の行ではない。K-575 までは残っている物） */
  seedLegacySection: (ticketId: string, key: string, text: string) => Promise<void>;
  bodyRow: (ticketId: string) => Promise<BodyRow | undefined>;
  versionRows: (ticketId: string) => Promise<VersionRow[]>;
  /** やり取りの変更の行（kind change）を作った順に */
  messages: (ticketId: string) => Promise<MessageRow[]>;
  /** 項目の変更の行を直に入れる（段 7・8・5 の口が書く形と同じ：kind change・changes は {field, from, to}）。by が null なら AI */
  seedChange: (
    ticketId: string,
    changes: { field: string; from: unknown; to: unknown; note?: string; raw_from?: unknown; raw_to?: unknown }[],
    by: Person | null,
  ) => Promise<string>;
  finish: (ticketId: string) => Promise<void>;
  removeTicket: (ticketId: string) => Promise<void>;
  name: (p: Person) => Promise<string>;
  count: (sql: string, p?: unknown[]) => Promise<number>;
  audits: (
    tenantId: string,
    action: string,
    targetId?: string,
  ) => Promise<{ payload: Record<string, unknown>; choke_point_id: string }[]>;
  notifications: (tenantId: string) => Promise<number>;
  /** 指定の表に、その条件の行を書くとき失敗する引き金を入れる。返す関数で外す（finally で必ず呼ぶ） */
  breakInsert: (table: string, cond: string) => Promise<() => Promise<void>>;
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

/** 404・409 の答えの体は error と code だけ（field・details・detail を付けない＝在るかを漏らさない・控え帳 2026-11-21 01:15 K-385） */
export const bareKeys = (j: Record<string, unknown>): string[] => Object.keys(j).sort();
export const BARE = ["code", "error"];

export const OPS = ["updateTicketBody", "listTicketVersions", "restoreTicketVersion", "listTicketItemChanges"] as const;

/** 各試験のファイルの頭で 1 回呼ぶ。files は自分の葉の hooks のファイル名（拡張子なし）。例 ["ticket-body"] */
export function setupBody(files: readonly string[]): BodyHarness {
  let f: Fixture;
  let loading: Promise<void> | null = null;
  const ready = (): Promise<void> =>
    (loading ??= (async () => {
      for (const file of files) {
        const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
        Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
      }
    })());

  beforeAll(async () => {
    f = await makeFixture([]);
    for (const op of OPS) f.limits[op] = 100_000;
  }, 60_000);
  afterAll(async () => {
    await f?.close();
  });

  const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;
  const textOf = (d: Doc): string =>
    d.content.map((n) => (n.content ?? []).map((c) => c.text ?? "").join("")).join("\n");

  const h: BodyHarness = {
    get f() {
      return f;
    },
    call: async (who, method, path, o = {}) => {
      await ready();
      return f.req(method, path, {
        headers: { ...(who ? who.auth : {}), ...(o.headers ?? {}) },
        ...(o.body === undefined ? {} : { body: o.body }),
      });
    },
    json: async (r) => (await r.json()) as Json,
    limit: (op, perMinute) => {
      f.limits[op] = perMinute;
    },
    world: async (label) => {
      const c = await f.company(`${label} ${Math.random().toString(36).slice(2, 7)}`, "EG");
      const o = await f.company(`${label} 別 ${Math.random().toString(36).slice(2, 7)}`, "OT");
      const writer = await f.person(c.tenantId, c.rootScope, { name: "鈴木", ticketAbility: "edit" });
      const assignee = await f.person(c.tenantId, c.rootScope, { name: "佐藤", ticketAbility: "view" });
      const viewer = await f.person(c.tenantId, c.rootScope, { name: "見るだけの人", ticketAbility: "view" });
      const outsider = await f.person(o.tenantId, o.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
      const kindId = await one(
        "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
        [c.tenantId],
      );
      return { tenantId: c.tenantId, rootScope: c.rootScope, kindId, writer, assignee, viewer, outsider };
    },
    ticket: async (w, o = {}) => {
      const jst = new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
      const stage = await one(
        "select id from ticket_stages where tenant_id = $1 and key = 'todo' and deleted_at is null",
        [w.tenantId],
      );
      const r = await f.admin.query<{ id: string; number: string }>(
        `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, due_on, created_by, updated_by)
         values ($1, $2, '', $3, $4, $5, $6, $7, $8, $8) returning id, number`,
        [
          w.tenantId,
          w.rootScope,
          w.kindId,
          stage,
          o.title ?? "請求書を送る",
          (o.assignee ?? w.writer).id,
          jst,
          w.writer.id,
        ],
      );
      return { id: r.rows[0]!.id, number: r.rows[0]!.number };
    },
    seedBody: async (ticketId, docs, o = {}) => {
      const t = (
        await f.admin.query<{ tenant_id: string; created_by: string }>(
          "select tenant_id, created_by from tickets where id = $1",
          [ticketId],
        )
      ).rows[0]!;
      const last = docs[docs.length - 1]!;
      const sid = await one(
        `insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
         values ($1, $2, 'body', 0, $3::jsonb, $4, $5, $5) returning id`,
        [t.tenant_id, ticketId, JSON.stringify({ doc: last, text: textOf(last) }), docs.length, t.created_by],
      );
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i]!;
        const by = o.by && o.by[i] !== undefined ? o.by[i] : null;
        await f.admin.query(
          `insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_by_clone, restored_from, edited_at, created_by, updated_by)
           values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, now() - make_interval(secs => $9), $10, $10)`,
          [
            t.tenant_id,
            ticketId,
            sid,
            i + 1,
            JSON.stringify({ doc: d, text: textOf(d) }),
            by === null ? t.created_by : by.id,
            o.clone?.[i] ?? false,
            o.restoredFrom?.[i] ?? null,
            docs.length - i,
            t.created_by,
          ],
        );
      }
    },
    seedLegacySection: async (ticketId, key, text) => {
      const t = (
        await f.admin.query<{ tenant_id: string; created_by: string }>(
          "select tenant_id, created_by from tickets where id = $1",
          [ticketId],
        )
      ).rows[0]!;
      const sid = await one(
        `insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
         values ($1, $2, $3, 10, $4::jsonb, 1, $5, $5) returning id`,
        [t.tenant_id, ticketId, key, JSON.stringify({ text }), t.created_by],
      );
      await f.admin.query(
        `insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, created_by, updated_by)
         values ($1, $2, $3, 1, $4::jsonb, $5, $5, $5)`,
        [t.tenant_id, ticketId, sid, JSON.stringify({ text }), t.created_by],
      );
    },
    bodyRow: async (ticketId) =>
      (
        await f.admin.query<BodyRow>(
          "select version, position, body, deleted_at from ticket_sections where ticket_id = $1 and section_key = 'body'",
          [ticketId],
        )
      ).rows[0],
    versionRows: async (ticketId) =>
      (
        await f.admin.query<VersionRow>(
          `select v.version, v.body, v.edited_by, v.edited_by_clone, v.restored_from from ticket_section_versions v
             join ticket_sections s on s.id = v.section_id where s.ticket_id = $1 and s.section_key = 'body' order by v.version`,
          [ticketId],
        )
      ).rows,
    messages: async (ticketId) =>
      (
        await f.admin.query<MessageRow>(
          "select id, kind, author_member_id, body, changes from ticket_messages where ticket_id = $1 and kind = 'change' order by created_at, id",
          [ticketId],
        )
      ).rows,
    seedChange: async (ticketId, changes, by) => {
      const t = (
        await f.admin.query<{ tenant_id: string; created_by: string }>(
          "select tenant_id, created_by from tickets where id = $1",
          [ticketId],
        )
      ).rows[0]!;
      return one(
        `insert into ticket_messages (tenant_id, ticket_id, kind, author_member_id, body, changes, created_by, updated_by)
         values ($1, $2, 'change', $3, $4, $5::jsonb, $6, $6) returning id`,
        [t.tenant_id, ticketId, by?.id ?? null, "項目を変えました", JSON.stringify(changes), by?.id ?? t.created_by],
      );
    },
    finish: async (ticketId) => {
      await f.admin.query(
        `update tickets t set stage_id = s.id, completed_at = now(), completed_by = t.assignee_member_id
           from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = 'done'`,
        [ticketId],
      );
    },
    removeTicket: async (ticketId) => {
      await f.admin.query("update tickets set deleted_at = now() where id = $1", [ticketId]);
    },
    name: async (p) => (await f.admin.query<{ n: string }>("select app.member_name($1) as n", [p.id])).rows[0]!.n,
    count: async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n),
    audits: async (tenantId, action, targetId) =>
      (
        await f.admin.query<{ payload: Record<string, unknown>; choke_point_id: string }>(
          `select payload, choke_point_id from audit_events where tenant_id = $1 and action = $2 ${targetId ? "and target_id = $3" : ""} order by created_at, id`,
          targetId ? [tenantId, action, targetId] : [tenantId, action],
        )
      ).rows,
    notifications: async (tenantId) =>
      Number(
        (await f.admin.query<{ n: string }>("select count(*) as n from notifications where tenant_id = $1", [tenantId]))
          .rows[0]!.n,
      ),
    breakInsert: async (table, cond) => {
      const n = `k43x_${Math.random().toString(36).slice(2, 10)}`;
      await f.admin.query(
        `create or replace function public.${n}() returns trigger language plpgsql as $$ begin raise exception 'k43x 試験が起こした失敗' using errcode = 'XX000'; end $$`,
      );
      await f.admin.query(
        `create trigger ${n} before insert on ${table} for each row when (${cond}) execute function public.${n}()`,
      );
      return async () => {
        await f.admin.query(`drop trigger if exists ${n} on ${table}`);
        await f.admin.query(`drop function if exists public.${n}()`);
      };
    },
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
  return h;
}
