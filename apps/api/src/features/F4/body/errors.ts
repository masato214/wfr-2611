// 本文を書き終える（K-432）・版を戻す（K-433）の DB の答え（app.ticket_body_set の {error: …}）を HTTP の答えにする。
//   404・409 の体は { error, code }（409 は message）だけ。field・details・detail を付けない（在るかを漏らさない・誰が直したかは答えに入れない・控え帳 2026-11-20 20:50・2026-11-21 01:15）
//   文は正本（errors.json）から引く
import { KanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

export const BODY_ERRORS = ["forbidden", "not_found", "not_writable", "done", "conflict", "invalid"] as const;
export type BodyErrorKind = (typeof BODY_ERRORS)[number];

const conflict = (code: string): HookReply => ({
  status: 409,
  body: { error: "conflict", code, message: new KanameError(code).entry.message },
});

/** 書けなかった理由 → HTTP の答え。知らない理由は書けなかった扱い（503）に倒す */
export function bodyReply(kind: string): HookReply {
  switch (kind) {
    case "forbidden":
    case "not_writable":
      return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
    case "not_found":
      return { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    case "conflict":
      return conflict("E-SEC-004");
    case "done":
      return conflict("E-SEC-005");
    case "invalid":
      return {
        status: 422,
        body: {
          error: "validation_failed",
          code: "VALIDATION_ERROR",
          details: [{ field: "doc", message: "本文の形が決まりに合いません" }],
        },
      };
    default:
      return unavailable();
  }
}

/** 書く DB が落ちた：503・E-PAGE-003（本文・題名を出さない） */
export function unavailable(): HookReply {
  const e = new KanameError("E-PAGE-003");
  return {
    status: 503,
    body: { error: "dependency", code: "E-PAGE-003", message: e.entry.message, action: e.entry.action },
  };
}
