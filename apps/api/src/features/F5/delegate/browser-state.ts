// PC が仕事の間に送るブラウザの様子（K-761・契約の口 reportBrowserState・POST /api/v1/bridge/jobs/:id/browser）。
//   体は { browser: chrome|dedicated, state: using|off } だけ。仕事の出来事（bridge_job_events・kind browser）に 1 行残すだけで、
//   会話・証跡・お知らせには書かない（使えなかったことは前から会話の 1 行 notice が出す）。写真・画面の写しは受けない。
//   その仕事を受け取った PC だけ・動いている仕事だけ（ほかは 404・D-128.163）。書くのは関門 C2 の関数 app.bridge_browser_report だけ。
//   ログに仕事の id・体を出さない（場所と例外の種類だけ）
import type pg from "pg";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { kanameError } from "@kaname/errors";
import { rawBody } from "./bridge.js";

export const BROWSERS = ["chrome", "dedicated"] as const;
export const STATES = ["using", "off"] as const;

const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 止める側に倒す（503・E-PAGE-003）。ログには場所と言葉の種類だけ */
const down = (where: string, word: string): HookReply => {
  console.error(`[${where}] 止める側に倒した（${word}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const gone = (): HookReply => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 体の 2 つの欄を確かめる（入口が知らない項目・文字でない値を先に 422 にしている）。不正なら欄つきの 422 */
export function checkBrowserState(b: Record<string, unknown>): { browser: string; state: string } | HookReply {
  const browser = b["browser"];
  const state = b["state"];
  if (typeof browser !== "string" || !(BROWSERS as readonly string[]).includes(browser))
    return invalid("browser", "chrome か dedicated");
  if (typeof state !== "string" || !(STATES as readonly string[]).includes(state))
    return invalid("state", "using か off");
  return { browser, state };
}

export function browserStateHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    reportBrowserState: {
      before: async (a: HookArgs) => {
        const sid = a.ctx.sessionId ?? null;
        if (!sid) return gone();
        const v = checkBrowserState(await rawBody(a));
        if ("status" in v) return v;
        let r: { error?: string; ok?: boolean } | null;
        try {
          r =
            (
              await pool.query<{ v: { error?: string; ok?: boolean } | null }>(
                "select app.bridge_browser_report($1, $2, $3, $4) as v",
                [sid, a.id, v.browser, v.state],
              )
            ).rows[0]?.v ?? null;
        } catch (e) {
          console.error(`[browser-state] 様子を書けなかった（${kindOf(e)}）`);
          return down("browser-state", "db");
        }
        if (r?.error === "not_found") return notFound();
        if (r?.error === "bad_value") return invalid("browser", "chrome か dedicated・using か off");
        if (r?.ok !== true) return down("browser-state", String(r?.error ?? "empty"));
        return { status: 201, body: { data: { ok: true } } };
      },
    },
  };
}
