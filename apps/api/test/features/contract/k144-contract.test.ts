// K-144「K-57・K-60 の口で、契約（openapi）と実際の振る舞いをそろえる」の単体の試験（口・本物の DB）。
// 名前の頭の行 ID（K144-API-…）は 11_tickets/K-144.md の表のマスに 1 対 1 で結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   答えを、作り手が契約から作った registry と zod で確かめる：状態コードは registry（packages/contracts/src/registry.ts の success・errors）、
//   成功の data の形は入口と同じ zod（packages/contracts/src/schemas.ts・z.strictObject。知らない欄も、null を許さない欄の null も赤）。
//   契約そのもの（openapi の additionalProperties・format: uuid・応答の並び）は scripts/ci/contract_shape_test.py が見る。
//   決まり（D-129.42）：uuid の欄は入口で正式な uuid の形を確かめ、違えば 422（欄の名前・理由 "uuid"）。中で 500 にしない。知らない項目も 422
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENDPOINTS } from "@kaname/contracts/registry";
import { SCHEMAS } from "@kaname/contracts/schemas";
import { s3Client, s3Presigner } from "@kaname/storage";
import { createApp } from "../../../src/app.js";
import { agentHooks } from "../../../src/hooks/agent.js";
import { approveHooks } from "../../../src/hooks/approve-complete.js"; // K-185：承認の口（K-161〜K-166）も同じ土台で叩く
import { delegateHooks } from "../../../src/hooks/delegate.js";
import { setupTaskHooks } from "../../../src/hooks/setup-tasks.js"; // K-250：はじめにやることの口も同じ土台で叩く
import { passkeysHooks } from "../../../src/hooks/passkeys.js"; // K-309：パスキーの名前を変える・外すの口も同じ土台で叩く
import type { Auth } from "@kaname/auth"; // K-309
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { FAKE_S3, startFakeS3 } from "../../fake-s3.js";
import { late, readK144Leaves } from "./k144-leaves.js"; // K-378：葉が足す分は置き場 k144.d の葉ごとのファイルから読む

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let writer: Person;
let mate: Person;
let task: { id: string };
/** PC の印（device の口を叩く。K-62 の口は PC の印で入る・D-128.163） */
let pcToken = "";

// 正式な uuid でない値（D-129.42）。前の口の正規表現（/^[0-9a-f-]{36}$/i）は 1・2 を通していた
const NOT_UUID = [
  "------------------------------------", // 1. 36 個のハイフン（前は通って、DB の ::uuid で落ちていた）
  "3fa85f64-5717-0562-b3fc-2c963f66afa6", // 2. 版の桁が 0（RFC 9562 の形でない）
  "", // 3. 空
  "not-a-uuid", // 4. 形が違う
  `${randomUUID()}0`, // 5. 長すぎる
];
// 表記ゆらぎ（入口の normalize が NFKC と前後の空白をそろえる）。同じ uuid として受ける
const fullWidth = (s: string) =>
  [...s].map((c) => (c === "-" ? "－" : String.fromCharCode(c.charCodeAt(0) + 0xfee0))).join("");

type Json = Record<string, unknown> & { data?: unknown; details?: { field: string; message: string }[] };
const json = async (r: Response) => (await r.clone().json()) as Json;
const def = (op: string) => {
  const d = ENDPOINTS.find((e) => e.operationId === op);
  if (!d) throw new Error(`registry に ${op} が無い`);
  return d;
};
/** 答えが契約どおりか：状態コードが契約の並びにあり、成功の data は契約の形（strict）に合う */
const conforms = async (op: string, r: Response) => {
  const d = def(op);
  const allowed = [d.success, ...d.errors];
  expect(allowed, `${op} が ${r.status} を返したが、契約の並び（${allowed.join(",")}）に無い`).toContain(r.status);
  const ct = r.headers.get("content-type") ?? "";
  if (r.status !== d.success || !ct.includes("application/json")) return;
  const schema = SCHEMAS[d.output!];
  expect(schema, `${op} の答えの形 ${d.output} が schemas に無い`).toBeDefined();
  const data = (await json(r)).data;
  const rows = d.outputList ? (data as unknown[]) : [data];
  for (const row of rows) {
    const p = schema!.safeParse(row);
    expect(
      p.success,
      `${op} の答えが契約の形 ${d.output} に合わない: ${JSON.stringify(p.error?.issues)} ${JSON.stringify(row)}`,
    ).toBe(true);
  }
};
const fields = (j: Json) => (j.details ?? []).map((x) => x.field);
const uuidReason = (j: Json, field: string) => (j.details ?? []).find((x) => x.field === field)?.message;
const count = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);

// PC をつなぐ（K-57）の小さな手順
const pair = async (p: Person) => {
  const r = await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth });
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await json(r)).data as { code: string }).code;
};
const claim = (code: string, extra: Record<string, unknown> = {}) =>
  f.req("POST", "/bridge/claim", { body: { code, device_label: "試験の PC", ...extra }, ip: nextIp() });
const claimOk = async (p: Person, extra: Record<string, unknown> = {}) => {
  const r = await claim(await pair(p), extra);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as { device_token: string; device_id: string };
};
const dev = (token: string) => ({ "x-bridge-session": token });
const newPerson = () => f.person(T.tenantId, T.rootScope, { name: "PC の人" });
const RELEASE = () => {
  const dir = mkdtempSync(join(tmpdir(), "k144-release-"));
  const bytes = Buffer.from("Kaname-Bridge の中身（K-144 の試験）");
  writeFileSync(join(dir, "Kaname-Bridge-1.4.0-arm64.dmg"), bytes);
  writeFileSync(join(dir, "Kaname-Bridge-1.4.0-arm64-mac.zip"), bytes);
  const file = (platform: string, kind: string, name: string) => ({
    platform,
    arch: "arm64",
    kind,
    name,
    sha256: "a".repeat(64),
    size: bytes.length,
  });
  writeFileSync(
    join(dir, "kaname-bridge.json"),
    JSON.stringify({
      version: "1.4.0",
      released_at: "2026-11-01T00:00:00Z",
      files: [
        file("mac", "installer", "Kaname-Bridge-1.4.0-arm64.dmg"),
        file("mac", "app", "Kaname-Bridge-1.4.0-arm64-mac.zip"),
      ],
    }),
  );
  return { dir, bytes };
};
const setRelease = (dir: string, base = "") => {
  f.release.dir = dir;
  f.release.base = base;
};

// チケットを作る（K-60）の小さな手順
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ticketBody = (extra: Record<string, unknown> = {}) => ({
  scope_id: T.rootScope,
  kind_id: task.id,
  title: "契約の形を確かめる",
  assignee_member_id: mate.id,
  due_on: jst(3),
  sections: { purpose: "目的", done: "完了の条件", todo: "実施事項" },
  ...extra,
});
const create = (b: unknown) => f.req("POST", "/tickets", { body: b, headers: writer.auth });
const saveDraft = (b: unknown) => f.req("POST", "/me/ticket-drafts", { body: b, headers: writer.auth });
const ticketsOf = () => count("select count(*) as n from tickets where tenant_id = $1", [T.tenantId]);
const draftsOf = () => count("select count(*) as n from app.ticket_drafts where member_id = $1", [writer.id]);

beforeAll(async () => {
  // 本物のサーバー（apps/api/src/server.ts）と同じ順：K-60 の工場の後に K-62 の工場（作った口の uuid の行を叩くため・K-62）
  // K-185 ここから：承認して完了する（K-63 の孫）の口も足す（作った口の uuid の行を叩くため）
  f = await makeFixture([ticketHooks, agentHooks, delegateHooks, approveHooks]);
  // K-185 ここまで
  // K-250 ここから：はじめにやることの口も足す（作った口の uuid の行 K144-API-058 を叩くため・土台の hooks は作った後に作り直さない）
  Object.assign(f.hooks, setupTaskHooks(f.pool));
  // K-250 ここまで
  // K-309 ここから：パスキーの名前を変える・外すの口も足す（作った口の uuid の行 K144-API-059・060 を叩くため）。
  //   偽の画面のログインはログインの部品のセッションを持たないので、部品の getSession は null（正しい uuid では 401 の道を回る）
  const noAuthSession = { api: { getSession: async () => null } } as unknown as Auth;
  Object.assign(f.hooks, passkeysHooks({ auth: noAuthSession, appPool: f.pool, authPool: f.pool }));
  // K-309 ここまで
  await LEAVES.setup(f); // K-378：葉の準備（自分の口の振る舞いを土台に足す）を番号の順に
  f.limits["createTicket"] = 10_000;
  f.limits["saveMyTicketDraft"] = 10_000;
  f.limits["createPairingCode"] = 10_000;
  f.limits["downloadBridgeRelease"] = 10_000;
  T = await f.company("K144 の会社", "KS");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  const kinds = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as {
    id: string;
    name: string;
  }[];
  task = kinds.find((k) => k.name === "タスク")!;
  // 書く人の PC をつなぐ（接続コード → 引き取り）。PC の口（device）の uuid の行を PC の印で叩く（K-62）
  const code = String(
    (
      (await json(await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: writer.auth }))).data as {
        code: string;
      }
    ).code,
  );
  const claimed = (
    await json(await f.req("POST", "/bridge/claim", { body: { code, device_label: "K144 の PC" }, ip: nextIp() }))
  ).data as { device_token: string };
  pcToken = claimed.device_token;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-144 ① 配布物の受け取り（downloadBridgeRelease）と新しい版（getLatestBridgeRelease）：返す答えが全部契約にある", () => {
  it("K144-API-001 配布物が無い（mac・win）：404・E-CONN-014。契約の 404 にある", async () => {
    setRelease("");
    const p = await newPerson();
    for (const os of ["mac", "win"]) {
      const r = await f.req("GET", `/bridge/releases/${os}/file`, { headers: p.auth });
      expect(r.status, os).toBe(404);
      expect((await json(r))["code"]).toBe("E-CONN-014");
      await conforms("downloadBridgeRelease", r);
    }
  });

  it("K144-API-002 目録に無い名前・置き場の外を指す名前：404・NOT_FOUND。契約の 404 にある", async () => {
    setRelease(RELEASE().dir);
    const p = await newPerson();
    for (const name of ["Other-1.0.0.dmg", "kaname-bridge.json", "..%2F..%2Fetc%2Fpasswd"]) {
      const r = await f.req("GET", `/bridge/releases/${name}/file`, { headers: p.auth });
      expect(r.status, name).toBe(404);
      expect((await json(r))["code"]).toBe("NOT_FOUND");
      await conforms("downloadBridgeRelease", r);
    }
  });

  it("K144-API-003 小文字だけの知らない名前（linux）：422・欄は name。契約の 422 にある", async () => {
    setRelease(RELEASE().dir);
    const p = await newPerson();
    const r = await f.req("GET", "/bridge/releases/linux/file", { headers: p.auth });
    expect(r.status).toBe(422);
    expect(fields(await json(r))).toContain("name");
    await conforms("downloadBridgeRelease", r);
  });

  it("K144-API-004 置き場に届かない：受け取るも新しい版も 503・E-PAGE-007。両方の契約に 503 がある（G-15：空を成功にしない）", async () => {
    setRelease("", "http://127.0.0.1:9/k144-unreachable");
    const p = await newPerson();
    const file = await f.req("GET", "/bridge/releases/mac/file", { headers: p.auth });
    expect(file.status).toBe(503);
    expect((await json(file))["code"]).toBe("E-PAGE-007");
    await conforms("downloadBridgeRelease", file);
    const latest = await f.req("GET", "/bridge/releases/latest", { headers: p.auth });
    expect(latest.status).toBe(503);
    expect((await json(latest))["code"]).toBe("E-PAGE-007");
    await conforms("getLatestBridgeRelease", latest);
  });

  it("K144-API-005 手元のフォルダの配布物：200 でファイルそのもの（application/octet-stream）。契約の 200 にその中身の形がある", async () => {
    const { dir, bytes } = RELEASE();
    setRelease(dir);
    const p = await newPerson();
    const r = await f.req("GET", "/bridge/releases/mac/file", { headers: p.auth });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type") ?? "").toContain("application/octet-stream");
    expect(Buffer.from(await r.arrayBuffer()).equals(bytes)).toBe(true);
    await conforms("downloadBridgeRelease", r);
  });

  it("K144-API-006 外の置き場の配布物：200 で期限つき URL（JSON）。契約の形 BridgeReleaseLink に合う", async () => {
    const { dir, bytes } = RELEASE();
    const fake = await startFakeS3();
    const client = s3Client({
      endpoint: fake.endpoint,
      region: FAKE_S3.region,
      bucket: "k144-bridge",
      accessKeyId: FAKE_S3.accessKeyId,
      secretAccessKey: FAKE_S3.secretAccessKey,
    });
    const prefix = `k144-${randomUUID()}`;
    fake.objects.set(`k144-bridge/${prefix}/kaname-bridge.json`, {
      body: readFileSync(join(dir, "kaname-bridge.json")),
      public: true,
    });
    fake.objects.set(`k144-bridge/${prefix}/Kaname-Bridge-1.4.0-arm64.dmg`, { body: bytes });
    f.signer.current = s3Presigner(client, fake.endpoint);
    try {
      setRelease("", `${fake.endpoint}/k144-bridge/${prefix}`);
      const p = await newPerson();
      const r = await f.req("GET", "/bridge/releases/mac/file", { headers: p.auth });
      expect(r.status, await r.clone().text()).toBe(200);
      await conforms("downloadBridgeRelease", r);
    } finally {
      f.signer.current = null;
      await fake.close();
    }
  });

  it("K144-API-007 新しい版：配っていない（released: false）・配っていて更新あり・配っていて OS／CPU が無い・違う値（update: null）。どれも契約の形 BridgeRelease に合う", async () => {
    const p = await newPerson();
    setRelease("");
    await conforms("getLatestBridgeRelease", await f.req("GET", "/bridge/releases/latest", { headers: p.auth }));
    setRelease(RELEASE().dir);
    const withUpdate = await f.req("GET", "/bridge/releases/latest?os=mac&arch=arm64", { headers: p.auth });
    expect(((await json(withUpdate)).data as { update: unknown }).update).not.toBeNull();
    await conforms("getLatestBridgeRelease", withUpdate);
    for (const q of ["", "?os=win&arch=x64", "?os=linux&arch=riscv"]) {
      const r = await f.req("GET", `/bridge/releases/latest${q}`, { headers: p.auth });
      expect(r.status, q).toBe(200);
      expect(((await json(r)).data as { update: unknown }).update, q).toBeNull();
      await conforms("getLatestBridgeRelease", r);
    }
  });
});

describe("K-144 ② 答えの null と欄：口が返す答えが契約の形（strict・null）に合う", () => {
  it("K144-API-008 チケットの種類の色が null（DB の列は null 可）：200 で color: null。契約の形 TicketKindChoice に合う", async () => {
    await f.admin.query(
      "insert into ticket_kinds (tenant_id, name, color, position) values ($1, '色の無い種類', null, 90)",
      [T.tenantId],
    );
    const r = await f.req("GET", "/ticket_kinds", { headers: writer.auth });
    expect(r.status).toBe(200);
    const kinds = (await json(r)).data as { name: string; color: unknown }[];
    expect(kinds.find((k) => k.name === "色の無い種類")?.color).toBeNull();
    await conforms("listTicketKinds", r);
  });

  it("K144-API-009 チケットの詳細：担当者がいない（assignee: null）ときも契約の形 TicketDetail に合う", async () => {
    const made = await create(ticketBody());
    expect(made.status, await made.clone().text()).toBe(201);
    await conforms("createTicket", made);
    const id = ((await json(made)).data as { id: string }).id;
    await conforms("getTicket", await f.req("GET", `/tickets/${id}`, { headers: writer.auth }));
    await f.admin.query("update tickets set assignee_member_id = null where id = $1", [id]);
    const r = await f.req("GET", `/tickets/${id}`, { headers: writer.auth });
    expect(r.status).toBe(200);
    expect(((await json(r)).data as { assignee: unknown }).assignee).toBeNull();
    await conforms("getTicket", r);
  });

  it("K144-API-010 PC の引き取り・生きている知らせ・端末の一覧（最初の知らせの前＝最後に見えた時刻と版が null）：どれも契約の形に合う。引き取りは PC の名前も返す", async () => {
    const p = await newPerson();
    const code = await pair(p);
    const c = await claim(code, { machine_id: randomUUID() });
    expect(c.status).toBe(201);
    expect(((await json(c)).data as { device_label: string }).device_label).toBe("試験の PC");
    await conforms("claimPairingCode", c);
    const token = ((await json(c)).data as { device_token: string }).device_token;
    const list0 = await f.req("GET", "/bridge/devices", { headers: p.auth });
    const waiting = (
      (await json(list0)).data as { last_seen_at: unknown; version: unknown; revoke_reason: unknown }[]
    )[0]!;
    expect(waiting.last_seen_at).toBeNull();
    expect(waiting.revoke_reason).toBeNull();
    await conforms("listMyDevices", list0);
    const beat = await f.req("POST", "/bridge/heartbeat", {
      body: { health: [], protocol: 4, version: "1.4.0" },
      headers: dev(token),
    });
    expect(beat.status).toBe(201);
    await conforms("sendHeartbeat", beat);
    await conforms("listMyDevices", await f.req("GET", "/bridge/devices", { headers: p.auth }));
  });

  it("K144-API-011 接続コードを出す：201 の答えが契約の形 PairingCode に合う", async () => {
    const p = await newPerson();
    await conforms("createPairingCode", await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth }));
  });

  it("K144-API-012 下書きを残す・一覧・捨てる（捨てた答えは body と saved_at が null）：答えが契約の形 TicketDraft に合う", async () => {
    const id = randomUUID();
    const s = await saveDraft({ draft_id: id, body: { title: "書きかけ" } });
    expect(s.status, await s.clone().text()).toBe(201);
    await conforms("saveMyTicketDraft", s);
    await conforms("listMyTicketDrafts", await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }));
    const gone = await saveDraft({ draft_id: id, discard: true });
    expect(gone.status, await gone.clone().text()).toBe(201);
    expect((await json(gone)).data).toMatchObject({ draft_id: id, body: null, saved_at: null });
    await conforms("saveMyTicketDraft", gone);
  });
});

describe("K-144 ③ 入力の知らない項目（D-129.42）：K-57・K-60 の体を受ける口は全部 422 で、何も書かない", () => {
  it("K144-API-013 接続コードを出す（体は空の形）に知らない項目：422。コードは増えない", async () => {
    const p = await newPerson();
    const before = await count("select count(*) as n from bridge_pairing_codes where member_id = $1", [p.id]);
    for (const extra of [{ member_id: p.id }, { code_hash: "x" }, { anything: 1 }]) {
      const r = await f.req("POST", "/bridge/pairing-codes", { body: extra, headers: p.auth });
      expect(r.status, JSON.stringify(extra)).toBe(422);
      await conforms("createPairingCode", r);
    }
    expect(await count("select count(*) as n from bridge_pairing_codes where member_id = $1", [p.id])).toBe(before);
  });

  it("K144-API-014 引き取り・生きている知らせ・チケットを作る・下書きを残すに知らない項目：422。PC・チケット・下書きは増えない", async () => {
    const p = await newPerson();
    const code = await pair(p);
    const c = await claim(code, { tenant_id: T.tenantId });
    expect(c.status).toBe(422);
    await conforms("claimPairingCode", c);
    expect((await claim(code)).status, "422 の後もコードは使える").toBe(201);
    const d = await claimOk(p);
    const beat = await f.req("POST", "/bridge/heartbeat", {
      body: { health: [], protocol: 4, version: "1.4.0", member_id: p.id },
      headers: dev(d.device_token),
    });
    expect(beat.status).toBe(422);
    await conforms("sendHeartbeat", beat);
    const tickets = await ticketsOf();
    const t = await create(ticketBody({ tenant_id: T.tenantId }));
    expect(t.status).toBe(422);
    await conforms("createTicket", t);
    expect(await ticketsOf()).toBe(tickets);
    const drafts = await draftsOf();
    const s = await saveDraft({ draft_id: randomUUID(), body: {}, member_id: mate.id });
    expect(s.status).toBe(422);
    await conforms("saveMyTicketDraft", s);
    expect(await draftsOf()).toBe(drafts);
  });
});

describe("K-144 ④ uuid の欄（D-129.42）：入口が正式な uuid の形を確かめ、違えば 422（欄の名前・理由 uuid）。500 にしない", () => {
  it("K144-API-015 下書きを残す：draft_id が uuid でない（36 個のハイフン・版の桁が 0・空・形違い・長すぎる）は 422・欄 draft_id。下書きは増えない", async () => {
    const drafts = await draftsOf();
    for (const v of NOT_UUID) {
      const r = await saveDraft({ draft_id: v, body: { title: "x" } });
      expect(r.status, JSON.stringify(v)).toBe(422);
      expect(fields(await json(r)), JSON.stringify(v)).toContain("draft_id");
      expect(uuidReason(await json(r), "draft_id"), JSON.stringify(v)).toBe("uuid");
      await conforms("saveMyTicketDraft", r);
    }
    expect(await draftsOf()).toBe(drafts);
  });

  it("K144-API-016 下書きを残す：draft_id の表記ゆらぎ（大文字・前後の空白・全角）は同じ uuid として受ける（201）", async () => {
    for (const make of [(u: string) => u.toUpperCase(), (u: string) => `  ${u}  `, fullWidth]) {
      const id = randomUUID();
      const r = await saveDraft({ draft_id: make(id), body: { title: "ゆらぎ" } });
      expect(r.status, await r.clone().text()).toBe(201);
      expect(String(((await json(r)).data as { draft_id: string }).draft_id).toLowerCase()).toBe(id);
      await conforms("saveMyTicketDraft", r);
    }
  });

  it("K144-API-017 チケットを作る：id の欄（グループ・種別・担当者・親・下書き・元の下書き）が uuid でないと 422・その欄。チケットは増えない", async () => {
    const tickets = await ticketsOf();
    for (const field of [
      "scope_id",
      "kind_id",
      "assignee_member_id",
      "parent_ticket_id",
      "draft_id",
      "source_draft_id",
    ]) {
      for (const v of NOT_UUID) {
        const r = await create(ticketBody({ [field]: v }));
        expect(r.status, `${field}=${JSON.stringify(v)}`).toBe(422);
        expect(fields(await json(r)), `${field}=${JSON.stringify(v)}`).toContain(field);
        await conforms("createTicket", r);
      }
    }
    expect(await ticketsOf()).toBe(tickets);
  });

  it("K144-API-018 チケットを作る：知らせる人の並びに uuid でない値が 1 つでもあると 422・欄は notify_member_ids の中。チケットは増えない", async () => {
    const tickets = await ticketsOf();
    const r = await create(ticketBody({ notify_member_ids: [mate.id, "------------------------------------"] }));
    expect(r.status).toBe(422);
    expect(fields(await json(r)).some((x) => x.startsWith("notify_member_ids"))).toBe(true);
    await conforms("createTicket", r);
    expect(await ticketsOf()).toBe(tickets);
  });

  it("K144-API-019 チケットを作る：無い親（正式な uuid）は 404・E-PAGE-001。契約の 404 にある", async () => {
    const r = await create(ticketBody({ parent_ticket_id: randomUUID() }));
    expect(r.status).toBe(404);
    expect((await json(r))["code"]).toBe("E-PAGE-001");
    await conforms("createTicket", r);
  });

  it("K144-API-020 PC の引き取り：machine_id が uuid でない（36 個のハイフン・版の桁が 0 ほか）は 422・欄 machine_id。コードは使い終わりにならない。大文字・null・送らないは受ける", async () => {
    const p = await newPerson();
    const code = await pair(p);
    for (const v of NOT_UUID) {
      const r = await claim(code, { machine_id: v });
      expect(r.status, JSON.stringify(v)).toBe(422);
      expect(fields(await json(r)), JSON.stringify(v)).toContain("machine_id");
      await conforms("claimPairingCode", r);
    }
    const m = randomUUID();
    const ok = await claim(code, { machine_id: m.toUpperCase() });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const sid = ((await json(ok)).data as { device_id: string }).device_id;
    expect(
      (await f.admin.query<{ machine_id: string }>("select machine_id from sessions where id = $1", [sid])).rows[0]!
        .machine_id,
    ).toBe(m);
    expect((await claim(await pair(p), { machine_id: null })).status).toBe(201);
    expect((await claim(await pair(p))).status).toBe(201);
  });

  it("K144-API-021 道の id（/tickets/{id}）と一覧の scope_id が uuid でない：422・欄 id／scope_id。404 や 500 にしない", async () => {
    for (const v of ["------------------------------------", "3fa85f64-5717-0562-b3fc-2c963f66afa6"]) {
      const r = await f.req("GET", `/tickets/${v}`, { headers: writer.auth });
      expect(r.status, v).toBe(422);
      expect(fields(await json(r)), v).toContain("id");
      await conforms("getTicket", r);
      const m = await f.req("GET", `/members?scope_id=${v}`, { headers: writer.auth });
      expect(m.status, v).toBe(422);
      expect(fields(await json(m)), v).toContain("scope_id");
      await conforms("listMembers", m);
    }
  });
});

// 入口の uuid の確かめ ⑫（回 3・R1 #9）：作った口ごとの、uuid の道の値と問い合わせ（registry の uuidParams）。
//   作った口＝hooks がある口か、表の素の読み書きで表がある口（apps/api/src/contract/op.ts の 501 の条件の外）。
//   この並びは scripts/ci/contract_shape_test.py の K144-SHAPE-017 が、契約から機械で出した「作った口 × uuid の値」と 1 対 1 で突き合わせる
export const UUID_PARAM_CASES = [
  ["K144-API-022", "getTicket", "path", "id"],
  ["K144-API-023", "updateConversation", "path", "id"],
  ["K144-API-024", "deleteConversation", "path", "id"],
  ["K144-API-025", "updateMemory", "path", "id"],
  ["K144-API-026", "listMembers", "query", "scope_id"],
  ["K144-API-027", "listScopes", "query", "layer_id"],
  ["K144-API-028", "listAuditEvents", "query", "member_id"],
  ["K144-API-029", "listAuditEvents", "query", "ticket_id"],
  // K-62 が作った口（PC の口は画面のセッションだと 403 だが、入口の uuid の確かめ（422）はその前・D-129.42）
  ["K144-API-046", "delegateTicket", "path", "id"],
  ["K144-API-047", "getActionRun", "path", "id"],
  ["K144-API-048", "listTicketRuns", "path", "id"],
  ["K144-API-049", "listTicketRuns", "query", "scope_id"],
  ["K144-API-050", "reportJobProgress", "path", "id"],
  ["K144-API-051", "getJobControl", "path", "id"],
  ["K144-API-052", "callKanameTool", "path", "id"],
  ["K144-API-053", "finishBridgeJob", "path", "id"],
  // 承認して完了する（K-63 の孫）の口。行ごとに、その口を作るチケットが試験のコミットで持ち込む（作っていない口の行は SHAPE_017 で赤・まとめて持ち込まない）・このコメントは先に入る K-185 が持つ // K-185
  ["K144-API-056", "getApproval", "path", "id"], // K-185（拾い方の直しと一緒に）
  ["K144-API-057", "approveApproval", "path", "id"], // K-185（拾い方の直しと一緒に）
  ["K144-API-054", "returnApproval", "path", "id"], // K-163
  ["K144-API-055", "completeTicket", "path", "id"], // K-165
  ["K144-API-058", "listSetupTasks", "query", "scope_id"], // K-250（一覧の口の問い合わせ scope_id）
  ["K144-API-059", "renamePasskey", "path", "id"], // K-309
  ["K144-API-060", "deletePasskey", "path", "id"], // K-309
] as const;
// まだ作っていない口（501）の代表：形の違う id は 422 が 501 より先（PM の決め 2026-11-08 09:22・D-129.42）
export const UNBUILT_UUID_CASE = ["answerAgentPermission", "path", "pid"] as const;
const BODIES: Record<string, unknown> = {
  updateConversation: { title: "名前" },
  updateMemory: { body: "覚えること" },
  // K-62 の口：必須の欄（REQUIRED_INPUTS）を入れて、正しい uuid では 422 にならない体（無い仕事・チケットは 404）
  reportJobProgress: { seq: 1, kind: "status", text: "見ています" },
  finishBridgeJob: { state: "stopped" },
  // 承認して完了する（K-63 の孫）：必須の欄を入れて、正しい uuid では 422 にならない体（無い承認・チケットは 404）・このコメントは先に入る K-185 が持つ // K-185
  returnApproval: { note: "直してください" }, // K-163
  completeTicket: { todo_checked: [], todo_version: 1, conditions_confirmed: true }, // K-165
  renamePasskey: { name: "仕事の Mac" }, // K-309
};
// K-378：これから口を作る葉は、上の並びと体に行を足さず、置き場 k144.d に K-<自分の番号>.ts を置く（試験を集める時に 1 回読む・重なりは読む所が止める）
const LEAVES = await readK144Leaves({ file: fileURLToPath(import.meta.url), UUID_PARAM_CASES, BODIES });
/** uuid でない道の値（:name など）の正しい値。callKanameTool の道具の名前は決まった名前だけ（PATH_PATTERNS・K-62） */
const OTHER_PATH: Record<string, string> = { name: "ticket_read" };
/** 頭で受ける値（HEADERS）。callKanameTool の道具の鍵は 32 字以上（合わない鍵は口が 403）・K-62 */
const OTHER_HEADERS: Record<string, Record<string, string>> = {
  callKanameTool: { "x-kaname-tool-token": "t".repeat(43) },
};
/** その口を、uuid の値 name を value にして叩く（ほかの道の値は正しい uuid） */
const hit = (op: string, where: "path" | "query", name: string, value: string) => {
  const d = def(op);
  let path = d.path.replace(/^\/api\/v1/, "");
  path = path.replace(/:(\w+)/g, (_m, p: string) =>
    where === "path" && p === name ? encodeURIComponent(value) : (OTHER_PATH[p] ?? randomUUID()),
  );
  if (where === "query") path += `?${name}=${encodeURIComponent(value)}`;
  const body = d.method === "GET" || d.method === "DELETE" ? undefined : (BODIES[op] ?? LEAVES.BODIES[op] ?? {});
  // PC の口（auth device）は PC の印で入る。画面のセッションだと役が合わず 403（入口の uuid の確かめより前・op.ts の順）
  const who = d.auth === "device" ? { "x-bridge-session": pcToken } : writer.auth;
  return f.req(d.method, path, {
    headers: { ...who, ...(OTHER_HEADERS[op] ?? {}) },
    ...(body === undefined ? {} : { body }),
  });
};

describe("K-144 ⑫ 入口が uuid の道の値と問い合わせを確かめる（registry の uuidParams・権限の確かめより前・D-129.42）", () => {
  for (const [row, op, where, name] of [...UUID_PARAM_CASES, ...LEAVES.UUID_PARAM_CASES]) {
    it(`${row} ${op} の ${where === "path" ? "道の値 :" : "問い合わせ ?"}${name}：uuid でない（36 個のハイフン・版の桁が 0）は 422・欄 ${name}・理由 uuid。正しい uuid は 422 にしない${where === "query" ? "・空の値は指定なし" : ""}`, async () => {
      expect(def(op).errors).toContain(422);
      for (const v of ["------------------------------------", "3fa85f64-5717-0562-b3fc-2c963f66afa6", "not-a-uuid"]) {
        const r = await hit(op, where, name, v);
        expect(r.status, `${op} ${name}=${v}`).toBe(422);
        expect(fields(await json(r)), `${op} ${name}=${v}`).toContain(name);
        expect(uuidReason(await json(r), name), `${op} ${name}=${v}`).toBe("uuid");
        await conforms(op, r);
      }
      const good = await hit(op, where, name, randomUUID());
      expect(good.status, `${op} ${name}=正しい uuid`).not.toBe(422);
      await conforms(op, good);
      if (where === "query") {
        const empty = await hit(op, where, name, "");
        expect(empty.status, `${op} ${name}=（空）`).not.toBe(422);
        await conforms(op, empty);
      }
    });
  }

  it("K144-API-030 listScopes の ?layer_id：空の値と正しい uuid は 200（絞り込みは K-92。入口は形だけを確かめる）", async () => {
    for (const v of ["", randomUUID()]) {
      const r = await f.req("GET", `/scopes?layer_id=${v}`, { headers: writer.auth });
      expect(r.status, JSON.stringify(v)).toBe(200);
      await conforms("listScopes", r);
    }
    const m = await f.req("GET", `/members?scope_id=${T.rootScope}`, { headers: writer.auth });
    expect(m.status).toBe(200);
    await conforms("listMembers", m);
  });

  it("K144-API-031 まだ作っていない口（answerAgentPermission の :pid）：形の違う id は 422 が 501 より先（欄 pid・理由 uuid）。正しい uuid なら 501", async () => {
    const [op, where, name] = UNBUILT_UUID_CASE;
    const bad = await hit(op, where, name, "------------------------------------");
    expect(bad.status).toBe(422);
    expect(fields(await json(bad))).toContain(name);
    expect(uuidReason(await json(bad), name)).toBe("uuid");
    const good = await hit(op, where, name, randomUUID());
    expect(good.status).toBe(501);
  });
});

describe("K-144 ⑬ 類 C（回 6）：入口がセッションを解けないとき、全部の口が 503・E-PAGE-003 で止まる。契約の 503 にある", () => {
  it("K144-API-032 セッションを解く所が落ちる（apps/api/src/middleware/tenant.ts → sessionUnresolved）：契約の全部の口（public も）が 503・E-PAGE-003。中の理由を出さず、振る舞い（hooks）に届かない。どの口の契約の並びにも 503 がある", async () => {
    let reached = 0;
    const hooks = Object.fromEntries(
      ENDPOINTS.map((e) => [
        e.operationId,
        {
          before: async () => {
            reached++;
            return { status: 418, body: {} };
          },
        },
      ]),
    );
    const app = createApp({
      version: "test",
      repo: {} as never, // セッションを解く所で止まるので、表には届かない
      resolve: async () => {
        throw new Error("K-144 の試験：セッションを解けない");
      },
      contract: { hooks },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bad: string[] = [];
    try {
      for (const e of ENDPOINTS) {
        const path = e.path.replace(/:(\w+)/g, (_, n: string) => (e.uuidParams.includes(n) ? randomUUID() : `x-${n}`));
        const r = await app.request(`http://localhost${path}`, {
          method: e.method,
          headers: { "content-type": "application/json", authorization: "Bearer k144" },
          ...(["POST", "PATCH", "PUT"].includes(e.method) ? { body: "{}" } : {}),
        });
        const text = await r.text();
        const code = (() => {
          try {
            return (JSON.parse(text) as { code?: string }).code;
          } catch {
            return undefined;
          }
        })();
        if (r.status !== 503 || code !== "E-PAGE-003")
          bad.push(`${e.operationId}：${r.status} ${code ?? text.slice(0, 40)}`);
        if (text.includes("K-144 の試験")) bad.push(`${e.operationId}：中の理由が答えに出た`);
        if (!e.errors.includes(503)) bad.push(`${e.operationId}：契約の並び（${e.errors.join(",")}）に 503 が無い`);
      }
    } finally {
      spy.mockRestore();
    }
    expect(bad).toEqual([]);
    expect(reached, "振る舞い（hooks）に届いた").toBe(0);
  });
});

// K-378：葉だけの試験（置き場 k144.d の葉のファイルの tests）を番号の順に並べる。準備で入る値は、葉が試験の中で読む時に取りに行く
LEAVES.tests({
  f: late(() => f),
  T: late(() => T),
  writer: late(() => writer),
  mate: late(() => mate),
  pcToken: () => pcToken,
  def,
  json,
  conforms,
  fields,
  uuidReason,
  count,
  hit,
});

// 類 E（回 9・Q5 回 8 追加-1）：口が「無い」ことで 422 にする欄（必須の欄）。契約の入力の形の required とちょうど同じ
//   （scripts/ci/contract_shape_test.py の K144-SHAPE-020 が、この表と契約の required と口の読み取りの表 REQUIRED_INPUTS を 1 対 1 で見る）。
//   試験の土台（K-57・K-60・会話と記憶の口）で動かせる口の全部。登録・確認・同意・本人確認の取り直しは、それぞれの試験（K51・K52・K53・two_factor）の土台で動く
export const REQUIRED_CASES = [
  ["claimPairingCode", ["code"]],
  ["saveMyTicketDraft", ["draft_id"]],
  ["createTicket", ["title", "scope_id", "kind_id", "assignee_member_id", "due_on"]],
  ["updateMemory", ["body"]],
  ["createPairingCode", []],
  ["createConversation", []],
  ["updateConversation", []],
  ["createMemory", []],
  ["returnApproval", ["note"]], // K-163（本物の承認待ちを別の会社に置いて叩く・下の fullBody）
] as const;
// 類 F（回 9・Q5 回 8 追加-2）：配布物の受け取りの道の値 name。true は契約の値域（pattern）に合う名前で、口は 422 にしない（mac・win・英小文字だけでない名前）。
//   false は合わない名前（mac・win 以外の英小文字だけ）で、口は 422・欄 name（K144-SHAPE-022 が、この並びと契約の pattern の判定を 1 対 1 で見る）
export const RELEASE_NAMES = [
  ["mac", true],
  ["win", true],
  ["MAC", true],
  ["mac1", true],
  ["Kaname-Bridge-1.4.0-arm64.dmg", true],
  ["kaname-bridge.json", true],
  ["Other-1.0.0.dmg", true],
  ["seed", false],
  ["linux", false],
  ["a", false],
  ["macwin", false],
] as const;

// K-163 ここから
/** K-163：差し戻しの必須の欄を本物の DB で確かめるための承認待ち（K-62 の作る段が終わった形）。
 *  チケットの数（ticketsOf）を数える会社 T とは別の会社に置く（K144-API-033 は T のチケットが増えないことを見る） */
let approvalCo: { tenantId: string; rootScope: string; who: Person } | null = null;
const approver = async () => {
  if (!approvalCo) {
    const co = await f.company("K144 の承認の会社", "KR");
    approvalCo = {
      ...co,
      who: await f.person(co.tenantId, co.rootScope, { name: "承認する人", ticketAbility: "edit" }),
    };
  }
  return approvalCo.who;
};
const pendingApproval = async () => {
  const who = await approver();
  const co = approvalCo!;
  const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;
  const stage = (key: string) =>
    one("select id from ticket_stages where tenant_id = $1 and key = $2", [co.tenantId, key]);
  const kind = await one(
    "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
    [co.tenantId],
  );
  const t = await one(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, delegated_to_clone)
     values ($1, $2, '', $3, $4, '差し戻しの必須の欄', $5, $5, true) returning id`,
    [co.tenantId, co.rootScope, kind, await stage("awaiting_approval"), who.id],
  );
  const job = await one(
    `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, result, started_at, finished_at)
     values ($1, $2, $3, 'ticket', 'done', '（作る段）', '成果物', now() - interval '2 minutes', now() - interval '1 minute') returning id`,
    [co.tenantId, co.rootScope, who.id],
  );
  const run = await one(
    `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, finished_at, created_by)
     values ($1, $2, $3, 'make', 'done', $4, now() - interval '2 minutes', now() - interval '1 minute', $5) returning id`,
    [co.tenantId, co.rootScope, t, job, who.id],
  );
  return one(
    `insert into approvals (tenant_id, scope_id, kind, ticket_id, action_run_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
     values ($1, $2, 'artifact', $3, $4, $5, $5, 'pending', true, '[]', $5) returning id`,
    [co.tenantId, co.rootScope, t, run, who.id],
  );
};
// K-163 ここまで

type Sent = { method: "POST" | "PATCH"; path: string; body: Record<string, unknown>; headers?: Record<string, string> };
/** 口ごとに、全部の欄を正しく埋めた体を作る（1 回ごとに新しく：接続コードは 1 回で使い終わり・下書きの id は毎回別） */
const fullBody = async (op: string): Promise<Sent> => {
  switch (op) {
    case "claimPairingCode":
      return {
        method: "POST",
        path: "/bridge/claim",
        body: { code: await pair(await newPerson()), device_label: "試験の PC", machine_id: randomUUID() },
      };
    case "saveMyTicketDraft":
      return {
        method: "POST",
        path: "/me/ticket-drafts",
        body: { draft_id: randomUUID(), body: { title: "下書き" }, discard: false },
        headers: writer.auth,
      };
    case "createTicket":
      return { method: "POST", path: "/tickets", body: ticketBody(), headers: writer.auth };
    case "updateMemory": {
      const m = await f.req("POST", "/memories", { body: {}, headers: writer.auth });
      expect(m.status, await m.clone().text()).toBe(201);
      const id = ((await json(m)).data as { id: string }).id;
      return {
        method: "PATCH",
        path: `/memories/${id}`,
        body: { title: "題", body: "覚えること" },
        headers: writer.auth,
      };
    }
    case "createPairingCode":
      return { method: "POST", path: "/bridge/pairing-codes", body: {}, headers: (await newPerson()).auth };
    case "createConversation":
      return { method: "POST", path: "/conversations", body: { incognito: false }, headers: writer.auth };
    case "updateConversation": {
      const c = await f.req("POST", "/conversations", { body: {}, headers: writer.auth });
      expect(c.status, await c.clone().text()).toBe(201);
      const id = ((await json(c)).data as { id: string }).id;
      return { method: "PATCH", path: `/conversations/${id}`, body: { title: "会話の名前" }, headers: writer.auth };
    }
    case "createMemory":
      return { method: "POST", path: "/memories", body: { title: "題" }, headers: writer.auth };
    // K-163 ここから
    case "returnApproval":
      return {
        method: "POST",
        path: `/approvals/${await pendingApproval()}/return`,
        body: { note: "直してください" },
        headers: (await approver()).auth,
      };
    // K-163 ここまで
    default:
      throw new Error(`REQUIRED_CASES の ${op} の体の作り方が無い`);
  }
};
const send = (s: Sent, body: Record<string, unknown>) =>
  f.req(s.method, s.path, { body, ...(s.headers ? { headers: s.headers } : {}), ip: nextIp() });
/** 状態コードが契約の並びにあるか（答えの中身の形は見ない：会話と記憶の口の成功の答えは表の行の形でない＝別の場所の前からのずれで、このチケットの外。報告に書いた） */
const statusInContract = (op: string, r: Response) => {
  const d = def(op);
  expect([d.success, ...d.errors], `${op} が ${r.status} を返したが、契約の並びに無い`).toContain(r.status);
};
const without = (b: Record<string, unknown>, k: string) =>
  Object.fromEntries(Object.entries(b).filter(([x]) => x !== k));

describe("K-144 ⑯ 類 E（回 9）：口が「無い」ことで 422 にする欄は契約の required とちょうど同じ", () => {
  beforeAll(() => {
    for (const op of [
      "claimPairingCode",
      "createConversation",
      "createMemory",
      "updateMemory",
      "updateConversation",
      "returnApproval", // K-163
    ])
      f.limits[op] = 10_000;
  });

  it("K144-API-033 体が {}：必須の欄がある口は 422 で、details の欄が必須の欄とちょうど同じ（チケット・下書きは増えない）。必須の欄が無い口は 422 にしない（成功の状態コード）", async () => {
    const t0 = await ticketsOf();
    const d0 = await draftsOf();
    for (const [op, req] of REQUIRED_CASES) {
      const s = await fullBody(op);
      const r = await send(s, {});
      statusInContract(op, r);
      if (req.length) {
        expect(r.status, `${op} {}`).toBe(422);
        expect(new Set(fields(await json(r))), `${op} {} の欄`).toEqual(new Set(req));
      } else {
        expect(r.status, `${op} {}：${await r.clone().text()}`).toBe(def(op).success);
      }
    }
    expect(await ticketsOf()).toBe(t0);
    expect(await draftsOf()).toBe(d0);
  });

  it("K144-API-034 正しい体から 1 欄ずつ抜く：必須の欄を抜くと 422・その欄の名前。必須でない欄を抜いても、その欄の名前で 422 にしない（契約の並びの答え）", async () => {
    const bad: string[] = [];
    for (const [op, req] of REQUIRED_CASES) {
      const keys = Object.keys((await fullBody(op)).body);
      for (const k of keys) {
        const s = await fullBody(op);
        const r = await send(s, without(s.body, k));
        statusInContract(op, r);
        const named = r.status === 422 && fields(await json(r)).includes(k);
        if ((req as readonly string[]).includes(k)) {
          if (!named)
            bad.push(`${op} から ${k} を抜いた：${r.status} ${await r.clone().text()}（422・欄 ${k} のはず）`);
        } else if (named) bad.push(`${op} から ${k} を抜いた：422・欄 ${k}（契約で必須でない）`);
      }
      // 全部埋めた体は通る（抜いた差だけを見ている確かめ）
      const s = await fullBody(op);
      const ok = await send(s, s.body);
      if (ok.status !== def(op).success) bad.push(`${op} の正しい体：${ok.status} ${await ok.clone().text()}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("K-144 ⑰ 類 F（回 9）：配布物の受け取りの道の値 name の値域が、口の答えと契約で同じ", () => {
  it("K144-API-035 契約の値域に合う名前（mac・win・英小文字だけでない名前）は 422 にしない（200・404 のどれか）。合わない名前（seed・linux ほか英小文字だけ）は 422・欄 name", async () => {
    setRelease(RELEASE().dir);
    const p = await newPerson();
    const bad: string[] = [];
    for (const [name, fits] of RELEASE_NAMES) {
      const r = await f.req("GET", `/bridge/releases/${encodeURIComponent(name)}/file`, { headers: p.auth });
      await conforms("downloadBridgeRelease", r);
      const is422 = r.status === 422;
      if (fits && is422) bad.push(`${name}：契約に合うのに 422`);
      if (!fits && !(is422 && fields(await json(r)).includes("name")))
        bad.push(`${name}：契約に合わないのに ${r.status}`);
    }
    expect(bad).toEqual([]);
  });
});

// 類 G（回 9 の続き・PM の判断 2026-11-09）：契約に書ける体の値の値域。値ごとに、口がその欄で 422 にするか（false）しないか（true）。
//   scripts/ci/contract_shape_test.py の K144-SHAPE-023 が、同じ値を契約の欄の形（VALUE_RANGES）で判定して 1 対 1 で見る。
//   @today は今日（日本時間）、@code:* は本物の接続コードの書き方（そのまま・小文字・全角・区切りと前後の空白）。1 行 1 値（形の試験が行で読む）
type RangeCase = readonly [string, string, unknown, boolean];
// prettier-ignore
export const RANGE_CASES: RangeCase[] = [
  ["createTicket", "title", "題", true],
  ["createTicket", "title", "", false],
  ["createTicket", "title", "   ", false],
  ["createTicket", "title", "x".repeat(200), true],
  ["createTicket", "title", "x".repeat(201), false],
  ["createTicket", "due_on", "2099-12-31", true],
  ["createTicket", "due_on", "2099/12/31", false],
  ["createTicket", "due_on", "", false],
  ["createTicket", "start_on", "", true],
  ["createTicket", "start_on", "@today", true],
  ["createTicket", "start_on", "2026/01/01", false],
  ["createTicket", "priority", "", true],
  ["createTicket", "priority", "mid", true],
  ["createTicket", "priority", "high", true],
  ["createTicket", "priority", "low", false],
  ["createTicket", "estimate_minutes", 0, true],
  ["createTicket", "estimate_minutes", 100000, true],
  ["createTicket", "estimate_minutes", 100001, false],
  ["createTicket", "estimate_minutes", -1, false],
  ["createTicket", "estimate_minutes", "120", true],
  ["createTicket", "estimate_minutes", "100001", false],
  ["createTicket", "estimate_minutes", "", true],
  ["createTicket", "estimate_minutes", null, true],
  ["createTicket", "estimate_minutes", 1.5, false],
  ["createTicket", "estimate_minutes", "1.5", false],
  ["createTicket", "estimate_minutes", true, false],
  ["createTicket", "sections", {"purpose": "目的", "done": "完了", "todo": "実施"}, true],
  ["createTicket", "sections", {"purpose": "目的", "done": "完了", "todo": "実施", "Bad": "a"}, false],
  ["createTicket", "notify_member_ids", [], true],
  ["createTicket", "notify_member_ids", Array.from({ length: 21 }, () => randomUUID()), false],
  ["claimPairingCode", "code", "@code:plain", true],
  ["claimPairingCode", "code", "@code:lower", true],
  ["claimPairingCode", "code", "@code:fullwidth", true],
  ["claimPairingCode", "code", "@code:spaced", true],
  ["claimPairingCode", "code", "", false],
  ["claimPairingCode", "code", "ABCDE", false],
  ["claimPairingCode", "code", "ABCDEFG", false],
  ["claimPairingCode", "code", "ABC10O", false],
  ["claimPairingCode", "code", "x".repeat(33), false],
  ["updateConversation", "title", "名前", true],
  ["updateConversation", "title", "   ", false],
  ["updateConversation", "title", "a\nb", true],
  ["updateMemory", "body", "覚える", true],
  ["updateMemory", "body", "  ", false],
  ["createMemory", "confidence", "9.99", true],
  ["createMemory", "confidence", "0", true],
  ["createMemory", "confidence", "-9.5", true],
  ["createMemory", "confidence", "10", false],
  ["createMemory", "confidence", "99", false],
  ["createMemory", "confidence", "abc", false],
];
/** その欄で 422 にしたか（表の素の書き込み createMemory は DB の答えを欄 body で返す） */
const rejects = async (op: string, field: string, r: Response) =>
  r.status === 422 &&
  fields(await json(r)).some(
    (x) => x === field || x.startsWith(`${field}.`) || (op === "createMemory" && x === "body"),
  );
const valueOf = (v: unknown, code: string): unknown => {
  if (v === "@today") return jst(0);
  if (v === "@code:plain") return code;
  if (v === "@code:lower") return code.toLowerCase();
  if (v === "@code:fullwidth") return fullWidth(code);
  if (v === "@code:spaced") return ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3).toLowerCase()} `;
  return v;
};

describe("K-144 ⑱ 類 G（回 9 の続き）：契約に書ける体の値の値域が、口の答えと同じ", () => {
  beforeAll(() => {
    for (const op of [
      "createTicket",
      "claimPairingCode",
      "createPairingCode",
      "createConversation",
      "updateConversation",
      "createMemory",
      "updateMemory",
    ])
      f.limits[op] = 10_000;
  });

  it("K144-API-039 RANGE_CASES の値ごとに、口はその欄で 422 にする（契約に合わない値）か、しない（合う値）。答えは契約の並び", async () => {
    const bad: string[] = [];
    for (const [op, field, v, fits] of RANGE_CASES) {
      const s = await fullBody(op);
      const code = typeof s.body["code"] === "string" ? (s.body["code"] as string) : "ABC234";
      const value = valueOf(v, code);
      const r = await send(s, { ...s.body, [field]: value });
      statusInContract(op, r);
      const no = await rejects(op, field, r);
      if (fits && no)
        bad.push(
          `${op}.${field}=${JSON.stringify(value).slice(0, 40)}：契約に合うのに 422（${await r.clone().text()}）`,
        );
      if (!fits && !no)
        bad.push(`${op}.${field}=${JSON.stringify(value).slice(0, 40)}：契約に合わないのに ${r.status}`);
    }
    expect(bad).toEqual([]);
  });

  it("K144-API-038 表の素の書き込み（createMemory）の確かさ confidence が DB の桁（numeric(3,2)）を超える：500 にせず 422・欄 body。記憶は増えない。9.99 は 201", async () => {
    const n = () => count("select count(*) as n from memories where tenant_id = $1", [T.tenantId]);
    const before = await n();
    for (const c of ["10", "99", "-9.999", "123.45"]) {
      const r = await f.req("POST", "/memories", { body: { title: "確かさ", confidence: c }, headers: writer.auth });
      statusInContract("createMemory", r);
      expect(r.status, `${c}：${await r.clone().text()}`).toBe(422);
      expect(fields(await json(r))).toContain("body");
    }
    expect(await n()).toBe(before);
    const ok = await f.req("POST", "/memories", {
      body: { title: "確かさ", confidence: "9.99" },
      headers: writer.auth,
    });
    expect(ok.status).toBe(201);
  });
});

describe("K-144 ⑲ 会話と記憶の口の成功の答え（回 9 の続き・類 C/D）：口が返すとおりの形が契約にある", () => {
  it("K144-API-037 会話を作る・名前を変える・記憶を直す・会話を消す・記憶を作るの成功の答えが、契約の形（strict）に合う", async () => {
    const c = await f.req("POST", "/conversations", { body: {}, headers: writer.auth });
    expect(c.status).toBe(201);
    await conforms("createConversation", c);
    const id = ((await json(c)).data as { id: string }).id;
    const u = await f.req("PATCH", `/conversations/${id}`, { body: { title: "会話の名前" }, headers: writer.auth });
    expect(u.status).toBe(200);
    await conforms("updateConversation", u);
    const m = await f.req("POST", "/memories", { body: { title: "題" }, headers: writer.auth });
    expect(m.status).toBe(201);
    await conforms("createMemory", m);
    const mid = ((await json(m)).data as { id: string }).id;
    const um = await f.req("PATCH", `/memories/${mid}`, { body: { body: "覚えること" }, headers: writer.auth });
    expect(um.status).toBe(200);
    await conforms("updateMemory", um);
    const d = await f.req("DELETE", `/conversations/${id}`, { headers: writer.auth });
    expect(d.status).toBe(200);
    await conforms("deleteConversation", d);
  });
});

describe("K-144 ⑳ セッションの人がその会社のメンバーでない（回 9 の続き・類 C）：作った口が契約に無い 500 を返さない", () => {
  it("K144-API-036 別の会社のメンバー・無い人のセッション（入口の解決は通る）で作った口を全部呼ぶ：どれも契約の並びの答え。接続コードを出す口は 403・FORBIDDEN でコードを作らない（前は DB の app.people_same_tenant が 22023 を上げて 500）", async () => {
    const other = await f.company("K144 の別の会社", "KO");
    const stranger = await f.person(other.tenantId, other.rootScope, { name: "別の会社の人" });
    const cols = JSON.parse(readFileSync("08_api/db-columns.json", "utf8")) as {
      tables: Record<string, Record<string, unknown>>;
    };
    const built = ENDPOINTS.filter(
      (e) => f.hooks[e.operationId] || (e.generic && "id" in (cols.tables[e.table] ?? {})),
    );
    expect(built.map((e) => e.operationId)).toContain("createPairingCode");
    const codes = () => count("select count(*) as n from bridge_pairing_codes where tenant_id = $1", [T.tenantId]);
    const before = await codes();
    const bad: string[] = [];
    for (const [label, who] of [
      ["別の会社のメンバー", stranger.id],
      ["無い人", randomUUID()],
    ] as const) {
      const headers = { authorization: `Bearer fake:member:${T.tenantId}:${who}` };
      for (const e of built) {
        f.limits[e.operationId] = 10_000;
        const path = e.path
          .replace(/^\/api\/v1/, "")
          .replace(/:(\w+)/g, (_, n: string) => (e.uuidParams.includes(n) ? randomUUID() : "mac"));
        const r = await f.req(e.method, path, {
          headers,
          ...(["POST", "PATCH", "PUT"].includes(e.method) ? { body: {} } : {}),
        });
        if (![e.success, ...e.errors].includes(r.status))
          bad.push(`${label} ${e.operationId}：${r.status}（契約の並び ${[e.success, ...e.errors].join(",")}）`);
        if (e.operationId === "createPairingCode") {
          const j = await json(r);
          if (JSON.stringify(j).includes("その会社のメンバーの行だけ"))
            bad.push(`${label} createPairingCode：答えに DB の文が出た`);
          if (r.status !== 403 || j["code"] !== "FORBIDDEN")
            bad.push(`${label} createPairingCode：${r.status} ${String(j["code"])}（403・FORBIDDEN のはず）`);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(await codes(), "接続コードを作った").toBe(before);
  });
});

describe("K-144 ㉑ 長さの数え方（精査 R1 回 10 追加-2・D-130.1）：欄ごとの上限はコードポイントで数え、自由に書く欄に上限は無い", () => {
  beforeAll(() => {
    for (const op of ["createTicket", "claimPairingCode", "createPairingCode"]) f.limits[op] = 10_000;
  });

  it("K144-API-040 4 バイトの字（😀）で欄ごとの上限ちょうどは通り、上限＋1 は 422（題名 200）。自由に書く欄（priority_reason・区画）は上限が無く、10001 字・20001 字・50000 字でも 422 にしない（D-130.1・D-130.3）。接続コードは 32 字を超えるときだけ「長すぎます」", async () => {
    const E = "😀";
    const bad: string[] = [];
    const sentTicket = async (extra: Record<string, unknown>) => create(ticketBody(extra));
    const named = async (r: Response, field: string) =>
      r.status === 422 && fields(await json(r)).some((x) => x === field || x.startsWith(`${field}.`));
    for (const [label, extra, field, ok] of [
      ["区画 20000 字", { sections: { purpose: E.repeat(20000), done: "完了", todo: "実施" } }, "sections", true],
      [
        "区画 20001 字（D-130.3 で上限を外した）",
        { sections: { purpose: E.repeat(20001), done: "完了", todo: "実施" } },
        "sections",
        true,
      ],
      [
        "区画 50000 字（D-130.3）",
        { sections: { purpose: "あ".repeat(50000), done: "完了", todo: "実施" } },
        "sections",
        true,
      ],
      ["自由に書く欄 10001 字（😀）", { priority_reason: E.repeat(10001) }, "priority_reason", true],
      ["自由に書く欄 50000 字", { priority_reason: "あ".repeat(50000) }, "priority_reason", true],
      ["題名 200 字", { title: E.repeat(200) }, "title", true],
      ["題名 201 字", { title: E.repeat(201) }, "title", false],
    ] as const) {
      const r = await sentTicket(extra);
      statusInContract("createTicket", r);
      const no = await named(r, field);
      if (ok && no) bad.push(`${label}：422（${await r.clone().text()}）`);
      if (!ok && !no) bad.push(`${label}：${r.status}（422・欄 ${field} のはず）`);
    }
    for (const [n, message] of [
      [17, "接続コードは英数字 6 けたです"],
      [33, "接続コードが長すぎます（英数字 6 けた）"],
    ] as const) {
      const r = await claim(E.repeat(n));
      statusInContract("claimPairingCode", r);
      const d = (await json(r)).details ?? [];
      if (r.status !== 422 || d.find((x) => x.field === "code")?.message !== message)
        bad.push(`接続コード ${n} 字：${r.status} ${JSON.stringify(d)}（${message} のはず）`);
    }
    expect(bad).toEqual([]);
  });
});

describe("K-144 ㉒ DB の答えを外に出さない（PM の判断 2026-11-09・op.ts の表の素の書き込みの 422）", () => {
  it("K144-API-041 外部キー（23503）・形（22P02）・桁あふれ（22003）・check 違反（23514）の 422 は、どれも決まった文「入力内容を確認してください」（D-130.2）で、DB の文・表や制約の名前を答えに出さない。DB の答えの番号（23514 は制約の名前も）はログにだけ残す（文はログにも出さない＝K144-API-045）", async () => {
    f.limits["createMemory"] = 10_000;
    await f.admin.query(
      "alter table memories add constraint k144_test_ck check (coalesce(title, '') <> 'k144-check') not valid",
    );
    const logs: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
      logs.push(
        a
          .map((x) => (x instanceof Error ? `${x.message} ${(x as { code?: string }).code ?? ""}` : String(x)))
          .join(" "),
      );
    });
    const messages: string[] = [];
    const bad: string[] = [];
    try {
      for (const [pg, body, mark] of [
        ["23503", { kind_id: "k144-無い種類" }, "kind_id"],
        ["22P02", { confidence: "abc" }, "abc"],
        ["22003", { confidence: "10" }, "numeric"],
        ["23514", { title: "k144-check" }, "k144_test_ck"],
      ] as const) {
        const before = logs.length;
        const r = await f.req("POST", "/memories", { body, headers: writer.auth });
        const text = await r.clone().text();
        if (r.status !== 422) bad.push(`${pg}：${r.status} ${text}`);
        const d = (await json(r)).details ?? [];
        const m = d.find((x) => x.field === "body")?.message ?? "";
        messages.push(m);
        for (const leak of [
          "violates",
          "constraint",
          "foreign key",
          "invalid input",
          "numeric",
          "memories",
          "kind_id",
          "k144_test_ck",
          "syntax",
          "overflow",
          "fkey",
          "_ck",
        ])
          if (text.includes(leak)) bad.push(`${pg}：答えに「${leak}」が出た（${text.slice(0, 120)}）`);
        const logged = logs.slice(before).join("\n");
        if (!logged.includes(pg)) bad.push(`${pg}：ログに DB の答え（${pg}）が残っていない`);
        if (pg === "23514" && !logged.includes(mark)) bad.push(`23514：ログに制約の名前（${mark}）が残っていない`);
      }
    } finally {
      spy.mockRestore();
      await f.admin.query("alter table memories drop constraint if exists k144_test_ck");
    }
    expect(bad).toEqual([]);
    expect(new Set(messages).size, `答えの文がそろっていない：${JSON.stringify(messages)}`).toBe(1);
    expect(messages[0]).toBe("入力内容を確認してください"); // D-130.2
  });

  it("K144-API-045 表の素の書き込みの 422 のログ（テスター回 13・㊳）：DB の答えの番号と制約の名前だけが残り、DB の文（22P02 の文は送った値を含む）・DB の詳しい説明（Key (…)=(…)・Failing row contains）・送った値はログのどこにも出ない", async () => {
    f.limits["createMemory"] = 10_000;
    await f.admin.query(
      "alter table memories add constraint k144_log_ck check (coalesce(title, '') <> 'k144送った題-check') not valid",
    );
    const logs: string[] = [];
    const take =
      (k: string) =>
      (...a: unknown[]) =>
        void logs.push(
          `${k} ` +
            a
              .map((x) =>
                x instanceof Error
                  ? `${x.message} ${JSON.stringify(x, Object.getOwnPropertyNames(x))}`
                  : typeof x === "string"
                    ? x
                    : JSON.stringify(x),
              )
              .join(" "),
        );
    const spies = (["error", "warn", "log", "info", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation(take(k)),
    );
    const bad: string[] = [];
    try {
      for (const [pg, body, sent, constraint] of [
        ["22P02", { confidence: "k144送った値abc" }, "k144送った値abc", null],
        ["23503", { kind_id: "k144送った種類" }, "k144送った種類", null],
        ["22003", { confidence: "99.5" }, "99.5", null],
        ["23514", { title: "k144送った題-check" }, "k144送った題-check", "k144_log_ck"],
      ] as const) {
        const before = logs.length;
        const r = await f.req("POST", "/memories", { body, headers: writer.auth });
        if (r.status !== 422) bad.push(`${pg}：${r.status}（422 のはず）`);
        const logged = logs.slice(before).join("\n");
        if (!logged.includes(pg)) bad.push(`${pg}：ログに DB の答えの番号が無い`);
        if (constraint && !logged.includes(constraint)) bad.push(`${pg}：ログに制約の名前（${constraint}）が無い`);
        if (logged.includes(sent)) bad.push(`${pg}：ログに送った値（${sent}）が出た：${logged.slice(0, 200)}`);
        for (const dbText of [
          "invalid input",
          "syntax",
          "violates",
          "out of range",
          "overflow",
          "Key (",
          "Failing row",
          "is not present",
          "precision",
        ])
          if (logged.includes(dbText))
            bad.push(`${pg}：ログに DB の文（「${dbText}」）が出た：${logged.slice(0, 200)}`);
      }
    } finally {
      for (const s of spies) s.mockRestore();
      await f.admin.query("alter table memories drop constraint if exists k144_log_ck");
    }
    expect(bad).toEqual([]);
  });
});

// 送る量の守り（D-130.1）：1 回に送る内容全体で 1MB（1,048,576 バイト）まで
const BODY_MAX = 1_048_576;
/** ちょうど n バイトの JSON の体（{"x":"aaa…"}） */
const bodyOfBytes = (n: number) => JSON.stringify({ x: "a".repeat(n - 8) });

describe("K-144 ㉓ 送る量の守り（D-130.1・PM の判断 2026-11-09）：体を受ける口は全部、1MB を超える体を 413 で断り、振る舞いに届かない", () => {
  it("K144-API-042 契約の体を受ける口の全部（まだ作っていない口・ログインしていない口も）：1,048,577 バイトの体は 413・PAYLOAD_TOO_LARGE・「送る内容が大きすぎます」で振る舞い（hooks）に届かない。1,048,576 バイトちょうどは 413 にしない。本物の口（記憶を作る）でも 413 で行を作らない", async () => {
    expect(Buffer.byteLength(bodyOfBytes(BODY_MAX))).toBe(BODY_MAX);
    let reached = 0;
    const hooks = Object.fromEntries(
      ENDPOINTS.map((e) => [
        e.operationId,
        {
          before: async () => {
            reached++;
            return { status: 418, body: {} };
          },
        },
      ]),
    );
    const app = createApp({ version: "test", repo: {} as never, resolve: async () => null, contract: { hooks } });
    const writes = ENDPOINTS.filter((e) => ["POST", "PATCH", "PUT"].includes(e.method) && e.input);
    expect(writes.map((e) => e.operationId)).toContain("createTicket");
    const send = (e: (typeof writes)[number], body: string) =>
      app.request(
        `http://localhost${e.path.replace(/:(\w+)/g, (_, n: string) => (e.uuidParams.includes(n) ? randomUUID() : `x-${n}`))}`,
        { method: e.method, headers: { "content-type": "application/json", "x-forwarded-for": nextIp() }, body },
      );
    const bad: string[] = [];
    for (const e of writes) {
      const r = await send(e, bodyOfBytes(BODY_MAX + 1));
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (r.status !== 413 || j["code"] !== "PAYLOAD_TOO_LARGE" || j["message"] !== "送る内容が大きすぎます")
        bad.push(`${e.operationId}：${r.status} ${JSON.stringify(j).slice(0, 80)}`);
      if (!e.errors.includes(413)) bad.push(`${e.operationId}：契約の並び（${e.errors.join(",")}）に 413 が無い`);
    }
    expect(bad).toEqual([]);
    expect(reached, "1MB を超える体で振る舞いに届いた").toBe(0);
    const edge = writes.find((e) => e.operationId === "createSignup")!;
    const atLimit = await send(edge, bodyOfBytes(BODY_MAX));
    expect(atLimit.status, "1MB ちょうどは 413 にしない").not.toBe(413);
    // 本物の口（表の素の書き込み）：413 で記憶を作らない
    f.limits["createMemory"] = 10_000;
    const n = () => count("select count(*) as n from memories where tenant_id = $1", [T.tenantId]);
    const before = await n();
    const big = await f.req("POST", "/memories", {
      body: JSON.stringify({ title: "a".repeat(BODY_MAX) }),
      headers: writer.auth,
    });
    expect(big.status).toBe(413);
    expect(((await json(big)) as Record<string, unknown>)["message"]).toBe("送る内容が大きすぎます");
    expect(await n()).toBe(before);
  });
});

/** 縮まない（DB の圧縮で小さくならない）n 字の文：漢字（U+4E00〜U+9FFF・NFKC で変わらない）と 4 バイトの字を混ぜる */
const noisy = (n: number): string => {
  const b = randomBytes(n * 2);
  let s = "";
  for (let i = 0; i < n; i++) s += i % 97 === 0 ? "😀" : String.fromCharCode(0x4e00 + (b.readUInt16LE(i * 2) % 0x5200));
  return s;
};

describe("K-144 ㉔ 自由に書く欄の上限を外す（D-130.3・D-130.4・精査 R1 回 12 追加-3）：長い区画・下書き・記憶・会話の名前は、そのまま残り、読み戻して一字も欠けない", () => {
  beforeAll(() => {
    for (const op of [
      "createTicket",
      "saveMyTicketDraft",
      "listMyTicketDrafts",
      "createConversation",
      "updateConversation",
      "createMemory",
      "updateMemory",
    ])
      f.limits[op] = 10_000;
  });

  it("K144-API-043 区画 30000 字（前の上限 20000 を超える）・下書き 450KB ほど（前の上限 180,000 バイトと DB の pg_column_size 200000 を超える・縮まない文）・文字数は 100,000 より少ないが 200,000 バイトを越える日本語の下書き（もとの K60-API-045）・記憶の本文 5000 字と題 300 字（前は 2000・80 で黙って切った）・会話の名前 300 字（前は 80）は、どれも 201／200 で、DB と読む口から読み戻すと送った文と一字も違わない。1MB を超える下書きは 413・PAYLOAD_TOO_LARGE で残らない", async () => {
    const bad: string[] = [];
    // 区画（チケットの本文）
    const section = noisy(30000);
    const t = await create(ticketBody({ sections: { purpose: section, done: "完了", todo: "実施" } }));
    if (t.status !== 201) bad.push(`区画 30000 字：${t.status} ${(await t.clone().text()).slice(0, 200)}`);
    else {
      const tid = ((await json(t)).data as { id: string }).id;
      const got = (
        await f.admin.query<{ v: string | null }>(
          "select body->>'text' as v from ticket_sections where ticket_id = $1 and section_key = 'purpose'",
          [tid],
        )
      ).rows[0]?.v;
      if (got !== section)
        bad.push(`区画 30000 字：読み戻すと ${got === undefined || got === null ? "無い" : `${[...got].length} 字`}`);
    }
    // 下書き
    const draftId = randomUUID();
    const draft = { title: "長い下書き", sections: { purpose: noisy(150000) } };
    expect(Buffer.byteLength(JSON.stringify(draft))).toBeGreaterThan(400_000);
    const s = await saveDraft({ draft_id: draftId, body: draft });
    if (s.status !== 201) bad.push(`下書き 450KB：${s.status} ${(await s.clone().text()).slice(0, 200)}`);
    else {
      await conforms("saveMyTicketDraft", s);
      const list = (await json(await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }))).data as unknown as {
        draft_id: string;
        body: unknown;
      }[];
      const mine = list.find((x) => x.draft_id === draftId);
      if (JSON.stringify(mine?.body) !== JSON.stringify(draft))
        bad.push("下書き 450KB：読む口から読み戻すと中身が違う");
    }
    // 下書き：文字数は 100,000 より少ないが UTF-8 のバイト数が DB の上限 200,000 を越える日本語（もとの K60-API-045 の形・D-130.3 で 422 → 201）
    let x = 12345;
    const ja = Array.from({ length: 80_000 }, () => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return String.fromCodePoint(0x4e00 + (x % 0x5000));
    }).join("");
    const jaDraft = { title: "大きな下書き", sections: { purpose: ja } };
    expect(JSON.stringify(jaDraft).length).toBeLessThan(100_000);
    expect(Buffer.byteLength(JSON.stringify(jaDraft), "utf8")).toBeGreaterThan(200_000);
    const jaId = randomUUID();
    const sj = await saveDraft({ draft_id: jaId, body: jaDraft });
    if (sj.status !== 201) bad.push(`日本語の下書き 240KB：${sj.status} ${(await sj.clone().text()).slice(0, 200)}`);
    // 下書き：1MB を超える体は 413・PAYLOAD_TOO_LARGE で残らない（D-130.1）
    const hugeId = randomUUID();
    const huge = { title: "大きすぎる下書き", sections: { purpose: noisy(400_000) } };
    expect(Buffer.byteLength(JSON.stringify({ draft_id: hugeId, body: huge }))).toBeGreaterThan(1_048_576);
    const sh = await saveDraft({ draft_id: hugeId, body: huge });
    if (sh.status !== 413) bad.push(`下書き 1MB 超え：${sh.status}（413 のはず）`);
    else if (((await json(sh)) as Record<string, unknown>)["code"] !== "PAYLOAD_TOO_LARGE")
      bad.push("下書き 1MB 超え：code が PAYLOAD_TOO_LARGE でない");
    {
      // 別の GET で読み戻す：日本語の下書きは同じ中身で残り、1MB 超えの下書きは無い
      const list = (await json(await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }))).data as unknown as {
        draft_id: string;
        body: unknown;
      }[];
      const got = list.find((d) => d.draft_id === jaId);
      if (JSON.stringify(got?.body) !== JSON.stringify(jaDraft))
        bad.push("日本語の下書き 240KB：読む口から読み戻すと中身が違う（無い）");
      if (list.some((d) => d.draft_id === hugeId)) bad.push("下書き 1MB 超え：413 なのに残った");
    }
    // 記憶の本文と題
    const m = await f.req("POST", "/memories", { body: { title: "題" }, headers: writer.auth });
    expect(m.status).toBe(201);
    const mid = ((await json(m)).data as { id: string }).id;
    const body = noisy(5000);
    const title = noisy(300);
    const um = await f.req("PATCH", `/memories/${mid}`, { body: { body, title }, headers: writer.auth });
    if (um.status !== 200) bad.push(`記憶 5000 字：${um.status} ${(await um.clone().text()).slice(0, 200)}`);
    else {
      await conforms("updateMemory", um);
      const row = (
        await f.admin.query<{ title: string; body: string }>("select title, body from memories where id = $1", [mid])
      ).rows[0]!;
      if (row.body !== body)
        bad.push(`記憶の本文：読み戻すと ${[...row.body].length} 字（5000 字のはず・黙って切った）`);
      if (row.title !== title)
        bad.push(`記憶の題：読み戻すと ${[...row.title].length} 字（300 字のはず・黙って切った）`);
    }
    // 会話の名前
    const c = await f.req("POST", "/conversations", { body: {}, headers: writer.auth });
    expect(c.status).toBe(201);
    const cid = ((await json(c)).data as { id: string }).id;
    const name = noisy(300);
    const uc = await f.req("PATCH", `/conversations/${cid}`, { body: { title: name }, headers: writer.auth });
    if (uc.status !== 200) bad.push(`会話の名前 300 字：${uc.status} ${(await uc.clone().text()).slice(0, 200)}`);
    else {
      await conforms("updateConversation", uc);
      const got = (await f.admin.query<{ title: string }>("select title from conversations where id = $1", [cid]))
        .rows[0]!.title;
      if (got !== name) bad.push(`会話の名前：読み戻すと ${[...got].length} 字（300 字のはず・黙って切った）`);
    }
    expect(bad).toEqual([]);
  });
});

/** 読んだバイト数を数える流れの体（a の字を chunk ずつ total まで出す。読まれた分だけ出す） */
const countingBody = (total: number, chunk = 65_536) => {
  let pulled = 0;
  let cancelled = false;
  const piece = new TextEncoder().encode("a".repeat(chunk));
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        if (pulled >= total) return c.close();
        const n = Math.min(chunk, total - pulled);
        c.enqueue(n === chunk ? piece : piece.slice(0, n));
        pulled += n;
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled, cancelled: () => cancelled, chunk };
};

describe("K-144 ㉕ 送る量の守りは読む量で止める（精査 R1 回 12 追加-1・D-130.1・G-16）：体を読みながら数え、1,048,577 バイト目を読んだ時点で読むのをやめて 413", () => {
  it("K144-API-044 (a) content-length を小さく偽った 5MB の流れの体 (b) content-length の頭が無い 5MB の流れの体（chunked）：どちらも 413・PAYLOAD_TOO_LARGE・「送る内容が大きすぎます」で振る舞いに届かず、読んだのは 1MB と 2 かたまり（128KB・流れの読み先の 1 かたまりを許す）まで（5MB を全部読まない）。(c) content-length の頭だけが 1MB を超える小さな体：読まずに 413（1 バイトも読まない）。ログインの要る口（作る）と要らない口（登録）の両方", async () => {
    let reached = 0;
    const hooks = Object.fromEntries(
      ENDPOINTS.map((e) => [
        e.operationId,
        {
          before: async () => {
            reached++;
            return { status: 418, body: {} };
          },
        },
      ]),
    );
    const app = createApp({ version: "test", repo: {} as never, resolve: async () => null, contract: { hooks } });
    const bad: string[] = [];
    const TOTAL = 5 * BODY_MAX;
    for (const op of ["createSignup", "createTicket"]) {
      const e = ENDPOINTS.find((x) => x.operationId === op)!;
      const url = `http://localhost${e.path}`;
      for (const [label, length, total, maxRead] of [
        ["(a) content-length を 100 と偽った", "100", TOTAL, "limit"],
        ["(b) content-length の頭が無い", null, TOTAL, "limit"],
        ["(c) content-length の頭だけが 1,048,577", String(BODY_MAX + 1), 2, "none"],
      ] as const) {
        const b = countingBody(total);
        const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": nextIp() };
        if (length !== null) headers["content-length"] = length;
        const req = new Request(url, { method: e.method, headers, body: b.stream, duplex: "half" } as RequestInit);
        const r = await app.request(req);
        const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (r.status !== 413 || j["code"] !== "PAYLOAD_TOO_LARGE" || j["message"] !== "送る内容が大きすぎます")
          bad.push(`${op} ${label}：${r.status} ${JSON.stringify(j).slice(0, 80)}`);
        if (maxRead === "none" && b.pulled() !== 0)
          bad.push(`${op} ${label}：読まずに断るはずが ${b.pulled()} バイト読んだ`);
        if (maxRead === "limit" && b.pulled() > BODY_MAX + 2 * b.chunk)
          bad.push(
            `${op} ${label}：${b.pulled()} バイト読んだ（1,048,577 バイト目で読むのをやめるはず・上限は ${BODY_MAX + 2 * b.chunk}）`,
          );
      }
    }
    expect(bad).toEqual([]);
    expect(reached, "1MB を超える体で振る舞いに届いた").toBe(0);
  });
});
