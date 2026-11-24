// K-387「段・実績・保留を変える口（updateTicket）と、詳細（getTicket）の変えられるか・AI の分の時間」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K387-API-…）は 11_tickets/K-387.md の表と 1 対 1。土台・道具・決めた文は ./progress.harness.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   開き直す（完了 → 作業中）は K-388 の表（progress-reopen.test.ts）。ここでは完了から作業中以外への行だけを見る。
import { describe, expect, it } from "vitest";
import {
  setupProgress,
  CONF_BUSY,
  CONF_DONE,
  CONF_STAGE,
  CONF_HOLD_NEED,
  CONF_HOLD_NOT,
  HOLD_NOT_TEXT,
  NOT_FOUND,
  HOLD_REASON_TEXT,
  HOLD_RESUME_TEXT,
  VAL_HOLD_REASON,
  VAL_HOLD_RESUME,
  VAL_NOT_YET,
  NOT_YET_FIELD,
  STAGE_KIND,
  f,
  T,
  O,
  boss,
  writer,
  viewer,
  outsider,
  json,
  one,
  num,
  fields,
  asMember,
  stageOf,
  stageKeyOf,
  customStage,
  ticket,
  doneTicket,
  heldTicket,
  run,
  patch,
  detail,
  row,
  lines,
  notices,
  snapshot,
  breakWritable,
} from "./progress.harness.js";

setupProgress();

describe("K-387 段を変える（作業の段・人が動かす）", () => {
  it("K387-API-001 未着手 × 担当者が作業中にする：200・段が作業中・答えの形・やり取りに変更の 1 行（担当者本人・知らせなし）", async () => {
    const t = await ticket();
    const doing = await stageOf(T.tenantId, "doing");
    const r = await patch(boss, t.id, { stage_id: doing });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["changed", "message_id", "stage", "ticket"]);
    expect(d["changed"]).toBe(true);
    expect(d["stage"]).toEqual({ id: doing, key: "doing", name: "作業中" });
    expect(d["ticket"]).toMatchObject({ id: t.id, number: t.number, stage_id: doing, actual_minutes: null });
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    expect((await row(t.id)).stage_key).toBe("doing");
    const ls = await lines(t.id);
    expect(ls).toHaveLength(1);
    expect(ls[0]!.id).toBe(d["message_id"]);
    expect(ls[0]!.body).toBe("高本 が状態を 未着手 → 作業中 に変えた");
    expect(ls[0]!.author_member_id).toBe(boss.id);
    expect(ls[0]!.changes).toEqual([{ field: "stage", from: "未着手", to: "作業中" }]);
    expect(await notices(t.id)).toHaveLength(0);
    // 見るだけの人も、行の守りの中で変更の 1 行を読める（やり取りに出る）
    const seen = await asMember<{ n: string }>(
      viewer,
      "select count(*) as n from ticket_messages where ticket_id = $1 and kind = 'change'",
      [t.id],
    );
    expect(Number(seen.n)).toBe(1);
  });

  it("K387-API-002 作業中 × 担当者でない書ける人が保留にする（理由と再開の条件）：200・保留の列・1 行・担当者に受け箱の知らせ 1 つ（理由の字は入れない）", async () => {
    const t = await ticket({ stage: "doing" });
    const r = await patch(writer, t.id, {
      stage_id: await stageOf(T.tenantId, "hold"),
      hold_reason: "先方の返事待ち",
      resume_condition: "先方の返事が来たら",
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const msgId = (await json(r)).data!["message_id"];
    expect(await row(t.id)).toMatchObject({
      stage_key: "hold",
      hold_reason: "先方の返事待ち",
      resume_condition: "先方の返事が来たら",
      updated_by: writer.id,
    });
    const ls = await lines(t.id);
    expect(ls.map((l) => l.body)).toEqual([
      "佐藤 が保留にした（理由：先方の返事待ち・再開の条件：先方の返事が来たら）",
    ]);
    expect(ls[0]!.changes).toEqual([
      { field: "stage", from: "作業中", to: "保留" },
      { field: "hold_reason", from: null, to: "先方の返事待ち" },
      { field: "resume_condition", from: null, to: "先方の返事が来たら" },
    ]);
    const ns = await notices(t.id);
    expect(ns).toHaveLength(1);
    expect(ns[0]!.member_id).toBe(boss.id);
    expect(ns[0]!.channel_id).toBe("inapp");
    expect(ns[0]!.dedupe_key).toBe(`${STAGE_KIND}:${msgId}`);
    expect(Object.keys(ns[0]!.payload).sort()).toEqual(["message_id", "number", "stage", "ticket_id", "url"]);
    expect(ns[0]!.payload["stage"]).toEqual({ key: "hold", name: "保留" });
    expect(JSON.stringify(ns[0]!.payload)).not.toContain("先方の返事待ち");
    expect(
      await num("select count(*) as n from notifications where member_id = $1 and payload->>'ticket_id' = $2::text", [
        writer.id,
        t.id,
      ]),
    ).toBe(0);
  });

  it("K387-API-003 保留 × 作業中に戻す：200・理由と再開の条件の列は空になる・1 行「保留 → 作業中」", async () => {
    const t = await heldTicket();
    const r = await patch(boss, t.id, { stage_id: await stageOf(T.tenantId, "doing") });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await row(t.id)).toMatchObject({ stage_key: "doing", hold_reason: null, resume_condition: null });
    expect((await lines(t.id)).map((l) => l.body)).toEqual(["高本 が状態を 保留 → 作業中 に変えた"]);
  });

  it("K387-API-004 保留のまま理由と再開の条件だけ直す（段を送らない）：200・列が新しい字・1 行「保留の理由を直した」", async () => {
    const t = await heldTicket();
    const r = await patch(boss, t.id, { hold_reason: "見積の確認待ち", resume_condition: "11/25 に聞き直す" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await row(t.id)).toMatchObject({
      stage_key: "hold",
      hold_reason: "見積の確認待ち",
      resume_condition: "11/25 に聞き直す",
    });
    expect((await lines(t.id)).map((l) => l.body)).toEqual([
      "高本 が保留の理由を直した（理由：見積の確認待ち・再開の条件：11/25 に聞き直す）",
    ]);
  });

  it("K387-API-005 保留にするのに理由か再開の条件が無い・空・空白だけ（全角の空白も）：段の鍵（stage_key hold）なら形の誤りで 422・理由が足りなければ E-VAL-041・条件だけなら E-VAL-047／空・空白だけは段の id でも契約の pattern に合わない形の誤りで 422／段の id で保留の段を選んで理由か条件が無い（送っていない）なら 409 E-CONF-035／無い欄ごとの明細（欄ごとの文）・何も書かない", async () => {
    const t = await ticket({ stage: "doing" });
    const hold = await stageOf(T.tenantId, "hold");
    const before = await snapshot(t.id);
    const text: Record<string, string> = { hold_reason: HOLD_REASON_TEXT, resume_condition: HOLD_RESUME_TEXT };
    const cases: [Record<string, unknown>, number, string, string[]][] = [
      [{ stage_key: "hold" }, 422, VAL_HOLD_REASON, ["hold_reason", "resume_condition"]],
      [{ stage_key: "hold", hold_reason: "返事待ち" }, 422, VAL_HOLD_RESUME, ["resume_condition"]],
      [{ stage_key: "hold", hold_reason: "　 ", resume_condition: "来たら" }, 422, VAL_HOLD_REASON, ["hold_reason"]],
      [
        { stage_key: "hold", hold_reason: "返事待ち", resume_condition: "" },
        422,
        VAL_HOLD_RESUME,
        ["resume_condition"],
      ],
      [{ stage_id: hold }, 409, CONF_HOLD_NEED, ["hold_reason", "resume_condition"]],
      [{ stage_id: hold, hold_reason: "返事待ち" }, 409, CONF_HOLD_NEED, ["resume_condition"]],
      [{ stage_id: hold, hold_reason: "　 ", resume_condition: "来たら" }, 422, VAL_HOLD_REASON, ["hold_reason"]],
      [{ stage_id: hold, hold_reason: "返事待ち", resume_condition: "" }, 422, VAL_HOLD_RESUME, ["resume_condition"]],
    ];
    for (const [body, status, code, want] of cases) {
      const r = await patch(boss, t.id, body);
      expect(r.status, JSON.stringify(body)).toBe(status);
      const j = await json(r);
      expect(j["code"], JSON.stringify(body)).toBe(code);
      expect(fields(j).sort(), JSON.stringify(body)).toEqual(want);
      for (const d of j.details ?? []) expect(d.message, `${JSON.stringify(body)} ${d.field}`).toBe(text[d.field]);
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-006 保留でないのに理由か再開の条件を書こうとした：段の鍵（stage_key todo・doing）に付けたら形の誤りで 422・欄ごとに「保留にするときだけ書けます」／段の id で保留でない段を選んだか、保留でないチケットの理由だけ直すなら 409 E-CONF-036・欄ごとの明細・何も書かない", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const k = await patch(boss, t.id, { stage_key: "doing", hold_reason: "念のため" });
    expect(k.status).toBe(422);
    const jk = await json(k);
    expect(jk["code"]).toBe("VALIDATION_ERROR");
    expect(jk.details).toEqual([{ field: "hold_reason", message: "保留にするときだけ書けます" }]);
    const kt = await patch(boss, t.id, { stage_key: "todo", resume_condition: "来たら" });
    expect(kt.status).toBe(422);
    expect((await json(kt)).details).toEqual([{ field: "resume_condition", message: "保留にするときだけ書けます" }]);
    const bodies: [Record<string, unknown>, string[]][] = [
      [{ stage_id: await stageOf(T.tenantId, "doing"), hold_reason: "念のため" }, ["hold_reason"]],
      [{ hold_reason: "念のため", resume_condition: "来たら" }, ["hold_reason", "resume_condition"]],
    ];
    for (const [body, want] of bodies) {
      const r = await patch(boss, t.id, body);
      expect(r.status, JSON.stringify(body)).toBe(409);
      const j = await json(r);
      expect(j["code"], JSON.stringify(body)).toBe(CONF_HOLD_NOT);
      expect(fields(j).sort(), JSON.stringify(body)).toEqual(want);
      for (const d of j.details ?? []) expect(d.message).toBe(HOLD_NOT_TEXT);
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-007 段の id で行き先が仕組みの段（確認中・承認待ち・実行中）：今の状態ではできないので 409 E-CONF-034・欄 stage_id・何も書かない（D-125.68）", async () => {
    const t = await ticket({ stage: "doing" });
    const before = await snapshot(t.id);
    for (const key of ["checking", "awaiting_approval", "running"]) {
      const r = await patch(boss, t.id, { stage_id: await stageOf(T.tenantId, key) });
      expect(r.status, key).toBe(409);
      const j = await json(r);
      expect(j["code"], key).toBe(CONF_STAGE);
      expect(fields(j), key).toEqual(["stage_id"]);
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-008 段の id で行き先が完了：409 E-CONF-034・欄 stage_id・何も書かない（完了は完了の小窓＝completeTicket を通す・③）", async () => {
    const t = await ticket({ stage: "doing" });
    const before = await snapshot(t.id);
    const r = await patch(boss, t.id, { stage_id: await stageOf(T.tenantId, "done") });
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_STAGE);
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-009 段の id が指す段が別の会社の段・消した段・無い uuid：指した物が無いので 404 E-PAGE-001・欄 stage_id・何も書かない（在るかを漏らさない）", async () => {
    const t = await ticket();
    const gone = await customStage(T.tenantId, "消した段");
    await f.admin.query("update ticket_stages set deleted_at = now() where id = $1", [gone]);
    const before = await snapshot(t.id);
    for (const id of [await stageOf(O.tenantId, "doing"), gone, "8b0e3f7a-2c4d-4e5f-9a6b-7c8d9e0f1a2b"]) {
      const r = await patch(boss, t.id, { stage_id: id });
      expect(r.status, id).toBe(404);
      const j = await json(r);
      expect(j["code"], id).toBe(NOT_FOUND);
      expect(fields(j), id).toEqual(["stage_id"]);
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-010 会社が足した段（鍵が空）を選ぶ：200・その段になる・1 行にその段の名前・答えの stage.key は null", async () => {
    const t = await ticket({ stage: "doing" });
    const review = await customStage(T.tenantId, "社内確認");
    const r = await patch(boss, t.id, { stage_id: review });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await json(r)).data!["stage"]).toEqual({ id: review, key: null, name: "社内確認" });
    expect((await one<{ stage_id: string }>("select stage_id from tickets where id = $1", [t.id])).stage_id).toBe(
      review,
    );
    expect((await lines(t.id)).map((l) => l.body)).toEqual(["高本 が状態を 作業中 → 社内確認 に変えた"]);
  });

  it("K387-API-011 今が仕組みの段（承認待ち）か、走っている実行がある作業中：段を変えると 409 E-CONF-030・何も書かない", async () => {
    const waiting = await ticket({ stage: "awaiting_approval" });
    const busy = await ticket({ stage: "doing" });
    await run(busy, { finished: false, status: "queued" });
    const todo = await stageOf(T.tenantId, "todo");
    for (const t of [waiting, busy]) {
      const before = await snapshot(t.id);
      const r = await patch(boss, t.id, { stage_id: todo });
      expect(r.status, t.id).toBe(409);
      expect((await json(r))["code"]).toBe(CONF_BUSY);
      expect(await snapshot(t.id)).toEqual(before);
    }
  });

  it("K387-API-012 今が完了：未着手・保留にすると 409 E-CONF-032・何も書かない（完了の時刻と押した人は残る）", async () => {
    const t = await doneTicket();
    const before = await snapshot(t.id);
    for (const body of [
      { stage_id: await stageOf(T.tenantId, "todo") },
      { stage_id: await stageOf(T.tenantId, "hold"), hold_reason: "やり直し", resume_condition: "確認したら" },
    ]) {
      const r = await patch(boss, t.id, body);
      expect(r.status, JSON.stringify(body)).toBe(409);
      expect((await json(r))["code"]).toBe(CONF_DONE);
    }
    expect(await snapshot(t.id)).toEqual(before);
    expect((await row(t.id)).completed_by).toBe(boss.id);
  });

  it("K387-API-013 同じ段に変える（作業中 → 作業中）・同じ要求の二度押し：200・changed false・message_id null・1 行も知らせも増えない", async () => {
    const t = await ticket({ stage: "doing" });
    const doing = await stageOf(T.tenantId, "doing");
    for (let i = 0; i < 2; i++) {
      const r = await patch(writer, t.id, { stage_id: doing });
      expect(r.status).toBe(200);
      const d = (await json(r)).data!;
      expect(d["changed"]).toBe(false);
      expect(d["message_id"]).toBeNull();
    }
    expect(await lines(t.id)).toHaveLength(0);
    expect(await notices(t.id)).toHaveLength(0);
  });
});

describe("K-387 実績（人が使った時間）", () => {
  it("K387-API-014 実績を 90 分にする（担当者でない人・完了したチケット・承認待ちのチケットでも）：200・列が 90・1 行「実績を 1 時間 30 分 に変えた」・知らせなし（⑦）", async () => {
    for (const t of [
      await ticket({ stage: "doing" }),
      await doneTicket(),
      await ticket({ stage: "awaiting_approval" }),
    ]) {
      const r = await patch(writer, t.id, { actual_minutes: 90 });
      expect(r.status, await r.clone().text()).toBe(200);
      expect((await row(t.id)).actual_minutes).toBe(90);
      expect((await lines(t.id)).map((l) => l.body)).toEqual(["佐藤 が実績を 1 時間 30 分 に変えた"]);
      expect((await lines(t.id))[0]!.changes).toEqual([{ field: "actual_minutes", from: null, to: "1 時間 30 分" }]);
      expect(await notices(t.id)).toHaveLength(0);
    }
  });

  it("K387-API-015 実績を 0 にする・null で空にする：200・列が 0 → null・1 行「実績を 0 分 に変えた」「実績を空にした」", async () => {
    const t = await ticket({ stage: "doing" });
    await f.admin.query("update tickets set actual_minutes = 45 where id = $1", [t.id]);
    expect((await patch(boss, t.id, { actual_minutes: 0 })).status).toBe(200);
    expect((await row(t.id)).actual_minutes).toBe(0);
    expect((await patch(boss, t.id, { actual_minutes: null })).status).toBe(200);
    expect((await row(t.id)).actual_minutes).toBeNull();
    expect((await lines(t.id)).map((l) => l.body)).toEqual(["高本 が実績を 0 分 に変えた", "高本 が実績を空にした"]);
  });

  it("K387-API-016 実績が負・100001・小数・文字の数：422・欄 actual_minutes・何も書かない", async () => {
    const t = await ticket({ stage: "doing" });
    const before = await snapshot(t.id);
    for (const v of [-1, 100001, 1.5, "60"]) {
      const r = await patch(boss, t.id, { actual_minutes: v });
      expect(r.status, String(v)).toBe(422);
      expect(fields(await json(r)), String(v)).toContain("actual_minutes");
    }
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-017 段と実績を一緒に変える（担当者でない人）：200・1 行に両方・担当者に知らせ 1 つ", async () => {
    const t = await ticket();
    const r = await patch(writer, t.id, { stage_id: await stageOf(T.tenantId, "doing"), actual_minutes: 60 });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await row(t.id)).toMatchObject({ stage_key: "doing", actual_minutes: 60 });
    expect((await lines(t.id)).map((l) => l.body)).toEqual([
      "佐藤 が状態を 未着手 → 作業中 に変えた・実績を 1 時間 に変えた",
    ]);
    expect((await notices(t.id)).map((n) => n.member_id)).toEqual([boss.id]);
  });
});

describe("K-387 入力と守り", () => {
  it("K387-API-018 ほかの欄（題名・期限・担当者・見込み。優先度は K-440 の組が受ける）：422 E-VAL-018・欄ごとに「この欄はまだ変えられません」・段を一緒に送っても何も書かない", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const r = await patch(boss, t.id, {
      stage_id: await stageOf(T.tenantId, "doing"),
      title: "別の題名",
      due_on: "2026-12-01",
      assignee_member_id: writer.id,
      estimate_minutes: 30,
    });
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j["code"]).toBe(VAL_NOT_YET);
    expect(fields(j).sort()).toEqual(["assignee_member_id", "due_on", "estimate_minutes", "title"]);
    expect(new Set((j.details ?? []).map((d) => d.message))).toEqual(new Set([NOT_YET_FIELD]));
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-019 空の体 {}：422・欄 body・何も書かない", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const r = await patch(boss, t.id, {});
    expect(r.status).toBe(422);
    expect(fields(await json(r))).toEqual(["body"]);
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-020 見るだけの人 403・別の会社の人 404・消したチケット 404・ログインなし 401・会社から止められた人 403：どれも何も書かない（②）", async () => {
    const t = await ticket();
    const gone = await ticket();
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const stopped = await f.person(T.tenantId, T.rootScope, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      stopped.id,
      boss.id,
    ]);
    const body = { stage_id: await stageOf(T.tenantId, "doing") };
    const before = await snapshot(t.id);
    expect((await patch(viewer, t.id, body)).status).toBe(403);
    expect((await patch(outsider, t.id, body)).status).toBe(404);
    expect((await patch(boss, gone.id, body)).status).toBe(404);
    expect((await f.req("PATCH", `/tickets/${t.id}`, { body })).status).toBe(401);
    expect((await patch(stopped, t.id, body)).status).toBe(403);
    expect(await snapshot(t.id)).toEqual(before);
    expect((await row(gone.id)).stage_key).toBe("todo");
  });

  it("K387-API-021 担当者が止められている・担当者がいない：担当者でない人が段を変えても知らせは 0・答えは 200", async () => {
    const away = await f.person(T.tenantId, T.rootScope, { name: "休みの人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [away.id, boss.id]);
    const doing = await stageOf(T.tenantId, "doing");
    for (const t of [await ticket({ assignee: away }), await ticket({ assignee: null })]) {
      const r = await patch(writer, t.id, { stage_id: doing });
      expect(r.status, await r.clone().text()).toBe(200);
      expect(await notices(t.id)).toHaveLength(0);
    }
  });

  it("K387-API-022 DB の守りの 2 層目：見るだけの人・止められた人が関数を直に呼ぶと not_writable／not_member・何も書かない", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const p = JSON.stringify({ stage_id: await stageOf(T.tenantId, "doing") });
    const v = await asMember<{ v: Record<string, unknown> }>(
      viewer,
      "select app.ticket_progress_set($1, $2::jsonb) as v",
      [t.id, p],
    );
    expect(v.v["error"]).toBe("not_writable");
    const stopped = await f.person(T.tenantId, T.rootScope, { name: "止められた人 2", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      stopped.id,
      boss.id,
    ]);
    const s = await asMember<{ v: Record<string, unknown> }>(
      stopped,
      "select app.ticket_progress_set($1, $2::jsonb) as v",
      [t.id, p],
    );
    expect(s.v["error"]).toBe("not_member");
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-023 同時に 2 人が段を変える（作業中 → 保留 と 作業中 → 未着手）：どちらも 200・1 行が 2 つ・2 つ目の「前」は 1 つ目の「後」", async () => {
    const t = await ticket({ stage: "doing" });
    const [a, b] = await Promise.all([
      patch(boss, t.id, {
        stage_id: await stageOf(T.tenantId, "hold"),
        hold_reason: "待ち",
        resume_condition: "来たら",
      }),
      patch(writer, t.id, { stage_id: await stageOf(T.tenantId, "todo") }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const ls = await lines(t.id);
    expect(ls).toHaveLength(2);
    const ch = ls.map((l) =>
      (l.changes as { field: string; from: string; to: string }[]).find((c) => c.field === "stage")!,
    );
    expect(ch[1]!.from).toBe(ch[0]!.to);
    const name = await one<{ name: string }>(
      "select s.name from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
      [t.id],
    );
    expect(name.name).toBe(ch[1]!.to);
  });

  it("K387-API-024 守りの判定が例外：503 E-PAGE-003・何も書かない（止める側に倒す・D-136.1）", async () => {
    const t = await ticket({ title: "K387 守りを壊す" });
    const before = await snapshot(t.id);
    const doing = await stageOf(T.tenantId, "doing");
    // 入口の行の確かめ（op.ts 4.1・app.ticket_writable）でも、関数の中の 2 層目でも、例外なら 503（どちらで止まっても何も書かない）
    const r = await breakWritable("K387 守りを壊す", () => patch(boss, t.id, { stage_id: doing }));
    expect(r.status).toBe(503);
    expect((await json(r))["code"]).toBe("E-PAGE-003");
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K387-API-025 1 分の上限を超える：429・retry_after_sec は 1〜60 の整数", async () => {
    const t = await ticket();
    f.limits["updateTicket"] = 1;
    try {
      const doing = await stageOf(T.tenantId, "doing");
      const ip = "198.51.100.87";
      await f.req("PATCH", `/tickets/${t.id}`, { body: { stage_id: doing }, headers: boss.auth, ip });
      const r = await f.req("PATCH", `/tickets/${t.id}`, { body: { stage_id: doing }, headers: boss.auth, ip });
      expect(r.status).toBe(429);
      const s = Number((await json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
    } finally {
      f.limits["updateTicket"] = 10_000;
    }
  });

  it("K387-API-029 S1 の失敗（担当者への受け箱の行を書く所で DB が落ちた）：503・E-PAGE-003。1 つの処理なので段・保留の列・変更の 1 行・知らせが前のまま", async () => {
    const t = await ticket({ title: "K387 受け箱が書けない" });
    const before = await snapshot(t.id);
    await f.admin.query(`create or replace function public.k387_break() returns trigger language plpgsql as $$
      begin raise exception 'K387 の試験で書けなくした'; end $$`);
    await f.admin.query(
      `create trigger k387_break before insert on notifications for each row when (new.payload->>'ticket_id' = '${t.id}') execute function public.k387_break()`,
    );
    try {
      // 担当者（boss）でない人が段を変える＝担当者の受け箱に 1 行を書く所で落ちる
      const r = await patch(writer, t.id, {
        stage_key: "hold",
        hold_reason: "先方の返事待ち",
        resume_condition: "返事が来たら",
      });
      expect(r.status).toBe(503);
      const j = await json(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("書けなくした");
      expect(JSON.stringify(j)).not.toContain("先方の返事待ち");
    } finally {
      await f.admin.query("drop trigger if exists k387_break on notifications");
    }
    expect(await snapshot(t.id)).toEqual(before);
    expect(await lines(t.id)).toHaveLength(0);
  });
});

describe("K-387 詳細（getTicket）の変えられるか・AI の分の時間・保留の帯", () => {
  it("K387-API-026 can.progress（段を変えられるか）：書ける人で作業中・完了は true、見るだけの人・承認待ちは false。can.actual（実績を入れられるか）：書ける人なら作業中・完了・承認待ち（仕組みの段の間）でも true、見るだけの人は false", async () => {
    const doing = await ticket({ stage: "doing" });
    const done = await doneTicket();
    const waiting = await ticket({ stage: "awaiting_approval" });
    const can = async (p: typeof boss, id: string) => {
      const r = await detail(p, id);
      expect(r.status, await r.clone().text()).toBe(200);
      const c = (await json(r)).data!["can"] as Record<string, unknown>;
      return [c["progress"], c["actual"]];
    };
    expect(await can(writer, doing.id)).toEqual([true, true]);
    expect(await can(boss, done.id)).toEqual([true, true]);
    expect(await can(viewer, doing.id)).toEqual([false, false]);
    expect(await can(boss, waiting.id)).toEqual([false, true]);
  });

  it("K387-API-027 time と hold：time は予定・人の分（実績）・AI の分（終わった実行の長さの合計 2 分＋10 分＝12。走っている実行・別のチケットの実行は数えない）。hold は保留のときだけ理由・再開の条件・時刻・押した人の名前、ほかは null", async () => {
    const t = await ticket({ stage: "doing" });
    const other = await ticket({ stage: "doing" });
    await f.admin.query("update tickets set estimate_minutes = 30, actual_minutes = 60 where id = $1", [t.id]);
    await run(t, { minutes: 2 });
    await run(t, { minutes: 10, status: "stopped" });
    await run(t, { finished: false, status: "running" });
    await run(other, { minutes: 30 });
    const d = (await json(await detail(boss, t.id))).data!;
    expect(d["time"]).toEqual({ estimate_minutes: 30, human_minutes: 60, ai_minutes: 12 });
    expect(d["hold"]).toBeNull();
    expect((await json(await detail(boss, (await ticket()).id))).data!["time"]).toEqual({
      estimate_minutes: null,
      human_minutes: 0,
      ai_minutes: 0,
    });
    const h = await ticket({ stage: "doing" });
    expect(
      (await patch(writer, h.id, { stage_key: "hold", hold_reason: "待ち", resume_condition: "来たら" })).status,
    ).toBe(200);
    const held = (await json(await detail(boss, h.id))).data!["hold"] as {
      reason: string;
      resume: string;
      at: string;
      by: string | null;
    };
    expect(held).toMatchObject({ reason: "待ち", resume: "来たら", by: "佐藤" });
    expect(Number.isNaN(Date.parse(held.at))).toBe(false);
    expect(await stageKeyOf(h.id)).toBe("hold");
  });

  it("K387-API-028 段は鍵（stage_key：todo・doing・hold）でも選べる。鍵と id の両方・todo・doing・hold でない鍵（仕組みの段と完了の鍵も）は形の誤りで 422（どちらも欄 stage_key）・何も書かない", async () => {
    const t = await ticket();
    expect((await patch(boss, t.id, { stage_key: "doing" })).status).toBe(200);
    expect((await row(t.id)).stage_key).toBe("doing");
    const before = await snapshot(t.id);
    const both = await patch(boss, t.id, { stage_key: "todo", stage_id: await stageOf(T.tenantId, "todo") });
    expect(both.status).toBe(422);
    expect(fields(await json(both))).toEqual(["stage_key"]);
    for (const key of ["review", "running", "done"]) {
      const r = await patch(boss, t.id, { stage_key: key });
      expect(r.status, key).toBe(422);
      const j = await json(r);
      expect(j["code"], key).toBe("VALIDATION_ERROR");
      expect(fields(j), key).toEqual(["stage_key"]);
    }
    expect(await snapshot(t.id)).toEqual(before);
  });
});
