// 画面の L1 を実データで流す土台：API（apps/api・3011）と DB（管理者）を直接使って前提を作る。QA が作ったデータだけを触る（G-10）
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { expect, test, type Page } from "@playwright/test";
import { agreeCurrentTerms as agreeTerms } from "../../../../packages/db/test/agree-terms";

export const API = process.env["API_BASE"] ?? "http://127.0.0.1:3011";
const ADMIN = process.env["DATABASE_URL_ADMIN"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_dev"; // 画面のテストは手元の画面（up.sh）と同じ DB を見る。単体テストの kaname_test とは分ける
export const PW = "correct-horse-battery-1";
// 宛先は「送出先が本当に受け取れるもの」にする。example.com は送出先に拒否され、
// 「本当に送られたか」の行が検証できない（拒否を握り潰していた間だけ緑に見えていた）。
// QA_MAIL_TO で環境ごとに変えられる（<uniq> がその回の一意な文字に置き換わる）。
const MAIL_TO = process.env["QA_MAIL_TO"] ?? "<uniq>@resend.dev";
export const uniq = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5)}`;
/** ふつうのテストの宛先。`qa-` で始まるので API は実際には送らない（MAIL_SUPPRESS_PREFIX）。
 *  リンクは API のログに出るので手順はそのまま通る */
export const uniqEmail = () => MAIL_TO.replace("<uniq>", `qa-${uniq()}`);
/** 「本当に送られるか」を見る行だけが使う宛先。抑止の接頭辞を付けないので実際に送出先へ出る */
export const realMailEmail = () => MAIL_TO.replace("<uniq>", `delivered+${uniq()}`);

/** ログに出る宛先の印（packages/auth の mailTag と同じ作り）。ログにメールアドレスそのものは出ない（K-51） */
export const mailTag = (email: string): string =>
  `宛先#${createHash("sha256")
    .update(email.normalize("NFKC").replace(/\s+/g, "").trim().toLowerCase())
    .digest("hex")
    .slice(0, 12)}`;

/** 試験の 1 人ごとの届く元（x-forwarded-for）。登録・確認の口は IP ごと 1 分 10 回（契約の rateLimit）。
 *  別々の人を 1 つの IP から続けて作ると、画面の試験を全部流す回（G48）で上限に当たる（K-1114）。上限そのものは口の単体の試験が持つ */
export const testIp = () =>
  `10.${(randomBytes(1)[0]! % 250) + 1}.${(randomBytes(1)[0]! % 250) + 1}.${(randomBytes(1)[0]! % 250) + 1}`;
export async function api<T>(
  path: string,
  body?: unknown,
  token?: string,
  method = body === undefined ? "GET" : "POST",
  ip?: string,
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(ip ? { "x-forwarded-for": ip } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as T };
}
/** 申し込む → 確認のリンクを踏む（契約の口 POST /api/v1/auth/sign-up/verify）→ 会社ができて token が返る（D-088：登録が終わるのは確認の時点）。
 *  リンクは API のログから拾う（KANAME_API_LOG）。本物の流れをそのまま通すので、画面の前提もこれで揃う */
export async function signupPending(company = "QA 社", email = uniqEmail()) {
  const r = await api<{ data: { email: string; sent: boolean; mail_error: string | null } }>(
    "/api/v1/auth/sign-up",
    {
      email,
      name: company,
      password: PW,
      company_name: company,
    },
    undefined,
    "POST",
    testIp(),
  );
  if (r.status !== 201) throw new Error(`sign-up ${r.status} ${JSON.stringify(r.json)}`);
  return { email, sent: r.json.data.sent, mailError: r.json.data.mail_error };
}
/** 確認のリンクの手がかりを API のログから取る */
export function pendingToken(email: string): string {
  const url = lastMailUrl("verify", email);
  if (!url) throw new Error(`確認のリンクがログに無い（KANAME_API_LOG を渡す）: ${email}`);
  const t = new URL(url).searchParams.get("token");
  if (!t) throw new Error(`リンクに token が無い: ${url}`);
  return t;
}
/** 入り方を 1 つ持つ人にする（K-321・D-128.141）：試験の鍵（kaname_auth.passkey に 1 行・名前「試験の鍵」）を置き、
 *  その人の今のセッションの「付けるまで進めない」の印（sessions.mfa_pending）を下ろす。付けるまで進めないを見る試験（K-319）は使わない。
 *  パスキーの表（K-304）・印の列（K-308）がまだ無ければ何もしない（K-53 の agree-terms と同じ形） */
export async function addTestEntry(userId: string): Promise<void> {
  const [t] = await admin<{ t: string | null }>("select to_regclass('kaname_auth.passkey')::text as t");
  if (t?.t)
    await admin(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values (gen_random_uuid()::text, '試験の鍵', 'test-entry', $1, 'test-entry-' || gen_random_uuid()::text, 0, 'singleDevice', false, 'internal', now())`,
      [userId],
    );
  const col = await admin(
    "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'mfa_pending'",
  );
  if (col.length)
    await admin(
      `update sessions set mfa_pending = false where member_id in (
         select id from members where auth_user_id = $1
         union select member_id from tenant_memberships where auth_user_id = $1)`,
      [userId],
    );
}
/** 会社ごと登録して token を返す（画面の前提）。申し込み → 確認 まで通す */
export async function signupViaApi(company = "QA 社", email = uniqEmail()) {
  await signupPending(company, email);
  // 確認のリンクを押す＝契約の口 verifySignup（K-52）。前の道すじ /api/auth-ext/verify-signup は K-52 で消した
  const r = await api<{ data: { token: string; email: string; signed_in: boolean } }>(
    "/api/v1/auth/sign-up/verify",
    { token: pendingToken(email) },
    undefined,
    "POST",
    testIp(),
  );
  if (r.status !== 201) throw new Error(`sign-up/verify ${r.status} ${JSON.stringify(r.json)}`);
  const c = new pg.Client({ connectionString: ADMIN });
  await c.connect();
  // 答えに本人の id は入らない（K-52 のレビューの L8）。メールで DB から引く
  const m = await c.query<{ id: string; tenant_id: string; scope_id: string; auth_user_id: string }>(
    'select m.id, m.tenant_id, m.scope_id, m.auth_user_id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
    [email],
  );
  await c.end();
  await addTestEntry(m.rows[0]!.auth_user_id); // 入り方を 1 つ持つ人にする（K-321）
  return {
    email,
    token: r.json.data.token,
    userId: m.rows[0]!.auth_user_id,
    memberId: m.rows[0]!.id,
    tenantId: m.rows[0]!.tenant_id,
    scopeId: m.rows[0]!.scope_id,
  };
}
/** ブラウザにトークンを持たせる（画面は localStorage の kaname.token を Bearer に載せる） */
export async function loginAs(page: Page, token: string) {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), token);
}
export async function admin<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: ADMIN });
  await c.connect();
  try {
    return (await c.query<T>(sql, params)).rows;
  } finally {
    await c.end();
  }
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/** PC の印（"kpc_…"・K-57）から、その PC の sessions の行の id を引く（DB に印は無くハッシュだけ・D-128.137） */
export const deviceRowId = async (token: string): Promise<string> =>
  (await admin<{ id: string }>("select id from sessions where device_token_hash = $1", [sha256(token)]))[0]!.id;
/** TOTP（RFC 6238・SHA1・30 秒・6 桁）。認証アプリの代わり */
export function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const off = h[h.length - 1]! & 0xf;
  const code =
    ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) | ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}
/** 2 段階を契約の口で付ける（K-318・口は K-311 の startTwoFactor → confirmTwoFactor）。画面ではなく口で下ごしらえする。
 *  ログインの直後に呼ぶ（15 分の内なので取り直しは要らない）。部品がセッションを作り直したら答えの token を以後使う */
export async function enableTotpViaApi(
  token: string,
): Promise<{ secret: string; backupCodes: string[]; token: string }> {
  const s = await api<{ data: { secret: string } }>("/api/v1/me/two-factor/enable", { password: PW }, token);
  if (s.status !== 201) throw new Error(`two-factor/enable ${s.status} ${JSON.stringify(s.json)}`);
  const secret = s.json.data.secret.replace(/\s+/g, "");
  const c = await api<{ data: { backup_codes: string[]; token: string | null } }>(
    "/api/v1/me/two-factor/confirm",
    { code: totp(secret) },
    token,
  );
  if (c.status !== 201) throw new Error(`two-factor/confirm ${c.status} ${JSON.stringify(c.json)}`);
  return { secret, backupCodes: c.json.data.backup_codes, token: c.json.data.token ?? token };
}
/** メールのリンク：開発では API がログに URL を出す（Resend の鍵が無いとき）。KANAME_API_LOG が無ければ null */
export function lastMailUrl(kind: "verify" | "reset", email: string): string | null {
  const p = process.env["KANAME_API_LOG"];
  if (!p) return null;
  const lines = readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.includes(`（${kind} → ${email}）`) || l.includes(`（${kind} → ${mailTag(email)}）`)); // 「送出先が無い」でも「リンク」でも拾う。宛先は印でも出る（K-51）
  const last = lines[lines.length - 1];
  const m = last ? /: (https?:\S+)/.exec(last) : null;
  return m ? m[1]! : null;
}
export const WIDTHS = [375, 768, 1024, 1440] as const;
export async function noOverflow(page: Page, path: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto(path);
    if (!res || res.status() >= 400) throw new Error(`${path} が ${res?.status()}`);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 0) throw new Error(`${path} 幅 ${width} で ${o}px 溢れ`);
  }
}
/** Bridge の行を前提として置く（claim の実体は T-I-02。画面は sessions の行で「つながった」を判定する） */
export const bridgeRow = (u: { tenantId: string; memberId: string }) =>
  admin(
    "insert into sessions (tenant_id, member_id, kind_id, device_label, auth_session_id, alive_at) values ($1, $2, 'bridge', 'MacBook Pro（QA）', $3, now())",
    [u.tenantId, u.memberId, `qa-${Date.now()}`],
  );

/** 閲覧のみ（R4）で参加した人。招待を作って受ける（権限で見えない画面の検査に使う） */
export async function viewerViaApi() {
  const { randomBytes } = await import("node:crypto");
  const boss = await signupViaApi("招く会社");
  const token = randomBytes(24).toString("base64url");
  const email = uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, 'viewer', $3, now() + interval '7 days', $4)",
    [boss.tenantId, email, sha256(token), boss.memberId],
  );
  // 招待は契約の口で受ける（K-337 で前の道すじから移した・切る段で替えた）。受諾は今の版に同意したことにする（K-332）
  const r = await api<{ data: { token: string } }>(
    `/api/v1/auth/invitations/${token}/accept`,
    { name: "閲覧のみ QA", password: PW },
    undefined,
    "POST",
    testIp(),
  );
  if (r.status !== 201) throw new Error(`accept ${r.status} ${JSON.stringify(r.json)}`);
  const u = await admin<{ id: string }>('select id from kaname_auth."user" where email = $1', [email]);
  await addTestEntry(u[0]!.id); // 入り方を 1 つ持つ人にする（K-321 の道具・K-337）
  return { ...boss, token: r.json.data.token, email };
}

/** 今の版の利用規約とプライバシーポリシーに同意済みにし、その人のセッションの同意し直しの印を下ろす（K-53）。
 *  登録（signupViaApi）は確定で申し込みの同意が移るので要らない。申し込みを通らずに人を作る道具だけが使う。SQL は packages/db/test/agree-terms.ts の 1 か所 */
export async function agreeCurrentTerms(userId: string): Promise<void> {
  await agreeTerms((sql, params = []) => admin(sql, params), userId);
}

/** API のログから、そのアドレス宛の送信の記録を読む（[mail] 送った／送れなかった） */
export function mailLog(email: string): { sent: string; failed: string } {
  const p = process.env["KANAME_API_LOG"];
  if (!p) return { sent: "", failed: "" };
  const lines = readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.includes(email) || l.includes(mailTag(email))); // ログの宛先は印（K-51・TP-REG-14）
  return {
    sent: lines.filter((l) => l.includes("[mail] 送った")).pop() ?? "",
    failed: lines.filter((l) => l.includes("[mail] 送れなかった")).pop() ?? "",
  };
}

/** パスワードの見る・隠す（D-087）：既定は隠す → 押すと見える → もう一度で隠れる。
 *  読み上げの名前（aria-label）と aria-pressed も一緒に変わることまで見る。
 *  画面ごとに書かずここに 1 つ置く（部品が 1 つなので検査も 1 つ） */
export async function pwToggle(page: Page, labelOfField: string) {
  const input = page.getByLabel(labelOfField, { exact: true });
  await expect(input).toHaveAttribute("type", "password"); // 既定は隠す
  const btn = page.getByRole("button", { name: "パスワードを表示" }).first();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  const box = await btn.boundingBox();
  if (!box || box.width < 24 || box.height < 24)
    throw new Error(`的が小さい（${box?.width}x${box?.height}・24px 以上）`);
  await btn.click();
  await expect(input).toHaveAttribute("type", "text"); // 見える
  const hide = page.getByRole("button", { name: "パスワードを隠す" }).first();
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await hide.click();
  await expect(input).toHaveAttribute("type", "password"); // また隠れる
}

/** テストが要るマスタ行は自分で用意する（他の検査の副作用に頼らない・L-014）。
 *  権限の総当たり検査は捨てる DB で回すようになったので、この DB には種が入らない */
export async function ensureGoalKind(key = "seed", label = "テストの目標の種類"): Promise<string> {
  await admin("insert into goal_kinds (key, label) values ($1, $2) on conflict (key) do nothing", [key, label]);
  return key;
}

/** はじめの設定（1〜6）を通し終わった人にする（D-089）。ログイン後の行き先が 今日 になるのはこの人だけ */
export async function setupDone(u: { tenantId: string; memberId: string }) {
  await bridgeRow(u);
  await admin("select app.setup_step_done($1, 6::smallint)", [u.memberId]);
}

/** はじめの設定を n 段目まで通したことにする（Bridge の行は作らない。D-089） */
export const setupStep = (memberId: string, n: number) =>
  admin("select app.setup_step_done($1, $2::smallint)", [memberId, n]);

// ---- Bridge の実物の経路（D-090・T-B-02／T-B-03）。画面から見た振る舞いを確かめるための前提を、本物の口で作る
/** 接続コードを出して引き取る＝この PC を端末として登録する（契約の口・K-57）。返るのは PC の印（"kpc_…"・x-bridge-session に載せる） */
export async function claimBridge(token: string, label = "MacBook Pro（QA）"): Promise<string> {
  const p = await api<{ data: { code: string } }>("/api/v1/bridge/pairing-codes", {}, token);
  if (p.status !== 201) throw new Error(`bridge/pairing-codes ${p.status}`);
  const c = await api<{ data: { device_token: string } }>("/api/v1/bridge/claim", {
    code: p.json.data.code,
    device_label: label,
  });
  if (c.status !== 201) throw new Error(`bridge/claim ${c.status} ${JSON.stringify(c.json)}`);
  return c.json.data.device_token;
}
const asBridge = async <T>(sid: string, path: string, body: unknown) => {
  // 生きている知らせ（K-57）と仕事の取る・様子・終わる（K-62）は契約の口（/api/v1）。仕事の id は道すじに入れ、体からは外す。
  //   取るの答えは契約の形（data.job）なので、前の形（data が仕事そのもの）に戻して返す（呼ぶ側の期待は前のまま）
  const b = { ...((body ?? {}) as Record<string, unknown>) };
  const job = typeof b["job_id"] === "string" ? (b["job_id"] as string) : "";
  const moved: Record<string, string> = {
    "/bridge/take": "/bridge/jobs/take",
    "/bridge/progress": `/bridge/jobs/${job}/progress`,
    "/bridge/finish": `/bridge/jobs/${job}/finish`,
  };
  if (moved[path] && path !== "/bridge/take") delete b["job_id"];
  const url =
    path === "/bridge/heartbeat" || moved[path] ? `${API}/api/v1${moved[path] ?? path}` : `${API}/api/auth-ext${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bridge-session": sid },
    body: JSON.stringify(b),
  });
  const raw = (await r.json().catch(() => ({}))) as { data?: { job?: unknown } };
  const json = (path === "/bridge/take" && r.ok ? { ...raw, data: raw.data?.job ?? null } : raw) as T;
  return { status: r.status === 201 ? 200 : r.status, json };
};
/** Bridge が仕事を 1 件もらう */
export const bridgeTake = (sid: string) =>
  asBridge<{ data: { job_id: string; prompt: string; agent_session_id: string | null } | null }>(sid, "/bridge/take", {
    protocol: 5, // 約束の版（K-62 で 5）
  });
/** Bridge が結末を返す（done／stopped／cancelled）。止まったものは止まったまま置かれる */
export const bridgeFinish = (
  sid: string,
  b: {
    job_id: string;
    state: "done" | "stopped" | "cancelled";
    result?: string;
    reason?: string;
    agent_session_id?: string;
  },
) => asBridge<{ data: { ok: boolean } }>(sid, "/bridge/finish", b);
/** 生きていると知らせる（自己診断の報告も一緒に返す） */
export const bridgeBeat = (sid: string, health?: { name: string; ok: boolean; detail?: string }[]) =>
  asBridge<{ data: { ok: boolean } }>(sid, "/bridge/heartbeat", health ? { health, protocol: 5 } : { protocol: 5 });
/** 知らせが来なくなった状態を作る（PC を閉じた・Bridge を終了した）。75 秒で「切れている」 */
export const bridgeAsleep = (sid: string) =>
  admin("update sessions set last_seen_at = now() - interval '5 minutes' where id = $1", [sid]);
/** この人の仕事の並び（状態の列） */
export const jobStates = (memberId: string) =>
  admin<{ state_id: string; agent_session_id: string | null }>(
    "select state_id, agent_session_id from bridge_jobs where member_id = $1 order by created_at",
    [memberId],
  );

/** ログイン後・入口の行き先。今日（T-U-13）がまだ無い間は、ある画面へ送る（D-086.6）。
 *  画面ができたら built-routes に載るので、このテストの期待も自動で 今日 に切り替わる */
export const HOME_RE = /\/(today|ai\/chat)$/;
/** 「新しい会話」（D-062）。次に言ったことが新しい 1 本になる（最初の質問と選択肢がまた出る） */
export const agentNewConversation = (token: string) => api("/api/auth-ext/agent/new", {}, token);

/** この PC で本物の Bridge が動いていると、偽の Bridge が港（38617）を取れず、
 *  画面も「入っている」側に倒れる。偽で演じるテストの間だけ止め、終わったら必ず戻す（G-10）。 */
let realWasUp: boolean | null = null;
export async function realBridge(on: boolean): Promise<void> {
  const { execSync } = await import("node:child_process");
  const up = async (): Promise<boolean> => {
    try {
      return (
        await fetch("http://127.0.0.1:38617/ping", {
          headers: { origin: "http://127.0.0.1:3124" },
          signal: AbortSignal.timeout(2000),
        })
      ).ok;
    } catch {
      return false;
    }
  };
  if (process.platform !== "darwin") return;
  if (!on) {
    if (realWasUp === null) realWasUp = await up();
    // 本人の本物の Bridge が動いているなら、黙って止めない。止めると本人の仕事（答え待ちを含む）が途中で死ぬ
    // （2026-09-28 実例：回帰テストが本人の Bridge を 2 回止め、答えが届かなくなった）。止めてよいと明示したときだけ止める
    if ((await up()) && process.env["QA_STOP_REAL_BRIDGE"] !== "1") {
      test.skip(
        true,
        "この PC で本人の Bridge が動いている。止めると本人の仕事が止まるので流さない（BLOCKED：QA_STOP_REAL_BRIDGE=1 で止めて流す）",
      );
      return;
    }
    // 途中で「起こす」が押されて立ち上がることがあるので、毎回必ず止める（最初の状態に関わらず）
    execSync('pkill -f "Kaname Bridge" || true');
    for (let i = 0; i < 30 && (await up()); i++) await new Promise((r) => setTimeout(r, 200));
    return;
  }
  if (!realWasUp) return;
  try {
    execSync('open -a "/Applications/Kaname Bridge.app"');
  } catch {
    /* 入っていないなら戻すものも無い */
  }
  realWasUp = null;
}

/** 本物の Bridge を止めずに、画面からだけ見えなくする（この PC の口 38617 への問い合わせを落とす）。
 *  偽の口を立てない画面のテストはこれで足りる。本人の Bridge と仕事はそのまま動き続ける */
export async function hideRealBridge(page: Page): Promise<void> {
  await page.route("http://127.0.0.1:38617/**", (r) => r.abort("connectionrefused"));
  await page.route("http://localhost:38617/**", (r) => r.abort("connectionrefused"));
}

// ---- 1 行 1 イベント（D-093）：Bridge が流す途中経過・確認 と、本人の答え を本物の口で作る
/** 途中経過（何をしているか）／init（会話の id） */
export const bridgeProgress = (
  sid: string,
  b: { job_id: string; seq: number; kind: "init" | "progress" | "status"; text?: string; agent_session_id?: string },
) => asBridge<{ data: { ok: boolean } }>(sid, "/bridge/progress", b);
/** 確認：「これを実行していいか」 */
export const bridgeAsk = (
  sid: string,
  b: { job_id: string; request_id: string; tool: string; input?: unknown; summary: string },
) => asBridge<{ data: { ok: boolean } }>(sid, "/bridge/ask", b);
/** Bridge が答えを取りに来る（無ければ null） */
export const bridgeAnswer = (sid: string, b: { job_id: string; request_id: string }) =>
  asBridge<{ data: { answer: "allow" | "deny" | null } }>(sid, "/bridge/answer", b);
/** 証跡：この仕事に対する許可／不許可の記録 */
export const toolAudit = (jobId: string) =>
  admin<{ action: string; actor_member_id: string | null }>(
    "select action, actor_member_id from audit_events where target_type = 'bridge_jobs' and target_id = $1 order by occurred_at",
    [jobId],
  );
