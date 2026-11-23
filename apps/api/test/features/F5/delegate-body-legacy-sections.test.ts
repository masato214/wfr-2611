// K-565「AI に任せる口の直し」のうち、本文の行が無いチケットを前の区画から組む行（K565-API-008・010）。名前の頭の行 ID は 11_tickets/K-565.md の表と 1 対 1。
//   K-565 が入ってから K-578 が区画の道を外すまでの間の姿を見る（本文の行が無い／消した本文の行だけが在るチケットは前の区画から組み、確認項目が 0 件でも任せられる）。
//   K-578 がこのファイルごと消す（その後の姿は K578-API-011〜013）。ほかの行は delegate-body.test.ts（本文の行が在る形）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import { delegateOk, makeKit, type Device, type Kit } from "./delegate-kit.js";

let k: Kit;

beforeAll(async () => {
  k = await makeKit();
  Object.assign(k.f.hooks, approveHooks(k.f.pool));
  for (const op of ["listApprovalQueue", "getApproval"]) k.f.limits[op] = 100_000;
}, 90_000);
afterAll(async () => {
  await k?.close();
});

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

describe("K-565 AI に任せる口の直し：本文の行が無いチケット（前の区画から組む・K-578 が外すまで）", () => {
  it("K565-API-008 本文の行が無い（前の形）：prompt は前のとおり区画から組む（見出しは 目的・完了の条件・実施事項）。確認項目が 0 件でも 201 で、理由は残さない", async () => {
    const { p } = await fresh("前の形の人");
    const t = await raw(p);
    await putLegacy(t, "前の形の目的", "前の形の完了の条件", "- 前の形の実施事項");
    const d = await delegateOk(k, p, t);
    const pp = parts(await promptOfJob(d.job_id));
    expect(pp.heads).toEqual(["目的", "完了の条件", "実施事項"]);
    expect(pp.body("目的")).toBe("前の形の目的");
    expect(pp.body("実施事項")).toBe("- 前の形の実施事項");
    expect(pp.intro).toContain("チケットの区画は Kaname の道具 ticket_read で読めます");
    expect((await rowOf(t)).no_spec_reason).toBeNull();
  });

  it("K565-API-010 消した本文の行（deleted_at）だけが在る：本文の行が無い扱い（前の形）で、確認項目が 0 件でも 201", async () => {
    const { p } = await fresh("消した本文の人");
    const t = await raw(p);
    await putBody(t, ["消した本文の字"], true);
    await putSection(t, "purpose", 10, { text: "区画の目的" });
    const d = await delegateOk(k, p, t);
    const prompt = await promptOfJob(d.job_id);
    expect(prompt).toContain("区画の目的");
    expect(prompt).not.toContain("消した本文の字");
  });
});
