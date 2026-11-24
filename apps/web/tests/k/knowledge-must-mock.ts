// 「必ず守る」と「似たページ」（K-691）の試験の道具：K-682 の knowledge-mock.ts（木・ページ・書く口）の上に、口を 2 本足して網の手前で差し替える。
//   setKnowledgeMust（PUT /knowledge_pages/:id/must）と findSimilarKnowledge（POST /knowledge/similar）。答えの形は 07_functional/段10-F9/土台-knowledge.md の 3.2 と K-685・K-686 の md。
//   mockKnowledge のあとに呼ぶ（あとから足した道が先に当たり、知らない道は mockKnowledge に戻る）。固定の待ちは使わない（hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";
import type { KMock, PageAnswer, Reply, TNode } from "./knowledge-mock";

export type XOp = "must" | "similar";
export interface XCall {
  op: XOp;
  id: string | undefined;
  body: Record<string, unknown>;
  key: string | undefined;
}
export interface SimilarItem {
  id: string;
  title: string;
  desc: string;
  place: string;
}
export interface XMock {
  calls: XCall[];
  count: (op: XOp, id?: string) => number;
  /** 付いている数と上限（付け外しの答えの used・limit） */
  used: number;
  limit: number;
  /** 似たページの答え（既定は空） */
  similar: SimilarItem[];
  script: (op: XOp, ...replies: (Reply | "network")[]) => void;
  hold: (op: XOp) => () => void;
}

const findNode = (nodes: TNode[], id: string): TNode | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const h = findNode(n.children ?? [], id);
    if (h) return h;
  }
  return undefined;
};

export async function mockMustSimilar(page: Page, mk: KMock): Promise<XMock> {
  const scripted = new Map<XOp, (Reply | "network")[]>();
  const gates = new Map<XOp, Promise<void>>();
  const x: XMock = {
    calls: [],
    count: (op, id) => x.calls.filter((c) => c.op === op && (id === undefined || c.id === id)).length,
    used: 8,
    limit: 30,
    similar: [],
    script: (op, ...r) => scripted.set(op, [...(scripted.get(op) ?? []), ...r]),
    hold: (op) => {
      let open = (): void => undefined;
      gates.set(op, new Promise<void>((r) => (open = r)));
      return () => {
        open();
        gates.delete(op);
      };
    },
  };
  await page.route(/\/api\/v1\/knowledge(_pages\/[^/?]+\/must|\/similar)(\?|$)/, async (route: Route, req: Request) => {
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    const seg = path.split("/").filter(Boolean);
    const op: XOp | null =
      path === "/knowledge/similar" && req.method() === "POST"
        ? "similar"
        : seg[2] === "must" && req.method() === "PUT"
          ? "must"
          : null;
    if (!op) return route.fallback();
    const id = op === "must" ? seg[1] : undefined;
    const raw = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : {};
    x.calls.push({ op, id, body: raw, key: req.headers()["idempotency-key"] });
    const gate = gates.get(op);
    if (gate) await gate;
    const next = scripted.get(op)?.shift();
    const send = (r: Reply) =>
      route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    if (next === "network") return route.abort("failed");
    if (next) return send(next);
    if (op === "similar") return send({ status: 200, body: { data: { pages: x.similar } } });
    const p: PageAnswer | undefined = id ? mk.pages.get(id) : undefined;
    if (!p) return send({ status: 404, body: { error: "e-page-001", code: "E-PAGE-001" } });
    const must = Boolean(raw["must"]);
    p.must = must;
    p.acts = [must ? "must-off" : "must-on", "edit"];
    const node = findNode(
      [...mk.tree.company_nodes, ...mk.tree.my_nodes, ...mk.tree.groups.flatMap((g) => g.nodes)],
      p.id,
    );
    if (node) node.must = must;
    x.used += must ? 1 : -1;
    return send({ status: 200, body: { data: { id: p.id, must, used: x.used, limit: x.limit } } });
  });
  return x;
}
