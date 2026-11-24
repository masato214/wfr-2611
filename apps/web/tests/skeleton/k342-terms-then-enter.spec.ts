// K-342「中間テスト 1 の K54-M1-07 の揺れを止める（同意して中へ移る前に、付けるまで進めないの印を下ろす）」の試験（実 Chrome・本物の口と DB）。
//   ログインし直した人（入り方がまだ無い人）のセッションには、付けるまで進めない（K-321）の印が立つ。同意し直しで「同意して続ける」を押すと、
//   画面はすぐ next（/ai/chat）へ移り、その画面の口が 403・MFA_REQUIRED を返すと、少し後に /mfa-setup へ移す（lib/mfa-gate.ts）。
//   中間テストが印を下ろすのを「同意して中へ移った後」にすると、その 403 が試験の次の goto と取り合う（CI の VM の重さで出る）。
//   ここでは、移った先の画面の答えを門で止め、中間テスト 1 と同じ道具（_lib/terms-steps.ts の agreeOnTerms）で同意すると
//   「答えが遅くても /mfa-setup へ移らない」ことを毎回見る。道具が印を下ろすのを押した後にすると赤になる。
//   口は網の手前で差し替えない（届いた本物の答えを、門が開くまで画面へ渡さないだけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { API, PW, admin, api, pendingToken, signupPending, testIp, uniq, uniqEmail } from "../_lib/api";
import { TERMS_STEP, agreeOnTerms } from "../_lib/terms-steps";
import { replyGate } from "../k/reply-gate";

const API_ORIGIN = new URL(API).origin;
const CONSENT = "/api/v1/auth/terms/consent"; // 同意の口（consentToTerms）
/** 利用者ごとに別の IP（口の回数の制限は IP ごと。今の版を読む口は 10 回/分・中間テスト 1 の ownIp と同じ）。答えは作らない */
const newIp = () => `10.34.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const withIp = (route: Route, ip: string) => ({ ...route.request().headers(), "x-forwarded-for": ip });

/** 入り方を 1 つも持たない、確定した本人（登録 → 確認の口まで。試験の鍵は置かない） */
async function personWithoutEntry(): Promise<{ email: string; userId: string }> {
  const email = uniqEmail();
  await signupPending(`K-342 の会社 ${uniq()}`, email);
  const r = await api("/api/v1/auth/sign-up/verify", { token: pendingToken(email) }, undefined, "POST", testIp());
  expect(r.status, "確認の口で本人ができる").toBe(201);
  const [u] = await admin<{ id: string }>('select id from kaname_auth."user" where email = $1', [email]);
  return { email, userId: u!.id };
}
/** 規約とプライバシーポリシーの新しい版を出す。返した ids は必ず withdraw に渡す */
async function publishNewTerms(): Promise<string[]> {
  const ops = (await admin<{ id: string }>("select app.ops_tenant_id() as id"))[0]!.id;
  const v = `k342-${uniq()}`;
  const ids: string[] = [];
  for (const kind of ["terms", "privacy"])
    ids.push(
      (
        await admin<{ id: string }>(
          "insert into terms_versions (tenant_id, kind, version, url, published_at) values ($1, $2, $3, $4, now()) returning id",
          [ops, kind, v, `https://kaname.example/${kind}/${v}`],
        )
      )[0]!.id,
    );
  return ids;
}
const withdraw = (ids: string[]) =>
  admin("update terms_versions set deleted_at = now() where id = any($1::uuid[])", [ids]);

/** このセッションの付けるまで進めないの印（入った人の今のセッション） */
const mfaPending = async (userId: string): Promise<boolean[]> =>
  (
    await admin<{ p: boolean }>(
      `select s.mfa_pending as p from sessions s join kaname_auth.session a on a.id = s.auth_session_id
        where a."userId" = $1 and s.revoked_at is null`,
      [userId],
    )
  ).map((x) => x.p);

/** ログインの画面から入り、チャットの画面を開くと同意し直しの画面に止まる（next=/ai/chat） */
async function loginToTerms(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  const termsHeading = page.getByRole("heading", {
    level: 1,
    name: "利用規約とプライバシーポリシーが新しくなりました",
  });
  // ログインの後の移り（同意し直しの画面へ）が終わるのを待ってから次を開く（移りの途中の goto は取り合う）
  await expect(page).toHaveURL(TERMS_STEP, { timeout: 30_000 });
  await expect(termsHeading).toBeVisible();
  await page.goto("/ai/chat");
  await expect(page, "同意の前にチャットを開くと、同意し直しの画面に戻る（next=/ai/chat）").toHaveURL(
    /\/login\?step=terms&next=%2Fai%2Fchat/,
    { timeout: 15_000 },
  );
  await expect(termsHeading).toBeVisible();
  // 同意し直しの画面の読み込み（今の版の口）が終わってから門を掛ける（読み込みの口を門で止めない）
  await expect(page.getByLabel("利用規約とプライバシーポリシーに同意します")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("K342-UI-001 同意して中へ移る前に印を下ろすと、移った先の答えが遅くても /mfa-setup へ移らず、次の goto も取り合わない", async ({
  page,
}) => {
  const ip = newIp();
  await page.context().route(
    (u) => u.origin === API_ORIGIN,
    (route) => route.continue({ headers: withIp(route, ip) }),
  );
  const me = await personWithoutEntry();
  const ids = await publishNewTerms();
  try {
    await loginToTerms(page, me.email);
    expect(
      await mfaPending(me.userId),
      "ログインし直したセッションには付けるまで進めないの印が立つ（K-321）",
    ).toContain(true);

    // 移った先の画面の口（GET）の答えを、門が開くまで画面へ渡さない（本物の答えをそのまま渡す。CI の VM の遅さを、速さに依らず作る）。
    //   画面へ渡す前に、口の答えが 403・MFA_REQUIRED かを数える（403 を受けた画面はすぐ移るので、画面の側では数え漏れる）
    const gate = replyGate();
    let held = 0;
    const mfaBlocked: string[] = [];
    const pendingAtConsent: boolean[] = [];
    await page.route(
      (u) => u.origin === API_ORIGIN,
      async (route: Route) => {
        // 同意の口が届いた時に、印がもう下りているか（道具が押す前に下ろしたか）を DB で見る
        if (route.request().method() === "POST" && new URL(route.request().url()).pathname === CONSENT)
          pendingAtConsent.push(...(await mfaPending(me.userId)));
        const res = await route.fetch({ headers: withIp(route, ip) });
        if (res.status() === 403) {
          const body = (await res.json().catch(() => ({}))) as { code?: string };
          if (body.code === "MFA_REQUIRED") mfaBlocked.push(new URL(route.request().url()).pathname);
        }
        if (route.request().method() === "GET") {
          held += 1;
          await gate.wait;
        }
        await route.fulfill({ response: res });
      },
    );
    const navigations: string[] = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navigations.push(new URL(f.url()).pathname);
    });

    // 中間テスト 1 と同じ道具で同意する（押す前に印を下ろす・_lib/terms-steps.ts）
    await agreeOnTerms(page, me.email);
    expect(
      pendingAtConsent,
      "同意の口が届いた時に、このセッションの印はもう下りている（道具が押す前に下ろした）",
    ).not.toEqual([]);
    expect(pendingAtConsent, "同意の口が届いた時に、印が立ったセッションは無い").not.toContain(true);
    await expect.poll(() => held, { message: "移った先の画面の口が門で止まっている" }).toBeGreaterThan(0);
    gate.open();

    await page.waitForLoadState("networkidle");
    await page.goto("/ai/chat"); // 移った先の答えで /mfa-setup へ移り始めていれば、ここが取り合って止まる
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/(ai\/chat|setup\/bridge)$/);
    expect(mfaBlocked, "移った先の口は 403・MFA_REQUIRED を返さない").toEqual([]);
    expect(
      navigations.filter((p) => p === "/mfa-setup"),
      "ログインと安全の画面へ移らない",
    ).toEqual([]);
  } finally {
    await withdraw(ids);
  }
});
