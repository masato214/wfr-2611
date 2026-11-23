// K-1116 記憶を直す口（updateMemory・PATCH /api/v1/memories/:id）は、使わない欄の確かさ（confidence）も契約の形（表の型 numeric の
//   ^-?[0-9]+(\.[0-9]+)?$）で、入口が NFKC と前後の空白を直す前の生の字で見て、形の外は 422（欄 confidence）で断り何も書かない。形どおりなら今までどおり受けて使わない（DB の確かさは変えない）。
//   契約 fuzz（G36）の ST201（confidence "AAA" を 200 で受けた・回 wfr 45114016413）の直し。本番と同じ agentHooks を差し込む（agent_hooks.test.ts と同じ形）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createPool } from "@kaname/db/pool";
import { agentHooks } from "../src/hooks/agent.js";
import { endpointOf, makeHarness, type Harness } from "./harness.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
let h: Harness;
let admin: pg.Pool;
let appPool: pg.Pool;

beforeAll(async () => {
  h = await makeHarness();
  admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 2 });
  Object.assign(h.hooks, agentHooks(appPool));
});
afterAll(async () => {
  await appPool?.end();
  await admin?.end();
  await h?.close();
});

const memory = async (): Promise<string> => {
  const m = await admin.query(
    "insert into memories (tenant_id, scope_id, owner_member_id, title, body, kind_id, confidence) select tenant_id, scope_id, id, '前の名前', '前の中身', 'preference', 0.5 from members where id = $1 returning id",
    [h.S.bossA],
  );
  return m.rows[0].id as string;
};
const row = async (id: string) =>
  (await admin.query("select body, confidence::text as confidence from memories where id = $1", [id])).rows[0] as {
    body: string;
    confidence: string;
  };
const patch = (id: string, body: Record<string, unknown>) => h.call(endpointOf("updateMemory"), "boss", { id, body });

describe("K-1116 記憶を直す口は確かさの形の外を断る", () => {
  it('K1116-API-001 確かさが数の形でない（"AAA"・"1."・""・" 1"・全角の "１"。入口が直す前の生の字で見る）：422・欄 confidence。中身も確かさも変えない', async () => {
    const id = await memory();
    for (const c of ["AAA", "1.", "", " 1", "１"]) {
      const r = await patch(id, { body: "新しい中身", confidence: c });
      expect(r.status, `${JSON.stringify(c)} ${await r.clone().text()}`).toBe(422);
      const j = (await r.json()) as { code: string; details: { field: string }[] };
      expect(j.code).toBe("VALIDATION_ERROR");
      expect(j.details.map((d) => d.field)).toEqual(["confidence"]);
      expect(await row(id)).toEqual({ body: "前の中身", confidence: "0.50" });
    }
  });

  it('K1116-API-002 確かさが数の形（"0.9"・"-3"・"12.345"・末に改行 1 つの "1\\n"）：200 で中身を直し、確かさは使わない（DB は 0.50 のまま）', async () => {
    const id = await memory();
    for (const [i, c] of ["0.9", "-3", "12.345", "1\n"].entries()) {
      const r = await patch(id, { body: `中身 ${i}`, confidence: c });
      expect(r.status, `${c} ${await r.clone().text()}`).toBe(200);
      expect(await row(id)).toEqual({ body: `中身 ${i}`, confidence: "0.50" });
    }
  });

  it("K1116-API-003 確かさが無い・null：200 で中身を直す（今までどおり）", async () => {
    const id = await memory();
    const a = await patch(id, { body: "無い" });
    expect(a.status, await a.clone().text()).toBe(200);
    const b = await patch(id, { body: "null", confidence: null });
    expect(b.status, await b.clone().text()).toBe(200);
    expect(await row(id)).toEqual({ body: "null", confidence: "0.50" });
  });

  it("K1116-API-004 確かさの形の外と中身の空が両方：422 は中身（body）を先に返す（前からの順）", async () => {
    const id = await memory();
    const r = await patch(id, { body: "", confidence: "AAA" });
    expect(r.status).toBe(422);
    const j = (await r.json()) as { details: { field: string }[] };
    expect(j.details.map((d) => d.field)).toEqual(["body"]);
  });
});
