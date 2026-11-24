// 段 13「顧客が運営に問い合わせる」口（K-949 createInquiry・K-950 uploadInquiryAttachment と上げる先・K-951 listMyInquiries・getMyInquiry・
//   K-952 postInquiryMessage・resolveMyInquiry）の単体の試験の土台（K-949 が持ち込む・K-950〜K-952 も使う）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//   組み立ては段 1 の土台 fixture.ts（本物の DB・偽の画面のログイン）。葉の hooks のファイルは最初の要求のときに 1 回だけ読む
//   （準備で読まない：切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
//   hooks の材料は appPool・repo・objects・config.baseUrl（関門 C4 の置き場はこの土台が試験だけの一時のフォルダで作る）。
//   運営の返事・社内メモは、運営の葉（K-975）が入るまで DB に直に置く（opsReply）。作った会社・行は名前の頭（run）で見分ける
import { afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createRepository } from "@kaname/db/repository";
import type { Hono } from "hono";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
const UPLOAD_ROUTE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "src",
  "features",
  "F12",
  "inquiries",
  "upload-route.ts",
);

/** 試験の口の住所の頭（hooks の材料 config.baseUrl）。上げる先の upload_url はこの頭で始まる */
export const API_BASE = "http://api.k949.test";
export type Json = Record<string, unknown> & { data?: unknown };
export interface World {
  tenantId: string;
  rootScope: string;
  /** 問い合わせる人（R1〜R3 の側・偽のログインの role member） */
  asker: Person;
  /** 同じワークスペースの別の人（管理者の束を持つ・D-156.25 で他人の問い合わせは見えない） */
  admin: Person;
  /** 先方の権限の人（偽のログインの role client・D-156.16・D-156.26 で書けない） */
  guest: Person;
}
export interface AttachmentRow {
  name?: string;
  mime?: string;
  size?: number;
  /** 検査が済んで置き場に置いた（scanned_at と storage_ref がある） */
  checked?: boolean;
  /** もう問い合わせに付けた（owner_id がある） */
  used?: boolean;
  deleted?: boolean;
  /** 別の人の物にする */
  owner?: Person;
}

export interface Inquiries {
  f: Fixture;
  run: string;
  objects: ObjectStore;
  world: (label: string) => Promise<World>;
  call: (who: Person | null, method: string, path: string, body?: unknown) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  n: (sql: string, p?: unknown[]) => Promise<number>;
  row: <T = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<T | undefined>;
  /** 問い合わせ用の添付の行を DB に直に置く（K-950 の口を通さない）。id を返す */
  attachment: (who: Person, o?: AttachmentRow) => Promise<string>;
  /** 口で問い合わせを 1 つ作る（createInquiry）。答えの data を返す */
  ask: (who: Person, o?: { title?: string; body?: string; topic?: string; attachment_ids?: string[] }) => Promise<Json>;
  /** 運営の返事（kind reply）か社内メモ（note）を DB に直に置く。時刻は今から afterSec 秒（既定 1）。負なら今より前に置く。
   * 置いた後に口が now() を書いて比べる試験（読んだ印・やり取りの時刻）は、負にして返事を過去に置く（未来に置くと口の now() が返事より前になる） */
  opsReply: (
    inquiryId: string,
    body: string,
    o?: { note?: boolean; afterSec?: number; name?: string },
  ) => Promise<string>;
  /** 問い合わせの状態を DB で直に変える（運営の葉が入るまでの準備） */
  setState: (inquiryId: string, state: "open" | "waiting" | "later" | "done") => Promise<void>;
  /** 上げる先の受け口（K-950 の upload-route.ts）を最初に使う時に 1 回だけ作る */
  upload: () => Promise<Hono>;
  /** 書く口が落ちる準備：表（table）への挿入か更新で例外にする引き金を付け、返す関数で外す */
  /** 表への書き込みのうち、only に当たる行（この試験の行）だけを例外にする引き金を付け、返す関数で外す。
   *  only は { 列: 値 }（どれも等しい）か、NEW を使う SQL の式。表全体を落とさない（同じ DB のほかの試験を巻き込まない） */
  breakWrites: (table: string, only: string | Record<string, string>) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "inquiry-create"） */
export async function startInquiries(prefix: string, hookFiles: readonly string[]): Promise<Inquiries> {
  const f = await makeFixture();
  const run = `${prefix}-${Date.now().toString(36)}`;
  const repo = await createRepository(f.pool);
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k949-obj-"))), {
    signingSecret: "k949-test-files",
  });
  // 上げる先の住所の頭（config.baseUrl・口の住所）。試験だけの名前
  const deps = { appPool: f.pool, repo, objects, config: { baseUrl: API_BASE } } as unknown as HookDeps;
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    for (const file of hookFiles) {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      Object.assign(f.hooks, m.register.make(deps));
    }
  };
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
  const tenants: string[] = [];
  afterAll(async () => {
    if (!tenants.length) return;
    const t = [tenants];
    await f.admin.query(
      "delete from messages where conversation_id in (select conversation_id from inquiries where tenant_id = any($1::uuid[]))",
      t,
    );
    await f.admin.query("delete from attachments where tenant_id = any($1::uuid[]) and owner_type = 'inquiry'", t);
    await f.admin.query("delete from inquiries where tenant_id = any($1::uuid[])", t);
  });
  const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
  const n: Inquiries["n"] = async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
  const row: Inquiries["row"] = async (sql, p = []) => (await f.admin.query(sql, p)).rows[0];
  const world: Inquiries["world"] = async (label) => {
    const c = await f.company(`${run} ${label}`);
    tenants.push(c.tenantId);
    const asker = await f.person(c.tenantId, c.rootScope, { name: "田中" });
    const admin = await f.person(c.tenantId, c.rootScope, { name: "山口（管理者）", ticketAbility: "edit" });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, scope_id) select $1, $2, k, 'edit', null from unnest(array['inquiries','messages','attachments','conversations']) k",
      [c.tenantId, admin.id],
    );
    const guest = await f.person(c.tenantId, c.rootScope, { name: "先方の人", role: "client" });
    return { ...c, asker, admin, guest };
  };
  const call: Inquiries["call"] = (who, method, path, body) =>
    f.req(method, path, { headers: who ? who.auth : {}, ...(body === undefined ? {} : { body }) });
  const attachment: Inquiries["attachment"] = async (who, o = {}) => {
    const owner = o.owner ?? who;
    const scope = (await row<{ s: string }>("select scope_id as s from members where id = $1", [owner.id]))!.s;
    const id = randomUUID();
    const checked = o.checked ?? true;
    await f.admin.query(
      `insert into attachments (id, tenant_id, scope_id, owner_type, owner_id, storage_ref, mime, size, name, uploaded_by, scanned_at, deleted_at)
       values ($1, $2, $3, 'inquiry', $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        owner.tenantId,
        scope,
        o.used ? randomUUID() : null,
        checked ? `tenants/${owner.tenantId}/${randomUUID()}` : null,
        o.mime ?? "image/png",
        o.size ?? 2048,
        o.name ?? "画面の写し.png",
        owner.id,
        checked ? new Date().toISOString() : null,
        o.deleted ? new Date().toISOString() : null,
      ],
    );
    return id;
  };
  const ask: Inquiries["ask"] = async (who, o = {}) => {
    const r = await call(who, "POST", "/inquiries", {
      topic: o.topic ?? "trouble",
      title: o.title ?? "PC をつけているのに実行待ちのまま",
      body: o.body ?? "朝から実行待ちのままです",
      ...(o.attachment_ids ? { attachment_ids: o.attachment_ids } : {}),
    });
    const b = await json(r);
    if (r.status !== 201) throw new Error(`問い合わせを作れなかった（${r.status}）`);
    return b.data as Json;
  };
  const opsReply: Inquiries["opsReply"] = async (inquiryId, body, o = {}) => {
    const q = (await row<{ t: string; c: string }>(
      "select tenant_id as t, conversation_id as c from inquiries where id = $1",
      [inquiryId],
    ))!;
    const id = randomUUID();
    await f.admin.query(
      `insert into messages (id, tenant_id, conversation_id, sender_member_id, body, kind, visibility, author_name, created_at)
       values ($1, $2, $3, null, $4, $5, $6, $7, now() + make_interval(secs => $8))`,
      [
        id,
        q.t,
        q.c,
        body,
        o.note ? "inquiry_note" : "inquiry_reply",
        o.note ? "ops_only" : "all",
        o.name ?? "運営 佐藤",
        o.afterSec ?? 1,
      ],
    );
    if (!o.note)
      await f.admin.query(
        "update inquiries set state = 'waiting', last_message_at = now() + make_interval(secs => $2) where id = $1",
        [inquiryId, o.afterSec ?? 1],
      );
    return id;
  };
  const setState: Inquiries["setState"] = async (inquiryId, state) => {
    await f.admin.query("update inquiries set state = $2 where id = $1", [inquiryId, state]);
  };
  let uploadApp: Hono | null = null;
  const upload: Inquiries["upload"] = async () => {
    if (uploadApp) return uploadApp;
    const m = (await import(UPLOAD_ROUTE)) as { inquiryUploadRoute: (d: HookDeps) => Hono };
    uploadApp = m.inquiryUploadRoute(deps);
    return uploadApp;
  };
  const breakWrites: Inquiries["breakWrites"] = async (table, only) => {
    const fn = `test_break_${randomUUID().slice(0, 8)}`;
    const when =
      typeof only === "string"
        ? only
        : Object.entries(only)
            .map(([k, v]) => {
              if (!/^[a-z_]+$/.test(k)) throw new Error(`列の名前が違う: ${k}`);
              return `new.${k}::text = '${v.replaceAll("'", "''")}'`;
            })
            .join(" and ");
    await f.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$ begin if ${when} then raise exception '試験で壊した' using errcode = 'XX000'; end if; return new; end $$`,
    );
    await f.admin.query(
      `create trigger ${fn} before insert or update on ${table} for each row execute function ${fn}()`,
    );
    return async () => {
      await f.admin.query(`drop trigger if exists ${fn} on ${table}`);
      await f.admin.query(`drop function if exists ${fn}()`);
    };
  };
  return {
    f,
    run,
    objects,
    world,
    call,
    json,
    n,
    row,
    attachment,
    ask,
    opsReply,
    setState,
    upload,
    breakWrites,
    close: () => f.close(),
  };
}

/** 404・409 の体に、欄（field）と details を付けない（在るかを漏らさない・控え帳） */
export const isFlat = (b: Json): boolean => !("field" in b) && !("details" in b) && !("detail" in b);
/** MyInquiry の 7 欄（K-948 の「画面が使う答えの形」） */
export const MY_INQUIRY = ["created_at", "has_unread_reply", "id", "last_reply_at", "state", "title", "topic"];
/** MyInquiryMessage の 6 欄（K-948） */
export const MY_MESSAGE = ["attachments", "author_name", "body", "created_at", "from", "id"];
