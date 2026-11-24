// K-718「Bridge：AI に見せる道具 knowledge_open（ナレッジのページを開く）」の単体の試験。
//   行 ID は K718-BRG-NNN（チケット 11_tickets/K-718.md の表の行と 1 対 1）。API 側の道具（契約の口 callKanameTool の knowledge_open）は K-698。
//   道具のサーバー（kaname-tools.ts の MCP_SERVER_SOURCE）は素の node の台本で、Claude Code の子として動く。ここでは台本を実際に子として動かし、
//   tools/list と tools/call を JSON-RPC で確かめる（手元の口の向け先は偽のサーバー）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MCP_SERVER_SOURCE, TOOL_DEFS, toolDefsFor } from "../src/kaname-tools";
import { label } from "../src/stream";
import { startToolRelay } from "../src/tool-relay";

const TOKEN = "t".repeat(43);
const PC = `kpc_${"P".repeat(43)}`;
const JOB = "71871871-0000-4000-8000-000000000001";
const PAGE = "71871871-0000-4000-8000-0000000000aa";
type Hit = { path: string; headers: Record<string, string | string[] | undefined>; body: string };
let upstream: Server;
let hits: Hit[] = [];
let reply = { status: 201, body: JSON.stringify({ data: { result: { ok: true, page: { id: PAGE } } } }) };
let relay: Awaited<ReturnType<typeof startToolRelay>>;
let current: { jobId: string; toolToken: string; tools: string[] } | null = null;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      hits.push({ path: req.url ?? "", headers: req.headers, body: raw });
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(reply.body);
    });
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const a = upstream.address();
  relay = await startToolRelay({
    apiBase: `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`,
    deviceToken: () => PC,
    current: () => current,
  });
});
afterAll(async () => {
  await relay?.close();
  upstream.close();
});

/** 道具のサーバーの答え（JSON-RPC の 1 通）。試験が読む鍵だけ */
interface RpcReply {
  id: number;
  result: { tools: { name: string }[]; isError?: boolean; content?: unknown[] };
}

/** 道具のサーバーを子として動かし、JSON-RPC を 1 通ずつ送って答えを集める */
const rpc = async (kind: "ticket" | "chat", calls: object[]): Promise<RpcReply[]> => {
  const dir = mkdtempSync(join(tmpdir(), "k718-"));
  const file = join(dir, "server.js");
  writeFileSync(file, MCP_SERVER_SOURCE);
  const names = toolDefsFor(kind)
    .map((t) => t.name)
    .join(",");
  const child = spawn(process.execPath, [file], {
    env: { PATH: process.env["PATH"] ?? "", KANAME_API_BASE: relay.url, KANAME_TOOL_TOKEN: TOKEN, KANAME_TOOLS: names },
    stdio: ["pipe", "pipe", "ignore"],
  });
  const out: RpcReply[] = [];
  let buf = "";
  child.stdout.on("data", (c) => {
    buf += String(c);
    for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) out.push(JSON.parse(line));
    }
  });
  for (const c of calls) child.stdin.write(`${JSON.stringify(c)}\n`);
  await new Promise<void>((resolve) => {
    const t = setInterval(() => {
      if (out.length >= calls.filter((x) => "id" in x).length) {
        clearInterval(t);
        resolve();
      }
    }, 20);
    setTimeout(() => {
      clearInterval(t);
      resolve();
    }, 8000);
  });
  child.kill();
  return out;
};
const init = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
};

describe("K-718 道具 knowledge_open を AI に見せる", () => {
  it("K718-BRG-001 道具の定義：名前 knowledge_open・入力は page_id（文字・必須）だけ・説明に「ページの id を渡して開く」と使い方が書いてある", () => {
    const d = TOOL_DEFS.find((t) => t.name === "knowledge_open")!;
    expect(d).toBeDefined();
    expect(d.inputSchema).toMatchObject({ type: "object", required: ["page_id"] });
    expect(Object.keys((d.inputSchema as { properties: object }).properties)).toEqual(["page_id"]);
    expect(d.description).toContain("ページ");
    expect(d.description).toContain("id");
  });

  it("K718-BRG-002 仕事の種類で分ける：チケットの仕事は ticket_read と knowledge_open・会話の仕事は ticket_read 以外の全部（knowledge_open を含む）・ログインの試しは何も出さない", () => {
    expect(toolDefsFor("ticket").map((t) => t.name)).toEqual(["ticket_read", "knowledge_open"]);
    const chat = toolDefsFor("chat").map((t) => t.name);
    expect(chat).toContain("knowledge_open");
    expect(chat).not.toContain("ticket_read");
    expect(toolDefsFor("login_check")).toEqual([]);
    expect(toolDefsFor(null).map((t) => t.name)).toContain("knowledge_open");
  });

  it("K718-BRG-003 道具のサーバーの tools/list は、その仕事の道具の名前だけを返す（チケットの仕事に draft_read は出ない）", async () => {
    const r = await rpc("ticket", [init, { jsonrpc: "2.0", id: 2, method: "tools/list" }]);
    const list = r.find((x) => x["id"] === 2)!;
    expect(list["result"].tools.map((t: { name: string }) => t.name)).toEqual(["ticket_read", "knowledge_open"]);
  });

  it("K718-BRG-004 AI が knowledge_open を呼ぶと、手元の口へ page_id だけを送り、契約の口 …/tools/knowledge_open に PC の印と道具の鍵を足して回る。答えの文字がそのまま AI に返る", async () => {
    hits = [];
    reply = {
      status: 201,
      body: JSON.stringify({
        data: { result: { ok: true, page: { id: PAGE, title: "請求書の送り方", body_text: "月末に締める" } } },
      }),
    };
    current = { jobId: JOB, toolToken: TOKEN, tools: ["ticket_read", "knowledge_open"] };
    const r = await rpc("ticket", [
      init,
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "knowledge_open", arguments: { page_id: PAGE } } },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.path).toBe(`/api/v1/bridge/jobs/${JOB}/tools/knowledge_open`);
    expect(hits[0]!.headers["x-bridge-session"]).toBe(PC);
    expect(JSON.parse(hits[0]!.body)).toEqual({ input: { page_id: PAGE } });
    const text = JSON.stringify(r.find((x) => x["id"] === 3));
    expect(text).toContain("月末に締める");
    expect(text).not.toContain(PC);
  });

  it("K718-BRG-005 見えない・無いページ（契約の口が 404）は、AI に「見つかりません」と返す。ページの有無や理由は書かない", async () => {
    hits = [];
    reply = { status: 404, body: JSON.stringify({ error: "not_found", code: "NOT_FOUND" }) };
    current = { jobId: JOB, toolToken: TOKEN, tools: ["ticket_read", "knowledge_open"] };
    const r = await rpc("ticket", [
      init,
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "knowledge_open", arguments: { page_id: PAGE } } },
    ]);
    const res = r.find((x) => x["id"] === 4)!["result"];
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res)).toContain("見つかりません");
    expect(JSON.stringify(res)).not.toMatch(/権限|消され|下書き|別のグループ/);
  });

  it("K718-BRG-006 手元の口は今の仕事に無い道具を回さない：ログインの試し（道具なし）の鍵で knowledge_open は 403・契約の口に届かない", async () => {
    hits = [];
    current = { jobId: JOB, toolToken: TOKEN, tools: [] };
    const r = await fetch(`${relay.url}/tools/knowledge_open`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kaname-tool-token": TOKEN },
      body: JSON.stringify({ input: { page_id: PAGE } }),
    });
    expect(r.status).toBe(403);
    expect(hits).toHaveLength(0);
  });

  it("K718-BRG-007 進み具合の字：knowledge_open は「ナレッジを開いています」（内部の道具の名前を出さない）。前からの字は変わらない", () => {
    expect(label("mcp__kaname__knowledge_open")).toBe("ナレッジを開いています");
    expect(label("mcp__kaname__ticket_read")).toBe("チケットを読んでいます");
    expect(label("mcp__kaname__goal_set")).toBe("たたき台に目標を置いています");
    expect(label("mcp__kaname__knowledge_open")).not.toContain("knowledge_open");
  });

  it("K718-BRG-008 契約の口が落ちている（接続できない）ときは、AI にエラーを返し、道具のサーバーも手元の口も止まらない。ページの本文や id を道具のサーバーのログに出さない", async () => {
    hits = [];
    current = { jobId: JOB, toolToken: TOKEN, tools: ["ticket_read", "knowledge_open"] };
    reply = { status: 503, body: JSON.stringify({ error: "unavailable", code: "E-PAGE-003" }) };
    const r = await rpc("ticket", [
      init,
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "knowledge_open", arguments: { page_id: PAGE } } },
      { jsonrpc: "2.0", id: 6, method: "tools/list" },
    ]);
    expect(r.find((x) => x["id"] === 5)!["result"].isError).toBe(true);
    expect(r.find((x) => x["id"] === 6)!["result"].tools).toHaveLength(2);
    expect(MCP_SERVER_SOURCE).not.toContain("console.log");
  });
});
