// K-389「書き込みと一緒に段を変える（createTicketMessage の段の欄・1 つの取引）」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K389-API-…）は 11_tickets/K-389.md の表と 1 対 1。土台・道具・決めた文は ./progress.harness.ts（K-387 が運んだ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   書き込みの口は K-385（受け持ち B）が作る。その hooks のファイルは apps/api/src/hooks/ticket-message-post.ts で、K-326 の register（make に材料を渡す）を持つ。
//   書き込みの入力の名前（本文 body・知らせる人 notify_member_ids）は K-385 の契約に合わせる（違えば、この試験の 2 つの名前だけを K-385 の形に直して切る段に戻す）。
import { describe, expect, it } from "vitest";
import type pg from "pg";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import {
  setupProgress,
  CONF_BUSY,
  CONF_DONE,
  CONF_STAGE,
  CONF_HOLD_NEED,
  HOLD_RESUME_TEXT,
  STAGE_KIND,
  f,
  T,
  boss,
  writer,
  viewer,
  json,
  num,
  fields,
  stageOf,
  ticket,
  doneTicket,
  heldTicket,
  row,
  lines,
  notices,
} from "./progress.harness.js";

setupProgress(["ticket-update", "ticket-message-post"], {
  "ticket-message-post": async () => {
    const m = (await import("../../../src/hooks/ticket-message-post.js")) as { register: HookModule };
    // 書き込みの口の材料は appPool（ほかの欄は使わない見込み・K-385 の hooks のファイル）
    return m.register.make({ appPool: f.pool as pg.Pool } as unknown as HookDeps) as Record<string, Hook>;
  },
});

const say = (p: typeof boss, ticketId: string, body: Record<string, unknown>) =>
  f.req("POST", `/tickets/${ticketId}/messages`, { body, headers: p.auth });
const posts = (ticketId: string) =>
  f.admin
    .query<{ id: string; body: string | null; changes: unknown; author_member_id: string | null }>(
      "select id, body, changes, author_member_id from ticket_messages where ticket_id = $1 and kind = 'post' order by created_at, id",
      [ticketId],
    )
    .then((r) => r.rows);
/** 答えは K-385 の TimelineItem（kind post）。一緒に変えた段は、その changes に入る（鍵は増やさない・K-383 の形 {field, from, to, note?}） */
const changesOf = async (r: Response) => ((await json(r)).data as Record<string, unknown> | undefined)?.["changes"];
/** 段の欄を送った要求が断られたとき、書き込み・段・知らせが何も変わっていないこと */
const nothing = async (ticketId: string, stageKey: string) => {
  expect(await posts(ticketId)).toHaveLength(0);
  expect(await lines(ticketId)).toHaveLength(0);
  expect((await row(ticketId)).stage_key).toBe(stageKey);
  expect(await num("select count(*) as n from notifications where payload->>'ticket_id' = $1::text", [ticketId])).toBe(
    0,
  );
};

describe("K-389 書き込みと一緒に段を変える", () => {
  it("K389-API-001 担当者が「作業中にします」と書いて状態を作業中に：201・書き込みの行と答えの changes に段の前と後・別の変更の 1 行は書かない・知らせなし（本人）", async () => {
    const t = await ticket();
    const r = await say(boss, t.id, { body: "今日から始めます", stage_key: "doing" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await changesOf(r)).toEqual([{ field: "stage", from: "未着手", to: "作業中" }]);
    const ps = await posts(t.id);
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ body: "今日から始めます", author_member_id: boss.id });
    expect(ps[0]!.changes).toEqual([{ field: "stage", from: "未着手", to: "作業中" }]);
    expect(await lines(t.id)).toHaveLength(0);
    expect((await row(t.id)).stage_key).toBe("doing");
    expect(await notices(t.id, STAGE_KIND)).toHaveLength(0);
  });

  it("K389-API-002 保留（理由と再開の条件）と一緒に書く：201・保留の列・書き込みの changes に段と保留の項", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await say(boss, t.id, {
      body: "先方の返事を待ちます",
      stage_key: "hold",
      hold_reason: "先方の返事待ち",
      resume_condition: "先方の返事が来たら",
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await row(t.id)).toMatchObject({
      stage_key: "hold",
      hold_reason: "先方の返事待ち",
      resume_condition: "先方の返事が来たら",
    });
    expect((await posts(t.id))[0]!.changes).toEqual([
      { field: "stage", from: "作業中", to: "保留" },
      { field: "hold_reason", from: null, to: "先方の返事待ち" },
      { field: "resume_condition", from: null, to: "先方の返事が来たら" },
    ]);
  });

  it("K389-API-014 保留の理由・再開の条件に対にならないサロゲートがあっても書ける：201・保留の列の片割れの字は U+FFFD（jsonb に入らず 503 にしない・K-387 の口と同じ置き換え）", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await say(boss, t.id, {
      body: "待ちます",
      stage_key: "hold",
      hold_reason: "返事\uD800待ち",
      resume_condition: "来たら\uDC00再開",
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await row(t.id)).toMatchObject({
      stage_key: "hold",
      hold_reason: "返事\uFFFD待ち",
      resume_condition: "来たら\uFFFD再開",
    });
  });

  it("K389-API-003 段の id で保留を選んで再開の条件が無い：409 E-CONF-035（欄 resume_condition・文は「再開の条件を書いてください」）・書き込みも段も残らない（1 つの取引）", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await say(boss, t.id, {
      body: "止めます",
      stage_id: await stageOf(T.tenantId, "hold"),
      hold_reason: "待ち",
    });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(CONF_HOLD_NEED);
    expect(fields(j)).toEqual(["resume_condition"]);
    expect(j.details?.[0]?.message).toBe(HOLD_RESUME_TEXT);
    await nothing(t.id, "doing");
  });

  it("K389-API-004 本文が空で段の欄は正しい：422（書き込みの入力の誤り）・段は変わらない", async () => {
    const t = await ticket();
    const r = await say(boss, t.id, { body: "", stage_id: await stageOf(T.tenantId, "doing") });
    expect(r.status).toBe(422);
    expect(fields(await json(r))).toContain("body");
    await nothing(t.id, "todo");
  });

  it("K389-API-005 段の id で行き先が仕組みの段・完了：409 E-CONF-034・書き込みも残らない", async () => {
    const t = await ticket({ stage: "doing" });
    for (const key of ["awaiting_approval", "done"]) {
      const r = await say(boss, t.id, { body: "変えます", stage_id: await stageOf(T.tenantId, key) });
      expect(r.status, key).toBe(409);
      expect((await json(r))["code"], key).toBe(CONF_STAGE);
    }
    await nothing(t.id, "doing");
  });

  it("K389-API-006 承認待ちのチケット：段の欄を付けると 409 E-CONF-030 で書き込みも残らない。段の欄が無ければ書き込みは 201", async () => {
    const t = await ticket({ stage: "awaiting_approval" });
    const r = await say(boss, t.id, { body: "戻します", stage_id: await stageOf(T.tenantId, "doing") });
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_BUSY);
    await nothing(t.id, "awaiting_approval");
    const plain = await say(boss, t.id, { body: "承認を待っています" });
    expect(plain.status, await plain.clone().text()).toBe(201);
    expect(await changesOf(plain)).toBeNull();
    expect((await posts(t.id))[0]!.changes).toBeNull();
  });

  it("K389-API-007 見るだけの人：段の欄を付けると 403 で書き込みも残らない。段の欄が無ければ書ける（⑧）", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await say(viewer, t.id, { body: "保留にしたい", stage_id: await stageOf(T.tenantId, "todo") });
    expect(r.status).toBe(403);
    await nothing(t.id, "doing");
    expect((await say(viewer, t.id, { body: "質問です" })).status).toBe(201);
  });

  it("K389-API-008 担当者でない人が段を変えて書く：知らせる人が空なら担当者に段の知らせ 1 つ。知らせる人に担当者を入れても、担当者への知らせはこの要求で 1 つだけ（⑮7）", async () => {
    const t = await ticket();
    const r = await say(writer, t.id, { body: "代わりに始めます", stage_id: await stageOf(T.tenantId, "doing") });
    expect(r.status, await r.clone().text()).toBe(201);
    const msgId = (await posts(t.id))[0]!.id;
    const ns = await notices(t.id, STAGE_KIND);
    expect(ns.map((n) => n.member_id)).toEqual([boss.id]);
    expect(ns[0]!.dedupe_key).toBe(`${STAGE_KIND}:${msgId}`);
    const u = await ticket();
    const r2 = await say(writer, u.id, {
      body: "代わりに始めます",
      stage_id: await stageOf(T.tenantId, "doing"),
      notify_member_ids: [boss.id],
    });
    expect(r2.status, await r2.clone().text()).toBe(201);
    expect(
      await num("select count(*) as n from notifications where member_id = $1 and payload->>'ticket_id' = $2::text", [
        boss.id,
        u.id,
      ]),
    ).toBe(1);
  });

  it("K389-API-009 完了のチケットで未着手を選んで書く：409 E-CONF-032・書き込みも残らない（⑭ 書くだけなら書ける）", async () => {
    const t = await doneTicket();
    const r = await say(boss, t.id, { body: "戻します", stage_id: await stageOf(T.tenantId, "todo") });
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_DONE);
    await nothing(t.id, "done");
  });

  it("K389-API-010 書き込みに実績の欄を付ける：422 VALIDATION_ERROR（契約に無い欄・strict）・書き込みも実績も残らない（書く欄に実績は無い）", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await say(boss, t.id, { body: "1 時間やりました", actual_minutes: 60 });
    expect(r.status).toBe(422);
    expect((await json(r))["code"]).toBe("VALIDATION_ERROR");
    await nothing(t.id, "doing");
    expect((await row(t.id)).actual_minutes).toBeNull();
  });

  it("K389-API-011 同じ段を選んで書く（作業中 → 作業中）：201・書き込みの changes は null（答えの changes も null）・段の知らせなし", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await say(writer, t.id, { body: "続けています", stage_id: await stageOf(T.tenantId, "doing") });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await changesOf(r)).toBeNull();
    expect((await posts(t.id))[0]!.changes).toBeNull();
    expect(await notices(t.id, STAGE_KIND)).toHaveLength(0);
  });

  it("K389-API-012 段の欄が無いのに保留の理由・再開の条件だけを付けて書く（作業中のチケット・保留中のチケット）：どちらも 422 VALIDATION_ERROR・欄ごとに「保留にするときだけ書けます」・書き込みも保留の列も変わらない（理由を直すのは頭の札の口 K-387）", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await say(boss, t.id, { body: "理由だけ", hold_reason: "待ち", resume_condition: "来たら" });
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j["code"]).toBe("VALIDATION_ERROR");
    expect(j.details).toEqual([
      { field: "hold_reason", message: "保留にするときだけ書けます" },
      { field: "resume_condition", message: "保留にするときだけ書けます" },
    ]);
    await nothing(t.id, "doing");
    const h = await heldTicket("先方の返事待ち", "先方の返事が来たら");
    const r2 = await say(boss, h.id, { body: "理由を直したい", hold_reason: "見積の確認待ち" });
    expect(r2.status).toBe(422);
    expect((await json(r2)).details).toEqual([{ field: "hold_reason", message: "保留にするときだけ書けます" }]);
    await nothing(h.id, "hold");
    expect(await row(h.id)).toMatchObject({ hold_reason: "先方の返事待ち", resume_condition: "先方の返事が来たら" });
  });

  it("K389-API-013 S1 の失敗（段を書いた後、受け箱の行を書く所で DB が落ちた）：503・E-PAGE-003。1 つの取引なので段・保留の列・書き込み・知らせが前のまま", async () => {
    const t = await ticket({ title: "K389 受け箱が書けない" });
    await f.admin.query(`create or replace function public.k389_break() returns trigger language plpgsql as $$
      begin raise exception 'K389 の試験で書けなくした'; end $$`);
    await f.admin.query(
      `create trigger k389_break before insert on notifications for each row when (new.payload->>'ticket_id' = '${t.id}') execute function public.k389_break()`,
    );
    try {
      // 担当者（boss）でない人が @ 付きで段を変えて書く＝段を書いた後、受け箱の行を書く所で落ちる
      const r = await say(writer, t.id, { body: "始めます", mention_member_ids: [boss.id], stage_key: "doing" });
      expect(r.status).toBe(503);
      const j = await json(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("書けなくした");
    } finally {
      await f.admin.query("drop trigger if exists k389_break on notifications");
    }
    await nothing(t.id, "todo");
    expect((await row(t.id)).updated_by).not.toBe(writer.id);
  });
});
