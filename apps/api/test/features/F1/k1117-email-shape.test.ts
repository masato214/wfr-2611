// K-1117「登録のメールを部品の z.email() に合わせる」の単体の試験（口・本物の DB・本物のログインの部品）。名前の頭の行 ID（K1117-API-…）は 11_tickets/K-1117.md の表と 1 対 1。
// 土台は login.harness.ts（pm-fuzz-auth.test.ts と同じ形）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   部品（better-auth）の z.email() が断るメールは、登録の口で 422 E-VAL-004（欄 email）。申し込みを作らず、メールも送らない。
import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@kaname/auth/signup";
import { mails, msg, PW, setupLogin } from "./login.harness.js";

const h = setupLogin("k1117");
const SIGN_UP = "/api/v1/auth/sign-up";

/** 422 の欄：details の並び（入口・前処理の形）か、detail.field（正本のエラーの形） */
const fieldsOf = (j: Record<string, unknown>): string[] => [
  ...((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field),
  ...[(j["detail"] as { field?: string } | undefined)?.field].filter((x): x is string => typeof x === "string"),
];
const pendingRows = async (email: string): Promise<number> =>
  Number(
    (
      await h.admin.query<{ n: number }>("select count(*)::int as n from kaname_auth.pending_signup where email = $1", [
        normalizeEmail(email),
      ])
    ).rows[0]!.n,
  );
const signUp = (email: string) =>
  h.req("POST", SIGN_UP, { email, name: "高本 聖斗", company_name: "株式会社テスト", password: PW });

const expectRejected = async (email: string) => {
  const r = await signUp(email);
  expect(r.status, `${JSON.stringify(email)}：${await r.clone().text()}`).toBe(422);
  const j = await h.json(r);
  expect(j["code"], JSON.stringify(email)).toBe("E-VAL-004");
  expect(fieldsOf(j), JSON.stringify(email)).toContain("email");
  expect(JSON.stringify(j)).toContain(msg("E-VAL-004"));
  expect(await pendingRows(email), JSON.stringify(email)).toBe(0);
};

describe("K-1117 登録：部品が断るメールは、申し込みを作る前に 422", () => {
  it("K1117-API-001 部品の z.email() が断るメール（日本語の名前・半角のカナ。EMAIL_RE は通る）：422・E-VAL-004・欄 email。申し込みは 0 行・メールは増えない", async () => {
    const before = mails.length;
    for (const email of ["日本@例.jp", `${h.run}-ｶﾅ@example.com`]) await expectRejected(email);
    expect(mails.length).toBe(before);
  });

  it("K1117-API-002 契約の形の外になったメール（﹫ と BOM）：今までどおり 422・E-VAL-004・欄 email。メールは増えない", async () => {
    const before = mails.length;
    for (const email of [`${h.run}﹫b@example.com`, "﻿@example.com"]) await expectRejected(email);
    expect(mails.length).toBe(before);
  });
});
