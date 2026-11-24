// K-675 ナレッジの口の置き場：契約の宣言（16 本・入力・答え・断り）・エラーの枠・口の振る舞いの置き場（ops・reply・shelf・body・shape）・試験の土台。
//   行 ID は K675-API-NNN（チケット 11_tickets/K-675.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   この葉は口の振る舞いを作らない。口の入口（契約の op）が、振る舞いの無い口を 501 で止めること・ログインの無い要求を 401 で止めることを、土台の入口で確かめる。
//   実装の本体のファイルは、試験の本体（it の中）で読む（実装の前の smoke で、まだ無いファイルを頭で読んで準備ごと落とさない・answer=8f745003d023）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { ENDPOINTS } from "@kaname/contracts";
import { SCHEMAS } from "@kaname/contracts/schemas";
import { HOOKS_DIR, setupKnowledge } from "./knowledge.harness.js";

const h = setupKnowledge();
const lib = {
  ops: () => import("../../../src/features/F9/knowledge/ops.js"),
  reply: () => import("../../../src/features/F9/knowledge/reply.js"),
  shelf: () => import("../../../src/features/F9/knowledge/shelf.js"),
  body: () => import("../../../src/features/F9/knowledge/body.js"),
  shape: () => import("../../../src/features/F9/knowledge/shape.js"),
  input: () => import("../../../src/features/F9/knowledge/input.js"),
};

/** K-675 が契約を宣言する 16 本（土台 2 章の表）：[操作 ID, 方法, 道, 成功, 入力の名前, 答えの名前, 一覧か, 権限の言葉, 道の uuid の名前] */
const LEAF_OPS = [
  ["getKnowledgeTree", "GET", "/api/v1/knowledge/tree", 200, null, "KnowledgeTree", false, "self", []],
  ["getKnowledgePage", "GET", "/api/v1/knowledge_pages/:id", 200, null, "KnowledgePageDetail", false, "read", ["id"]],
  [
    "listKnowledgeVersions",
    "GET",
    "/api/v1/knowledge_pages/:id/versions",
    200,
    null,
    "KnowledgeVersionItem",
    true,
    "read",
    ["id"],
  ],
  [
    "getKnowledgePageVersion",
    "GET",
    "/api/v1/knowledge_pages/:id/versions/:v",
    200,
    null,
    "KnowledgeVersion",
    false,
    "read",
    ["id"],
  ],
  [
    "createKnowledgeFolder",
    "POST",
    "/api/v1/knowledge/folders",
    201,
    "KnowledgeFolderCreateInput",
    "KnowledgeFolder",
    false,
    "write",
    [],
  ],
  [
    "updateKnowledgeFolder",
    "PATCH",
    "/api/v1/knowledge/folders/:id",
    200,
    "KnowledgeFolderUpdateInput",
    "KnowledgeFolder",
    false,
    "write",
    ["id"],
  ],
  [
    "deleteKnowledgeFolder",
    "DELETE",
    "/api/v1/knowledge/folders/:id",
    200,
    null,
    "KnowledgeFolderDeleted",
    false,
    "write",
    ["id"],
  ],
  [
    "createKnowledgePage",
    "POST",
    "/api/v1/knowledge_pages",
    201,
    "KnowledgePageCreateInput",
    "KnowledgePageStub",
    false,
    "write",
    [],
  ],
  [
    "saveKnowledgeDraft",
    "PATCH",
    "/api/v1/knowledge_pages/:id/draft",
    200,
    "KnowledgeDraftInput",
    "KnowledgeDraftSaved",
    false,
    "write",
    ["id"],
  ],
  [
    "discardKnowledgeDraft",
    "DELETE",
    "/api/v1/knowledge_pages/:id/draft",
    200,
    null,
    "KnowledgeDraftDiscarded",
    false,
    "write",
    ["id"],
  ],
  [
    "publishKnowledgePage",
    "POST",
    "/api/v1/knowledge_pages/:id/publish",
    200,
    "KnowledgePublishInput",
    "KnowledgePublished",
    false,
    "write",
    ["id"],
  ],
  [
    "updateKnowledgePage",
    "PATCH",
    "/api/v1/knowledge_pages/:id",
    200,
    "KnowledgePageMoveInput",
    "KnowledgePageStub",
    false,
    "write",
    ["id"],
  ],
  [
    "deleteKnowledgePage",
    "DELETE",
    "/api/v1/knowledge_pages/:id",
    200,
    null,
    "KnowledgePageDeleted",
    false,
    "write",
    ["id"],
  ],
  [
    "setKnowledgeMust",
    "PUT",
    "/api/v1/knowledge_pages/:id/must",
    200,
    "KnowledgeMustInput",
    "KnowledgeMustSet",
    false,
    "write",
    ["id"],
  ],
  [
    "findSimilarKnowledge",
    "POST",
    "/api/v1/knowledge/similar",
    200,
    "KnowledgeSimilarInput",
    "KnowledgeSimilar",
    false,
    "self",
    [],
  ],
  [
    "copyKnowledgePage",
    "POST",
    "/api/v1/knowledge_pages/:id/copy",
    201,
    "KnowledgeCopyInput",
    "KnowledgePageStub",
    false,
    "read",
    ["id"],
  ],
] as const;

const def = (op: string) => {
  const d = ENDPOINTS.find((e) => e.operationId === op);
  if (!d) throw new Error(`契約に無い口：${op}`);
  return d;
};
/** 口を叩く道（:id は正しい uuid・:v は 1） */
const pathOf = (p: string) => p.replace("/api/v1", "").replace(":id", randomUUID()).replace(":v", "1");
const hasBody = (m: string) => m === "POST" || m === "PATCH" || m === "PUT";

const U = randomUUID();
/** 入力の見本（これだけで通る最小の体） */
const VALID_INPUT: Record<string, unknown> = {
  KnowledgeFolderCreateInput: { shelf: "me", name: "メモ" },
  KnowledgeFolderUpdateInput: { name: "新しい名前" },
  KnowledgePageCreateInput: { shelf: "me", title: "題名" },
  KnowledgeDraftInput: { title: "題名" },
  KnowledgePublishInput: {},
  KnowledgePageMoveInput: { position: 0 },
  KnowledgeMustInput: { must: true },
  KnowledgeSimilarInput: { title: "題名" },
  KnowledgeCopyInput: {},
};
/** 口ごとの入力の見本（口の入力の確かめを通る最小の体） */
const VALID_BY_OP: Record<string, Record<string, unknown>> = {
  createKnowledgeFolder: { shelf: "me", name: "メモ" },
  updateKnowledgeFolder: { name: "新しい名前" },
  createKnowledgePage: { shelf: "me", title: "題名" },
  saveKnowledgeDraft: { title: "題名" },
  publishKnowledgePage: {},
  updateKnowledgePage: { position: 0 },
  setKnowledgeMust: { must: true },
  findSimilarKnowledge: { title: "題名" },
  copyKnowledgePage: {},
};
const PLACE = { shelf: "company", shelf_name: "会社", group_id: null, folder_id: null, folders: [] };
/** 答えの見本（土台 3 章の鍵） */
const SAMPLE_OUTPUT: Record<string, Record<string, unknown>> = {
  KnowledgeTree: {
    company_name: "会社",
    company_nodes: [],
    groups: [],
    my_nodes: [],
    can_write: { company: false, group_ids: [], me: true },
    admin_counts: null,
    truncated: false,
  },
  KnowledgePageDetail: {
    id: U,
    title: "題名",
    desc: "",
    state: "published",
    must: false,
    must_blocked: null,
    place: PLACE,
    acts: [],
    body: null,
    draft: null,
    request: null,
    copied_from: null,
    shared_from: null,
    raise_to: null,
    foot: { last_editor_name: null, last_edited_at: "2026-11-22T00:00:00Z", version: 1, ai_opened_30d: 0 },
  },
  KnowledgeVersionItem: { version: 1, published_at: "2026-11-22T00:00:00Z", by_name: null },
  KnowledgeVersion: { version: 1, published_at: "2026-11-22T00:00:00Z", by_name: null, body: {} },
  KnowledgeFolder: { id: U, name: "メモ", shelf: "me", group_id: null, parent_folder_id: null, position: 0 },
  KnowledgeFolderDeleted: { id: U },
  KnowledgePageStub: { id: U, title: "題名", desc: "", state: "draft", must: false, place: PLACE },
  KnowledgeDraftSaved: { saved_at: "2026-11-22T00:00:00Z", title: "題名", desc: "" },
  KnowledgeDraftDiscarded: { id: U, page_deleted: false },
  KnowledgePublished: { id: U, version: 1, published_at: "2026-11-22T00:00:00Z" },
  KnowledgePageDeleted: { id: U },
  KnowledgeMustSet: { id: U, must: true, used: 1, limit: 10 },
  KnowledgeSimilar: { pages: [] },
};
/** 断りの状態コード（口ごとに要る物）。読む口に 409 は無い */
const NEEDS: Record<string, number[]> = {
  getKnowledgePage: [404],
  listKnowledgeVersions: [404],
  getKnowledgePageVersion: [404],
  createKnowledgeFolder: [403, 404, 409, 422],
  updateKnowledgeFolder: [403, 404, 409, 422],
  deleteKnowledgeFolder: [403, 404, 409],
  createKnowledgePage: [403, 404, 422],
  saveKnowledgeDraft: [403, 404, 409, 422],
  discardKnowledgeDraft: [403, 404, 409],
  publishKnowledgePage: [403, 404, 409],
  updateKnowledgePage: [403, 404, 409, 422],
  deleteKnowledgePage: [403, 404, 409],
  setKnowledgeMust: [403, 404, 409],
  findSimilarKnowledge: [422],
  copyKnowledgePage: [404, 409],
};
/** K-675 が errors.d/K-675.json に書く番号（土台 4 章）と、後の葉の枠 */
const OWN_ERRORS = [10, 11, 12, 20, 21, 22, 23, 24, 30, 40, 41, 50, 51, 52, 60, 61, 80];
const LATER_FRAMES: [number, number][] = [
  [100, 139],
  [200, 249],
  [300, 329],
];
/** 25 本の口の持ち主と hooks のファイル（土台 2・5 章） */
const OWNERS: Record<string, [string, string]> = {
  getKnowledgeTree: ["K-676", "f9-knowledge-tree"],
  getKnowledgePage: ["K-677", "f9-knowledge-page-read"],
  listKnowledgeVersions: ["K-677", "f9-knowledge-page-read"],
  getKnowledgePageVersion: ["K-677", "f9-knowledge-page-read"],
  createKnowledgeFolder: ["K-678", "f9-knowledge-folders"],
  updateKnowledgeFolder: ["K-678", "f9-knowledge-folders"],
  deleteKnowledgeFolder: ["K-678", "f9-knowledge-folders"],
  createKnowledgePage: ["K-679", "f9-knowledge-draft"],
  saveKnowledgeDraft: ["K-679", "f9-knowledge-draft"],
  discardKnowledgeDraft: ["K-679", "f9-knowledge-draft"],
  publishKnowledgePage: ["K-680", "f9-knowledge-publish"],
  updateKnowledgePage: ["K-681", "f9-knowledge-page-edit"],
  deleteKnowledgePage: ["K-681", "f9-knowledge-page-edit"],
  setKnowledgeMust: ["K-685", "f9-knowledge-must"],
  findSimilarKnowledge: ["K-686", "f9-knowledge-similar"],
  requestKnowledgeRaise: ["K-687", "f9-knowledge-raise"],
  withdrawKnowledgeRequest: ["K-687", "f9-knowledge-raise"],
  dismissKnowledgeRequest: ["K-687", "f9-knowledge-raise"],
  listKnowledgeApprovals: ["K-688", "f9-knowledge-approvals"],
  approveKnowledgeRequest: ["K-688", "f9-knowledge-approvals"],
  declineKnowledgeRequest: ["K-688", "f9-knowledge-approvals"],
  getKnowledgeShares: ["K-689", "f9-knowledge-shares"],
  setKnowledgeShares: ["K-689", "f9-knowledge-shares"],
  copyKnowledgePage: ["K-690", "f9-knowledge-copy"],
  getKnowledgeReview: ["K-695", "f9-knowledge-review"],
};

describe("K-675 ナレッジの口の置き場", () => {
  it("K675-API-001 契約に 16 本が在り、方法・道・成功の状態・入力と答えの名前・権限の言葉・道の uuid・一覧かが土台の表のとおり。表の素の読み書きに落ちない", () => {
    for (const [op, method, path, success, input, output, isList, word, uuids] of LEAF_OPS) {
      const d = def(op);
      expect([d.method, d.path, d.success], op).toEqual([method, path, success]);
      expect(d.input, op).toBe(input);
      expect(d.output, op).toBe(output);
      expect(d.outputList, op).toBe(isList);
      expect(d.perm.word, op).toBe(word);
      expect(d.uuidParams, op).toEqual(uuids);
      expect(d.generic, `${op} は表の素の読み書きでなく振る舞いを持つ口`).toBe(false);
      expect(d.auth, op).toBe("member");
    }
  });

  it("K675-API-002 入力は strict：見本は通り、知らない欄を足すと断る（9 つ）", () => {
    for (const [name, ok] of Object.entries(VALID_INPUT)) {
      const s = SCHEMAS[name];
      expect(s, name).toBeDefined();
      expect(s!.safeParse(ok).success, `${name} の見本`).toBe(true);
      expect(s!.safeParse({ ...(ok as object), ticket_id: "x" }).success, `${name} に知らない欄`).toBe(false);
    }
  });

  it("K675-API-003 必須の欄と「1 つは要る」「グループの棚は group_id が要る」：口の入力の確かめ（input.ts）が欠けると 422 と欄の名前を返す", async () => {
    const { checkKnowledgeInput } = await lib.input();
    const field = (op: string, v: Record<string, unknown>) => {
      const r = checkKnowledgeInput(op, v);
      if (!r) return null;
      expect(r.status, `${op} ${JSON.stringify(v)}`).toBe(422);
      return ((r.body as { details: { field: string }[] }).details[0] ?? { field: "" }).field;
    };
    expect(field("createKnowledgeFolder", { shelf: "me" })).toBe("name");
    expect(field("createKnowledgeFolder", { name: "x" })).toBe("shelf");
    expect(field("createKnowledgeFolder", { shelf: "group", name: "x" })).toBe("group_id");
    expect(field("createKnowledgeFolder", { shelf: "group", group_id: randomUUID(), name: "x" })).toBeNull();
    expect(field("createKnowledgeFolder", { shelf: "company", name: "x", group_id: randomUUID() })).toBeNull(); // company・me は group_id を使わない（あっても通す）
    expect(field("createKnowledgePage", { shelf: "me" })).toBe("title");
    expect(field("createKnowledgePage", { title: "x" })).toBe("shelf");
    expect(field("createKnowledgeFolder", { shelf: "group", group_id: null, name: "x" })).toBe("group_id"); // グループの棚は group_id が null でも断る
    expect(field("createKnowledgePage", { shelf: "group", group_id: null, title: "x" })).toBe("group_id");
    expect(field("createKnowledgePage", { shelf: "group", title: "x" })).toBe("group_id");
    expect(field("setKnowledgeMust", {})).toBe("must");
    expect(field("findSimilarKnowledge", {})).toBe("title");
    for (const op of ["updateKnowledgeFolder", "saveKnowledgeDraft", "updateKnowledgePage"])
      expect(field(op, {}), `${op} は 1 つは要る`).toBe("body");
    for (const [op, ok] of Object.entries(VALID_BY_OP)) expect(field(op, ok), `${op} の見本`).toBeNull();
  });

  it("K675-API-004 値の形：名前 100 字・題名 200 字・1 行の説明 200 字・text 10,000 字の境目と、空白だけ・uuid でない・知らない棚・object でない doc を、口の入力の確かめ（input.ts）が 422 と欄の名前で断る", async () => {
    const { checkKnowledgeInput } = await lib.input();
    const field = (op: string, v: Record<string, unknown>) =>
      ((checkKnowledgeInput(op, v)?.body as { details?: { field: string }[] } | undefined)?.details ?? [])[0]?.field ??
      null;
    expect(field("createKnowledgeFolder", { shelf: "me", name: "あ".repeat(100) })).toBeNull();
    expect(field("createKnowledgeFolder", { shelf: "me", name: "あ".repeat(101) })).toBe("name");
    expect(field("createKnowledgeFolder", { shelf: "me", name: "   " })).toBe("name");
    expect(field("createKnowledgeFolder", { shelf: "dept", name: "x" })).toBe("shelf");
    expect(field("createKnowledgeFolder", { shelf: "group", group_id: "x", name: "x" })).toBe("group_id");
    expect(field("updateKnowledgeFolder", { parent_folder_id: null })).toBeNull();
    expect(field("updateKnowledgeFolder", { parent_folder_id: "x" })).toBe("parent_folder_id");
    expect(field("updateKnowledgeFolder", { position: -1 })).toBe("position");
    expect(field("createKnowledgePage", { shelf: "me", title: "あ".repeat(200) })).toBeNull();
    expect(field("createKnowledgePage", { shelf: "me", title: "あ".repeat(201) })).toBe("title");
    expect(field("createKnowledgePage", { shelf: "me", title: "x", desc: "あ".repeat(200) })).toBeNull();
    expect(field("createKnowledgePage", { shelf: "me", title: "x", desc: "あ".repeat(201) })).toBe("desc");
    expect(field("saveKnowledgeDraft", { doc: { type: "doc", content: [] } })).toBeNull();
    expect(field("saveKnowledgeDraft", { doc: "x" })).toBe("doc");
    expect(SCHEMAS["KnowledgeDraftInput"]!.safeParse({ doc: { type: "doc", content: [] }, text: "x" }).success).toBe(
      false,
    ); // text は画面から受けない（入口の strict）
    expect(field("findSimilarKnowledge", { title: "x", text: "あ".repeat(10_000) })).toBeNull();
    expect(field("findSimilarKnowledge", { title: "x", text: "あ".repeat(10_001) })).toBe("text");
    expect(field("findSimilarKnowledge", { title: "x", exclude_page_id: "x" })).toBe("exclude_page_id");
    expect(field("setKnowledgeMust", { must: "yes" })).toBe("must");
    expect(field("copyKnowledgePage", { folder_id: "x" })).toBe("folder_id");
    // 契約の値域（文字の欄の上限と「空白だけは断る」・棚・並び）を口ごとに全部：通る境目・断る境目・欄の名前
    const LIMITS: [string, Record<string, unknown>, string, number, boolean][] = [
      ["createKnowledgeFolder", { shelf: "me" }, "name", 100, true],
      ["updateKnowledgeFolder", {}, "name", 100, true],
      ["createKnowledgePage", { shelf: "me" }, "title", 200, true],
      ["createKnowledgePage", { shelf: "me", title: "x" }, "desc", 200, false],
      ["saveKnowledgeDraft", {}, "title", 200, true],
      ["saveKnowledgeDraft", {}, "desc", 200, false],
      ["findSimilarKnowledge", {}, "title", 200, true],
      ["findSimilarKnowledge", { title: "x" }, "desc", 200, false],
      ["findSimilarKnowledge", { title: "x" }, "text", 10_000, false],
    ];
    for (const [op, base, key, max, noBlank] of LIMITS) {
      expect(field(op, { ...base, [key]: "あ".repeat(max) }), `${op}.${key} ${max} 字`).toBeNull();
      expect(field(op, { ...base, [key]: "あ".repeat(max + 1) }), `${op}.${key} ${max + 1} 字`).toBe(key);
      if (noBlank) expect(field(op, { ...base, [key]: " \t　" }), `${op}.${key} 空白だけ`).toBe(key);
    }
    expect(field("createKnowledgePage", { shelf: "dept", title: "x" }), "ページの知らない棚").toBe("shelf");
    for (const op of ["updateKnowledgeFolder", "updateKnowledgePage"]) {
      expect(field(op, { position: 0 }), `${op} position 0`).toBeNull();
      expect(field(op, { position: -1 }), `${op} position -1`).toBe("position");
    }
    const r = checkKnowledgeInput("createKnowledgeFolder", { shelf: "me", name: "あ".repeat(101) });
    expect(r).toMatchObject({ status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR" } });
  });

  it("K675-API-005 答えの見本（土台 3 章の鍵）は契約の答えの形と鍵の集まりがちょうど同じで、見本は形に合い、鍵を 1 つ足すと合わない", () => {
    for (const [name, sample] of Object.entries(SAMPLE_OUTPUT)) {
      const s = SCHEMAS[name] as unknown as
        { shape: Record<string, unknown>; safeParse: (v: unknown) => { success: boolean } } | undefined;
      expect(s, name).toBeDefined();
      expect(Object.keys(s!.shape).sort(), `${name} の鍵（契約）`).toEqual(Object.keys(sample).sort());
      expect(s!.safeParse(sample).success, `${name} の見本`).toBe(true);
      expect(s!.safeParse({ ...sample, extra_key: 1 }).success, `${name} に知らない鍵`).toBe(false);
    }
  });

  it("K675-API-006 断りの状態コード：口ごとに 403・404・409・422 のうち要る物が契約に在り、読む口に 409 は無い", () => {
    for (const [op, needs] of Object.entries(NEEDS))
      for (const st of needs) expect(def(op).errors, `${op} に ${st}`).toContain(st);
    for (const op of ["getKnowledgePage", "listKnowledgeVersions", "getKnowledgePageVersion", "findSimilarKnowledge"])
      expect(def(op).errors, `${op} に 409 は無い`).not.toContain(409);
  });

  it("K675-API-007 断りの体の形：404 は {error, code} だけ・409 は {error, code} か {error, code, detail}（欄も details も無い）・422 は details を持つ", () => {
    const eps = JSON.parse(readFileSync("08_api/endpoints.json", "utf8")).endpoints as {
      operation_id: string;
      outputs_4xx: { status: number; code: string; body: Record<string, unknown> }[];
    }[];
    for (const [op] of LEAF_OPS) {
      const e = eps.find((x) => x.operation_id === op);
      expect(e, op).toBeDefined();
      for (const o of e!.outputs_4xx) {
        const keys = Object.keys(o.body).sort();
        if (o.status === 404) expect(keys, `${op} の 404`).toEqual(["code", "error"]);
        if (o.status === 409 && String(o.code).startsWith("E-KNW-"))
          expect(["code,error", "code,detail,error"], `${op} の 409 ${o.code}`).toContain(keys.join(","));
        if (o.status === 422) expect(keys, `${op} の 422`).toContain("details");
      }
    }
    const must = eps.find((x) => x.operation_id === "setKnowledgeMust")!;
    const full = must.outputs_4xx.find((o) => o.code === "E-KNW-060");
    expect(Object.keys(full!.body).sort(), "上限に届いた 409 は detail を持つ").toEqual(["code", "detail", "error"]);
  });

  it("K675-API-008 エラーの台帳：K-675 の枠の 17 件が conflict の class で文・やることつきで在り、E-KNW の番号は決めた枠の中だけ", () => {
    const errors = (
      JSON.parse(readFileSync("07_qa/test-specs/errors.json", "utf8")) as { errors: Record<string, unknown>[] }
    ).errors;
    const knw = errors.filter((e) => String(e["id"]).startsWith("E-KNW-"));
    const nums = knw.map((e) => Number(String(e["id"]).slice(6)));
    for (const n of OWN_ERRORS) {
      const e = knw.find((x) => Number(String(x["id"]).slice(6)) === n);
      expect(e, `E-KNW-${String(n).padStart(3, "0")}`).toBeDefined();
      expect(e!["class"]).toBe("conflict");
      expect(String(e!["message"]).length).toBeGreaterThan(5);
      expect(String(e!["action"]).length).toBeGreaterThan(0);
      expect(e!["must_not"]).toBe(false);
    }
    for (const n of nums)
      expect(OWN_ERRORS.includes(n) || LATER_FRAMES.some(([a, b]) => n >= a && n <= b), `E-KNW-${n} は枠の外`).toBe(
        true,
      );
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("K675-API-009 ログインしていない要求は、16 本とも 401（口の振る舞いに届かない）", async () => {
    for (const [op, method, path] of LEAF_OPS) {
      const r = await h.req(method, pathOf(path), hasBody(method) ? { body: {} } : {});
      expect(r.status, op).toBe(401);
    }
  });

  it("K675-API-010 口の振る舞いがまだ無い 16 本は、ログインしていても 501 NOT_IMPLEMENTED（表の素の読み書きに落ちない・何も書かない）", async () => {
    const co = await h.company("K675 501");
    const p = await h.person(co.tenantId, co.rootScope, { role: "admin" });
    for (const [op, method, path] of LEAF_OPS) {
      const r = await h.req(method, pathOf(path), { headers: h.as(p), ...(hasBody(method) ? { body: {} } : {}) });
      expect(r.status, op).toBe(501);
      expect((await h.json(r))["code"], op).toBe("NOT_IMPLEMENTED");
    }
    expect(
      Number(
        (await h.admin.query("select count(*) as n from knowledge_pages where tenant_id = $1", [co.tenantId])).rows[0]!
          .n,
      ),
    ).toBe(0);
  });

  it("K675-API-011 上限を超えると 429 と retry_after_sec（1〜60 の整数）", async () => {
    const co = await h.company("K675 429");
    const p = await h.person(co.tenantId, co.rootScope, { role: "admin" });
    h.limits["getKnowledgeTree"] = 2;
    const call = () => h.req("GET", "/knowledge/tree", { headers: h.as(p) });
    expect((await call()).status).toBe(501);
    expect((await call()).status).toBe(501);
    const r = await call();
    expect(r.status).toBe(429);
    const sec = (await h.json(r))["retry_after_sec"] as number;
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });

  it("K675-API-012 断りの答え（reply.ts）：404・403・409（番号・detail つき）・422・503 の体と、台帳に無い番号の 409 は作らない", async () => {
    const { notFound, forbidden, conflict, invalid, unavailable } = await lib.reply();
    expect(notFound()).toEqual({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
    expect(forbidden()).toEqual({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
    expect(conflict("E-KNW-010")).toEqual({ status: 409, body: { error: "conflict", code: "E-KNW-010" } });
    expect(conflict("E-KNW-060", { limit: 10 })).toEqual({
      status: 409,
      body: { error: "conflict", code: "E-KNW-060", detail: { limit: 10 } },
    });
    expect(invalid("name", "名前を入れてください")).toMatchObject({
      status: 422,
      body: {
        error: "validation_failed",
        code: "VALIDATION_ERROR",
        details: [{ field: "name", message: "名前を入れてください" }],
      },
    });
    expect(unavailable()).toEqual({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    expect(() => conflict("E-KNW-999")).toThrow();
  });

  it("K675-API-013 棚を決める（shelf.ts）：会社＝いちばん上のグループ・自分＝持ち主の主の所属で自分の棚", async () => {
    const { resolveShelf } = await lib.shelf();
    const co = await h.company("K675 棚 1");
    const g1 = await h.group(co.tenantId, co.rootScope, "営業");
    const mem = await h.person(co.tenantId, g1, { role: "member" });
    const at = (input: Record<string, unknown>) => withTenant(h.pool, mem.ctx, (c) => resolveShelf(c, input as never));
    expect(await at({ shelf: "company" })).toEqual({
      kind: "company",
      scopeId: co.rootScope,
      isPersonal: false,
      groupId: null,
    });
    expect(await at({ shelf: "me" })).toEqual({ kind: "me", scopeId: g1, isPersonal: true, groupId: null });
    expect(await at({ shelf: "company", group_id: randomUUID() })).toMatchObject({ kind: "company" });
  });

  it("K675-API-014 棚を決める（shelf.ts）：グループは入っている人だけ。入っていない・会社のいちばん上・無い id・別の会社のグループは null（口は 404）", async () => {
    const { resolveShelf } = await lib.shelf();
    const co = await h.company("K675 棚 2");
    const other = await h.company("K675 棚 3");
    const g1 = await h.group(co.tenantId, co.rootScope, "営業");
    const g2 = await h.group(co.tenantId, co.rootScope, "受託開発");
    const gx = await h.group(other.tenantId, other.rootScope, "別の会社のグループ");
    const mem = await h.person(co.tenantId, g1, { role: "member" });
    const at = (group_id: string) =>
      withTenant(h.pool, mem.ctx, (c) => resolveShelf(c, { shelf: "group", group_id } as never));
    expect(await at(g1)).toEqual({ kind: "group", scopeId: g1, isPersonal: false, groupId: g1 });
    expect(await at(g2)).toBeNull();
    expect(await at(co.rootScope)).toBeNull();
    expect(await at(randomUUID())).toBeNull();
    expect(await at(gx)).toBeNull();
  });

  it("K675-API-015 本文を確かめて text を作る（body.ts）：形の合う doc は {doc, text}（text は doc から口が作る）", async () => {
    const { parseDocInput } = await lib.body();
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "あいう" }] }] };
    const r = parseDocInput(doc);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.doc).toEqual(doc);
      expect(r.body.text).toContain("あいう");
    }
    expect(parseDocInput({ type: "doc", content: [] })).toMatchObject({ ok: true, body: { text: "" } });
  });

  it("K675-API-016 本文を確かめる（body.ts）：doc でない・知らない節・1MB を超える物は ok false で理由の文字を返す", async () => {
    const { parseDocInput } = await lib.body();
    const huge = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "あ".repeat(400_000) }] }],
    };
    for (const bad of [
      null,
      "x",
      [],
      {},
      { type: "x", content: [] },
      { type: "doc", content: [{ type: "unknown" }] },
      huge,
    ]) {
      const r = parseDocInput(bad);
      expect(r.ok, JSON.stringify(bad)?.slice(0, 40)).toBe(false);
      if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
    }
  });

  it("K675-API-017 必ず守るの本文の上限は TS の定数と DB の関数が同じ 2000", async () => {
    const { KNOWLEDGE_MUST_TEXT_MAX } = await lib.shape();
    const n = (await h.admin.query<{ n: number }>("select app.kn_must_text_max() as n")).rows[0]!.n;
    expect(KNOWLEDGE_MUST_TEXT_MAX).toBe(2000);
    expect(n).toBe(KNOWLEDGE_MUST_TEXT_MAX);
  });

  it("K675-API-018 答えの形の部品（shape.ts）：木の印の優先（承認待ち＞断られた＞下書き＞写し）・置き場の形・場所の字（› でつなぐ）", async () => {
    const { treeMark, toPlace, placeText } = await lib.shape();
    const none = { draft: false, waiting: false, declined: false, copied: false };
    expect(treeMark(none)).toBeNull();
    expect(treeMark({ ...none, copied: true })).toBe("copy");
    expect(treeMark({ ...none, copied: true, draft: true })).toBe("draft");
    expect(treeMark({ ...none, copied: true, draft: true, declined: true })).toBe("declined");
    expect(treeMark({ draft: true, waiting: true, declined: true, copied: true })).toBe("waiting");
    const g = randomUUID();
    const f = randomUUID();
    expect(toPlace("group", "営業", g, f, ["見積もり"])).toEqual({
      shelf: "group",
      shelf_name: "営業",
      group_id: g,
      folder_id: f,
      folders: ["見積もり"],
    });
    expect(toPlace("company", "会社", null, null, [])).toEqual({
      shelf: "company",
      shelf_name: "会社",
      group_id: null,
      folder_id: null,
      folders: [],
    });
    expect(placeText("営業", ["見積もり", "2026"])).toBe("営業 › 見積もり › 2026");
    expect(placeText("会社", [])).toBe("会社");
  });

  it("K675-API-019 口の持ち主の表（ops.ts）：25 本の口が土台の持ち主と hooks のファイルに結ばれている（ファイルの名前は f9-knowledge-…）", async () => {
    const { KNOWLEDGE_OPS } = await lib.ops();
    expect(Object.keys(KNOWLEDGE_OPS).sort()).toEqual(Object.keys(OWNERS).sort());
    for (const [op, [leaf, file]] of Object.entries(OWNERS)) {
      expect(KNOWLEDGE_OPS[op], op).toEqual({ leaf, file });
      expect(file).toMatch(/^f9-knowledge-[a-z-]+$/);
    }
  });

  it("K675-API-020 口の登録のファイル（f9-knowledge-*.ts）は、持ち主の表のとおりの口だけを持ち、同じ口を 2 つのファイルが持たない（入っている葉の分だけ見る）", async () => {
    await h.ready();
    const { KNOWLEDGE_OPS } = await lib.ops();
    const files = readdirSync(HOOKS_DIR).filter((n) => /^f9-knowledge-[a-z-]+\.ts$/.test(n));
    const seen = new Map<string, string>();
    for (const n of files) {
      const m = (await import(join(HOOKS_DIR, n))) as { register: { make: (d: unknown) => Record<string, unknown> } };
      for (const op of Object.keys(m.register.make({ appPool: h.pool, repo: h.repo, config: h.deps }))) {
        expect(KNOWLEDGE_OPS[op]?.file, `${n} の ${op}`).toBe(n.replace(/\.ts$/, ""));
        expect(seen.get(op), `${op} が 2 つのファイルに`).toBeUndefined();
        seen.set(op, n);
      }
    }
  });

  it("K675-API-021 共有の試験 k144 の葉のファイル：この葉は入口の uuid の行を持たない（k144.d に K-675.ts が無い）。道に :id を持つ 12 本の行は、その口を作る葉が自分の k144.d/K-<番号>.ts に持つ（作っていない口の行を置くと契約の形の検査 SHAPE-017 が赤）", () => {
    const files = readdirSync("apps/api/test/features/contract/k144.d");
    expect(files.length).toBeGreaterThan(0);
    expect(files).not.toContain("K-675.ts");
    expect(LEAF_OPS.filter((o) => o[8].length > 0).map((o) => o[0])).toHaveLength(12);
  });

  it("K675-API-022 行に結ぶ確かめ（perm.row）：ページの口は knowledge_pages（読むは true・書くは消した行を通す (deleted_at is not null or app.kpage_writable(id))）、フォルダの口は入口で行を読まない（口が決める）", () => {
    for (const op of ["getKnowledgePage", "listKnowledgeVersions", "getKnowledgePageVersion", "copyKnowledgePage"])
      expect(def(op).perm.row, op).toEqual({ table: "knowledge_pages", sql: "true" });
    for (const op of [
      "saveKnowledgeDraft",
      "discardKnowledgeDraft",
      "publishKnowledgePage",
      "updateKnowledgePage",
      "deleteKnowledgePage",
      "setKnowledgeMust",
    ])
      expect(def(op).perm.row, op).toEqual({
        table: "knowledge_pages",
        sql: "(deleted_at is not null or app.kpage_writable(id))",
      });
    for (const op of ["updateKnowledgeFolder", "deleteKnowledgeFolder"])
      expect(
        def(op).perm.row,
        `${op}（フォルダの行は口が kfolder_visible・kfolder_writable で 404・403 を決める）`,
      ).toBeNull();
    for (const op of ["getKnowledgeTree", "createKnowledgeFolder", "createKnowledgePage", "findSimilarKnowledge"])
      expect(def(op).perm.row, op).toBeNull();
  });
});
