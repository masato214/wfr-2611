// 契約の口（/api/v1/conversations・/api/v1/memories/:id）を、画面の口（/api/auth-ext/agent/*）と同じ本体に通す。
// 汎用の書き込み（表に直接 insert／update）をさせない：会話と記憶は DB の関数が本人かどうかを判定する（agent-ops.ts）
import type pg from "pg";
import type { Hook, HookArgs, HookReply } from "../contract/deps.js";
import { deleteConversation, editMemory, newConversation, setConversation } from "../auth/agent-ops.js";
import { unwritable } from "../contract/op.js";
import { defineHooks } from "./registry.js";

const notFound = (code: string, message: string): HookReply => ({
  status: 404,
  body: { error: "not_found", code, message },
});
const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 契約では文字で来る（"true"／"false"）。それ以外は「変えない」 */
const flag = (v: unknown): boolean | null =>
  v === "true" || v === true ? true : v === "false" || v === false ? false : null;
/** 1 行の文（改行を空白にして前後を落とす）。人が書いたものを黙って切らない（D-130.4・K-144 ㉞）。守りは入口の送る量 1MB だけ */
const text = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim() : "";
  return s || null;
};

/** 記憶を作るとき、送られても入れない欄（本人が決めない物・持ち主は withOwner が本人にする） */
const MEMORY_UNSET_COLS = ["approved_by", "approved_at", "digest_id", "superseded_by", "owner_member_id"] as const;
/** 確かさ（confidence）の形：契約の表の型 numeric の形（05_flow/build_api.py の numeric と同じ）。直す口は使わないが、形の外は断る（K-1116）。
 *  契約の $ は Python（schemathesis）では末の改行 1 つの前でも当たるので、その 1 つは受ける（形どおりの値を断らない） */
const NUMERIC_RE = /^-?[0-9]+(\.[0-9]+)?\n?$/;
/** 入口が NFKC と前後の空白を直す前の生の確かさ（契約の形は生の字で決まる・送られていなければ undefined） */
const rawConfidence = async (a: HookArgs): Promise<unknown> => {
  const raw = (await a.c.req.json().catch(() => ({}))) as Record<string, unknown> | null;
  return raw && typeof raw === "object" ? raw["confidence"] : undefined;
};

export function agentHooks(pool: pg.Pool): Record<string, Hook> {
  const user = (a: HookArgs) => a.ctx.userId as string; // 認証（401）は op が先に済ませている
  return {
    createConversation: {
      before: async (a) => {
        const id = await newConversation(pool, user(a), flag(a.input["incognito"]) === true);
        if (!id) return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
        return { status: 201, body: { data: { id, conversation_id: id } } };
      },
    },
    updateConversation: {
      before: async (a) => {
        const title = a.input["title"] === undefined ? null : text(a.input["title"]);
        if (a.input["title"] !== undefined && !title) return invalid("title", "名前が空です");
        const ok = await setConversation(pool, user(a), a.id!, {
          title,
          starred: a.input["starred_at"] === undefined ? null : Boolean(a.input["starred_at"]),
          incognito: flag(a.input["incognito"]),
        });
        return ok
          ? { status: 200, body: { data: { id: a.id, ok: true } } }
          : unwritable(a, notFound("CONVERSATION_NOT_FOUND", "この会話はありません"));
      },
    },
    deleteConversation: {
      before: async (a) =>
        (await deleteConversation(pool, user(a), a.id!))
          ? { status: 200, body: { data: { id: a.id } } }
          : unwritable(a, notFound("CONVERSATION_NOT_FOUND", "この会話はありません")),
    },
    createMemory: {
      // 本人が決めない欄は受けて入れない（K-639）：承認した人・承認の時刻・要約・置き換え先は空のまま、持ち主は表の書き込み（withOwner）が本人にする。
      //   契約の入力の形は変えない（欄は残す）。表の書き込みは同じ入力の物を読むので、ここで落として渡す（送った値が外部キーに当たって 422 にならない）
      //   覚えること（body）は契約では文字。入口の zod は null を通すので、口が 422 で断る（無いのは 201・直す口と同じ決まり・K144-SHAPE-023）
      before: async (a) => {
        if (a.input["body"] === null) return invalid("body", "覚えることが空です");
        for (const col of MEMORY_UNSET_COLS) delete a.input[col];
      },
    },
    updateMemory: {
      before: async (a) => {
        const body = typeof a.input["body"] === "string" ? a.input["body"].trim() : "";
        if (!body) return invalid("body", "覚えることが空です");
        const confidence = await rawConfidence(a);
        if (typeof confidence === "string" && !NUMERIC_RE.test(confidence))
          return invalid("confidence", "確かさは数で入れてください");
        const ok = await editMemory(pool, user(a), a.id!, text(a.input["title"]), body);
        return ok
          ? { status: 200, body: { data: { id: a.id, ok: true } } }
          : unwritable(a, notFound("MEMORY_NOT_FOUND", "直せる記憶が見つかりません（自分の記憶だけ直せます）"));
      },
    },
  };
}

export const register = defineHooks({
  name: "agentHooks",
  make: (d) => agentHooks(d.appPool),
  fuzz: "same",
});
