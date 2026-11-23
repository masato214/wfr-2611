// Bridge の輪（loop）を、偽の Kaname（HTTP）と偽の CLI で通す（D-104.8・D-104.9・D-104.11・D-104.14）
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startLoop, toAnswer } from "../src/loop";
import { forgetClaude } from "../src/runner";

type Posted = { path: string; body: Record<string, unknown> };
let server: Server;
let base = "";
let posted: Posted[] = [];
let jobs: Record<string, unknown>[] = [];
// 仕事は、その回の輪の鍵（x-bridge-session）にだけ渡す。止めた古い輪の切れた問い合わせが、次の回の仕事を持っていかない
let sid = "";
let control: { stop: boolean; steer: { id: string; text: string }[] } = { stop: false, steer: [] };
let steers: { id: string; text: string }[] = [];
let answer: Record<string, unknown> | null = null;
// その口に最初に届いたら呼ぶ（時刻ではなく出来事を合図にする。重いときに順番がずれない）
let onPath: Record<string, () => void> = {};

beforeAll(async () => {
  process.env["KANAME_CLAUDE_BIN"] = join(__dirname, "fake-claude.mjs");
  forgetClaude();
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      // 仕事の 5 本（取る・様子・終わる・合図・道具）は契約の口（/api/v1/bridge/jobs/…・K-62）。前の道すじの名前に戻して数える
      //   （仕事の id は道すじから体の job_id に戻す。期待は前のまま）
      const url = req.url ?? "";
      const moved = /^\/api\/v1\/bridge\/jobs\/(?:take|([^/]+)\/(progress|finish|control))$/.exec(url);
      const path = moved ? `/bridge/${moved[2] ?? "take"}` : url.replace("/api/auth-ext", "").replace("/api/v1", "");
      const send = (data: unknown, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ data }));
      };
      if (path === "/files/a1") return res.end("日付,金額\n9/1,1000\n");
      const body = {
        ...(raw ? (JSON.parse(raw) as Record<string, unknown>) : {}),
        ...(moved?.[1] ? { job_id: moved[1] } : {}),
      };
      posted.push({ path, body });
      const hook = onPath[path];
      if (hook) {
        delete onPath[path];
        hook();
      }
      // 取る口の答えは契約の形（data.job・forbidden_domains・next_ms）
      if (path === "/bridge/take")
        return send(
          {
            job: req.headers["x-bridge-session"] === sid ? (jobs.shift() ?? null) : null,
            forbidden_domains: [],
            next_ms: 50,
            outdated: false,
          },
          201,
        );
      if (path === "/bridge/control") return send({ stop: control.stop });
      if (path === "/bridge/steers") {
        const s = steers;
        steers = [];
        return send({ steers: s });
      }
      if (path === "/bridge/answer2") return send({ answer });
      // 仕事に付いたファイルの署名 URL は契約の口 GET /api/v1/bridge/files/:ref?job_id=…（K-761）
      if (path.startsWith("/bridge/files/")) {
        const ref = path.slice("/bridge/files/".length).split("?")[0];
        return ref === "a1"
          ? send({ url: `${base}/api/auth-ext/files/a1`, name: "../../台帳.csv" })
          : res.writeHead(404).end("{}");
      }
      return send({ ok: true });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => {
  server.close();
  delete process.env["KANAME_CLAUDE_BIN"];
  forgetClaude();
});

const runOne = async (job: Record<string, unknown>, until: (p: Posted[]) => boolean) => {
  posted = [];
  jobs = [job];
  sid = crypto.randomUUID();
  const mine = sid;
  const stop = startLoop({
    apiBase: base,
    sessionId: () => mine,
    health: async () => ({}),
    onChange: () => undefined,
    onGone: () => undefined,
  });
  const t0 = Date.now();
  while (!until(posted) && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
  stop();
  onPath = {};
  return posted;
};
const kinds = (p: Posted[]) => p.filter((x) => x.path === "/bridge/progress").map((x) => x.body["kind"]);
const finished = (p: Posted[]) => p.some((x) => x.path === "/bridge/finish");

// 実時間で待つ試験（輪の見回りの間隔ぶん・runOne は最大 8 秒待つ）。重い CI でも既定の 5 秒で切られないように上限を伸ばす
describe("startLoop", { timeout: 20_000 }, () => {
  it("BRG-13-002 書きながらの返事・手順・何をしているか・使用量・使った量を送り、結末を返す（使った量は結末より先）。資料は置き場に取って文に添える", async () => {
    const p = await runOne(
      {
        job_id: "11111111-1111-1111-1111-111111111111",
        prompt: "請求書 ゆっくり",
        agent_session_id: null,
        conversation_id: "c",
        attachments: [
          { id: "a1", name: "台帳.csv", mime: "text/csv", size: 20 },
          { id: "a2", name: "無い.pdf", mime: "application/pdf", size: 5 },
        ],
      },
      finished,
    );
    expect(kinds(p)).toEqual(expect.arrayContaining(["init", "plan", "status", "limit", "tool", "usage"]));
    expect(p.find((x) => x.path === "/bridge/progress" && x.body["kind"] === "status")?.body["text"]).toBe(
      "読んでいます：/w/a.csv",
    );
    expect(p.some((x) => x.path === "/bridge/partial")).toBe(true);
    // 使った量（D-100.1）は結末より先に届く（結末の後は仕事が閉じて受け取られない）。道具の行は名前・対象・成否・時間だけ（D-100.2・D-100.3）
    const iUsage = p.findIndex((x) => x.path === "/bridge/progress" && x.body["kind"] === "usage");
    const iFinish = p.findIndex((x) => x.path === "/bridge/finish");
    expect(iUsage, "使った量が届く").toBeGreaterThanOrEqual(0);
    expect(iUsage, "結末より先").toBeLessThan(iFinish);
    const tool = p.find((x) => x.path === "/bridge/progress" && x.body["kind"] === "tool")!.body["tool"] as Record<
      string,
      unknown
    >;
    expect(Object.keys(tool).sort()).toEqual(["ms", "name", "ok", "target"]);
    expect(tool).toMatchObject({ name: "Read", target: "/w/a.csv", ok: true });
    const fin = p.find((x) => x.path === "/bridge/finish")!.body;
    expect(fin["state"]).toBe("done");
    // 置き場の外に出る名前は潰し、取れなかったものは理由つきで添える
    const dir = join(tmpdir(), "kaname-11111111-1111-1111-1111-111111111111");
    expect(String(fin["result"])).toBe(
      `答え:請求書 ゆっくり [${join(dir, "a1-台帳.csv")}|無い.pdf（取りに行けませんでした）]`,
    );
    expect(existsSync(dir)).toBe(false); // 終わったら片付ける
  });

  it("CHT-42-003 記録が無い会話の仕事は、新しいセッションでやり直して知らせ（notice）を 1 行流し、新しい id の init と結末を返す（D-124.3・E-NF-003）", async () => {
    const p = await runOne(
      {
        job_id: "44444444-4444-4444-4444-444444444444",
        prompt: "請求書",
        agent_session_id: "sess-lost",
        conversation_id: "c",
      },
      finished,
    );
    const notices = p
      .filter((x) => x.path === "/bridge/progress" && x.body["kind"] === "notice")
      .map((x) => x.body["text"]);
    expect(notices).toEqual([
      "前の会話の記録がこの PC に無かったので、新しい会話として続けます。これまでの内容は Kaname の写しに残っています",
    ]);
    const inits = p
      .filter((x) => x.path === "/bridge/progress" && x.body["kind"] === "init")
      .map((x) => x.body["agent_session_id"]);
    expect(inits, "新しい id が Kaname に入る（D-093.4）").toEqual(["sess-fake"]);
    expect(p.find((x) => x.path === "/bridge/finish")!.body).toMatchObject({
      state: "done",
      result: "答え:請求書",
      agent_session_id: "sess-fake",
    });
  });

  it("止めるの合図で、理由「あなたが止めました」を返す（D-104.9）", async () => {
    control = { stop: false, steer: [] };
    // 仕事が始まった（最初の進み具合が届いた）あとに止める合図を出す
    onPath["/bridge/progress"] = () => (control = { stop: true, steer: [] });
    const p = await runOne(
      { job_id: "22222222-2222-2222-2222-222222222222", prompt: "SLOW", agent_session_id: null, conversation_id: "c" },
      finished,
    );
    expect(p.find((x) => x.path === "/bridge/finish")!.body).toMatchObject({
      state: "stopped",
      reason: "あなたが止めました",
    });
    control = { stop: false, steer: [] };
  });

  it(
    "問い合わせの答えを取りに行き、順番待ちの一言は区切り（答えの後）で取りに行って渡す",
    { timeout: 20_000 },
    async () => {
      // 答える前に一言が順番待ちに入り、答えの後の区切りで Bridge が取りに行く
      answer = null;
      setTimeout(() => (steers = [{ id: "s1", text: "9 月で" }]), 100);
      // 答えは、Bridge が問い合わせを出したあとに入れる（一言は先に順番待ちに入っている）
      onPath["/bridge/ask"] = () =>
        setTimeout(() => (answer = { allow: true, scope: "once", note: null, answers: { "どの月？": "9 月" } }), 300);
      const p = await runOne(
        { job_id: "33333333-3333-3333-3333-333333333333", prompt: "ASK", agent_session_id: null, conversation_id: "c" },
        finished,
      );
      expect(p.some((x) => x.path === "/bridge/ask" && x.body["summary"] === "どの月？")).toBe(true);
      // 区切りの答えは、一言を取りに行く口に一緒に渡す（Kaname が 答え→一言 の順に吹き出しにする）
      const took = p.filter((x) => x.path === "/bridge/steers").map((x) => x.body["reply"]);
      expect(took[0]).toBe('選んだ:{"どの月？":"9 月"}');
      expect(p.find((x) => x.path === "/bridge/finish")!.body).toMatchObject({ state: "done", result: "答え:9 月で" });
      expect(p.filter((x) => x.path === "/bridge/steers").length, "区切りごとに 1 回ずつ見に行く").toBe(2);
      answer = null;
    },
  );
});

describe("toAnswer", () => {
  it("知らない形は許可しない。一言と答えは文字だけ拾う", () => {
    expect(toAnswer({})).toEqual({ allow: false, note: null, answers: null });
    expect(toAnswer({ allow: "true", note: "  ", answers: [] })).toEqual({ allow: false, note: null, answers: null });
    expect(toAnswer({ allow: true, note: " 本番はだめ ", answers: { a: "b", c: 1 } })).toEqual({
      allow: true,
      note: "本番はだめ",
      answers: { a: "b" },
    });
  });
});
