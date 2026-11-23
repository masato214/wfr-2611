// 認証の拡張ルート（/api/auth-ext/*・境界 B2 の外側の口）。Better Auth の /api/auth/* に無い「Kaname としての段取り」：
//   登録（会社を作る hook はパッケージ側）・ロック付きログイン・Bridge の接続コード・資格情報を預ける（関門 C8）
// 契約（08_api）の外なのは、認証の操作が Better Auth の口に属するため（T-F-05）。画面のタスク T-U-01〜05／09／10 が使う
import { agentToolRoutes } from "./agent-tools.js";
import { BROWSER_CHECK_PROMPT, BROWSERS, ONBOARD_REMEMBER, type Browser } from "./conventions.js";
import { Hono } from "hono";
import { CATALOG } from "@kaname/errors";
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { createDeviceResolver, createSessionResolver, type Resolved } from "@kaname/auth/resolver";
import { mfaRequired, readBodyLimited, sessionUnresolved, termsRequired, TOO_LARGE } from "../contract/op.js";
import { BRIDGE_PROTOCOL_MIN } from "../features/F3/connect-pc/hooks.js";
import type { Repository } from "@kaname/db/repository";
import { withTenant } from "@kaname/db/context";
import type { SecretsGateway } from "@kaname/secrets";
import type { ObjectStore } from "@kaname/storage";
import { agentRoutes, jobOptions, jobOptionsIssue } from "./agent.js";
import { badId, idOf, idOrNull, isBridgeKeyShape, queryId } from "./ids.js";
import { agentStreamRoutes } from "./agent-stream.js";
import type { MemberHub } from "@kaname/db/listen";

export interface AuthExtDeps {
  auth: Auth;
  appPool: pg.Pool;
  authPool: pg.Pool;
  repo: Repository;
  secrets: SecretsGateway;
  /** 資料の置き場（関門 C4）。無ければ資料は付けられない（E-CHAT-002） */
  objects?: ObjectStore;
  config: {
    secretsMasterKey: string;
    baseUrl: string;
    webBaseUrl: string | null;
    opsEmail: string;
    env: "development" | "staging" | "production" | "test";
    /** Bridge の配布物の置き場（Kaname のサーバー）。空なら「まだ配布していません」 */
    bridgeReleaseBase?: string;
    /** 手元のフォルダから配る（署名と置き場が決まる前の橋渡し） */
    bridgeReleaseDir?: string;
  };
  mailer?: (m: {
    to: string;
    subject: string;
    text: string;
    url: string;
    kind: "verify" | "reset" | "code" | "new_device" | "ops_setup"; // ops_setup は K-945（運営の人を足す口 K-985 が送る）
  }) => Promise<void>;
  /** 会話が変わった知らせ（D-113）。無ければ /agent/stream は 503 で、画面は見に行く形のまま */
  hub?: MemberHub | null;
}
/** 会社の名前を外枠に出す形にする：前後の空白（全角を含む）を取り、空なら null。長くても切らない（画面が詰める・K-253） */
export function workspaceName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.trim();
  return name === "" ? null : name;
}
/** 届かなかった答えを、自分のAI への指示に添える文にする（問い：答え）。無ければ空 */
export function carriedAnswers(v: unknown): string {
  const list = Array.isArray(v)
    ? (v as {
        tool?: string;
        questions?: { question?: string }[];
        answers?: Record<string, string>;
        allow?: boolean;
        note?: string | null;
      }[])
    : [];
  const lines: string[] = [];
  for (const a of list) {
    if (a.tool === "AskUserQuestion" || (a.answers && Object.keys(a.answers).length)) {
      const qs = (a.questions ?? []).map((q) => String(q.question ?? "")).filter(Boolean);
      const ans = a.answers ?? {};
      for (const q of qs.length ? qs : Object.keys(ans)) lines.push(`- ${q}：${ans[q] ?? "（答えなし）"}`);
    } else if (a.tool) {
      lines.push(`- ${a.tool} の実行：${a.allow ? "許可した" : "許可しなかった"}`);
    }
    if (a.note) lines.push(`  （一言：${String(a.note).slice(0, 400)}）`);
  }
  if (!lines.length) return "";
  return `（前に出した問い合わせに、本人はもう答えています。途中で止まってあなたに届いていなかったので、ここで渡します。同じことを聞き直さず、これを踏まえて続けてください）\n${lines.join("\n")}`;
}
const bad = (
  c: { json: (b: unknown, s: number) => Response },
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) => c.json({ error: code.toLowerCase(), code, message, ...extra }, status);

/** 入れた文字（サービス名か URL）から宛先のドメインを取る。取れなければ null */
export function hostOf(v: string): string | null {
  const m =
    /(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?![a-z0-9-])/i.exec(
      v.trim(),
    );
  return m ? m[1]!.toLowerCase() : null;
}
/** この版より古い Bridge には仕事を渡さない（定義は features/F3/connect-pc/hooks.ts・K-57 に移した） */
export { BRIDGE_PROTOCOL_MIN };
/** 成果物の本文を受ける口（書き出す・直して保存）。送る量の守りで断るときも成果物の上限の答え（E-ART-001）にする（K-145） */
const ARTIFACT_BODY = /^\/agent\/artifacts(\/[^/]+\/versions)?$/;
/** 同意し直しの間も止めない前の道すじ（K-53）：自分の取得だけ（ログアウトは契約の口 signOut。招待の下見と受諾は契約の口に移して消した・K-337） */
const TERMS_OPEN_EXT = [/^\/me$/];
export function authExt(d: AuthExtDeps): Hono {
  const app = new Hono();
  const fresh = createSessionResolver(d.auth, d.appPool);
  // 同じ要求の中では 1 回だけ解く（app.session_check を 2 回呼ばない・見張りの最後に見た時刻を 2 回進めない）。下の入口の止めが解いた結果を、
  // 各 route と子の道すじ（agent.ts・agent-stream.ts）の resolve が先に使う。要求の頭（Headers）ごとに覚え、要求が終われば消える
  const seen = new WeakMap<Headers, Promise<Resolved | null>>();
  const resolve = (h: Headers): Promise<Resolved | null> => {
    const hit = seen.get(h);
    if (hit) return hit;
    const p = fresh(h);
    seen.set(h, p);
    return p;
  };
  // 送る量の守り（D-130.1・K-145）：前の道すじは契約の入口（op.ts）を通らないので、全部の route より前（ログイン・同意し直しより前）に置く。
  //   読みながら数え、1MB を超えた時点で読むのをやめて 413（頭を偽っても・頭が無くても）。頭が 1MB を超えていれば 1 バイトも読まない。
  //   読んだ体は Hono の器に入れ、各 route の c.req.json() が同じ中身を読む（2 回読まない）。
  //   ファイルを受ける口（資料＝multipart・成果物＝ファイルそのもの）は守りの外（D-135.1・ファイルの上限は置き場と口が持つ）
  app.use("*", async (c, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) return next();
    const path = c.req.path.replace(/^\/api\/auth-ext(?=\/|$)/, "") || "/";
    const type = c.req.header("content-type") ?? "";
    // 外すのは道で決める（頭だけで外すと、ログインしていない口にも multipart の頭を付けて守りを抜けられる・K-145 テスター回 2）
    if ((path === "/agent/attachments" && /^multipart\/form-data/i.test(type)) || path === "/bridge/artifact")
      return next();
    const text = await readBodyLimited(c);
    if (text === null)
      // 成果物の本文を受ける口（書き出す・直して保存）は、今までどおり成果物の上限の答え（E-ART-001「1 MB まで」・画面が出す文）で断る
      return ARTIFACT_BODY.test(path)
        ? c.json({ error: "e-art-001", code: "E-ART-001", message: CATALOG["E-ART-001"]?.message ?? "E-ART-001" }, 413)
        : c.json(TOO_LARGE, 413);
    (c.req.bodyCache as unknown as { text?: Promise<string> }).text = Promise.resolve(text);
    return next();
  });
  // 同意し直し（K-53・D-125.162）：印が立ったセッションは、止めない道のほかを 403・E-AUTH-010 で止める（契約の口の入口 op.ts と同じ決まり）。
  //   付けるまで進めない（K-321）の印も同じ所・同じ止めない道で、403・MFA_REQUIRED で止める（前の道すじで預ける・PC の様子を読むを使わせない）。
  //   全部の route より前に 1 つだけ置く。PC のセッション（x-bridge-session）は Better Auth のセッションでないので印を見ない（D-128.137）
  app.use("*", async (c, next) => {
    const path = c.req.path.replace(/^\/api\/auth-ext(?=\/|$)/, "") || "/";
    if (TERMS_OPEN_EXT.some((re) => re.test(path))) return next();
    // セッションの付いていない要求（PC の x-bridge-session・ログインの前）はそのまま渡す。解こうとして落ちたら止める側に倒す（fail-closed）
    const h = c.req.raw.headers;
    if (!h.get("authorization") && !h.get("cookie")) return next();
    let r: Resolved | null;
    try {
      r = await resolve(h);
    } catch (e) {
      return sessionUnresolved(c, "前の道すじ", e);
    }
    if (r?.termsPending) return termsRequired(c);
    // 付けるまで進めない（K-321・D-128.141）：同意し直しの次。止めない道は同意し直しと同じ（上の TERMS_OPEN_EXT）
    if (r?.mfaPending) return mfaRequired(c);
    return next();
  });

  // 登録・待つ画面の状態・送り直しは契約の口（POST /api/v1/auth/sign-up・GET …/status・POST …/resend）に移した（K-51・apps/api/src/features/F1/sign-up/）。
  // 確認のリンクで確定するのも契約の口（POST /api/v1/auth/sign-up/verify・K-52・apps/api/src/features/F1/verify-email/）に移した
  // ログイン（パスワード）と 2 段階の確認は契約の口（POST /api/v1/auth/sign-in・…/two-factor/verify・K-301・K-302）に移し、前の道すじは K-316 で消した

  // 招待の下見と受諾は契約の口（GET /api/v1/auth/invitations/:token・POST …/accept・K-331〜K-333・apps/api/src/features/F2/invitations/）に移し、前の道すじは K-337 で消した

  // はじめの設定の進み具合（T-U-09〜・D-089）。1 PCをつなぐ → 6 本番へ。0 は「まだ何もしていない」。
  // 画面はこれを見て、通していない人を今いる段へ戻す（入口・アプリの枠の両方）
  app.get("/setup-state", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    // 生の SQL だと行レベルの制御に弾かれ、黙って 0（＝まだ何もしていない）になる。/me と同じく文脈つきで読む
    const m = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    if (!m) return bad(c, 404, "MEMBER_NOT_FOUND", "あなたの会員の行が見つかりません");
    return c.json({ data: { step: Number(m["setup_step"] ?? 0), total: 6 } });
  });

  // その段を通した、と記録する（進み具合は戻らない。小さい値では上書きしない）
  app.post("/setup-step", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { step?: number };
    if (!Number.isInteger(b.step) || b.step! < 1 || b.step! > 6)
      return bad(c, 422, "VALIDATION_FAILED", "段は 1〜6 で指定してください", { field: "step" });
    const r = await d.appPool.query<{ v: number }>("select app.setup_step_done($1, $2::smallint) as v", [
      s.ctx.userId,
      b.step,
    ]);
    return c.json({ data: { step: r.rows[0]!.v, total: 6 } });
  });

  // ---- 画面が話す口（自分のAIに言う・止まったものを選び直す・D-090）
  // 会話は 1 本（D-062）。開いている会話が無ければ作る。文脈の本体は Claude の session（Kaname は id だけ持つ）
  app.post("/agent/say", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as {
      text?: string;
      conversation_id?: string;
      branch_from?: string;
      context?: { screen?: unknown; screen_name?: unknown; selected?: unknown };
    } & Record<string, unknown>;
    // id の欄は正式な uuid で確かめる（D-129.42・K-145）。送らない・null は「無し」。形違いは黙って捨てずに 422（D-135.4）
    const convIn = idOrNull(b.conversation_id);
    if (convIn === false) return badId(c, "conversation_id");
    const branchFrom = idOrNull(b.branch_from);
    if (branchFrom === false) return badId(c, "branch_from");
    const issue = jobOptionsIssue(b);
    if (issue) return badId(c, issue, issue === "quote" ? "object" : "uuid");
    const text = (b.text ?? "").trim();
    if (!text) return bad(c, 422, "VALIDATION_FAILED", "言うことが空です", { field: "text" });
    // どこで話しかけられたか（D-103）：会話は同じ 1 本で、自分のAI に渡す指示にだけ前置きする。会話に出す言葉は本人が書いたまま
    const one = (v: unknown, n: number): string =>
      String(v ?? "")
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, n);
    const screenId = /^[a-z0-9-]{1,40}$/.test(one(b.context?.screen, 40)) ? one(b.context?.screen, 40) : "";
    const screenName = one(b.context?.screen_name, 40);
    const selected = one(b.context?.selected, 120);
    const where =
      screenId || selected
        ? `（Kaname の画面から話しかけています。いま見ている画面：${screenName || screenId || "不明"}${selected ? `／選んでいる 1 件：${selected}` : ""}）`
        : "";
    // 引用して続ける（D-104.17）：吹き出しには引用として出し、自分のAI への指示には引用した文を添える（添えないと何の話か伝わらない）
    const q = (b["quote"] ?? null) as { text?: unknown } | null;
    const quoted =
      q && typeof q.text === "string" && q.text.trim()
        ? `（あなたの返事のこの部分について）\n> ${q.text.trim().replace(/\n/g, "\n> ")}`
        : "";
    // はじめの設定の聞き取り（D-114）：分かった事実はその場で覚える。決まりだけだと効かなかったので、毎回の依頼にも添える（2026-09-29 実例）
    const interview = screenId === "onboard-interview" ? ONBOARD_REMEMBER : "";
    const context = [where, interview, quoted].filter(Boolean).join("\n");
    const conv = await d.appPool.query<{ conv_id: string; agent_session: string | null }>(
      "select * from app.agent_open_conversation($1, $2, $3, $4)",
      [ses.ctx.userId, convIn, branchFrom, text.slice(0, 40)],
    );
    const cv = conv.rows[0];
    if (!cv)
      return bad(c, 404, "CONVERSATION_NOT_FOUND", "この会話はありません（消したか、あなたの会話ではありません）");
    const convId = cv.conv_id;
    // 直して送り直す（D-104.17）：新しいセッションなので、写したやりとりを短くまとめて自分のAI に添える（無いと何の続きか分からない）
    let earlier = "";
    if (branchFrom) {
      const st = await d.appPool.query<{ s: { messages?: { who: string; text: string }[] } }>(
        "select app.agent_state($1, $2) as s",
        [ses.ctx.userId, convId],
      );
      const past = (st.rows[0]?.s.messages ?? []).filter((m) => m.who === "me" || m.who === "ai").slice(-20);
      if (past.length)
        earlier = `（前の会話の途中から、この文を直して送り直しています。ここまでのやりとり）\n${past
          .map((m) => `${m.who === "me" ? "本人" : "あなた"}：${m.text.replace(/\s+/g, " ").slice(0, 400)}`)
          .join("\n")}`;
    }
    // 本人が答えたのに届かないまま止まった問い合わせの答え（Bridge が途中で止まった等）。聞き直させずに渡す（2026-09-28 実例）
    const carried = branchFrom
      ? ""
      : carriedAnswers(
          (
            await d.appPool.query<{ v: unknown }>("select app.agent_carry_answers($1, $2) as v", [
              ses.ctx.userId,
              convId,
            ])
          ).rows[0]?.v,
        );
    // モード・モデル・使うもの・資料・引用（D-104.10〜D-104.14）。全部許可は本人が選んだときだけ画面から来る
    const job = await d.appPool.query<{ id: string | null }>(
      "select app.agent_enqueue($1, $2, $3, $4, $5::jsonb) as id",
      [
        ses.ctx.userId,
        convId,
        text,
        [earlier, carried, context].filter(Boolean).join("\n\n") || null,
        JSON.stringify(jobOptions(b)),
      ],
    );
    // つながっているかは定義の中で見る（読む側で生の select をすると行レベルの制御に弾かれて黙って 0 になる）
    if (!job.rows[0]?.id)
      return bad(
        c,
        409,
        "BRIDGE_NOT_CONNECTED",
        "このPCがつながっていません。自分のPCをつなぐ から先に登録してください",
      );
    return c.json({ data: { conversation_id: convId, job_id: job.rows[0].id } }, 201);
  });

  // 止まった仕事を、人が選び直す（続きから／やり直す／やめる）
  app.post("/agent/resume", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; how?: string };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !["continue", "restart", "cancel"].includes(b.how ?? ""))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と 続きから／やり直す／やめる が要ります");
    const r = await d.appPool.query<{ id: string | null }>("select app.bridge_resume_job($1, $2, $3) as id", [
      ses.ctx.userId,
      job,
      b.how,
    ]);
    if (!r.rows[0]?.id) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は止まっていません");
    return c.json({ data: { job_id: r.rows[0].id } }, 201);
  });

  // 会話のいま（D-090）。言ったこと・返ってきたこと・止まりました・動いている仕事 を 1 回で返す。
  // 画面はこれを繰り返し読むだけ。止まったものは止まったまま出し、人が選ぶ（自動で再開しない）
  app.get("/agent/state", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const conv = queryId(c.req.query("conversation_id"));
    if (conv === false) return badId(c, "conversation_id");
    const r = await d.appPool.query<{ s: unknown }>("select app.agent_state($1, $2) as s", [ses.ctx.userId, conv]);
    return c.json({ data: r.rows[0]!.s });
  });

  // 「新しい会話」（D-062）。いまの 1 本を閉じる。次に言ったことが新しい 1 本になる（前のやりとりは残る）
  app.post("/agent/new", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { conversation_id?: unknown };
    const conv = idOrNull(b.conversation_id);
    if (conv === false) return badId(c, "conversation_id");
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_close_conversation($1, $2) as ok", [
      ses.ctx.userId,
      conv,
    ]);
    return c.json({ data: { closed: r.rows[0]?.ok ?? false } }, 201);
  });

  // この PC のいま（T-B-04・G-12）。つながっているか／本当に生きているか（最後の知らせからの経過）／自己診断の報告
  app.get("/bridge/state", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ s: unknown }>("select app.bridge_state($1) as s", [ses.ctx.userId]);
    return c.json({ data: r.rows[0]!.s });
  });

  // AI が使うブラウザを、いまの端末について選ぶ（D-120.1）。次の仕事から効く
  app.post("/agent/browser", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { browser?: unknown };
    if (!BROWSERS.includes(b.browser as Browser))
      return bad(c, 422, "VALIDATION_FAILED", "ブラウザは chrome／dedicated／off のどれかです");
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_set_browser($1, $2) as ok", [
      ses.ctx.userId,
      b.browser,
    ]);
    if (!r.rows[0]?.ok) return bad(c, 404, "BRIDGE_NOT_FOUND", "つないだ PC がありません");
    return c.json({ data: { browser: b.browser } });
  });
  // この端末を外す（2026-10-01 QA：モックにあって実装に無かった）。自分の Bridge の端末だけ。外した鍵は次の要求で 410 になり、
  // Bridge は鍵を捨てて仕事を取りに来なくなる（G-14）。画面の Web ログインのセッションはここでは外さない（kind_id = 'bridge' だけ）
  app.post("/agent/bridge-revoke", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { session_id?: unknown };
    const sessionId = idOrNull(b.session_id);
    if (sessionId === false) return badId(c, "session_id");
    if (!sessionId) return bad(c, 422, "VALIDATION_FAILED", "外す端末の id が要ります");
    const n = await withTenant(
      d.appPool,
      ses.ctx,
      async (cl) =>
        (
          await cl.query<{ n: number }>(
            "select coalesce(sum(app.revoke_own_session(s.id, 'logout')), 0)::int as n from sessions s where s.id = $1 and s.kind_id = 'bridge' and s.revoked_at is null",
            [sessionId],
          )
        ).rows[0]!.n,
    );
    if (!n) return bad(c, 404, "BRIDGE_NOT_FOUND", "その端末はありません（もう外したか、つないでいない端末です）");
    return c.json({ data: { revoked: true } });
  });
  // もう一度確かめる（D-120.3）：Bridge が小さな仕事で Chrome を本当に使えるか試す。結果は PC の状態（自己診断）に出る
  app.post("/agent/browser-check", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ id: string | null }>("select app.agent_browser_check($1, $2) as id", [
      ses.ctx.userId,
      BROWSER_CHECK_PROMPT,
    ]);
    const id = r.rows[0]?.id ?? null;
    if (!id)
      return bad(
        c,
        409,
        "BRIDGE_ASLEEP",
        "PC の Bridge が動いていないので確かめられません。Bridge を起こしてから押してください",
      );
    return c.json({ data: { job_id: id } }, 201);
  });

  // ---- Bridge が話す口（T-B-03・D-090）。鍵は claim で受け取った bridge の session id
  // PC の印（K-57）：引き取りで 1 回だけ渡した印のハッシュで、生きている PC の行を引く。sessions の id は鍵にしない（画面の一覧に出る値なので）
  const resolveDevice = createDeviceResolver(d.appPool);
  // PC の印の形か、前の形（sessions の id）の鍵なら、解けなければ 410（Bridge は捨ててつなぎ直す）。それ以外の形は 401
  //   頭が無ければ null（401）。頭があるのに解けない印（切れた・外した・知らない）は、無い PC の行を指す（各口の「生きているか」で 410 になり、Bridge は印を捨てる・G-14）
  const NO_DEVICE = "00000000-0000-4000-8000-000000000000";
  const bridgeSession = async (c: { req: { raw: Request } }) =>
    isBridgeKeyShape(c.req.raw.headers.get("x-bridge-session"))
      ? ((await resolveDevice(c.req.raw.headers))?.sessionId ?? NO_DEVICE)
      : null;
  /** 鍵が生きているか。切れた・退会した・つなぎ直した鍵は 410（Bridge はこれで鍵を捨てる・G-14）。
   *  「仕事が無い（404）」と混ぜない：混ぜると古い仕事 id の 404 で鍵まで捨ててしまう */
  const bridgeAlive = async (sid: string): Promise<boolean> =>
    // 生の select は行レベルの制御に弾かれて 0 件になる。判定は関数の中で（0036）
    (await d.appPool.query<{ ok: boolean }>("select app.bridge_session_alive($1) as ok", [sid])).rows[0]?.ok === true;
  // 仕事を取る・途中の様子・結末を返す・止める合図・道具は契約の口（/api/v1/bridge/jobs/…）に移した（K-62・apps/api/src/features/F5/delegate/）
  const GONE = (c: Parameters<typeof bad>[0]) =>
    bad(c, 410, "SESSION_GONE", "この端末の接続は切れています。つなぎ直してください");

  // Bridge の窓から選び直す（Kaname の画面で変えたのと同じ・D-120.1）
  app.post("/bridge/browser", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { browser?: unknown };
    if (!BROWSERS.includes(b.browser as Browser))
      return bad(c, 422, "VALIDATION_FAILED", "ブラウザは chrome／dedicated／off のどれかです");
    const r = await d.appPool.query<{ ok: boolean }>("select app.bridge_set_browser($1, $2) as ok", [sid, b.browser]);
    if (!r.rows[0]?.ok) return GONE(c);
    return c.json({ data: { browser: b.browser } });
  });

  // 確認（D-093.3）：CLI が「これを実行していいか」と聞いた。画面に出して本人の答えを待つ
  app.post("/bridge/ask", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as {
      job_id?: unknown;
      request_id?: string;
      tool?: string;
      input?: unknown;
      summary?: string;
    };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !b.request_id) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    const payload = {
      tool: String(b.tool ?? "道具").slice(0, 80),
      input: b.input ?? null,
      summary: String(b.summary ?? "").slice(0, 300),
    };
    const r = await d.appPool.query<{ ok: boolean }>("select app.bridge_ask($1, $2, $3, $4::jsonb) as ok", [
      sid,
      job,
      b.request_id,
      JSON.stringify(payload),
    ]);
    if (!r.rows[0]?.ok) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は動いていません");
    // 2 段階のコード・承認を頼むときは、画面に出すだけでなくメールでも知らせる（D-117.3「承認待ち・通知」・関門 C6）。
    //   送れなくても頼み自体は立つ（画面の行に出ている）。本文にコードや値は無い
    if ((payload.tool === "TwoFactorCode" || payload.tool === "TwoFactorApprove") && d.mailer) {
      const to =
        (await d.appPool.query<{ v: string | null }>("select app.bridge_session_email($1) as v", [sid])).rows[0]?.v ??
        null;
      if (to) {
        const url = `${d.config.webBaseUrl ?? ""}/settings/credentials`;
        void d
          .mailer({
            to,
            kind: "code",
            url,
            subject: `Kaname｜${payload.summary || "ログインの確認が要ります"}`,
            text: `PC の Bridge が、預けたログイン情報でログインを試しています。\n\n${payload.summary}\n\n次のページで答えてください（10 分返事が無ければ止まり、押したときにもう一度試せます）:\n${url}\n\n入れたコードは PC の Bridge だけに渡り、AI にも記録にも残りません。`,
          })
          .catch(() => undefined);
      }
    }
    return c.json({ data: { ok: true } }, 201);
  });
  // Bridge が答えを取りに来る（無ければ null。勝手に許可しない）
  app.post("/bridge/answer", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; request_id?: string };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !b.request_id) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    const r = await d.appPool.query<{ a: string | null }>("select app.bridge_take_answer($1, $2, $3) as a", [
      sid,
      job,
      b.request_id,
    ]);
    return c.json({ data: { answer: r.rows[0]?.a ?? null } });
  });
  // 本人が答える（許可する／許可しない）。答えは 出来事・会話・証跡 に残る（D-093.8）
  app.post("/agent/answer", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; request_id?: string; allow?: boolean };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || !b.request_id || typeof b.allow !== "boolean")
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id・request_id・許可するか が要ります");
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_answer($1, $2, $3, $4) as ok", [
      ses.ctx.userId,
      job,
      b.request_id,
      b.allow,
    ]);
    if (!r.rows[0]?.ok)
      return bad(c, 404, "ASK_NOT_FOUND", "その確認は見つかりません（もう答えたか、仕事が終わっています）");
    return c.json({ data: { ok: true } }, 201);
  });

  // 会話の作り込み（D-104・D-105）の口は agent.ts
  app.route("/", agentStreamRoutes({ resolve, fresh, hub: d.hub ?? null }));
  app.route(
    "/",
    agentRoutes({
      appPool: d.appPool,
      resolve,
      ...(d.objects ? { objects: d.objects } : {}),
      baseUrl: d.config.baseUrl,
    }),
  );

  // 自分のこと（D-086）：画面が「この権限で見えるか」を判定するのに要る。
  // 一覧（GET /members）は行レベルの制御で自分の行すら返らないことがある。自分の役割はここから引く
  app.get("/me", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const m = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    // 今いる会社（セッションの会社）の名前（K-253・D-144.2）。関門 C2 の読むだけで、行の守りが今の会社の行だけを見せる。
    // 消した印のある会社は読めないので null（ほかの欄は返す）
    const t = await d.repo.table("tenants").get(s.ctx, s.ctx.tenantId);
    return c.json({
      data: {
        member_id: s.ctx.userId,
        tenant_id: s.ctx.tenantId,
        display_name: m?.["display_name"] ?? null,
        role_id: (m?.["role_id"] as string | null) ?? null,
        scope_id: m?.["scope_id"] ?? null,
        workspace_name: workspaceName(t?.["name"]),
      },
    });
  });

  // 資格情報を預ける（T-U-10・関門 C8）：平文はここで暗号化して vault へ。表（credentials）には参照 ID だけ。AI には渡らない
  app.post("/vault/credentials", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    // 預かり先が決まっていない（段階 1・D-097.8）間は、staging／本番で預からない。メモリに置くと再起動・別の実体で消える
    if ((d.config.env === "staging" || d.config.env === "production") && !d.secrets.durable)
      return bad(c, 503, "E-SEC-002", "いまはログイン情報を預かれません。預かり先の用意ができたら使えるようになります");
    const b = (await c.req.json().catch(() => ({}))) as {
      service_name?: string;
      service_domain?: string;
      service_id?: unknown;
      kind_id?: string;
      login?: string;
      password?: string;
      totp_secret?: string;
      two_factor?: string;
    };
    // 台帳のサービスの id（uuid の列へ書く）は預かり先（関門 C8）に書く前に確かめる（K-145・形違いは 422・何も預けない）
    const serviceId = idOrNull(b.service_id);
    if (serviceId === false) return badId(c, "service_id");
    // 2 段階認証の種類（D-117.2）：なし／認証アプリ（鍵が要る）／SMS／メール／スマホで承認。鍵だけ入れて種類が無ければ認証アプリ
    const twoFactor = ["none", "totp", "sms", "email", "push"].includes(String(b.two_factor ?? ""))
      ? String(b.two_factor)
      : b.totp_secret
        ? "totp"
        : "none";
    if (twoFactor === "totp" && !b.totp_secret)
      return bad(c, 422, "E-VAL-003", "認証アプリを選んだときは、登録時に出た秘密鍵を貼ってください", {
        field: "totp_secret",
      });
    const login = String(b.login ?? "")
      .normalize("NFKC")
      .trim();
    if (!login || !b.password) return bad(c, 422, "E-VAL-008", "ログイン名とパスワードを入れてください");
    const kind = b.kind_id ?? (twoFactor === "totp" ? "password_totp" : "basic");
    // 2 段階認証の秘密鍵は Base32（A〜Z・2〜7）。空白と小文字は直して通す。それ以外は E-VAL-003（G-08：出せるエラー）
    const totpSecret = b.totp_secret ? b.totp_secret.normalize("NFKC").replace(/\s+/g, "").toUpperCase() : null;
    if (totpSecret !== null && !/^[A-Z2-7]{16,}=*$/.test(totpSecret))
      return bad(
        c,
        422,
        "E-VAL-003",
        "秘密鍵の形式が違います。認証アプリの登録時に出る文字列（英字と 2〜7 の数字・16 文字以上）を貼ってください",
        { field: "totp_secret" },
      );
    const stored = await d.secrets.store(
      s.ctx,
      kind,
      JSON.stringify({ login, password: b.password, totp_secret: totpSecret }),
    );
    if (stored.status !== "done") {
      // 上限に当たった（D-102.5）：待つ秒数を添えて断る。預かったことにしない
      if ("retryAfterSec" in stored && stored.retryAfterSec)
        return bad(
          c,
          503,
          "E-SEC-003",
          `いま混み合っています。${stored.retryAfterSec} 秒ほど待ってからもう一度保存してください`,
          {
            retry_after_sec: stored.retryAfterSec,
          },
        );
      // 一手は関門の handoff（「もう一度保存する。続くときは運営に連絡する」）。理由を一手の欄に入れていた（T-B-14 の試験で発覚）
      return bad(c, 502, "E-SEC-001", "預かり先に保管できませんでした。もう一度試してください", {
        handoff: "handoff" in stored ? stored.handoff : null,
      });
    }
    const ref = typeof stored.value === "string" ? stored.value : stored.value.ref;
    const me = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    // 入れたサービス名と宛先を残し、台帳に同じサービスがあれば結ぶ（D-108.4）
    // 人が打つサービス名は黙って切らない（D-135.5・D-130.4）
    const name = String(b.service_name ?? "")
      .normalize("NFKC")
      .trim();
    const domain = hostOf(name) ?? hostOf(String(b.service_domain ?? ""));
    const svc =
      serviceId ??
      (await d.appPool.query<{ id: string | null }>("select app.credential_service($1, $2) as id", [name, domain]))
        .rows[0]?.id ??
      null;
    const row = await d.repo.table("credentials").create(s.ctx, {
      service_id: svc,
      service_name: name || null,
      service_domain: domain,
      kind_id: kind,
      vault_ref: ref,
      owner_member_id: s.ctx.userId,
      scope_id: me?.["scope_id"] ?? null,
      two_factor_id: twoFactor,
    });
    // 預けたらその場で 1 回だけログインを試す（D-117.1）。禁止・銀行は試さない。Bridge の端末が無ければ積まない
    const check =
      (
        await d.appPool.query<{ id: string | null }>("select app.credential_login_check_enqueue($1, $2) as id", [
          s.ctx.userId,
          row["id"],
        ])
      ).rows[0]?.id ?? null;
    return c.json(
      { data: { id: row["id"], vault_ref: ref, service_name: name || null, login_check_job_id: check } },
      201,
    );
  });
  // もう一度試す（D-117.5）：10 分返事が無くて止まった・途中で止まった・開けなかった ものを、本人が押したときだけ回す
  app.post("/vault/credentials/:id/login-check", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const id = idOf(c.req.param("id"));
    if (!id) return badId(c, "id");
    const job =
      (
        await d.appPool.query<{ id: string | null }>("select app.credential_login_check_retry($1, $2) as id", [
          s.ctx.userId,
          id,
        ])
      ).rows[0]?.id ?? null;
    if (!job)
      return bad(
        c,
        409,
        "LOGIN_CHECK_BUSY",
        "いまは試せません（試している最中か、禁止のサービスか、PC をつないでいません）",
      );
    return c.json({ data: { login_check_job_id: job } }, 201);
  });
  // 本人がコードを入れる／スマホで承認したと知らせる（D-117.3）。コードは Bridge が取った時点で消える
  app.post("/vault/credentials/:id/answer", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const id = idOf(c.req.param("id"));
    if (!id) return badId(c, "id");
    const b = (await c.req.json().catch(() => ({}))) as { request_id?: unknown; code?: unknown; approved?: unknown };
    if (typeof b.request_id !== "string")
      return bad(c, 422, "VALIDATION_FAILED", "資格情報の id と request_id が要ります");
    const code =
      b.approved === true ? "approved" : typeof b.code === "string" ? b.code.normalize("NFKC").replace(/\s+/g, "") : "";
    if (!code || code.length > 64) return bad(c, 422, "E-VAL-009", "コードを入れてください");
    const ok = (
      await d.appPool.query<{ ok: boolean }>("select app.agent_answer_code($1, $2, $3, $4) as ok", [
        s.ctx.userId,
        id,
        b.request_id,
        code,
      ])
    ).rows[0]?.ok;
    if (!ok) return bad(c, 404, "ASK_NOT_FOUND", "いまは頼まれていません（もう答えたか、止まっています）");
    return c.json({ data: { ok: true } }, 201);
  });
  // Bridge がコードを取る（本人の Bridge・その仕事・その request だけ。取ったら消える）
  app.post("/bridge/code", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; request_id?: unknown };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || typeof b.request_id !== "string")
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    const code =
      (
        await d.appPool.query<{ v: string | null }>("select app.bridge_take_code($1, $2, $3) as v", [
          sid,
          job,
          b.request_id,
        ])
      ).rows[0]?.v ?? null;
    return c.json({ data: { code } });
  });
  // Bridge が 1 回のログインの結果を返す（T-B-38・D-117.1）。本人の Bridge が取った動いている仕事に対してだけ。値は無い（結果の種類と理由だけ）
  app.post("/bridge/credentials/check-result", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; state?: unknown; detail?: unknown };
    const states = [
      "ok",
      "bad_password",
      "needs_2fa",
      "bad_code",
      "captcha",
      "unreachable",
      "no_form",
      "stopped",
      "no_answer",
    ];
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    if (!job || typeof b.state !== "string" || !states.includes(b.state))
      return bad(
        c,
        422,
        "VALIDATION_FAILED",
        "仕事の id と結果（ok／bad_password／needs_2fa／bad_code／captcha／unreachable／no_form／stopped／no_answer）が要ります",
      );
    const detail = typeof b.detail === "string" ? b.detail.slice(0, 400) : "";
    const r =
      (
        await d.appPool.query<{ v: { tenant_id: string; member_id: string; credential_id: string } | null }>(
          "select app.bridge_login_check_result($1, $2, $3, $4) as v",
          [sid, job, b.state, detail],
        )
      ).rows[0]?.v ?? null;
    if (!r) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は見つかりません");
    await d.repo.audit(
      { tenantId: r.tenant_id, userId: r.member_id, role: "member" },
      "credential.login_check",
      "credentials",
      r.credential_id,
      "C1",
      { job_id: job, state: b.state },
    );
    return c.json({ data: { ok: true } });
  });
  // Bridge が「いま動いている仕事」のために資格情報 1 件を受け取る（T-B-05・D-102.2・D-017.1・関門 C8）。
  //   本人の Bridge の鍵・本人の動いている仕事・本人の資格情報、の 3 つがそろったときだけ。解くのは関門（caller=executor）で、証跡に残す。
  //   値はこの応答にだけ載る（表・ログ・AI の道具には載らない）
  app.post("/bridge/credentials/resolve", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; credential_id?: unknown };
    const job = idOrNull(b.job_id);
    if (job === false) return badId(c, "job_id");
    const cred = idOrNull(b.credential_id);
    if (cred === false) return badId(c, "credential_id");
    if (!job || !cred) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と資格情報の id が要ります");
    const row = (
      await d.appPool.query<{
        tenant_id: string;
        member_id: string;
        vault_ref: string | null;
        service_name: string | null;
        service_domain: string | null;
        two_factor: string;
        revoked: boolean;
        job_ok: boolean;
      }>("select * from app.bridge_credential($1, $2, $3)", [sid, job, cred])
    ).rows[0];
    if (!row || !row.vault_ref) return bad(c, 404, "CREDENTIAL_NOT_FOUND", "預けたログイン情報が見つかりません");
    const ctx = { tenantId: row.tenant_id, userId: row.member_id, role: "member" as const };
    if (!row.job_ok) {
      await d.repo.audit(ctx, "credential.bridge_denied", "credentials", cred, "C8", {
        job_id: job,
        reason: "job_not_running",
      });
      return bad(c, 403, "JOB_NOT_RUNNING", "動いている仕事のためにだけ受け取れます", { handoff: "仕事を始めてから" });
    }
    if (row.revoked) {
      await d.repo.audit(ctx, "credential.bridge_denied", "credentials", cred, "C8", {
        job_id: job,
        reason: "revoked",
      });
      return bad(c, 403, "CREDENTIAL_REVOKED", "このログイン情報は失効しています。預け直してください", {
        handoff: "預け直す",
      });
    }
    const o = await d.secrets.resolve(row.vault_ref, { ...ctx, caller: "executor" });
    if (o.status !== "done") {
      // 届かない・混んでいる・読めない：成功にしない。理由に値は無い
      return bad(
        c,
        o.status === "denied" ? 403 : 502,
        o.status === "denied" ? "CREDENTIAL_DENIED" : "E-SEC-001",
        o.reason,
        {
          handoff: o.handoff,
          ...("retryAfterSec" in o && o.retryAfterSec ? { retry_after_sec: o.retryAfterSec } : {}),
        },
      );
    }
    let v: { login?: unknown; password?: unknown; totp_secret?: unknown };
    try {
      v = JSON.parse(o.value) as typeof v;
    } catch {
      return bad(c, 502, "E-SEC-001", "預かった情報が読めません。安全のため、もう一度預け直してください", {
        handoff: "預け直す",
      });
    }
    // 受け取った仕事と資格情報の結びつきだけを証跡に（値は書かない）
    await d.repo.audit(ctx, "credential.bridge_resolve", "credentials", cred, "C8", {
      job_id: job,
      service_name: row.service_name,
    });
    return c.json({
      data: {
        login: typeof v.login === "string" ? v.login : "",
        password: typeof v.password === "string" ? v.password : "",
        totp_secret: typeof v.totp_secret === "string" ? v.totp_secret : null,
        service_name: row.service_name,
        service_domain: row.service_domain,
        two_factor: row.two_factor,
      },
    });
  });
  // 預けたものの一覧（D-108.3）：サービス名・台帳の可否・状態・預かり先の番号の頭だけ。中身は返さない
  app.get("/vault/credentials", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.my_credentials($1) as v", [s.ctx.userId]);
    return c.json({ data: r.rows[0]?.v ?? [] });
  });
  // たたき台（D-108.5）：目標（今の版の名前）・台帳・担当業務とAI社員を 1 回で
  app.get("/onboard/draft", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.onboard_draft($1) as v", [s.ctx.userId]);
    return c.json({ data: r.rows[0]?.v ?? { goals: [], ledgers: [], duties: [] } });
  });
  // 5 テストで動かす（T-U-11・D-028・D-116.4）：AI社員ごとの最新のテストの実行・出てきた成果物・本番に切り替えられるか
  app.get("/onboard/testrun", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.onboard_testrun($1) as v", [s.ctx.userId]);
    return c.json({ data: r.rows[0]?.v ?? { employees: [], outputs: [], ready: false } });
  });
  // 「この仕事はやめる」：止まった・実行中のテストの実行を やめた にする（本人の会社の分だけ・証跡に残る）
  app.post("/onboard/testrun/cancel", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { run_id?: unknown };
    const run = idOrNull(b.run_id);
    if (run === false) return badId(c, "run_id");
    if (!run) return bad(c, 422, "VALIDATION_FAILED", "どの実行をやめるかが要ります", { field: "run_id" });
    const r = await d.appPool.query<{ ok: boolean }>("select app.testrun_cancel($1, $2) as ok", [s.ctx.userId, run]);
    if (!r.rows[0]?.ok) return bad(c, 404, "NOT_FOUND", "やめられる実行がありません（止まった・実行中のテストだけ）");
    return c.json({ data: { ok: true } });
  });
  // 6 本番に切り替える（T-U-12・D-028.4・D-116.5）：切り替える前の確認（赤・黄）・明日から動くもの・切り替えたか
  app.get("/onboard/golive", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.onboard_golive($1) as v", [s.ctx.userId]);
    return c.json({
      data: r.rows[0]?.v ?? { checks: [], schedule: [], red: 0, warn: 0, ready: false, shortfall: null, live: null },
    });
  });
  // 「切り替える」：赤が 1 件でもあれば 409（E-DEP-004 の文言）。黄は accept_warnings=true で。押したら会社が本番になり、段 6 を通したと記録される
  app.post("/onboard/golive", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { accept_warnings?: unknown };
    const r = await d.appPool.query<{
      v: { error?: string; message?: string; ok?: boolean; live_at?: string; red?: number; warn?: number };
    }>("select app.onboard_golive_switch($1, $2) as v", [s.ctx.userId, b.accept_warnings === true]);
    const v = r.rows[0]!.v;
    if (v.error === "RED") return bad(c, 409, "GOLIVE_BLOCKED", v.message ?? "足りない設定があります", { red: v.red });
    if (v.error === "WARN") return bad(c, 409, "GOLIVE_WARNINGS", v.message ?? "警告があります", { warn: v.warn });
    if (v.error) return bad(c, 404, "MEMBER_NOT_FOUND", "あなたの会員の行が見つかりません");
    return c.json({ data: { ok: true, live_at: v.live_at } });
  });
  // 「止めたまま本番へ」／「動かす」（E-DEP-004 の一手）：足りない AI社員を動かさないまま切り替えられるようにする
  app.post("/onboard/golive/pause", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { employee_id?: unknown; paused?: unknown; reason?: unknown };
    const employee = idOrNull(b.employee_id);
    if (employee === false) return badId(c, "employee_id");
    if (!employee) return bad(c, 422, "VALIDATION_FAILED", "どの AI社員かが要ります", { field: "employee_id" });
    if (typeof b.paused !== "boolean")
      return bad(c, 422, "VALIDATION_FAILED", "止めるか動かすかが要ります", { field: "paused" });
    const r = await d.appPool.query<{ ok: boolean }>("select app.golive_pause($1, $2, $3, $4) as ok", [
      s.ctx.userId,
      employee,
      b.paused,
      typeof b.reason === "string" ? b.reason : "",
    ]);
    if (!r.rows[0]?.ok) return bad(c, 404, "NOT_FOUND", "その AI社員はこの会社にいません");
    return c.json({ data: { ok: true } });
  });
  // 自分のAI が Kaname の道具でたたき台に置く（D-110）
  app.route("/", agentToolRoutes({ appPool: d.appPool, ...(d.objects ? { objects: d.objects } : {}) }));
  return app;
}
