// 段 10「チケットの設定」の口（K-704 種別・K-705 状態・K-706 項目のマスタ）の単体の試験が使う手助け（K-704 が持ち込む。K-705・K-706・K-717 も carry で運ぶ）。
//   設計は 07_functional/段10-F9/土台-settings.md。口の登録は葉ごとの hooks のファイル（K-326）で、最初の要求のときに 1 回だけ読む（準備で読まない）。
//   準備の行は DB に直に入れる（行の守りの外・admin）。口を叩く人は「edit の権限を持つ人（管理者の束）」「持たない人」「別の会社の人」。
import { randomUUID } from "node:crypto";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import { leafHooks } from "../F3/leaf-hooks.js";
import { ticketHooks } from "../../../src/hooks/tickets.js";

export interface World {
  tenantId: string;
  rootScope: string;
  /** 設定の edit を持つ人（管理者の束と同じ：ticket_kinds・ticket_stages・custom_fields の edit） */
  admin: Person;
  /** チケットの設定の edit を持たない人（チケットは書ける） */
  member: Person;
}
export type Json = Record<string, unknown> & { data?: unknown };

export interface Settings {
  f: Fixture;
  world: (label: string) => Promise<World>;
  call: (who: Person | null, method: string, path: string, body?: unknown) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  one: (sql: string, p?: unknown[]) => Promise<string>;
  n: (sql: string, p?: unknown[]) => Promise<number>;
  kindId: (w: World, name: string) => Promise<string>;
  stageId: (w: World, key: string) => Promise<string>;
  newKind: (w: World, name: string, position?: number) => Promise<string>;
  ticket: (w: World, o?: { kindId?: string; stageId?: string; deleted?: boolean }) => Promise<string>;
  /** 書く口が落ちる準備：表（table）への挿入か更新で例外にする引き金を付け、返す関数で外す */
  breakWrites: (table: string) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "ticket-kinds-write"） */
export async function startSettings(hookFiles: readonly string[]): Promise<Settings> {
  const f = await makeFixture([ticketHooks]);
  leafHooks(f, hookFiles);
  const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
  const one: Settings["one"] = async (sql, p = []) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;
  const n: Settings["n"] = async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
  // 権限の種類は、その木に在る物だけを渡す（custom_fields は段 5 の K-563 の表。K-705 は段 5 に依存しないので、K-705 だけの木には無い）
  const grant = async (w: { tenantId: string }, member: string, kinds: readonly string[]) => {
    const have = (
      await f.admin.query<{ key: string }>("select key from target_kinds where key = any($1::text[])", [[...kinds]])
    ).rows.map((r) => r.key);
    await Promise.all(
      have.map((k) =>
        f.admin.query(
          "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, scope_id) values ($1, $2, $3, 'edit', null)",
          [w.tenantId, member, k],
        ),
      ),
    );
  };
  const world: Settings["world"] = async (label) => {
    const c = await f.company(`${label} ${Math.random().toString(36).slice(2, 7)}`, "EG");
    const admin = await f.person(c.tenantId, c.rootScope, { name: "管理者", ticketAbility: "edit" });
    await grant(c, admin.id, ["ticket_kinds", "ticket_stages", "custom_fields"]);
    const member = await f.person(c.tenantId, c.rootScope, { name: "メンバー", ticketAbility: "edit" });
    return { ...c, admin, member };
  };
  const call: Settings["call"] = (who, method, path, body) =>
    f.req(method, path, {
      headers: who ? who.auth : {},
      ...(body === undefined ? {} : { body }),
    });
  const kindId: Settings["kindId"] = (w, name) =>
    one("select id from ticket_kinds where tenant_id = $1 and name = $2 and deleted_at is null", [w.tenantId, name]);
  const stageId: Settings["stageId"] = (w, key) =>
    one("select id from ticket_stages where tenant_id = $1 and key = $2 and deleted_at is null", [w.tenantId, key]);
  const newKind: Settings["newKind"] = (w, name, position = 90) =>
    one("insert into ticket_kinds (tenant_id, name, position) values ($1, $2, $3) returning id", [
      w.tenantId,
      name,
      position,
    ]);
  const ticket: Settings["ticket"] = async (w, o = {}) =>
    one(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, updated_by, deleted_at)
       values ($1, $2, '', $3, $4, '請求書を送る', $5, $5, $5, $6) returning id`,
      [
        w.tenantId,
        w.rootScope,
        o.kindId ?? (await kindId(w, "タスク")),
        o.stageId ?? (await stageId(w, "todo")),
        w.member.id,
        o.deleted ? new Date().toISOString() : null,
      ],
    );
  const breakWrites: Settings["breakWrites"] = async (table) => {
    const fn = `test_break_${randomUUID().slice(0, 8)}`;
    await f.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$ begin raise exception '試験で壊した' using errcode = 'XX000'; end $$`,
    );
    await f.admin.query(
      `create trigger ${fn} before insert or update on ${table} for each row execute function ${fn}()`,
    );
    return async () => {
      await f.admin.query(`drop trigger if exists ${fn} on ${table}`);
      await f.admin.query(`drop function if exists ${fn}()`);
    };
  };
  return { f, world, call, json, one, n, kindId, stageId, newKind, ticket, breakWrites, close: () => f.close() };
}

/** 404・409 の体に、欄（field）と details を付けない（在るかを漏らさない・控え帳）ことを確かめる述語 */
export const isFlat = (b: Json): boolean => !("field" in b) && !("details" in b);
export const keysOf = (b: Json): string[] => Object.keys(b).sort();
