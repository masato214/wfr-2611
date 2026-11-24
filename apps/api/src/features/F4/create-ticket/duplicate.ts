// 複製する（K-438・A129・D-150.6）の口の材料。DB は呼ばない（純粋な関数だけ）。
//   複製は作る口 createTicket に duplicate_of・copy[] を足した物。hooks.ts が同じ取引で ①app.ticket_duplicate_read → ②app.ticket_create → ③app.ticket_duplicate_apply を順に呼ぶ。
//   ここは ① の答え（元の材料）と入力から、② に渡す体と ③ に渡す子の本文を組む。
//   写すと選んだ物は元から取り、入力の同じ欄は（元に中身がある限り）使わない。写さない物は入力のまま（K-437 の作り方）。
//   本文のチェックの箱を外す・text を作るのはここだけ（DB は text も箱の印も作らない・L-002）。期限と開始日は写さない（入力のまま）
import { toTicketBody, type Block, type Doc, type TicketBody } from "@kaname/contracts";
import { EMPTY_DOC } from "./payload.js";

/** 写せる物の名前（D-150.6）。添付（attachments）は段 5 では作らない（D-150.9）ので 422 */
export const COPY_NAMES = ["body", "assignee", "fields", "specs", "links", "children"] as const;
export type CopyName = (typeof COPY_NAMES)[number];
export const isCopyName = (v: unknown): v is CopyName => (COPY_NAMES as readonly unknown[]).includes(v);

/** ① app.ticket_duplicate_read の答え（ok のとき） */
export interface DuplicateRead {
  src: {
    assignee_member_id: string | null;
    priority: string;
    priority_reason: string | null;
    estimate_minutes: number | null;
  };
  body: { doc: unknown } | null;
  fields: Record<string, unknown>;
  children: { id: string; body: { doc: unknown } | null }[];
}

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);

/** 木の 1 つの節のチェックの箱を外した写し（入れ子も全部・ほかの印と字は触らない） */
function uncheckNode(n: unknown): unknown {
  if (!isNode(n)) return n;
  const out: Node = { ...n };
  if (n["type"] === "taskItem" && isNode(n["attrs"])) out["attrs"] = { ...n["attrs"], checked: false };
  if (Array.isArray(n["content"])) out["content"] = n["content"].map(uncheckNode);
  return out;
}

/** 本文の木のチェックの箱を外す（taskItem の attrs.checked を false に・ほかは触らない）。元の木は変えない */
export function uncheckDoc(doc: Doc): Doc {
  return { ...doc, content: doc.content.map((b) => uncheckNode(b) as Block) };
}

/** DB から読んだ doc を、箱を外した本文 { doc, text } にする。無ければ null */
const copiedBody = (b: { doc: unknown } | null): TicketBody | null =>
  b && isNode(b.doc) ? toTicketBody(uncheckDoc(b.doc as unknown as Doc)) : null;

export interface Duplicate {
  /** ② app.ticket_create に渡す体 */
  create: Record<string, unknown>;
  /** ③ app.ticket_duplicate_apply に渡す体 */
  apply: { source: string; copy: string[]; children: { id: string; body: TicketBody }[] };
}

/** 入力（checkCreate の value）と ① の材料から、② と ③ に渡す体を組む（入力は変えない） */
export function buildDuplicate(
  input: Record<string, unknown>,
  source: string,
  copy: readonly CopyName[],
  read: DuplicateRead,
): Duplicate {
  const has = (n: CopyName) => copy.includes(n);
  const create: Record<string, unknown> = { ...input };
  const body = has("body") ? copiedBody(read.body) : null;
  if (body) {
    delete create["sections"];
    create["body"] = body;
  }
  if (has("assignee") && read.src.assignee_member_id) create["assignee_member_id"] = read.src.assignee_member_id;
  if (has("fields")) {
    create["priority"] = read.src.priority;
    create["priority_reason"] = read.src.priority_reason;
    create["estimate_minutes"] = read.src.estimate_minutes;
    const own = (input["fields"] as Record<string, unknown> | undefined) ?? {};
    create["fields"] = { ...own, ...read.fields };
  }
  if (has("specs")) create["specs"] = [];
  const children = has("children")
    ? read.children.map((c) => ({ id: c.id, body: copiedBody(c.body) ?? toTicketBody(EMPTY_DOC) }))
    : [];
  return { create, apply: { source, copy: [...copy], children } };
}
