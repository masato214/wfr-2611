// K-1114 画面の試験の準備で人を続けて作っても、登録の口の回数の上限（IP ごと 1 分 10 回・契約の rateLimit）に当たらない。
// 準備の道具（_lib/api.ts の signupViaApi）は 1 人ごとに別の届く元（x-forwarded-for）で登録と確認の口を呼ぶ。
// 上限そのものは本物：同じ届く元から 11 回目の登録は 429（試験の準備だけが上限を外れる）。本物の口と DB（網の手前で差し替えない）。
import { expect, test } from "@playwright/test";
import { api, signupViaApi, testIp } from "../_lib/api";

const PER_MINUTE = 10; // 契約の createSignup・verifySignup の rateLimit.perMinute（key: ip）

test("K1114-UI-001 準備の道具で 12 人を続けて作る：登録と確認の口が全部 201 で、12 人とも token と会社を持つ", async () => {
  // 登録 1 人（申し込み・確認・DB の照会）は手元で 1〜2 秒、遅い日は十数秒（playwright.config.ts の訳）。12 人で 1 人 15 秒まで待つ
  test.setTimeout((PER_MINUTE + 2) * 15_000);
  const made = [];
  for (let i = 0; i < PER_MINUTE + 2; i++) made.push(await signupViaApi(`K1114 社 ${i}`));
  expect(made).toHaveLength(PER_MINUTE + 2);
  for (const u of made) {
    expect(u.token.length).toBeGreaterThan(0);
    expect(u.tenantId.length).toBeGreaterThan(0);
  }
  expect(new Set(made.map((u) => u.tenantId)).size).toBe(PER_MINUTE + 2);
});

test("K1114-UI-002 同じ届く元から登録の口を 11 回（体は空で中身の確かめに落ちる形）：10 回は 422（中身の確かめ）、11 回目は 429 RATE_LIMITED（上限は残っている）", async () => {
  // 上限は体の中身を確かめる前に数える（apps/api/src/contract/op.ts の 1) 上限）。空の体は 422 ですぐ返り、何も書かないので、
  // 10 回が 60 秒の窓の中に必ず収まる（時間に頼らない）
  const ip = testIp();
  const sent = async () => api<{ code?: string }>("/api/v1/auth/sign-up", {}, undefined, "POST", ip);
  for (let i = 0; i < PER_MINUTE; i++) expect((await sent()).status).toBe(422);
  const over = await sent();
  expect(over.status).toBe(429);
  expect(over.json.code).toBe("RATE_LIMITED");
});
