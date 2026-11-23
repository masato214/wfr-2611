// 登録の入力を確かめて直す（K-51）。表記ゆらぎはサーバーが最後の砦（全角・前後の空白・大文字小文字）。
//   エラーの文言は正本（errors.json → @kaname/errors）から引く。会社名は空でよい（D-125.135）
import { isLoginEmail, normalizeEmail } from "@kaname/auth/signup";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 名前・会社名の上限（D-128.142） */
export const NAME_MAX = 100;
export const COMPANY_MAX = 100;
/** パスワードの下限（E-VAL-005） */
export const PASSWORD_MIN = 12;

export interface SignupInput {
  email: string;
  name: string;
  companyName: string;
  password: string;
}

// eslint-disable-next-line no-control-regex -- 保存の前に制御文字を除く（画面で動かない・TP-REG 守り）
const CONTROL = /[\u0000-\u001f\u007f]/g;
/** 制御文字を除き、全角を半角に直し、前後の空白を落とす。HTML は文字のまま預ける（画面は文字として出す） */
export const cleanText = (v: unknown): string =>
  String(v ?? "")
    .replace(CONTROL, "")
    .normalize("NFKC")
    .trim();
const length = (v: string): number => [...v].length;

/** 正本のエラーを、契約の口の答え（HookReply）にする */
export const fail = (code: string, field?: string): HookReply => {
  const e = kanameError(code, field ? { field } : {});
  return { status: e.status, body: e.toJSON() };
};
/** 入力を確かめる。通れば直した値、通らなければ 422 の答え */
export function parseSignup(raw: Record<string, unknown>, rawPassword: unknown): SignupInput | HookReply {
  const typed = cleanText(raw["email"]);
  // 途中の空白は打ち間違い（「a b@example.com」を ab@ にしない）。前後の空白・全角・大文字は直す
  const email = /\s/.test(typed) ? "" : normalizeEmail(typed);
  // 部品（better-auth）の z.email() が断るメールも、確かめの口で落ちる前にここで断る（K-1117）
  if (!isLoginEmail(email)) return fail("E-VAL-004", "email");
  const name = cleanText(raw["name"]);
  if (!name || length(name) > NAME_MAX) return fail("E-VAL-010", "name");
  const companyName = cleanText(raw["company_name"]);
  if (length(companyName) > COMPANY_MAX) return fail("E-VAL-016", "company_name");
  // パスワードは表記ゆらぎを直さない（打ったとおりに預ける）。契約の入口が直す前の値を使う
  const password = typeof rawPassword === "string" ? rawPassword : String(raw["password"] ?? "");
  if (length(password) < PASSWORD_MIN) return fail("E-VAL-005", "password");
  return { email, name, companyName, password };
}
export const isReply = (v: SignupInput | HookReply): v is HookReply => "status" in v;
