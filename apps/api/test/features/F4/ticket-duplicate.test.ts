// K-438「複製する口（createTicket の duplicate_of・copy[]・元へのつながり）」の単体の試験（口・本物の DB）。2026-11-22 の作り直し（本文 1 枚・項目・確認項目）。
// 名前の頭の行 ID（K438-API-…）は 11_tickets/K-438.md の表のマスに 1 対 1 で結ぶ。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
//   複製は createTicket（POST /tickets）に duplicate_of と copy[]（body・assignee・fields・specs・links・children の 6 つ。添付は 422）を足した物（D-150.6・D-150.27）
//   写すと選んだ物は元から取り、入力の同じ欄は（元に中身がある限り）使わない。期限と開始日は入力のまま（画面が元の日付を入れて送る）。元へのつながり（派生元）は copy に関わらず 1 本
//   本文のチェックの箱は外して写す（text は口が docToText で作り直す）。確認項目は出どころ（source）を元のまま・チェックを外して写す
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { docToText } from "@kaname/contracts";
import { KanameError } from "@kaname/errors";
import {
  ALL,
  COPY_DOC,
  FLD,
  OPT,
  REF,
  SRC_DOC,
  T,
  O,
  addChild,
  bodyOf,
  closeDup,
  count,
  create,
  createOk,
  derivedFrom,
  f,
  failOn,
  group,
  issue,
  jst,
  json,
  linksOf,
  mate,
  newBody,
  noFields,
  outsider,
  q,
  relate,
  setupDup,
  snapshot,
  sourceBody,
  specsOf,
  task,
  third,
  valuesOf,
  viewer,
  writer,
  makeSource,
  childrenOf,
} from "./ticket-duplicate.harness.js";

beforeAll(setupDup, 60_000);
afterAll(closeDup);
const ticketRow = async (id: unknown) =>
  (
    await q<{
      priority: string;
      priority_reason: string | null;
      estimate_minutes: number | null;
      assignee_member_id: string;
      parent_ticket_id: string | null;
      due_on: string;
      start_on: string | null;
    }>(
      "select priority, priority_reason, estimate_minutes, assignee_member_id, parent_ticket_id, due_on::text as due_on, start_on::text as start_on from tickets where id = $1",
      [id],
    )
  )[0]!;

describe("K-438 複製する（口・本物の DB）：写す物・元へのつながり", () => {
  it("K438-API-001 全部写す（copy が 6 つ）× 作る：201・新しい番号・題名と期限は入力どおり・担当者・優先度・見込み・本文・項目の値・確認項目・つながり・子が写り、元へのつながりが 1 本", async () => {
    const src = await makeSource();
    const rel = await createOk(writer, sourceBody({ title: "関連の相手" }));
    await relate(src["id"], rel);
    await addChild(src["id"], "子 1");
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ALL }));
    expect(t["number"]).not.toBe(src["number"]);
    expect(String(t["number"])).toMatch(/^EG-\d+$/);
    expect(t).toMatchObject({
      title: "複製した請求書",
      due_on: jst(5),
      assignee_member_id: mate.id,
      parent_ticket_id: null,
    });
    expect(await ticketRow(t["id"])).toMatchObject({
      priority: "high",
      priority_reason: "月末までに必要",
      estimate_minutes: 90,
    });
    const b = await bodyOf(t["id"]);
    expect(b).toMatchObject({ version: 1, body: { doc: COPY_DOC, text: docToText(COPY_DOC as never) } });
    expect((await specsOf(t["id"])).map((s) => s.title)).toEqual(["請求額が見積と一致する", "文面がていねいか"]);
    expect(await valuesOf(t["id"])).toMatchObject({
      [FLD.memo]: "元のメモ",
      [FLD.amount]: 12000.5,
      [FLD.dept]: OPT.o1,
    });
    expect((await linksOf(t["id"])).map((l) => l.kind).sort()).toEqual(["derived_from", "related"]);
    expect(await childrenOf(t["id"])).toHaveLength(1);
    expect(await derivedFrom(t["id"])).toEqual([src["id"]]);
  });
  it("K438-API-002 copy を付けない・空の配列 × 作る：本文・項目・確認項目は入力どおり・担当者は入力どおり・つながり 0・子 0。元へのつながりだけは残る", async () => {
    const src = await makeSource();
    await addChild(src["id"], "子 1");
    for (const extra of [{}, { copy: [] }]) {
      const t = await createOk(
        writer,
        newBody({ duplicate_of: src["id"], specs: ["入力の確認"], fields: { [FLD.free]: 7 }, ...extra }),
      );
      expect((await bodyOf(t["id"]))!.body.text).toBe("入力の本文");
      expect((await specsOf(t["id"])).map((s) => s.title)).toEqual(["入力の確認"]);
      expect(await valuesOf(t["id"])).toEqual({ [FLD.free]: 7 });
      expect(await ticketRow(t["id"])).toMatchObject({ assignee_member_id: writer.id, priority: "mid" });
      expect(await childrenOf(t["id"])).toHaveLength(0);
      expect(await linksOf(t["id"])).toEqual([
        { from_ticket_id: t["id"], to_ticket_id: src["id"], kind: "derived_from" },
      ]);
    }
  });
  it("K438-API-003 元のチケットは変わらない：元の行・本文・版・確認項目・項目の値・元から出るつながり・子が複製の前と同じ", async () => {
    const src = await makeSource();
    const child = await addChild(src["id"], "子 1");
    const dump = async () =>
      JSON.stringify([
        await q("select * from tickets where id = any($1::uuid[]) order by id", [[src["id"], child["id"]]]),
        await q("select * from ticket_sections where ticket_id = $1 order by section_key", [src["id"]]),
        await q("select * from ticket_section_versions where ticket_id = $1 order by version", [src["id"]]),
        await q("select * from test_specs where ticket_id = $1 order by title", [src["id"]]),
        await q("select * from ticket_field_values where ticket_id = $1 order by field_id", [src["id"]]),
        await q("select * from ticket_links where from_ticket_id = $1 or to_ticket_id = $1", [src["id"]]).then((rows) =>
          rows.filter((r) => r["kind"] === "related"),
        ),
        await count("select count(*) as n from tickets where parent_ticket_id = $1", [src["id"]]),
      ]);
    const before = await dump();
    await createOk(writer, newBody({ duplicate_of: src["id"], copy: ALL }));
    expect(await dump()).toBe(before);
  });
  it("K438-API-004 本文を写す：チェックの箱は全部外れる（doc も text も）・見出し・表・薄い字の説明は元のまま・版 1。別の種別へ複製しても同じ", async () => {
    const src = await makeSource();
    for (const kind of [task.id, issue.id]) {
      const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["body"], kind_id: kind }));
      const b = (await bodyOf(t["id"]))!;
      expect(b.body.doc).toEqual(COPY_DOC);
      expect(b.body.text).toBe(docToText(COPY_DOC as never));
      expect(b.body.text).not.toContain("[x]");
      expect(b.body.text).toContain("[ ] 作る");
      expect(b.version).toBe(1);
      expect(
        await count("select count(*) as n from ticket_section_versions where ticket_id = $1 and version = 1", [
          t["id"],
        ]),
      ).toBe(1);
    }
    expect((await bodyOf(src["id"]))!.body.doc).toEqual(SRC_DOC); // 元の箱は済みのまま
  });
  it("K438-API-005 元に本文が無い（本文の行が無い前の形のチケット・空の本文）× 本文を写す：入力の本文を使う（区画は読まない）", async () => {
    const src = await makeSource();
    await f.admin.query("update ticket_sections set deleted_at = now() where ticket_id = $1 and section_key = 'body'", [
      src["id"],
    ]);
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["body"] }));
    expect((await bodyOf(t["id"]))!.body.text).toBe("入力の本文");
    const empty = await makeSource({ body: { doc: { type: "doc", content: [] } } });
    const u = await createOk(writer, newBody({ duplicate_of: empty["id"], copy: ["body"] }));
    expect((await bodyOf(u["id"]))!.body.text).toBe("入力の本文");
  });
  it("K438-API-006 担当者を写す：担当者は元の担当者（入力の担当者は使わない）・その人の受け箱に「担当になりました」が 1 つ。写さなければ入力の担当者", async () => {
    const src = await makeSource();
    const t = await createOk(
      writer,
      newBody({ duplicate_of: src["id"], copy: ["assignee"], assignee_member_id: third.id }),
    );
    expect(t["assignee_member_id"]).toBe(mate.id);
    expect(
      await q("select member_id, event_kind_id from notifications where payload->>'ticket_id' = $1", [t["id"]]),
    ).toEqual([{ member_id: mate.id, event_kind_id: "ticket.assigned" }]);
    const u = await createOk(
      writer,
      newBody({ duplicate_of: src["id"], copy: ["body"], assignee_member_id: writer.id }),
    );
    expect(u["assignee_member_id"]).toBe(writer.id);
  });
  it("K438-API-007 担当者を写す・元の担当者が抜けた × 作る：404・E-PAGE-001・欄なし・何も作られない。写さない作り方は 201", async () => {
    const gone = await f.person(T.tenantId, T.rootScope, { name: "抜けた担当者", ticketAbility: "edit" });
    const src = await makeSource({ assignee_member_id: gone.id });
    await f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const before = await snapshot();
    const r = await create(writer, newBody({ duplicate_of: src["id"], copy: ["assignee"] }));
    expect(r.status).toBe(404);
    const j = await json(r);
    expect(j["code"]).toBe("E-PAGE-001");
    noFields(j);
    expect(await snapshot()).toEqual(before);
    expect((await create(writer, newBody({ duplicate_of: src["id"], copy: ["body"] }))).status).toBe(201);
  });
  it("K438-API-008 項目を写す：優先度と理由・予定時間・会社の項目の値が元のとおり。期限は入力のまま・開始日は空（元に開始日があっても写さない）。その種別に出ない項目と選択肢から外れた値は黙って写さない。入力の項目は元に値の無い項目だけ使う", async () => {
    const src = await makeSource({ start_on: jst(25) });
    expect((await ticketRow(src["id"])).start_on, "元には開始日がある").toBe(jst(25));
    const t = await createOk(
      writer,
      newBody({
        duplicate_of: src["id"],
        copy: ["fields"],
        due_on: jst(6),
        fields: { [FLD.memo]: "入力のメモ", [FLD.free]: 5 },
      }),
    );
    expect(await ticketRow(t["id"])).toMatchObject({
      priority: "high",
      priority_reason: "月末までに必要",
      estimate_minutes: 90,
      due_on: jst(6),
      start_on: null,
    });
    expect(await valuesOf(t["id"])).toEqual({
      [FLD.memo]: "元のメモ",
      [FLD.amount]: 12000.5,
      [FLD.dept]: OPT.o1,
      [FLD.free]: 5,
    });
    const u = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["fields"], kind_id: issue.id }));
    expect(await valuesOf(u["id"])).toMatchObject({ [FLD.issueOnly]: "課題だけの値" }); // 課題には出る項目なので写る
  });
  it("K438-API-009 会社が必須にした項目が、元にも入力にも値が無い × 項目を写して作る：409・E-FLD-004・欄なし・何も作られない（元は無傷）", async () => {
    const src = await makeSource();
    const req = (
      await q<{ id: string }>(
        "insert into custom_fields (tenant_id, name, field_type, required, position) values ($1, '必須の項目', 'short_text', true, 2) returning id",
        [T.tenantId],
      )
    )[0]!.id;
    try {
      const before = await snapshot();
      const r = await create(writer, newBody({ duplicate_of: src["id"], copy: ["fields"] }));
      expect(r.status).toBe(409);
      const j = await json(r);
      expect(j["code"]).toBe("E-FLD-004");
      noFields(j);
      expect(await snapshot()).toEqual(before);
      expect(
        (await create(writer, newBody({ duplicate_of: src["id"], copy: ["fields"], fields: { [req]: "入れた" } })))
          .status,
      ).toBe(201);
    } finally {
      await f.admin.query("update custom_fields set deleted_at = now() where id = $1", [req]);
    }
  });
  it("K438-API-010 確認項目を写す：文・出どころ（source と source_ref_id）は元のまま・チェックは外れる・版 1・作った順・消した行は写さない。入力の確認項目は使わない", async () => {
    const src = await makeSource();
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["specs"], specs: ["入力の確認"] }));
    const rows = await specsOf(t["id"]);
    expect(rows.map((s) => s.title)).toEqual(["請求額が見積と一致する", "文面がていねいか"]);
    expect(rows.map((s) => [s.source, s.source_ref_id])).toEqual([
      ["manual", null],
      ["knowledge", REF.page],
    ]);
    for (const s of rows)
      expect(s).toMatchObject({
        checked_at: null,
        checked_by_member_id: null,
        checked_by_ai: false,
        version: 1,
        created_by: writer.id,
      });
    expect((await specsOf(src["id"])).filter((s) => s.checked_at !== null)).toHaveLength(1); // 元のチェックは残る
  });
  it("K438-API-011 つながりを写す：元の関連のうち相手が見える物だけ（向きは問わない）。元の派生元・元から派生した先・見えない相手の線は写さない", async () => {
    const src = await makeSource();
    const a = await createOk(writer, sourceBody({ title: "関連 A" }));
    const b = await createOk(writer, sourceBody({ title: "関連 B" }));
    const hidden = await createOk(mate, sourceBody({ title: "取り込み中の関連" }));
    const imp = (
      await q<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source, created_by) values ($1, $2, $3, 'generic', $2) returning id",
        [T.tenantId, mate.id, T.rootScope],
      )
    )[0]!;
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [hidden["id"], imp.id]);
    await relate(src["id"], a);
    await relate(src["id"], b, true);
    await relate(src["id"], hidden);
    const origin = await createOk(writer, sourceBody({ title: "元の派生元" }));
    await f.admin.query(
      "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind) values ($1, $2, $3, 'derived_from'), ($1, $4, $2, 'derived_from')",
      [T.tenantId, src["id"], origin["id"], a["id"]],
    );
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ["links"] }));
    const ls = await linksOf(t["id"]);
    const others = ls
      .filter((l) => l.kind === "related")
      .map((l) => (l.from_ticket_id === t["id"] ? l.to_ticket_id : l.from_ticket_id))
      .sort();
    expect(others).toEqual([a["id"], b["id"]].sort());
    expect(ls.filter((l) => l.kind === "derived_from")).toEqual([
      { from_ticket_id: t["id"], to_ticket_id: src["id"], kind: "derived_from" },
    ]);
  });
  it("K438-API-017 元が無い（でたらめの id）・消えた × 作る：404・E-DUP-001・欄・details・detail なし・何も作られない", async () => {
    const src = await makeSource();
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [src["id"], writer.id]);
    const before = await snapshot();
    for (const id of [randomUUID(), src["id"] as string]) {
      const r = await create(writer, newBody({ duplicate_of: id, copy: ALL }));
      expect(r.status, id).toBe(404);
      const j = await json(r);
      expect(j["code"], id).toBe("E-DUP-001");
      noFields(j, id);
    }
    expect(await snapshot()).toEqual(before);
  });
  it("K438-API-018 元が別の会社・他の人の取り込み中の下書き・見えないグループ × 作る：同じ 404・E-DUP-001。題名も「ある」ことも返さない", async () => {
    const theirKind = (
      await q<{ id: string }>("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [O.tenantId])
    )[0]!.id;
    const theirs = await createOk(outsider, {
      scope_id: O.rootScope,
      kind_id: theirKind,
      title: "別の会社の秘密の題名",
      assignee_member_id: outsider.id,
      due_on: jst(3),
    });
    const imp = (
      await q<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source, created_by) values ($1, $2, $3, 'generic', $2) returning id",
        [T.tenantId, mate.id, T.rootScope],
      )
    )[0]!;
    const draft = await createOk(mate, sourceBody({ title: "取り込み中の秘密の題名" }));
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [draft["id"], imp.id]);
    const onlySales = await f.person(T.tenantId, group, { name: "営業だけの人", ticketAbility: "edit" });
    const rootOnly = await createOk(writer, sourceBody({ title: "全体のグループの秘密の題名" }));
    const before = await snapshot();
    for (const [who, id] of [
      [writer, theirs["id"]],
      [writer, draft["id"]],
      [onlySales, rootOnly["id"]],
    ] as const) {
      const r = await create(
        who,
        newBody({ scope_id: who === onlySales ? group : T.rootScope, duplicate_of: id, copy: ALL }),
      );
      expect(r.status).toBe(404);
      const text = await r.text();
      expect(JSON.parse(text)["code"]).toBe("E-DUP-001");
      noFields(JSON.parse(text));
      expect(text).not.toContain("秘密");
    }
    expect(await snapshot()).toEqual(before);
  });
  it("K438-API-019 元に書く権限は要らない・読めれば足りる：全体は見るだけ・営業は書ける人が、全体の元を営業へ複製して 201", async () => {
    const src = await makeSource();
    const p = await f.person(T.tenantId, T.rootScope, { name: "全体は見るだけ", ticketAbility: "view" });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'edit')",
      [T.tenantId, p.id, group],
    );
    const t = await createOk(
      p,
      newBody({ scope_id: group, duplicate_of: src["id"], copy: ["body", "specs"], assignee_member_id: p.id }),
    );
    expect(String(t["number"])).toMatch(/^SL-\d+$/);
    expect(t["scope_id"]).toBe(group);
    expect(await derivedFrom(t["id"])).toEqual([src["id"]]);
    expect((await specsOf(t["id"])).length).toBe(2);
  });
  it("K438-API-020 copy の形と契約：知らない名前・添付（attachments）・参照（references）・重複・文字だけ・元の無い copy（空の配列も）は 422。正本は E-DUP-001＝404・E-DUP-002＝409 で、契約の createTicket の 4xx に両方ある", async () => {
    const src = await makeSource();
    const before = await snapshot();
    for (const c of [["body", "ほかの物"], ["attachments"], ["references"], ["body", "body"], "body"]) {
      const r = await create(writer, newBody({ duplicate_of: src["id"], copy: c }));
      expect(r.status, JSON.stringify(c)).toBe(422);
      expect(JSON.stringify((await json(r))["details"]), JSON.stringify(c)).toContain("copy");
    }
    for (const b of [newBody({ copy: ["body"] }), newBody({ copy: [] })]) {
      const r = await create(writer, b);
      expect(r.status).toBe(422);
      expect(((await json(r))["details"] as unknown[]).length).toBeGreaterThan(0);
    }
    expect(await snapshot()).toEqual(before);
    expect(new KanameError("E-DUP-001").status).toBe(404);
    expect(new KanameError("E-DUP-002").status).toBe(409);
    const eps = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../../../08_api/endpoints.json", import.meta.url)), "utf8"),
    ) as {
      endpoints: { operation_id?: string; outputs_4xx: { status: number; code: string }[] }[];
    };
    const pairs = eps.endpoints
      .find((x) => x.operation_id === "createTicket")!
      .outputs_4xx.map((o) => `${o.status} ${o.code}`);
    expect(pairs).toContain("404 E-DUP-001");
    expect(pairs).toContain("409 E-DUP-002");
  });
  it("K438-API-021 duplicate_of の形：uuid でない・空・数・NUL を含む × 作る：422・欄 duplicate_of・何も作られない", async () => {
    const before = await snapshot();
    for (const v of ["abc", "", 7, "00000000-0000-4000-8000-00000000000\u0000"]) {
      const r = await create(writer, newBody({ duplicate_of: v }));
      expect(r.status, String(v)).toBe(422);
      expect(JSON.stringify((await json(r))["details"]), String(v)).toContain("duplicate_of");
    }
    expect(await snapshot()).toEqual(before);
  });
  it("K438-API-022 元へのつながり：ticket_links に from＝複製・to＝元・kind derived_from の 1 行。copy が空でも同じ。tickets.derived_from_ticket_id は使わない。同じ元から 2 回なら別の複製と線が 2 つ", async () => {
    const src = await makeSource();
    const a = await createOk(writer, newBody({ duplicate_of: src["id"] }));
    const b = await createOk(writer, newBody({ duplicate_of: src["id"], copy: ALL }));
    expect(a["id"]).not.toBe(b["id"]);
    for (const t of [a, b]) {
      expect(await derivedFrom(t["id"])).toEqual([src["id"]]);
      expect(t["derived_from_ticket_id"]).toBeNull();
    }
    expect(
      await count("select count(*) as n from ticket_links where to_ticket_id = $1 and kind = 'derived_from'", [
        src["id"],
      ]),
    ).toBe(2);
  });
  it("K438-API-023 複製の直後：期限は入力どおり（元の期限を渡せば元のまま）・題名に「（複製）」を付けない。今日より前の期限は 409・E-VAL-012・欄なし", async () => {
    const src = await makeSource();
    const t = await createOk(writer, newBody({ duplicate_of: src["id"], title: src["title"], due_on: src["due_on"] }));
    expect(t["title"]).toBe("元の請求書");
    expect(t["due_on"]).toBe(src["due_on"]);
    const r = await create(writer, newBody({ duplicate_of: src["id"], due_on: jst(-1) }));
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe("E-VAL-012");
    noFields(j);
  });
  it("K438-API-024 証跡とログ：audit_events に ticket.duplicate が 1 行（元の id・写した物の並び・写した子の数）。題名・本文・項目の値はこの行にもログにも出ない", async () => {
    const src = await makeSource({ title: "ログに出してはいけない元の題名" });
    await addChild(src["id"], "ログに出してはいけない子の題名");
    const logs: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" "))),
    );
    let t: Record<string, unknown>;
    try {
      t = await createOk(
        writer,
        newBody({ title: "ログに出してはいけない複製の題名", duplicate_of: src["id"], copy: ["body", "children"] }),
      );
    } finally {
      for (const s of spies) s.mockRestore();
    }
    const rows = await q<{ target_type: string; payload: Record<string, unknown>; actor_member_id: string }>(
      "select target_type, payload, actor_member_id from audit_events where action = 'ticket.duplicate' and target_id = $1",
      [t["id"]],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ target_type: "tickets", actor_member_id: writer.id });
    expect(rows[0]!.payload).toEqual({ source_ticket_id: src["id"], copy: ["body", "children"], children: 1 });
    for (const w of ["ログに出してはいけない", "月末の請求を出す", "元のメモ"]) {
      expect(JSON.stringify(rows[0]!.payload)).not.toContain(w);
      expect(logs.join("\n")).not.toContain(w);
    }
  });
  it("K438-API-027 失敗（手順 S3）：証跡の行を書く所で DB が落ちる × 作る：503・E-PAGE-003・複製も本文も確認項目も子も線も残らない", async () => {
    const src = await makeSource();
    await addChild(src["id"], "子 1");
    const restore = await failOn("k438_fail_s3", "audit_events", "new.action = 'ticket.duplicate'");
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
  it("K438-API-028 二度押し（同じ冪等キー）：2 回とも同じ 201・同じ id・複製 1 つ・子 1 組・線 1 本・証跡 1 行", async () => {
    const src = await makeSource();
    await addChild(src["id"], "子 1");
    const key = { "idempotency-key": randomUUID() };
    const b = newBody({ duplicate_of: src["id"], copy: ALL });
    const r1 = await create(writer, b, key);
    const afterFirst = await snapshot();
    const r2 = await create(writer, b, key);
    expect(await snapshot()).toEqual(afterFirst);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    const id = ((await json(r1)).data as Record<string, unknown>)["id"];
    expect(((await json(r2)).data as Record<string, unknown>)["id"]).toBe(id);
    expect(await childrenOf(id)).toHaveLength(1);
    expect(
      await count("select count(*) as n from audit_events where action = 'ticket.duplicate' and target_id = $1", [id]),
    ).toBe(1);
  });
  it("K438-API-029 同時に 2 本複製（別の冪等キー）：2 つできる・番号が重ならない・子がそれぞれ 1 組ずつ", async () => {
    const src = await makeSource();
    await addChild(src["id"], "子 1");
    const [a, b] = await Promise.all([
      create(writer, newBody({ title: "同時 1", duplicate_of: src["id"], copy: ["children"] })),
      create(
        mate,
        newBody({ title: "同時 2", duplicate_of: src["id"], copy: ["children"], assignee_member_id: mate.id }),
      ),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const ta = (await json(a)).data as Record<string, unknown>;
    const tb = (await json(b)).data as Record<string, unknown>;
    expect(ta["number"]).not.toBe(tb["number"]);
    const nums = [...(await childrenOf(ta["id"])), ...(await childrenOf(tb["id"]))].map((k) => k.number);
    expect(new Set(nums).size).toBe(2);
  });
  it("K438-API-030 守り：見るだけの人・別の会社のグループは 403・ログインなしは 401・別の会社の人が元の id を直に 404（題名を返さない）。どれも何も作られない", async () => {
    const src = await makeSource();
    const before = await snapshot();
    expect((await create(viewer, newBody({ duplicate_of: src["id"], copy: ALL }))).status).toBe(403);
    expect((await create(writer, newBody({ scope_id: O.rootScope, duplicate_of: src["id"] }))).status).toBe(403);
    expect((await f.req("POST", "/tickets", { body: newBody({ duplicate_of: src["id"] }) })).status).toBe(401);
    const theirKind = (
      await q<{ id: string }>("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [O.tenantId])
    )[0]!.id;
    const r = await create(
      outsider,
      newBody({
        duplicate_of: src["id"],
        copy: ALL,
        scope_id: O.rootScope,
        kind_id: theirKind,
        assignee_member_id: outsider.id,
      }),
    );
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("元の請求書");
    expect(await snapshot()).toEqual(before);
  });
});
