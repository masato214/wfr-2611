// K-676「木を読む（getKnowledgeTree）」の単体の試験（口・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K676-API-NNN（チケット 11_tickets/K-676.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md（3.1 の KnowledgeTree）。
//   土台は knowledge.harness.ts（K-675 が運ぶ）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（実装の前の smoke で準備ごと落とさない・answer=8f745003d023）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { setupKnowledge, type Person } from "./knowledge.harness.js";

const h = setupKnowledge();

type Mark = "waiting" | "declined" | "draft" | "copy" | null;
type TreeNode =
  | { kind: "page"; id: string; title: string; must: boolean; mark: Mark }
  | { kind: "folder"; id: string; name: string; children: TreeNode[] };
interface Tree {
  company_name: string;
  company_nodes: TreeNode[];
  groups: { id: string; name: string; code: string | null; tone: string; shared: boolean; nodes: TreeNode[] }[];
  my_nodes: TreeNode[];
  can_write: { company: boolean; group_ids: string[]; me: boolean };
  admin_counts: { approvals: number; review: number } | null;
  truncated: boolean;
}

interface World {
  label: string;
  co: { tenantId: string; rootScope: string };
  g1: string;
  g2: string;
  /** 会社の管理者（どのグループにも入っていない） */
  boss: Person;
  /** 営業のマネージャー */
  mgr1: Person;
  /** 営業のメンバー・閲覧のみ */
  mem1: Person;
  view1: Person;
  /** 受託開発のメンバー */
  mem2: Person;
  /** どのグループにも入っていない人 */
  none: Person;
}

/** 会社 1 つ（グループは 営業・受託開発）と、役の違う人たち */
const world = async (label: string): Promise<World> => {
  const co = await h.company(label);
  const g1 = await h.group(co.tenantId, co.rootScope, "営業");
  const g2 = await h.group(co.tenantId, co.rootScope, "受託開発");
  const boss = await h.person(co.tenantId, co.rootScope, { name: "管理者", role: "admin" });
  const mgr1 = await h.person(co.tenantId, g1, { name: "営業マネージャー", role: "manager" });
  const mem1 = await h.person(co.tenantId, g1, { name: "営業メンバー", role: "member" });
  const view1 = await h.person(co.tenantId, g1, { name: "営業閲覧", role: "viewer" });
  const mem2 = await h.person(co.tenantId, g2, { name: "開発メンバー", role: "member" });
  const none = await h.person(co.tenantId, co.rootScope, { name: "どこにも入っていない人", role: "member" });
  return { label, co, g1, g2, boss, mgr1, mem1, view1, mem2, none };
};

/** 木を読む。ログインしている人として 200 を確かめて data を返す */
const getTree = async (p: Person): Promise<Tree> => {
  await h.ready();
  const r = await h.req("GET", "/knowledge/tree", { headers: h.as(p) });
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Tree;
};

/** 木の中のページの題名を全部（フォルダの中も） */
const pageTitles = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === "page" ? [n.title] : pageTitles(n.children)));
/** 木の中のフォルダの名前を全部 */
const folderNames = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === "folder" ? [n.name, ...folderNames(n.children)] : []));
/** 木の形を 1 本の字にする：F:名前[…]・P:題名 */
const shapeOf = (nodes: readonly TreeNode[]): string =>
  nodes.map((n) => (n.kind === "folder" ? `F:${n.name}[${shapeOf(n.children)}]` : `P:${n.title}`)).join(",");

const setPosition = (table: "knowledge_folders" | "knowledge_pages", id: string, position: number) =>
  h.admin.query(`update ${table} set position = $2 where id = $1`, [id, position]);

const count = async (sql: string, p: unknown[]): Promise<number> =>
  Number((await h.admin.query<{ n: string }>(sql, p)).rows[0]!.n);

describe("K-676 木を読む", () => {
  it("K676-API-001 答えの鍵が決めたとおり：company_name・company_nodes・groups・my_nodes・can_write（company・group_ids・me）・admin_counts・truncated。会社の名前がそのまま出る", async () => {
    const w = await world("K676 鍵の会社");
    const r = await (async () => {
      await h.ready();
      return h.req("GET", "/knowledge/tree", { headers: h.as(w.mem1) });
    })();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const data = (await h.json(r)).data as Tree;
    expect(Object.keys(data).sort()).toEqual([
      "admin_counts",
      "can_write",
      "company_name",
      "company_nodes",
      "groups",
      "my_nodes",
      "truncated",
    ]);
    expect(Object.keys(data.can_write).sort()).toEqual(["company", "group_ids", "me"]);
    expect(data.company_name).toBe(w.label);
  });

  it("K676-API-002 会社の棚：公開済みは社内の全員に出る。下書きのページは持ち主（管理者）だけに出て、ほかの人には出ない。グループのページは会社の棚に混ざらない", async () => {
    const w = await world("K676 会社の棚");
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "経費の精算" });
    await h.page({ scope: w.co.rootScope, owner: w.boss, state: "draft", title: "書きかけの会社のページ" });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "営業だけのページ" });
    const boss = await getTree(w.boss);
    expect(pageTitles(boss.company_nodes).sort()).toEqual(["書きかけの会社のページ", "経費の精算"]);
    for (const p of [w.mgr1, w.mem1, w.view1, w.mem2, w.none]) {
      expect(pageTitles((await getTree(p)).company_nodes), p.id).toEqual(["経費の精算"]);
    }
  });

  it("K676-API-003 グループの棚：入っているグループだけが出る（管理者・入っていない人・別のグループの人には出ない）。下書きは持ち主だけ。複数のグループに入る人は作った順に並ぶ", async () => {
    const w = await world("K676 グループの棚");
    const both = await h.person(w.co.tenantId, w.g1, { name: "両方に入る人", role: "member" });
    await h.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, false, 'member')",
      [w.co.tenantId, both.id, w.g2],
    );
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "見積もり" });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "見積もりの出し方", folder: f1 });
    await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "営業の書きかけ" });
    await h.page({ scope: w.g2, owner: w.mem2, title: "開発の進め方" });
    const mem1 = await getTree(w.mem1);
    expect(mem1.groups.map((g) => g.id)).toEqual([w.g1]);
    expect(shapeOf(mem1.groups[0]!.nodes)).toBe("F:見積もり[P:見積もりの出し方]");
    const mgr1 = await getTree(w.mgr1);
    expect(pageTitles(mgr1.groups[0]!.nodes).sort()).toEqual(["営業の書きかけ", "見積もりの出し方"]);
    const b = await getTree(both);
    expect(b.groups.map((g) => g.id)).toEqual([w.g1, w.g2]);
    expect(b.groups.map((g) => g.name)).toEqual(["営業", "受託開発"]);
    expect(pageTitles(b.groups[1]!.nodes)).toEqual(["開発の進め方"]);
    for (const p of [w.boss, w.none]) {
      const t = await getTree(p);
      expect(t.groups, p.id).toEqual([]);
      expect(pageTitles(t.company_nodes), p.id).toEqual([]);
    }
    expect((await getTree(w.mem2)).groups.map((g) => g.id)).toEqual([w.g2]);
  });

  it("K676-API-004 自分の棚：本人だけに出る（管理者・マネージャー・同じグループの人にも出ない）。自分のフォルダも同じ。グループの棚には混ざらない", async () => {
    const w = await world("K676 自分の棚");
    const mine = await h.folder({ scope: w.mem1.scopeId, owner: w.mem1, name: "メモ", personal: true });
    await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分の手順", folder: mine });
    await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分の直下のページ" });
    const t = await getTree(w.mem1);
    expect(shapeOf(t.my_nodes)).toBe("F:メモ[P:自分の手順],P:自分の直下のページ");
    expect(t.groups[0]!.nodes).toEqual([]);
    expect(t.company_nodes).toEqual([]);
    for (const p of [w.boss, w.mgr1, w.view1, w.mem2, w.none]) {
      const o = await getTree(p);
      expect(o.my_nodes, p.id).toEqual([]);
      expect(folderNames([...o.company_nodes, ...o.groups.flatMap((g) => g.nodes)]), p.id).toEqual([]);
    }
  });

  it("K676-API-005 木の形と並び：フォルダの中にフォルダとページ・同じ親の中は フォルダ → ページ、それぞれ position・名前（題名）の順。位置が同じなら名前の順", async () => {
    const w = await world("K676 木の形");
    const fa = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "A 経理" });
    const fb = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "B 人事" });
    const child = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "子", parent: fa });
    await setPosition("knowledge_folders", fa, 20);
    await setPosition("knowledge_folders", fb, 10);
    const pr = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "直下", position: 5 });
    const p1 = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "一番目", folder: fa, position: 1 });
    const p2 = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "二番目", folder: fa, position: 2 });
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "b", folder: child, position: 0 });
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "a", folder: child, position: 0 });
    expect([pr, p1, p2].length).toBe(3);
    const t = await getTree(w.mem1);
    expect(shapeOf(t.company_nodes)).toBe("F:B 人事[],F:A 経理[F:子[P:a,P:b],P:一番目,P:二番目],P:直下");
  });

  it("K676-API-006 ページの印：必ず守る（must）・下書き（draft）・写し（copy）。下書きと写しの両方なら下書きが勝つ。印は 1 つだけ", async () => {
    const w = await world("K676 印");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "経費の精算", must: true });
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "ふつう" });
    await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "写しのページ", copiedFrom: src });
    await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      state: "draft",
      title: "写しの書きかけ",
      copiedFrom: src,
    });
    const boss = await getTree(w.boss);
    const byTitle = (nodes: TreeNode[], t: string) =>
      nodes.find((n): n is Extract<TreeNode, { kind: "page" }> => n.kind === "page" && n.title === t)!;
    expect(byTitle(boss.company_nodes, "経費の精算")).toMatchObject({ must: true, mark: null });
    expect(byTitle(boss.company_nodes, "ふつう")).toMatchObject({ must: false, mark: null });
    const mine = await getTree(w.mem1);
    expect(byTitle(mine.my_nodes, "写しのページ")).toMatchObject({ must: false, mark: "copy" });
    expect(byTitle(mine.my_nodes, "写しの書きかけ")).toMatchObject({ mark: "draft" });
  });

  it("K676-API-007 承認待ち・断られたの印は、頼みの置き場（K-687）が入るまで付かない。頼みが 1 つも無ければ、入ってからも付かない（印は draft・copy・null だけ）", async () => {
    const w = await world("K676 印の前");
    const src = await h.page({ scope: w.g1, owner: w.mgr1, title: "元" });
    await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "上げたいページ", copiedFrom: src });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "共有したいページ" });
    for (const p of [w.mgr1, w.mem1]) {
      const t = await getTree(p);
      const marks = [...t.groups.flatMap((g) => g.nodes), ...t.my_nodes]
        .filter((n): n is Extract<TreeNode, { kind: "page" }> => n.kind === "page")
        .map((n) => n.mark);
      expect(marks.length, p.id).toBeGreaterThan(0);
      for (const m of marks) expect(["draft", "copy", null], p.id).toContain(m);
    }
  });

  it("K676-API-008 書ける棚（can_write）：管理者は会社・マネージャーはそのグループ・メンバーと閲覧のみは自分の棚だけ。複数のグループに入る人はマネージャーのグループだけ", async () => {
    const w = await world("K676 書ける棚");
    const mix = await h.person(w.co.tenantId, w.g1, { name: "営業のマネージャーで開発のメンバー", role: "manager" });
    await h.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, false, 'member')",
      [w.co.tenantId, mix.id, w.g2],
    );
    expect((await getTree(w.boss)).can_write).toEqual({ company: true, group_ids: [], me: true });
    expect((await getTree(w.mgr1)).can_write).toEqual({ company: false, group_ids: [w.g1], me: true });
    expect((await getTree(w.mem1)).can_write).toEqual({ company: false, group_ids: [], me: true });
    expect((await getTree(w.view1)).can_write).toEqual({ company: false, group_ids: [], me: true });
    expect((await getTree(w.none)).can_write).toEqual({ company: false, group_ids: [], me: true });
    expect((await getTree(mix)).can_write).toEqual({ company: false, group_ids: [w.g1], me: true });
  });

  it("K676-API-009 管理の数（admin_counts）：管理者とマネージャーには { approvals, review }（承認待ちと見直すページの置き場が入るまでは 0・0）、メンバー・閲覧のみ・どこにも入っていない人は null", async () => {
    const w = await world("K676 管理の数");
    for (const p of [w.boss, w.mgr1]) {
      expect((await getTree(p)).admin_counts, p.id).toEqual({ approvals: 0, review: 0 });
    }
    for (const p of [w.mem1, w.view1, w.mem2, w.none]) {
      expect((await getTree(p)).admin_counts, p.id).toBeNull();
    }
  });

  it("K676-API-010 グループの色（tone）：会社の中でグループを作った順の番号を 3 で割った余りで teal・plum・amber。人ごとに変わらない", async () => {
    const w = await world("K676 色");
    const g3 = await h.group(w.co.tenantId, w.co.rootScope, "経理");
    const g4 = await h.group(w.co.tenantId, w.co.rootScope, "人事");
    const all = await h.person(w.co.tenantId, w.g1, { name: "全部に入る人", role: "member" });
    for (const g of [w.g2, g3, g4])
      await h.admin.query(
        "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, false, 'member')",
        [w.co.tenantId, all.id, g],
      );
    await h.admin.query("update scopes set ticket_prefix = 'EIG' where id = $1", [w.g1]);
    await h.admin.query("update scopes set ticket_prefix = '' where id = $1", [g3]);
    const t = await getTree(all);
    expect(t.groups.map((g) => g.id)).toEqual([w.g1, w.g2, g3, g4]);
    // 札の字＝グループのチケットの番号の頭。決めていない（無い・空）グループは null
    expect(t.groups.map((g) => g.code)).toEqual(["EIG", null, null, null]);
    expect(t.groups.map((g) => g.tone)).toEqual(["teal", "plum", "amber", "teal"]);
    expect(t.groups.every((g) => g.shared === false)).toBe(true);
    const only3 = await h.person(w.co.tenantId, g3, { name: "経理だけの人", role: "member" });
    expect((await getTree(only3)).groups.map((g) => g.tone)).toEqual(["amber"]);
  });

  it("K676-API-011 5,000 ノードで切る：5,001 ページあると 5,000 だけ返し truncated true・ログに 1 行（題名は出さない）。ちょうど 5,000 なら全部・truncated false・ログなし", async () => {
    const big = await world("K676 大きい会社");
    await h.admin.query(
      "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, title, current_version) select $1, $2, false, $3, 'published', 'k676-bulk-' || g, 1 from generate_series(1, $4::int) g",
      [big.co.tenantId, big.co.rootScope, big.boss.id, 5001],
    );
    let cut: Tree | undefined;
    const logs = await h.captureLogs(async () => {
      cut = await getTree(big.boss);
    });
    expect(cut!.company_nodes.length).toBe(5000);
    expect(cut!.truncated).toBe(true);
    expect(logs.split("\n").filter((l) => l.includes("[knowledge] 木を 5000 で切った")).length).toBe(1);
    expect(logs).not.toContain("k676-bulk");
    const just = await world("K676 ちょうど 5000");
    await h.admin.query(
      "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, title, current_version) select $1, $2, false, $3, 'published', 'k676-just-' || g, 1 from generate_series(1, $4::int) g",
      [just.co.tenantId, just.co.rootScope, just.boss.id, 5000],
    );
    let full: Tree | undefined;
    const logs2 = await h.captureLogs(async () => {
      full = await getTree(just.boss);
    });
    expect(full!.company_nodes.length).toBe(5000);
    expect(full!.truncated).toBe(false);
    expect(logs2).not.toContain("木を 5000 で切った");
  }, 120_000);

  it("K676-API-012 消したページ・消したフォルダ・前の形のしまったページ（archived）は木に出ない", async () => {
    const w = await world("K676 消えた物");
    await h.page({ scope: w.co.rootScope, owner: w.boss, title: "残るページ" });
    const gone = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "消したページ" });
    const old = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "しまったページ" });
    const keep = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "残るフォルダ" });
    const dead = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "消したフォルダ" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    await h.admin.query("update knowledge_pages set state = 'archived', archived_at = now() where id = $1", [old]);
    await h.admin.query("update knowledge_folders set deleted_at = now() where id = $1", [dead]);
    expect(keep).toBeTruthy();
    const t = await getTree(w.mem1);
    expect(shapeOf(t.company_nodes)).toBe("F:残るフォルダ[],P:残るページ");
  });

  it("K676-API-013 グループから抜けた直後・マネージャーを外された直後・マネージャーにされた直後：入り直さなくても次の読みから効く（権限の波及）", async () => {
    const w = await world("K676 波及");
    await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const before = await getTree(w.mem1);
    expect(before.groups.map((g) => g.id)).toEqual([w.g1]);
    expect(pageTitles(before.groups[0]!.nodes)).toEqual(["営業のページ"]);
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem1.id, w.co.rootScope]);
    const after = await getTree(w.mem1);
    expect(after.groups).toEqual([]);
    expect(pageTitles(after.company_nodes)).toEqual([]);
    expect((await getTree(w.mgr1)).can_write.group_ids).toEqual([w.g1]);
    expect((await getTree(w.mgr1)).admin_counts).not.toBeNull();
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr1.id,
      w.g1,
    ]);
    const demoted = await getTree(w.mgr1);
    expect(demoted.can_write.group_ids).toEqual([]);
    expect(demoted.admin_counts).toBeNull();
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      w.view1.id,
      w.g1,
    ]);
    const promoted = await getTree(w.view1);
    expect(promoted.can_write.group_ids).toEqual([w.g1]);
    expect(promoted.admin_counts).toEqual({ approvals: 0, review: 0 });
  });

  it("K676-API-014 別の会社の物は混ざらない：別の会社のページ・フォルダ・グループは、どの人の木にも出ない。会社の名前は自分の会社のもの", async () => {
    const a = await world("K676 会社 A");
    const b = await world("K676 会社 B");
    await h.page({ scope: a.co.rootScope, owner: a.boss, title: "A のページ" });
    await h.page({ scope: b.co.rootScope, owner: b.boss, title: "B のページ" });
    await h.page({ scope: b.g1, owner: b.mgr1, title: "B の営業のページ" });
    await h.folder({ scope: b.co.rootScope, owner: b.boss, name: "B のフォルダ" });
    const ta = await getTree(a.mem1);
    expect(ta.company_name).toBe("K676 会社 A");
    expect(pageTitles(ta.company_nodes)).toEqual(["A のページ"]);
    expect(folderNames(ta.company_nodes)).toEqual([]);
    expect(ta.groups.map((g) => g.id)).toEqual([a.g1]);
    expect(pageTitles(ta.groups[0]!.nodes)).toEqual([]);
    const tb = await getTree(b.boss);
    expect(tb.company_name).toBe("K676 会社 B");
    expect(pageTitles(tb.company_nodes)).toEqual(["B のページ"]);
  });

  it("K676-API-015 何も入っていない会社：company_nodes・my_nodes は空・入っているグループは nodes が空で出る・truncated false", async () => {
    const w = await world("K676 空の会社");
    const boss = await getTree(w.boss);
    expect(boss.company_nodes).toEqual([]);
    expect(boss.my_nodes).toEqual([]);
    expect(boss.groups).toEqual([]);
    expect(boss.truncated).toBe(false);
    const mem = await getTree(w.mem1);
    expect(mem.groups).toEqual([{ id: w.g1, name: "営業", code: null, tone: "teal", shared: false, nodes: [] }]);
  });

  it("K676-API-016 ログインしていない要求は 401", async () => {
    await h.ready();
    const r = await h.req("GET", "/knowledge/tree");
    expect(r.status).toBe(401);
  });

  it("K676-API-017 共有の置き場（K-689）が入るまでは、共有された物だけのグループ（shared true）は出ない。共有が 1 つも無ければ、入ってからも出ない", async () => {
    const w = await world("K676 共有の前");
    await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    await h.page({ scope: w.g2, owner: w.mem2, title: "開発のページ" });
    for (const p of [w.mgr1, w.mem1, w.mem2, w.boss, w.none]) {
      const t = await getTree(p);
      expect(
        t.groups.filter((g) => g.shared),
        p.id,
      ).toEqual([]);
    }
    expect(pageTitles((await getTree(w.mem1)).groups.flatMap((g) => g.nodes))).toEqual(["営業のページ"]);
  });

  it("K676-API-018 読むだけで何も書かない：木を読んでも、ページ・フォルダ・証跡の行は増えず、更新の時刻も変わらない", async () => {
    const w = await world("K676 読むだけ");
    const pid = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "ページ" });
    await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "フォルダ" });
    const snap = async () => ({
      pages: await count("select count(*) as n from knowledge_pages where tenant_id = $1", [w.co.tenantId]),
      folders: await count("select count(*) as n from knowledge_folders where tenant_id = $1", [w.co.tenantId]),
      audits: await count("select count(*) as n from audit_events where tenant_id = $1", [w.co.tenantId]),
      updated: String((await h.row(pid))!["updated_at"]),
    });
    const before = await snap();
    await getTree(w.boss);
    await getTree(w.mem1);
    expect(await snap()).toEqual(before);
  });

  it("K676-API-019 上限を超えると 429（1 分 120 回の上限を 2 に差し替えた口の 3 回目）", async () => {
    const w = await world("K676 上限");
    h.limits["getKnowledgeTree"] = 2;
    try {
      await h.ready();
      const call = () => h.req("GET", "/knowledge/tree", { headers: h.as(w.mem1) });
      expect((await call()).status).toBe(200);
      expect((await call()).status).toBe(200);
      const r = await call();
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["getKnowledgeTree"];
    }
  });
});
