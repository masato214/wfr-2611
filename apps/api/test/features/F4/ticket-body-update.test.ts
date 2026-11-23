// K-432「本文を書き終える口（updateTicketBody）」の単体の試験（口と DB・本物の Postgres）。2026-11-21 の作り直し（区画ごと → 本文 1 枚）。
// テストの名前の頭の行 ID（K432-API-…）は 11_tickets/K-432.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（土台 ticket-body.harness.ts の頭にも書いた）:
//   updateTicketBody  PATCH /api/v1/tickets/:id/body
//     入力（strict）: { version: integer(>=0), doc: object }。version は今見ている版（本文の行がまだ無いチケットは 0）。text は受けない（口が doc から docToText で作る）
//     200 { data: { version, changed, edited_at } }。中身が同じなら changed false・版は増えない
//     409 E-SEC-004（先に直された・名前を入れない決まった文）／E-SEC-005（完了したチケット）。404・409 には field・details を付けない（控え帳）
//     422 は契約に書ける形だけ（欄つき）。doc の中身の誤り（知らない節・深すぎ・大きすぎ）は K-561 の決めに合わせて 422・欄 doc
//   本文の行：ticket_sections の鍵 body・body は { doc, text }・版は ticket_section_versions（追記だけ）。
//   DB：app.ticket_body_set(p_ticket, p jsonb) が本文の行・版の行・やり取りの変更の 1 行・証跡を 1 つの取引で書く（lessons L-002）
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { docToText } from "@kaname/contracts";
import { BARE, bareKeys, docOf, EMPTY_DOC, setupBody, type Doc, type Json, type World } from "./ticket-body.harness.js";

const h = setupBody(["ticket-body"]);

let w: World;
const FIRST = docOf("月末の請求を出す");
const NEXT = docOf("月末の請求を 2 回に分けて出す", "- 作る");
const SAME_MSG = "先に直されました。読み直してから、もう一度直してください";
const bodyPath = (id: string) => `/tickets/${id}/body`;
const put = (who: World["writer"] | null, id: string, b: unknown, headers?: Record<string, string>) =>
  h.call(who, "PATCH", bodyPath(id), { body: b, ...(headers ? { headers } : {}) });
const fieldsOf = (j: Json): string[] => ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);
/** 版 1 の本文だけがあるチケット */
const withBody = async (o: { assignee?: World["writer"] } = {}) => {
  const t = await h.ticket(w, o);
  await h.seedBody(t.id, [FIRST]);
  return t.id;
};
const untouched = async (id: string, version = 1) => {
  expect((await h.bodyRow(id))!.version).toBe(version);
  expect(await h.versionRows(id)).toHaveLength(version);
  expect(await h.messages(id)).toHaveLength(0);
};

beforeAll(async () => {
  w = await h.world("K432");
}, 60_000);

describe("K-432 本文を書き終える（updateTicketBody）", () => {
  it("K432-API-001 版が合う × 書ける人が書き終える：200・版が 1 つ増え、text は口が doc から作り、本文の行と版の行が同じ中身になる", async () => {
    const id = await withBody();
    const r = await put(w.writer, id, { version: 1, doc: NEXT });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["changed", "edited_at", "version"]);
    expect(d).toMatchObject({ version: 2, changed: true });
    const row = (await h.bodyRow(id))!;
    expect(row.version).toBe(2);
    expect(row.body.doc).toEqual(NEXT);
    expect(row.body.text).toBe(docToText(NEXT));
    expect(row.body.text).toContain("2 回に分けて");
    const vs = await h.versionRows(id);
    expect(vs.map((v) => v.version)).toEqual([1, 2]);
    expect(vs[1]).toMatchObject({ edited_by: w.writer.id, edited_by_clone: false, restored_from: null });
    expect(vs[1]!.body).toEqual(row.body);
    expect(vs[0]!.body.doc).toEqual(FIRST);
  });

  it("K432-API-002 やり取りの 1 行・証跡・お知らせ：変更の行が 1 つ（本文の字を入れない）・証跡 ticket.body.update が 1 つ・受け箱の行は増えない（D-150.29）", async () => {
    const id = await withBody({ assignee: w.assignee });
    const before = await h.notifications(w.tenantId);
    expect((await put(w.writer, id, { version: 1, doc: NEXT })).status).toBe(200);
    const m = await h.messages(id);
    expect(m).toHaveLength(1);
    expect(m[0]!.author_member_id).toBe(w.writer.id);
    expect(m[0]!.body).toBe(`${await h.name(w.writer)}が本文を直しました`);
    expect(m[0]!.changes).toEqual([{ field: "body", from: "版 1", to: "版 2" }]);
    const a = await h.audits(w.tenantId, "ticket.body.update", id);
    expect(a).toHaveLength(1);
    expect(a[0]!.choke_point_id).toBe("C2");
    expect(Object.keys(a[0]!.payload).sort()).toEqual(["from_version", "ticket_id", "to_version"]);
    expect(a[0]!.payload).toMatchObject({ from_version: 1, to_version: 2, ticket_id: id });
    const everything = JSON.stringify([m, a]);
    expect(everything).not.toContain("2 回に分けて");
    expect(await h.notifications(w.tenantId)).toBe(before);
  });

  it("K432-API-003 担当者で、書く権限は無い人：書き終えられる（版 2・やり取りの名前は担当者）", async () => {
    const id = await withBody({ assignee: w.assignee });
    const r = await put(w.assignee, id, { version: 1, doc: NEXT });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.bodyRow(id))!.version).toBe(2);
    expect((await h.messages(id))[0]!.author_member_id).toBe(w.assignee.id);
  });

  it("K432-API-004 版が古い（先に別の人が直した）：409・E-SEC-004・名前を入れない決まった文・field と details が無く、先に直した人の版のまま残る", async () => {
    const id = await withBody({ assignee: w.assignee });
    expect((await put(w.writer, id, { version: 1, doc: NEXT })).status).toBe(200);
    const late = docOf("あとから書き終えた人の本文");
    const r = await put(w.assignee, id, { version: 1, doc: late }); // 担当者（別の人）が古い版 1 のまま保存
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j).toMatchObject({ error: "conflict", code: "E-SEC-004", message: SAME_MSG });
    expect(Object.keys(j).sort()).toEqual(["code", "error", "message"]);
    expect((await h.bodyRow(id))!.body.doc).toEqual(NEXT);
    expect(await h.versionRows(id)).toHaveLength(2);
    expect(await h.messages(id)).toHaveLength(1);
  });

  it("K432-API-005 同じ版を持った 2 つの画面が同時に保存：200 と 409 が 1 つずつ・版は 2 まで・やり取りは 1 つ（同じ版で 2 回送った 2 本目も 409）", async () => {
    const id = await withBody();
    const rs = await Promise.all([
      put(w.writer, id, { version: 1, doc: docOf("A の本文") }),
      put(w.writer, id, { version: 1, doc: docOf("B の本文") }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await h.bodyRow(id))!.version).toBe(2);
    expect(await h.versionRows(id)).toHaveLength(2);
    expect(await h.messages(id)).toHaveLength(1);
    expect((await put(w.writer, id, { version: 1, doc: docOf("C の本文") })).status).toBe(409);
    expect(await h.versionRows(id)).toHaveLength(2);
  });

  it("K432-API-006 同じ中身で保存：200・changed false・版は 1 のまま（版の行・やり取り・証跡は増えない）", async () => {
    const id = await withBody();
    const r = await put(w.writer, id, { version: 1, doc: FIRST });
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toMatchObject({ version: 1, changed: false });
    await untouched(id);
    expect(await h.audits(w.tenantId, "ticket.body.update", id)).toHaveLength(0);
  });

  it("K432-API-007 本文の行がまだ無いチケット（前の形で作った物）：version 0 で最初の 1 行（版 1・位置 0）ができ、前の形の区画の行は触らない", async () => {
    const t = await h.ticket(w);
    await h.seedLegacySection(t.id, "purpose", "前の形の目的");
    const r = await put(w.writer, t.id, { version: 0, doc: NEXT });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toMatchObject({ version: 1, changed: true });
    const row = (await h.bodyRow(t.id))!;
    expect(row).toMatchObject({ version: 1, position: 0, deleted_at: null });
    expect(row.body.text).toBe(docToText(NEXT));
    expect(await h.versionRows(t.id)).toHaveLength(1);
    expect((await h.messages(t.id))[0]!.changes).toEqual([{ field: "body", from: null, to: "版 1" }]);
    expect(
      await h.count(
        "select count(*) as n from ticket_sections where ticket_id = $1 and section_key = 'purpose' and version = 1",
        [t.id],
      ),
    ).toBe(1);
  });

  it("K432-API-008 本文の行が無いのに version 1 を送る：409・E-SEC-004・行は作られない", async () => {
    const t = await h.ticket(w);
    const r = await put(w.writer, t.id, { version: 1, doc: NEXT });
    expect(r.status).toBe(409);
    expect((await h.json(r))["code"]).toBe("E-SEC-004");
    expect(await h.bodyRow(t.id)).toBeUndefined();
  });

  it("K432-API-009 空の文書でも書き終えられる：200・text は空の文字・必須の区画は無いので止まらない（D-150.49）", async () => {
    const id = await withBody();
    const r = await put(w.writer, id, { version: 1, doc: EMPTY_DOC });
    expect(r.status, await r.clone().text()).toBe(200);
    const row = (await h.bodyRow(id))!;
    expect(row.version).toBe(2);
    expect(row.body.text).toBe("");
    expect(row.body.doc).toEqual(EMPTY_DOC);
  });

  it("K432-API-010 text を口が作る：チェックの箱は「[x] 」・薄い字の説明（ghost）は text に入らない・画面から text は受けない（知らない欄は 422・欄は body）", async () => {
    const id = await withBody();
    const rich: Doc = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { ghost: true }, content: [{ type: "text", text: "ここに目的を書く（薄い字）" }] },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [{ type: "paragraph", content: [{ type: "text", text: "請求書を作る" }] }],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "送る" }] }],
            },
          ],
        },
      ],
    };
    expect((await put(w.writer, id, { version: 1, doc: rich })).status).toBe(200);
    const t = (await h.bodyRow(id))!.body.text;
    expect(t).toBe(docToText(rich));
    expect(t).toContain("[x] 請求書を作る");
    expect(t).toContain("[ ] 送る");
    expect(t).not.toContain("薄い字");
    const r = await put(w.writer, id, { version: 2, doc: NEXT, text: "画面が作った text" });
    expect(r.status).toBe(422);
    expect(fieldsOf(await h.json(r))).toContain("body");
    expect((await h.bodyRow(id))!.version).toBe(2);
  });

  it("K432-API-011 契約に書ける形の誤り：version が無い・-1・2147483648（int の上限超え）・文字・doc が無い・文字・配列・type が doc でない・content が配列でない・知らない欄（number・section_id）は 422・何も書かない", async () => {
    const id = await withBody();
    const cases: [unknown, string][] = [
      [{ doc: NEXT }, "version"],
      [{ version: -1, doc: NEXT }, "version"],
      [{ version: "1", doc: NEXT }, "version"],
      [{ version: 2147483648, doc: NEXT }, "version"],
      [{ version: 1 }, "doc"],
      [{ version: 1, doc: "本文" }, "doc"],
      [{ version: 1, doc: [] }, "doc"],
      [{ version: 1, doc: { type: "heading", content: [] } }, "doc"],
      [{ version: 1, doc: { type: "doc", content: "x" } }, "doc"],
      [{ version: 1, doc: NEXT, number: "EG-1" }, "body"],
      [{ version: 1, doc: NEXT, section_id: randomUUID() }, "body"],
    ];
    for (const [b, field] of cases) {
      const r = await put(w.writer, id, b);
      expect(r.status, JSON.stringify(b)).toBe(422);
      expect(fieldsOf(await h.json(r)), JSON.stringify(b)).toContain(field);
    }
    await untouched(id);
  });

  it("K432-API-012 doc の中身の誤り（K-561 の決め・K-584 が足した節と印は通る）：知らない節・見出しの level 5・javascript: のリンク・知らない印は 422・欄 doc（details に理由の言葉）・何も書かない", async () => {
    const id = await withBody();
    const bad: Record<string, Doc> = {
      知らない節: { type: "doc", content: [{ type: "script", content: [] }] },
      見出し: {
        type: "doc",
        content: [{ type: "heading", attrs: { level: 5 }, content: [{ type: "text", text: "見出し" }] }],
      },
      リンク: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
          },
        ],
      },
      印: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "sparkle" }] }] }],
      },
    };
    for (const [why, doc] of Object.entries(bad)) {
      const r = await put(w.writer, id, { version: 1, doc });
      expect(r.status, why).toBe(422);
      const j = await h.json(r);
      expect(fieldsOf(j), why).toEqual(["doc"]);
      expect(String((j["details"] as { message: string }[])[0]!.message).length, why).toBeGreaterThan(0);
    }
    await untouched(id);
  });

  it("K432-API-013 深さの上限：入れ子 13 は 422・欄 doc。節の数に上限は持たない（段落 6,000 個でも通る・守りは入口の体の大きさ 1MB と契約に書ける深さだけ）", async () => {
    const id = await withBody();
    let deep: DocNode0 = { type: "paragraph", content: [{ type: "text", text: "底" }] };
    for (let i = 0; i < 7; i++) deep = { type: "bulletList", content: [{ type: "listItem", content: [deep] }] };
    expect((await put(w.writer, id, { version: 1, doc: { type: "doc", content: [deep] } })).status).toBe(422);
    const many = (n: number): Doc => ({
      type: "doc",
      content: Array.from({ length: n }, () => ({ type: "paragraph" })),
    });
    expect((await put(w.writer, id, { version: 1, doc: many(6000) })).status).toBe(200); // 節の数の上限は無い（体は 1MB に収まる）
    expect((await h.bodyRow(id))!.version).toBe(2);
  });

  it("K432-API-014 完了したチケット：409・E-SEC-005（D-150.30）・field と details が無く、本文も版も変わらない", async () => {
    const id = await withBody();
    await h.finish(id);
    const r = await put(w.writer, id, { version: 1, doc: NEXT });
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j).toMatchObject({ error: "conflict", code: "E-SEC-005" });
    expect(bareKeys(j)).toEqual(["code", "error", "message"]);
    await untouched(id);
  });

  it("K432-API-015 見えるが書けない（閲覧のみ）：403・FORBIDDEN・何も書かない", async () => {
    const id = await withBody();
    const r = await put(w.viewer, id, { version: 1, doc: NEXT });
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("FORBIDDEN");
    await untouched(id);
  });

  it("K432-API-016 見えない物：別の会社の人・無い id・消したチケットは入口の行の守りで 404・NOT_FOUND（口に届かない。どれも error と code だけ）", async () => {
    const id = await withBody();
    for (const [who, tid] of [
      [w.outsider, id],
      [w.writer, randomUUID()],
    ] as const) {
      const r = await put(who, tid, { version: 1, doc: NEXT });
      expect(r.status).toBe(404);
      const j = await h.json(r);
      expect(j["code"]).toBe("NOT_FOUND");
      expect(bareKeys(j)).toEqual(BARE);
    }
    const gone = await withBody();
    await h.removeTicket(gone);
    const r = await put(w.writer, gone, { version: 1, doc: NEXT });
    expect(r.status).toBe(404);
    const j = await h.json(r);
    expect(j["code"]).toBe("NOT_FOUND");
    expect(bareKeys(j)).toEqual(BARE);
    await untouched(id);
  });

  it("K432-API-017 ログインしていない：401・何も書かない", async () => {
    const id = await withBody();
    expect((await put(null, id, { version: 1, doc: NEXT })).status).toBe(401);
    await untouched(id);
  });

  it("K432-API-018 手順 S1 失敗（本文の行は書けたが版の行を書けない）：503・E-PAGE-003・本文は版 1 のまま・やり取りも証跡も 0・ログに本文の字が出ない", async () => {
    const id = await withBody();
    const undo = await h.breakInsert("ticket_section_versions", `new.ticket_id = '${id}'::uuid and new.version = 2`);
    let status = 0;
    let code = "";
    let logs: string;
    try {
      logs = await h.captureLogs(async () => {
        const r = await put(w.writer, id, { version: 1, doc: NEXT });
        status = r.status;
        code = String((await h.json(r))["code"]);
      });
    } finally {
      await undo();
    }
    expect(status).toBe(503);
    expect(code).toBe("E-PAGE-003");
    await untouched(id);
    expect(await h.audits(w.tenantId, "ticket.body.update", id)).toHaveLength(0);
    expect(logs).toContain("[ticket-body]");
    expect(logs).not.toContain("2 回に分けて");
    expect(logs).not.toContain("請求書を送る");
  });

  it("K432-API-019 手順 S2 失敗（やり取りの変更の 1 行を書けない）：503・本文は版 1 のまま・版の行は 1 つ・証跡は 0", async () => {
    const id = await withBody();
    const undo = await h.breakInsert("ticket_messages", `new.ticket_id = '${id}'::uuid and new.kind = 'change'`);
    try {
      expect((await put(w.writer, id, { version: 1, doc: NEXT })).status).toBe(503);
    } finally {
      await undo();
    }
    await untouched(id);
    expect(await h.audits(w.tenantId, "ticket.body.update", id)).toHaveLength(0);
  });

  it("K432-API-020 手順 S3 失敗（証跡を書けない）：503・本文は版 1 のまま・版の行は 1 つ・やり取りの行は 0（証跡だけが落ちても書いた物を生かしたまま返さない）", async () => {
    const id = await withBody();
    const undo = await h.breakInsert(
      "audit_events",
      `new.tenant_id = '${w.tenantId}'::uuid and new.action = 'ticket.body.update'`,
    );
    try {
      expect((await put(w.writer, id, { version: 1, doc: NEXT })).status).toBe(503);
    } finally {
      await undo();
    }
    await untouched(id);
  });

  it("K432-API-021 書き終えるを重ねた後の二重書きの食い違い 0：本文の版＝版の行の最大・本文の中身＝その版の中身。アプリの役では版の行を update も delete もできない", async () => {
    const id = await withBody();
    for (let v = 1; v <= 3; v++)
      expect((await put(w.writer, id, { version: v, doc: docOf(`直し ${v}`) })).status).toBe(200);
    expect((await put(w.writer, id, { version: 4, doc: docOf("直し 3") })).status).toBe(200); // 同じ中身（版は増えない）
    const row = (await h.bodyRow(id))!;
    const vs = await h.versionRows(id);
    expect(row.version).toBe(Math.max(...vs.map((v) => v.version)));
    expect(vs[vs.length - 1]!.body).toEqual(row.body);
    expect(
      await h.count(
        `select count(*) as n from ticket_sections s join ticket_section_versions v on v.section_id = s.id and v.version = s.version
          where s.section_key = 'body' and s.tenant_id = $1 and v.body is distinct from s.body`,
        [w.tenantId],
      ),
    ).toBe(0);
    await expect(
      h.f.pool.query("update ticket_section_versions set body = '{}'::jsonb where ticket_id = $1", [id]),
    ).rejects.toThrow(/permission denied/);
  });

  it("K432-API-022 K-584 が足した節と印を含む本文を書き終えられ、読み直しても同じ：番号つき・区切りの線・見出し 4・寄せ・結合セル・下線・取り消し線・コード・上付き・下付き・#rrggbb の色と背景。契約が先に断る形（#FF0000・rgb()・start 0・colspan 51・知らない寄せ）は 422・欄 doc", async () => {
    const id = await withBody();
    const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
    const p = (...c: unknown[]) => ({ type: "paragraph", content: c });
    const rich = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 4, textAlign: "center" }, content: [t("小さな見出し")] },
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(t("三つ目"))] }] },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          attrs: { textAlign: "justify" },
          content: [
            t("下線", [{ type: "underline" }]),
            t("消す", [{ type: "strike" }]),
            t("x = 1", [{ type: "code" }]),
            t("2", [{ type: "superscript" }]),
            t("i", [{ type: "subscript" }]),
            t("赤", [{ type: "color", attrs: { color: "#e11d48" } }]),
            t("黄", [{ type: "highlight", attrs: { color: "#fde68a" } }]),
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", attrs: { colspan: 2, colwidth: [120, 80] }, content: [p(t("項目"))] },
                { type: "tableHeader", content: [p(t("金額"))] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [p(t("保守"))] },
                { type: "tableCell", attrs: { rowspan: 2 }, content: [p(t("月額"))] },
                { type: "tableCell", content: [p(t("10,000"))] },
              ],
            },
          ],
        },
      ],
    } as unknown as Doc;
    const r = await put(w.writer, id, { version: 1, doc: rich });
    expect(r.status, await r.clone().text()).toBe(200);
    const row = (await h.bodyRow(id))!;
    expect(row.version).toBe(2);
    expect(row.body.doc).toEqual(rich);
    expect(row.body.text).toBe(docToText(rich));
    expect(row.body.text).toContain("- 三つ目");
    expect(row.body.text).not.toContain("3.");
    const mk = (node: unknown) => ({ type: "doc", content: [node] });
    const bad: Record<string, unknown> = {
      大文字の色: mk(p(t("x", [{ type: "color", attrs: { color: "#FF0000" } }]))),
      "rgb() の背景": mk(p(t("x", [{ type: "highlight", attrs: { color: "rgb(255,0,0)" } }]))),
      "start 0": mk({
        type: "orderedList",
        attrs: { start: 0 },
        content: [{ type: "listItem", content: [p(t("x"))] }],
      }),
      "colspan 51": mk({
        type: "table",
        content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 51 }, content: [p(t("x"))] }] }],
      }),
      知らない寄せ: mk({ type: "paragraph", attrs: { textAlign: "start" }, content: [t("x")] }),
    };
    for (const [why, doc] of Object.entries(bad)) {
      const rr = await put(w.writer, id, { version: 2, doc });
      expect(rr.status, why).toBe(422);
      expect(fieldsOf(await h.json(rr)), why).toEqual(["doc"]);
    }
    expect((await h.bodyRow(id))!.version).toBe(2);
    expect(await h.versionRows(id)).toHaveLength(2);
  });
});

/** 深い入れ子を作る試験の道具の型（節 1 つ） */
type DocNode0 = { type: string; content?: DocNode0[]; text?: string };
