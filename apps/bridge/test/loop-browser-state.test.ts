// K-761「PC の側：ブラウザの様子を Kaname に送る（reportBrowserState・POST /api/v1/bridge/jobs/:id/browser）」の Bridge 側の単体の試験。
//   Kaname の代わりは手元の小さなサーバー（fake-kaname.ts）。呼び方と順番を見る。名前の頭の行 ID（K761-BR-…）は 11_tickets/K-761.md の表に結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { restoreClaude, runOneJob, startFakeKaname, useFakeClaude, type FakeKaname, type Seen } from "./fake-kaname";

const JOB = "11111111-1111-1111-1111-111111111111";
const BROWSER_PATH = `/api/v1/bridge/jobs/${JOB}/browser`;
let kaname: FakeKaname;
let mine = "";
let job: Record<string, unknown> | null = null;

beforeAll(async () => {
  useFakeClaude();
  kaname = await startFakeKaname({ job: () => (job ? { ...job } : null), mine: () => mine });
});
afterAll(async () => {
  await kaname.close();
  restoreClaude();
});

const run = async (j: Record<string, unknown>): Promise<Seen[]> => {
  kaname.seen.length = 0;
  job = j;
  mine = crypto.randomUUID();
  const seen = await runOneJob(kaname, mine, (p) => p.some((x) => x.path.endsWith("/finish")));
  job = null;
  return seen;
};
const reports = (p: Seen[]) => p.filter((x) => x.path === BROWSER_PATH).map((x) => x.body);
const base = { job_id: JOB, prompt: "開いて", agent_session_id: null, conversation_id: "c" };

describe("K-761 ブラウザの様子を送る（Bridge）", () => {
  it("K761-BR-001 Chrome を使う仕事：始めに { browser: chrome, state: using } を 1 回、PC の印つきで POST する。結末（finish）より前に届く", async () => {
    const p = await run({ ...base, browser: "chrome" });
    expect(reports(p)).toEqual([{ browser: "chrome", state: "using" }]);
    const i = p.findIndex((x) => x.path === BROWSER_PATH);
    expect(p[i]!.method).toBe("POST");
    expect(p[i]!.sid).toBe(mine);
    expect(i).toBeLessThan(p.findIndex((x) => x.path.endsWith("/finish")));
  });

  it("K761-BR-002 Chrome が使えなかった（拡張機能とつながっていない）：using の後に { browser: chrome, state: off } を 1 回だけ。会話に 1 行残す知らせ（notice）も今までどおり送る", async () => {
    const p = await run({ ...base, prompt: "CHROME_OFF 開いて", browser: "chrome", conventions: "FAKE_CHROME=failed" });
    expect(reports(p)).toEqual([
      { browser: "chrome", state: "using" },
      { browser: "chrome", state: "off" },
    ]);
    expect(p.findIndex((x) => x.path === BROWSER_PATH && x.body?.["state"] === "off")).toBeLessThan(
      p.findIndex((x) => x.path.endsWith("/finish")),
    );
    expect(p.some((x) => x.path.endsWith("/progress") && x.body?.["kind"] === "notice")).toBe(true);
  });

  it("K761-BR-003 ブラウザを使わない仕事（off・会話の無い仕事）：様子は送らない", async () => {
    const p = await run({ ...base, browser: "off" });
    expect(reports(p)).toEqual([]);
    const q = await run({ ...base, conversation_id: null, browser: null });
    expect(reports(q)).toEqual([]);
  });

  it("K761-BR-004 様子を送れなくても（Kaname が 503・届かない）仕事は続き、結末は返る（黙って落ちない・仕事を止めない）", async () => {
    kaname.seen.length = 0;
    job = { ...base, browser: "chrome" };
    mine = crypto.randomUUID();
    const down = await startFakeKaname({
      job: () => (job ? { ...job } : null),
      mine: () => mine,
      handler: (s) => (s.path === BROWSER_PATH ? { status: 503, data: { code: "E-PAGE-003" } } : undefined),
    });
    try {
      const p = await runOneJob(down, mine, (x) => x.some((y) => y.path.endsWith("/finish")));
      expect(p.some((x) => x.path === BROWSER_PATH)).toBe(true);
      expect(p.find((x) => x.path.endsWith("/finish"))!.body).toMatchObject({ state: "done" });
    } finally {
      job = null;
      await down.close();
    }
  });
});
