// K-382「段 7 の部品とモック（/dev/mock/f6 の 27 の状態。dec-no-section は K-1119 が足した）を本線に入れ、差し込み口の先に『まだ』の形の入れ物をつなぐ」の試験
//   （実 Chrome と、ファイルと検査の道具を読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f6（索引）と /dev/mock/f6/<状態>。モックは本番と同じ部品（features/F6/{progress,thread,decisions}/views.tsx・
//     詳細の部品 features/F4/create-ticket/detail-head.tsx・components/k）を決めた値で並べたもの（段 7 の下絵・代表の OK answer=fabd031f9b37）。
//   差し込み口の先（K-380 が置いた features/F6/detail-slots.tsx）は、区画ごとのファイルに配る：scope.tsx（DetailScope）・progress/slot.tsx（StageSlot・HoldBandSlot・ActualTimeSlot・EstimateSlot）・
//     decisions/slot.tsx（SectionSlot）・thread/panel.tsx（PanelTabsSlot・TitleSlot）・prefetch.ts（usePrefetchDetail・詳細の本体が詳細と同時に呼ぶ先読み。
//     中で thread/prefetch.ts の usePrefetchThread（K-392 が中身）と decisions/prefetch.ts の usePrefetchDecisions（K-397 が中身）を呼ぶ）。
//     この葉ではどれも「まだ」（中身をそのまま返すか null・先読みは何もしない）で、本番の詳細は今のまま。
//     後ろの画面の葉が直す入れ物 thread/composer.tsx・message-menu.tsx・from-message.tsx・composer-stage.tsx もこの葉が「まだ」（null を返す）で置く。
//   口は呼ばない（モックは網の手前で 599・本番の詳細は前からの土台で差し替える）。本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { isBuilt } from "../../lib/built-routes";
import { mockApi, openTicket } from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const MOCKS_SRC = join(WEB, "app/(dev)/dev/mock/f6/mocks.tsx");
const F6 = join(WEB, "features/F6");
const VIEWS = ["progress/views.tsx", "thread/views.tsx", "decisions/views.tsx"].map((f) => join(F6, f));
const CSS = ["progress/progress.css", "thread/thread.css", "decisions/decisions.css"].map((f) => join(F6, f));
const TITLE = "セイコー様へ 11 月分の請求書を送る";

/** 画面の葉と、その葉が本物にするモックの状態（11_tickets/K-382.md・K-392〜K-398.md・K-1119.md の頭の欄 mock: と同じ・27 個） */
const LEAVES: Record<string, readonly string[]> = {
  "K-382": ["prog-overview"],
  "K-395": [
    "prog-menu",
    "prog-hold-dialog",
    "prog-hold-band",
    "prog-locked",
    "prog-time",
    "prog-readonly",
    "prog-reopen",
    "prog-hold-reason",
  ],
  "K-392": ["talk-list", "talk-empty", "talk-loading-failed", "talk-narrow"],
  "K-393": ["talk-compose", "talk-send", "talk-cannot"],
  "K-394": ["talk-edit", "talk-delete"],
  "K-396": ["talk-compose-stage"],
  "K-397": ["dec-log", "dec-empty", "dec-add"],
  "K-398": ["dec-from-message", "dec-revise", "dec-cancel", "dec-conflict"],
  "K-1119": ["dec-no-section"],
};
const ALL = Object.values(LEAVES).flat();
const OWNER = new Map(Object.entries(LEAVES).flatMap(([k, ids]) => ids.map((id) => [id, k] as const)));
/** 段 7 の代表の答えの記録（決定ログの行が結ぶ） */
const ANSWERS = ["eaa451436670", "f5cd1647389f", "56812da22008", "fabd031f9b37"] as const;

const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const runPy = (args: string[]) =>
  execFileSync("python3", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });

/** mocks.tsx の MOCKS の 1 行（折った行も読む） */
function mockEntries(): { id: string; body: string }[] {
  const src = readFileSync(MOCKS_SRC, "utf8");
  const list = src.slice(src.indexOf("export const MOCKS"), src.indexOf("];", src.indexOf("export const MOCKS")));
  return [...list.matchAll(/\{[^{}]*?\bid:\s*"([^"]+)"[^{}]*?\}/g)].map((m) => ({ id: m[1]!, body: m[0] }));
}
const field = (body: string, k: string) => body.match(new RegExp(`\\b${k}:\\s*"([^"]*)"`))?.[1];

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}
async function openState(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/f6/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await expect(page.locator(".k-shell")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const topmostInside = (item: Locator) =>
  item.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && e.contains(hit);
  });

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K382-MK-001 モックの状態は 27 個で、画面の葉 9 本（K-382・K-392〜K-398・K-1119）が持つ状態の和とちょうど同じ（余りも欠けも重なりも 0）", () => {
  const ids = mockEntries().map((e) => e.id);
  expect(ids.length).toBe(27);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual([...ALL].sort());
});

test("K382-MK-002 各状態の持ち主（ticket）は K-<数> の字だけでその状態を本物にする画面の葉（口の葉 K-383〜K-391 と通し K-399 を指さない）・screen は tickets・製品の時点 ps は PS0 か PS2。仮の名前の欄 leaf と K-66 は残っていない", () => {
  const bad = mockEntries()
    .map((e) => ({
      id: e.id,
      t: field(e.body, "ticket"),
      s: field(e.body, "screen"),
      ps: field(e.body, "ps"),
      b: e.body,
    }))
    .filter(
      (e) =>
        !/^K-\d+$/.test(e.t ?? "") ||
        OWNER.get(e.id) !== e.t ||
        e.s !== "tickets" ||
        !["PS0", "PS2"].includes(e.ps ?? "") ||
        /\bleaf:/.test(e.b),
    )
    .map((e) => `${e.id}：${e.t}・${e.s}・${e.ps}（正は ${OWNER.get(e.id) ?? "無い"}）`);
  expect(bad, bad.join("\n")).toEqual([]);
  const src = noComments(readFileSync(MOCKS_SRC, "utf8"));
  expect(src).not.toMatch(/\bleaf\b|"K-66"|S7-[A-Z]\d/);
});

test('K382-MK-003 部品は見た目だけ：F6 の views.tsx 3 つは口を呼ばない（fetch・lib/api・useEffect・useRouter・lib/auth を使わない）・生の色や大きさを書かない。F6 の CSS 3 つは生の色と px を書かず var(--k-*) だけを読み、置き場（[role="presentation"]）を狙う避け方（K-381 が持つ）と頭の行の写し k-prog-meta-side（K-380 が持つ）を持たない', () => {
  for (const f of VIEWS) {
    const s = noComments(readFileSync(f, "utf8"));
    expect(s, f).not.toMatch(/\bfetch\(|lib\/api|useEffect|useRouter|from "@\/lib\/auth/);
    // 色は後ろを締める（飛び先の名前 #add-… のような字を色と見ない）
    expect(s, f).not.toMatch(/style=\{|#[0-9a-fA-F]{3,8}\b(?![-\w])|\d+px/);
  }
  for (const f of CSS) {
    // @media の区切りの px は数えない（正本の決まり「生の大きさは書かない（@media の区切りのほか）」と同じ）
    const css = noComments(readFileSync(f, "utf8")).replace(/@media[^{]*\{/g, "");
    expect(css, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![-\w])|rgba?\(|hsla?\(|\d+px/);
    expect(css, f).toMatch(/var\(--k-/);
    expect(css, f).not.toMatch(/\[role="presentation"\]|k-prog-meta-side/);
  }
  expect(readFileSync(MOCKS_SRC, "utf8")).not.toMatch(/k-prog-meta-side/);
});

test("K382-MK-004 写しの台本（07_functional/段7-F6/mock-shots.mjs）は app/(dev)/dev/mock/f6/mocks.tsx を読み、localhost の 3447 で 375・768・1440 を開く", () => {
  const s = readFileSync(join(ROOT, "07_functional/段7-F6/mock-shots.mjs"), "utf8");
  expect(s).toContain("app/(dev)/dev/mock/f6/mocks.tsx");
  expect(s).toMatch(/PORT = 3447/);
  expect(s).toMatch(/\[375, 768, 1440\]/);
});

test("K382-MK-005 置き場の道 /dev/mock/f6 と /dev/mock/f6/<状態> は作った道の一覧（built-routes.ts・作り手 gen_built_routes.py）に載っている", () => {
  expect(isBuilt("/dev/mock/f6")).toBe(true);
  expect(isBuilt("/dev/mock/f6/prog-overview")).toBe(true);
});

test("K382-SL-001 差し込み口の先 features/F6/detail-slots.tsx は区画ごとのファイル（scope.tsx・progress/slot.tsx・decisions/slot.tsx・thread/panel.tsx・prefetch.ts）から 9 つを読んで書き出す。prefetch.ts は thread/prefetch.ts の usePrefetchThread と decisions/prefetch.ts の usePrefetchDecisions を呼ぶ。入れ物 thread/composer.tsx（TalkComposer）・message-menu.tsx（MessageMenu）・from-message.tsx（FromMessageAction）・composer-stage.tsx（ComposerStage）が在る。どれもこの葉ではまだ口を呼ばない", () => {
  const slots = noComments(readFileSync(join(F6, "detail-slots.tsx"), "utf8"));
  const want: [string, string[]][] = [
    ["./scope", ["DetailScope"]],
    ["./progress/slot", ["StageSlot", "HoldBandSlot", "ActualTimeSlot", "EstimateSlot"]],
    ["./decisions/slot", ["SectionSlot"]],
    ["./thread/panel", ["PanelTabsSlot", "TitleSlot"]],
    ["./prefetch", ["usePrefetchDetail"]],
  ];
  const bad: string[] = [];
  for (const [from, names] of want) {
    const m = slots.match(new RegExp(`export\\s*\\{([^}]*)\\}\\s*from\\s*"${from.replace(/[./]/g, "\\$&")}"`));
    if (!m) {
      bad.push(`detail-slots.tsx が ${from} から書き出さない`);
      continue;
    }
    for (const n of names) if (!new RegExp(`\\b${n}\\b`).test(m[1]!)) bad.push(`${from} から ${n} を書き出さない`);
  }
  const holders: [string, string][] = [
    ["scope.tsx", "DetailScope"],
    ["progress/slot.tsx", "StageSlot"],
    ["decisions/slot.tsx", "SectionSlot"],
    ["thread/panel.tsx", "PanelTabsSlot"],
    ["thread/composer.tsx", "TalkComposer"],
    ["thread/message-menu.tsx", "MessageMenu"],
    ["thread/from-message.tsx", "FromMessageAction"],
    ["thread/composer-stage.tsx", "ComposerStage"],
  ];
  for (const [f, n] of holders) {
    const p = join(F6, f);
    if (!existsSync(p)) {
      bad.push(`${f} が無い`);
      continue;
    }
    const s = noComments(readFileSync(p, "utf8"));
    if (!new RegExp(`export function ${n}\\b`).test(s)) bad.push(`${f} が ${n} を書き出さない`);
    if (/\bfetch\(|lib\/api|useQuery|useMutation/.test(s)) bad.push(`${f} がまだ口を呼んでいる`);
  }
  // 先読みの入れ物 prefetch.ts（この葉が持つ・後ろの葉は触らない）は、区画ごとの先読みを 2 つ呼ぶだけ（自分では口を呼ばない）
  const prefetch = join(F6, "prefetch.ts");
  if (!existsSync(prefetch)) bad.push("prefetch.ts が無い");
  else {
    const s = noComments(readFileSync(prefetch, "utf8"));
    if (!/export function usePrefetchDetail\b/.test(s)) bad.push("prefetch.ts が usePrefetchDetail を書き出さない");
    for (const [n, from] of [
      ["usePrefetchThread", "./thread/prefetch"],
      ["usePrefetchDecisions", "./decisions/prefetch"],
    ] as const) {
      if (!new RegExp(`import\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from\\s*"${from.replace(/[./]/g, "\\$&")}"`).test(s))
        bad.push(`prefetch.ts が ${from} から ${n} を読まない`);
      if (!new RegExp(`\\b${n}\\(\\s*id\\s*,\\s*enabled\\s*\\)`).test(s))
        bad.push(`prefetch.ts が ${n}(id, enabled) を呼ばない`);
    }
    if (/\bfetch\(|lib\/api|useQuery|useMutation|prefetchQuery/.test(s)) bad.push("prefetch.ts が自分で口を呼んでいる");
  }
  // 区画ごとの先読み（K-392・K-397 が中身を作る・react-query で口を呼ぶのが正しい形）は、名前だけを見る（中身の字は見ない）
  for (const [f, n] of [
    ["thread/prefetch.ts", "usePrefetchThread"],
    ["decisions/prefetch.ts", "usePrefetchDecisions"],
  ] as const) {
    const p = join(F6, f);
    if (!existsSync(p)) bad.push(`${f} が無い`);
    else if (!new RegExp(`export function ${n}\\b`).test(noComments(readFileSync(p, "utf8"))))
      bad.push(`${f} が ${n} を書き出さない`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K382-DS-001 design_gate の D1〜D8（--part --scales --usage）が緑：段 7 の部品の CSS が正本の値だけを使う", () => {
  const out = runPy([
    "scripts/ci/design_gate.py",
    "--design",
    "04_design/DESIGN-kaname.md",
    "--mocks",
    "apps/web/components/k",
    "apps/web/features",
    "--css",
    "apps/web/styles/k-tokens.css",
    "--part",
    "--scales",
    "--usage",
    "apps/web",
    "apps/bridge/src",
  ]);
  expect(out).not.toMatch(/\bFAIL\b/);
});

test("K382-DC-001 決定ログ：段 7 の節 §149（D-149.1〜）の行が 07_functional/段7-F6/決定ログに足す行.md の行とちょうど同じで、代表の答え（answer=eaa451436670・f5cd1647389f・56812da22008・fabd031f9b37）がどれも決定の行と答えの記録に結ばれ、前に決めて訂正した枠の番号（D-147.60〜・仮の D-147.x7）が残っていない", () => {
  const log = readFileSync(join(ROOT, "01_hearing/決定ログ_進行中.md"), "utf8");
  const plan = readFileSync(join(ROOT, "07_functional/段7-F6/決定ログに足す行.md"), "utf8");
  expect(log).not.toMatch(/D-147\.x7|D-147\.(6\d|[7-9]\d)\b/);
  const d149 = (s: string) => s.split("\n").filter((l) => /^\| D-149\.\d+ \|/.test(l));
  const want = d149(plan);
  expect(want.length, "決定ログに足す行.md の D-149 の行").toBe(27);
  expect(want.map((l) => l.match(/D-149\.(\d+)/)![1])).toEqual(want.map((_, i) => String(i + 1)));
  expect(log).toMatch(/^## 149\. /m);
  expect(d149(log)).toEqual(want);
  const rows = log.split("\n").filter((l) => /^\| D-\d+(\.\d+)? \|/.test(l));
  const missing = ANSWERS.filter((a) => !rows.some((r) => r.includes(a)));
  expect(missing, `決定の行に結ばれていない答え：${missing.join("・")}`).toEqual([]);
  const answers = readFileSync(join(ROOT, "01_hearing/decider-answers.jsonl"), "utf8");
  const unrecorded = ANSWERS.filter((a) => !answers.includes(`"${a}"`));
  expect(unrecorded, `答えの記録に無い答え：${unrecorded.join("・")}`).toEqual([]);
});

// ---- 実ブラウザ：モックの全部の状態が描ける ----

test("K382-UI-001 索引 /dev/mock/f6：見出し tickets と 27 のリンクが出て、各リンクの先は /dev/mock/f6/<状態>", async ({
  page,
}) => {
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto("/dev/mock/f6");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 2, name: "tickets", exact: true })).toBeVisible();
  const hrefs = await page
    .locator('section[aria-label="tickets"] a')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.sort()).toEqual(ALL.map((id) => `/dev/mock/f6/${id}`).sort());
});

for (const [row, w] of [
  ["K382-UI-002", 375],
  ["K382-UI-003", 768],
  ["K382-UI-004", 1440],
] as const) {
  test(`${row} 幅 ${w}：27 の状態が 200 で開き、「この状態はありません」が無く、頁の h1 がちょうど 1 つで題名「${TITLE}」・横のはみ出し 0`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await guard(page);
    const bad: string[] = [];
    for (const id of ALL) {
      await openState(page, id, w);
      if ((await page.getByText("この状態はありません").count()) > 0) bad.push(`${id}：無い状態`);
      const h1 = page.locator("main h1");
      if ((await h1.count()) !== 1 || (await h1.first().innerText()).trim() !== TITLE)
        bad.push(`${id}：h1 が ${await h1.count()} 個`);
      const over = await overflowX(page);
      if (over !== 0) bad.push(`${id}：横のはみ出し ${over}`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("K382-UI-005 27 の状態（幅 1440）で pageerror と hydration の知らせが 0", async ({ page }) => {
  test.setTimeout(180_000);
  await guard(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text());
  });
  for (const id of ALL) await openState(page, id, 1440);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K382-UI-006 完了したチケットの書く欄（prog-reopen・talk-cannot・幅 1440）：知らせる人に最初から担当者と承認する人（鈴木・佐藤）が入る（代表の答え ⑨）", async ({
  page,
}) => {
  await guard(page);
  for (const id of ["prog-reopen", "talk-cannot"]) {
    await openState(page, id, 1440);
    const who = page.getByRole("list", { name: "知らせる人" }).locator("li.k-talk-notify-who");
    await expect(who, id).toHaveCount(2);
    await expect(who.nth(0), id).toContainText("鈴木");
    await expect(who.nth(1), id).toContainText("佐藤");
  }
});

test("K382-UI-007 段のメニュー（prog-menu・幅 1440 と 375）：開いた箱の項目は、題名・本文の道具の帯（上に貼り付く）に重なっても、項目の真ん中の点でいちばん上（重なりの順はメニューの型の置き場・K-381）", async ({
  page,
}) => {
  await guard(page);
  for (const w of [1440, 375]) {
    await openState(page, "prog-menu", w);
    const items = page.getByRole("menuitem");
    await expect(items.first()).toBeVisible();
    const n = await items.count();
    expect(n, `幅 ${w}：項目が無い`).toBeGreaterThan(0);
    for (let k = 0; k < n; k++) expect(await topmostInside(items.nth(k)), `幅 ${w}：項目 ${k} が下に潜る`).toBe(true);
  }
});

test("K382-UI-008 本番の詳細（/tickets/<id>・幅 1440・作業中）は差し込み口の先をつないでも今のまま：段の札「作業中」は押せる形でない・タブは 属性／やり取り／高本のAI（やり取りが押せるかは K-392 の試験が見る）・実績は空・題名の下に帯も「やり取り N」も無い", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const m = await mockApi(page, { stage: "doing" });
  const base = m.on.ticket;
  m.on.ticket = async (req) => {
    const r = await base(req);
    const d = (r.body as { data: Record<string, unknown> }).data;
    return { ...r, body: { data: Object.assign(d, { stage: { key: "doing", name: "作業中" } }) } };
  };
  await openTicket(page, 1440);
  const stage = page.locator('.k-detail-meta [data-part="stage"]');
  await expect(stage).toHaveText("作業中");
  expect(await stage.evaluate((e) => e.tagName)).toBe("SPAN");
  const tabs = page.getByRole("navigation", { name: "パネルのタブ" });
  await expect(tabs.getByRole("button")).toHaveText(["属性", "やり取り", "高本のAI"]);
  // やり取りのタブは在って名前が「やり取り」であることだけを見る（押せる形にするのは K-392・押せることは K392 の行と前からの K226-UI-008 が見る）
  await expect(tabs.getByRole("button", { name: "やり取り", exact: true })).toHaveCount(1);
  const actual = page
    .locator(".k-detail-field")
    .filter({ has: page.locator('dt:text-is("実績")') })
    .locator("dd");
  await expect(actual).toHaveText("");
  expect(await page.locator(".k-detail-bands").evaluate((e) => e.childElementCount)).toBe(0);
  await expect(page.locator(".k-talk-jump")).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});
