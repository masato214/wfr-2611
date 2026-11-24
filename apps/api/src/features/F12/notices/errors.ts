// お知らせの口（K-954 listNotices・markNoticeRead。K-955 も使う）の DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   404（見えない・無い・下書き・消した・ほかのワークスペース向け）は E-PAGE-001 で、field・details・detail を付けない（在るかを漏らさない・控え帳）。
//   想定外の例外・知らない言葉は 503・E-PAGE-003（止める側に倒す・何も書かない）。ログは口と SQLSTATE だけ（題・本文・例外の文を出さない）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラーを、欄なし・detail なしの形で */
const bare = (status: number, code: string, error?: string): HookReply => {
  const j = kanameError(code).toJSON();
  return {
    status,
    body: {
      error: error ?? j.error,
      code: j.code,
      message: j.message,
      action: j.action,
      undo: j.undo,
      support_code: j.support_code,
    },
  };
};

/** 見えない・無い（在るかを漏らさない） */
export const notFound = (): HookReply => bare(404, "E-PAGE-001");

/** 例外の SQLSTATE（無ければ例外の種類の名前） */
export const sqlState = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  if (typeof x?.code === "string" && x.code) return x.code;
  return typeof x?.name === "string" && x.name ? x.name : "Error";
};

/** DB が失敗した（503・E-PAGE-003）。ログは口と SQLSTATE だけ */
export const down = (op: string, e: unknown): HookReply => {
  console.error(`[notices] ${op} の DB が失敗した（${sqlState(e)}）`);
  return bare(503, "E-PAGE-003", "unavailable");
};

/** DB の関数の断りの言葉 → 答え。知らない言葉は止める側（言葉は記録にだけ残す） */
export function replyOfWord(op: string, word: unknown): HookReply {
  if (word === "not_found") return notFound();
  return down(op, { name: `知らない答え（${String(word)}）` });
}
