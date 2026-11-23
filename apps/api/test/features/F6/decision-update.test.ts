// K-391「決定を改める・取り消す口（updateTicketDecision）」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K391-API-…）は 11_tickets/K-391.md の表と 1 対 1。土台・道具・決めた文は ./decisions.harness.ts（K-390 が運んだ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   準備の決定の行は DB に直に置く（足す口を準備に使わない）。読み直しは K-390 の読む口（listTicketDecisions）と表。
import { describe, expect, it } from "vitest";
import type pg from "pg";
import type { Hook } from "../../../src/contract/deps.js";
import {
  setupDecisions,
  VAL_TEXT,
  VAL_CANCEL,
  CONF_REVISED,
  CONF_CANCELLED,
  DECISION_KIND,
  f,
  T,
  boss,
  writer,
  viewer,
  outsider,
  json,
  one,
  fields,
  asMember,
  ticket,
  post,
  decision,
  list,
  change,
  decisionsOf,
  changeLines,
  notices,
  snapshot,
  breakWritable,
} from "./decisions.harness.js";

setupDecisions(["ticket-decisions", "ticket-decision-update"], {
  // K-391 が作る hooks のファイル（updateTicketDecision）
  "ticket-decision-update": async () => {
    const m = (await import("../../../src/hooks/ticket-decision-update.js")) as {
      ticketDecisionUpdateHooks: (p: pg.Pool) => Record<string, Hook>;
    };
    return m.ticketDecisionUpdateHooks(f.pool);
  },
});

type Decision = Record<string, unknown> & { id: string };
const ok = async (r: Response) => {
  expect(r.status, await r.clone().text()).toBe(200);
  return (await json(r)).data as { decision: Decision; previous: Decision | null; message_id: string };
};
const listed = async (ticketId: string) => ((await json(await list(boss, ticketId))).data ?? []) as Decision[];

describe("K-391 決定を改める", () => {
  it("K391-API-001 担当者でない書ける人が改める：200・新しい行（決めた人は本人・理由）と、古い行に改めた先の印・古い字は変わらない・やり取りに 1 行・一覧は新しい方が先で古い方は「改められた」・previous と decision はどちらも決定の 12 の鍵", async () => {
    const t = await ticket();
    const old = await decision(t, { text: "支払いは月末", agoMin: 30 });
    const d = await ok(
      await change(writer, old, { action: "revise", text: "支払いは翌月末", reason: "先方の締めに合わせる" }),
    );
    expect(Object.keys(d).sort()).toEqual(["decision", "message_id", "previous"]);
    expect(d.decision).toMatchObject({
      text: "支払いは翌月末",
      reason: "先方の締めに合わせる",
      decided_by: { id: writer.id, display_name: "佐藤" },
      revises_id: old,
      superseded_by_id: null,
      cancelled: null,
    });
    expect(d.previous).toMatchObject({ id: old, text: "支払いは月末", superseded_by_id: d.decision.id });
    // 改めた行（previous）も新しい行も、K-390 の決定と同じ 12 の鍵
    const KEYS = [
      "cancelled",
      "decided_at",
      "decided_by",
      "decided_note",
      "id",
      "promoted_to",
      "reason",
      "revises_id",
      "source",
      "superseded_by_id",
      "text",
      "ticket_id",
    ];
    expect(Object.keys(d.previous!).sort()).toEqual(KEYS);
    expect(Object.keys(d.decision).sort()).toEqual(KEYS);
    const rows = await decisionsOf(t.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === old)).toMatchObject({ text: "支払いは月末", superseded_by_id: d.decision.id });
    const ls = await changeLines(t.id);
    expect(ls.map((l) => l.body)).toEqual(["佐藤 が決定を改めた"]);
    expect(ls[0]!.changes).toEqual([{ field: "decision", from: old, to: d.decision.id, note: "revise" }]);
    expect((await listed(t.id)).map((x) => x.id)).toEqual([d.decision.id, old]);
  });

  it("K391-API-002 新しい決定が空・空白だけ（全角）・欄が無い：422 E-VAL-042・欄 text・何も書かない", async () => {
    const t = await ticket();
    const old = await decision(t);
    const before = await snapshot(t.id);
    for (const body of [{ action: "revise", text: "" }, { action: "revise", text: "　 " }, { action: "revise" }]) {
      const r = await change(boss, old, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const j = await json(r);
      expect(j["code"], JSON.stringify(body)).toBe(VAL_TEXT);
      expect(fields(j)).toEqual(["text"]);
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K391-API-003 新しい決定 5000 字：200・切らずに全文", async () => {
    const t = await ticket();
    const old = await decision(t);
    const text = `頭${"改".repeat(4998)}尾`;
    const d = await ok(await change(boss, old, { action: "revise", text }));
    expect(d.decision["text"]).toBe(text);
  });

  it("K391-API-004 もう改められた決定を改める：409 E-CONF-031（㉒ の文）・新しい行は増えない", async () => {
    const t = await ticket();
    const newer = await decision(t, { text: "翌月末", agoMin: 5 });
    const old = await decision(t, { text: "月末", agoMin: 30, superseded: newer });
    const before = await snapshot(t.id);
    const r = await change(boss, old, { action: "revise", text: "翌々月" });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(CONF_REVISED);
    expect(String(j["message"])).toBe("この決定は、いま別の人が改めました。読み直してから、もう一度お試しください");
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K391-API-005 同時に 2 人が同じ決定を改める：200 が 1 つ・409 E-CONF-031 が 1 つ・新しい行は 1 つだけ", async () => {
    const t = await ticket();
    const old = await decision(t);
    const rs = await Promise.all([
      change(boss, old, { action: "revise", text: "案 A" }),
      change(writer, old, { action: "revise", text: "案 B" }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const lost = rs.find((r) => r.status === 409)!;
    expect((await json(lost))["code"]).toBe(CONF_REVISED);
    expect(await decisionsOf(t.id)).toHaveLength(2);
  });
});

describe("K-391 決定を取り消す", () => {
  it("K391-API-017 取り消した決定の元の書き込みは「決定にした」でなくなる（やり取りの message.decided の関数 app.ticket_message_decided が false・K-383 の関数をこの葉が作り直す）。改めた決定の元は true のまま", async () => {
    const t = await ticket();
    const cancelSrc = await post(t, writer, "郵送もしてほしいと先方から");
    const reviseSrc = await post(t, writer, "支払いは翌月末でよいと先方から");
    const put = async (text: string, src: string) =>
      (
        await one<{ id: string }>(
          "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by, source_message_id, created_by) values ($1, $2, $3, $4, $5, $4) returning id",
          [t.tenant, t.id, text, boss.id, src],
        )
      ).id;
    const decidedOf = async (m: string) =>
      (await one<{ v: boolean }>("select app.ticket_message_decided($1) as v", [m])).v;
    const toCancel = await put("郵送もする", cancelSrc);
    const toRevise = await put("支払いは翌月末", reviseSrc);
    expect(await decidedOf(cancelSrc)).toBe(true);
    expect(await decidedOf(reviseSrc)).toBe(true);
    await ok(await change(writer, toCancel, { action: "cancel", reason: "先方が不要と" }));
    await ok(
      await change(writer, toRevise, { action: "revise", text: "支払いは翌々月末", reason: "先方の締めが変わった" }),
    );
    expect(await decidedOf(cancelSrc)).toBe(false);
    expect(await decidedOf(reviseSrc)).toBe(true);
  });

  it("K391-API-006 理由を付けて取り消す：200・取り消した時刻と人と理由・字はそのまま・行は消えない・やり取りに 1 行・一覧の下に回る", async () => {
    const t = await ticket();
    const keep = await decision(t, { text: "見積は税込", agoMin: 40 });
    const gone = await decision(t, { text: "郵送もする", agoMin: 5 });
    const d = await ok(await change(writer, gone, { action: "cancel", reason: "先方が不要と" }));
    expect(d.previous).toBeNull();
    expect(d.decision).toMatchObject({
      id: gone,
      text: "郵送もする",
      cancelled: { by: { id: writer.id, display_name: "佐藤" }, reason: "先方が不要と" },
    });
    const row = (await decisionsOf(t.id)).find((r) => r.id === gone)!;
    expect(row).toMatchObject({ text: "郵送もする", cancelled_by: writer.id, cancel_reason: "先方が不要と" });
    expect(row.cancelled_at).not.toBeNull();
    expect((await changeLines(t.id)).map((l) => l.body)).toEqual(["佐藤 が決定を取り消した"]);
    expect((await changeLines(t.id))[0]!.changes).toEqual([
      { field: "decision", from: gone, to: null, note: "cancel" },
    ]);
    expect((await listed(t.id)).map((x) => x.id)).toEqual([keep, gone]);
  });

  it("K391-API-007 取り消す理由が空・空白だけ・欄が無い：422 E-VAL-045・欄 reason・何も書かない", async () => {
    const t = await ticket();
    const id = await decision(t);
    const before = await snapshot(t.id);
    for (const body of [{ action: "cancel", reason: "" }, { action: "cancel", reason: "　" }, { action: "cancel" }]) {
      const r = await change(boss, id, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const j = await json(r);
      expect(j["code"]).toBe(VAL_CANCEL);
      expect(fields(j)).toEqual(["reason"]);
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K391-API-008 取り消した決定を取り消す・改める：409 E-CONF-033。改められた決定を取り消す：409 E-CONF-031。どれも何も書かない", async () => {
    const t = await ticket();
    const cancelled = await decision(t, { cancelled: { by: boss, reason: "前に取り消した" } });
    const newer = await decision(t, { agoMin: 1 });
    const revised = await decision(t, { agoMin: 20, superseded: newer });
    const before = await snapshot(t.id);
    for (const body of [
      { action: "cancel", reason: "もう一度" },
      { action: "revise", text: "直す" },
    ]) {
      const r = await change(boss, cancelled, body);
      expect(r.status, JSON.stringify(body)).toBe(409);
      expect((await json(r))["code"]).toBe(CONF_CANCELLED);
    }
    const r = await change(boss, revised, { action: "cancel", reason: "取り消したい" });
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_REVISED);
    expect(await snapshot(t.id)).toEqual(before);
  });
});

describe("K-391 入力と守り", () => {
  it("K391-API-009 ルールにする（action promote）はこの口に無い：422・欄 action・何も書かない・promoted_to は ticket のまま", async () => {
    const t = await ticket();
    const id = await decision(t);
    const before = await snapshot(t.id);
    const r = await change(boss, id, { action: "promote" });
    expect(r.status).toBe(422);
    expect(fields(await json(r))).toContain("action");
    expect(await snapshot(t.id)).toEqual(before);
    expect((await decisionsOf(t.id))[0]!.promoted_to).toBe("ticket");
  });

  it("K391-API-010 action が無い・知らない言葉：422・欄 action・何も書かない", async () => {
    const t = await ticket();
    const id = await decision(t);
    const before = await snapshot(t.id);
    for (const body of [{ text: "直す" }, { action: "delete" }]) {
      const r = await change(boss, id, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect(fields(await json(r))).toContain("action");
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K391-API-011 知らせ：担当者でない人が改める・取り消すと担当者に 1 つずつ（action revise・cancel）・担当者本人なら 0（⑲）", async () => {
    const t = await ticket();
    const a = await decision(t, { agoMin: 30 });
    const b = await decision(t, { agoMin: 20 });
    const d = await ok(await change(writer, a, { action: "revise", text: "改めた" }));
    await ok(await change(writer, b, { action: "cancel", reason: "やめた" }));
    const ns = await notices(t.id);
    expect(ns.map((n) => [n.member_id, n.payload["action"]])).toEqual([
      [boss.id, "revise"],
      [boss.id, "cancel"],
    ]);
    expect(ns.map((n) => n.dedupe_key)).toEqual([
      `${DECISION_KIND}:${d.decision.id}:revise`,
      `${DECISION_KIND}:${b}:cancel`,
    ]);
    const mine = await ticket();
    const c = await decision(mine);
    await ok(await change(boss, c, { action: "cancel", reason: "自分で" }));
    expect(await notices(mine.id)).toHaveLength(0);
  });

  it("K391-API-012 見るだけの人 403・別の会社の人 404・消したチケットの決定 404・ログインなし 401・止められた人 403：何も書かない", async () => {
    const t = await ticket();
    const id = await decision(t);
    const gone = await ticket();
    const goneId = await decision(gone);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const stopped = await f.person(T.tenantId, T.rootScope, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      stopped.id,
      boss.id,
    ]);
    const body = { action: "cancel", reason: "取り消す" };
    const before = await snapshot(t.id);
    expect((await change(viewer, id, body)).status).toBe(403);
    expect((await change(outsider, id, body)).status).toBe(404);
    expect((await change(boss, goneId, body)).status).toBe(404);
    expect((await f.req("PATCH", `/ticket_decisions/${id}`, { body })).status).toBe(401);
    expect((await change(stopped, id, body)).status).toBe(403);
    expect(await snapshot(t.id)).toEqual(before);
    expect((await decisionsOf(gone.id))[0]!.cancelled_at).toBeNull();
  });

  it("K391-API-013 DB の守りの 2 層目：見るだけの人が関数を直に呼ぶと not_writable・何も書かない", async () => {
    const t = await ticket();
    const id = await decision(t);
    const before = await snapshot(t.id);
    const r1 = await asMember<{ v: Record<string, unknown> }>(
      viewer,
      "select app.ticket_decision_revise($1, $2, $3) as v",
      [id, "直す", null],
    );
    expect(r1.v["error"]).toBe("not_writable");
    const r2 = await asMember<{ v: Record<string, unknown> }>(
      viewer,
      "select app.ticket_decision_cancel($1, $2) as v",
      [id, "取り消す"],
    );
    expect(r2.v["error"]).toBe("not_writable");
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K391-API-014 守りの判定が例外：503 E-PAGE-003・何も書かない", async () => {
    const t = await ticket({ title: "K391 守りを壊す" });
    const id = await decision(t);
    const before = await snapshot(t.id);
    const r = await breakWritable("K391 守りを壊す", () => change(boss, id, { action: "cancel", reason: "取り消す" }));
    expect(r.status).toBe(503);
    expect((await json(r))["code"]).toBe("E-PAGE-003");
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K391-API-015 完了したチケットの決定も改める・取り消すことができる（段を動かさない）", async () => {
    const t = await ticket({ stage: "done" });
    const a = await decision(t, { agoMin: 30 });
    const b = await decision(t, { agoMin: 20 });
    await ok(await change(boss, a, { action: "revise", text: "完了の後に改めた" }));
    await ok(await change(boss, b, { action: "cancel", reason: "完了の後に取り消した" }));
    const stage = await f.admin.query<{ key: string }>(
      "select s.key from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
      [t.id],
    );
    expect(stage.rows[0]!.key).toBe("done");
  });

  it("K391-API-016 1 分の上限を超える：429・retry_after_sec は 1〜60 の整数", async () => {
    const t = await ticket();
    const a = await decision(t, { agoMin: 30 });
    const b = await decision(t, { agoMin: 20 });
    f.limits["updateTicketDecision"] = 1;
    try {
      const ip = "198.51.100.91";
      await f.req("PATCH", `/ticket_decisions/${a}`, {
        body: { action: "cancel", reason: "一回目" },
        headers: boss.auth,
        ip,
      });
      const r = await f.req("PATCH", `/ticket_decisions/${b}`, {
        body: { action: "cancel", reason: "二回目" },
        headers: boss.auth,
        ip,
      });
      expect(r.status).toBe(429);
      const s = Number((await json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
    } finally {
      f.limits["updateTicketDecision"] = 10_000;
    }
  });
});
