// K-682「ナレッジの画面の入れ物」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え → 部品の値（shape.ts）と、後ろの葉が差し込む動きの合わせ方（page-slots.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-682.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { editingAfterNavigation, footLine, openPathOf, shapeTree } from "../features/F9/knowledge/shape";
import { isInert, mergeSlots } from "../features/F9/knowledge/page-slots";

type TreeIn = Parameters<typeof shapeTree>[0];
const GA = "0193c5a0-0000-7000-8000-00000000e001";
const GB = "0193c5a0-0000-7000-8000-00000000e002";
const tree = (over: Partial<TreeIn> = {}): TreeIn =>
  ({
    company_name: "ENGINE BASE",
    company_nodes: [
      {
        kind: "folder",
        id: "f1",
        name: "経理",
        children: [
          {
            kind: "folder",
            id: "f2",
            name: "請求",
            children: [{ kind: "page", id: "p1", title: "請求書", must: true, mark: null }],
          },
        ],
      },
      { kind: "page", id: "p2", title: "メール", must: false, mark: "draft" },
    ],
    groups: [
      { id: GA, name: "営業", code: "EG", tone: "teal", shared: false, nodes: [] },
      { id: GB, name: "受託開発", code: null, tone: "plum", shared: true, nodes: [] },
    ],
    my_nodes: [],
    can_write: { company: true, group_ids: [GA], me: true },
    admin_counts: { approvals: 1, review: 8 },
    truncated: false,
    ...over,
  }) as TreeIn;

describe("K-682 口の答え → 部品の値（shape.ts）", () => {
  it("K682-UN-001 棚と印：会社・グループ・自分の木が部品の形になり、グループは id を持ち、書ける棚は id で渡り、札の字は code（無ければ名前の頭 1 字）・フォルダの開閉は渡した集合で決まる", () => {
    const d = shapeTree(tree(), new Set(["f1"]));
    expect(d.company).toBe("ENGINE BASE");
    expect(d.groups.map((g) => [g.id, g.code, g.tone, Boolean(g.shared)])).toEqual([
      [GA, "EG", "teal", false],
      [GB, "受", "plum", true],
    ]);
    expect(d.canWrite).toEqual({ company: true, group: [GA], me: true });
    const f1 = d.companyNodes[0]!;
    expect(f1.kind === "folder" && f1.open).toBe(true);
    const f2 = f1.kind === "folder" ? f1.children[0]! : null;
    expect(f2 && f2.kind === "folder" && Boolean(f2.open)).toBe(false);
    const p2 = d.companyNodes[1]!;
    expect(p2.kind === "page" && p2.mark).toBe("draft");
  });

  it("K682-UN-002 初めから開くフォルダ：いま開いているページの親を棚の直下から全部（無いページは空）", () => {
    expect(openPathOf(tree(), "p1")).toEqual(["f1", "f2"]);
    expect(openPathOf(tree(), "p2")).toEqual([]);
    expect(openPathOf(tree(), "no-such")).toEqual([]);
  });

  it("K682-UN-003 足元の 1 行：「最後に直した：<名前> <月/日> ・ 版 <N> ・ AI がこの 30 日に開いた：<n> 回」（日本時間・名前が無いときは —）", () => {
    expect(
      footLine({
        last_editor_name: "高本 聖斗",
        last_edited_at: "2026-11-18T03:00:00Z",
        version: 4,
        ai_opened_30d: 12,
      }),
    ).toBe("最後に直した：高本 聖斗 11/18 ・ 版 4 ・ AI がこの 30 日に開いた：12 回");
    expect(
      footLine({ last_editor_name: null, last_edited_at: "2026-11-30T16:30:00Z", version: 1, ai_opened_30d: 0 }),
    ).toBe("最後に直した：— 12/1 ・ 版 1 ・ AI がこの 30 日に開いた：0 回");
  });
});

describe("K-682 後ろの葉が差し込む動き（page-slots.ts）", () => {
  it("K682-UN-004 動きの無い操作は押せない形・動きのある操作は押せる・複数の差し込みの動きが 1 つにまとまる（同じ操作に 2 つ付けたら先の物）", () => {
    const calls: string[] = [];
    const none = mergeSlots([]);
    expect(isInert(none, "act", "edit")).toBe(true);
    expect(isInert(none, "more", "delete")).toBe(true);
    expect(none.add).toBeUndefined();
    const m = mergeSlots([
      { acts: { edit: () => calls.push("a-edit") } },
      {
        acts: { edit: () => calls.push("b-edit"), raise: () => calls.push("b-raise") },
        more: { versions: () => calls.push("v") },
      },
      { add: () => calls.push("add"), overlay: "小窓A" },
      { overlay: "小窓B" },
    ]);
    expect(isInert(m, "act", "edit")).toBe(false);
    expect(isInert(m, "act", "share")).toBe(true);
    expect(isInert(m, "more", "versions")).toBe(false);
    m.acts["edit"]?.();
    m.acts["raise"]?.();
    m.more["versions"]?.();
    m.add?.({ shelf: "company" });
    expect(calls).toEqual(["a-edit", "b-raise", "v", "add"]);
    expect(m.overlays, "小窓は先の物だけでなく全部を順に残す").toEqual(["小窓A", "小窓B"]);
  });
  it("K682-UN-005 ページを替えたら書いている印を戻す：同じページのままなら持ち越し・別のページ・ページを開いていない道へ移ったら false", () => {
    expect(editingAfterNavigation("a", "a", true)).toBe(true);
    expect(editingAfterNavigation("a", "b", true)).toBe(false);
    expect(editingAfterNavigation("a", undefined, true)).toBe(false);
    expect(editingAfterNavigation("a", "b", false)).toBe(false);
  });
});
