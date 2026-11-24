// K-1001「運営の口の入口の柵」の単体の試験（本物の DB・本物の契約の入口 op.ts・偽の画面のログイン（features/fixture.ts の fake:ops））。
// テストの名前の頭の行 ID（K1001-API-…）は 11_tickets/K-1001.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める形（K-1001 が決める本体）:
//   ・契約の perm.scope：運営の口のうち道が /api/v1/ops/workspaces/:id で始まる口は "ops_tenant"（1 社を指す）、ほかの運営の口は "ops_all"
//   ・運営の口（契約の auth が ops）は、x-tenant-id を付けても文脈の tenantId を null にしてから振る舞いに渡す（運営の口は会社の文脈で動かない・D-156.3）
//   ・"ops_tenant" の口で :id が運営の会社（app.ops_tenant_id()）なら 404（運営の会社は顧客のワークスペースでない）。振る舞いに届かない
//   ・運営が会社の人の口を呼ぶのは「中を見る」の許可がある間の読む口（GET）だけ。書く口は許可があっても 403 で何も書かない（D-125.128「見るだけ」）
// 振る舞いは、試験の中で差す覗きの hook（before で文脈を答えに書いて止める）で見る。運営の口はまだ作っていない（501）ので、覗きが答えれば入口を通った印。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENDPOINTS } from "@kaname/contracts";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import type { Hook } from "../../../src/contract/deps.js";

const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
let f: Fixture;
let customer: { tenantId: string; rootScope: string };
let opsAll: Person; // 9 つ全部
let opsNoMoney: Person; // お金を持たない
let opsNoRow: Person; // 運営の会社の人だが ops_members が無い
let staff: Person; // 顧客の会社の人
let opsScope: string; // この回が運営の会社に足した scopes の行（afterAll で消す）

const probe: Hook = {
  before: async (a) => ({
    status: 200,
    body: { tenant: a.ctx.tenantId, seen: a.c.get("ctx").tenantId ?? null, id: a.id },
  }),
};
const withProbe = async (ops: readonly string[], fn: () => Promise<void>) => {
  for (const op of ops) f.hooks[op] = probe;
  try {
    await fn();
  } finally {
    for (const op of ops) delete f.hooks[op];
  }
};
const opsHead = (p: Person, tenant?: string) => ({
  ...f.as(p, "ops"),
  ...(tenant ? { "x-tenant-id": tenant } : {}),
});
const grant = async (p: Person, tenantId: string) => {
  const om = await f.admin.query<{ id: string }>("select id from ops_members where member_id = $1", [p.id]);
  await f.admin.query(
    "insert into support_access_grants (tenant_id, scope, ops_member_id, reason, expires_at) values ($1, 'read', $2, '試験の確かめ', now() + interval '30 minutes')",
    [tenantId, om.rows[0]!.id],
  );
};

beforeAll(async () => {
  f = await makeFixture();
  customer = await f.company("k1001 顧客");
  staff = await f.person(customer.tenantId, customer.rootScope, { name: "顧客の人" });
  const sc = await f.admin.query<{ id: string }>(
    "insert into scopes (tenant_id, name, ticket_prefix) values ($1, 'k1001 運営', '') returning id",
    [OPS_TENANT],
  );
  opsScope = sc.rows[0]!.id;
  opsAll = await f.person(OPS_TENANT, opsScope, { name: "運営 全部", role: "ops" });
  opsNoMoney = await f.person(OPS_TENANT, opsScope, { name: "運営 お金なし", role: "ops" });
  opsNoRow = await f.person(OPS_TENANT, opsScope, { name: "運営 行なし", role: "ops" });
  await f.admin.query("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, $3), ($1, $4, $5)", [
    OPS_TENANT,
    opsAll.id,
    ["inquiry", "peek", "money", "stop", "notice", "distribute", "plan_propose", "plan_decide", "ops_people"],
    opsNoMoney.id,
    ["inquiry"],
  ]);
}, 60_000);
afterAll(async () => {
  await f.admin.query("delete from support_access_grants where tenant_id = $1", [customer.tenantId]);
  await f.admin.query("delete from ops_members where member_id = any($1::uuid[])", [[opsAll.id, opsNoMoney.id]]);
  // 運営の会社に足した人 3 人と scopes の行も消す（共用の DB で回を重ねても運営の会社の人が増えない）。
  // members・scopes は消した印（deleted_at）で消す（ほかの表が指していても落ちない・一覧は deleted_at is null だけを読む）
  await f.admin.query("update members set deleted_at = now() where id = any($1::uuid[])", [
    [opsAll.id, opsNoMoney.id, opsNoRow.id],
  ]);
  await f.admin.query("update scopes set deleted_at = now() where id = $1", [opsScope]);
  await f.close();
});

describe("K-1001 契約の perm.scope", () => {
  it("K1001-API-001 運営の口のうち /api/v1/ops/workspaces/:id で始まる口は ops_tenant、ほかの運営の口は ops_all。運営でない口は今のまま（workspace か any）", () => {
    const ops = ENDPOINTS.filter((e) => e.auth === "ops");
    expect(ops.length).toBeGreaterThan(30);
    for (const e of ops) {
      const want = e.path.startsWith("/api/v1/ops/workspaces/:id") ? "ops_tenant" : "ops_all";
      expect(e.perm.scope, `${e.operationId} ${e.path}`).toBe(want);
    }
    for (const e of ENDPOINTS.filter((x) => x.auth !== "ops"))
      expect(["workspace", "any"], `${e.operationId}`).toContain(e.perm.scope);
  });
});

describe("K-1001 運営の口は会社の文脈で動かない", () => {
  it("K1001-API-002 全社の口（getOpsShell・ops_all）に x-tenant-id を付けて呼ぶ：振る舞いに届き、文脈の tenantId は null", async () => {
    await withProbe(["getOpsShell"], async () => {
      const r = await f.req("GET", "/ops/shell", { headers: opsHead(opsAll, customer.tenantId) });
      expect(r.status, await r.clone().text()).toBe(200);
      expect(await r.json()).toEqual({ tenant: null, seen: null, id: null });
    });
  });

  it("K1001-API-003 x-tenant-id を付けずに呼ぶ：同じく tenantId は null（偽のログインの会社も入らない）", async () => {
    await withProbe(["getOpsShell"], async () => {
      const r = await f.req("GET", "/ops/shell", { headers: opsHead(opsAll) });
      expect(r.status).toBe(200);
      expect(((await r.json()) as { tenant: unknown }).tenant).toBeNull();
    });
  });

  it("K1001-API-004 1 社の口（getOpsWorkspace・ops_tenant）で :id が顧客の会社：振る舞いに届き、id はその会社・tenantId は null", async () => {
    await withProbe(["getOpsWorkspace"], async () => {
      const r = await f.req("GET", `/ops/workspaces/${customer.tenantId}`, {
        headers: opsHead(opsAll, customer.tenantId),
      });
      expect(r.status, await r.clone().text()).toBe(200);
      expect(await r.json()).toEqual({ tenant: null, seen: null, id: customer.tenantId });
    });
  });

  it("K1001-API-005 1 社の口で :id が運営の会社：404 NOT_FOUND（欄・details なし）。振る舞いに届かない", async () => {
    await withProbe(["getOpsWorkspace", "stopWorkspace"], async () => {
      const g = await f.req("GET", `/ops/workspaces/${OPS_TENANT}`, { headers: opsHead(opsAll) });
      expect(g.status, await g.clone().text()).toBe(404);
      const b = (await g.json()) as Record<string, unknown>;
      expect(b["code"]).toBe("NOT_FOUND");
      expect(b).not.toHaveProperty("details");
      expect(b).not.toHaveProperty("field");
      const s = await f.req("POST", `/ops/workspaces/${OPS_TENANT}/stop`, { headers: opsHead(opsAll), body: {} });
      expect(s.status).toBe(404);
    });
  });

  it("K1001-API-006 1 社の口で :id が uuid の形でない：422（今の入口の uuid の確かめ・振る舞いに届かない）", async () => {
    await withProbe(["getOpsWorkspace"], async () => {
      const r = await f.req("GET", "/ops/workspaces/not-a-uuid", { headers: opsHead(opsAll) });
      expect(r.status).toBe(422);
    });
  });
});

describe("K-1001 運営が会社の人の口を呼ぶ（中を見る）", () => {
  it("K1001-API-007 許可なし × 会社の人の読む口（listScopes）に x-tenant-id：403。振る舞いに届かない", async () => {
    await withProbe(["listScopes"], async () => {
      const r = await f.req("GET", "/scopes", { headers: opsHead(opsAll, customer.tenantId) });
      expect(r.status, await r.clone().text()).toBe(403);
    });
  });

  it("K1001-API-008 許可あり × 会社の人の読む口：振る舞いに届き、文脈の tenantId は指した会社", async () => {
    await grant(opsAll, customer.tenantId);
    await withProbe(["listScopes"], async () => {
      const r = await f.req("GET", "/scopes", { headers: opsHead(opsAll, customer.tenantId) });
      expect(r.status, await r.clone().text()).toBe(200);
      expect(((await r.json()) as { tenant: unknown }).tenant).toBe(customer.tenantId);
    });
  });

  it("K1001-API-009 許可あり × 会社の人の書く口（createTicket）：403 FORBIDDEN・振る舞いに届かない・チケットの行が増えない", async () => {
    await grant(opsAll, customer.tenantId);
    const count = async () =>
      Number(
        (
          await f.admin.query<{ n: string }>("select count(*) as n from tickets where tenant_id = $1", [
            customer.tenantId,
          ])
        ).rows[0]!.n,
      );
    const before = await count();
    await withProbe(["createTicket"], async () => {
      const r = await f.req("POST", "/tickets", {
        headers: opsHead(opsAll, customer.tenantId),
        body: { title: "運営が書く" },
      });
      expect(r.status, await r.clone().text()).toBe(403);
    });
    expect(await count()).toBe(before);
  });
});

describe("K-1001 役とできること（今の柵のまま）", () => {
  it("K1001-API-010 顧客の会社の人の印で運営の口：403。振る舞いに届かない", async () => {
    await withProbe(["getOpsShell"], async () => {
      const r = await f.req("GET", "/ops/shell", { headers: f.as(staff, "member") });
      expect(r.status).toBe(403);
    });
  });

  it("K1001-API-011 お金を持たない運営の人 × お金の口（listOpsInvoices）：403。問い合わせの口（listOpsInquiries）は届く", async () => {
    await withProbe(["listOpsInvoices", "listOpsInquiries"], async () => {
      expect((await f.req("GET", "/ops/invoices", { headers: opsHead(opsNoMoney) })).status).toBe(403);
      expect((await f.req("GET", "/ops/inquiries", { headers: opsHead(opsNoMoney) })).status).toBe(200);
    });
  });

  it("K1001-API-012 運営の人の行（ops_members）が無い × 誰でも呼べる運営の口（getOpsShell・ops:any）：403", async () => {
    await withProbe(["getOpsShell"], async () => {
      const r = await f.req("GET", "/ops/shell", { headers: opsHead(opsNoRow) });
      expect(r.status).toBe(403);
    });
  });
});
