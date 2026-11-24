// ナレッジの画面（K-682・K-683・K-684）の試験の道具：ナレッジの口を網の手前で差し替える。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章（getKnowledgeTree・getKnowledgePage・版・書く口）。
//   名前・字・数は下絵 v2 の見本（features/F9/knowledge/samples.tsx）と同じにする（モックとの突き合わせのため）。
//   本人の Bridge（127.0.0.1:38617）は届かせない（網の手前で 404）。固定の待ちは使わない（答えは hold() で止め、返した関数を呼ぶと答える）。
//   テストはチケットを作る人が書き、実装する人は変えない
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Request, Route } from "@playwright/test";
import {
  EXPENSE_DOC as SAMPLE_EXPENSE_DOC,
  INVOICE_DOC as SAMPLE_INVOICE_DOC,
} from "../../features/F9/knowledge/samples";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 正本 errors.json の文（無ければ見つからない印の文字列を返し、試験が落ちる） */
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

export const uid = (n: number): string => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const G_SALES = uid(0xe001);
export const G_DEV = uid(0xe002);
export const F_KEIRI = uid(0xf001);
export const F_CS = uid(0xf002);
export const P_INVOICE = uid(0xa001);
export const P_EXPENSE = uid(0xa002);
export const P_MAIL = uid(0xa003);
export const P_OUTBOUND = uid(0xa004);
export const P_QUOTE = uid(0xa005);
export const P_MEMO = uid(0xa006);
export const P_MY_DISCOUNT = uid(0xa0c1);
export const P_INVOICE_COPY = uid(0xa0c2);
export const P_NEW = uid(0xa00f);
export const P_GONE = uid(0xa0ff);

// ---------------------------------------------------------------- 文書の木と字
export type Doc = { type: "doc"; content: unknown[] };
const t = (text: string) => ({ type: "text", text });
export const H2 = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [t(text)] });
export const P = (text: string) => ({ type: "paragraph", content: [t(text)] });
export const doc = (...content: unknown[]): Doc => ({ type: "doc", content });
export const EMPTY_DOC: Doc = { type: "doc", content: [] };
type DocNode = { text?: string; content?: DocNode[] };
const inlineText = (n: DocNode): string => n.text ?? (n.content ?? []).map(inlineText).join("");
/** 本文の字（段落・見出しごとに 1 行。並び・表の中の字もたどる） */
export const textOf = (d: Doc): string => (d.content as DocNode[]).map(inlineText).join("\n");
// 本文は下絵の見本（samples.tsx）と同じ木（モックとの突き合わせ K682-UI-001 が本文の字まで比べる）
export const INVOICE_DOC = SAMPLE_INVOICE_DOC as unknown as Doc;
export const EXPENSE_DOC = SAMPLE_EXPENSE_DOC as unknown as Doc;
export const NEW_DOC = doc(H2("目的"), P("書き始めたばかりの本文。"));

// ---------------------------------------------------------------- 口の答えの形
export interface TNode {
  kind: "page" | "folder";
  id: string;
  title?: string;
  name?: string;
  must?: boolean;
  mark?: "waiting" | "declined" | "copy" | "draft" | null;
  children?: TNode[];
}
export interface TreeAnswer {
  company_name: string;
  company_nodes: TNode[];
  groups: { id: string; name: string; code: string | null; tone: string; shared: boolean; nodes: TNode[] }[];
  my_nodes: TNode[];
  can_write: { company: boolean; group_ids: string[]; me: boolean };
  admin_counts: { approvals: number; review: number } | null;
  truncated: boolean;
}
export interface PageAnswer {
  id: string;
  title: string;
  desc: string;
  state: "draft" | "published";
  must: boolean;
  must_blocked: "too_long" | null;
  place: {
    shelf: "company" | "group" | "me";
    shelf_name: string;
    group_id: string | null;
    folder_id: string | null;
    folders: string[];
  };
  acts: string[];
  body: { doc: Doc; text: string } | null;
  draft: { doc: Doc; saved_at: string; title?: string; desc?: string } | null;
  request: unknown;
  copied_from: unknown;
  shared_from: unknown;
  raise_to: unknown;
  foot: { last_editor_name: string | null; last_edited_at: string; version: number; ai_opened_30d: number };
}
const pg = (id: string, title: string): TNode => ({ kind: "page", id, title });
export function treeTaka(): TreeAnswer {
  return {
    company_name: "ENGINE BASE",
    company_nodes: [
      {
        kind: "folder",
        id: F_KEIRI,
        name: "経理",
        children: [{ ...pg(P_INVOICE, "請求書の送り方"), must: true }, pg(P_EXPENSE, "経費の精算")],
      },
      { kind: "folder", id: F_CS, name: "お客さま対応", children: [] },
      { ...pg(P_MAIL, "メールの書き方"), must: true },
      { ...pg(P_OUTBOUND, "外に出す前の確かめ"), must: true },
    ],
    groups: [
      {
        id: G_SALES,
        name: "営業",
        code: "EG",
        tone: "teal",
        shared: false,
        nodes: [
          {
            kind: "folder",
            id: uid(0xf003),
            name: "見積もり",
            children: [pg(P_QUOTE, "見積書の出し方"), { ...pg(uid(0xa007), "値引きの決まり"), must: true }],
          },
          pg(uid(0xa008), "初回の訪問の流れ"),
        ],
      },
      {
        id: G_DEV,
        name: "受託開発",
        code: "JD",
        tone: "plum",
        shared: true,
        nodes: [{ ...pg(uid(0xa009), "納品の前の確かめ"), must: true }],
      },
    ],
    my_nodes: [pg(P_MEMO, "商談の前に見るメモ")],
    can_write: { company: true, group_ids: [], me: true },
    admin_counts: { approvals: 1, review: 8 },
    truncated: false,
  };
}
/** 鈴木さん（担当者）の木：会社とグループは高本さんと同じ・自分の棚は鈴木さんのページ・会社には書けない・管理の数は無い（下絵 kn-noaccess） */
export function treeSuzu(): TreeAnswer {
  return {
    ...treeTaka(),
    my_nodes: [
      pg(P_MY_DISCOUNT, "値引きを頼まれたときの返し方"),
      { ...pg(P_INVOICE_COPY, "請求書の送り方（自分用）"), mark: "copy" },
    ],
    can_write: { company: false, group_ids: [], me: true },
    admin_counts: null,
  };
}
export const treeEmpty = (): TreeAnswer => ({
  ...treeTaka(),
  company_nodes: [],
  groups: [{ id: G_SALES, name: "営業", code: "EG", tone: "teal", shared: false, nodes: [] }],
  my_nodes: [],
  admin_counts: { approvals: 0, review: 0 },
});
export function pageInvoice(over: Partial<PageAnswer> = {}): PageAnswer {
  return {
    id: P_INVOICE,
    title: "請求書の送り方",
    desc: "請求書を取引先に送る前に確かめることと、送り方の順番。",
    state: "published",
    must: true,
    must_blocked: null,
    place: { shelf: "company", shelf_name: "会社", group_id: null, folder_id: F_KEIRI, folders: ["経理"] },
    acts: ["must-off", "edit"],
    body: { doc: INVOICE_DOC, text: textOf(INVOICE_DOC) },
    draft: null,
    request: null,
    copied_from: null,
    shared_from: null,
    raise_to: null,
    foot: { last_editor_name: "高本 聖斗", last_edited_at: "2026-11-18T03:00:00Z", version: 4, ai_opened_30d: 12 },
    ...over,
  };
}
export const pageExpense = (): PageAnswer =>
  pageInvoice({
    id: P_EXPENSE,
    title: "経費の精算",
    desc: "立て替えた経費を月末までに精算するときの、出し方と上限。",
    must: false,
    acts: ["must-on", "edit"],
    body: { doc: EXPENSE_DOC, text: textOf(EXPENSE_DOC) },
    foot: { last_editor_name: "高本 聖斗", last_edited_at: "2026-11-20T03:00:00Z", version: 2, ai_opened_30d: 3 },
  });

// ---------------------------------------------------------------- 差し替え
export interface Reply {
  status: number;
  body: unknown;
}
export type KOp =
  | "tree"
  | "page"
  | "versions"
  | "version"
  | "createFolder"
  | "createPage"
  | "save"
  | "discard"
  | "publish"
  | "move"
  | "delete";
export interface Call {
  op: KOp;
  id: string | undefined;
  body: Record<string, unknown>;
  key: string | undefined;
  /** 飛んできた時刻（Date.now()・打ち終えてからの間を見る試験が読む） */
  at: number;
}
export interface KMock {
  tree: TreeAnswer;
  pages: Map<string, PageAnswer>;
  versions: Map<
    string,
    { version: number; published_at: string; by_name: string | null; body: { doc: Doc; text: string } }[]
  >;
  calls: Call[];
  /** 口ごとの飛んできた数（tree・page は読み。page は id ごと） */
  count: (op: KOp, id?: string) => number;
  /** 次の 1 回だけ、この答え（"network" は網が切れる）で答える */
  script: (op: KOp, ...replies: (Reply | "network")[]) => void;
  /** この口の答えを止める（返した関数を呼ぶと答える） */
  hold: (op: KOp) => () => void;
}
export const err = (status: number, code: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, ...extra },
});

const API = /\/api\/v1\/knowledge(_pages)?(\/|\?|$)/;
export async function mockKnowledge(
  page: Page,
  init: { tree?: TreeAnswer; pages?: PageAnswer[] } = {},
): Promise<KMock> {
  const scripted = new Map<KOp, (Reply | "network")[]>();
  const gates = new Map<KOp, Promise<void>>();
  const mk: KMock = {
    tree: init.tree ?? treeTaka(),
    pages: new Map((init.pages ?? [pageInvoice(), pageExpense()]).map((p) => [p.id, p])),
    versions: new Map(),
    calls: [],
    count: (op, id) => mk.calls.filter((c) => c.op === op && (id === undefined || c.id === id)).length,
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
  const removeNode = (nodes: TNode[], id: string): TNode | null => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i]!.id === id) return nodes.splice(i, 1)[0]!;
      const hit = removeNode(nodes[i]!.children ?? [], id);
      if (hit) return hit;
    }
    return null;
  };
  const shelfNodes = (shelf: string, group?: string): TNode[] =>
    shelf === "me"
      ? mk.tree.my_nodes
      : shelf === "group"
        ? (mk.tree.groups.find((g) => g.id === group)?.nodes ?? [])
        : mk.tree.company_nodes;
  const findFolder = (nodes: TNode[], id: string): TNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const h = findFolder(n.children ?? [], id);
      if (h) return h;
    }
    return undefined;
  };
  const home = (shelf: string, group: string | undefined, folder: string | null | undefined): TNode[] =>
    (folder ? findFolder(shelfNodes(shelf, group), folder)?.children : undefined) ?? shelfNodes(shelf, group);

  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(API, async (route: Route, req: Request) => {
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    const m = req.method();
    const seg = path.split("/").filter(Boolean);
    let op: KOp | null = null;
    let id: string | undefined;
    if (path === "/knowledge/tree" && m === "GET") op = "tree";
    else if (path === "/knowledge/folders" && m === "POST") op = "createFolder";
    else if (seg[0] === "knowledge_pages" && seg.length === 1 && m === "POST") op = "createPage";
    else if (seg[0] === "knowledge_pages" && seg[1]) {
      id = seg[1];
      if (seg[2] === "versions") op = seg[3] ? "version" : "versions";
      else if (seg[2] === "draft") op = m === "PATCH" ? "save" : m === "DELETE" ? "discard" : null;
      else if (seg[2] === "publish" && m === "POST") op = "publish";
      else if (!seg[2]) op = m === "GET" ? "page" : m === "PATCH" ? "move" : m === "DELETE" ? "delete" : null;
    }
    if (!op) return route.fallback();
    const raw = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : {};
    mk.calls.push({ op, id, body: raw, key: req.headers()["idempotency-key"], at: Date.now() });
    const gate = gates.get(op);
    if (gate) await gate;
    const next = scripted.get(op)?.shift();
    const send = (r: Reply) =>
      route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    if (next === "network") return route.abort("failed");
    if (next) return send(next);
    const p = id ? mk.pages.get(id) : undefined;
    const now = new Date().toISOString();
    switch (op) {
      case "tree":
        return send({ status: 200, body: { data: mk.tree } });
      case "page":
        return send(p ? { status: 200, body: { data: p } } : err(404, "E-PAGE-001"));
      case "versions":
        return send(
          p
            ? {
                status: 200,
                body: {
                  data: (mk.versions.get(id!) ?? []).map(({ version, published_at, by_name }) => ({
                    version,
                    published_at,
                    by_name,
                  })),
                  meta: { count: (mk.versions.get(id!) ?? []).length },
                },
              }
            : err(404, "E-PAGE-001"),
        );
      case "version": {
        const v = mk.versions.get(id!)?.find((x) => String(x.version) === seg[3]);
        return send(v ? { status: 200, body: { data: v } } : err(404, "E-PAGE-001"));
      }
      case "createFolder": {
        const f: TNode = { kind: "folder", id: uid(0xf100 + mk.calls.length), name: String(raw["name"]), children: [] };
        home(
          String(raw["shelf"]),
          raw["group_id"] as string | undefined,
          raw["parent_folder_id"] as string | null,
        ).push(f);
        return send({
          status: 201,
          body: {
            data: {
              id: f.id,
              name: f.name,
              shelf: raw["shelf"],
              group_id: raw["group_id"] ?? null,
              parent_folder_id: raw["parent_folder_id"] ?? null,
              position: 0,
            },
          },
        });
      }
      case "createPage": {
        const np = pageInvoice({
          id: P_NEW,
          title: String(raw["title"]),
          desc: String(raw["desc"] ?? ""),
          state: "draft",
          must: false,
          acts: [],
          body: null,
          draft: { doc: EMPTY_DOC, saved_at: now },
          foot: { last_editor_name: "高本 聖斗", last_edited_at: now, version: 0, ai_opened_30d: 0 },
        });
        mk.pages.set(np.id, np);
        home(String(raw["shelf"]), raw["group_id"] as string | undefined, raw["folder_id"] as string | null).push({
          kind: "page",
          id: np.id,
          title: np.title,
          mark: "draft",
        });
        return send({
          status: 201,
          body: { data: { id: np.id, title: np.title, desc: np.desc, state: "draft", must: false, place: np.place } },
        });
      }
      case "save": {
        if (!p) return send(err(404, "E-PAGE-001"));
        p.draft = {
          ...(p.draft ?? { doc: p.body?.doc ?? EMPTY_DOC }),
          saved_at: now,
          ...(raw["doc"] ? { doc: raw["doc"] as Doc } : {}),
          ...(raw["title"] !== undefined ? { title: String(raw["title"]) } : {}),
          ...(raw["desc"] !== undefined ? { desc: String(raw["desc"]) } : {}),
        } as PageAnswer["draft"];
        return send({
          status: 200,
          body: { data: { saved_at: now, title: raw["title"] ?? p.title, desc: raw["desc"] ?? p.desc } },
        });
      }
      case "publish": {
        if (!p || !p.draft) return send(err(409, "E-KNW-040"));
        const d = p.draft;
        p.title = d.title ?? p.title;
        p.desc = d.desc ?? p.desc;
        p.body = { doc: d.doc, text: textOf(d.doc) };
        p.draft = null;
        p.state = "published";
        p.acts = ["must-on", "edit"];
        p.foot = { ...p.foot, version: p.foot.version + 1, last_edited_at: now };
        const node = findFolder([...mk.tree.company_nodes, ...mk.tree.my_nodes], p.id);
        if (node) {
          node.title = p.title;
          node.mark = null;
        }
        return send({ status: 200, body: { data: { id: p.id, version: p.foot.version, published_at: now } } });
      }
      case "discard": {
        if (!p || !p.draft) return send(err(409, "E-KNW-030"));
        const gone = p.state === "draft";
        p.draft = null;
        if (gone) {
          mk.pages.delete(p.id);
          if (!removeNode(mk.tree.company_nodes, p.id)) removeNode(mk.tree.my_nodes, p.id);
        }
        return send({ status: 200, body: { data: { id: p.id, page_deleted: gone } } });
      }
      case "move": {
        if (!p) return send(err(404, "E-PAGE-001"));
        const node = removeNode(mk.tree.company_nodes, p.id) ?? removeNode(mk.tree.my_nodes, p.id);
        const to = raw["folder_id"] as string | null | undefined;
        if (node) home(p.place.shelf, p.place.group_id ?? undefined, to).push(node);
        p.place = {
          ...p.place,
          folder_id: to ?? null,
          folders: to ? [findFolder(shelfNodes(p.place.shelf), to)?.name ?? ""] : [],
        };
        return send({
          status: 200,
          body: { data: { id: p.id, title: p.title, desc: p.desc, state: p.state, must: p.must, place: p.place } },
        });
      }
      case "delete": {
        if (!p) return send(err(404, "E-PAGE-001"));
        mk.pages.delete(p.id);
        if (!removeNode(mk.tree.company_nodes, p.id)) removeNode(mk.tree.my_nodes, p.id);
        return send({ status: 200, body: { data: { id: p.id } } });
      }
    }
  });
  return mk;
}
