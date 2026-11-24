// 自分のAIとの会話の作り込み（D-104・D-105・T-B-15〜T-B-22・T-US-08）を実ブラウザで押して確かめる。テストの名前に正本の行 ID を持つ（op_gate.py）。
// Bridge は本物の輪（apps/bridge の loop）を回し、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）に差す。本人のサブスクは使わない。
// 画面 → API → Bridge → CLI → API → 画面 を全部通す（L-003：描画は動作ではない）
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { admin, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridge: AgentBridge | null = null;
test.afterEach(() => {
  bridge?.stop();
  bridge = null;
});

/** はじめの設定を通した人が、この PC をつないだ状態（Bridge の輪が回っている）で会話モードを開く */
async function ready(page: Page) {
  const u = await signupViaApi();
  bridge = await startAgentBridge(u.token);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 20_000 });
  return u;
}
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
const say = async (page: Page, text: string) => {
  await box(page).fill(text);
  await box(page).press("Enter");
};
/** 書き終わった返事（書きかけの吹き出しは含めない） */
const lastAi = (page: Page) => page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
const jobs = (memberId: string) =>
  admin<{
    id: string;
    state_id: string;
    permission_mode: string;
    agent_session_id: string | null;
    conversation_id: string | null;
    prompt: string;
  }>(
    "select id, state_id, permission_mode, agent_session_id, conversation_id, prompt from bridge_jobs where member_id = $1 order by created_at",
    [memberId],
  );

test("USH-08-014 USH-08-001 USH-08-002 CHT-16-002 CHT-16-003 CHT-16-004 CHT-16-001 まだ何も話していない会話はあいさつだけ。返事は書きながら出て、作業中は吹き出しの外に 1 行と手順と道具、終わると 1 行に畳まれる。書式・図・カードはモックの部品で描く", async ({
  page,
}) => {
  const u = await ready(page);
  await expect(page.locator("[data-greet]"), "あいさつだけ").toBeVisible();
  await expect(page.locator(".msg")).toHaveCount(0);
  await say(page, "今月の請求をまとめて");
  // 作業中：吹き出しの外の 1 行・手順・道具の行（D-104.8）
  await expect(page.locator("[data-working]")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".wsteps li.done")).toContainText("台帳を読む");
  // 道具の行は並べない。いまの動きは 1 行（D-111.1 が D-104.8 を改めた）
  await expect(page.locator(".wtool")).toHaveCount(0);
  await expect(page.locator(".chat")).toHaveAttribute("aria-busy", "true");
  // 書きながら出る（全部書き終わるまで空で待たせない）
  await expect(page.locator("[data-streaming] .bub")).toBeVisible({ timeout: 15_000 });
  const early = await page.locator("[data-streaming] .bub").innerText();
  expect(early, "書き始めの時点では、終わりの方はまだ無い").not.toContain("出典はこちら");
  // 終わると 1 行に畳まれる
  await expect(page.locator("[data-work-done]")).toContainText("1 つの操作", { timeout: 20_000 });
  await expect(page.locator("[data-working]")).toHaveCount(0);
  await expect(page.locator(".chat")).toHaveAttribute("aria-busy", "false");
  // 道具の行は対象・成否・時間まで。返り値の全文は Kaname に残らない（D-100.3）
  await page.locator("[data-work-done] summary").click();
  await expect(page.locator("[data-work-done] .wd")).toContainText("返り値の全文はあなたの PC に置いたまま");
  const ev = await admin<{ payload: Record<string, unknown> }>(
    "select payload from bridge_job_events e join bridge_jobs j on j.id = e.job_id where j.member_id = $1 and e.kind = 'tool'",
    [u.memberId],
  );
  expect(Object.keys(ev[0]!.payload).sort()).toEqual(["ms", "name", "ok", "target"]);
  // 書式（D-104.3〜D-104.6）
  const ai = lastAi(page);
  await expect(ai, "書き終わると全部が出る").toContainText("出典はこちら");
  await expect(ai.locator("h3.mh")).toContainText("9 月の請求のまとめ");
  await expect(ai.locator(".callout.warn")).toContainText("契約時に 3 割");
  await expect(ai.locator(".mtable td")).toContainText(["セイコー"]);
  await expect(ai.locator(".chk li.on")).toContainText("台帳を読む");
  await expect(ai.locator(".codeblk[data-lang='ts']")).toBeVisible();
  await expect(
    ai.locator(".codeblk [style*='--shiki-token']").first(),
    "コードは syntax のトークンで色分け",
  ).toBeVisible({ timeout: 10_000 });
  await expect(ai.locator("math").first(), "数式はブラウザの MathML").toBeVisible();
  await expect(ai.locator(".fchart svg"), "流れ図は使うときだけ読む mermaid").toBeVisible({ timeout: 15_000 });
  await expect(ai.locator("details.mdet")).toBeVisible();
  await expect(ai.locator("[data-entity]")).toContainText("タスク");
  await expect(ai.locator("sup.cn")).toHaveCount(1);
  await expect(ai.locator("ol.srcs")).toContainText("請求台帳");
  await expect(ai.locator("mark")).toContainText("印");
  await expect(ai.locator("kbd").first()).toContainText("Ctrl");
  // 見た目（D-104.2）：自分は淡い灰、AI は白い面＋罫線。名前の横はアイコンと名前
  const me = page.locator('.msg[data-who="me"] .bub').first();
  expect(await me.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(233, 236, 241)");
  expect(await ai.locator(".bub").evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("1px");
  await expect(ai.locator(".who")).toHaveText("自分のAI");
  // 表は並べ替えられる
  await ai.locator(".mtable th button").nth(1).click();
  await expect(ai.locator(".mtable tbody tr").first()).toContainText("京蟻");
});

test("CHT-17-001 CHT-17-002 CHT-17-003 CHT-17-005 動いている間に送った一言は順番待ちに並び（× で取り消せる）、次の区切りで同じ仕事に渡る。止めるを押すと理由だけで止まり、後から答えは出ない", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-working]")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-stop]"), "動いている間は送るボタンが止めるに変わる").toBeVisible();
  await say(page, "税込で");
  await say(page, "今のは無し");
  const q = page.locator("[data-queue]");
  await expect(q.locator("[data-queued='steer']")).toHaveCount(2, { timeout: 10_000 });
  await q.getByRole("button", { name: "「今のは無し」を取り消す" }).click();
  await expect(q.locator("[data-queued='steer']")).toHaveCount(1);
  // 区切りで渡る：答え → 自分の一言 → 次の答え の順（読む順＝起きた順）
  await expect(page.locator('.msg[data-who="me"]').last()).toContainText("税込で", { timeout: 30_000 });
  await expect(page.locator("[data-work-done]").last()).toBeVisible({ timeout: 30_000 });
  const order = await page
    .locator(".chat > .msg")
    .evaluateAll((els) =>
      els.map(
        (e) =>
          `${e.getAttribute("data-who")}:${(e.querySelector(".bub") as HTMLElement | null)?.innerText.slice(0, 8) ?? ""}`,
      ),
    );
  expect(order.slice(-4)).toEqual([
    "me:長く書いて",
    expect.stringMatching(/^ai:長い作業/),
    "me:税込で",
    expect.stringMatching(/^ai:/),
  ]);
  expect(order.join(" "), "取り消した一言は渡らない").not.toContain("今のは無し");
  expect(
    (await jobs(u.memberId)).map((j) => j.state_id),
    "同じ仕事の続きとして動いた",
  ).toEqual(["done"]);
  // 止める
  await say(page, "もう一度長く");
  await expect(page.locator("[data-working]")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-stop]").click();
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("あなたが止めました", { timeout: 15_000 });
  await page.waitForTimeout(3000);
  await expect(
    page.locator(".chat > .msg, .chat > [data-part='stopped']").last(),
    "止まりました が最後。後から答えは出ない",
  ).toHaveAttribute("data-part", "stopped");
  await expect(box(page), "入力欄は開いたまま").toBeEnabled();
});

test("CHT-19-005 CHT-19-001 CHT-19-002 自分のAI からの問い合わせに答えるとその答えで続きが動く。許可は 今回だけ／いつも／しない＋一言。いつも許可は一覧で取り消せる", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "請求書のこと聞いて");
  const qc = page.locator('[data-part="question"]');
  await expect(qc).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-working] .ws")).toHaveText("あなたの答えを待っています");
  await qc.getByRole("radio", { name: /9 月/ }).click();
  await qc.getByRole("button", { name: "次へ" }).click();
  await qc.getByRole("checkbox", { name: /提案書/ }).click();
  await qc.getByRole("checkbox", { name: /見積書/ }).click();
  await qc.getByRole("button", { name: "送る" }).click();
  await expect(lastAi(page)).toContainText("提案書、見積書", { timeout: 15_000 });
  await expect(lastAi(page)).toContainText("9 月");
  // 許可：しない＋一言は理由として渡る
  await say(page, "下書きを消して");
  const perm = page.locator('[data-part="ask"]');
  await expect(perm).toBeVisible({ timeout: 15_000 });
  await perm.getByRole("textbox", { name: "一言添える" }).fill("下書きは残して");
  await perm.getByRole("button", { name: "許可しない" }).click();
  await expect(lastAi(page)).toContainText("本人が許可しませんでした：下書きは残して", { timeout: 15_000 });
  // いつも許可 → 一覧に出る → 取り消すと次から聞かれる
  await say(page, "下書きを消して");
  await expect(perm).toBeVisible({ timeout: 15_000 });
  await perm.getByRole("button", { name: /いつも許可/ }).click();
  await expect(lastAi(page)).toContainText("消しました", { timeout: 15_000 });
  const audit = await admin<{ action: string }>(
    "select action from audit_events where actor_member_id = $1 and action like 'bridge.tool_%' and payload->>'tool' = 'Bash' order by created_at",
    [u.memberId],
  );
  expect(
    audit.map((a) => a.action),
    "答えは証跡に残る",
  ).toEqual(["bridge.tool_denied", "bridge.tool_allowed"]);
  await page.goto("/dev/ai-settings");
  const list = page.locator('[data-part="always-allow"]');
  await expect(list).toContainText("rm -rf 請求書/下書き", { timeout: 15_000 });
  await list.locator("[data-revoke]").click();
  await expect(list).toContainText("まだありません");
  const next = await admin<{ allowed: string[] }>(
    "select coalesce(array_agg(tool), '{}') as allowed from permission_rules where member_id = $1 and revoked_at is null",
    [u.memberId],
  );
  expect(next[0]!.allowed, "取り消すと次から聞かれる").toEqual([]);
});

test("USH-08-005 USH-08-016 モデルと考える強さは入力欄の右下の別々の小さなボタンで選べ、次に送った仕事の起動の引数（--model・--effort）になる。モデルは版まで入った名前を 1 行ずつ（Claude のデスクトップと同じ）", async ({
  page,
}) => {
  const u = await ready(page);
  const modelBtn = page.locator("[data-model]");
  const effortBtn = page.locator("[data-effort]");
  await modelBtn.click();
  const pop = page.getByRole("listbox", { name: "モデル" });
  await expect(pop).toBeVisible();
  const box = await pop.boundingBox();
  const comp = await page.locator('[data-part="composer"] .cbox').boundingBox();
  expect(box!.width, "入力欄の幅いっぱいに広げない（320px まで）").toBeLessThanOrEqual(321);
  expect(box!.width).toBeLessThan(comp!.width);
  // 版まで入った名前が 1 行ずつ。説明の 2 行目は出さない。いちばん上は PC の設定（何も選ばない）でチェック、ほかは数字
  await expect(pop.getByRole("option")).toHaveText([
    /^PC の設定/,
    /^Opus 5\.5\s*1$/,
    /^Fable 5\.1\s*2$/,
    /^Sonnet 5\.5\s*3$/,
    /^Haiku 4\.5\s*4$/,
  ]);
  const first = pop.getByRole("option").first();
  expect(await first.locator("b").evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  await expect(first.locator("svg"), "いま選んでいる（PC の設定）にチェック").toHaveCount(1);
  const h = await pop.getByRole("option").nth(1).boundingBox();
  expect(h!.height, "1 行（2 行目の説明を出さない）").toBeLessThanOrEqual(34);
  await pop.getByRole("option", { name: /^Sonnet 5\.5/ }).click();
  await expect(pop, "モデルを選んだら閉じる").toBeHidden();
  await expect(modelBtn, "選んだものがボタンに出る").toHaveText("Sonnet 5.5");
  // 数字のキーでも選べる（1＝Opus 5.5）
  await modelBtn.click();
  await expect(pop.getByRole("option", { name: /^Sonnet 5\.5/ })).toHaveAttribute("aria-selected", "true");
  await expect(pop.getByRole("option", { name: /^Sonnet 5\.5/ }).locator("svg"), "選んだものにチェック").toHaveCount(1);
  await page.keyboard.press("1");
  await expect(pop, "数字で選んだら閉じる").toBeHidden();
  await expect(modelBtn).toHaveText("Opus 5.5");
  await modelBtn.click();
  await page.keyboard.press("3");
  await expect(modelBtn).toHaveText("Sonnet 5.5");
  // 考える強さは別の小さなボタン（Claude の「中」「高」と同じ）
  await expect(effortBtn).toHaveText("既定");
  await effortBtn.click();
  const eff = page.getByRole("listbox", { name: "考える強さ" });
  await expect(eff.getByRole("option")).toHaveText(["PC の設定のまま", "低", "中", "高", "最高", "最大"]);
  await eff.getByRole("option", { name: "高", exact: true }).click();
  await expect(eff).toBeHidden();
  await expect(effortBtn).toHaveText("高");
  await effortBtn.click();
  await expect(eff.getByRole("option", { name: "高", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(eff, "Esc で閉じる").toBeHidden();
  await modelBtn.click();
  await page.locator(".chat").click({ position: { x: 20, y: 20 } });
  await expect(pop, "外を押すと閉じる").toBeHidden();
  // 許可のしかたは左（Claude のデスクトップと同じ並び）
  const perm = await page.getByRole("button", { name: /毎回聞く/ }).boundingBox();
  const mb = await modelBtn.boundingBox();
  expect(perm!.x, "許可のしかたはモデルより左").toBeLessThan(mb!.x);
  await say(page, "引数を見せて");
  await expect(lastAi(page)).toContainText("モデル=claude-sonnet-5-5 強さ=high", { timeout: 20_000 });
  const j = (
    await admin<{ model: string | null; effort: string | null }>(
      "select model, effort from bridge_jobs where member_id = $1 order by created_at desc limit 1",
      [u.memberId],
    )
  )[0]!;
  expect(j).toEqual({ model: "claude-sonnet-5-5", effort: "high" });
});

/** 箱の項目が、スクロールせずにその場で押せるか：項目の真ん中でいちばん上にあるのが項目そのもの（枠に切られていない・画面の外に出ていない） */
async function allHittable(page: Page, items: Locator) {
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const hit = await items.nth(i).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return "画面の外";
      const top = document.elementFromPoint(x, y);
      return top && (top === el || el.contains(top)) ? "ok" : `上にあるのは ${top?.className ?? "なし"}`;
    });
    expect(hit, `${await items.nth(i).innerText()} が押せる位置にある`).toBe("ok");
  }
}

test("USH-08-017 一覧の最後の行の「…」の箱も、入力欄の選ぶ箱も、枠に切られずその場で全部押せる（低い画面でも）", async ({
  page,
}) => {
  await ready(page);
  await say(page, "こんにちは");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  const list = page.locator('[data-part="conversation-list"]');
  const rows = list.locator("[data-conversation]");
  await expect(rows).toHaveCount(1);
  // 会話が 1 つだけ＝一覧の最後の行。その「…」の箱は一覧の枠の下に出る（2026-10-01 実例：枠に切られて半分しか見えなかった）
  await rows.first().getByRole("button", { name: "この会話の操作" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await allHittable(page, menu.getByRole("menuitem"));
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  // 低い画面でも、入力欄の選ぶ箱は切られずに全部押せる（上に入らなければ下へ・画面の端から内に収める）
  await page.setViewportSize({ width: 1280, height: 520 });
  for (const [btn, name] of [
    [page.locator("[data-model]"), "モデル"],
    [page.locator("[data-effort]"), "考える強さ"],
    [page.getByRole("button", { name: /毎回聞く/ }), "許可のモード"],
  ] as const) {
    await btn.click();
    const pop = page.getByRole("listbox", { name });
    await expect(pop).toBeVisible();
    await allHittable(page, pop.getByRole("option"));
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
  }
});

test("CHT-19-003 CHT-19-004 許可のモードは会話ごとに選べて仕事に乗る。全部許可は選ぶときに何が起きるかを出し、新しい会話には持ち越さない", async ({
  page,
}) => {
  const u = await ready(page);
  await page.getByRole("button", { name: /毎回聞く/ }).click();
  await page.getByRole("option", { name: /計画だけ/ }).click();
  await say(page, "進め方だけ教えて");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  expect((await jobs(u.memberId)).at(-1)!.permission_mode).toBe("plan");
  await page.getByRole("button", { name: /計画だけ/ }).click();
  await page.getByRole("option", { name: /全部許可/ }).click();
  await expect(page.locator(".cpop [role='alert']")).toContainText("外への送信・ファイルの削除も確かめません");
  await page.locator("[data-confirm-all]").click();
  await expect(page.getByRole("button", { name: /全部許可/ })).toBeVisible();
  await say(page, "全部やって");
  await expect.poll(async () => (await jobs(u.memberId)).length, { timeout: 15_000 }).toBe(2);
  expect((await jobs(u.memberId)).at(-1)!.permission_mode).toBe("bypassPermissions");
  await page.locator("[data-new-conversation]").click();
  await expect(page.getByRole("button", { name: /毎回聞く/ }), "新しい会話は既定に戻る").toBeVisible();
});

test("CHT-15-001 CHT-15-002 CHT-15-003 CHT-15-004 CHT-15-006 新しく話す＝新しいセッション。一覧から戻ると続きを話せる。名前は自動で付き、直すと残る。中身で探せる。消した会話の URL は「この会話はありません」", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "着手金の請求書を作って");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  const list = page.locator('[data-part="conversation-list"]');
  await expect(list).toContainText("着手金の請求書を作って");
  await page.locator("[data-new-conversation]").click();
  await expect(page.locator("[data-greet]")).toBeVisible();
  await say(page, "別の話");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  const convs = await admin<{ id: string; title: string; agent_session_id: string | null }>(
    "select id, title, agent_session_id from conversations where owner_member_id = $1 and deleted_at is null order by created_at",
    [u.memberId],
  );
  expect(convs.length).toBe(2);
  expect(convs[0]!.agent_session_id).not.toBe(convs[1]!.agent_session_id);
  const js = await jobs(u.memberId);
  expect(js[1]!.conversation_id).toBe(convs[1]!.id);
  // 一覧から戻る → 同じセッションで続き
  await list.getByRole("button", { name: /^着手金の請求書を作って/ }).click();
  await expect(page.locator('.msg[data-who="me"]').first()).toContainText("着手金の請求書を作って");
  await say(page, "続きをお願い");
  await expect.poll(async () => (await jobs(u.memberId)).length, { timeout: 15_000 }).toBe(3);
  await expect
    .poll(async () => (await jobs(u.memberId))[2]!.agent_session_id, { timeout: 15_000 })
    .toBe(convs[0]!.agent_session_id);
  // 名前を直す → 次に話しても自動で上書きしない
  // 操作は「…」のメニューにまとめてある（2026-09-30）。開いている会話の行には「…」が出たまま
  await list
    .locator('[data-conversation] [aria-current="page"]')
    .locator("..")
    .getByRole("button", { name: "この会話の操作" })
    .click();
  await list.getByRole("menuitem", { name: "名前を直す" }).click();
  await list.getByRole("textbox", { name: "会話の名前" }).fill("着手金の相談");
  await list.getByRole("textbox", { name: "会話の名前" }).press("Enter");
  await expect(list).toContainText("着手金の相談");
  await say(page, "もう一つ");
  await page.waitForTimeout(2000);
  await expect(list).toContainText("着手金の相談");
  // 中身で探す
  await list.getByRole("textbox", { name: "会話を探す" }).fill("消しました");
  await expect(list.locator("[data-conversation]")).toHaveCount(0);
  await list.getByRole("textbox", { name: "会話を探す" }).fill("契約時");
  await expect(list.locator("[data-conversation]").first(), "中身も当たり、当たった所が見える").toContainText("契約時");
  // 消す → URL で開くと「この会話はありません」
  await list.getByRole("textbox", { name: "会話を探す" }).fill("");
  await list.locator(`[data-conversation="${convs[1]!.id}"]`).getByRole("button", { name: "この会話の操作" }).click();
  await list.getByRole("menuitem", { name: "消す" }).click();
  // ブラウザの確認の箱ではなく、サイトの確かめの画面（2026-09-30）。やめる → 残る、消す → 消える
  const dlg = page.locator("dialog[data-confirm]");
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("を消しますか");
  // 画面のまん中に出る（2026-10-01 実例：土台の CSS が margin を 0 にして左上に出ていた）
  const db = (await dlg.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.abs(db.x + db.width / 2 - vp.width / 2), "横のまん中").toBeLessThanOrEqual(2);
  expect(Math.abs(db.y + db.height / 2 - vp.height / 2), "縦のまん中").toBeLessThanOrEqual(2);
  await dlg.locator("[data-confirm-cancel]").click();
  await expect(dlg).toBeHidden();
  await expect(list.locator(`[data-conversation="${convs[1]!.id}"]`)).toHaveCount(1);
  await list.locator(`[data-conversation="${convs[1]!.id}"]`).getByRole("button", { name: "この会話の操作" }).click();
  await list.getByRole("menuitem", { name: "消す" }).click();
  await dlg.locator("[data-confirm-ok]").click();
  await expect(list.locator(`[data-conversation="${convs[1]!.id}"]`)).toHaveCount(0);
  await page.goto(`/ai/chat?c=${convs[1]!.id}`);
  await expect(page.locator('[data-chat-state="missing"]')).toContainText("この会話はありません", { timeout: 15_000 });
  await page.locator("[data-missing-new]").click();
  await expect(page.locator('[data-part="conversation"]')).toBeVisible();
});

test("CHT-18-001 CHT-18-002 CHT-18-003 CHT-18-006 付けた資料は入力欄の上に並び外せる。送ると置き場から Bridge が受け取り、自分のAI が読める。長い文は添付になる。大きすぎるものは断る", async ({
  page,
}) => {
  await ready(page);
  const file = page.locator('input[type="file"]');
  await file.setInputFiles([
    { name: "台帳.csv", mimeType: "text/csv", buffer: Buffer.from("日付,金額\n9/1,1000\n") },
    { name: "いらない.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
  ]);
  await expect(page.locator("[data-att-state='ok']")).toHaveCount(2, { timeout: 15_000 });
  await page.getByRole("button", { name: "いらない.txtを外す" }).click();
  await expect(page.locator("[data-att-state]")).toHaveCount(1);
  await say(page, "この台帳を見て");
  await expect(lastAi(page)).toContainText("台帳.csv", { timeout: 20_000 });
  await expect(lastAi(page), "Bridge が置き場から取り、PC の置き場の場所で渡す").toContainText("kaname-");
  await expect(page.locator('.msg[data-who="me"]').last().locator(".cchip")).toContainText("台帳.csv");
  // 長い文を貼ると添付になる
  await box(page).focus();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "長".repeat(5000));
    document
      .querySelector("textarea")!
      .dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator("[data-att-state='ok']")).toContainText("貼り付けた文", { timeout: 15_000 });
  await expect(box(page)).toHaveValue("");
  // 大きすぎる（50MB を超える）
  const big = join(tmpdir(), `kaname-qa-${Date.now()}-でかい.bin`);
  writeFileSync(big, Buffer.alloc(51 * 1024 * 1024));
  await file.setInputFiles(big);
  // 札は赤く「（置けませんでした）」、理由は札の下の 1 行（返ってきた理由そのまま）。大きすぎるものは置き直しても同じなので「もう一度送る」は出さない
  await expect(page.locator("[data-att-state='error']")).toContainText("でかい.bin（置けませんでした）", {
    timeout: 30_000,
  });
  await expect(page.locator("[data-att-failed]")).toContainText("大きすぎます");
  await expect(page.locator("[data-att-retry]")).toHaveCount(0);
});

test("CHT-20-002 CHT-20-003 使用量は 5 時間の枠と週の枠の割合と戻る時刻が出る。8 割を越えると会話に案内が出る", async ({
  page,
}) => {
  await ready(page);
  await say(page, "上限の近い仕事");
  await expect(page.locator("[data-usage='near']")).toContainText("5 時間の枠が 92%", { timeout: 20_000 });
  await page.goto("/dev/ai-settings");
  const usage = page.locator('[data-part="usage"]');
  await expect(usage).toContainText("5 時間の枠", { timeout: 15_000 });
  await expect(usage).toContainText("92%");
  await expect(usage).toContainText("1 週間の枠");
  await expect(usage).toContainText("に戻ります");
});

test("CHT-21-005 「覚えて」と言うと、朝を待たずその場で個人の記憶に入り、会話に「覚えました」が出る", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "見積は税抜で出すって覚えて");
  await expect(page.locator('[data-who="memo"]')).toContainText("覚えました：見積は税抜で出す", { timeout: 20_000 });
  await expect(lastAi(page), "印は返事から消える").not.toContainText("[[覚える");
  const m = await admin<{ body: string }>(
    "select body from memories where owner_member_id = $1 and deleted_at is null",
    [u.memberId],
  );
  expect(m.map((x) => x.body)).toEqual(["見積は税抜で出す"]);
});

test("USH-08-005 USH-08-006 USH-08-013 Shift+Enter は改行、変換を確定する Enter では送らない。書きかけは会話ごとに残り、空で ↑ は前に送った文。長すぎると残りが出る。会話は role=log で読める", async ({
  page,
}) => {
  await ready(page);
  await expect(page.getByRole("log", { name: "会話" })).toBeVisible();
  await box(page).fill("1 行目");
  await box(page).press("Shift+Enter");
  await box(page).pressSequentially("2 行目");
  await expect(box(page)).toHaveValue("1 行目\n2 行目");
  // 変換中の Enter（isComposing・Safari の keyCode 229）では送らない
  await page.evaluate(() => {
    const t = document.querySelector("textarea")!;
    t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }));
    t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(500);
  await expect(page.locator('.msg[data-who="me"]')).toHaveCount(0);
  await box(page).press("Enter");
  await expect(page.locator('.msg[data-who="me"]')).toContainText("2 行目");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  // 空で ↑ は前に送った文
  await box(page).press("ArrowUp");
  await expect(box(page)).toHaveValue("1 行目\n2 行目");
  // 書きかけは会話ごとに残る
  await box(page).fill("書きかけ A");
  await page.locator("[data-new-conversation]").click();
  await expect(box(page)).toHaveValue("");
  await page.locator('[data-part="conversation-list"] [data-conversation]').nth(1).getByRole("button").first().click();
  await expect(box(page)).toHaveValue("書きかけ A");
  // 長すぎると残りが出る
  await box(page).fill("字".repeat(19_000));
  await expect(page.locator(".ccount")).toContainText("残り 1,000 字");
  await box(page).fill("字".repeat(20_100));
  await expect(page.locator(".ccount")).toContainText("100 字多い");
  await expect(page.locator("[data-send]")).toBeDisabled();
});

test("USH-08-009 文脈はチップで見え、外すと自分のAI に渡らない。よく頼むことは押すとそのまま送る。引用して続ける・直して送り直す（新しい会話）・タスクにする", async ({
  page,
}) => {
  const u = await ready(page);
  await page.getByRole("button", { name: "今日やることを 3 つに絞って" }).click();
  await expect(page.locator('.msg[data-who="me"]')).toContainText("今日やることを 3 つに絞って");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  // 引用して続ける
  await lastAi(page).locator("p.mp").first().scrollIntoViewIfNeeded();
  await lastAi(page)
    .locator("p.mp")
    .first()
    .evaluate((p) => {
      p.scrollIntoView({ block: "center" });
      const r = document.createRange();
      const t = [...p.childNodes].find((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 3)!;
      r.setStart(t, 0);
      r.setEnd(t, 4);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
      p.closest(".chat")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
  await page.locator("[data-quote-pop]").getByRole("button", { name: "引用して続ける" }).click();
  await expect(page.locator(".cchip").first()).toContainText("「");
  await say(page, "ここを詳しく");
  await expect
    .poll(async () => (await jobs(u.memberId)).at(-1)?.prompt ?? "", { timeout: 15_000 })
    .toContain("あなたの返事のこの部分について");
  await expect(page.locator('.msg[data-who="me"]').last().locator(".qt")).toBeVisible();
  // タスクにする
  await lastAi(page).locator("[data-to-task]").click();
  await expect(page.getByText("タスクにしました")).toBeVisible({ timeout: 15_000 });
  expect(
    (await admin<{ n: number }>("select count(*)::int as n from tasks where tenant_id = $1", [u.tenantId]))[0]!.n,
  ).toBe(1);
  // 直して送り直す：その時点から新しい会話。元の会話は残る
  const before = (
    await admin<{ n: number }>("select count(*)::int as n from conversations where owner_member_id = $1", [u.memberId])
  )[0]!.n;
  await page.locator('.msg[data-who="me"]').first().getByRole("button", { name: "直して送り直す" }).click();
  await expect(page.locator(".cchip")).toContainText("直して送り直す");
  await box(page).fill("今日やることを 1 つに絞って");
  await box(page).press("Enter");
  await expect
    .poll(
      async () =>
        (
          await admin<{ n: number }>("select count(*)::int as n from conversations where owner_member_id = $1", [
            u.memberId,
          ])
        )[0]!.n,
      { timeout: 15_000 },
    )
    .toBe(before + 1);
});

test("USH-08-011 長い会話は上へ戻ると古い分を読み込み、読んでいる位置は動かない。上を読んでいる間に来た返事は勝手に下へ飛ばず「いちばん下へ」と件数。見ていない会話には印と件数", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "はじめ");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  const conv = (
    await admin<{ id: string }>("select id from conversations where owner_member_id = $1", [u.memberId])
  )[0]!.id;
  await admin(
    "insert into messages (tenant_id, conversation_id, body, kind, created_at) select $1, $2, '古い ' || g, 'ai', now() - interval '1 day' + g * interval '1 second' from generate_series(1, 250) g",
    [u.tenantId, conv],
  );
  await page.reload();
  await expect(page.locator(".chat > .msg")).toHaveCount(200, { timeout: 20_000 });
  await expect(page.locator("[data-older]")).toBeVisible();
  const anchor = page.locator(".chat > .msg").first();
  const anchorId = await anchor.getAttribute("data-id");
  // 読めなかったら 1 度だけ試して止まり、押すともう一度読む（見えている間に何度も呼ばない）
  let tries = 0;
  await page.route("**/agent/messages?*", (r) => (tries++, r.abort()));
  await page.locator("[data-older]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-older]")).toContainText("前のやりとりを読み込めませんでした", { timeout: 10_000 });
  await page.waitForTimeout(1500);
  expect(tries, "失敗しても勝手に読み直さない").toBe(1);
  await page.unroute("**/agent/messages?*");
  await page.locator("[data-older-retry]").click();
  await expect(page.locator(".chat > .msg")).toHaveCount(252, { timeout: 15_000 });
  await expect(page.locator("[data-older]"), "もう前は無い").toHaveCount(0);
  const box0 = await page.locator(`.chat > .msg[data-id="${anchorId}"]`).boundingBox();
  expect(box0!.y, "読んでいた所は画面の中に残る（上へ飛ばない）").toBeGreaterThan(-50);
  // 上を読んでいる間に返事が来ても下へ飛ばない
  // 幅 1024 以上は会話の固定枠の中の欄だけが動く（D-072.19）。その欄を上へ戻す（狭い幅はページごと）
  const top = () =>
    page.evaluate(() => {
      const c = document.querySelector("[data-chat-frame] .chat");
      return c ? c.scrollTop : window.scrollY;
    });
  await page.evaluate(() => {
    const c = document.querySelector("[data-chat-frame] .chat");
    if (c) c.scrollTop = 0;
    else window.scrollTo(0, 0);
  });
  // 過去を見ている間は、新しい返事が無くても「いちばん下へ」の矢印が出る（2026-09-30 user）
  await expect(page.locator("[data-to-bottom]")).toBeVisible();
  await expect(page.locator("[data-to-bottom]")).toHaveAttribute("aria-label", "いちばん下へ");
  await say(page, "新しい話");
  await expect(page.locator("[data-to-bottom]")).toContainText("新しい返事 1", { timeout: 20_000 });
  expect(await top(), "勝手に下へ飛ばない").toBeLessThan(200);
  await expect(page.locator("[data-to-bottom]"), "いちばん下へ は画面の中（入力欄のすぐ上）に出る").toBeInViewport();
  await page.locator("[data-to-bottom]").click();
  await expect(page.locator("[data-to-bottom]")).toHaveCount(0, { timeout: 10_000 });
  // 見ていない会話には印と件数
  await page.locator("[data-new-conversation]").click();
  await expect(page.locator("[data-greet]")).toBeVisible();
  await admin(
    "insert into messages (tenant_id, conversation_id, body, kind) values ($1, $2, '見ていない間の返事', 'ai')",
    [u.tenantId, conv],
  );
  await expect(page.locator(`[data-conversation="${conv}"]`)).toContainText("1", { timeout: 15_000 });
  await expect(page.locator(`[data-conversation="${conv}"] [aria-label="新しい返事 1"]`)).toBeVisible();
});

test("USH-08-007 マイクで話すと文字になり、直してから送れる（ブラウザの音声認識）", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRec {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(
          () => this.onresult?.({ results: [Object.assign([{ transcript: "声で書いた文" }], { isFinal: true })] }),
          200,
        );
      }
      stop() {
        setTimeout(() => this.onend?.(), 50);
      }
    }
    // 新しい Chromium には接頭辞なしの SpeechRecognition もある（画面はそちらを先に使う）。両方を差し替える
    Object.assign(window, { SpeechRecognition: FakeRec, webkitSpeechRecognition: FakeRec });
  });
  await ready(page);
  await page.getByRole("button", { name: "声で入力" }).click();
  await expect(page.locator(".rec")).toContainText("聞いています");
  await expect(box(page)).toHaveValue("声で書いた文", { timeout: 5_000 });
  await page.locator(".rec").getByRole("button", { name: "止める" }).click();
  await expect(page.locator(".rec")).toHaveCount(0);
  await box(page).fill("声で書いた文（直した）");
  await box(page).press("Enter");
  await expect(page.locator('.msg[data-who="me"]').last()).toContainText("直した");
});

test("USH-08-012 「終わった」と「許可が要る」は別々にオン・オフでき、見ていない間だけブラウザに知らせる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: string[]; __hidden: boolean; Notification: unknown };
    w.__notes = [];
    w.__hidden = false;
    Object.defineProperty(document, "hidden", { get: () => w.__hidden, configurable: true });
    class N {
      static permission = "granted";
      static requestPermission = async () => "granted";
      constructor(title: string) {
        w.__notes.push(title);
      }
    }
    w.Notification = N;
  });
  await ready(page);
  await page.goto("/dev/ai-settings");
  await page.locator('[data-notify="done"]').check();
  await expect(page.locator('[data-notify="ask"]')).not.toBeChecked();
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 15_000 });
  // 見ている間は知らせない
  await say(page, "ひとつ目");
  await expect(lastAi(page)).toBeVisible({ timeout: 20_000 });
  // 1 つ目の仕事が終わり切るまで待つ（返事が出た直後に隠すと、終わりの知らせが隠した後に届くことがある）
  await expect(page.locator("[data-working]")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __notes: string[] }).__notes)).toEqual([]);
  // 見ていない間に終わったら知らせる。許可が要る はオフなので知らせない
  await say(page, "下書きを消して");
  await page.evaluate(() => ((window as unknown as { __hidden: boolean }).__hidden = true));
  await expect.poll(async () => page.locator('[data-part="ask"]').count(), { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __notes: string[] }).__notes), "許可が要る はオフ").toEqual(
    [],
  );
  await page.evaluate(() => ((window as unknown as { __hidden: boolean }).__hidden = false));
  await page.locator('[data-part="ask"]').getByRole("button", { name: "今回だけ許可" }).click();
  await page.evaluate(() => ((window as unknown as { __hidden: boolean }).__hidden = true));
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __notes: string[] }).__notes), { timeout: 20_000 })
    .toEqual(["自分のAI が終わりました"]);
});

test("CHT-17-004 止まった会話に「続けて」と送ると、同じ続き（同じセッション）で動き出す", async ({ page }) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-stop]").click();
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("あなたが止めました", { timeout: 15_000 });
  await expect(page.locator("[data-part='stopped'] button"), "止まりました にボタンは置かない").toHaveCount(0);
  await say(page, "続けて");
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-work-done]").last()).toBeVisible({ timeout: 30_000 });
  const js = await jobs(u.memberId);
  expect(js.map((j) => j.state_id)).toEqual(["stopped", "done"]);
  expect(js[0]!.agent_session_id, "止めた仕事にも続きの id がある").toBeTruthy();
  expect(js[1]!.agent_session_id, "同じセッションの続きとして動いた").toBe(js[0]!.agent_session_id);
  expect(js[1]!.conversation_id).toBe(js[0]!.conversation_id);
});

test("CHT-16-005 途中まで書いていても、完了の知らせが無いまま終わったら「止まりました」。途中の文は答えにしない", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "途中で落ちてみて");
  await expect(page.locator("[data-streaming]")).toContainText("途中まで書いた文です", { timeout: 15_000 });
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("Claude Code が途中で終わりました", {
    timeout: 20_000,
  });
  await expect(page.locator("[data-streaming]")).toHaveCount(0);
  await expect(page.locator('.msg[data-who="ai"]'), "途中の文は答えとして残らない").toHaveCount(0);
  const ai = await admin<{ n: number }>(
    "select count(*)::int as n from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1 and m.kind = 'ai'",
    [u.memberId],
  );
  expect(ai[0]!.n).toBe(0);
  expect((await jobs(u.memberId)).map((j) => j.state_id)).toEqual(["stopped"]);
});

test("CHT-17-006 PC が応答しないときは止めたことにしない（E-CHAT-003）", async ({ page }) => {
  const u = await ready(page);
  await say(page, "とても長く書いて");
  await expect(page.locator("[data-working]")).toBeVisible({ timeout: 15_000 });
  bridge!.stop();
  bridge = null;
  await admin(
    "update sessions set last_seen_at = now() - interval '10 minutes' where member_id = $1 and kind_id = 'bridge'",
    [u.memberId],
  );
  await expect(page.locator("[data-asleep]")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-stop]").click();
  await expect(page.locator("[data-say-error]")).toContainText(
    "止める合図を PC に届けられませんでした（PC が応答しません）。PC が起きたらすぐ止めます",
  );
  expect((await jobs(u.memberId)).at(-1)!.state_id, "止めたことにしない（止まった とは言わない）").toBe("running");
});

test("CHT-18-005 置き場に置けなかったら送ったことにせず、付けた一覧と文を残す（E-CHAT-002）", async ({ page }) => {
  await ready(page);
  const { chmodSync, mkdirSync } = await import("node:fs");
  const root = join(process.cwd(), "..", "..", ".dev-storage", "tenants");
  mkdirSync(root, { recursive: true });
  chmodSync(root, 0o555); // 置き場が書けない（会社ごとの置き場を作れない）
  try {
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "台帳.csv", mimeType: "text/csv", buffer: Buffer.from("a,b\n") });
    await expect(page.locator("[data-att-state='error']")).toContainText("台帳.csv（置けませんでした）", {
      timeout: 15_000,
    });
    await expect(page.locator("[data-att-failed]")).toContainText("資料を置けませんでした（保存先が応答しません）");
    await box(page).fill("これを見て");
    await expect(page.locator("[data-att-state='error']"), "付けた一覧は残る").toBeVisible();
    await expect(box(page), "文は残る").toHaveValue("これを見て");
  } finally {
    chmodSync(root, 0o755);
  }
});

test("CHT-20-004 上限に当たった仕事は、止まりました の理由にどの枠がいつ戻るかが出る（E-LIM-010）", async ({
  page,
}) => {
  await ready(page);
  await say(page, "枠切れの仕事");
  await expect(page.locator("[data-stopped-reason]")).toContainText("サブスクの 5 時間の枠に達しました", {
    timeout: 20_000,
  });
  await expect(page.locator("[data-stopped-reason]")).toContainText("に戻ります。それまで自分のAI は動けません");
  await expect(page.locator("[data-usage='limit']")).toContainText("5 時間の枠に達しました");
});
