// K-947「運営が会社を触る DB の道の土台」の単体の試験（本物の DB・アプリの接続 kaname_app・行の守りの中）。
// テストの名前の頭の行 ID（K947-API-…）は 11_tickets/K-947.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める形（K-947 が決める本体・D-156.3）:
//   DB  app.ops_require(p_cap text) returns uuid   … 運営の文脈（app.role 'ops'）で、生きている ops_members の人が、そのできること（'any' は誰でも）を
//                                                     持てば ops_members.id。ほかは 42501（insufficient_privilege）
//       app.ops_target(p_tenant uuid) returns uuid  … 顧客のワークスペース（在る・消していない・作りかけでない・運営の会社でない）なら同じ id。ほかは P0002（no_data_found）
//   TS  apps/api/src/features/F12/ops/db.ts
//       opsTx(pool, ctx, fn)        … 運営の文脈（role ops・tenantId null）の 1 つの取引で fn を流す（withTenant）
//       opsAudit(client, a)         … app.record_ops_audit を呼ぶ（a = { tenantId, action, targetType, targetId, payload? }）
//       opsErrorReply(e, where)     … 42501 → 403 FORBIDDEN ／ P0002 → 404 NOT_FOUND（欄・details なし）／ ほか → 503 E-PAGE-003（ログは種類だけ）
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import { opsAudit, opsErrorReply, opsTx } from "../../../src/features/F12/ops/db.js";

const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
let f: Fixture;
let customer: { tenantId: string; rootScope: string };
let halfMade: { tenantId: string; rootScope: string };
let staff: Person;
let opsMoney: Person;
let opsInquiry: Person;
let opsRevoked: Person;
const ops = (p: Person): TenantContext => ({ tenantId: null, userId: p.id, role: "ops" });
const pgCode = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return String((e as { code?: unknown }).code);
  }
};

beforeAll(async () => {
  f = await makeFixture();
  customer = await f.company("k947 顧客");
  halfMade = await f.company("k947 作りかけ");
  await f.admin.query("update tenants set half_made_at = now() where id = $1", [halfMade.tenantId]);
  staff = await f.person(customer.tenantId, customer.rootScope, { name: "顧客の人" });
  const sc = await f.admin.query<{ id: string }>(
    "insert into scopes (tenant_id, name, ticket_prefix) values ($1, 'k947 運営', '') returning id",
    [OPS_TENANT],
  );
  const s = sc.rows[0]!.id;
  opsMoney = await f.person(OPS_TENANT, s, { name: "運営 お金", role: "ops" });
  opsInquiry = await f.person(OPS_TENANT, s, { name: "運営 問い合わせ", role: "ops" });
  opsRevoked = await f.person(OPS_TENANT, s, { name: "運営 外した", role: "ops" });
  await f.admin.query(
    "insert into ops_members (tenant_id, member_id, caps, revoked_at) values ($1, $2, '{money}', null), ($1, $3, '{inquiry}', null), ($1, $4, '{money}', now())",
    [OPS_TENANT, opsMoney.id, opsInquiry.id, opsRevoked.id],
  );
}, 60_000);
afterAll(async () => {
  await f.admin.query("delete from ops_members where member_id = any($1::uuid[])", [
    [opsMoney.id, opsInquiry.id, opsRevoked.id],
  ]);
  await f.close();
});

describe("K-947 関数の中の 2 層目：運営の人とできること", () => {
  it("K947-API-001 運営の文脈 × できることを持つ：ops_require('money') と ops_require('any') がその人の ops_members.id を返す", async () => {
    const id = (await f.admin.query<{ id: string }>("select id from ops_members where member_id = $1", [opsMoney.id]))
      .rows[0]!.id;
    const got = await withTenant(f.pool, ops(opsMoney), async (c) => [
      (await c.query<{ v: string }>("select app.ops_require('money') as v")).rows[0]!.v,
      (await c.query<{ v: string }>("select app.ops_require('any') as v")).rows[0]!.v,
    ]);
    expect(got).toEqual([id, id]);
  });

  it("K947-API-002 運営の文脈 × できることを持たない（問い合わせだけの人が money）：42501", async () => {
    expect(await pgCode(withTenant(f.pool, ops(opsInquiry), (c) => c.query("select app.ops_require('money')")))).toBe(
      "42501",
    );
  });

  it("K947-API-003 会社の人の文脈（role member）で呼ぶ：42501（運営の人と同じ members.id を偽っても role で止まる）", async () => {
    const asMember: TenantContext = { tenantId: customer.tenantId, userId: staff.id, role: "member" };
    expect(await pgCode(withTenant(f.pool, asMember, (c) => c.query("select app.ops_require('any')")))).toBe("42501");
    const fake: TenantContext = { tenantId: OPS_TENANT, userId: opsMoney.id, role: "member" };
    expect(await pgCode(withTenant(f.pool, fake, (c) => c.query("select app.ops_require('any')")))).toBe("42501");
  });

  it("K947-API-004 外した運営の人（revoked_at）：ops_require('any') も 42501", async () => {
    expect(await pgCode(withTenant(f.pool, ops(opsRevoked), (c) => c.query("select app.ops_require('any')")))).toBe(
      "42501",
    );
  });
});

describe("K-947 指す会社の確かめ", () => {
  it("K947-API-005 ops_target：顧客の会社は同じ id。運営の会社・無い id・作りかけの会社は P0002", async () => {
    const r = await withTenant(f.pool, ops(opsMoney), async (c) => {
      const ok = (await c.query<{ v: string }>("select app.ops_target($1) as v", [customer.tenantId])).rows[0]!.v;
      const codes: string[] = [];
      for (const t of [OPS_TENANT, randomUUID(), halfMade.tenantId]) {
        await c.query("savepoint k947");
        codes.push(await pgCode(c.query("select app.ops_target($1)", [t])));
        await c.query("rollback to savepoint k947");
      }
      return { ok, codes };
    });
    expect(r.ok).toBe(customer.tenantId);
    expect(r.codes).toEqual(["P0002", "P0002", "P0002"]);
  });
});

describe("K-947 TS の土台", () => {
  it("K947-API-006 opsTx：中は role ops・会社の文脈なし（文脈の値 app.tenant_id が null）・user は運営の人", async () => {
    const got = await opsTx(
      f.pool,
      ops(opsMoney),
      async (c) =>
        (
          await c.query<{ role: string; tenant: string | null; uid: string }>(
            // 関数 app.role() はアプリの接続に実行権が無い（app の関数は PUBLIC から外した・20261123100000_function_execute_private_after）。
            // 3 つとも関数と同じ中身（文脈の値を読み、空は null）をそのまま読む
            "select nullif(current_setting('app.role', true), '') as role, nullif(current_setting('app.tenant_id', true), '')::uuid as tenant, nullif(current_setting('app.user_id', true), '')::uuid as uid",
          )
        ).rows[0],
    );
    expect(got).toEqual({ role: "ops", tenant: null, uid: opsMoney.id });
  });

  it("K947-API-007 opsAudit：運営の記録と、指した会社の記録の両方に 1 行ずつ。後で落ちたら取引ごと戻り、どちらにも残らない", async () => {
    const action = `k947.audit.${randomUUID().slice(0, 8)}`;
    await opsTx(f.pool, ops(opsMoney), (c) =>
      opsAudit(c, { tenantId: customer.tenantId, action, targetType: "tenant", targetId: customer.tenantId }),
    );
    const count = async (a: string) => ({
      ops: Number(
        (await f.admin.query<{ n: string }>("select count(*) as n from ops_audit_events where action = $1", [a]))
          .rows[0]!.n,
      ),
      tenant: Number(
        (
          await f.admin.query<{ n: string }>(
            "select count(*) as n from audit_events where tenant_id = $1 and action = $2",
            [customer.tenantId, a],
          )
        ).rows[0]!.n,
      ),
    });
    expect(await count(action)).toEqual({ ops: 1, tenant: 1 });
    const failed = `${action}.rollback`;
    await expect(
      opsTx(f.pool, ops(opsMoney), async (c) => {
        await opsAudit(c, {
          tenantId: customer.tenantId,
          action: failed,
          targetType: "tenant",
          targetId: customer.tenantId,
        });
        throw new Error("後で落ちる");
      }),
    ).rejects.toThrow("後で落ちる");
    expect(await count(failed)).toEqual({ ops: 0, tenant: 0 });
  });

  it("K947-API-008 opsErrorReply：42501 → 403 FORBIDDEN／P0002 → 404 NOT_FOUND（field・details なし）／ほか → 503 E-PAGE-003。ログは種類だけで、例外の文を出さない", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const forbid = opsErrorReply(Object.assign(new Error("x"), { code: "42501" }), "k947");
      expect(forbid.status).toBe(403);
      expect((forbid.body as Record<string, unknown>)["code"]).toBe("FORBIDDEN");
      const missing = opsErrorReply(Object.assign(new Error("x"), { code: "P0002" }), "k947");
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ error: "not_found", code: "NOT_FOUND" });
      const down = opsErrorReply(Object.assign(new Error("秘密の文 tenant=abc"), { code: "57P01" }), "k947");
      expect(down.status).toBe(503);
      expect((down.body as Record<string, unknown>)["code"]).toBe("E-PAGE-003");
      const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(logged).toContain("57P01");
      expect(logged).not.toContain("秘密の文");
    } finally {
      spy.mockRestore();
    }
  });
});
