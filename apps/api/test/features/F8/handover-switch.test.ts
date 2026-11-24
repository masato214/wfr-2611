// K-404「受けたときに一緒に切り替える（app.handover_apply_switch）」の単体の試験（本物の DB・関数を直に呼ぶ）。行 ID（K404-…）は 11_tickets/K-404.md の表に 1 対 1。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台は K-401 の ./handover.harness.ts。
// 関数は持ち主の接続で会社の文脈（app.tenant_id・app.user_id＝答えた人）を入れて呼び、確定してから行を読む（asOwnerCommit）。
//   受けるの口から通して移ることは中間テスト K-416 が見る（切り方.md 3 章）。渡しの行は DB に直に置く。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupHandover, type World, type P } from "./handover.harness.js";

const h = setupHandover("K404");

type Moved = { children: number; links: number; group: { from: string; to: string } | null; axes: number };
const SW = (o: Partial<{ children: boolean; links: boolean; group: boolean }>) => ({
  children: false,
  links: false,
  group: false,
  axes: [],
  ...o,
});
/** 答えた人（to）の文脈で関数を呼んで確定する */
const apply = async (to: P, hid: string, from: P) =>
  (
    await h.asOwnerCommit<{ v: Moved }>(to, "select app.handover_apply_switch($1, $2, $3) as v", [hid, from.id, to.id])
  )[0]!.v;

/** 高本が担当のチケットと、子・孫・ほかの人の子・完了した子・消した子 */
async function tree(w: World) {
  const t = await h.ticket(w);
  const c1 = await h.ticket(w, { parent: t.id });
  const c2 = await h.ticket(w, { parent: t.id });
  const g1 = await h.ticket(w, { parent: c1.id });
  const cs = await h.ticket(w, { parent: t.id, assignee: w.suzuki });
  const cd = await h.ticket(w, { parent: t.id, completed: true });
  const cx = await h.ticket(w, { parent: t.id, deleted: true });
  return { t, mine: [c1.id, c2.id, g1.id], others: [cs.id, cd.id, cx.id] };
}

describe("K-404 一緒に切り替える（app.handover_apply_switch）", () => {
  it("K404-DB-001 子と孫を移す：前の担当者の開いている子 2 つと孫 1 つが新しい担当者に。ほかの人・完了・消した子は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const { t, mine, others } = await tree(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, switch: SW({ children: true }) });
    const v = await apply(w.sato, hid, w.boss);
    expect(v.children).toBe(3);
    for (const id of mine) expect(await h.assigneeOf(id)).toBe(w.sato.id);
    expect(await h.assigneeOf(others[0]!)).toBe(w.suzuki.id);
    expect(await h.assigneeOf(others[1]!)).toBe(w.boss.id);
    expect(await h.assigneeOf(others[2]!)).toBe(w.boss.id);
  });

  it("K404-DB-002 子を移さない（children false）：子と孫は前の担当者のまま・children 0", async () => {
    await h.ready();
    const w = await h.world();
    const { t, mine } = await tree(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, switch: SW({}) });
    const v = await apply(w.sato, hid, w.boss);
    expect(v.children).toBe(0);
    for (const id of mine) expect(await h.assigneeOf(id)).toBe(w.boss.id);
  });

  it("K404-DB-003 関連と派生元（両向き）：前の担当者の開いている物だけ移る・子でもある物は子として 1 回だけ数える", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const x1 = await h.ticket(w);
    const x2 = await h.ticket(w);
    const xs = await h.ticket(w, { assignee: w.suzuki });
    const xd = await h.ticket(w, { completed: true });
    const both = await h.ticket(w, { parent: t.id });
    await h.link(w, t.id, x1.id, "related");
    await h.link(w, x2.id, t.id, "derived_from"); // 逆向き
    await h.link(w, t.id, xs.id, "related");
    await h.link(w, t.id, xd.id, "related");
    await h.link(w, t.id, both.id, "related");
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, switch: SW({ children: true, links: true }) });
    const v = await apply(w.sato, hid, w.boss);
    expect(v.links).toBe(2);
    expect(v.children).toBe(1);
    expect(await h.assigneeOf(x1.id)).toBe(w.sato.id);
    expect(await h.assigneeOf(x2.id)).toBe(w.sato.id);
    expect(await h.assigneeOf(both.id)).toBe(w.sato.id);
    expect(await h.assigneeOf(xs.id)).toBe(w.suzuki.id);
    expect(await h.assigneeOf(xd.id)).toBe(w.boss.id);
  });

  it("K404-DB-004 グループを移す：相手がグループの外なら、チケットのグループが相手の主のグループに・番号は変わらない・子は営業のまま", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const child = await h.ticket(w, { parent: t.id });
    const hid = await h.waiting(w, { ticketId: t.id, to: w.jdMember, switch: SW({ group: true }) });
    const v = await apply(w.jdMember, hid, w.boss);
    expect(v.group).toEqual({ from: w.co.eg, to: w.co.jd });
    const row = await h.ticketRow(t.id);
    expect(row["scope_id"]).toBe(w.co.jd);
    expect(row["number"]).toBe(t.number);
    expect((await h.ticketRow(child.id))["scope_id"]).toBe(w.co.eg);
  });

  it("K404-DB-005 相手がもうグループにいる：group true でもグループは変わらない・group null", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, switch: SW({ group: true }) });
    const v = await apply(w.sato, hid, w.boss);
    expect(v.group).toBeNull();
    expect((await h.ticketRow(t.id))["scope_id"]).toBe(w.co.eg);
  });

  it("K404-DB-006 答えの形：鍵がちょうど 4・axes は 0", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, switch: SW({ children: true, links: true }) });
    const v = await apply(w.sato, hid, w.boss);
    expect(Object.keys(v).sort()).toEqual(["axes", "children", "group", "links"]);
    expect(v.axes).toBe(0);
  });

  it("K404-DB-007 書いた人：移した子の updated_by は呼んだ人・移していない子は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const { t, mine, others } = await tree(w);
    const before = (await h.ticketRow(others[0]!))["updated_by"];
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, switch: SW({ children: true }) });
    await apply(w.sato, hid, w.boss);
    for (const id of mine) expect((await h.ticketRow(id))["updated_by"]).toBe(w.sato.id);
    expect((await h.ticketRow(others[0]!))["updated_by"]).toBe(before);
  });

  it("K404-DB-008 手順 S1 失敗（無い渡し・別の会社の渡し）：例外 22023・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const { mine } = await tree(w);
    const theirs = await h.ticket({ ...w, co: w.other, boss: w.outsider } as World, { assignee: w.outsider });
    const otherHid = await h.waiting({ ...w, co: w.other } as World, {
      ticketId: theirs.id,
      from: w.outsider,
      to: w.outsider,
      switch: SW({ children: true }),
    });
    for (const id of [randomUUID(), otherHid]) {
      const e = await apply(w.sato, id, w.boss).then(
        () => null,
        (x: unknown) => x as { code?: string },
      );
      expect(e?.code, id).toBe("22023");
    }
    for (const id of mine) expect(await h.assigneeOf(id)).toBe(w.boss.id);
  });

  it("K404-DB-009 kaname_app から直に呼べない（permission denied）", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w);
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato });
    await expect(
      h.asMember(w.sato, "select app.handover_apply_switch($1, $2, $3)", [hid, w.boss.id, w.sato.id]),
    ).rejects.toThrow(/permission denied/);
  });

  it("K404-DB-010 下見の数と同じ：下見の children.mine・links.mine と、移した数が同じ", async () => {
    await h.ready();
    const w = await h.world();
    const { t } = await tree(w);
    const x1 = await h.ticket(w);
    const x2 = await h.ticket(w, { assignee: w.suzuki });
    await h.link(w, t.id, x1.id, "related");
    await h.link(w, t.id, x2.id, "related");
    const d = (await h.json(await h.preview(w.boss, t.id))).data!;
    const hid = await h.waiting(w, { ticketId: t.id, to: w.sato, switch: SW({ children: true, links: true }) });
    const v = await apply(w.sato, hid, w.boss);
    expect(v.children).toBe((d["children"] as { mine: number }).mine);
    expect(v.links).toBe((d["links"] as { mine: number }).mine);
  });
});
