// K-943「段 13 の部品 3：利用者の側（困ったとき・お知らせ・問い合わせ・帯と全画面・請求書・プランを変える）の部品（features/F12/help・billing）と、
//   下絵の置き場 /dev/mock/f12-user（28 状態）を本線に入れる（K-72 の葉・W0）」の試験（実 Chrome と、ファイル・検査を読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f12-user（索引と 28 状態）。幅で出し分ける表・選ぶ欄の並び・試験の道具は K-941 が運んだ物を読む。
//   見ること：28 状態が全部描ける・幅 375／768／1440 で横のはみ出し 0・顧客の外枠に入る（運営の外枠を使わない）・書き出し・取引先の字が無い・
//   部品は口を呼ばない・デザインの検査（G37・G72）が緑。画面に出す字と並びは下絵が正。テストはチケットを作る人が書き、実装する人は変えない
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";
import {
  F12,
  FORBIDDEN,
  ROOT,
  dialogOf,
  entries,
  guard,
  mockDir,
  openState,
  overflowX,
  read,
  sources,
  strip,
} from "./f12-mock-kit";

const DIR = "f12-user" as const;
const MOCK = mockDir(DIR);
const PARTS = [join(F12, "help"), join(F12, "billing")];
/** 状態と持ち主の葉（切り方 1 章の画面の葉）。運ぶ（描く）のはこの葉 */
const OWNER: Readonly<Record<string, string>> = {
  "uh-help": "K-956",
  "uh-help-empty": "K-956",
  "uh-help-error": "K-956",
  "uh-notice": "K-956",
  "uh-ask": "K-953",
  "uh-ask-invalid": "K-953",
  "uh-ask-file": "K-953",
  "uh-ask-sent": "K-953",
  "uh-thread": "K-1007",
  "uh-thread-done": "K-1007",
  "uh-thread-notfound": "K-1007",
  "uh-band-incident": "K-957",
  "uh-band-maint": "K-957",
  "uh-maint": "K-957",
  "uh-down": "K-957",
  "uh-stopped": "K-1008",
  "uh-stop-soon": "K-1008",
  "uh-peek": "K-1008",
  "uh-peek-customer": "K-1008",
  "ub-bills": "K-960",
  "ub-bills-overdue": "K-960",
  "ub-bills-empty": "K-960",
  "ub-contact": "K-960",
  "ub-bills-noaccess": "K-960",
  "ub-plan": "K-962",
  "ub-plan-confirm": "K-962",
  "ub-plan-blocked": "K-962",
  "ub-price-change": "K-962",
};
const IDS = Object.keys(OWNER);
/** 画面いっぱいの形（外枠を持たない）：メンテ中・障害・止められた */
const FULL = ["uh-maint", "uh-down", "uh-stopped"];

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K943-MK-001 状態の一覧が 28 件で、持ち主は切り方 1 章の画面の葉（ticket と leaf は同じ K-番号・重なり 0）", () => {
  const rows = entries(DIR);
  const ids = rows.map((r) => r.id);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual([...IDS].sort());
  for (const r of rows) {
    expect(r.ticket, `${r.id} の持ち主`).toBe(OWNER[r.id]);
    expect(r.leaf, `${r.id} の leaf は ticket と同じ`).toBe(r.ticket);
  }
  expect(rows.length, "機械が読めない行がある").toBe([...read(join(MOCK, "mocks.tsx")).matchAll(/\bid: "/g)].length);
});

test("K943-MK-002 画面の字に「取引先」「業務の型」「書き出」「エクスポート」「CSV」が 0 件（features/F12/help・billing・mock/f12-user の注を除く中身）", () => {
  for (const d of [...PARTS, MOCK])
    for (const f of sources(d)) expect(strip(read(f)), `${f} に出してはいけない字がある`).not.toMatch(FORBIDDEN);
});

test("K943-MK-003 部品は口を呼ばない（features/F12/help・billing の .tsx に fetch・/api/v1 が 0）", () => {
  for (const d of PARTS)
    for (const f of sources(d).filter((p) => p.endsWith(".tsx")))
      expect(strip(read(f)), `${f} が口を呼ぶ`).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1/);
});

test("K943-MK-004 一覧と描き手が分かれている：mocks.tsx は部品を読まず、render.tsx が 28 状態を 1 つずつ描き、知らない id は「まだありません」", () => {
  expect(strip(read(join(MOCK, "mocks.tsx"))), "一覧が部品を読んでいる").not.toMatch(
    /from "@\/features|from "\.\/render/,
  );
  const render = strip(read(join(MOCK, "render.tsx")));
  for (const id of IDS) expect(render, `${id} を描く所が無い`).toContain(`case "${id}"`);
  expect(render).toContain("この状態はまだありません");
  expect(read(join(MOCK, "[id]/page.tsx"))).toMatch(/from "\.\.\/render"/);
});

test("K943-MK-005 利用者の側は顧客の外枠（components/k の Shell）を使い、運営の部品（features/F12/ops・ops2）を読まない。表と選ぶ欄の並びは K-941 の shared から読む", () => {
  const render = strip(read(join(MOCK, "render.tsx")));
  expect(render).toMatch(/\bShell\b/);
  const all = [render, ...PARTS.flatMap((d) => sources(d).map((p) => strip(read(p))))].join("\n");
  expect(all, "運営の部品を読んでいる").not.toMatch(/features\/F12\/ops2?\//);
  expect(strip(read(join(F12, "billing/views.tsx")))).toMatch(/from "@\/features\/F12\/shared\/resp-table"/);
  expect(strip(read(join(F12, "help/views.tsx")))).toMatch(/import "\.\.\/shared\/choice\.css"/);
});

test("K943-RT-001 道の一覧に /dev/mock/f12-user と /dev/mock/f12-user/:id が在る（機械生成 scripts/ci/gen_built_routes.py）", () => {
  expect(BUILT_ROUTES).toContain("/dev/mock/f12-user");
  expect(BUILT_ROUTES).toContain("/dev/mock/f12-user/:id");
});

test("K943-CG-001 画面の持ち主の検査（canvas_field_gate.py）が置き場の状態を読める形で読む（読めない・重複の語が出ない）", () => {
  const out = execFileSync("python3", ["scripts/ci/canvas_field_gate.py", "--no-base"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  expect(out).not.toMatch(/読めない|MOCKS の並びが無い|状態が 1 つも無い|が 2 つある/);
});

test("K943-DS-001 デザインの検査 G37（D1〜D7）が緑：features の色・書体・角丸・文字・部品の値が正本に在る", () => {
  const out = execFileSync(
    "python3",
    [
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
    ],
    { cwd: ROOT, encoding: "utf8", timeout: 300_000 },
  );
  expect(out).toMatch(/PASS/);
});

test("K943-DS-002 デザインの検査 G72（D8 生の長さ）で、F12 の help・billing と mock/f12-user に台帳に無い生の値が 0 件", () => {
  let out: string;
  try {
    out = execFileSync(
      "python3",
      [
        "scripts/ci/design_gate.py",
        "--design",
        "04_design/DESIGN-kaname.md",
        "--mocks",
        "apps/web/components/k",
        "apps/web/features",
        "--css",
        "apps/web/styles/k-tokens.css",
        "--part",
        "--no-components",
        "--raw-lengths",
        "--no-base",
      ],
      { cwd: ROOT, encoding: "utf8", timeout: 300_000 },
    );
  } catch (e) {
    // 出力を読むのは、検査が指摘を出して 0 でない値で終わったときだけ。python3 が無い・時間切れ・検査が出力なしで落ちたときは、0 件と数えずそのまま赤にする
    const x = e as { stdout?: unknown; status?: unknown };
    if (typeof x.status !== "number" || typeof x.stdout !== "string" || x.stdout.trim() === "") throw e;
    out = x.stdout;
  }
  const mine = out
    .split("\n")
    .filter((l) => /D8 apps\/web\/(features\/F12\/(help|billing)|app\/\(dev\)\/dev\/mock\/f12-user)\//.test(l));
  expect(mine, mine.join("\n")).toEqual([]);
});

// ---- 実ブラウザ ----

test("K943-UI-001 索引 /dev/mock/f12-user に 28 件が並び、どの状態も頁が開く（200・状態の入れ物が出る）", async ({
  page,
}) => {
  await guard(page);
  await page.goto("/dev/mock/f12-user");
  await expect(page.locator("main li a")).toHaveCount(28);
  for (const id of IDS) await openState(page, DIR, id, 1440);
});

// 行 ID：K943-UI-002・K943-UI-003・K943-UI-004
for (const [n, w] of [
  ["002", 375],
  ["003", 768],
  ["004", 1440],
] as const) {
  test(`K943-UI-${n} 28 状態が幅 ${w} で開き、横のはみ出しが 0`, async ({ page }) => {
    await guard(page);
    for (const id of IDS) {
      await openState(page, DIR, id, w);
      expect(await overflowX(page), `${id} が幅 ${w} で横にはみ出す`).toBeLessThanOrEqual(0);
    }
  });
}

test("K943-UI-005 暗いテーマでも 28 状態が幅 375 で開き、横にはみ出さない", async ({ page, context }) => {
  await guard(page);
  await context.addCookies([{ name: "k-theme", value: "dark", domain: "127.0.0.1", path: "/" }]);
  for (const id of IDS) {
    await openState(page, DIR, id, 375);
    expect(await overflowX(page), `${id} が暗いテーマで横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K943-UI-006 28 状態のどれを開いても、口（/api/）を 1 回も呼ばず、本人の Bridge にも届かない", async ({
  page,
}) => {
  const calls = await guard(page);
  let bridge = 0;
  page.on("request", (r) => {
    if (/127\.0\.0\.1:38617/.test(r.url())) bridge += 1;
  });
  for (const id of IDS) await openState(page, DIR, id, 1440);
  expect(calls).toEqual([]);
  expect(bridge).toBe(0);
});

test("K943-UI-007 困ったとき・お知らせ（uh-help）：見出しと 3 つの区画（お知らせ・いまの稼働状況・自分の問い合わせ）が出て、まだ読んでいないお知らせに印。画面いっぱいの 3 つのほかは運営の外枠を使わない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-help", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "困ったとき・お知らせ", exact: true })).toBeVisible();
  for (const h of ["お知らせ", "いまの稼働状況", "自分の問い合わせ"])
    await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "まだ読んでいません", exact: true }).first()).toBeVisible();
  for (const id of IDS.filter((i) => !FULL.includes(i))) {
    await openState(page, DIR, id, 1440);
    await expect(page.locator(".k-op-shell"), id).toHaveCount(0);
  }
});

test("K943-UI-008 はじめ（uh-help-empty）は「まだお知らせも問い合わせもありません」、読めなかった（uh-help-error）は E-PAGE-007", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-help-empty", 1440);
  await expect(page.getByText("まだお知らせも問い合わせもありません", { exact: true })).toBeVisible();
  await openState(page, DIR, "uh-help-error", 1440);
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-007"]')).toBeVisible();
});

test("K943-UI-009 問い合わせる小窓（uh-ask）の題は「問い合わせる」。題・内容が空のまま送った（uh-ask-invalid）は「題を書いてください」「内容を書いてください」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-ask", 1440);
  await expect(dialogOf(page, "問い合わせる")).toBeVisible();
  await openState(page, DIR, "uh-ask-invalid", 1440);
  const dlg = dialogOf(page, "問い合わせる");
  await expect(dlg.getByText("題を書いてください", { exact: true })).toBeVisible();
  await expect(dlg.getByText("内容を書いてください", { exact: true })).toBeVisible();
});

test("K943-UI-010 ファイルが大きすぎた（uh-ask-file）：付けたファイルの一覧に、断った 1 つの「大きすぎて付けられません（1 つ 10MB まで・5 つまで）」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-ask-file", 1440);
  const files = page.getByRole("list", { name: "付けたファイル", exact: true });
  await expect(files.getByRole("listitem")).toHaveCount(2);
  await expect(files.getByRole("alert")).toHaveText("大きすぎて付けられません（1 つ 10MB まで・5 つまで）");
});

test("K943-UI-011 問い合わせ 1 件（uh-thread）は見出しと「やり取り」、済み（uh-thread-done）は「済みにしました」と「もう一度聞く」、見つからない（uh-thread-notfound）は E-PAGE-001", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-thread", 1440);
  await expect(
    page.getByRole("heading", { level: 1, name: "PC をつけているのに実行待ちのまま", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "やり取り", exact: true })).toBeVisible();
  await openState(page, DIR, "uh-thread-done", 1440);
  await expect(page.getByText("済みにしました", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "もう一度聞く", exact: true })).toBeVisible();
  await openState(page, DIR, "uh-thread-notfound", 1440);
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-001"]')).toBeVisible();
});

test("K943-UI-012 帯：障害（uh-band-incident）は「障害 ・ 分身の実行が遅れています…」、メンテの予定（uh-band-maint）は「メンテナンスの予定 ・ …」、止める日（uh-stop-soon）は「11/29 にこのワークスペースを止めます」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-band-incident", 1440);
  await expect(page.getByText(/^障害 ・ 分身の実行が遅れています/).first()).toBeVisible();
  await openState(page, DIR, "uh-band-maint", 1440);
  await expect(page.getByText(/^メンテナンスの予定 ・ /).first()).toBeVisible();
  await openState(page, DIR, "uh-stop-soon", 1440);
  await expect(page.getByText("11/29 にこのワークスペースを止めます", { exact: true })).toBeVisible();
});

test("K943-UI-013 画面いっぱいの 3 つ：メンテ中は「いまメンテナンス中です」・障害は「Kaname の調子が悪くなっています」・止められたは「このワークスペースは止められています」と押せる物は「問い合わせる」だけ", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-maint", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "いまメンテナンス中です", exact: true })).toBeVisible();
  await openState(page, DIR, "uh-down", 1440);
  await expect(
    page.getByRole("heading", { level: 1, name: "Kaname の調子が悪くなっています", exact: true }),
  ).toBeVisible();
  await openState(page, DIR, "uh-stopped", 1440);
  await expect(
    page.getByRole("heading", { level: 1, name: "このワークスペースは止められています", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".k-state-actions").getByRole("button")).toHaveText(["問い合わせる"]);
});

test("K943-UI-014 運営が中を見ている間（uh-peek）：顧客の画面の上に「運営として見ています」の帯と「残り 52 分」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "uh-peek", 1440);
  const bar = page.locator(".k-uh-peek-bar");
  await expect(bar.getByText("運営として見ています", { exact: true })).toBeVisible();
  await expect(bar.getByText("残り 52 分", { exact: true })).toBeVisible();
});

test("K943-UI-015 請求書（ub-bills）：見出し「請求書」で、幅 1440 は表・幅 375 は組（D-156.14）。期限を過ぎた（ub-bills-overdue）は「期限を過ぎた請求があります」、無料（ub-bills-empty）は「まだ請求書がありません」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "ub-bills", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "請求書", exact: true })).toBeVisible();
  await expect(page.locator(".k-f12-rt-table").first()).toBeVisible();
  await openState(page, DIR, "ub-bills", 375);
  await expect(page.locator(".k-f12-rt-cards").first()).toBeVisible();
  await expect(page.locator(".k-f12-rt-table").first()).toBeHidden();
  await openState(page, DIR, "ub-bills-overdue", 1440);
  await expect(page.getByText("期限を過ぎた請求があります", { exact: true })).toBeVisible();
  await openState(page, DIR, "ub-bills-empty", 1440);
  await expect(page.getByText("まだ請求書がありません", { exact: true })).toBeVisible();
});

test("K943-UI-016 請求先を変える小窓（ub-contact）の題は「請求先を変える」。権限が無い人（ub-bills-noaccess）は E-PAGE-002", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "ub-contact", 1440);
  await expect(dialogOf(page, "請求先を変える")).toBeVisible();
  await openState(page, DIR, "ub-bills-noaccess", 1440);
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-002"]')).toBeVisible();
});

test("K943-UI-017 プランを変える小窓（ub-plan）は題「プランを変える」と 3 つのプラン、上げる確かめ（ub-plan-confirm）は「ビジネス に上げる」、下げられない（ub-plan-blocked）は「このプランには下げられません」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "ub-plan", 1440);
  const dlg = dialogOf(page, "プランを変える");
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("list", { name: "プラン", exact: true }).getByRole("listitem")).toHaveCount(3);
  await openState(page, DIR, "ub-plan-confirm", 1440);
  await expect(dialogOf(page, "ビジネス に上げる")).toBeVisible();
  await openState(page, DIR, "ub-plan-blocked", 1440);
  await expect(dialogOf(page, "このプランには下げられません")).toBeVisible();
});

test("K943-UI-018 値段が変わるお知らせ（ub-price-change）：設定の区画「プランと支払い」に、変わる月の 1 行が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "ub-price-change", 1440);
  await expect(page.getByRole("heading", { name: "プランと支払い", exact: true })).toBeVisible();
  await expect(page.getByText(/2027 年 2 月分から ¥18,000/).first()).toBeVisible();
});

test("K943-UI-019 28 状態のどこにも「書き出す」のボタン・リンクが無い（押せない形でも出さない・D-156.13）", async ({
  page,
}) => {
  await guard(page);
  for (const id of IDS) {
    await openState(page, DIR, id, 1440);
    await expect(page.getByRole("button", { name: /書き出/ }), id).toHaveCount(0);
    await expect(page.getByRole("link", { name: /書き出/ }), id).toHaveCount(0);
  }
});
