// K-420「メンバーの画面（/members）と招くの小窓を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f8/inv-members・inv-dialog・inv-error・inv-link・inv-stepup・inv-sent（本番と同じ部品 features/F10/invite/views.tsx・代表 OK 2026-11-20）。
//   外枠は TicketShell（screen="members"）・頭は WsHead・第 2 ナビは WsSub。モックとの見た目の比べ方は共通の道具 stage2-match.ts の matchMock だけ（base は /dev/mock/f8）。
//   ログイン・外枠・役（RequireRole）・本人確認の取り直し（stepUp）は本物（signupViaApi・loginAs・本物のパスワード）。
//   メンバーの口（getWorkspaceMembers・createInvitations・K-419）と招待のリンクの口（createInvitationLink・番号は PM が決める葉）だけを網の手前で差し替える。
//   口の答えの形は 11_tickets/K-419.md（違えば下の membersReply・mockMembers だけを合わせる）。名前・メール・字はモック（mocks.tsx の SALES・DEV・INVITED）と同じにする。
//   本人の Bridge（127.0.0.1:38617）には届かせない（網の手前で 404）。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { PW, loginAs, signupViaApi, viewerViaApi } from "../_lib/api";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const PATH = "/members";
const WS_NAME = "株式会社ENGINE BASE";
const SEC = 'section[aria-labelledby="members-title"]';
const DLG = ".k-dialog";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const G_SALES = "0193c5a0-0000-7000-8000-00000000e001";
const G_DEV = "0193c5a0-0000-7000-8000-00000000e002";

// ---------------------------------------------------------------- 口の答え（K-419 の形）
interface Mem {
  id: string;
  name: string;
  email: string;
  role: string;
  group_role: string | null;
  primary: boolean;
  other_groups: string[];
  self: boolean;
  suspended: boolean;
  pc: "ok" | "away" | "never" | "none";
  pc_days_away: number | null;
}
const m = (o: Partial<Mem> & Pick<Mem, "id" | "name" | "email">): Mem => ({
  role: "member",
  group_role: null,
  primary: true,
  other_groups: [],
  self: false,
  suspended: false,
  pc: "ok",
  pc_days_away: null,
  ...o,
});
// モックの SALES・DEV と同じ人（兼ねる人は両方のグループに出る・まとめ役に頼んだモックの直しの後の形）
const SALES: Mem[] = [
  m({
    id: "p2",
    name: "佐藤 花子",
    email: "sato@engine-base.example",
    role: "manager",
    group_role: "manager",
    other_groups: ["受託開発"],
  }),
  m({ id: "p1", name: "高本 聖斗", email: "takamoto@engine-base.example", role: "admin", self: true }),
  m({ id: "p3", name: "鈴木 一郎", email: "suzuki@engine-base.example" }),
  m({
    id: "p4",
    name: "田中 美咲",
    email: "tanaka@engine-base.example",
    other_groups: ["受託開発"],
    pc: "away",
    pc_days_away: 3,
  }),
];
const DEV: Mem[] = [
  m({
    id: "p2",
    name: "佐藤 花子",
    email: "sato@engine-base.example",
    role: "manager",
    group_role: "manager",
    primary: false,
  }),
  m({ id: "p4", name: "田中 美咲", email: "tanaka@engine-base.example", primary: false, pc: "away", pc_days_away: 3 }),
  m({ id: "p6", name: "山口 健", email: "yamaguchi@engine-base.example", role: "viewer", pc: "none" }),
];
const INVITED = {
  id: "i9",
  email: "kimura@engine-base.example",
  scope_id: G_SALES,
  role: "member",
  expires_at: "2026-11-27T09:00:00Z",
  left_days: 7,
};
const membersReply = (invited: boolean) => ({
  data: {
    groups: [
      { id: G_SALES, code: "EG", name: "営業", members: SALES },
      { id: G_DEV, code: "JD", name: "受託開発", members: DEV },
    ],
    invitations: invited ? [INVITED] : [],
    alerts: [],
    count: 5 + (invited ? 1 : 0),
  },
});

interface Reply {
  status: number;
  body: unknown;
}
interface MMock {
  reads: number;
  invites: { body: Record<string, unknown>; key: string | undefined }[];
  links: Record<string, unknown>[];
  invited: boolean;
  on: { read: () => Reply; invite: (b: Record<string, unknown>) => Reply; link: () => Reply };
  /** 招くの答えを止めておく（返した関数を呼ぶと答える・時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}
const err = (status: number, code: string, details: unknown[] = []): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, details },
});
/** 本物の招く口の 409 E-INV-010 の形（create.ts：details は付けず、入っている宛ては detail.already に並ぶ・K419-API-011） */
const already = (emails: string[]): Reply => ({
  status: 409,
  body: {
    error: "conflict",
    code: "E-INV-010",
    message: "もうこのワークスペースに入っています",
    action: "その宛てを外す",
    detail: { already: emails },
  },
});

async function mockMembers(page: Page): Promise<MMock> {
  const mk: MMock = {
    reads: 0,
    invites: [],
    links: [],
    invited: false,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      mk.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      read: () => ({ status: 200, body: membersReply(mk.invited) }),
      invite: (b) => {
        mk.invited = true;
        const emails = (b["emails"] as string[]) ?? [];
        return {
          status: 201,
          body: {
            data: {
              invitations: emails.map((e, i) => ({
                id: `n${i}`,
                email: e,
                expires_at: INVITED.expires_at,
                mail: "sent",
              })),
            },
          },
        };
      },
      link: () => ({
        status: 201,
        body: { data: { url: "https://kaname.example/invite/xxxxxxxx", expires_at: INVITED.expires_at } },
      }),
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/v1\/(workspace\/members|invitations(\/link)?)(\?|$)/, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    let reply: Reply;
    if (req.method() === "GET" && p.endsWith("/workspace/members")) {
      mk.reads++;
      reply = mk.on.read();
    } else if (req.method() === "POST" && p.endsWith("/invitations/link")) {
      mk.links.push(req.postDataJSON() as Record<string, unknown>);
      await mk.gate; // 二度押しを見る試験が hold() で答えを止める（K420-UI-030）
      reply = mk.on.link();
    } else if (req.method() === "POST" && p.endsWith("/invitations")) {
      const b = req.postDataJSON() as Record<string, unknown>;
      mk.invites.push({ body: b, key: req.headers()["idempotency-key"] });
      await mk.gate;
      reply = mk.on.invite(b);
    } else return route.fallback();
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return mk;
}

/** 管理者（会社ごと登録した人）で入り、/members を開いて並びが出るまで待つ */
async function openMembers(page: Page, token: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, token);
  await page.goto(PATH);
  await expect(page.locator(SEC).getByRole("heading", { name: "メンバー", level: 1 })).toBeVisible();
  await expect(page.locator(".k-inv-group")).toHaveCount(2);
}
const inviteBtn = (page: Page) => page.locator(SEC).getByRole("button", { name: "＋ 招く" });
async function openDialog(page: Page): Promise<void> {
  await inviteBtn(page).click();
  await expect(page.locator(DLG).getByRole("heading", { name: "招く" })).toBeVisible();
}
async function addMail(page: Page, text: string): Promise<void> {
  await page.locator(DLG).getByLabel("メール").fill(text);
  await page.locator(DLG).getByRole("button", { name: "足す" }).click();
}
const sendBtn = (page: Page) => page.locator(DLG).getByRole("button", { name: /^(\d+ 人を)?招く$/ });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

// ---------------------------------------------------------------- モックと本番の突き合わせ
const BOX = ["width", "height", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
const INV_PAIRS: FidelityPair[] = [
  ["ws", ".k-inv-ws", [...BOX, "x"]],
  ["ws-name", ".k-inv-ws-name", TEXT],
  ["sub", ".k-me-sub", ["width", "x"]],
  ["sub-item", ".k-me-sub-i", ["height", "opacity", "texts"]],
  ["h1", `${SEC} h1`, ["x", ...TEXT]],
  ["acts", `${SEC} .k-page-acts button`, CTRL],
  ["group", ".k-inv-group", BOX],
  ["group-name", ".k-inv-group-name", TEXT],
  ["group-sub", ".k-inv-group-head .k-inv-sub", TEXT],
  ["row", ".k-inv-row", ["height", "texts"]],
  ["name", ".k-inv-name", TEXT],
  ["role", ".k-inv-role, .k-inv-role-cell .k-badge", CTRL],
  ["state", ".k-inv-state", TEXT],
  ["more", ".k-inv-more button", CTRL],
  ["dialog", DLG, ["width", "x", "y", "background-color", "border-top-left-radius"]],
  ["dialog-title", `${DLG} h2`, ["x", "y", ...TEXT]],
  ["dialog-label", `${DLG} .k-label`, TEXT],
  ["dialog-notice", `${DLG} [role='alert']`, ["x", "width", "background-color", ...TEXT]],
  ["dialog-err", `${DLG} .k-err`, TEXT],
  ["chip", ".k-inv-chip", [...BOX, "texts"]],
  ["more-sum", ".k-inv-more-sum", TEXT],
  ["dialog-btn", `${DLG} button[data-variant]`, ["x", "y", ...CTRL]],
  ["toast", ".k-toast", [...BOX, "texts"]],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));

const STATES: Record<string, (page: Page, mk: MMock) => Promise<void>> = {
  "inv-members": async () => {},
  "inv-dialog": async (page) => {
    await openDialog(page);
    await addMail(page, "kimura@engine-base.example");
    await page.locator(DLG).getByLabel("メール").fill("nakamura@engine-base.example");
    await page.locator(DLG).getByLabel("ひとこと（任意）").fill("営業の問い合わせをいっしょに回してもらいます");
  },
  "inv-error": async (page, mk) => {
    mk.on.invite = () => already(["suzuki@engine-base.example"]);
    await openDialog(page);
    await addMail(page, "suzuki@engine-base.example");
    await sendBtn(page).click();
    await page.locator(DLG).getByLabel("メール").fill("kimura@engine-base");
    await page.locator(DLG).getByRole("button", { name: "足す" }).click();
    await expect(page.locator(`${DLG} .k-err`)).toContainText("kimura@engine-base はメールの形ではありません");
  },
  "inv-link": async (page) => {
    await openDialog(page);
    await page.locator(".k-inv-more-sum").click();
    await page.locator(DLG).getByRole("button", { name: "招待のリンクを作る（7 日・1 回だけ）" }).click();
    await expect(page.locator(DLG).getByLabel("招待のリンク")).toHaveValue("https://kaname.example/invite/xxxxxxxx");
  },
  "inv-stepup": async (page, mk) => {
    mk.on.invite = () => err(403, "STEP_UP_REQUIRED");
    await openDialog(page);
    await addMail(page, "kimura@engine-base.example");
    await page.locator(DLG).getByLabel("役割").selectOption("管理者");
    await sendBtn(page).click();
    await expect(page.getByText("管理者として招く前に、本人か確かめます")).toBeVisible();
  },
  "inv-sent": async (page) => {
    await openDialog(page);
    await addMail(page, "kimura@engine-base.example");
    await sendBtn(page).click();
    await expect(page.locator(".k-toast")).toContainText("kimura@engine-base.example に招待を送りました");
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K420-UI-001 ${id} 幅 ${w}：外枠の中の本文（頭・第 2 ナビ・見出し・グループのカード・人の行・小窓・知らせ）の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await mockMembers(page);
          await openMembers(page, owner.token, w);
          await drive(page, mk);
        },
        { pairs: INV_PAIRS, base: "/dev/mock/f8", blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "本文の役で比べた").toContain("h1");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く・並び
test("K420-UI-002 /members を開くと並びの口を 1 回だけ読む・左のバーの「ワークスペースの管理」が押せて今の場所", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  expect(mk.reads).toBe(1);
  const nav = page.getByRole("link", { name: "ワークスペースの管理" });
  await expect(nav).toHaveAttribute("aria-current", "page");
  await expect(nav).not.toHaveAttribute("aria-disabled", "true");
});

test("K420-UI-003 並び：グループごとに人が 1 人 1 行・状態の字（分身 動いている／PC 3 日つながっていない／分身なし（見るだけ））・自分・兼ねるの注・招待中の行「招待中 ・ あと 7 日」", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.invited = true;
  await openMembers(page, owner.token);
  const sales = page.locator(".k-inv-group").filter({ hasText: "営業" });
  await expect(sales.locator(".k-inv-row")).toHaveCount(5);
  await expect(sales.locator(".k-inv-row").filter({ hasText: "高本 聖斗" })).toContainText("自分");
  await expect(sales.locator(".k-inv-row").filter({ hasText: "田中 美咲" })).toContainText("受託開発も兼ねる");
  await expect(sales.locator(".k-inv-row").filter({ hasText: "田中 美咲" }).locator(".k-inv-state")).toHaveText(
    "PC 3 日つながっていない",
  );
  await expect(sales.locator(".k-inv-row").filter({ hasText: "鈴木 一郎" }).locator(".k-inv-state")).toHaveText(
    "分身 動いている",
  );
  await expect(sales.locator(".k-inv-row").filter({ hasText: "kimura@engine-base.example" })).toContainText(
    "招待中 ・ あと 7 日",
  );
  const dev = page.locator(".k-inv-group").filter({ hasText: "受託開発" });
  await expect(dev.locator(".k-inv-row").filter({ hasText: "佐藤 花子" })).toContainText("兼ねている");
  await expect(dev.locator(".k-inv-row").filter({ hasText: "山口 健" }).locator(".k-inv-state")).toHaveText(
    "分身なし（見るだけ）",
  );
  await expect(dev.locator(".k-inv-group-head .k-inv-sub")).toHaveText("3 人");
});

test("K420-UI-004 PC をまだつないでいない人の状態の字は「PC をまだつないでいない」（代表に聞くこと 4 の勧め）", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.on.read = () => {
    const r = membersReply(false);
    (r.data.groups[0]!.members as Mem[])[2] = { ...SALES[2]!, pc: "never", pc_days_away: null };
    return { status: 200, body: r };
  };
  await openMembers(page, owner.token);
  await expect(page.locator(".k-inv-row").filter({ hasText: "鈴木 一郎" }).locator(".k-inv-state")).toHaveText(
    "PC をまだつないでいない",
  );
});

test("K420-UI-005 グレーの物（役割の ▾・⋯・＋ グループ・＋ このグループに招く・送り直す・第 2 ナビの決まり／記録／設定）は押せない形で、押しても口を呼ばず画面も変わらない", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.invited = true;
  await openMembers(page, owner.token);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/v1\//.test(r.url()) && r.method() !== "GET") calls.push(`${r.method()} ${r.url()}`);
  });
  const inert = [
    page.locator(".k-inv-role").first(),
    page.locator(".k-inv-more button").first(),
    page.locator(SEC).getByRole("button", { name: "＋ グループ" }),
    page.locator(".k-inv-group-invite").first(),
    page.locator(".k-inv-more").getByRole("button", { name: "送り直す" }),
    page.locator(".k-me-sub-i").filter({ hasText: "決まり" }),
    page.locator(".k-me-sub-i").filter({ hasText: "記録" }),
    page.locator(".k-me-sub-i").filter({ hasText: "設定" }),
  ];
  for (const el of inert) {
    await expect(el).toHaveAttribute("aria-disabled", "true");
    await el.click({ force: true });
  }
  expect(calls).toEqual([]);
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  await expect(page.locator(DLG)).toHaveCount(0);
});

// ---------------------------------------------------------------- 招くの小窓
test("K420-UI-006 「＋ 招く」で小窓が開き、メールの欄に焦点。グループは営業・受託開発、役割はメンバー・マネージャー・閲覧のみ・管理者（既定は今のグループの営業・メンバー）", async ({
  page,
}) => {
  await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await expect(page.locator(DLG).getByLabel("メール")).toBeFocused();
  await expect(page.locator(DLG).getByLabel("グループ").locator("option")).toHaveText(["営業", "受託開発"]);
  await expect(page.locator(DLG).getByLabel("役割").locator("option")).toHaveText([
    "メンバー",
    "マネージャー",
    "閲覧のみ",
    "管理者",
  ]);
  await expect(page.locator(DLG).getByLabel("グループ")).toHaveValue(G_SALES);
});

test("K420-UI-007 足す：並びに出て欄は空になる・カンマで分けて貼ると 2 人・大文字や全角で同じ宛ては 1 つにそろう・× で外せる・ボタンの字が人数で変わる", async ({
  page,
}) => {
  await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await expect(page.locator(DLG).getByLabel("メール")).toHaveValue("");
  await addMail(page, "nakamura@engine-base.example, ito@engine-base.example");
  await addMail(page, "ＫＩＭＵＲＡ@Engine-Base.Example");
  await expect(page.locator(".k-inv-chip-t")).toHaveText([
    "kimura@engine-base.example",
    "nakamura@engine-base.example",
    "ito@engine-base.example",
  ]);
  await expect(page.locator(DLG).getByText("招く人（3 人）")).toBeVisible();
  await expect(sendBtn(page)).toHaveText("3 人を招く");
  await page.getByRole("button", { name: "nakamura@engine-base.example を外す" }).click();
  await page.getByRole("button", { name: "ito@engine-base.example を外す" }).click();
  await expect(sendBtn(page)).toHaveText("招く");
});

test("K420-UI-008 足すで形の違う字：欄の下に「〇〇 はメールの形ではありません」・並びに入らない・欄の字は残る（D-148.32）", async ({
  page,
}) => {
  await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base");
  await expect(page.locator(`${DLG} .k-err`)).toHaveText("kimura@engine-base はメールの形ではありません");
  await expect(page.locator(".k-inv-chip")).toHaveCount(0);
  await expect(page.locator(DLG).getByLabel("メール")).toHaveValue("kimura@engine-base");
  await expect(page.locator(DLG).getByLabel("メール")).toHaveAttribute("aria-invalid", "true");
  await page.locator(DLG).getByLabel("メール").fill("kimura@engine-base.example");
  await page.locator(DLG).getByRole("button", { name: "足す" }).click();
  await expect(page.locator(`${DLG} .k-err`)).toHaveCount(0);
});

test("K420-UI-009 招く人が 0 人で欄も空のまま「招く」：口を呼ばず欄の下に「メールを 1 つ以上入れてください」。欄に字があれば足してから送る", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await sendBtn(page).click();
  await expect(page.locator(`${DLG} .k-err`)).toHaveText("メールを 1 つ以上入れてください");
  expect(mk.invites).toHaveLength(0);
  await page.locator(DLG).getByLabel("メール").fill("kimura@engine-base.example");
  await sendBtn(page).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites[0]!.body["emails"]).toEqual(["kimura@engine-base.example"]);
});

test("K420-UI-010 招く：口に emails・scope_id（選んだグループの id）・role_key・message が届く・小窓が閉じ「〇〇 に招待を送りました」の知らせ・並びを読み直して招待中の行が出る", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await page.locator(DLG).getByLabel("グループ").selectOption({ label: "受託開発" });
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "マネージャー" });
  await page.locator(".k-inv-more-sum").click();
  await page.locator(DLG).getByLabel("ひとこと（任意）").fill("受託の案件を一緒に回してください");
  await sendBtn(page).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites).toHaveLength(1);
  expect(mk.invites[0]!.body).toEqual({
    emails: ["kimura@engine-base.example"],
    scope_id: G_DEV,
    role_key: "manager",
    message: "受託の案件を一緒に回してください",
  });
  expect(mk.invites[0]!.key, "冪等の鍵を付ける").toBeTruthy();
  await expect(page.locator(".k-toast")).toContainText("kimura@engine-base.example に招待を送りました");
  await expect(page.locator(".k-inv-row").filter({ hasText: "kimura@engine-base.example" })).toContainText("招待中");
  expect(mk.reads).toBe(2);
});

test("K420-UI-011 2 人以上を招くと知らせは「N 人に招待を送りました」。送れなかった人がいれば知らせに「〇〇 にはメールが届きませんでした。もう一度招いてください」", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.on.invite = (b) => {
    mk.invited = true;
    const es = b["emails"] as string[];
    return {
      status: 201,
      body: {
        data: {
          invitations: es.map((e, i) => ({
            id: `n${i}`,
            email: e,
            expires_at: INVITED.expires_at,
            mail: i === 1 ? "failed" : "sent",
          })),
        },
      },
    };
  };
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example, ito@engine-base.example");
  await sendBtn(page).click();
  await expect(page.locator(".k-toast").first()).toContainText("2 人に招待を送りました");
  await expect(
    page
      .locator(".k-toast")
      .filter({ hasText: "ito@engine-base.example にはメールが届きませんでした。もう一度招いてください" }),
  ).toBeVisible();
});

test("K420-UI-012 口が断る（409 E-INV-010 もう入っている人 2 人・宛ては detail.already → 並びを替えて 422 E-INV-009 画面の形の確かめは通った送った宛て 1 つを口が断った）：どちらも小窓は閉じず欄の下に宛てごとの文を 1 つの赤字で出す（409 は「。」でつなぐ）・上の赤い箱は出ない・書いた中身（並び・グループ・役割）は残る", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  // 形の誤りが先：形の違う宛てと入っている人が混じる回は口が 422 の E-INV-009 だけを返す（K-419）ので、2 つの番号を 1 回に混ぜず、2 回の間で並びを替える
  // 409 E-INV-010 は本物の口の形（details なし・入っている宛ては detail.already）
  mk.on.invite = () =>
    mk.invites.length === 1
      ? already(["suzuki@engine-base.example", "ito@engine-base.example"])
      : err(422, "E-INV-009", [
          {
            field: "emails",
            email: "nakamura@engine-base.example",
            code: "E-INV-009",
            message: "メールの形ではありません",
          },
        ]);
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "suzuki@engine-base.example");
  await addMail(page, "ito@engine-base.example");
  await page.locator(DLG).getByLabel("グループ").selectOption({ label: "受託開発" });
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "閲覧のみ" });
  const kept = async (chips: string[]) => {
    await expect(page.locator(`${DLG} [role='alert']`)).toHaveCount(0);
    await expect(page.locator(".k-inv-chip-t")).toHaveText(chips);
    await expect(page.locator(DLG).getByLabel("グループ")).toHaveValue(G_DEV);
    await expect(page.locator(DLG).getByLabel("役割")).toHaveValue("viewer");
  };
  await sendBtn(page).click();
  await expect(page.locator(`${DLG} .k-err`)).toHaveText(
    "suzuki@engine-base.example はもうこのワークスペースに入っています。ito@engine-base.example はもうこのワークスペースに入っています",
  );
  await kept(["suzuki@engine-base.example", "ito@engine-base.example"]);
  await page.getByRole("button", { name: "suzuki@engine-base.example を外す" }).click();
  await page.getByRole("button", { name: "ito@engine-base.example を外す" }).click();
  await addMail(page, "nakamura@engine-base.example");
  await sendBtn(page).click();
  await expect(page.locator(`${DLG} .k-err`)).toHaveText("nakamura@engine-base.example はメールの形ではありません");
  await kept(["nakamura@engine-base.example"]);
  expect(mk.invites).toHaveLength(2);
  expect(mk.invites[1]!.body["emails"]).toEqual(["nakamura@engine-base.example"]);
});

test("K420-UI-033 ひとことが 500 字を超えて「招く」：口を呼ばず、ひとことの欄の下に「ひとことは 500 字までです」・小窓は閉じず中身は残る。500 字ちょうどなら送れる", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await page.locator(".k-inv-more-sum").click();
  const note = page.locator(DLG).getByLabel("ひとこと（任意）");
  await note.fill("あ".repeat(501));
  await sendBtn(page).click();
  await expect(page.locator(`${DLG} .k-inv-note-err`)).toHaveText("ひとことは 500 字までです");
  await expect(page.locator(`${DLG} .k-err`)).toHaveCount(0);
  await expect(page.locator(DLG)).toBeVisible();
  await expect(page.locator(".k-inv-chip-t")).toHaveText(["kimura@engine-base.example"]);
  await expect(note).toHaveValue("あ".repeat(501));
  expect(mk.invites).toHaveLength(0);
  await note.fill("あ".repeat(500));
  await sendBtn(page).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites).toHaveLength(1);
  expect(mk.invites[0]!.body["message"]).toBe("あ".repeat(500));
});

test("K420-UI-013 口が 503：小窓の上の赤い箱に正本の文・中身は残る・もう一度押すと送れる（D-148.31）", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  let first = true;
  mk.on.invite = (b) => {
    if (first) {
      first = false;
      return err(503, "E-PAGE-003");
    }
    mk.invited = true;
    return {
      status: 201,
      body: {
        data: {
          invitations: (b["emails"] as string[]).map((e) => ({
            id: "n1",
            email: e,
            expires_at: INVITED.expires_at,
            mail: "sent",
          })),
        },
      },
    };
  };
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await sendBtn(page).click();
  const box = page.locator(`${DLG} [role='alert']`);
  await expect(box).toBeVisible();
  await expect(box).not.toHaveText("");
  await expect(page.locator(".k-inv-chip-t")).toHaveText(["kimura@engine-base.example"]);
  await sendBtn(page).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites).toHaveLength(2);
});

test("K420-UI-031 招く口が 404 E-INV-011（グループが無い・別の会社・消した）：小窓の上の赤い箱に正本の文・欄の下の赤字は出ない・書いた中身は残る・もう一度押すと送れる", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  const ok = mk.on.invite;
  mk.on.invite = (b) => (mk.invites.length === 1 ? err(404, "E-INV-011") : ok(b));
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await page.locator(DLG).getByLabel("グループ").selectOption({ label: "受託開発" });
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "閲覧のみ" });
  await sendBtn(page).click();
  const box = page.locator(`${DLG} [role='alert']`);
  await expect(box).toContainText(msgOf("E-INV-011"));
  await expect(page.locator(`${DLG} .k-err`)).toHaveCount(0);
  await expect(page.locator(".k-inv-chip-t")).toHaveText(["kimura@engine-base.example"]);
  await expect(page.locator(DLG).getByLabel("グループ")).toHaveValue(G_DEV);
  await expect(page.locator(DLG).getByLabel("役割")).toHaveValue("viewer");
  await sendBtn(page).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites).toHaveLength(2);
});

test("K420-UI-032 招く口が 422 E-INV-012（51 人以上・details なし）：欄の下に正本の文・小窓の上の赤い箱は出ない・並び（51 人）・グループ・役割は残る", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.on.invite = () => err(422, "E-INV-012");
  await openMembers(page, owner.token);
  await openDialog(page);
  const mails = Array.from({ length: 51 }, (_, i) => `member${i + 1}@engine-base.example`);
  await addMail(page, mails.join(","));
  await page.locator(DLG).getByLabel("グループ").selectOption({ label: "受託開発" });
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "閲覧のみ" });
  await sendBtn(page).click();
  await expect(page.locator(`${DLG} .k-err`)).toHaveText(msgOf("E-INV-012"));
  await expect(page.locator(`${DLG} [role='alert']`)).toHaveCount(0);
  await expect(page.locator(".k-inv-chip-t")).toHaveText(mails);
  await expect(page.locator(DLG).getByLabel("グループ")).toHaveValue(G_DEV);
  await expect(page.locator(DLG).getByLabel("役割")).toHaveValue("viewer");
  expect(mk.invites).toHaveLength(1);
});

test("K420-UI-014 管理者として招く：口が 403・STEP_UP_REQUIRED → 本人確認の小窓 → 本物のパスワードで取り直す → 招くを 1 回だけ送り直して閉じる", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.on.invite = (b) =>
    mk.invites.length === 1
      ? err(403, "STEP_UP_REQUIRED")
      : {
          status: 201,
          body: {
            data: {
              invitations: (b["emails"] as string[]).map((e) => ({
                id: "n1",
                email: e,
                expires_at: INVITED.expires_at,
                mail: "sent",
              })),
            },
          },
        };
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "管理者" });
  await sendBtn(page).click();
  await expect(page.getByText("管理者として招く前に、本人か確かめます")).toBeVisible();
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  const stepUp = page.waitForResponse(
    (r) => /\/api\/v1\/auth\/step-up/.test(r.url()) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "確かめる" }).click();
  expect((await stepUp).status()).toBeLessThan(300);
  await expect(page.locator(".k-toast")).toContainText("kimura@engine-base.example に招待を送りました");
  expect(mk.invites).toHaveLength(2);
  expect(mk.invites[1]!.body["role_key"]).toBe("admin");
});

test("K420-UI-015 本人確認の小窓で「やめる」：口を送り直さない・招くの小窓に戻って中身が残る", async ({ page }) => {
  const mk = await mockMembers(page);
  mk.on.invite = () => err(403, "STEP_UP_REQUIRED");
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "管理者" });
  await sendBtn(page).click();
  await expect(page.getByText("管理者として招く前に、本人か確かめます")).toBeVisible();
  await page.getByRole("button", { name: "やめる" }).last().click();
  await expect(page.locator(DLG).getByRole("heading", { name: "招く" })).toBeVisible();
  await expect(page.locator(".k-inv-chip-t")).toHaveText(["kimura@engine-base.example"]);
  expect(mk.invites).toHaveLength(1);
});

test("K420-UI-016 二度押し：答えを待つ間「招く」は押せず、口は 1 回だけ", async ({ page }) => {
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  const release = mk.hold();
  await sendBtn(page).click();
  await expect(sendBtn(page)).toBeDisabled();
  await sendBtn(page).click({ force: true });
  release();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites).toHaveLength(1);
});

test("K420-UI-017 ひとこと・リンクで招く → リンクを作る：口に scope_id と role_key・リンクの欄とコピー。コピーを押すとリンクの字がクリップボードに入る", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "閲覧のみ" });
  await page.locator(".k-inv-more-sum").click();
  await page.locator(DLG).getByRole("button", { name: "招待のリンクを作る（7 日・1 回だけ）" }).click();
  await expect(page.locator(DLG).getByLabel("招待のリンク")).toHaveValue("https://kaname.example/invite/xxxxxxxx");
  expect(mk.links).toEqual([{ scope_id: G_SALES, role_key: "viewer" }]);
  await page.locator(DLG).getByRole("button", { name: "コピー" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://kaname.example/invite/xxxxxxxx");
});

test("K420-UI-018 やめる・Esc で閉じて口を呼ばない・焦点は「＋ 招く」に戻る・開き直すと空", async ({ page }) => {
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await addMail(page, "kimura@engine-base.example");
  await page.locator(DLG).getByRole("button", { name: "やめる" }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(inviteBtn(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(DLG).getByRole("heading", { name: "招く" })).toBeVisible();
  await expect(page.locator(".k-inv-chip")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites).toHaveLength(0);
});

// ---------------------------------------------------------------- 守り・失敗・幅
test("K420-UI-019 閲覧のみの人が /members を直に開く：「いまの権限では開けません」・並びの口を呼ばない・左のバーに「ワークスペースの管理」が出ない", async ({
  page,
}) => {
  const v = await viewerViaApi();
  const mk = await mockMembers(page);
  await loginAs(page, v.token);
  await page.goto(PATH);
  await expect(page.getByText("いまの権限では開けません")).toBeVisible();
  expect(mk.reads).toBe(0);
  await expect(page.getByRole("link", { name: "ワークスペースの管理" })).toHaveCount(0);
});

test("K420-UI-020 並びを読めない（503）：本文に「メンバーを読み込めませんでした」と「もう一度読む」・押すと読めて並びが出る", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  let first = true;
  mk.on.read = () => {
    if (first) {
      first = false;
      return err(503, "E-PAGE-003");
    }
    return { status: 200, body: membersReply(false) };
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(PATH);
  await expect(page.locator(SEC).getByText("メンバーを読み込めませんでした")).toBeVisible();
  await expect(inviteBtn(page)).toBeDisabled();
  await page.locator(SEC).getByRole("button", { name: "もう一度読む" }).click();
  await expect(page.locator(".k-inv-group")).toHaveCount(2);
  expect(mk.reads).toBe(2);
});

for (const w of WIDTHS)
  test(`K420-UI-021 幅 ${w}：横のはみ出し 0（数値）・小窓を開いても 0・スマホ（767 以下）は 1 人 1 行で状態の列と ⋯ を出さない`, async ({
    page,
  }) => {
    await mockMembers(page);
    await openMembers(page, owner.token, w);
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await over()).toBe(0);
    if (w < 768) {
      await expect(page.locator(".k-inv-state").first()).toBeHidden();
      await expect(page.locator(".k-inv-more").first()).toBeHidden();
    } else await expect(page.locator(".k-inv-state").first()).toBeVisible();
    await openDialog(page);
    expect(await over()).toBe(0);
  });

test("K420-UI-022 キーボード：Tab で「＋ 招く」に届き Enter で開く・小窓の中で Tab が外へ出ない（最後から先頭へ回る）", async ({
  page,
}) => {
  await mockMembers(page);
  await openMembers(page, owner.token);
  await inviteBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(DLG).getByLabel("メール")).toBeFocused();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate((s) => !!document.activeElement?.closest(s), DLG), `Tab ${i + 1} 回目も小窓の中`).toBe(
      true,
    );
  }
});

// ---------------------------------------------------------------- 正本の文（errors.json）
const CATALOG = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msgOf = (id: string) => CATALOG.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

// ---------------------------------------------------------------- 招待のリンクを作る段の失敗と揺れ（口は K-421 の createInvitationLink）
const linkBtn = (page: Page) => page.locator(DLG).getByRole("button", { name: "招待のリンクを作る（7 日・1 回だけ）" });
const LINK_OK: Reply = {
  status: 201,
  body: { data: { url: "https://kaname.example/invite/xxxxxxxx", expires_at: INVITED.expires_at } },
};

test("K420-UI-028 管理者として入るリンク：口が 403・STEP_UP_REQUIRED → 本人確認の小窓 → 本物のパスワードで取り直す → リンクの口を 1 回だけ送り直してリンクの欄が出る（口 2 回・2 回目も role_key admin）", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.on.link = () => (mk.links.length === 1 ? err(403, "STEP_UP_REQUIRED") : LINK_OK);
  await openMembers(page, owner.token);
  await openDialog(page);
  await page.locator(DLG).getByLabel("役割").selectOption({ label: "管理者" });
  await page.locator(".k-inv-more-sum").click();
  await linkBtn(page).click();
  await expect(page.getByText("管理者として招く前に、本人か確かめます")).toBeVisible();
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  const stepUp = page.waitForResponse(
    (r) => /\/api\/v1\/auth\/step-up/.test(r.url()) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "確かめる" }).click();
  expect((await stepUp).status()).toBeLessThan(300);
  await expect(page.locator(DLG).getByLabel("招待のリンク")).toHaveValue("https://kaname.example/invite/xxxxxxxx");
  expect(mk.links).toHaveLength(2);
  expect(mk.links[1]!["role_key"]).toBe("admin");
});

test("K420-UI-029 リンクの口が断る：404 E-INV-011 → 小窓の上の赤い箱に正本の文・リンクの欄は出ない。503 E-PAGE-003 → 同じ所に正本の文。押し直すと通ってリンクの欄が出る（口 3 回）", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  mk.on.link = () =>
    mk.links.length === 1 ? err(404, "E-INV-011") : mk.links.length === 2 ? err(503, "E-PAGE-003") : LINK_OK;
  await openMembers(page, owner.token);
  await openDialog(page);
  await page.locator(".k-inv-more-sum").click();
  const box = page.locator(`${DLG} [role='alert']`);
  await linkBtn(page).click();
  await expect(box).toContainText(msgOf("E-INV-011"));
  await expect(page.locator(DLG).getByLabel("招待のリンク")).toHaveCount(0);
  await linkBtn(page).click();
  await expect(box).toContainText(msgOf("E-PAGE-003"));
  await expect(page.locator(DLG).getByLabel("招待のリンク")).toHaveCount(0);
  await linkBtn(page).click();
  await expect(page.locator(DLG).getByLabel("招待のリンク")).toHaveValue("https://kaname.example/invite/xxxxxxxx");
  expect(mk.links).toHaveLength(3);
});

test("K420-UI-030 リンクの二度押し：答えを待つ間「招待のリンクを作る」は押せず、口は 1 回だけ（2 本できない）", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page, owner.token);
  await openDialog(page);
  await page.locator(".k-inv-more-sum").click();
  const release = mk.hold();
  await linkBtn(page).click();
  await expect.poll(() => mk.links.length).toBe(1);
  await expect(linkBtn(page)).toBeDisabled();
  await linkBtn(page).click({ force: true });
  release();
  await expect(page.locator(DLG).getByLabel("招待のリンク")).toHaveValue("https://kaname.example/invite/xxxxxxxx");
  expect(mk.links).toHaveLength(1);
});
