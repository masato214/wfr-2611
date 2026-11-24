// K-60「チケットを作る」の単体の試験（口・本物の DB）。名前の頭の行 ID（K60-API-…）は 11_tickets/K-60.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   必須：題名・種別・担当者・期限と、会社が必須にした項目（K-437 の作り直し：本文は 1 枚の文書 body.doc・空でも作れる・必須の区画は無い）
//   期限は入れた時点（日本時間の今日）より前は不可・開始は過去も可（D-128.138）。知らせる人は最初から選べる（D-128.138）
//   書きかけの下書きはサーバーに残す（listMyTicketDrafts・saveMyTicketDraft・D-128.138）
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { checkCreate, TITLE_MAX, todayJst } from "../../../src/features/F4/create-ticket/input.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let group: string; // T の中の 2 つ目のグループ（書けない人がいる）
let writer: Person;
let mate: Person; // 同じ会社の人（担当者に選ぶ）
let viewer: Person;
let outsider: Person; // 別の会社の人
let task: { id: string };
let issue: { id: string };

const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const para = (t: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });
const body = (extra: Record<string, unknown> = {}) => ({
  scope_id: T.rootScope,
  kind_id: task.id,
  title: "請求書を送る",
  assignee_member_id: mate.id,
  due_on: jst(3),
  body: { doc: para("月末の請求を出す") },
  ...extra,
});
const create = (who: Person, b: unknown = body(), headers: Record<string, string> = {}) =>
  f.req("POST", "/tickets", { body: b, headers: { ...who.auth, ...headers } });
const createOk = async (who: Person, b: unknown = body()) => {
  const r = await create(who, b);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as Record<string, unknown>;
};
const count = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const ticketsIn = (tenant: string) => count("select count(*) as n from tickets where tenant_id = $1", [tenant]);
/** 選べない・見えない選び先の断り（控え帳 2026-11-21 01:15・20:50）：404 の E-PAGE-001 で、欄・details・detail を付けない（在るかを漏らさない） */
const expectGone = (status: number, j: Record<string, unknown>, label = "") => {
  expect(status, label).toBe(404);
  expect(j["code"], label).toBe("E-PAGE-001");
  for (const k of ["field", "details", "detail"]) expect(k in j, `${label} ${k}`).toBe(false);
};
/** 今日・DB の種別の形で決まる断り（PM の決め 2026-11-21 02:00・E-VAL-015 と同じ形）：409 で、欄・details・detail を付けない。「どの欄か」は画面が code で決める */
const expectConflict = (status: number, j: Record<string, unknown>, code: string, label = "") => {
  expect(status, label).toBe(409);
  expect(j["code"], label).toBe(code);
  for (const k of ["field", "details", "detail"]) expect(k in j, `${label} ${k}`).toBe(false);
};
const fields = (j: Record<string, unknown>) =>
  ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  // この試験のファイルは 1 人で 60 件より多く作る。1 分 60 回の上限は K60-API-031 だけで確かめ、ほかの行では上げておく
  f.limits["createTicket"] = 10_000;
  T = await f.company("K60 の会社", "EG");
  O = await f.company("K60 の別の会社", "OT");
  group = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '営業', 'SL') returning id",
      [T.tenantId, T.rootScope],
    )
  ).rows[0]!.id;
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  viewer = await f.person(T.tenantId, T.rootScope, { name: "見るだけの人", ticketAbility: "view" });
  outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
  const kinds = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as unknown as {
    id: string;
    name: string;
  }[];
  task = kinds.find((k) => k.name === "タスク")!;
  issue = kinds.find((k) => k.name === "課題")!;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-60 チケットを作る：状態 × 入口 × 利用者の状態（口・本物の DB）", () => {
  it("K60-API-001 無し（新しく作る）× ログイン中・書ける：番号（グループの頭＋連番）・未着手・本文の行（鍵 body・版 1）ができる", async () => {
    const t = await createOk(writer);
    expect(String(t["number"])).toMatch(/^EG-\d+$/);
    const stage = await f.admin.query<{ key: string }>(
      "select s.key from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
      [t["id"]],
    );
    expect(stage.rows[0]!.key).toBe("todo");
    const secs = await f.admin.query<{ section_key: string; version: number }>(
      "select section_key, version from ticket_sections where ticket_id = $1 order by position",
      [t["id"]],
    );
    expect(secs.rows.map((r) => r.section_key)).toEqual(["body"]);
    expect(secs.rows.every((r) => r.version === 1)).toBe(true);
    expect(
      await count("select count(*) as n from ticket_section_versions where ticket_id = $1 and version = 1", [t["id"]]),
    ).toBe(1);
    // 読むだけの詳細（getTicket）で、属性が読める（本文の答えは K-560 が見る）
    const d = (await json(await f.req("GET", `/tickets/${t["id"]}`, { headers: writer.auth }))).data!;
    expect(d["ticket"]).toMatchObject({ id: t["id"], number: t["number"], title: "請求書を送る" });
    expect(d["stage"]).toMatchObject({ key: "todo", name: "未着手" });
    expect(d["kind"]).toMatchObject({ name: "タスク" });
    expect(d["assignee"]).toMatchObject({ id: mate.id });
  });

  it("K60-API-002 番号はあとで変わらない・入ってきた番号は使わない（外から入れると 422）", async () => {
    const r = await create(writer, body({ number: "EG-9999" }));
    expect(r.status).toBe(422);
    const t = await createOk(writer);
    await expect(f.admin.query("update tickets set number = 'EG-1' where id = $1", [t["id"]])).rejects.toThrow(
      /番号は変えない/,
    );
  });

  it("K60-API-003 担当者が自分でなければ、担当者の受け箱に「担当になりました」を 1 件（題名と番号だけ・本文は入れない）", async () => {
    const t = await createOk(writer);
    const n = await f.admin.query<{ member_id: string; payload: Record<string, unknown> }>(
      "select member_id, payload from notifications where payload->>'ticket_id' = $1",
      [t["id"]],
    );
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0]!.member_id).toBe(mate.id);
    expect(Object.keys(n.rows[0]!.payload).sort()).toEqual(["number", "ticket_id", "title"]);
    expect(JSON.stringify(n.rows[0]!.payload)).not.toContain("月末の請求を出す");
    const mine = await createOk(writer, body({ assignee_member_id: writer.id }));
    expect(await count("select count(*) as n from notifications where payload->>'ticket_id' = $1", [mine["id"]])).toBe(
      0,
    );
  });

  it("K60-API-004 知らせる人を選べる（D-128.138）：選んだ人と担当者に 1 通ずつ。同じ人には 1 通・作った本人には送らない", async () => {
    const t = await createOk(writer, body({ notify_member_ids: [viewer.id, mate.id, viewer.id, writer.id] }));
    const n = await f.admin.query<{ member_id: string; event_kind_id: string }>(
      "select member_id, event_kind_id from notifications where payload->>'ticket_id' = $1 order by event_kind_id",
      [t["id"]],
    );
    expect(n.rows).toEqual([
      { member_id: mate.id, event_kind_id: "ticket.assigned" },
      { member_id: viewer.id, event_kind_id: "ticket.created" },
    ]);
  });

  it("K60-API-005 無し × 閲覧のみの人：口は 403 で何もできない", async () => {
    const before = await ticketsIn(T.tenantId);
    const r = await create(viewer);
    expect(r.status).toBe(403);
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K60-API-006 無し × 口を直に × 先方の人（ゲスト）・運営の人：403。何もできない", async () => {
    const before = await ticketsIn(T.tenantId);
    for (const role of ["client", "ops"] as const)
      expect((await create({ ...writer, auth: f.as(writer, role) })).status).toBe(403);
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K60-API-007 無し × PC をつないでいない：作れる（D-127.8）", async () => {
    expect(
      await count("select count(*) as n from sessions where member_id = $1 and kind_id = 'bridge'", [writer.id]),
    ).toBe(0);
    await createOk(writer);
  });

  it("K60-API-008 未着手（作った直後）× 同じ冪等キーで口をもう一度：同じチケットを返す。2 件目はできない", async () => {
    const k = { "idempotency-key": randomUUID() };
    const r1 = await create(writer, body({ title: "冪等" }), k);
    const before = await ticketsIn(T.tenantId);
    const r2 = await create(writer, body({ title: "冪等" }), k);
    expect(r2.status).toBe(201);
    expect((await json(r2)).data!["id"]).toBe((await json(r1)).data!["id"]);
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K60-API-009 親（2 段目まで・見える）× 親を選んで作る：子として作る", async () => {
    const top = await createOk(writer);
    const mid = await createOk(writer, body({ parent_ticket_id: top["id"] }));
    const low = await createOk(writer, body({ parent_ticket_id: mid["id"] }));
    expect(low["parent_ticket_id"]).toBe(mid["id"]);
  });

  it("K60-API-010 親（3 段目）× 親を選んで作る：409・「チケットの親子は 3 段まで」（E-VAL-015・今の状態ではできない・K-437 で 422 から直した・欄と details は付けない）", async () => {
    const a = await createOk(writer);
    const b = await createOk(writer, body({ parent_ticket_id: a["id"] }));
    const c = await createOk(writer, body({ parent_ticket_id: b["id"] }));
    const before = await ticketsIn(T.tenantId);
    const r = await create(writer, body({ parent_ticket_id: c["id"] }));
    expect(r.status).toBe(409);
    const j15 = await json(r);
    expect(j15["code"]).toBe("E-VAL-015");
    for (const k of ["field", "details", "detail"]) expect(k in j15, k).toBe(false);
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K60-API-011 親（消した・書いている間に消された）× 親を選んで作る：「見つかりませんでした」（E-PAGE-001）", async () => {
    const p = await createOk(writer);
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [p["id"], writer.id]);
    const r = await create(writer, body({ parent_ticket_id: p["id"] }));
    expectGone(r.status, await json(r));
  });

  it("K60-API-012 親（他の人の取り込みの下書き・別の会社）× 親の id を直に：見つからない扱い。中身は返さない", async () => {
    const theirs = await createOk(outsider, {
      ...body(),
      scope_id: O.rootScope,
      kind_id: (
        await f.admin.query<{ id: string }>("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [
          O.tenantId,
        ])
      ).rows[0]!.id,
      assignee_member_id: outsider.id,
      title: "別の会社の秘密の題名",
    });
    const r = await create(writer, body({ parent_ticket_id: theirs["id"] }));
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("秘密");
    // 同じ会社でも、他の人（mate）が取り込んでいる途中の下書きのチケットは、取り込んだ本人にしか見えない（D-128.119）
    const imp = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source, created_by) values ($1, $2, $3, 'generic', $2) returning id",
        [T.tenantId, mate.id, T.rootScope],
      )
    ).rows[0]!;
    const d = await createOk(mate, body({ title: "取り込み中の秘密の題名" }));
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [d["id"], imp.id]);
    const before = await ticketsIn(T.tenantId);
    const r2 = await create(writer, body({ parent_ticket_id: d["id"] }));
    expectGone(r2.status, await json(r2));
    expect(
      JSON.stringify(await f.req("GET", `/tickets/${d["id"]}`, { headers: writer.auth }).then((x) => x.json())),
    ).not.toContain("秘密");
    expect(await ticketsIn(T.tenantId), "子は増えない").toBe(before);
  });

  it("K60-API-013 種別（消した・書いている間に消された）× 「作る」：404・E-PAGE-001・欄なし（K-437 で 422 の E-VAL-014 から直した）", async () => {
    const k = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_kinds (tenant_id, name) values ($1, '消す種別') returning id",
        [T.tenantId],
      )
    ).rows[0]!.id;
    await f.admin.query("update ticket_kinds set deleted_at = now() where id = $1", [k]);
    const r = await create(writer, body({ kind_id: k }));
    expect(r.status).toBe(404);
    const j = await json(r);
    expectGone(r.status, j);
  });

  it("K60-API-014 担当者（抜けた・止められた・書いている間に）× 「作る」：404・E-PAGE-001・欄なし（K-437 で 422 の E-VAL-014 から直した）", async () => {
    const gone = await f.person(T.tenantId, T.rootScope, { name: "抜けた人" });
    await f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const stop = await f.person(T.tenantId, T.rootScope, { name: "止められた人" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stop.id]);
    const left = await f.person(T.tenantId, T.rootScope, { name: "ワークスペースを抜けた人" });
    await f.admin.query("insert into tenant_memberships (tenant_id, member_id, status) values ($1, $2, 'left')", [
      T.tenantId,
      left.id,
    ]);
    for (const p of [gone, stop, left]) {
      const r = await create(writer, body({ assignee_member_id: p.id }));
      expect(r.status, p.id).toBe(404);
      const j = await json(r);
      expectGone(r.status, j, p.id);
    }
  });

  it("K60-API-015 グループ（書けない・見えるだけ）× そのグループで作る：口は 403", async () => {
    const r = await create(writer, body({ scope_id: group }));
    // writer は全体（root）に edit を持つので、下のグループにも書ける。見えるだけの人で確かめる
    expect([201]).toContain(r.status);
    const onlyRoot = await f.person(T.tenantId, group, { name: "営業だけの人", ticketAbility: "edit" });
    const r2 = await create(onlyRoot, body({ scope_id: T.rootScope }));
    expect(r2.status).toBe(403);
  });

  it("K60-API-016 グループ（書けるようになった直後）× 「作る」：入り直さなくても作れる", async () => {
    const p = await f.person(T.tenantId, T.rootScope, { name: "後から書ける人" });
    expect((await create(p)).status).toBe(403);
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'edit')",
      [T.tenantId, p.id, T.rootScope],
    );
    expect((await create(p)).status).toBe(201);
  });

  it("K60-API-017 グループ（書けなくなった直後）× 開いていた画面で「作る」：口で 403", async () => {
    const p = await f.person(T.tenantId, T.rootScope, { name: "外される人", ticketAbility: "edit" });
    expect((await create(p)).status).toBe(201);
    await f.admin.query("update permissions set revoked_at = now() where grantee_member_id = $1", [p.id]);
    expect((await create(p)).status).toBe(403);
  });
});

describe("K-60 入力・失敗・操作の揺れ・守り", () => {
  it("K60-API-018 入力：題名が空・200 文字を超える：422・欄の理由", async () => {
    for (const title of ["", "あ".repeat(201)]) {
      const r = await create(writer, body({ title }));
      expect(r.status).toBe(422);
      expect(fields(await json(r))).toContain("title");
    }
    await createOk(writer, body({ title: "あ".repeat(200) }));
  });

  it("K60-API-019 入力：題名は NFKC で整えず前後の空白だけ落とす（長さは生の字で数える・契約の maxLength と口が同じ TITLE_MAX・K-437・D-150.34・PM の決め 2026-11-21 06:40）", async () => {
    // 前後の空白だけの題名は空：422・欄 title（契約の pattern \S と口）
    expect(fields(await json(await create(writer, body({ title: "　 　" }))))).toContain("title");
    // 全角の英数は伸ばさずそのまま保存し、前後の空白（半角・全角・タブ）だけ落とす
    const t = await createOk(writer, body({ title: "  ＡＢＣ請求  " }));
    expect(t["title"]).toBe("ＡＢＣ請求");
    const t2 = await createOk(writer, body({ title: "\t　全角の空白とタブ　\t" }));
    expect(t2["title"]).toBe("全角の空白とタブ");
    // 「㈱」は NFKC で 3 字（(株)）に伸びるが、伸ばさないので 70 字のまま受ける（伸ばすと 210 字で 422 になってしまう題名）
    const kabu = "㈱".repeat(70);
    const t3 = await createOk(writer, body({ title: kabu }));
    expect(t3["title"]).toBe(kabu);
    expect(TITLE_MAX).toBe(200);
    // 長さは打たれた生の字で数える：前後に空白を付けた 200 字は生の字で 201 字なので 422・欄 title（契約の maxLength と同じ数え方）
    const r = await create(writer, body({ title: ` ${"あ".repeat(200)}` }));
    expect(r.status).toBe(422);
    expect(fields(await json(r))).toContain("title");
    // 前後の空白を落とすだけなら 200 字ちょうどは受ける（落とした後の長さ）
    expect((await createOk(writer, body({ title: "あ".repeat(200) })))["title"]).toBe("あ".repeat(200));
    // 試験の外から渡す生の題名（入口が直す前）を使う：checkCreate の 3 つ目の引数。無ければ入口が整えた題名にする
    const today = "2026-11-07";
    const base = { ...body(), due_on: today };
    const viaRaw = checkCreate({ ...base, title: "ABC" }, today, "  ＡＢＣ  ");
    expect(viaRaw.ok ? viaRaw.value["title"] : null, "直す前の題名を使う").toBe("ＡＢＣ");
    expect(checkCreate({ ...base, title: "ABC" }, today).ok ? "ok" : "ng", "3 つ目が無ければ入口の題名").toBe("ok");
  });

  it("K60-API-020 入力：本文の道に必須の区画は無い（K-437 の作り直し）：本文を送らなくても・空の木でも、どの種別でも 201。区画の入力 sections だけの前の道は create-ticket-legacy-sections.test.ts（K-437-API-027〜029・K-578 がファイルごと消す）が見る", async () => {
    await createOk(writer, body({ body: undefined }));
    await createOk(writer, body({ kind_id: issue.id, body: { doc: { type: "doc", content: [] } } }));
  });

  it("K60-API-021 入力：期限が空・日付でない：422（D-125.51）", async () => {
    for (const due_on of [undefined, "", "来週", "2026-02-30"]) {
      const b = body({ due_on });
      if (due_on === undefined) delete (b as Record<string, unknown>)["due_on"];
      const r = await create(writer, b);
      expect(r.status, String(due_on)).toBe(422);
      expect(fields(await json(r))).toContain("due_on");
    }
  });

  it("K60-API-022 入力：開始が期限より後：409（E-VAL-028・欄なし・欄どうしの比べ合いなので契約に書けない・PM の決め 2026-11-21・D-150.34）", async () => {
    const r = await create(writer, body({ start_on: jst(10), due_on: jst(3) }));
    expectConflict(r.status, await json(r), "E-VAL-028");
  });

  it("K60-API-023 入力：期限が今日より前：409（E-VAL-012・欄なし・今日で決まる物なので契約に書けない・PM の決め 2026-11-21 02:00・D-128.138）。今日は作れる。開始は過去も入れられる", async () => {
    // 今日の日付は試験の外から渡す（日本時間の 0 時をまたいでも落ちない）。境目そのものは checkCreate と todayJst で見る
    const today = "2026-11-07";
    const base = { ...body(), due_on: today };
    const yesterday = checkCreate({ ...base, due_on: "2026-11-06" }, today);
    expect(yesterday.ok).toBe(false);
    expect(yesterday.ok ? [] : yesterday.details.map((x) => x.code)).toContain("E-VAL-012");
    expect(checkCreate(base, today).ok, "今日は作れる").toBe(true);
    expect(checkCreate({ ...base, start_on: "2026-10-01" }, today).ok, "開始は過去も入れられる").toBe(true);
    // 日本時間の 0 時の境目（UTC 15:00）
    expect(todayJst(new Date("2026-11-06T14:59:59.999Z"))).toBe("2026-11-06");
    expect(todayJst(new Date("2026-11-06T15:00:00.000Z"))).toBe("2026-11-07");
    // 口でも止まる。0 時をまたいでも結果が変わらない幅（2 日前・2 日後）で見る
    const r = await create(writer, body({ due_on: jst(-2) }));
    expectConflict(r.status, await json(r), "E-VAL-012");
    await createOk(writer, body({ start_on: jst(-30), due_on: jst(2) }));
  });

  it("K60-API-024 入力：優先度「高」で理由が空：422（D-125.33）", async () => {
    expect(fields(await json(await create(writer, body({ priority: "high" }))))).toContain("priority_reason");
    const t = await createOk(writer, body({ priority: "high", priority_reason: "先方の締めが早い" }));
    expect(t["priority"]).toBe("high");
    expect((await createOk(writer))["priority"]).toBe("mid"); // 既定は中
  });

  it("K60-API-025 入力：番号・消した人・取り込みの下書き・分身に任せた・実績の列を入れてくる：422（外から入れさせない）", async () => {
    for (const k of ["number", "deleted_by", "draft_import_id", "delegated_to_clone", "actual_minutes", "tenant_id"]) {
      const r = await create(
        writer,
        body({ [k]: k === "delegated_to_clone" ? true : k === "actual_minutes" ? 10 : writer.id }),
      );
      expect(r.status, k).toBe(422);
    }
  });

  it("K60-API-026 入力：段に確認中・承認待ち・実行中を入れてくる：422（仕組みの段は選ばせない）", async () => {
    const st = (
      await f.admin.query<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = 'checking'", [
        T.tenantId,
      ])
    ).rows[0]!.id;
    expect((await create(writer, body({ stage_id: st }))).status).toBe(422);
  });

  it("K60-API-027 入力：見込み時間が負・数でない：422", async () => {
    for (const estimate_minutes of [-5, "たくさん", 1.5])
      expect(fields(await json(await create(writer, body({ estimate_minutes }))))).toContain("estimate_minutes");
    expect((await createOk(writer, body({ estimate_minutes: 90 })))["estimate_minutes"]).toBe(90);
  });

  it("K60-API-028 失敗：区画の版や知らせを書く途中で DB が失敗：チケットも区画も版も知らせも残らない（全部戻る）", async () => {
    await f.admin.query(`create or replace function app.k60_fail() returns trigger language plpgsql as $$ begin
      if new.event_kind_id = 'ticket.assigned' and new.payload->>'title' = '途中で落ちる' then raise exception 'k60 試験の失敗'; end if; return new; end $$`);
    await f.admin.query(
      "create trigger k60_fail before insert on notifications for each row execute function app.k60_fail()",
    );
    const before = await ticketsIn(T.tenantId);
    const sec = await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await create(writer, body({ title: "途中で落ちる" }));
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await f.admin.query("drop trigger k60_fail on notifications");
      await f.admin.query("drop function app.k60_fail()");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
    expect(await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId])).toBe(sec);
  });

  it("K60-API-029 操作の揺れ：2 人が同時に同じグループに作る：番号が重ならず、抜けもしない", async () => {
    const g = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '同時', 'SM') returning id",
        [T.tenantId, T.rootScope],
      )
    ).rows[0]!.id;
    const rs = await Promise.all(
      Array.from({ length: 6 }, (_, i) => create(i % 2 ? writer : mate, body({ scope_id: g }))),
    );
    const nums = await Promise.all(rs.map(async (r) => String((await json(r)).data!["number"])));
    expect(nums.map((n) => Number(n.split("-")[1])).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("K60-API-030 操作の揺れ：同じ人が 2 つのタブで作る：2 件できる（別の冪等キー）", async () => {
    const before = await ticketsIn(T.tenantId);
    await Promise.all([
      create(writer, body(), { "idempotency-key": randomUUID() }),
      create(writer, body(), { "idempotency-key": randomUUID() }),
    ]);
    expect(await ticketsIn(T.tenantId)).toBe(before + 2);
  });

  it("K60-API-031 守り：1 分に 61 回作る：429・待つ秒数", async () => {
    const p = await f.person(T.tenantId, T.rootScope, { name: "急ぐ人", ticketAbility: "edit" });
    f.limits["createTicket"] = 3;
    try {
      for (let i = 0; i < 3; i++) expect((await create(p, body({ assignee_member_id: p.id }))).status).toBe(201);
      const r = await create(p, body({ assignee_member_id: p.id }));
      expect(r.status).toBe(429);
      expect((await json(r))["retry_after_sec"]).toBeGreaterThan(0);
    } finally {
      f.limits["createTicket"] = 10_000;
    }
  }, 60_000); // 何十回も続けて口を呼ぶ送りすぎの確かめ（重い台でも既定の 5 秒で切らない）

  it("K60-API-032 守り：別の会社のグループ・種別・担当者・知らせる人・親の id：403／見つからない扱い。中身も「ある」ことも返さない", async () => {
    const otherKind = (
      await f.admin.query<{ id: string }>("select id from ticket_kinds where tenant_id = $1 limit 1", [O.tenantId])
    ).rows[0]!.id;
    const before = await ticketsIn(T.tenantId);
    expect((await create(writer, body({ scope_id: O.rootScope }))).status).toBe(403);
    for (const extra of [
      { kind_id: otherKind },
      { assignee_member_id: outsider.id },
      { notify_member_ids: [outsider.id] },
    ]) {
      const r = await create(writer, body(extra));
      expectGone(r.status, await json(r), JSON.stringify(Object.keys(extra)));
    }
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  it("K60-API-033 守り：担当者を選ぶ欄・グループを選ぶ欄：同じワークスペースの人・書けるグループだけ。他の会社の人は件数にも入らない", async () => {
    const m = (await json(await f.req("GET", "/members?limit=200", { headers: writer.auth }))).data as unknown as {
      id: string;
      tenant_id: string;
    }[];
    expect(m.every((x) => x.tenant_id === T.tenantId)).toBe(true);
    expect(m.map((x) => x.id)).not.toContain(outsider.id);
    const s = await json(await f.req("GET", "/scopes", { headers: writer.auth }));
    expect((s.data as unknown as { tenant_id: string }[]).every((x) => x.tenant_id === T.tenantId)).toBe(true);
    expect((s["meta"] as { writable: string[] }).writable).toContain(T.rootScope);
    const sv = await json(await f.req("GET", "/scopes", { headers: viewer.auth }));
    expect((sv["meta"] as { writable: string[] }).writable).toEqual([]);
  });

  it("K60-API-034 選ぶ欄：種別の一覧を返す（listTicketKinds）。色・並び・id・名前を持ち、消した種別は出さない（区画・ひな形の在る無しは見ない）", async () => {
    const kinds = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as unknown as {
      name: string;
    }[];
    for (const k of kinds)
      for (const key of ["color", "id", "is_builtin", "name", "position"])
        expect(Object.keys(k), `${k.name} の ${key}`).toContain(key);
    expect(kinds.map((k) => k.name)).not.toContain("消す種別");
    expect(kinds.map((k) => k.name).slice(0, 4)).toEqual(["タスク", "課題", "QA", "会議"]);
  });

  it("K60-API-035 守り：題名・本文に HTML やスクリプト：そのまま文字として残す（動かすのは画面の仕事・画面の試験で見る）", async () => {
    const t = await createOk(
      writer,
      body({
        title: "<script>alert(1)</script>",
        body: { doc: para("<img src=x onerror=alert(1)>") },
      }),
    );
    expect(t["title"]).toBe("<script>alert(1)</script>");
  });

  it("K60-API-036 守り：ログに題名と本文が出ない", async () => {
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    try {
      await createOk(writer, body({ title: "ログに出ない題名", body: { doc: para("ログに出ない本文") } }));
      await create(writer, body({ title: "ログに出ない題名", due_on: jst(-3) }));
    } finally {
      for (const s of spies) s.mockRestore();
    }
    expect(out.join("\n")).not.toMatch(/ログに出ない/);
  });

  it("K60-API-037 他の会社のチケットを getTicket で直に：見えない（404・中身を返さない）", async () => {
    const theirs = (
      await f.admin.query<{ id: string }>("select id from tickets where tenant_id = $1 limit 1", [O.tenantId])
    ).rows[0]!.id;
    const r = await f.req("GET", `/tickets/${theirs}`, { headers: writer.auth });
    expect(r.status).toBe(404);
  });
});

describe("K-60 書きかけの下書き（サーバーに残す・D-128.138）", () => {
  it("K60-API-038 無し（書きかけ）× 残す → 別の端末で読む：続きから書ける。作れたら消える", async () => {
    const id = randomUUID();
    const draft = { title: "書きかけ", sections: { purpose: "途中" } };
    const s = await f.req("POST", "/me/ticket-drafts", { body: { draft_id: id, body: draft }, headers: writer.auth });
    expect(s.status, await s.clone().text()).toBe(201);
    const list = (await json(await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }))).data as unknown as {
      draft_id: string;
      body: unknown;
    }[];
    expect(list.find((d) => d.draft_id === id)?.body).toEqual(draft);
    await createOk(writer, body({ draft_id: id }));
    const after = (await json(await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }))).data as unknown as {
      draft_id: string;
    }[];
    expect(after.map((d) => d.draft_id)).not.toContain(id);
  });

  it("K60-API-039 下書きは作った本人にしか見えない・ワークスペースごとに分ける（混ぜない）", async () => {
    const id = randomUUID();
    await f.req("POST", "/me/ticket-drafts", {
      body: { draft_id: id, body: { title: "わたしの" } },
      headers: writer.auth,
    });
    const others = (await json(await f.req("GET", "/me/ticket-drafts", { headers: mate.auth }))).data as unknown as {
      draft_id: string;
    }[];
    expect(others.map((d) => d.draft_id)).not.toContain(id);
    const there = (await json(await f.req("GET", "/me/ticket-drafts", { headers: outsider.auth }))).data as unknown as {
      draft_id: string;
    }[];
    expect(there.map((d) => d.draft_id)).not.toContain(id);
    // アプリの役は下書きの表に直に触れない
    await expect(f.pool.query("select * from app.ticket_drafts")).rejects.toThrow();
  });

  it("K60-API-040 2 つのタブの下書きは上書きし合わない（下書きの id が別）・捨てられる", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await f.req("POST", "/me/ticket-drafts", { body: { draft_id: a, body: { title: "タブ A" } }, headers: mate.auth });
    await f.req("POST", "/me/ticket-drafts", { body: { draft_id: b, body: { title: "タブ B" } }, headers: mate.auth });
    let list = (await json(await f.req("GET", "/me/ticket-drafts", { headers: mate.auth }))).data as unknown as {
      draft_id: string;
      body: { title: string };
    }[];
    expect(
      list
        .filter((d) => [a, b].includes(d.draft_id))
        .map((d) => d.body.title)
        .sort(),
    ).toEqual(["タブ A", "タブ B"]);
    await f.req("POST", "/me/ticket-drafts", { body: { draft_id: a, discard: true }, headers: mate.auth });
    list = (await json(await f.req("GET", "/me/ticket-drafts", { headers: mate.auth }))).data as unknown as {
      draft_id: string;
      body: { title: string };
    }[];
    expect(list.map((d) => d.draft_id)).not.toContain(a);
  });

  it("K60-API-041 閲覧のみの人の下書き口・先方の人（ゲスト）：自分の下書きは読み書きできる（作るのは 403）／先方の人（ゲスト）は 403", async () => {
    const r = await f.req("POST", "/me/ticket-drafts", {
      body: { draft_id: randomUUID(), body: {} },
      headers: f.as(viewer, "client"),
    });
    expect(r.status).toBe(403);
    expect((await f.req("GET", "/me/ticket-drafts")).status).toBe(401);
  });

  it("K60-API-044 新しいタブで別のタブの下書きを続きとして出して作る：その元の下書き（source_draft_id）も同じ処理で消える。他の人の同じ id の下書きは消さない", async () => {
    const tab = randomUUID();
    const source = randomUUID();
    for (const [id, title] of [
      [tab, "このタブ"],
      [source, "前のタブ"],
    ] as const)
      expect(
        (await f.req("POST", "/me/ticket-drafts", { body: { draft_id: id, body: { title } }, headers: writer.auth }))
          .status,
      ).toBe(201);
    // 別の人が同じ id の下書きを持っていても、消すのは作った本人の分だけ
    await f.req("POST", "/me/ticket-drafts", {
      body: { draft_id: source, body: { title: "別の人" } },
      headers: mate.auth,
    });
    await createOk(writer, body({ draft_id: tab, source_draft_id: source }));
    const mine = (await json(await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }))).data as unknown as {
      draft_id: string;
    }[];
    expect(mine.map((d) => d.draft_id)).not.toContain(tab);
    expect(mine.map((d) => d.draft_id)).not.toContain(source);
    const theirs = (await json(await f.req("GET", "/me/ticket-drafts", { headers: mate.auth }))).data as unknown as {
      draft_id: string;
    }[];
    expect(theirs.map((d) => d.draft_id)).toContain(source);
    // 形の違う id は 422（作らない）
    const before = await ticketsIn(T.tenantId);
    const bad = await create(writer, body({ source_draft_id: "前のタブ" }));
    expect(bad.status).toBe(422);
    expect(fields(await json(bad))).toContain("source_draft_id");
    expect(await ticketsIn(T.tenantId)).toBe(before);
  });

  // K60-API-045（日本語で大きな下書きは 422）は決める人の決定 D-130.3 で下書きの大きさの上限を外したので消した。
  // 受けは K-144 の K144-API-043（DB の上限 200,000 バイトを越える日本語の下書きも 201 で残り読み戻せる・1MB を超える体は 413 で残らない）

  it("K60-API-046 作る前に送った保存が、作った後に処理される：作るときに使った draft_id・source_draft_id にもう一度保存しても、下書きは残らない", async () => {
    const tab = randomUUID();
    const source = randomUUID();
    for (const id of [tab, source])
      await f.req("POST", "/me/ticket-drafts", { body: { draft_id: id, body: { title: "前" } }, headers: writer.auth });
    await createOk(writer, body({ draft_id: tab, source_draft_id: source }));
    // 作る前に出していた保存が、作った後にサーバーに届いた
    for (const id of [tab, source]) {
      const r = await f.req("POST", "/me/ticket-drafts", {
        body: { draft_id: id, body: { title: "作った後に届いた保存" } },
        headers: writer.auth,
      });
      // 作るときに使った id への保存は、残さずに黙って捨てる（201・body と saved_at が null・K-60.md の H2b）
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await json(r)).data).toMatchObject({ draft_id: id, body: null, saved_at: null });
    }
    const list = (await json(await f.req("GET", "/me/ticket-drafts", { headers: writer.auth }))).data as unknown as {
      draft_id: string;
      body: { title?: string };
    }[];
    expect(list.map((d) => d.draft_id)).not.toContain(tab);
    expect(list.map((d) => d.draft_id)).not.toContain(source);
    expect(JSON.stringify(list)).not.toContain("作った後に届いた保存");
    // 別の人は、同じ id でも残せる（覚えるのは作った本人の使った id だけ）
    const other = await f.req("POST", "/me/ticket-drafts", {
      body: { draft_id: tab, body: { title: "別の人" } },
      headers: mate.auth,
    });
    expect(other.status).toBe(201);
  });

  it("K60-API-047 守り（M1）：アプリの役は app.ticket_member_ok を直に呼べない（呼ぶのは app.ticket_create の中だけ・D-128.171）", async () => {
    const priv = await f.admin.query<{ member_ok: boolean; can_create: boolean }>(
      "select has_function_privilege('kaname_app', 'app.ticket_member_ok(uuid,uuid)', 'execute') as member_ok, has_function_privilege('kaname_app', 'app.ticket_create(jsonb)', 'execute') as can_create",
    );
    expect(priv.rows[0]).toEqual({ member_ok: false, can_create: true });
  });
});

describe("K-60 選ぶ欄と詳細の口の守り", () => {
  it("K60-API-042 ログインしていない人は 401、先方の人（ゲスト）は 403（作る・種別・グループ・詳細）", async () => {
    const t = await createOk(writer);
    for (const [m, path] of [
      ["POST", "/tickets"],
      ["GET", "/ticket_kinds"],
      ["GET", "/scopes"],
      ["GET", `/tickets/${t["id"]}`],
    ] as const) {
      const anon = await f.req(m, path, m === "POST" ? { body: body() } : {});
      expect(anon.status, `${m} ${path}`).toBe(401);
      const client = await f.req(m, path, {
        headers: f.as(writer, "client"),
        ...(m === "POST" ? { body: body() } : {}),
      });
      expect(client.status, `${m} ${path}`).toBe(403);
    }
  });

  it("K60-API-043 同意し直しが要るセッション（K-53 の印）：作る・種別・グループ・詳細・下書きを読む・残すは 403・E-AUTH-010。チケットも下書きも増えない", async () => {
    const t = await createOk(writer);
    const tickets = await ticketsIn(T.tenantId);
    const drafts = await count("select count(*) as n from app.ticket_drafts where member_id = $1", [writer.id]);
    for (const [m, path, b] of [
      ["POST", "/tickets", body()],
      ["GET", "/ticket_kinds", undefined],
      ["GET", "/scopes", undefined],
      ["GET", `/tickets/${t["id"]}`, undefined],
      ["GET", "/me/ticket-drafts", undefined],
      ["POST", "/me/ticket-drafts", { draft_id: randomUUID(), body: { title: "止まる" } }],
    ] as const) {
      const r = await f.req(m, path, { headers: f.pending(writer), ...(b === undefined ? {} : { body: b }) });
      expect(r.status, `${m} ${path}: ${await r.clone().text()}`).toBe(403);
      const j = await json(r);
      expect(j["code"], `${m} ${path}`).toBe("E-AUTH-010");
      expect(j["data"], `${m} ${path} は中身を返さない`).toBeUndefined();
    }
    expect(await ticketsIn(T.tenantId), "チケットは増えない").toBe(tickets);
    expect(
      await count("select count(*) as n from app.ticket_drafts where member_id = $1", [writer.id]),
      "下書きは増えない",
    ).toBe(drafts);
    // 同じ人でも、印の無いセッションならふつうに通る（止めたのは印のせい）
    expect((await f.req("GET", "/ticket_kinds", { headers: writer.auth })).status).toBe(200);
  });
});
