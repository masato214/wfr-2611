// 契約の 1 operation を Hono の handler にする。順序は固定：送る量（413・1MB）→ 上限（429）→ 認証（401）→ 認可（403）→ 入力の検証（422・表記ゆらぎの正規化）→ 冪等（409／再送は最初の結果）→ hooks.before → 副作用（hooks.effect・失敗は 502 で記録しない）→ 記録（関門 C2）→ hooks.after
import { createHash } from "node:crypto";
import type { Context } from "hono";
import { ENDPOINTS, isUuid, type EndpointDef } from "@kaname/contracts";
import { SCHEMAS } from "@kaname/contracts/schemas";
import type { Row, TableName } from "@kaname/db/repository";
import type { Vars } from "../middleware/tenant.js";
import type { ContractDeps, Hook, HookArgs, HookReply } from "./deps.js";
import type { TenantContext } from "@kaname/db/context";
import { checkFor, stepUpFresh, stepUpOrFreshLogin } from "./permissions.js";
import { kanameError } from "@kaname/errors";
export type { ContractDeps } from "./deps.js";

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;
type Ctx = Context<Vars>;
type ErrBody = {
  error: string;
  code: string;
  message?: string;
  details?: { field: string; message: string }[];
  retry_after_sec?: number;
  handoff?: string;
};

const err = (c: Ctx, status: number, error: string, code: string, extra: Partial<ErrBody> = {}) =>
  c.json({ error, code, ...extra } as ErrBody, status as 400);
const ipOf = (c: Ctx) =>
  c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
const hashOf = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
/** 表記ゆらぎ：全角半角・前後の空白を揃えてから判定する（サーバーが最後の砦） */
export function normalize(v: unknown): unknown {
  if (typeof v === "string") return v.normalize("NFKC").trim();
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, normalize(x)]));
  return v;
}
/** 入口の NUL（K-427・D-130.2）：PostgreSQL の text・jsonb は NUL（U+0000）を入れられず、落ちると 500 になる。
 *  どこにあっても形の誤りとして断る。文字列の値と、オブジェクトのキーを入れ子の中まで見る。
 *  欄の名前は入れ子の道（親.子・配列は親.0・根は body）。キーの NUL は、キーを出さずそのキーを持つオブジェクトの道を返す */
export function nulIssues(v: unknown, path: string): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  const stack: [unknown, string][] = [[v, path]];
  while (stack.length) {
    const [x, at] = stack.pop()!;
    if (typeof x === "string") {
      if (x.includes("\u0000")) out.push({ field: at, message: "使えない文字" });
    } else if (Array.isArray(x)) {
      x.forEach((e, i) => stack.push([e, `${at}.${i}`]));
    } else if (x && typeof x === "object") {
      for (const [k, e] of Object.entries(x as Record<string, unknown>)) {
        // キーに NUL があれば、キーを出さず親の道で 1 件だけ。その下には降りない（下の道にキーの NUL が入るため）
        if (k.includes("\u0000")) {
          out.push({ field: at, message: "使えない文字" });
          continue;
        }
        stack.push([e, at === "body" ? k : `${at}.${k}`]);
      }
    }
  }
  return out;
}
// 続きの印は、何件目から読むかの数（10 進の文字列・最大 9 桁）。画面はもらったものを返すだけ（契約は pattern で書ける形にした・K-35）
//   鍵の文字列（base64url の 1〜200 字）を受けると宣言した口（KEY_CURSOR_OPS）だけは、鍵の文字列も通す。中身（鍵の形）はその口が確かめる（D-131.9・K-161）。
//   宣言の無い一覧の口は今までどおり位置の数だけ（契約の生成器 05_flow/build_api.py の KEY_CURSOR_OPS と同じ集まり）
export const KEY_CURSOR_OPS: ReadonlySet<string> = new Set(["listApprovalQueue", "listNotifications", "listTickets"]);
const encodeCursor = (n: number) => String(n);
const decodeCursor = (s: string | undefined, keyed = false): number | null => {
  if (!s) return 0;
  if (keyed) return /^[A-Za-z0-9_-]{1,200}$/.test(s) ? 0 : null;
  return /^[0-9]{1,9}$/.test(s) ? Number(s) : null;
};
const isRlsError = (e: unknown) => /row-level security|permission denied/.test(String(e));
const pgCode = (e: unknown) => (e as { code?: string }).code ?? "";

const STEP_UP_REQUIRED: HookReply = {
  status: 403,
  body: { error: "step_up_required", code: "STEP_UP_REQUIRED", message: "本人確認を取り直してから" },
};
/** hooks に渡す本人確認の守り 2 つ（入口の HookArgs もこれを使う）。通れば undefined、通らなければ 403・STEP_UP_REQUIRED
 *  requireStepUp：直前 15 分の取り直し（D-125.139）／requireStepUpOrFreshLogin：取り直しかログインから 15 分の内（K-308） */
export function stepUpGuards(
  ctx: TenantContext,
  now?: number,
): Required<Pick<HookArgs, "requireStepUp" | "requireStepUpOrFreshLogin">> {
  return {
    requireStepUp: () => (stepUpFresh(ctx, now ?? Date.now()) ? undefined : STEP_UP_REQUIRED),
    requireStepUpOrFreshLogin: () => (stepUpOrFreshLogin(ctx, now ?? Date.now()) ? undefined : STEP_UP_REQUIRED),
  };
}

/** 同意し直しが要る（403・E-AUTH-010）。文は正本（errors.json）から引く */
export const termsRequired = (c: Context) => {
  const e = kanameError("E-AUTH-010").toJSON() as { message?: string };
  return c.json({ error: "forbidden", code: "E-AUTH-010", message: e.message ?? "" }, 403);
};

/** 付けるまで進めない（403・MFA_REQUIRED・K-321・D-128.141）：パスキーも 2 段階も無い人のセッション。文は正本（errors.json の E-AUTH-019）から引く */
export const mfaRequired = (c: Context) => {
  const e = kanameError("E-AUTH-019").toJSON() as { message?: string };
  return c.json({ error: "forbidden", code: "MFA_REQUIRED", message: e.message ?? "" }, 403);
};

/** 入口の止めでセッションを解けなかった（K-53）：止める側に倒して 503・E-PAGE-003。ログには理由の種類だけ（メール・IP・トークンを出さない） */
export const sessionUnresolved = (c: Context, where: string, e: unknown) => {
  console.error(`[terms] ${where}：セッションを解けなかったので止めた（${(e as Error)?.name ?? "Error"}）`);
  const x = kanameError("E-PAGE-003").toJSON() as { message?: string; action?: string };
  return c.json({ error: "unavailable", code: "E-PAGE-003", message: x.message ?? "", action: x.action ?? "" }, 503);
};

/** 守りの判定（会社から抜けた人か・行に結ぶ言葉）の所で例外になった：通さず止める側に倒して 503・E-PAGE-003（fail-closed・D-131.7・K-166）。
 *  ログには口の名前・場所・例外の種類だけ（id・中身を出さない） */
const guardDown = (c: Ctx, operationId: string, where: string, e: unknown) => {
  console.error(`[contract] ${operationId} の${where}で例外：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  const x = kanameError("E-PAGE-003").toJSON() as { message?: string; action?: string };
  return c.json({ error: "unavailable", code: "E-PAGE-003", message: x.message ?? "", action: x.action ?? "" }, 503);
};

/** 入口の uuid（D-129.42・K-144）：契約で format: uuid の道の値と問い合わせ（registry の uuidParams）が正式な uuid か。
 *  道の値は届いたまま確かめる（中で使う値と同じもの）。問い合わせの空の値（?x=）は指定なし。*_ids はカンマ区切りの中身を 1 つずつ */
function uuidParamIssues(c: Ctx, def: EndpointDef): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  for (const name of def.uuidParams) {
    const inPath = def.path.includes(`:${name}`);
    const v = inPath ? (c.req.param(name) ?? "") : (c.req.query(name) ?? "");
    if (!inPath && v === "") continue;
    const values = !inPath && name.endsWith("_ids") ? v.split(",") : [v];
    if (!values.every(isUuid)) out.push({ field: name, message: "uuid" });
  }
  return out;
}
/** 送る量の守り（D-130.1・K-144 ㉚㊱）：体を受ける口（POST・PATCH・PUT）が 1 回に受ける内容全体の上限。自由に書く欄の上限ではなく、サーバーを守るためだけ */
export const BODY_MAX_BYTES = 1_048_576;
export const TOO_LARGE = {
  error: "payload_too_large",
  code: "PAYLOAD_TOO_LARGE",
  message: "送る内容が大きすぎます",
} as const;
/** 体を読みながら数える。上限を超えたら読むのをやめて（流れを取り消して）null。content-length の頭が上限を超えていれば 1 バイトも読まない。
 *  頭が無い・小さく偽っていても、読んだ量で止める（全部を読んでから数えない・1 回の要求のメモリを上限と読みかけの 1 かたまりまでにする・G-16） */
export async function readBodyLimited(c: Pick<Context, "req">): Promise<string | null> {
  const declared = Number(c.req.header("content-length"));
  if (Number.isFinite(declared) && declared > BODY_MAX_BYTES) return null;
  const stream = c.req.raw.body;
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > BODY_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
/** 体の確かめの理由：uuid の形で落ちた欄は "uuid"（道の値と同じ。zod の英語の文を出さない）。ほかは zod のまま */
const issueMessage = (i: { code: string; message: string; format?: string }) =>
  i.code === "invalid_format" && i.format === "uuid" ? "uuid" : i.message;

/** 1 要求を 1 つの取引にまとめる hooks の口（K-234）：DB だけを読む口に限る。外を待つ口（目録を外から読む・関門 C4 で署名する）や
 *  プールに直に問い合わせる口は入れない（外を待つ間に取引と接続を握ると、読む口ぜんぶが接続を取り合う・G-16）。
 *  hooks の無い GET の口（関門 C2 の repository だけで読む）は一覧に無くてもまとめる */
export const ONE_TX_HOOKS: ReadonlySet<string> = new Set([
  "listScopes",
  "listTicketKinds",
  "getTicket",
  "listTicketRuns",
  "listTicketTimeline",
  "getActionRun",
  "listApprovalQueue",
  "getApproval",
  "listMyTicketDrafts",
  "listTickets",
  "listSetupTasks",
]);

export function op(deps: ContractDeps, operationId: string) {
  const e = ENDPOINTS.find((x) => x.operationId === operationId);
  if (!e) throw new Error(`契約に無い operation: ${operationId}`);
  const def: EndpointDef = e;
  const schema = def.input ? (SCHEMAS[def.input] ?? null) : null;
  if (def.input && !schema) throw new Error(`schema が無い: ${def.input}`);
  const handle = handler(deps, operationId, def, schema);
  // 社内の人の読む口（GET）のうち DB だけを読む口は、要求の中の withTenant を 1 つの取引にまとめる（K-234・遅く開く）。ほかは今のまま
  return async (c: Ctx) => {
    const ctx = c.get("ctx");
    const hook = deps.hooks[operationId];
    const repo = c.get("repo");
    // 要求の取引を開けない repo（関門 C2 の本物でない差し替え）は今のまま（取引をまとめないだけで振る舞いは同じ）
    if (
      def.method === "GET" &&
      ctx.role === "member" &&
      (!hook || ONE_TX_HOOKS.has(operationId)) &&
      typeof repo.inRequest === "function"
    )
      return repo.inRequest(ctx, () => handle(c));
    return handle(c);
  };
}

function handler(deps: ContractDeps, operationId: string, def: EndpointDef, schema: (typeof SCHEMAS)[string] | null) {
  return async (c: Ctx) => {
    // 0) 送る量の守り（D-130.1・K-144 ㉚㊱）：上限・認証・権限・501 より前の一番最初。超えたら振る舞いに届かず何も書かない。
    //    読んだ体は 4) の JSON の読みに使い（2 回読まない）、hooks が c.req.json() で読んでも同じ中身になるよう Hono の器に入れる
    let bodyText: string | null = null;
    if (def.kind === "create" || def.kind === "update") {
      bodyText = await readBodyLimited(c);
      if (bodyText === null) return c.json(TOO_LARGE, 413);
      (c.req.bodyCache as unknown as { text?: Promise<string> }).text = Promise.resolve(bodyText);
    }
    const perMinute = deps.limits?.[operationId] ?? def.rateLimit.perMinute;
    const ctx = c.get("ctx");
    const repo = c.get("repo");
    // 1) 上限
    //    PC の印で来た要求は PC ごとに数える（同じ人の PC が何台あっても 1 台ずつの上限・代表の答え answer=431fc50df51b・K-355）
    const who = ctx.role === "device" && ctx.sessionId ? ctx.sessionId : ctx.userId;
    const key = def.rateLimit.key === "user" && who ? who : ipOf(c);
    if (!deps.limiter(operationId, perMinute).take(`${operationId}:${key}`))
      return err(c, 429, "rate_limited", "RATE_LIMITED", { retry_after_sec: 60 });
    // 2) 認証・3) 認可（役）
    if (def.auth !== "public") {
      if (ctx.role === "anonymous" || !ctx.userId) return err(c, 401, "unauthenticated", "UNAUTHENTICATED");
      // 2.5) 同意し直し（K-53・D-125.162）：ログインしたときに今の版の規約に同意していないセッションは、規約の口・ログアウト・自分の取得の
      //      ほかを止める。副作用の前・記録も書かない。画面の表示に頼らず口で止める（PC のセッションには印が立たない・D-128.137）
      //      止めない口は契約の termsOpen（正本は 05_flow/screen_api.py の TERMS_OPEN_OPS）
      if (c.get("termsPending") && !def.termsOpen) return termsRequired(c);
      // 2.55) 付けるまで進めない（K-321・D-128.141・代表の答え ⑮）：パスキーも 2 段階も無い人のセッション（印 mfa_pending）は、
      //      安全の設定を読む・2 段階を付ける・取り直し・ログアウト・自分の取得・規約の口のほかを止める。同意し直しの次・役と権限より前・副作用の前・記録も書かない。
      //      PC のセッションには印が立たない（D-128.137）。止めない口は契約の mfaOpen（正本は 05_flow/screen_api.py の MFA_OPEN_OPS）
      if (c.get("mfaPending") && !def.mfaOpen) return mfaRequired(c);
      // 役は契約の auth と合うものだけ通す（合わなければ止める・ZT2・ZT4・ZT10）
      //   ops：運営の人だけ ／ client：取引先の人だけ（/portal/ の API）／ device：PC の印だけ（/bridge/ の API）
      //   member：社内の人。取引先の人と PC の印は通さない。運営は「中を見る」の許可がある間だけ
      if (def.auth === "ops" && ctx.role !== "ops") return err(c, 403, "forbidden", "FORBIDDEN");
      if (def.auth === "client" && ctx.role !== "client") return err(c, 403, "forbidden", "FORBIDDEN");
      if (def.auth === "device" && ctx.role !== "device") return err(c, 403, "forbidden", "FORBIDDEN");
      if (def.auth === "member") {
        // PC の印は、本人か PC の印で呼べる口（self_or_device）だけ通す
        if (ctx.role === "client" || (ctx.role === "device" && def.perm.word !== "self_or_device"))
          return err(c, 403, "forbidden", "FORBIDDEN");
        if (ctx.role === "ops" && !(await repo.opsAllowed(ctx))) return err(c, 403, "forbidden", "FORBIDDEN");
      }
      // 2.6) 会社から抜けた人（members.deleted_at・セッションは残っている）は、行に結ぶ確かめ（4.1）より前に 403 で止める
      //      （404 でない・何も書かない・全部の口・D-131.7 ②・K-166）。止められた人はここでは見ない（各関数が 403）。判定できなければ 503。
      //      引くのは関門 C2 の repo.memberLeft（要求の文脈を決める middleware/tenant.ts が、同じ文脈で結んで渡す）
      if (ctx.role === "member") {
        let left: boolean;
        try {
          left = (await c.get("memberLeft")?.()) === true;
        } catch (ex) {
          return guardDown(c, operationId, "抜けた人の確かめ", ex);
        }
        if (left) return err(c, 403, "forbidden", "FORBIDDEN");
      }
    }
    // 3.0) 入口の uuid（D-129.42・K-144）：道の値と問い合わせの id を、id で行を引く権限の確かめ（3.1・4.1）とまだ作っていない口の 501 より前に
    //      正式な uuid か確かめる。形の違う id が DB の ::uuid に届いて 500 にならないように
    const badIds = uuidParamIssues(c, def);
    if (badIds.length) return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: badIds });
    // 3.0b) 入口の NUL（K-427）：道の値・問い合わせの値のどれかに NUL があれば、uuid と同じ所で 422（送った字は答えに出さない）
    const badNul = [
      ...Object.entries(c.req.param()).flatMap(([k, v]) => nulIssues(v, k)),
      ...Object.entries(c.req.queries()).flatMap(([k, vs]) =>
        k.includes("\u0000") ? [{ field: "query", message: "使えない文字" }] : vs.flatMap((v) => nulIssues(v, k)),
      ),
    ];
    if (badNul.length) return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: badNul });
    // 3.1) 権限の言葉の段（K-14）：admin の能力・運営のできること など。行に結ぶ言葉は 4.1 で :id の行を読んで確かめる（K-15）
    if (def.auth !== "public") {
      const check = checkFor(def.perm.word);
      const pid = def.path.includes(":id") ? (c.req.param("id") ?? null) : null;
      if (check && !(await check({ e: def, ctx, repo, id: pid }))) return err(c, 403, "forbidden", "FORBIDDEN");
      // 3.2) 本人確認の取り直し（いつも要る口）：直前 15 分以内でなければ止める（D-125.139）。条件つきの口は hooks が requireStepUp で確かめる
      if (def.perm.stepUp === "always" && !stepUpFresh(ctx))
        return err(c, 403, "step_up_required", "STEP_UP_REQUIRED", { message: "本人確認を取り直してから" });
    }
    // 3.5) まだ作っていない口は止める（fail-closed・D-128.113）。表の素の読み書きでない口は hooks に振る舞いが無ければ 501。
    //      素の読み書きでも、表がまだ DB に無ければ 501。共通の処理が「承認する」を「承認の行を作る」に取り違えることを防ぐ
    if (!deps.hooks[operationId] && (!def.generic || !repo.hasColumn(def.table as TableName, "id")))
      return err(c, 501, "not_implemented", "NOT_IMPLEMENTED", { message: "契約にある口だが、まだ作っていない" });
    // 4) 入力
    //    道の id は 3.0 で正式な uuid と確かめ済み（:id は契約で format: uuid）
    const id = def.path.includes(":id") ? (c.req.param("id") ?? "") : null;
    // 4.1) 行に結ぶ言葉（K-15・ZT4）：:id の行を行の守りの中で読み、見えなければ 404（無いのと同じ）・言葉の中の人でなければ 403
    //      本人・担当者・承認する人・受ける人・マネージャー・書ける人。条件は契約の perm.row（scripts/ci/row_rules.mjs）
    if (id !== null && def.perm.row && def.auth === "member") {
      //      判定の所で例外になったら通さず 503・E-PAGE-003（fail-closed・決める人の答え 75b89fd38579・K-166）
      let r: Awaited<ReturnType<typeof repo.rowAllowed>>;
      try {
        r = await repo.rowAllowed(ctx, def.perm.row.table, id, def.perm.row.sql);
      } catch (ex) {
        return guardDown(c, operationId, "行の守り", ex);
      }
      if (r === "missing") return err(c, 404, "not_found", "NOT_FOUND");
      if (r === "denied" || r === "gone") return err(c, 403, "forbidden", "FORBIDDEN"); // gone：会社から抜けた人（D-131.7）
    }
    let input: Row = {};
    if (def.kind === "create" || def.kind === "update") {
      let raw: unknown;
      try {
        raw = normalize(JSON.parse(bodyText ?? ""));
      } catch {
        return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: [{ field: "body", message: "JSON" }] });
      }
      // 体の NUL（K-427）：口の前処理・契約の形より前に断る
      const badBodyNul = nulIssues(raw, "body");
      if (badBodyNul.length) return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details: badBodyNul });
      // 口の前処理（K-53 の同意：同意の印が無いのを正本のエラーで返す）。前処理の後も、必ず契約の strict な形で確かめる（知らない項目は 422・K-144）
      const pre = deps.hooks[operationId]?.input?.(raw);
      if (pre && "reply" in pre) return c.json(pre.reply.body, pre.reply.status as 400);
      const parsed = schema!.safeParse(pre ? pre.input : raw);
      if (!parsed.success)
        return err(c, 422, "validation_failed", "VALIDATION_ERROR", {
          details: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: issueMessage(i) })),
        });
      input = parsed.data as Row;
    }
    let list: { where: Row; limit: number; offset: number; orderBy?: string } | null = null;
    if (def.kind === "list") {
      // 空の値（?limit=）は「指定なし」と同じ（画面の検索欄が空のまま送っても 422 にしない・K-35）
      const q = Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ""));
      const limit = q["limit"] === undefined ? LIMIT_DEFAULT : Number(q["limit"]);
      const offset = decodeCursor(q["cursor"], KEY_CURSOR_OPS.has(operationId));
      const details: { field: string; message: string }[] = [];
      if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX)
        details.push({ field: "limit", message: `1〜${LIMIT_MAX}` });
      if (offset === null) details.push({ field: "cursor", message: "不正" });
      if (q["scope_id"] !== undefined && !isUuid(q["scope_id"])) details.push({ field: "scope_id", message: "uuid" });
      else if (q["scope_id"] !== undefined && !def.ignoresScope && !repo.hasColumn(def.table as TableName, "scope_id"))
        details.push({ field: "scope_id", message: "この一覧はグループで絞れない" });
      if (
        q["sort"] !== undefined &&
        (!/^[a-z_][a-z0-9_]{0,62}$/.test(q["sort"]) || !repo.hasColumn(def.table as TableName, q["sort"]))
      )
        details.push({ field: "sort", message: "列名" });
      if (details.length) return err(c, 422, "validation_failed", "VALIDATION_ERROR", { details });
      list = {
        where: q["scope_id"] ? { scope_id: q["scope_id"] } : {},
        limit,
        offset: offset!,
        ...(q["sort"] ? { orderBy: q["sort"] } : {}),
      };
    }
    // 5) 冪等（POST）。同じキーで同時に来た要求は、先に来た 1 本の結果を待って同じ結果を返す（記録は 1 回）
    const idem =
      def.kind === "create" && !deps.hooks[operationId]?.noIdempotency ? c.req.header("idempotency-key") : undefined;
    const idemKey = idem ? `${ctx.tenantId}:${ctx.userId}:${def.path}:${idem}` : null;
    const inputHash = hashOf(input);
    if (idemKey) {
      const pending = INFLIGHT.get(idemKey); // 同期で見る（await を挟むと同時の要求がすり抜ける）
      const seen = deps.idempotency.get(idemKey) ?? (pending ? await pending : undefined);
      if (seen) {
        if (seen.hash !== inputHash) return err(c, 409, "conflict", "CONFLICT", { message: "同じ冪等キーで違う内容" });
        return c.json(seen.body, seen.status as 200); // 最初の結果を返し、副作用を繰り返さない
      }
    }
    const args: HookArgs = {
      e: def,
      ctx,
      repo,
      input,
      id,
      c,
      ...stepUpGuards(ctx),
    };
    const run = execute(deps.hooks[operationId], args, list).then((r) => ({ hash: inputHash, ...r }));
    if (idemKey)
      INFLIGHT.set(
        idemKey,
        run.catch(() => undefined),
      );
    try {
      const r = await run;
      if (r.raw) return r.raw; // ファイルを流す・置き場へ渡す（冪等の器には入れない）
      if (idemKey && r.status < 300) deps.idempotency.set(idemKey, r);
      return c.json(r.body, r.status as 200);
    } finally {
      if (idemKey) INFLIGHT.delete(idemKey);
    }
  };
}

export type Reply = { status: number; body: unknown; raw?: Response };
/** 同じ冪等キーで処理中の要求（キーに会社・本人を含む）。終わったら消え、結果は idempotency の器に残る */
const INFLIGHT = new Map<string, Promise<(Reply & { hash: string }) | undefined>>();
/** 入力が DB の決まりに合わないときの番号：外部キー・形・null・数の桁あふれ・check 違反 */
const DB_INPUT_CODES = new Set(["23503", "22P02", "23502", "22003", "23514", "22021", "22P05"]);
/** 入力が DB の決まりに合わずに落ちた例外なら、記録に書く番号（と制約の名前）を返す。違えば null。
 *  契約の口（下の execute）と口の外（app.ts の onError・前の道すじの 2 層目・K-145）で同じ写しを使う */
export function dbInputFailure(ex: unknown): { code: string; constraint: string | null } | null {
  const code = pgCode(ex);
  if (!DB_INPUT_CODES.has(code) && !/許可されていない識別子/.test(String(ex))) return null;
  const constraint = (ex as { constraint?: unknown }).constraint;
  return { code: code || "identifier", constraint: typeof constraint === "string" && constraint ? constraint : null };
}
/** DB の決まりに合わないときの答え（D-130.2）：決まった文だけ。DB の文・送った値は出さない */
export const DB_INPUT_REPLY = {
  error: "validation_failed",
  code: "VALIDATION_ERROR",
  details: [{ field: "body", message: "入力内容を確認してください" }],
} as const;
const fail = (status: number, error: string, code: string, extra: Partial<ErrBody> = {}): Reply => ({
  status,
  body: { error, code, ...extra },
});

/** 6) ポリシー・承認 → 7) 副作用（外向き・関門経由・記録の前。失敗は 502 で記録しない）→ 8) 記録（関門 C2・RLS）→ 9) 記録の後 */
async function execute(
  hook: Hook | undefined,
  args: HookArgs,
  list: { where: Row; limit: number; offset: number; orderBy?: string } | null,
): Promise<Reply> {
  const { e: def, ctx, repo, input, id } = args;
  if (hook?.before) {
    const r = await hook.before(args);
    if (r) return r;
  }
  if (hook?.effect) {
    const r = await hook.effect(args);
    if (r.status !== "done")
      return r.status === "denied"
        ? fail(403, "forbidden", "FORBIDDEN", { message: r.reason, handoff: r.handoff })
        : fail(502, "external_failed", "EXTERNAL_FAILED", { message: r.reason, handoff: r.handoff });
  }
  const table = repo.table(def.table as TableName);
  let body: unknown;
  try {
    if (def.kind === "list") {
      const rows = await table.list(ctx, { ...list!, limit: list!.limit + 1 });
      const data = rows.slice(0, list!.limit);
      body = {
        data,
        meta: {
          limit: list!.limit,
          ...(rows.length > list!.limit ? { cursor: encodeCursor(list!.offset + list!.limit) } : {}),
        },
      };
    } else if (def.kind === "get") {
      const row = await table.get(ctx, id!);
      if (!row) return fail(404, "not_found", "NOT_FOUND");
      body = { data: row };
    } else if (def.kind === "create") {
      body = { data: await table.create(ctx, withOwner(args, await withScope(args, input))) };
    } else if (def.kind === "update") {
      const row = await table.update(ctx, id!, input);
      if (!row) return await unwritable(args);
      body = { data: row };
    } else if (def.table === "tickets") {
      // チケットは行の守りが消したもの（deleted_at）を外すので、共通の softDelete（更新した行を select の守りで読む）は弾かれる。
      //   消すのは関門 C2 の app.ticket_soft_delete だけ（見えて edit を持つときだけ消して true・記録も書く・K-92・D-128.158）。
      //   行の守りの中で :id の行を読んで関数を呼ぶ（見えない＝404・消せない＝403）
      const r = await repo.rowAllowed(ctx, "tickets", id!, "app.ticket_soft_delete(tickets.id)");
      if (r === "missing") return fail(404, "not_found", "NOT_FOUND");
      if (r !== "ok") return fail(403, "forbidden", "FORBIDDEN");
      body = { data: { id } };
    } else {
      if (!(await table.softDelete(ctx, id!))) return await unwritable(args);
      body = { data: { id } };
    }
  } catch (ex) {
    if (isRlsError(ex) || /追記専用/.test(String(ex))) return fail(403, "forbidden", "FORBIDDEN"); // RLS が弾いた＝権限なし／追記専用は直接書けない。副作用は起きていない
    const code = pgCode(ex);
    if (code === "23505") return fail(409, "conflict", "CONFLICT", { message: "既に登録済み" });
    if (/決まった承認は変えられません/.test(String(ex)))
      return fail(409, "conflict", "CONFLICT", { message: "この承認はもう決まっています" });
    // 入力が DB の決まりに合わない（外部キー・形・null・桁あふれ・check・許されない識別子）：422。答えには決まった文だけを出し（D-130.2）、
    //   ログには DB の答えの番号と制約の名前だけを残す（K-144 ㉓㉙㊳）。DB の文・詳しい説明は送った値を含むので出さない
    const dbIn = dbInputFailure(ex);
    if (dbIn) {
      console.error("[api] 422", def.method, def.path, dbIn.code, ...(dbIn.constraint ? [dbIn.constraint] : []));
      return { status: 422, body: DB_INPUT_REPLY };
    }
    throw ex;
  }
  if (hook?.after) {
    try {
      await hook.after(args, (body as { data: Row | Row[] }).data);
    } catch {
      /* 記録の後の通知の失敗で応答を落とさない（再送は関門 C6 の仕事） */
    }
  }
  return { status: def.success, body };
}
/** 書けなかった行：見えるのに書けない＝権限なし（403）／見えない＝無い（404。ほかの会社の行があるかどうかは教えない） */
export async function unwritable(
  a: Pick<HookArgs, "e" | "ctx" | "repo" | "id">,
  notFound: Reply = fail(404, "not_found", "NOT_FOUND"),
): Promise<Reply> {
  const visible = a.id ? await a.repo.table(a.e.table as TableName).get(a.ctx, a.id) : null;
  return visible ? fail(403, "forbidden", "FORBIDDEN") : notFound;
}
/** 本人の口（self）の作成：持ち主の列は呼んだ人に決める（入力の値は使わない。他人を持ち主にして作らせない・K-17） */
const OWNER_COLS = ["owner_member_id", "opened_by_member_id", "member_id", "requested_by", "uploaded_by"] as const;
function withOwner(a: HookArgs, input: Row): Row {
  if (a.e.perm.word !== "self" || !a.ctx.userId) return input;
  const col = OWNER_COLS.find((c) => a.repo.hasColumn(a.e.table as TableName, c));
  return col ? { ...input, [col]: a.ctx.userId } : input;
}
/** 層を持つ表の作成：契約の入力に scope_id は無い（自分の範囲＝本人の層）。tenant_id は関門が入れる */
async function withScope(a: HookArgs, input: Row): Promise<Row> {
  if ("scope_id" in input || !a.ctx.userId || !a.repo.hasColumn(a.e.table as TableName, "scope_id")) return input;
  const me = await a.repo.table("members").get(a.ctx, a.ctx.userId);
  return me?.["scope_id"] ? { ...input, scope_id: me["scope_id"] } : input;
}
