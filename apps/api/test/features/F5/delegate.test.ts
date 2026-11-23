// K-62「AI に任せる」の単体の試験：人が呼ぶ口（delegateTicket・getActionRun・listTicketRuns）と、チケットの状態・権限（口・本物の DB）。
//   名前の頭の行 ID（K62-API-…）は 11_tickets/K-62.md の表のマスと分岐に 1 対 1 で結ぶ。PC が呼ぶ口は delegate-bridge.test.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の行の時刻を動かす（D-128.130）。
//   動くのは押した人の AI（その人の PC）。任せられるのはそのチケットを直せる人なら誰でも（D-128.138）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Person } from "../fixture.js";
import { data, delegateOk, E, json, makeKit, type Device, type Kit } from "./delegate-kit.js";

let k: Kit;
let owner: Person; // 担当者（書ける）
let mate: Person; // 同じグループで書ける人（担当者でない）
let viewer: Person; // 見るだけ
let outsider: Person; // 別の会社の人
let ownerPc: Device;
let matePc: Device;

beforeAll(async () => {
  k = await makeKit();
  owner = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "高本", ticketAbility: "edit" });
  mate = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "佐藤", ticketAbility: "edit" });
  viewer = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "見るだけの人", ticketAbility: "view" });
  outsider = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
  ownerPc = await k.device(owner);
  matePc = await k.device(mate, "佐藤の PC");
}, 90_000);
afterAll(async () => {
  await k?.close();
});

const jobsOf = (ticketId: string) => k.n("select count(*) as n from action_runs where ticket_id = $1", [ticketId]);
const systemLines = (ticketId: string) =>
  k.q<{ body: string }>(
    "select body from ticket_messages where ticket_id = $1 and kind = 'system' order by created_at",
    [ticketId],
  );

describe("K-62 AI に任せる：状態 × 入口 × 利用者の状態（人が呼ぶ口・本物の DB）", () => {
  it("K62-API-001 未着手 × 「AI に任せる」× 担当者・PC がつながっている：仕事と実行の記録を 1 回で作り、チケットは実行中。やり取りに 1 行", async () => {
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    expect(d).toMatchObject({ status: "queued", pc: "live" });
    const job = (await k.q("select * from bridge_jobs where id = $1", [d.job_id]))[0]!;
    expect(job).toMatchObject({ kind: "ticket", member_id: owner.id, state_id: "queued", permission_mode: "manual" });
    const run = (await k.q("select * from action_runs where id = $1", [d.run_id]))[0]!;
    expect(run).toMatchObject({
      ticket_id: t,
      phase: "make",
      status_id: "queued",
      bridge_job_id: d.job_id,
      created_by: owner.id,
    });
    expect(await k.stageOf(t)).toBe("running");
    expect((await k.q("select delegated_to_clone from tickets where id = $1", [t]))[0]!["delegated_to_clone"]).toBe(
      true,
    );
    const lines = await systemLines(t);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.body).toContain("高本のAI");
  });

  it("K62-API-002 同じ × PC 閉じている（最後の知らせから 75 秒を過ぎた）：積んで待つ（pc: asleep）。PC が開いて取りに来たら渡る", async () => {
    const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "閉じた人", ticketAbility: "edit" });
    const pc = await k.device(p);
    await k.lastSeen(pc, 600);
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    expect(d).toMatchObject({ status: "queued", pc: "asleep" });
    const run = await data(await k.run(p, d.run_id));
    expect(run).toMatchObject({ status: "queued", pc: "asleep" });
    const job = await k.takeJob(pc);
    expect(job.job_id).toBe(d.job_id);
  });

  it("K62-API-003 Bridge を閉じた直後（最後の知らせから 0 秒・74 秒・75 秒・76 秒）：どれも積む。75 秒より前は live、75 秒からは asleep（G-12・E-TO-003）", async () => {
    const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "閉じた直後の人", ticketAbility: "edit" });
    const pc = await k.device(p);
    for (const [sec, pc_] of [
      [0, "live"],
      [74, "live"],
      [75, "asleep"],
      [76, "asleep"],
    ] as const) {
      await k.lastSeen(pc, sec);
      const d = await delegateOk(k, p, await k.ticket(p));
      expect(d.pc, `${sec} 秒`).toBe(pc_);
    }
    expect(
      await k.n("select count(*) as n from bridge_jobs where member_id = $1 and state_id = 'queued'", [p.id]),
    ).toBe(4);
  });

  it("K62-API-056 保留・作業中 × 「AI に任せる」：任せられる（未着手と同じ）", async () => {
    for (const stage of ["hold", "doing"]) {
      const t = await k.ticket(owner);
      await k.f.admin.query(
        "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = $2) where id = $1",
        [t, stage],
      );
      await delegateOk(k, owner, t);
      expect(await k.stageOf(t)).toBe("running");
    }
  });

  it("K62-API-004 PC を一度もつないでいない・外した：409・E-CONN-001。仕事も実行の記録も積まず、段も変えない（D-125.143）", async () => {
    const never = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "PC 無しの人", ticketAbility: "edit" });
    const t = await k.ticket(never);
    const r = await k.delegate(never, t);
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j.code).toBe(E.noPc);
    expect(JSON.stringify(j)).toContain("/setup/bridge");
    expect(await jobsOf(t)).toBe(0);
    expect(await k.stageOf(t)).toBe("todo");
    // 外した PC（revoked）しか無い人も同じ
    const gone = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "外した人", ticketAbility: "edit" });
    const pc = await k.device(gone);
    await k.f.admin.query("update sessions set revoked_at = now(), revoke_reason_id = 'logout' where id = $1", [
      pc.sessionId,
    ]);
    const t2 = await k.ticket(gone);
    expect((await json(await k.delegate(gone, t2))).code).toBe(E.noPc);
    expect(await jobsOf(t2)).toBe(0);
  });

  it("K62-API-020 待っている・動いている・確認待ち × もう一度・別のタブで：409・E-CONF-013 と今の実行。二つ目は積まない（同時に 2 本でも 1 つ）", async () => {
    const t = await k.ticket(owner);
    const [a, b] = await Promise.all([k.delegate(owner, t), k.delegate(owner, t)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    const winner = a.status === 201 ? a : b;
    const w = await data<{ run_id: string }>(winner);
    const l = await json(loser);
    expect(l.code).toBe(E.running);
    expect(l["run_id"]).toBe(w.run_id);
    expect(await jobsOf(t)).toBe(1);
    for (const state of ["running", "asking"]) {
      await k.f.admin.query("update action_runs set status_id = $2 where id = $1", [w.run_id, state]);
      const again = await k.delegate(owner, t);
      expect(again.status).toBe(409);
      expect((await json(again)).code).toBe(E.running);
    }
    expect(await jobsOf(t)).toBe(1);
  });

  it("K62-API-021 止まった・やめた × 「AI に任せる」：新しく任せられる。前の実行は記録に残る", async () => {
    const t = await k.ticket(owner);
    const first = await delegateOk(k, owner, t);
    for (const state of ["stopped", "cancelled"]) {
      await k.f.admin.query("update action_runs set status_id = $2, finished_at = now() where ticket_id = $1", [
        t,
        state,
      ]);
      await k.f.admin.query(
        "update bridge_jobs set state_id = $2, finished_at = now() where id in (select bridge_job_id from action_runs where ticket_id = $1)",
        [t, state],
      );
      await k.f.admin.query(
        "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = 'doing') where id = $1",
        [t],
      );
      await delegateOk(k, owner, t);
    }
    expect(await jobsOf(t)).toBe(3);
    const list = await data<{ id: string }[]>(await k.runs(owner, t));
    expect(list.map((x) => x.id)).toContain(first.run_id);
  });

  it("K62-API-022 承認待ち・完了・確認中・実行中（走っている実行なし）× 「AI に任せる」：409・E-CONF-014。何も積まない（任せられるのは未着手・作業中・保留だけ）", async () => {
    for (const stage of ["awaiting_approval", "done", "checking", "running"]) {
      const t = await k.ticket(owner);
      await k.f.admin.query(
        "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = $2) where id = $1",
        [t, stage],
      );
      const r = await k.delegate(owner, t);
      expect(r.status).toBe(409);
      expect((await json(r)).code).toBe(E.notDelegable);
      expect(await jobsOf(t)).toBe(0);
    }
  });

  it("K62-API-023 どれでも × 担当者でないが直せる人（同じグループで書ける人）：任せられる。積まれるのは押した人の PC。担当者の PC には渡らない。記録に押した人が残る（D-128.138）", async () => {
    // 担当者は自分の仕事を持たない新しい人（担当者の PC に何も渡らないことを null で見る）
    const assignee = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "担当だけの人", ticketAbility: "edit" });
    const assigneePc = await k.device(assignee);
    const t = await k.ticket(assignee, { assignee });
    const d = await delegateOk(k, mate, t);
    const job = (await k.q("select member_id from bridge_jobs where id = $1", [d.job_id]))[0]!;
    expect(job["member_id"]).toBe(mate.id);
    expect((await k.q("select created_by from action_runs where id = $1", [d.run_id]))[0]!["created_by"]).toBe(mate.id);
    expect((await data<{ job: unknown }>(await k.take(assigneePc))).job).toBeNull();
    const mine = await k.takeJob(matePc);
    expect(mine.job_id).toBe(d.job_id);
    const run = await data<{ by: { member_id: string; display_name: string } }>(await k.run(owner, d.run_id));
    expect(run.by).toMatchObject({ member_id: mate.id, display_name: "佐藤" });
    expect((await systemLines(t))[0]!.body).toContain("佐藤のAI");
  });

  it("K62-API-024 どれでも × 見るだけの人・取引先の人・運営の人：403。何も積まない", async () => {
    const t = await k.ticket(owner);
    expect((await k.delegate(viewer, t)).status).toBe(403);
    for (const role of ["client", "ops"] as const) {
      const r = await k.f.req("POST", `/tickets/${t}/delegate`, { body: {}, headers: k.f.as(owner, role) });
      expect(r.status).toBe(403);
    }
    expect(await jobsOf(t)).toBe(0);
    expect(await k.stageOf(t)).toBe("todo");
  });

  it("K62-API-025 どれでも × 直に API × ログインしていない・セッションが切れた：401（任せる・実行の 1 件・実行の一覧）", async () => {
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    for (const [m, p] of [
      ["POST", `/tickets/${t}/delegate`],
      ["GET", `/action_runs/${d.run_id}`],
      ["GET", `/tickets/${t}/runs`],
    ] as const) {
      const r = await k.f.req(m, p, m === "POST" ? { body: {} } : {});
      expect(r.status, `${m} ${p}`).toBe(401);
    }
  });

  it("K62-API-026 どれでも × 別のワークスペースのチケット・実行の ID：404。中身を返さない", async () => {
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    for (const r of [await k.delegate(outsider, t), await k.run(outsider, d.run_id), await k.runs(outsider, t)]) {
      expect(r.status).toBe(404);
      const text = await r.text();
      expect(text).not.toContain(t);
      expect(text).not.toContain("見積");
    }
    expect(await jobsOf(t)).toBe(1);
  });

  it("K62-API-027 動いている × 実行の 1 件・実行の一覧 × 兄弟の層の人：自分の層のチケットの実行は見え、兄弟の層のチケットの実行は 404。一覧は新しい順で、数（meta.total）にも見えない実行が混ざらない", async () => {
    const mk = async (name: string, prefix: string) =>
      (
        await k.q<{ id: string }>(
          "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
          [k.T.tenantId, k.T.rootScope, name, prefix],
        )
      )[0]!.id;
    const sales = await mk("営業", "SA");
    const secret = await mk("秘密", "SC");
    const salesViewer = await k.f.person(k.T.tenantId, sales, { name: "営業の見る人", ticketAbility: "view" });
    const salesWriter = await k.f.person(k.T.tenantId, sales, { name: "営業の書く人", ticketAbility: "edit" });
    const insider = await k.f.person(k.T.tenantId, secret, { name: "秘密の人", ticketAbility: "edit" });
    await k.device(salesWriter);
    await k.device(insider);
    const hidden = await k.ticket(insider, { scope: secret });
    const hiddenRun = await delegateOk(k, insider, hidden);
    const t = await k.ticket(salesWriter, { scope: sales });
    const first = await delegateOk(k, salesWriter, t);
    await k.f.admin.query("update action_runs set status_id = 'stopped', finished_at = now() where id = $1", [
      first.run_id,
    ]);
    await k.f.admin.query("update bridge_jobs set state_id = 'stopped', finished_at = now() where id = $1", [
      first.job_id,
    ]);
    // 止まった後は段が作業中に戻る（止まったときの決まり・K62-API-054）。その形に置いてから任せ直す
    await k.f.admin.query(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = 'doing') where id = $1",
      [t],
    );
    const second = await delegateOk(k, salesWriter, t);
    const seen = await data(await k.run(salesViewer, second.run_id));
    expect(seen).toMatchObject({ id: second.run_id, ticket_id: t, status: "queued", phase: "make" });
    expect((await k.run(salesViewer, hiddenRun.run_id)).status).toBe(404);
    expect((await k.runs(salesViewer, hidden)).status).toBe(404);
    const list = await json(await k.runs(salesViewer, t));
    expect((list.data as { id: string }[]).map((x) => x.id)).toEqual([second.run_id, first.run_id]); // 新しい順
    expect((list["meta"] as { total: number }).total).toBe(2);
  });

  it("K62-API-028 どれでも × 人の口（任せる・実行の 1 件・実行の一覧）を PC の印で呼ぶ：403。中身を返さず何も積まない（PC の口を画面のセッションで呼ぶ 403 は K62-API-062）", async () => {
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    const asPc = await k.f.req("POST", `/tickets/${t}/delegate`, {
      body: {},
      headers: { "x-bridge-session": ownerPc.token },
    });
    expect(asPc.status).toBe(403);
    for (const p of [`/action_runs/${d.run_id}`, `/tickets/${t}/runs`]) {
      const r = await k.f.req("GET", p, { headers: { "x-bridge-session": ownerPc.token } });
      expect(r.status, `GET ${p}`).toBe(403);
      expect((await json(r))["data"], `GET ${p} は中身を返さない`).toBeUndefined();
    }
    expect(await jobsOf(t)).toBe(1);
  });

  it("K62-API-040 権限を付けた直後：入り直さずに、すぐ任せられる（行の決まりは毎回 DB で見る・TP-PERM-05）", async () => {
    const late = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "あとから書ける人", ticketAbility: "view" });
    await k.device(late);
    const t = await k.ticket(owner);
    expect((await k.delegate(late, t)).status).toBe(403);
    await k.f.admin.query("update permissions set ability_id = 'edit' where grantee_member_id = $1", [late.id]);
    await delegateOk(k, late, t);
  });

  it("K62-API-041 同じ人が 2 つの会社に入っている × 別の会社のチケットを任せる：つないだ 1 台の PC（アカウント全体）が取る。仕事はその会社の中で動く（D-128.137）", async () => {
    const both = await k.f.person(k.T.tenantId, k.T.rootScope, {
      name: "2 つの会社の人",
      ticketAbility: "edit",
      authUserId: `k62-${randomUUID()}`,
    });
    const pc = await k.device(both); // T でつないだ PC
    const inO = await k.f.alsoIn(both, k.O.tenantId, k.O.rootScope);
    await k.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'edit')",
      [k.O.tenantId, inO.id, k.O.rootScope],
    );
    const t = await k.ticket(inO, { scope: k.O.rootScope });
    const d = await delegateOk(k, inO, t);
    expect(d.pc).toBe("live");
    const job = await k.takeJob(pc);
    expect(job.job_id).toBe(d.job_id);
    const row = (await k.q("select tenant_id, member_id from bridge_jobs where id = $1", [d.job_id]))[0]!;
    expect(row).toMatchObject({ tenant_id: k.O.tenantId, member_id: inO.id });
  });

  it("K62-API-042 チケットの詳細（getTicket）が「任せられるか」を返す：直せる人で未着手なら true。見るだけ・実行中・承認待ち・完了は false", async () => {
    const t = await k.ticket(owner);
    const can = async (p: Person) =>
      (await data<{ can: { delegate: boolean } }>(await k.f.req("GET", `/tickets/${t}`, { headers: p.auth }))).can
        .delegate as boolean;
    expect(await can(owner)).toBe(true);
    expect(await can(mate)).toBe(true);
    expect(await can(viewer)).toBe(false);
    await delegateOk(k, owner, t);
    expect(await can(owner)).toBe(false);
    for (const stage of ["awaiting_approval", "done"]) {
      await k.f.admin.query(
        "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = $2) where id = $1",
        [t, stage],
      );
      await k.f.admin.query("update action_runs set status_id = 'done' where ticket_id = $1", [t]);
      expect(await can(owner)).toBe(false);
    }
  });
});

describe("K-62 AI に任せる：入力・失敗・操作の揺れ・守り（人が呼ぶ口）", () => {
  it("K62-API-030 入力：チケットの id・実行の id が uuid でない（任せる・実行の 1 件・実行の一覧）・本文に知らない欄：422。何も積まない", async () => {
    expect((await k.f.req("POST", "/tickets/abc/delegate", { body: {}, headers: owner.auth })).status).toBe(422);
    const t = await k.ticket(owner);
    for (const body of [{ assignee_member_id: mate.id }, { member_id: mate.id }, { prompt: "勝手に" }]) {
      const r = await k.delegate(owner, t, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect((await k.f.req("GET", "/action_runs/abc", { headers: owner.auth })).status).toBe(422);
    expect((await k.f.req("GET", "/tickets/abc/runs", { headers: owner.auth })).status).toBe(422);
    expect(await jobsOf(t)).toBe(0);
  });

  it("K62-API-068 消されたチケット × 「AI に任せる」・実行の 1 件・実行の一覧（直に API・開いたままの画面）：どれも 404。中身を返さず、何も積まない（D-129.43：実行の記録はチケットと一緒に消える）", async () => {
    // 任せたことのあるチケットを消す（止まった後）。実行の記録はチケットの詳細に残るものなので、チケットと一緒に読めなくなる
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    await k.f.admin.query("update action_runs set status_id = 'stopped', finished_at = now() where id = $1", [
      d.run_id,
    ]);
    await k.f.admin.query("update bridge_jobs set state_id = 'stopped', finished_at = now() where id = $1", [d.job_id]);
    // 任せたことの無いチケットも消す
    const fresh = await k.ticket(owner);
    await k.f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = any($1::uuid[])", [
      [t, fresh],
      owner.id,
    ]);
    for (const [what, r] of [
      ["任せる（任せたことのある）", await k.delegate(owner, t)],
      ["任せる（任せたことの無い）", await k.delegate(owner, fresh)],
      ["実行の 1 件", await k.run(owner, d.run_id)],
      ["実行の一覧", await k.runs(owner, t)],
    ] as const) {
      expect(r.status, what).toBe(404);
      const text = await r.text();
      expect(text, `${what} は中身を返さない`).not.toContain("見積");
      expect(text, `${what} は実行の id を返さない`).not.toContain(d.run_id);
    }
    // 見えている人を変えても同じ（直せる別の人も読めない）
    expect((await k.run(mate, d.run_id)).status).toBe(404);
    expect((await k.runs(mate, t)).status).toBe(404);
    expect(await jobsOf(fresh)).toBe(0);
    expect(await jobsOf(t)).toBe(1);
    expect(
      await k.n("select count(*) as n from ticket_messages where ticket_id = $1 and kind = 'system'", [fresh]),
    ).toBe(0);
  });

  it("K62-API-060 同意し直しが要るセッション（K-53 の印）：任せる・実行の 1 件・実行の一覧は 403・E-AUTH-010。中身を返さず、仕事も実行の記録も段も変わらない", async () => {
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    const other = await k.ticket(owner);
    const jobs = await k.n("select count(*) as n from bridge_jobs where member_id = $1", [owner.id]);
    for (const [m, path] of [
      ["POST", `/tickets/${other}/delegate`],
      ["GET", `/action_runs/${d.run_id}`],
      ["GET", `/tickets/${t}/runs`],
    ] as const) {
      const r = await k.f.req(m, path, { headers: k.f.pending(owner), ...(m === "POST" ? { body: {} } : {}) });
      expect(r.status, `${m} ${path}`).toBe(403);
      const j = await json(r);
      expect(j["code"], `${m} ${path}`).toBe("E-AUTH-010");
      expect(j["data"], `${m} ${path} は中身を返さない`).toBeUndefined();
    }
    expect(await jobsOf(other), "任せていない").toBe(0);
    expect(await k.stageOf(other), "段は変わらない").toBe("todo");
    expect(await k.n("select count(*) as n from bridge_jobs where member_id = $1", [owner.id]), "仕事は増えない").toBe(
      jobs,
    );
    // 同じ人でも、印の無いセッションならふつうに読める（止めたのは印のせい）
    expect((await k.f.req("GET", `/action_runs/${d.run_id}`, { headers: owner.auth })).status).toBe(200);
  });

  it("K62-API-031 失敗：任せる途中で DB の書き込みが落ちた：503・E-PAGE-003（任せる関数の例外は理由に関わらず同じ・fail-closed）。仕事・実行の記録・段の変更・やり取りの行は 1 つも残らない", async () => {
    const t = await k.ticket(owner);
    // やり取りの行（最後に書く）を書く所でわざと落とす。試験が作った引き金は finally で必ず外す（G-10）
    await k.f.admin.query(`create or replace function k62_fail_once() returns trigger language plpgsql as $$
      begin if new.ticket_id = '${t}'::uuid then raise exception 'K-62 の試験がわざと落とす'; end if; return new; end $$`);
    await k.f.admin.query(
      "create trigger k62_fail before insert on ticket_messages for each row execute function k62_fail_once()",
    );
    try {
      const r = await k.delegate(owner, t);
      expect(r.status).toBe(503);
      const text = await r.text();
      expect(JSON.parse(text)["code"]).toBe("E-PAGE-003");
      expect(text).not.toContain("わざと落とす");
    } finally {
      await k.f.admin.query("drop trigger if exists k62_fail on ticket_messages");
      await k.f.admin.query("drop function if exists k62_fail_once()");
    }
    expect(await jobsOf(t)).toBe(0);
    expect(
      await k.n(
        "select count(*) as n from bridge_jobs j where j.kind = 'ticket' and j.created_at > now() - interval '1 minute' and j.member_id = $1 and not exists (select 1 from action_runs r where r.bridge_job_id = j.id)",
        [owner.id],
      ),
    ).toBe(0);
    expect(await k.stageOf(t)).toBe("todo");
    expect(await systemLines(t)).toHaveLength(0);
  });

  it("K62-API-034 守り：任せるを 1 分に 61 回・実行の 1 件と実行の一覧を 1 分に 121 回：429 と待つ秒数", async () => {
    const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "押しすぎる人", ticketAbility: "edit" });
    await k.device(p);
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    const saved = { d: k.f.limits["delegateTicket"], g: k.f.limits["getActionRun"] };
    delete k.f.limits["delegateTicket"];
    delete k.f.limits["getActionRun"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await k.delegate(p, t); // 2 回目以降は 409（走っている）だが、回数には数える
      expect(last!.status).toBe(429);
      expect(Number((await json(last!))["retry_after_sec"])).toBeGreaterThan(0);
      for (let i = 0; i < 120; i++) await k.run(p, d.run_id);
      const over = await k.run(p, d.run_id);
      expect(over.status).toBe(429);
      expect(Number((await json(over))["retry_after_sec"])).toBeGreaterThan(0);
      delete k.f.limits["listTicketRuns"];
      for (let i = 0; i < 120; i++) await k.runs(p, t);
      const list = await k.runs(p, t);
      expect(list.status).toBe(429);
      expect(Number((await json(list))["retry_after_sec"])).toBeGreaterThan(0);
    } finally {
      k.f.limits["delegateTicket"] = saved.d!;
      k.f.limits["getActionRun"] = saved.g!;
      k.f.limits["listTicketRuns"] = 100_000;
    }
  }, 30_000); // 1 回の試験で口を 300 回ほど呼ぶ

  it("K62-API-046 守り：足した関数と直した既存の関数は security definer で search_path に pg_temp・public から外し kaname_app だけ（D-128.171）。中だけで使う app.ticket_job_context は kaname_app にも渡さず、口から呼べない。action_runs.phase は make・execute だけ", async () => {
    // 中だけで使う関数（任せる関数と K-63 の承認の関数だけが中で呼ぶ・会社も見えるかも見ない）は誰にも渡さない
    const inner = (
      await k.q<{ pub: boolean; app: boolean; definer: boolean }>(
        `select has_function_privilege('public', p.oid, 'execute') as pub,
                has_function_privilege('kaname_app', p.oid, 'execute') as app, p.prosecdef as definer
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'app' and p.proname = 'ticket_job_context'`,
      )
    )[0]!;
    expect(inner).toEqual({ pub: false, app: false, definer: true });
    const someTicket = await k.ticket(owner);
    await expect(k.f.pool.query("select app.ticket_job_context($1) as v", [someTicket])).rejects.toThrow(
      /permission denied/,
    );
    const names = [
      "ticket_delegate",
      "ticket_tool_read",
      "action_run_view",
      "ticket_runs_view",
      "bridge_take_job",
      "bridge_finish_job",
      "bridge_control",
      "bridge_tool_job",
      "bridge_sweep_orphans",
    ];
    const fns = await k.q<{ proname: string; definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
      `select p.proname, p.prosecdef as definer, p.proconfig as cfg,
              has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname = any($1)`,
      [names],
    );
    expect([...new Set(fns.map((x) => x.proname))].sort()).toEqual([...names].sort());
    for (const fn of fns) {
      expect(fn.definer, `${fn.proname} は security definer`).toBe(true);
      expect(fn.cfg?.join(",") ?? "", fn.proname).toMatch(/search_path=.*pg_temp/);
      expect(fn.pub, `${fn.proname} を public から外す`).toBe(false);
      expect(fn.app, `${fn.proname} は kaname_app に渡す`).toBe(true);
    }
    // 段の制約は、試験の中で作った実行の行で確かめる
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    await expect(k.f.admin.query("update action_runs set phase = 'other' where id = $1", [d.run_id])).rejects.toThrow();
    await k.f.admin.query("update action_runs set phase = 'execute' where id = $1", [d.run_id]); // execute は通る（K-63）
  });

  it("K62-API-057 仕事の中身を組む関数 app.ticket_job_context(チケット)：prompt（目的・完了の条件・実施事項）と、前の作る実行の agent_session_id を返す。任せる関数はこれを使う（組み方は 1 か所・K-63 も使う）", async () => {
    const t = await k.ticket(owner, { purpose: "組み方を 1 か所にする目的" });
    const ctx = async () =>
      (
        await k.q<{ v: { prompt: string; agent_session_id: string | null } }>(
          "select app.ticket_job_context($1) as v",
          [t],
        )
      )[0]!.v;
    const first = await ctx();
    expect(first.prompt).toContain("組み方を 1 か所にする目的");
    expect(first.prompt).toContain("金額と内訳がそろっている");
    expect(first.prompt).toContain("前回の見積を読む");
    expect(first.agent_session_id).toBeNull();
    const d = await delegateOk(k, owner, t);
    const row = (await k.q<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [d.job_id]))[0]!;
    expect(row.prompt).toBe(first.prompt); // 任せる関数は同じ関数で組む
    await k.f.admin.query(
      "update bridge_jobs set state_id = 'stopped', agent_session_id = 'sess-ctx-1', finished_at = now() where id = $1",
      [d.job_id],
    );
    await k.f.admin.query("update action_runs set status_id = 'stopped', finished_at = now() where id = $1", [
      d.run_id,
    ]);
    expect((await ctx()).agent_session_id).toBe("sess-ctx-1");
  });

  it("K62-API-058 実行の 1 件の return_reason：差し戻しの後の作り直し（phase make・approval_id に差し戻した承認・K-63 が入れる）なら、その承認の差し戻す理由を返す。はじめの作成では null", async () => {
    const t = await k.ticket(owner);
    const first = await delegateOk(k, owner, t);
    expect((await data<{ return_reason: string | null }>(await k.run(owner, first.run_id))).return_reason).toBeNull();
    // K-63 が差し戻したときの形を DB に置く：差し戻した承認と、作り直しの実行の approval_id
    const ap = (
      await k.q<{ id: string }>(
        `insert into approvals (tenant_id, scope_id, ticket_id, kind, action_run_id, approver_member_id, status_id, decision, decided_at, return_reason)
         values ($1, $2, $3, 'artifact', $4, $5, 'returned', 'return', now(), '<b>金額</b>が違います') returning id`,
        [k.T.tenantId, k.T.rootScope, t, first.run_id, owner.id],
      )
    )[0]!.id;
    await k.f.admin.query("update action_runs set status_id = 'done', finished_at = now() where id = $1", [
      first.run_id,
    ]);
    await k.f.admin.query("update bridge_jobs set state_id = 'done', finished_at = now() where id = $1", [
      first.job_id,
    ]);
    await k.f.admin.query(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = 'doing') where id = $1",
      [t],
    );
    const remake = await delegateOk(k, owner, t);
    await k.f.admin.query("update action_runs set approval_id = $2 where id = $1", [remake.run_id, ap]);
    const v = await data<{ return_reason: string | null; phase: string }>(await k.run(owner, remake.run_id));
    expect(v).toMatchObject({ phase: "make", return_reason: "<b>金額</b>が違います" }); // 文字のまま返す（画面が文字として出す）
    const list = await data<{ id: string; return_reason: string | null }[]>(await k.runs(owner, t));
    expect(list.find((x) => x.id === remake.run_id)!.return_reason).toBe("<b>金額</b>が違います");
    expect(list.find((x) => x.id === first.run_id)!.return_reason).toBeNull();
  });

  it("K62-API-059 0092 が足す列 action_runs.approval_id：在る（uuid）・approvals への外部キー・索引がある（足すのは K-62 の 0092 だけ・K-63 の migration では足さない）", async () => {
    const col = await k.q<{ data_type: string }>(
      "select data_type from information_schema.columns where table_name = 'action_runs' and column_name = 'approval_id'",
    );
    expect(col).toEqual([{ data_type: "uuid" }]);
    const fk = await k.q<{ ref: string }>(
      `select confrelid::regclass::text as ref from pg_constraint
        where conrelid = 'action_runs'::regclass and contype = 'f'
          and conkey = array[(select attnum from pg_attribute where attrelid = 'action_runs'::regclass and attname = 'approval_id')]`,
    );
    expect(fk.map((x) => x.ref)).toEqual(["approvals"]);
    expect(
      await k.n(
        "select count(*) as n from pg_indexes where tablename = 'action_runs' and indexdef like '%(approval_id)%'",
      ),
    ).toBeGreaterThanOrEqual(1);
    // 無い承認の id は入れられない（外部キー）
    const t = await k.ticket(owner);
    const d = await delegateOk(k, owner, t);
    await expect(
      k.f.admin.query("update action_runs set approval_id = gen_random_uuid() where id = $1", [d.run_id]),
    ).rejects.toThrow();
  });

  it("K62-API-052 失敗：任せる関数を呼べない（権限が外れた）：503・E-PAGE-003。何も積まない（fail-closed・K62-API-031 と同じ決まり）", async () => {
    const t = await k.ticket(owner);
    // 試験が外した権限は finally で必ず戻す（G-10）
    await k.f.admin.query("revoke execute on function app.ticket_delegate(uuid, text) from kaname_app");
    try {
      const r = await k.delegate(owner, t);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("grant execute on function app.ticket_delegate(uuid, text) to kaname_app");
    }
    expect(await jobsOf(t)).toBe(0);
    expect(await k.stageOf(t)).toBe("todo");
  });
});
