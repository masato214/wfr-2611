// 「Kaname の代わり」の手元の小さなサーバーと、Bridge の輪（startLoop）を 1 つの仕事だけ回す道具（K-761 が持ち込む。K-760 が使う）。
//   呼ばれた道すじ・向き・体を全部貯める。答えは試験が決める（既定は 200 { data: { ok: true } }）。本物の網には出ない（127.0.0.1）。
//   偽の CLI は fake-claude.mjs（KANAME_CLAUDE_BIN）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { startLoop } from "../src/loop";
import { forgetClaude } from "../src/runner";

export interface Seen {
  method: string;
  /** 道すじ（/api/v1/… か /api/auth-ext/…・問い合わせを含む） */
  path: string;
  sid: string | null;
  body: Record<string, unknown> | null;
}
export interface Reply {
  status?: number;
  data?: unknown;
}
export type Handler = (s: Seen) => Reply | undefined;

export interface FakeKaname {
  base: string;
  seen: Seen[];
  close: () => Promise<void>;
}

/** 偽の Kaname を立てる。take は仕事を 1 つだけ（その輪の鍵にだけ）渡す。handler が返した答えが優先 */
export async function startFakeKaname(opts: {
  job: () => Record<string, unknown> | null;
  mine: () => string;
  handler?: Handler;
}): Promise<FakeKaname> {
  const seen: Seen[] = [];
  // 同じ PC の鍵に同じ仕事は 1 回だけ渡す（本物の Kaname は受け取られた仕事を 2 度渡さない。何度も渡すと、輪が結末の直後に同じ仕事を回し直す）
  const handed = new Set<string>();
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const s: Seen = {
        method: req.method ?? "",
        path: req.url ?? "",
        sid: typeof req.headers["x-bridge-session"] === "string" ? req.headers["x-bridge-session"] : null,
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
      };
      seen.push(s);
      const send = (data: unknown, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ data }));
      };
      const custom = opts.handler?.(s);
      if (custom) return send(custom.data ?? { ok: true }, custom.status ?? 200);
      if (s.path === "/api/v1/bridge/jobs/take") {
        const j = s.sid === opts.mine() ? opts.job() : null;
        const key = j ? `${s.sid}:${String(j["job_id"])}` : "";
        const give = j && !handed.has(key) ? j : null;
        if (give) handed.add(key);
        return send(
          {
            job: give,
            forbidden_domains: [],
            next_ms: 50,
            outdated: false,
          },
          201,
        );
      }
      if (/^\/api\/v1\/bridge\/jobs\/[^/]+\/control$/.test(s.path)) return send({ stop: false });
      if (s.path === "/api/v1/bridge/mirror-targets") return send([]);
      return send({ ok: true }, s.method === "POST" ? 201 : 200);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  const base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  return { base, seen, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** 偽の CLI を使う設定（beforeAll で呼び、afterAll で restoreClaude） */
export function useFakeClaude(): void {
  process.env["KANAME_CLAUDE_BIN"] = join(__dirname, "fake-claude.mjs");
  forgetClaude();
}
export function restoreClaude(): void {
  delete process.env["KANAME_CLAUDE_BIN"];
  forgetClaude();
}

/** 仕事を 1 つ渡して輪を回し、until が真になる（最大 8 秒）まで待ってから止め、見た呼び出しを返す */
export async function runOneJob(
  kaname: { base: string; seen: Seen[] },
  mine: string,
  until: (seen: Seen[]) => boolean,
  deps: { browser?: () => "chrome" | "dedicated" | "off" } = {},
): Promise<Seen[]> {
  const stop = startLoop({
    apiBase: kaname.base,
    sessionId: () => mine,
    health: async () => ({}),
    onChange: () => undefined,
    onGone: () => undefined,
    ...deps,
  });
  const t0 = Date.now();
  while (!until(kaname.seen) && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
  stop();
  return kaname.seen;
}
