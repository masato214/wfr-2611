// K-438 の子の複製の試験（copy の children：直接の子だけ・期限と担当者の直し・段の数・お知らせ・手順の失敗）。ticket-duplicate.test.ts と土台（ticket-duplicate.harness.ts）を共有する。
// 名前の頭の行 ID（K438-API-…）は 11_tickets/K-438.md の表のマスに 1 対 1 で結ぶ。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
//   子は 1 つ下の段（直接の子）だけ・複製と同じグループ・確認項目・項目の値・つながり・孫は付けない・本文のチェックの箱は外す・子ごとに元の子への derived_from の線
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { docToText } from "@kaname/contracts";
import {
  ALL,
  T,
  addChild,
  childCopyDoc,
  bodyOf,
  childrenOf,
  closeDup,
  count,
  create,
  createOk,
  derivedFrom,
  f,
  failOn,
  jst,
  json,
  linksOf,
  mate,
  newBody,
  noFields,
  q,
  setupDup,
  snapshot,
  specsOf,
  task,
  third,
  valuesOf,
  writer,
  makeSource,
} from "./ticket-duplicate.harness.js";

beforeAll(setupDup, 60_000);
afterAll(closeDup);

describe("K-438 子を写す（口・本物の DB）", () => {
  it("K438-API-012 子を写す：直接の子だけ・新しい番号・親は複製・題名・種別・優先度・見込み・未着手・子ごとに元の子への線。孫・消した子・見えない子・種別が消えた子は写さない", async () => {
    const src = await makeSource();
    const c1 = await addChild(src["id"], "子 A", { priority: "high", priority_reason: "急ぎ", estimate_minutes: 30 });
    const c2 = await addChild(src["id"], "子 B");
    const c3 = await addChild(src["id"], "種別が消えた子");
    await addChild(c1["id"], "孫 A");
    const gone = await addChild(src["id"], "消した子");
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [
      gone["id"],
      writer.id,
    ]);
    const imp = (
      await q<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source, created_by) values ($1, $2, $3, 'generic', $2) returning id",
        [T.tenantId, mate.id, T.rootScope],
      )
    )[0]!;
    const hidden = await addChild(src["id"], "他の人の取り込み中の子");
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [hidden["id"], imp.id]);
    const dead = (
      await q<{ id: string }>(
        "insert into ticket_kinds (tenant_id, name, deleted_at) values ($1, '消した種別', now()) returning id",
        [T.tenantId],
      )
    )[0]!.id;
    await f.admin.query("update tickets set kind_id = $2 where id = $1", [c3["id"], dead]);
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["children"] }));
    const kids = await childrenOf(t["id"]);
    expect(kids.map((k) => k.title)).toEqual(["子 A", "子 B"]);
    for (const k of kids) {
      expect(k.number).toMatch(/^EG-\d+$/);
      expect([c1["number"], c2["number"], src["number"]]).not.toContain(k.number);
      expect(k.stage_key).toBe("todo");
      expect(k.kind_id).toBe(task.id);
      expect(await count("select count(*) as n from tickets where parent_ticket_id = $1", [k.id])).toBe(0);
    }
    expect(kids[0]).toMatchObject({ priority: "high", estimate_minutes: 30 });
    expect(await derivedFrom(kids[0]!.id)).toEqual([c1["id"]]);
    expect(await derivedFrom(kids[1]!.id)).toEqual([c2["id"]]);
  });
  it("K438-API-013 子を写す：子の期限が複製の期限より後なら複製の期限に・開始が期限より後なら空に・早い期限は元のまま・担当者が抜けた子の担当者は作った人に", async () => {
    const src = await makeSource();
    const gone = await f.person(T.tenantId, T.rootScope, { name: "抜けた子の担当", ticketAbility: "edit" });
    await addChild(src["id"], "遅い子", { due_on: jst(20), start_on: jst(15) });
    await addChild(src["id"], "早い子", { due_on: jst(2) });
    await addChild(src["id"], "担当が抜けた子", { assignee_member_id: gone.id, due_on: jst(3) });
    await f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["children"], due_on: jst(5) }));
    const kids = Object.fromEntries((await childrenOf(t["id"])).map((k) => [k.title, k]));
    expect(kids["遅い子"]).toMatchObject({ due_on: jst(5), start_on: null });
    expect(kids["早い子"]!.due_on).toBe(jst(2));
    expect(kids["担当が抜けた子"]).toMatchObject({ assignee_member_id: writer.id, due_on: jst(3) });
  });
  it("K438-API-014 子の本文：チェックの箱は子でも外れる（doc も text も）・版 1。子には確認項目・項目の値・つながり（派生元を除く）・孫を付けない", async () => {
    const src = await makeSource();
    const c = await addChild(src["id"], "子 A");
    await f.admin.query(
      "insert into test_specs (tenant_id, ticket_id, check_kind, title, created_by) values ($1, $2, 'human', '子の確認', $3)",
      [T.tenantId, c["id"], writer.id],
    );
    await f.admin.query(
      "insert into ticket_field_values (tenant_id, ticket_id, field_id, value) select $1, $2, id, '\"子の値\"'::jsonb from custom_fields where tenant_id = $1 and name = 'メモ'",
      [T.tenantId, c["id"]],
    );
    const other = await createOk(writer, newBody({ title: "子の関連の相手" }));
    await f.admin.query(
      "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind) values ($1, $2, $3, 'related')",
      [T.tenantId, c["id"], other["id"]],
    );
    expect((await bodyOf(c["id"]))!.body.text).toContain("[x] 子の作業");
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ALL }));
    const k = (await childrenOf(t["id"]))[0]!;
    const b = (await bodyOf(k.id))!;
    expect(b.version).toBe(1);
    expect(b.body.doc).toEqual(childCopyDoc("子 A"));
    expect(b.body.text).toBe(docToText(childCopyDoc("子 A") as never));
    expect(b.body.text).not.toContain("[x]");
    expect(await specsOf(k.id)).toHaveLength(0);
    expect(await valuesOf(k.id)).toEqual({});
    expect(await linksOf(k.id)).toEqual([{ from_ticket_id: k.id, to_ticket_id: c["id"], kind: "derived_from" }]);
  });
  it("K438-API-015 失敗：複製の親が 2 段目で、子を写すと 3 段を超える × 作る：409・E-DUP-002・欄・details・detail なし・何も作られない。子を写さなければ 201", async () => {
    const src = await makeSource();
    await addChild(src["id"], "子 1");
    const a = await createOk(writer, newBody({ title: "上の親" }));
    const b = await createOk(writer, newBody({ title: "親", parent_ticket_id: a["id"] }));
    const before = await snapshot();
    const r = await create(writer, newBody({ duplicate_of: src["id"], copy: ["children"], parent_ticket_id: b["id"] }));
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe("E-DUP-002");
    noFields(j);
    expect(await snapshot()).toEqual(before);
    expect(
      (await create(writer, newBody({ duplicate_of: src["id"], copy: ["body"], parent_ticket_id: b["id"] }))).status,
    ).toBe(201);
  });
  it("K438-API-016 子の担当者（作った人でない人）に受け箱の「担当になりました」が 1 つずつ。作った人の子には出ない", async () => {
    const src = await makeSource();
    await addChild(src["id"], "子 1");
    await addChild(src["id"], "子 2");
    await addChild(src["id"], "自分の子", { assignee_member_id: writer.id });
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["children"] }));
    const ids = (await childrenOf(t["id"])).map((k) => k.id);
    const n = await q<{ member_id: string }>(
      "select member_id from notifications where event_kind_id = 'ticket.assigned' and payload->>'ticket_id' = any($1::text[])",
      [ids],
    );
    expect(n.map((x) => x.member_id)).toEqual([third.id, third.id]);
  });
  it("K438-API-025 失敗（手順 S1）：子を書く途中で DB が落ちる × 作る：503・E-PAGE-003・複製・本文・確認項目・項目の値・線・子・お知らせ・証跡が前のまま（全部戻る）", async () => {
    const src = await makeSource();
    await addChild(src["id"], "子 1");
    await addChild(src["id"], "途中で落ちる子");
    const restore = await failOn("k438_fail_s1", "tickets", "new.title = '途中で落ちる子'");
    const before = await snapshot();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await create(writer, newBody({ duplicate_of: src["id"], copy: ALL }));
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await restore();
    }
    expect(await snapshot()).toEqual(before);
  });
  it("K438-API-026 失敗（手順 S2）：子の担当者へのお知らせ（受け箱の行）を書く所で DB が落ちる × 作る：503・E-PAGE-003・何も残らない", async () => {
    const src = await makeSource();
    await addChild(src["id"], "お知らせで落ちる子");
    const restore = await failOn(
      "k438_fail_s2",
      "notifications",
      `new.event_kind_id = 'ticket.assigned' and new.member_id = '${third.id}'`,
    );
    const before = await snapshot();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await create(writer, newBody({ duplicate_of: src["id"], copy: ["children"] }));
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await restore();
    }
    expect(await snapshot()).toEqual(before);
  });
});
