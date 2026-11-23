// K-565「AI に任せる口の直し」の単体の試験（口・本物の DB）。名前の頭の行 ID（K565-API-…）は 11_tickets/K-565.md の表と 1 対 1。
//   AI に渡す中身を、本文 1 枚（ticket_sections の鍵 body）＋項目＋確認項目から組む。本文の行が無いチケットの組み方（K-565 の間は前の区画から・K-578 の後は空の本文）は、この試験では見ない（行 008・010 は delegate-body-legacy-sections.test.ts・K-578 の後は K578-API-011〜013）。
//   確認項目が 0 件なら止まり（409・E-CONF-020）、使わない理由 no_spec_reason を送れば通る。
//   土台は delegate-kit.ts の makeKit（本物の Postgres・本物の口の振る舞い・本物の PC の印）。チケットは DB に直に置く
//   （作る口の形は K-437 で変わるので、この試験は作る口に頼らない。前の形でも本文の形でも同じ結果になる）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Person } from "../fixture.js";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import { data, delegateOk, E, json, makeKit, type Device, type Kit } from "./delegate-kit.js";

const NO_SPEC = "E-CONF-020"; // 確認項目が 1 つも無いので任せられない（409・欄なし）
const SESS = "65656565-0000-4000-8000-00000000a001";

let k: Kit;
let otherKind: string; // 「課題」の種別（タスクとは別の種別）

beforeAll(async () => {
  k = await makeKit();
  Object.assign(k.f.hooks, approveHooks(k.f.pool));
  for (const op of ["listApprovalQueue", "getApproval"]) k.f.limits[op] = 100_000;
  otherKind = (
    await k.q<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = '課題' and deleted_at is null",
      [k.T.tenantId],
    )
  )[0]!.id;
}, 90_000);
afterAll(async () => {
  await k?.close();
});

// ---- 種を置く道具（DB に直に）----
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const para = (t: string) => ({ type: "paragraph", content: t === "" ? [] : [{ type: "text", text: t }] });
const docOf = (texts: string[]) => ({ type: "doc", content: texts.map(para) });

/** AI に任せる人と、その人の PC（人と PC を試験どうしで使い回さない） */
const fresh = async (name: string): Promise<{ p: Person; pc: Device }> => {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p) };
};
/** チケットを DB に直に置く（区画も本文の行も確認項目も無い・未着手） */
async function raw(
  p: Person,
  o: { title?: string; due?: string | null; priority?: "mid" | "high"; reason?: string | null; kind?: string } = {},
): Promise<string> {
  const r = await k.q<{ id: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on, priority, priority_reason)
     values ($1, $2, '', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), $4, $5, $5, $6, $7, $8) returning id`,
    [
      k.T.tenantId,
      k.T.rootScope,
      o.kind ?? k.taskKind,
      o.title ?? "見積を作る",
      p.id,
      o.due === undefined ? jst(3) : o.due,
      o.priority ?? "mid",
      o.reason ?? null,
    ],
  );
  return r[0]!.id;
}
async function putSection(t: string, key: string, position: number, body: unknown, deletedAt = false): Promise<void> {
  const s = await k.q<{ id: string }>(
    `insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, deleted_at)
     values ($1, $2, $3, $4, $5, 1, case when $6 then now() end) returning id`,
    [k.T.tenantId, t, key, position, JSON.stringify(body), deletedAt],
  );
  await k.q(
    "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body) values ($1, $2, $3, 1, $4)",
    [k.T.tenantId, t, s[0]!.id, JSON.stringify(body)],
  );
}
/** 本文の行（鍵 body）を置く。texts は段落ごとの文字（text は段落を改行でつないだ文字） */
const putBody = (t: string, texts: string[], deletedAt = false) =>
  putSection(t, "body", 0, { doc: docOf(texts), text: texts.join("\n") }, deletedAt);
/** 前の形の区画（目的・完了の条件・実施事項）を置く */
async function putLegacy(t: string, purpose: string, done: string, todo: string): Promise<void> {
  await putSection(t, "purpose", 10, { text: purpose });
  await putSection(t, "done", 20, { text: done });
  await putSection(t, "todo", 50, { text: todo });
}
let tick = 0;
/** 確認項目を足す（作った順を作った時刻で決める） */
async function addSpec(t: string, title: string, o: { checked?: boolean; deleted?: boolean } = {}): Promise<void> {
  tick += 1;
  await k.q(
    `insert into test_specs (tenant_id, ticket_id, check_kind, title, checked_at, deleted_at, created_at)
     values ($1, $2, 'human', $3, case when $4 then now() end, case when $5 then now() end, now() + make_interval(secs => $6))`,
    [k.T.tenantId, t, title, o.checked === true, o.deleted === true, tick],
  );
}
type Opt = { id: string; name: string; position: number };
/** 会社の項目を足す（名前は会社の中で 1 つだけなので、試験ごとに名前の後ろに印を付ける） */
async function addField(
  name: string,
  type: string,
  o: { options?: Opt[]; kinds?: string[]; deleted?: boolean; position?: number } = {},
): Promise<{ id: string; name: string }> {
  const full = `${name}${randomUUID().slice(0, 4)}`;
  const f = await k.q<{ id: string }>(
    `insert into custom_fields (tenant_id, name, field_type, required, options, position, deleted_at)
     values ($1, $2, $3, false, $4, $5, case when $6 then now() end) returning id`,
    [k.T.tenantId, full, type, JSON.stringify(o.options ?? []), o.position ?? 0, o.deleted === true],
  );
  for (const kind of o.kinds ?? [])
    await k.q("insert into custom_field_kinds (tenant_id, field_id, kind_id) values ($1, $2, $3)", [
      k.T.tenantId,
      f[0]!.id,
      kind,
    ]);
  return { id: f[0]!.id, name: full };
}
const setValue = (t: string, fieldId: string, value: unknown) =>
  k.q("insert into ticket_field_values (tenant_id, ticket_id, field_id, value) values ($1, $2, $3, $4::jsonb)", [
    k.T.tenantId,
    t,
    fieldId,
    JSON.stringify(value),
  ]);

// ---- 読む道具 ----
const promptOfJob = async (jobId: string) =>
  String((await k.q<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [jobId]))[0]!.prompt);
/** prompt を「## 見出し」で割る。頭の 1 文（見出しの前）と、見出しごとの中身 */
const parts = (prompt: string) => {
  const [intro, ...rest] = prompt.split("\n\n## ");
  const heads = rest.map((x) => x.split("\n")[0]!);
  const body = (head: string): string | null => {
    const hit = rest.find((x) => x.startsWith(`${head}\n`));
    return hit === undefined ? null : hit.slice(head.length + 1);
  };
  return { intro: intro!, heads, body };
};
const rowOf = async (t: string) =>
  (
    await k.q<{ no_spec_reason: string | null; delegated_to_clone: boolean }>(
      "select no_spec_reason, delegated_to_clone from tickets where id = $1",
      [t],
    )
  )[0]!;
const written = async (t: string) => ({
  runs: await k.n("select count(*) as n from action_runs where ticket_id = $1", [t]),
  lines: await k.n("select count(*) as n from ticket_messages where ticket_id = $1", [t]),
  stage: await k.stageOf(t),
  ...(await rowOf(t)),
});
const NOTHING_WRITTEN = { runs: 0, lines: 0, stage: "todo", no_spec_reason: null, delegated_to_clone: false };

describe("K-565 AI に任せる口の直し：AI に渡す中身（本文 1 枚＋項目＋確認項目）", () => {
  it("K565-API-001 本文の行が在る・確認項目が 1 件 × 任せる：201。prompt は 頭の 1 文（番号と題名）→ 本文 → 項目 → 確認項目 の順で、前の区画の見出しは無い。仕事の行の prompt も同じ", async () => {
    const { p } = await fresh("本文で任せる人");
    const t = await raw(p, { title: "見積を作る" });
    await putBody(t, ["先方に出す見積のたたき台を作る", "金額と内訳がそろっている"]);
    await addSpec(t, "金額が内訳の合計と合っている");
    const d = await delegateOk(k, p, t);
    const prompt = await promptOfJob(d.job_id);
    const number = (await k.q<{ number: string }>("select number from tickets where id = $1", [t]))[0]!.number;
    const pp = parts(prompt);
    expect(pp.intro).toContain(`「${number} 見積を作る」`);
    expect(pp.intro).toContain("外（メール・送信・応募など）には何も出さず");
    expect(pp.heads).toEqual(["本文", "項目", "確認項目"]);
    expect(pp.body("本文")).toBe("先方に出す見積のたたき台を作る\n金額と内訳がそろっている");
    expect(pp.body("項目")!.split("\n")).toEqual([
      "- 題名: 見積を作る",
      "- 種別: タスク",
      `- 期限: ${jst(3)}`,
      "- 優先度: 中",
    ]);
    expect(pp.body("確認項目")).toBe("- 金額が内訳の合計と合っている");
    for (const old of ["## 目的", "## 完了の条件", "## 実施事項", "## 前提と制約"]) expect(prompt).not.toContain(old);
  });

  it("K565-API-002 確認項目の並び：作った順（同じ時刻は id の順）・同じ文の 2 行はどちらも出る・消した行は出ない・チェック済みの行も出る（チェックの印は字に出さない）", async () => {
    const { p } = await fresh("並びの人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    await addSpec(t, "二番目に足したが先に作った文");
    await addSpec(t, "同じ文");
    await addSpec(t, "同じ文");
    await addSpec(t, "消した文", { deleted: true });
    await addSpec(t, "チェック済みの文", { checked: true });
    const d = await delegateOk(k, p, t);
    expect(
      parts(await promptOfJob(d.job_id))
        .body("確認項目")!
        .split("\n"),
    ).toEqual(["- 二番目に足したが先に作った文", "- 同じ文", "- 同じ文", "- チェック済みの文"]);
  });

  it("K565-API-003 優先度が高・期限なし：「- 優先度: 高（理由：…）」「- 期限: なし」", async () => {
    const { p } = await fresh("高の人");
    const t = await raw(p, { priority: "high", reason: "先方の締めが明日", due: null });
    await putBody(t, ["本文"]);
    await addSpec(t, "確かめること");
    const d = await delegateOk(k, p, t);
    const items = parts(await promptOfJob(d.job_id))
      .body("項目")!
      .split("\n");
    expect(items).toContain("- 優先度: 高（理由：先方の締めが明日）");
    expect(items).toContain("- 期限: なし");
  });

  it("K565-API-004 会社の項目 7 つの型：名前と値の行（短い文字・長い文章・数・日付・1 つ選ぶ＝選択肢の名前・複数選ぶ＝選択肢の名前を位置の順に「、」でつなぐ・チェック＝はい／いいえ）", async () => {
    const { p } = await fresh("会社の項目の人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    await addSpec(t, "確かめること");
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    const opts: Opt[] = [
      { id: a, name: "赤", position: 1 },
      { id: b, name: "青", position: 2 },
      { id: c, name: "緑", position: 3 },
    ];
    const fields = {
      short: await addField("短い", "short_text", { position: 1 }),
      long: await addField("長い", "long_text", { position: 2 }),
      num: await addField("数", "number", { position: 3 }),
      date: await addField("日", "date", { position: 4 }),
      one: await addField("一つ", "select", { options: opts, position: 5 }),
      many: await addField("複数", "multi_select", { options: opts, position: 6 }),
      yes: await addField("はい", "check", { position: 7 }),
      no: await addField("いいえ", "check", { position: 8 }),
    };
    await setValue(t, fields.short.id, "セイコー商事");
    await setValue(t, fields.long.id, "一行目\n二行目");
    await setValue(t, fields.num.id, 120000);
    await setValue(t, fields.date.id, "2026-12-01");
    await setValue(t, fields.one.id, b);
    await setValue(t, fields.many.id, [c, a]);
    await setValue(t, fields.yes.id, true);
    await setValue(t, fields.no.id, false);
    const d = await delegateOk(k, p, t);
    // 項目の行は「- 」で始まる。値の中の改行（長い文章）は行を割らずに値のまま読む
    const items = parts(await promptOfJob(d.job_id))
      .body("項目")!
      .split(/\n(?=- )/);
    expect(items.slice(4)).toEqual([
      `- ${fields.short.name}: セイコー商事`,
      `- ${fields.long.name}: 一行目\n二行目`,
      `- ${fields.num.name}: 120000`,
      `- ${fields.date.name}: 2026-12-01`,
      `- ${fields.one.name}: 青`,
      `- ${fields.many.name}: 赤、緑`,
      `- ${fields.yes.name}: はい`,
      `- ${fields.no.name}: いいえ`,
    ]);
  });

  it("K565-API-005 会社の項目の出し分け：別の種別だけに出す項目・消した項目・値の無い項目・選択肢に無い値は出ない。並びは項目の position の順", async () => {
    const { p } = await fresh("出し分けの人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    await addSpec(t, "確かめること");
    const second = await addField("あとの", "short_text", { position: 20, kinds: [k.taskKind] });
    const first = await addField("さきの", "short_text", { position: 10 });
    const onlyOther = await addField("課題だけ", "short_text", { kinds: [otherKind], position: 5 });
    const gone = await addField("消した", "short_text", { deleted: true, position: 6 });
    const noValue = await addField("値なし", "short_text", { position: 7 });
    const strayOpt = await addField("知らない選択肢", "select", {
      options: [{ id: randomUUID(), name: "赤", position: 1 }],
      position: 8,
    });
    for (const f of [second, first, onlyOther, gone]) await setValue(t, f.id, `値-${f.name}`);
    await setValue(t, strayOpt.id, randomUUID());
    expect(noValue.id).toBeTruthy();
    const d = await delegateOk(k, p, t);
    const items = parts(await promptOfJob(d.job_id))
      .body("項目")!
      .split("\n")
      .slice(4);
    expect(items).toEqual([`- ${first.name}: 値-${first.name}`, `- ${second.name}: 値-${second.name}`]);
  });

  it("K565-API-006 本文が空（節が 0 個・字が空）：本文の見出しは出さず、項目と確認項目は出る", async () => {
    const { p } = await fresh("空の本文の人");
    const t = await raw(p);
    await putSection(t, "body", 0, { doc: { type: "doc", content: [] }, text: "" });
    await addSpec(t, "確かめること");
    const d = await delegateOk(k, p, t);
    expect(parts(await promptOfJob(d.job_id)).heads).toEqual(["項目", "確認項目"]);
  });

  it("K565-API-007 とても長い本文（200,000 字）：切らずに全部が prompt に入り 201（D-130.3）", async () => {
    const { p } = await fresh("長い本文の人");
    const t = await raw(p);
    const long = "あ".repeat(200_000);
    await putBody(t, [long, "終わりの行"]);
    await addSpec(t, "確かめること");
    const d = await delegateOk(k, p, t);
    const body = parts(await promptOfJob(d.job_id)).body("本文")!;
    expect(body.length).toBe(200_000 + 1 + "終わりの行".length);
    expect(body.endsWith("終わりの行")).toBe(true);
  });

  it("K565-API-009 本文の行と前の区画が両方在る：本文だけで組み、区画の中身は入らない", async () => {
    const { p } = await fresh("両方ある人");
    const t = await raw(p);
    await putLegacy(t, "区画の目的（入らない）", "区画の完了の条件", "- 区画の実施事項");
    await putBody(t, ["本文の字（入る）"]);
    await addSpec(t, "確かめること");
    const d = await delegateOk(k, p, t);
    const prompt = await promptOfJob(d.job_id);
    expect(prompt).toContain("本文の字（入る）");
    expect(prompt).not.toContain("区画の目的（入らない）");
    expect(prompt).not.toContain("区画の実施事項");
    expect(parts(prompt).heads).toEqual(["本文", "項目", "確認項目"]);
  });
});

describe("K-565 AI に任せる口の直し：確認項目が 0 件のとき（止まる・使わない理由）", () => {
  it("K565-API-011 本文の行が在る・確認項目が 0 件・理由なし × 任せる：409・E-CONF-020・欄なし。仕事・実行の記録・やり取りが増えず、段は未着手のまま、任せている印も false", async () => {
    const { p } = await fresh("0 件で止まる人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    const r = await k.delegate(p, t);
    expect(r.status, await r.clone().text()).toBe(409);
    const j = await json(r);
    expect(j.code).toBe(NO_SPEC);
    for (const key of ["field", "details", "detail"]) expect(j, `409 に ${key} を付けない`).not.toHaveProperty(key);
    expect(await written(t)).toEqual(NOTHING_WRITTEN);
    expect(await k.n("select count(*) as n from bridge_jobs where member_id = $1", [p.id])).toBe(0);
  });

  it("K565-API-012 0 件・理由あり（前後に空白）× 任せる：201。tickets.no_spec_reason は空白を落とした文・prompt の確認項目は「- なし（使わない理由：…）」・段は実行中", async () => {
    const { p } = await fresh("理由を書く人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    const r = await k.delegate(p, t, { no_spec_reason: "  請求書の文面の下書きで、確かめる物がまだ無い \n" });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = await data<{ job_id: string }>(r);
    expect((await rowOf(t)).no_spec_reason).toBe("請求書の文面の下書きで、確かめる物がまだ無い");
    expect(await k.stageOf(t)).toBe("running");
    expect(parts(await promptOfJob(d.job_id)).body("確認項目")).toBe(
      "- なし（使わない理由：請求書の文面の下書きで、確かめる物がまだ無い）",
    );
  });

  it("K565-API-013 確認項目が 1 件以上・理由あり × 任せる：201。理由は残さず（no_spec_reason は空のまま）、prompt にも入らない", async () => {
    const { p } = await fresh("理由が要らない人");
    const t2 = await raw(p);
    await putBody(t2, ["本文"]);
    await addSpec(t2, "確かめること");
    const r = await k.delegate(p, t2, { no_spec_reason: "送ってはいけない理由の文" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await rowOf(t2)).no_spec_reason).toBeNull();
    const job = await promptOfJob((await data<{ job_id: string }>(r)).job_id);
    expect(job).not.toContain("送ってはいけない理由の文");
    expect(parts(job).body("確認項目")).toBe("- 確かめること");
  });

  it("K565-API-014 理由の形：空・空白だけ・501 字・数・null は 422（欄 no_spec_reason）で何も書かない。ちょうど 500 字は通る", async () => {
    const { p } = await fresh("理由の形の人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    for (const bad of ["", "   ", "あ".repeat(501), 5, null]) {
      const r = await k.delegate(p, t, { no_spec_reason: bad });
      expect(r.status, JSON.stringify(bad).slice(0, 30)).toBe(422);
      const j = await json(r);
      expect(JSON.stringify(j.details)).toContain("no_spec_reason");
      expect(await written(t)).toEqual(NOTHING_WRITTEN);
    }
    const ok = await k.delegate(p, t, { no_spec_reason: "あ".repeat(500) });
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect((await rowOf(t)).no_spec_reason).toBe("あ".repeat(500));
  });

  it("K565-API-015 消した確認項目（deleted_at）だけ：0 件の扱いで、理由なしなら 409・E-CONF-020", async () => {
    const { p } = await fresh("消した確認項目の人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    await addSpec(t, "消した確認項目", { deleted: true });
    const r = await k.delegate(p, t);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe(NO_SPEC);
    expect(await written(t)).toEqual(NOTHING_WRITTEN);
  });

  it("K565-API-016 チェックの付いた確認項目だけ：1 件以上の扱いで 201（理由は要らない）", async () => {
    const { p } = await fresh("チェック済みだけの人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    await addSpec(t, "もうチェックが付いた", { checked: true });
    await delegateOk(k, p, t);
    expect((await rowOf(t)).no_spec_reason).toBeNull();
  });

  it("K565-API-017 前に残した理由は数えない：tickets.no_spec_reason に前の理由が残っていても、確認項目が 0 件で理由なしなら 409（毎回送る）", async () => {
    const { p } = await fresh("前の理由が残る人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    await k.q("update tickets set no_spec_reason = '前に書いた理由' where id = $1", [t]);
    const r = await k.delegate(p, t);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe(NO_SPEC);
    expect((await rowOf(t)).no_spec_reason).toBe("前に書いた理由"); // 断ったときは何も書き換えない
    expect(await k.n("select count(*) as n from action_runs where ticket_id = $1", [t])).toBe(0);
  });

  it("K565-API-018 断りの順：承認待ち（E-CONF-014）・走っている実行（E-CONF-013）・PC が無い（E-CONN-001）は、確認項目が 0 件で理由なしでも先にその番号で断る（E-CONF-020 は出ない）", async () => {
    const { p } = await fresh("順を見る人");
    const waiting = await raw(p);
    await putBody(waiting, ["本文"]);
    await k.q(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = 'awaiting_approval') where id = $1",
      [waiting],
    );
    const r1 = await k.delegate(p, waiting);
    expect(r1.status).toBe(409);
    expect((await json(r1)).code).toBe(E.notDelegable);
    // 走っている実行：1 回目は理由を付けて任せ、2 回目は理由なし
    const running = await raw(p);
    await putBody(running, ["本文"]);
    expect((await k.delegate(p, running, { no_spec_reason: "下書きなので" })).status).toBe(201);
    const r2 = await k.delegate(p, running);
    expect(r2.status).toBe(409);
    expect((await json(r2)).code).toBe(E.running);
    // PC をつないでいない人
    const noPc = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "PC 無しの人", ticketAbility: "edit" });
    const t3 = await raw(noPc);
    await putBody(t3, ["本文"]);
    const r3 = await k.delegate(noPc, t3);
    expect(r3.status).toBe(409);
    expect((await json(r3)).code).toBe(E.noPc);
    expect(await written(t3)).toEqual(NOTHING_WRITTEN);
  });

  it("K565-API-019 読むだけの人は 403・別の会社の人は 404（確認項目が 0 件でも 409 にならない）。何も書かない", async () => {
    const { p } = await fresh("守られる人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    const viewer = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "見るだけの人", ticketAbility: "view" });
    await k.device(viewer);
    const outsider = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    await k.device(outsider);
    const r1 = await k.delegate(viewer, t);
    expect(r1.status).toBe(403);
    const r2 = await k.delegate(outsider, t);
    expect(r2.status).toBe(404);
    expect(await written(t)).toEqual(NOTHING_WRITTEN);
  });
});

describe("K-565 AI に任せる口の直し：承認の一覧・詳細は答えを変えない・仕事の中身は 1 か所・道具・成果物", () => {
  /** 理由を付けて任せ、PC が終わらせて承認待ちにする。承認の id を返す */
  async function awaiting(name: string, reason: string | null): Promise<{ p: Person; t: string; approval: string }> {
    const { p, pc } = await fresh(name);
    const t = await raw(p, { title: `${name}のチケット` });
    await putBody(t, ["本文"]);
    if (reason === null) await addSpec(t, "確かめること");
    const d = await k.delegate(p, t, reason === null ? {} : { no_spec_reason: reason });
    expect(d.status, await d.clone().text()).toBe(201);
    const job = await k.takeJob(pc);
    const jobId = String((await data<{ job_id: string }>(d)).job_id);
    expect(job.job_id).toBe(jobId);
    const f = await k.finish(pc, jobId, { state: "done", result: "見積：合計 120,000 円", agent_session_id: SESS });
    expect(f.status, await f.clone().text()).toBe(201);
    const approval = (await k.q<{ id: string }>("select id from approvals where ticket_id = $1", [t]))[0]!.id;
    return { p, t, approval };
  }
  const queueItem = async (p: Person, t: string) => {
    const r = await k.f.req("GET", "/approvals/queue", { headers: p.auth });
    expect(r.status, await r.clone().text()).toBe(200);
    return ((await data<Record<string, unknown>[]>(r)) ?? []).find((x) => x["ticket_id"] === t)!;
  };
  const detailOf = async (p: Person, approval: string) => {
    const r = await k.f.req("GET", `/approvals/${approval}`, { headers: p.auth });
    expect(r.status, await r.clone().text()).toBe(200);
    return data<Record<string, unknown>>(r);
  };

  it("K565-API-020 承認の一覧は答えを変えない：理由を付けて任せたチケットの行にも no_spec_reason の鍵は出ない（鍵の一覧は理由なしで任せた行と同じ・check_summary は前のまま）。理由は tickets.no_spec_reason に残り、承認の帯が出すときは詳細 getTicket の ticket.no_spec_reason（K-560）から読む", async () => {
    const a = await awaiting("一覧の理由の人", "下書きなので確かめる物が無い");
    const item = await queueItem(a.p, a.t);
    expect(item).not.toHaveProperty("no_spec_reason");
    expect(item["check_summary"]).toBe("検査なし（まだ流していません）");
    expect((await rowOf(a.t)).no_spec_reason).toBe("下書きなので確かめる物が無い");
    const b = await awaiting("一覧の理由が無い人", null);
    expect(Object.keys(await queueItem(b.p, b.t)).sort()).toEqual(Object.keys(item).sort());
    expect(JSON.stringify(item)).not.toContain("下書きなので確かめる物が無い");
  });

  it("K565-API-021 承認の詳細も答えを変えない：理由を付けて任せた詳細にも no_spec_reason の鍵は出ず、鍵の一覧は理由なしで任せた詳細と同じ。理由の字は詳細の答えのどこにも出ない", async () => {
    const a = await awaiting("詳細の理由の人", "詳細に出す理由");
    const d = await detailOf(a.p, a.approval);
    expect(d).not.toHaveProperty("no_spec_reason");
    expect(JSON.stringify(d)).not.toContain("詳細に出す理由");
    const b = await awaiting("詳細の理由が無い人", null);
    expect(Object.keys(await detailOf(b.p, b.approval)).sort()).toEqual(Object.keys(d).sort());
  });

  it("K565-API-022 守り × 任せる関数を直に呼ぶ（2 層目）：理由 501 字・空白だけは {ok:false, code:'REASON_INVALID'} で何も書かない。一つ引数の ticket_delegate は無く、二つ引数の方は security definer で kaname_app だけ", async () => {
    const { p } = await fresh("関数を直に呼ぶ人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    const ctx: TenantContext = { tenantId: k.T.tenantId, userId: p.id, role: "member", stepUpAt: null };
    for (const bad of ["あ".repeat(501), "   "]) {
      const out = await withTenant(k.f.pool, ctx, (cl) =>
        cl.query<{ v: { ok: boolean; code?: string } }>("select app.ticket_delegate($1, $2) as v", [t, bad]),
      );
      expect(out.rows[0]!.v).toMatchObject({ ok: false, code: "REASON_INVALID" });
    }
    expect(await written(t)).toEqual(NOTHING_WRITTEN);
    const fns = await k.q<{ args: string; definer: boolean; pub: boolean; app: boolean }>(
      `select pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as definer,
              has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname = 'ticket_delegate'`,
    );
    expect(fns).toHaveLength(1);
    expect(fns[0]!.args).toBe("p_ticket uuid, p_no_spec_reason text");
    expect(fns[0]).toMatchObject({ definer: true, pub: false, app: true });
  });

  it("K565-API-023 仕事の中身は 1 か所：app.ticket_job_context が組んだ prompt と、任せた仕事の prompt が同じ（本文の道）。前の会話の続きは無い", async () => {
    const { p } = await fresh("組み方が 1 つの人");
    const t = await raw(p);
    await putBody(t, ["組み方を 1 か所にする本文"]);
    await addSpec(t, "確かめること");
    const ctx = (
      await k.q<{ v: { prompt: string; agent_session_id: string | null } }>("select app.ticket_job_context($1) as v", [
        t,
      ])
    )[0]!.v;
    const d = await delegateOk(k, p, t);
    expect(await promptOfJob(d.job_id)).toBe(ctx.prompt);
    expect(ctx.agent_session_id).toBeNull();
  });

  it("K565-API-024 AI が読む道具 ticket_read：本文の行が 鍵 body・字 text で返る（道具は前のまま）", async () => {
    const { p, pc } = await fresh("道具で読む人");
    const t = await raw(p);
    await putBody(t, ["道具で読む本文の一行目", "二行目"]);
    await addSpec(t, "確かめること");
    const d = await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    const r = await k.tool(pc, d.job_id, "ticket_read", job.tool_token);
    expect(r.status, await r.clone().text()).toBe(201);
    const sections = (await data<{ result: { sections: { key: string; text: string }[] } }>(r)).result.sections;
    expect(sections.find((s) => s.key === "body")?.text).toBe("道具で読む本文の一行目\n二行目");
  });

  it("K565-API-025 成果物の行き先は変わらない：本文のチケットで AI が終わると、区画 artifacts の行ができて版 1 に結果が入り、段は承認待ち", async () => {
    const a = await awaiting("成果物の人", "成果物の行き先を見る");
    const row = await k.q<{ version: number; text: string }>(
      "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
      [a.t],
    );
    expect(row).toEqual([{ version: 1, text: "見積：合計 120,000 円" }]);
    expect(await k.stageOf(a.t)).toBe("awaiting_approval");
  });
  it("K565-API-026 失敗 S1（任せる関数を呼べない・権限が外れた）× 本文のチケット・理由つき：503・E-PAGE-003。仕事・実行の記録・理由・やり取りが残らず、段は未着手のまま", async () => {
    const { p } = await fresh("関数が落ちる人");
    const t = await raw(p);
    await putBody(t, ["本文"]);
    // 試験が外した権限は finally で必ず戻す（G-10）
    await k.f.admin.query("revoke execute on function app.ticket_delegate(uuid, text) from kaname_app");
    try {
      const r = await k.delegate(p, t, { no_spec_reason: "下書きなので" });
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("grant execute on function app.ticket_delegate(uuid, text) to kaname_app");
    }
    expect(await written(t)).toEqual(NOTHING_WRITTEN);
  });
});
