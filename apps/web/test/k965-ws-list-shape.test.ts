// K-965「運営のワークスペースの一覧の画面」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（getOpsShell・listOpsWorkspaces・K-1006 の形）→ 部品の値（features/F12/ops/ws-list-shape.ts）と、URL の絞り込みの読み書き。
//   字は下絵（features/F12/ops/ops-sample.ts の WS_ROWS・views-list.tsx の上の数）が正。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-965.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { listQuery, statsView, toSearch, wsRowView } from "../features/F12/ops/ws-list-shape";
import { WS_ROWS } from "../features/F12/ops/ops-sample";
import { WS_A, shellOf } from "../tests/k/ops-answers";

const NOW = new Date();

describe("K-965 一覧の 1 行の字", () => {
  it("K965-UN-001 下絵の 8 行と同じ字：管理者・プラン・人数・PC・今月の実行・気にかけること・請求・状態と色（止めた会社の PC と実行は —・自分の名前のワークスペースは「個人」）", () => {
    const got = WS_A.map((r) => wsRowView(r, NOW));
    const want = WS_ROWS.map(({ id: _id, ...rest }) => rest);
    expect(got.map(({ id: _id, ...rest }) => rest)).toEqual(want);
    expect(got.map((r) => r.id)).toEqual(WS_A.map((r) => r.id));
  });

  it("K965-UN-002 境目の字：期限を過ぎて 29 日は「期限を過ぎた 29 日」・30 日は「未入金 1 か月」・請求がお支払い待ちなら「お支払い待ち」・上限が無い人数は数だけ・やめる手続きの 14 日目は「あと 0 日」", () => {
    const base = WS_A[1]!;
    expect(wsRowView({ ...base, attention: [{ kind: "overdue", label_value: 29 }] }, NOW).bill).toBe(
      "期限を過ぎた 29 日",
    );
    expect(wsRowView({ ...base, attention: [{ kind: "overdue", label_value: 30 }] }, NOW).bill).toBe("未入金 1 か月");
    expect(wsRowView({ ...base, attention: [], billing_state: "unpaid" }, NOW).bill).toBe("お支払い待ち");
    expect(wsRowView({ ...base, members: { count: 4, limit: null } }, NOW).people).toBe("4");
    const closing = { ...WS_A[7]!, state_since: new Date(NOW.getTime() - 14 * 86_400_000).toISOString() };
    expect(wsRowView(closing, NOW).status).toBe("やめる手続き中（あと 0 日）");
  });

  it("K965-UN-003 気にかけることの字：2 つあれば請求を除いた最初の 1 つ（並びは口のまま）。知らない種類と前の limit（上限に近い・D-156.72 で外した）は出さない（— に戻す）", () => {
    const r = {
      ...WS_A[0]!,
      attention: [
        { kind: "overdue", label_value: 2 },
        { kind: "stuck", label_value: 3 },
      ],
    } as const;
    expect(wsRowView({ ...r, attention: [...r.attention] }, NOW).care).toBe("止まった実行 3");
    const lim = { ...WS_A[0]!, attention: [{ kind: "limit" as never, label_value: 95 }] };
    expect(wsRowView(lim, NOW).care).toBe("—");
    const odd = { ...WS_A[0]!, attention: [{ kind: "gone" as never, label_value: 1 }] };
    expect(wsRowView(odd, NOW).care).toBe("—");
  });
});

describe("K-965 上の数と URL", () => {
  it("K965-UN-004 上の数：使っている・気にかける・今月の実行（先月より N% 多い／少ない／先月なし）・期限を過ぎた請求（お金を持たない人は —）", () => {
    const s = statsView(shellOf());
    expect(s).toEqual({
      total: 48,
      active: { value: "46", sub: "止めている 1 ・ やめる手続き中 1" },
      attention: "3",
      runs: { value: "48,210", sub: "先月より 12% 多い" },
      overdue: { value: "2 件", sub: "¥ 49,500（税込）" },
      chips: { all: 48, attention: 3, stopped: 1, closing: 1, free: 21, team: 19, business: 8 },
    });
    expect(statsView(shellOf({ runs_month: { count: 900, prev_ratio: 0.9 } })).runs.sub).toBe("先月より 10% 少ない");
    expect(statsView(shellOf({ runs_month: { count: 0, prev_ratio: null } })).runs).toEqual({ value: "0", sub: null });
    expect(statsView(shellOf({ invoices: null })).overdue).toEqual({ value: "—", sub: null });
  });

  it("K965-UN-005 URL の読み書き：知らない値は既定（view all・sort attention・plan なし）に戻す・q は前後の空白を落として 100 字まで・既定の値は URL に書かない", () => {
    expect(listQuery(new URLSearchParams("view=stopped&plan=team&sort=members&q=%20ほしの%20"))).toEqual({
      view: "stopped",
      plan: "team",
      sort: "members",
      q: "ほしの",
    });
    expect(listQuery(new URLSearchParams("view=gone&plan=gold&sort=name"))).toEqual({
      view: "all",
      plan: null,
      sort: "attention",
      q: "",
    });
    expect(listQuery(new URLSearchParams(`q=${"あ".repeat(120)}`)).q).toBe("あ".repeat(100));
    expect(toSearch({ view: "all", plan: null, sort: "attention", q: "" })).toBe("");
    expect(toSearch({ view: "attention", plan: "free", sort: "runs", q: "ほしの" })).toBe(
      "?view=attention&plan=free&sort=runs&q=%E3%81%BB%E3%81%97%E3%81%AE",
    );
  });
});
