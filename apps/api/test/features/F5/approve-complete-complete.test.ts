// K-165「完了にする」の単体の試験（口・本物の DB・本物の PC の印）。親 K-63 の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま・11_tickets/K-165.md の表のマスと分岐に 1 対 1）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
import { describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  setupApproveComplete,
  SKIPPED,
  CONF_STAGE,
  CONF_TODO_CHANGED,
  CONF_ALREADY,
  VAL_TODO_LEFT,
  VAL_NOT_CONFIRMED,
  VAL_CHILDREN,
  f,
  T,
  boss,
  writer,
  viewer,
  manager,
  json,
  one,
  num,
  complete,
  stageOf,
  stageKeyOf,
  team,
  ticket,
  jobOf,
  messagesOf,
  approved,
  executed,
  todoVersion,
  completeBody,
  details,
  snapshot,
  auth,
  req,
  STOP_24H,
  STOP_GONE,
  approve,
  giveBack,
  delegated,
  detail,
  take,
  finish,
  runsOf,
  openApprovals,
} from "./approve-complete.harness.js";

setupApproveComplete();

describe("K-63 承認して完了する：完了（口・本物の DB）", () => {
  it("K63-API-027 作業中（実行が終わった）× 完了にする × 担当者：完了の段・completed_at と completed_by・やり取りに 1 行・受け箱に知らせ（作った人へ）・候補はまだ。実施事項の区画は書き換えない（K-566・版も字も同じ）", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    const v = await todoVersion(t.id);
    const r = await complete(boss, t.id, await completeBody(t));
    expect(r.status, await r.clone().text()).toBe(201);
    const data = (await json(r)).data as Record<string, unknown>;
    expect(data["knowledge_candidates"]).toEqual([]);
    expect(data["skipped_reason"]).toBe(SKIPPED);
    expect(data["ticket"]).toMatchObject({ id: t.id, number: t.number, stage_key: "done", completed_by: boss.id });
    expect(await stageKeyOf(t.id)).toBe("done");
    const row = await one<{ completed_at: string | null; completed_by: string | null }>(
      "select completed_at, completed_by from tickets where id = $1",
      [t.id],
    );
    expect(row.completed_at).not.toBeNull();
    expect(row.completed_by).toBe(boss.id);
    const todo = await one<{ version: number; text: string }>(
      "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'todo'",
      [t.id],
    );
    expect(todo.version).toBe(v);
    expect(todo.text).toBe("- 請求書を作る\n- 先方に送る");
    expect(
      await num(
        "select count(*) as n from ticket_section_versions v join ticket_sections s on s.id = v.section_id where s.ticket_id = $1 and s.section_key = 'todo'",
        [t.id],
      ),
    ).toBe(1);
    expect((await messagesOf(t.id)).at(-1)!.body).toContain("高本が完了にしました");
    const n = await f.admin.query<{ member_id: string; channel_id: string; sent_at: string | null }>(
      "select member_id, channel_id, sent_at from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1",
      [`%ticket.completed:${t.id}`],
    );
    expect(n.rows.map((x) => x.member_id)).toEqual([writer.id]); // 作った人へ。押した本人（担当者）には出さない
    expect(n.rows[0]!.channel_id).toBe("inapp");
    expect(n.rows[0]!.sent_at).not.toBeNull();
    expect(
      await num("select count(*) as n from audit_events where action = 'ticket.complete' and target_id = $1", [t.id]),
    ).toBe(1);
  });

  it("K63-API-028 作業中・チェックが残っている × 完了にする：止めない（K-566）。conditions_confirmed だけで 201 になり、E-VAL-022・E-CONF-017 は出ない。済み（- [x]）も未済みも区画は書き換えない（todo_checked・todo_version は送らない）", async () => {
    for (let i = 0; i < 2; i += 1) {
      const t = await ticket();
      await executed(t);
      const v = await todoVersion(t.id);
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status, await r.clone().text()).toBe(201);
      expect(JSON.stringify(await json(r))).not.toContain(VAL_TODO_LEFT);
      expect(await stageKeyOf(t.id)).toBe("done");
      expect(await todoVersion(t.id)).toBe(v);
    }
    const mixed = await ticket({ todo: "- 請求書を作る\n- [x] 先方に送る" });
    await executed(mixed);
    const r = await complete(boss, mixed.id, await completeBody(mixed));
    expect(r.status, await r.clone().text()).toBe(201);
    const todo = await one<{ text: string }>(
      "select body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'todo'",
      [mixed.id],
    );
    expect(todo.text).toBe("- 請求書を作る\n- [x] 先方に送る");
  });

  it("K63-API-029 作業中・完了の条件を確かめていない × 完了にする：422・E-VAL-023（欄 conditions_confirmed）", async () => {
    const t = await ticket();
    await executed(t);
    for (const c of [false, undefined]) {
      const b = await completeBody(t, { conditions_confirmed: c });
      if (c === undefined) delete (b as Record<string, unknown>)["conditions_confirmed"];
      const r = await complete(boss, t.id, b);
      expect(r.status).toBe(422);
      const j = await json(r);
      expect(details(j).map((x) => x.field)).toContain("conditions_confirmed");
    }
    const r = await complete(boss, t.id, await completeBody(t, { conditions_confirmed: false }));
    expect(JSON.stringify(await json(r))).toContain(VAL_NOT_CONFIRMED);
    expect(await stageKeyOf(t.id)).toBe("doing");
  });

  it("K63-API-030 作業中・終わっていない子がある × 完了にする：422・E-VAL-024・子の番号と題名。子が完了すれば親も完了にできる", async () => {
    const parent = await ticket();
    const child = await ticket({ parent: parent.id, title: "宛名を確かめる", stage: "doing", todo: null });
    const doneChild = await ticket({ parent: parent.id, title: "もう終わった子", stage: "done", todo: null });
    const goneChild = await ticket({ parent: parent.id, title: "消した子", stage: "doing", todo: null });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [goneChild.id]);
    const r = await complete(boss, parent.id, await completeBody(parent));
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(JSON.stringify(j)).toContain(VAL_CHILDREN);
    const kids = details(j)
      .filter((x) => x.field === "children")
      .map((x) => x.message);
    expect(kids).toEqual([`${child.number} 宛名を確かめる`]);
    expect(JSON.stringify(kids)).not.toContain(doneChild.number);
    expect(await stageKeyOf(parent.id)).toBe("doing");
    const c = await complete(boss, child.id, { conditions_confirmed: true });
    expect(c.status, await c.clone().text()).toBe(201);
    expect((await complete(boss, parent.id, await completeBody(parent))).status).toBe(201);
  });

  it("K63-API-031 承認待ち・実行中・確認中・走っている実行がある × 完了にする：409・E-CONF-016・何も変えない", async () => {
    for (const stage of ["awaiting_approval", "running", "checking"]) {
      const t = await ticket({ stage });
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status, stage).toBe(409);
      expect((await json(r))["code"]).toBe(CONF_STAGE);
      expect(await stageKeyOf(t.id)).toBe(stage);
    }
    // 段は作業中でも、実行の記録が待っている（queued）なら完了にできない
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update tickets set stage_id = $2 where id = $1", [t.id, await stageOf(T.tenantId, "doing")]);
    const r = await complete(boss, t.id, await completeBody(t));
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_STAGE);
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
  });

  it("K63-API-032 完了 × 完了にするをもう一度：同じ冪等キーなら最初の結果。別のキーなら 409・E-CONF-018。知らせは 1 つ", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    const b = await completeBody(t);
    const r1 = await complete(boss, t.id, b, { key: "complete-1" });
    expect(r1.status).toBe(201);
    const r2 = await complete(boss, t.id, b, { key: "complete-1" });
    expect(r2.status).toBe(201);
    expect(await r2.json()).toEqual(await r1.json());
    const r3 = await complete(boss, t.id, await completeBody(t), { key: "complete-2" });
    expect(r3.status).toBe(409);
    expect((await json(r3))["code"]).toBe(CONF_ALREADY);
    expect(
      await num(
        "select count(*) as n from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1",
        [`%ticket.completed:${t.id}`],
      ),
    ).toBe(1);
  });

  it("K63-API-033 作業中 × 完了にする × 担当者でないが直せる（書ける人・マネージャー）：完了できる。completed_by に押した人・知らせは担当者へ", async () => {
    for (const who of [writer, manager]) {
      const t = await ticket({ creator: (await team("作った人")).by });
      await executed(t);
      const r = await complete(who, t.id, await completeBody(t));
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await one<{ by: string }>("select completed_by as by from tickets where id = $1", [t.id])).by).toBe(
        who.id,
      );
      const to = (
        await f.admin.query<{ member_id: string }>(
          "select member_id from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1 order by member_id",
          [`%ticket.completed:${t.id}`],
        )
      ).rows.map((x) => x.member_id);
      expect(to).toContain(boss.id);
      expect(to).not.toContain(who.id);
    }
  });

  it("K63-API-034 作業中 × 完了にする × 見るだけの権限：403・何も変えない", async () => {
    const t = await ticket();
    await executed(t);
    const before = await snapshot(t);
    const r = await complete(viewer, t.id, await completeBody(t));
    expect(r.status).toBe(403);
    expect(await snapshot(t)).toEqual(before);
  });

  it("K63-API-035 作業中・開いた後に実施事項が書き換わった × 完了にする：止めない（K-566）。版を送らなくても 201 で、E-CONF-017 は出ない（todo_version は送らない）", async () => {
    const t = await ticket();
    await executed(t);
    const old = await completeBody(t);
    await f.admin.query(
      "update ticket_sections set body = jsonb_build_object('text', '- 請求書を作る' || chr(10) || '- 先方に電話する' || chr(10) || '- 先方に送る'), version = version + 1 where ticket_id = $1 and section_key = 'todo'",
      [t.id],
    );
    const r = await complete(boss, t.id, old);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(JSON.stringify(await json(r))).not.toContain(CONF_TODO_CHANGED);
    expect(await stageKeyOf(t.id)).toBe("done");
  });
});

describe("K-63 承認して完了する：入力・失敗・守り（口・本物の DB）", () => {
  it("K63-API-043 失敗 × 完了の途中で DB が落ちた（証跡を書く所）：503・E-PAGE-003。段は変わらず、知らせも出ない", async () => {
    const t = await ticket({ title: "K63 壊れる 完了", creator: writer });
    await executed(t);
    await f.admin.query(`create or replace function app.k63_boom2() returns trigger language plpgsql as $$
      begin
        if new.action = 'ticket.complete' and exists (select 1 from tickets x where x.id::text = new.target_id and x.title like 'K63 壊れる%') then
          raise exception 'K63 の試験で壊した';
        end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k63_boom2 before insert on audit_events for each row execute function app.k63_boom2()",
    );
    try {
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status).toBe(503);
      expect(((await r.json()) as { code?: string }).code).toBe("E-PAGE-003");
      expect(await stageKeyOf(t.id)).toBe("doing");
      expect(
        (await one<{ c: string | null }>("select completed_at as c from tickets where id = $1", [t.id])).c,
      ).toBeNull();
      expect(
        await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
      ).toBe(0);
    } finally {
      await f.admin.query("drop trigger if exists k63_boom2 on audit_events");
      await f.admin.query("drop function if exists app.k63_boom2()");
    }
  });

  it("K63-API-052 守り × 完了の関数を直に呼ぶ × 見るだけの人：書かない（守りの 2 層目）", async () => {
    const t = await ticket();
    await executed(t);
    const ctx: TenantContext = { tenantId: T.tenantId, userId: viewer.id, role: "member", stepUpAt: null };
    // 関数の引数の数は葉の時点で違う（区画の道が在る間は 4 つ・K-578 の後は 2 つ）ので、在る引数の数に合わせて呼ぶ
    const n = Number(
      (
        await f.admin.query<{ n: number }>(
          "select p.pronargs as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'app' and p.proname = 'ticket_complete'",
        )
      ).rows[0]!.n,
    );
    const out = await withTenant(f.pool, ctx, (cl) =>
      n === 4
        ? cl.query<{ v: { error?: string } }>(
            "select app.ticket_complete($1, null::integer[], null::integer, true) as v",
            [t.id],
          )
        : cl.query<{ v: { error?: string } }>("select app.ticket_complete($1, true) as v", [t.id]),
    );
    expect(out.rows[0]!.v.error).toBe("not_writable");
    expect(await stageKeyOf(t.id)).toBe("doing");
  });
});

describe("K-63 承認して完了する：積む仕事の中身（口・本物の DB）", () => {
  it("K63-API-065 入力 × 完了の todo_checked の形の誤り（文字の並び）：422・段は変わらない（区画の道が在っても無くても同じ）", async () => {
    const t = await ticket();
    await executed(t);
    const bad = await complete(boss, t.id, await completeBody(t, { todo_checked: ["a"] }));
    expect(bad.status).toBe(422);
    expect(await stageKeyOf(t.id)).toBe("doing");
  });

  it("K63-API-080 作業中（実行が終わった）・完了 × チケットの詳細を読む（本物の DB）：作業中は can.complete が直せる人で true・見るだけの人で false。完了の後は can.complete が false で completed に時刻と押した人の名前", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    const read = async (p: Person) => {
      const r = await req("GET", `/tickets/${t.id}`, { headers: auth(p) });
      expect(r.status, await r.clone().text()).toBe(200);
      return (await json(r)).data as Record<string, unknown>;
    };
    const canOf = (d: Record<string, unknown>) => (d["can"] as Record<string, unknown>)["complete"];
    expect(canOf(await read(boss))).toBe(true);
    expect(canOf(await read(viewer))).toBe(false);
    expect((await complete(boss, t.id, await completeBody(t))).status).toBe(201);
    const after = await read(boss);
    expect(canOf(after)).toBe(false);
    expect(after["completed"]).toMatchObject({ by: "高本" });
    expect((after["completed"] as Record<string, unknown>)["at"]).toBeTruthy();
  });
});

// 決める人の答え answer=b01eda354e6c（2026-11-13）①：承認の後の実行が終わった・止まった・24 時間で聞き直しになったら、
//   チケットの「AI に任せている」印（tickets.delegated_to_clone）を外す。もう一度任せたいときは人が改めて「AI に任せる」を押す。
//   決める人の答え answer=5f6abe0aec7b（2026-11-13）：印を外した後でも、人が承認・差し戻しをして AI がまた動くなら印を付け直す。はじめから止まった形で積むときは外す。
//   作る段（承認の前）と、承認待ち・実行待ち・実行中の間は今までどおり印を変えない（作る段で下ろすのは K-62 の API-080 の 3 か所のまま）
describe("K-63 承認して完了する：実行の結末と「AI に任せている」印（口・本物の DB）", () => {
  const flagOf = async (ticketId: string) =>
    (await one<{ v: boolean }>("select delegated_to_clone as v from tickets where id = $1", [ticketId])).v;
  /** チケットの詳細（getTicket）の can.delegate＝「AI に任せる」を押せるか */
  const canDelegate = async (p: Person, ticketId: string) => {
    const r = await req("GET", `/tickets/${ticketId}`, { headers: auth(p) });
    expect(r.status, await r.clone().text()).toBe(200);
    return (((await json(r)).data as Record<string, unknown>)["can"] as Record<string, unknown>)["delegate"];
  };
  const toView = (memberId: string) =>
    f.admin.query("update permissions set ability_id = 'view' where grantee_member_id = $1", [memberId]);

  it("K63-API-086 承認の後の実行が中身のある結果で終わった × 任せている印：実行中は true・終わったら tickets.delegated_to_clone が false。can.delegate は true に戻り、もう一度「AI に任せる」を押すと 201 で印が true に戻る（決める人の答え answer=b01eda354e6c）", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    expect(await flagOf(t.id)).toBe(true);
    await finish(a.pc, a.execJobId, {
      state: "done",
      result: "送りました（宛先：先方の経理）",
      agent_session_id: a.agentSession,
    });
    expect((await runsOf(t.id, "execute"))[0]!.status_id).toBe("done");
    expect(await flagOf(t.id)).toBe(false);
    expect(await canDelegate(boss, t.id)).toBe(true);
    // 人が改めて任せる：通り、印が立ち直る
    const r = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(a.by) });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await flagOf(t.id)).toBe(true);
    expect(await stageKeyOf(t.id)).toBe("running");
  });

  it("K63-API-087 承認の後の実行が止まった（空の結果・PC が止まったと返す・PC でやめた・PC が落ちてつながり直した）× 任せている印：どれも false になり、チケットは作業中・can.delegate は true", async () => {
    type Approved = Awaited<ReturnType<typeof approved>>;
    const ends: [string, (a: Approved) => Promise<unknown>, string][] = [
      [
        "空の結果",
        (a) => finish(a.pc, a.execJobId, { state: "done", result: "   ", agent_session_id: a.agentSession }),
        "stopped",
      ],
      [
        "PC が止まったと返す",
        (a) =>
          finish(a.pc, a.execJobId, {
            state: "stopped",
            reason: "Claude Code の使える量の上限に当たったので止まりました。18:00 に戻ります",
            agent_session_id: a.agentSession,
          }),
        "stopped",
      ],
      ["PC でやめた", (a) => finish(a.pc, a.execJobId, { state: "cancelled" }), "cancelled"],
      ["PC が落ちてつながり直した", (a) => take(a.pc, { idle: true }), "stopped"],
    ];
    for (const [name, end, status] of ends) {
      const t = await ticket();
      const a = await approved(t);
      expect((await take(a.pc))?.id, name).toBe(a.execJobId);
      expect(await flagOf(t.id), `${name}：実行中は true`).toBe(true);
      await end(a);
      expect((await runsOf(t.id, "execute"))[0]!.status_id, name).toBe(status);
      expect(await flagOf(t.id), `${name}：止まったら false`).toBe(false);
      expect(await stageKeyOf(t.id), name).toBe("doing");
      expect(await canDelegate(boss, t.id), name).toBe(true);
    }
  });

  it("K63-API-088 承認の後の実行待ちが片付けで止まった（任せた人が直せなくなった・チケットが消された）・任せた人が止められた × 任せている印：どれも false になる。消されていないチケットは作業中で can.delegate は true", async () => {
    // 任せた人が直せなくなった：読んだときの片付けで止まる
    const lostBy = await team("印を下ろす：直せなくなった人");
    const lost = await ticket();
    const l = await approved(lost, { by: lostBy });
    await toView(lostBy.by.id);
    expect(await flagOf(lost.id)).toBe(true);
    expect(await canDelegate(boss, lost.id)).toBe(true); // 読む前の片付けで止まり、その答えで押せる
    expect((await jobOf(l.execJobId))["state_id"]).toBe("stopped");
    expect(await flagOf(lost.id)).toBe(false);
    expect(await stageKeyOf(lost.id)).toBe("doing");
    // チケットが消された：PC が取りに来たときの片付けで止まる
    const gone = await ticket();
    const g = await approved(gone);
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [gone.id, boss.id]);
    expect((await take(g.pc))?.id).not.toBe(g.execJobId);
    expect(String((await jobOf(g.execJobId))["stopped_reason"])).toContain(STOP_GONE);
    expect(await flagOf(gone.id)).toBe(false);
    // 任せた人が止められた：止めた時点で仕事が止まる（K-164 の app.on_member_stopped）
    const susBy = await team("印を下ろす：止められた人");
    const sus = await ticket();
    const s = await approved(sus, { by: susBy });
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      susBy.by.id,
      boss.id,
    ]);
    expect((await jobOf(s.execJobId))["state_id"]).toBe("stopped");
    expect(await flagOf(sus.id)).toBe(false);
    expect(await stageKeyOf(sus.id)).toBe("doing");
    expect(await canDelegate(boss, sus.id)).toBe(true);
  });

  it("K63-API-089 承認から 24 時間を過ぎて聞き直しになった × 任せている印：false になる。チケットは承認待ち・聞き直しの承認待ちが 1 つ・can.delegate は false（承認待ちの間は任せられない）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    expect(await flagOf(t.id)).toBe(true);
    expect((await detail(boss, a.approvalId)).status).toBe(200); // 読む前の片付けで聞き直しになる
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H });
    expect(await flagOf(t.id)).toBe(false);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await openApprovals(t.id)).toBe(1);
    expect(await canDelegate(boss, t.id)).toBe(false);
  });

  it("K63-API-090 承認した時点で任せた人が使えない（直せなくなった・PC をつないでいない）× 任せている印：実行ははじめから止まった形で積まれ、印は false・チケットは作業中・can.delegate は true", async () => {
    const lostBy = await team("印を下ろす：承認の前に直せなくなった人");
    const noPc = await f.person(T.tenantId, T.rootScope, { name: "印を下ろす：PC の無い人", ticketAbility: "edit" });
    const cases: [string, Parameters<typeof delegated>[1], () => Promise<unknown>][] = [
      ["直せなくなった", { by: lostBy }, () => toView(lostBy.by.id)],
      ["PC をつないでいない", { by: { by: noPc, pc: { token: "", sid: "" } } }, () => Promise.resolve()],
    ];
    for (const [name, o, spoil] of cases) {
      const t = await ticket();
      const d = await delegated(t, o);
      await spoil();
      expect(await flagOf(t.id), `${name}：承認待ちの間は true`).toBe(true);
      expect((await approve(boss, d.approvalId)).status, name).toBe(201);
      expect((await runsOf(t.id, "execute"))[0]!.status_id, name).toBe("stopped");
      expect(await flagOf(t.id), `${name}：はじめから止まったら false`).toBe(false);
      expect(await stageKeyOf(t.id), name).toBe("doing");
      expect(await canDelegate(boss, t.id), name).toBe(true);
    }
  });

  it("K63-API-091 印を変えない所 × 作る段が終わって承認待ち・承認した直後（実行待ち）・PC が取った（実行中）・差し戻して作り直しの間：tickets.delegated_to_clone は true のまま", async () => {
    // 本物の「AI に任せる」→ PC が作る段を中身のある結果で終える：承認待ちになり、印は true のまま（作る段の仕事の終わりでは下ろさない）
    const tm = await team("印を変えない：作る段の人");
    const made = await ticket();
    const r = await req("POST", `/tickets/${made.id}/delegate`, { body: {}, headers: auth(tm.by) });
    expect(r.status, await r.clone().text()).toBe(201);
    const makeJob = String(((await json(r)).data as Record<string, unknown>)["job_id"]);
    expect((await take(tm.pc))?.id).toBe(makeJob);
    await finish(tm.pc, makeJob, { state: "done", result: "下書きができました" });
    expect(await stageKeyOf(made.id)).toBe("awaiting_approval");
    expect(await flagOf(made.id)).toBe(true);
    // 承認した直後（実行待ち）・PC が取った（実行中）
    const t = await ticket();
    const a = await approved(t);
    expect(await flagOf(t.id)).toBe(true);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    expect(await flagOf(t.id)).toBe(true);
    // 差し戻して作り直しの仕事が積まれた（作る段に戻る）
    const u = await ticket();
    const d = await delegated(u);
    expect((await giveBack(boss, d.approvalId, "宛先を直してください")).status).toBe(201);
    expect(await flagOf(u.id)).toBe(true);
  });

  it("K63-API-092 承認待ち・任せた人がチケットを直せなくなった × 差し戻す × 任せている印：作り直しははじめから止まった形で積まれ、印は false・チケットは作業中・can.delegate は true（作る段が止まったら印を下ろす・K-62 の決まりと同じ向き）", async () => {
    const lostBy = await team("印を下ろす：差し戻しの前に直せなくなった人");
    const t = await ticket();
    const d = await delegated(t, { by: lostBy });
    await toView(lostBy.by.id);
    expect(await flagOf(t.id)).toBe(true);
    expect((await giveBack(boss, d.approvalId, "宛先を直してください")).status).toBe(201);
    expect((await runsOf(t.id, "make")).at(-1)!.status_id).toBe("stopped");
    expect(await flagOf(t.id)).toBe(false);
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await canDelegate(boss, t.id)).toBe(true);
  });

  /** 承認の後の実行待ちを 24 時間の聞き直しにして（印は外れる）、聞き直しの承認待ちの id を返す */
  const reasked = async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    expect((await detail(boss, a.approvalId)).status).toBe(200); // 読む前の片付けで聞き直しになる
    expect(await flagOf(t.id)).toBe(false);
    const again = await one<{ id: string }>(
      "select id from approvals where ticket_id = $1 and decision is null and withdrawn_at is null and deleted_at is null",
      [t.id],
    );
    expect(again.id).not.toBe(a.approvalId);
    return { t, a, againId: again.id };
  };

  it("K63-API-093 24 時間の聞き直し（印は外れている）× 聞き直しを承認する：実行の仕事がもう一度積まれ、印は true に付け直る・チケットは実行中（AI がまた動くなら付け直す・決める人の答え answer=5f6abe0aec7b）", async () => {
    const { t, a, againId } = await reasked();
    expect((await approve(boss, againId)).status).toBe(201);
    const last = (await runsOf(t.id, "execute")).at(-1)!;
    expect(last.id).not.toBe(a.execRunId);
    expect(last.status_id).toBe("queued");
    expect(await flagOf(t.id)).toBe(true);
    expect(await stageKeyOf(t.id)).toBe("running");
  });

  it("K63-API-094 24 時間の聞き直し（印は外れている）× 聞き直しを差し戻す：作り直しの仕事が積まれ、印は true に付け直る・チケットは実行中（決める人の答え answer=5f6abe0aec7b）", async () => {
    const { t, againId } = await reasked();
    const makes = (await runsOf(t.id, "make")).length;
    expect((await giveBack(boss, againId, "宛先を直してください")).status).toBe(201);
    const runs = await runsOf(t.id, "make");
    expect(runs).toHaveLength(makes + 1);
    expect(runs.at(-1)!.status_id).toBe("queued");
    expect(await flagOf(t.id)).toBe(true);
    expect(await stageKeyOf(t.id)).toBe("running");
  });
});
