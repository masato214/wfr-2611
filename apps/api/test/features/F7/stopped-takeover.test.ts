// K-485「止まった AI の仕事から自分で直す（takeoverActionRun）と、止まった理由の種類（reason_kind・taken_over_at）」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K485-API-…）は 11_tickets/K-485.md の行の表と 1 対 1。
// 口：POST /api/v1/action_runs/:id/takeover（体は空）→ 201 { data: 実行の 1 件（ActionRunView） }
//   GET /action_runs/:id（getActionRun）・GET /tickets/:id/runs（listTicketRuns）の答えに reason_kind（7 つの種類か null）と taken_over_at を足す。
// 土台は段 1 の K-62 の試験の道具 F5/delegate-kit.ts（本物の Postgres・本物の PC の印・任せる／取る／終わる）。
//   K-485 の口の振る舞い（apps/api/src/hooks/stopped.ts の register・K-326）は F3/leaf-hooks.ts で最初の要求のときに 1 回だけ読み、K-62 の getActionRun・listTicketRuns を差し替える
//   （準備で読まないのは、実装の前の切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさないため・answer=8f745003d023）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の行の時刻を動かす。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ENDPOINTS } from "@kaname/contracts";
import { kanameError } from "@kaname/errors";
import type { Person } from "../fixture.js";
import { data, delegateOk, json, makeKit, type Device, type Kit } from "../F5/delegate-kit.js";
import { leafHooks } from "../F3/leaf-hooks.js";
// 種類の表（実装の前の切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさないよう、使う it の中で読む・answer=8f745003d023）
type ReasonKind =
  | "pc_closed"
  | "approval_expired"
  | "bridge_outdated"
  | "claude_missing"
  | "claude_login"
  | "browser_unreachable"
  | "unknown";
const reasonKindModule = () => import("../../../src/features/F7/stopped/reason-kind.js");

let k: Kit;
let owner: Person; // 担当者（書ける）

beforeAll(async () => {
  k = await makeKit();
  leafHooks(k.f, ["stopped"]); // 読むのは最初の要求のとき
  for (const op of ["takeoverActionRun", "getActionRun", "listTicketRuns", "getTicket"]) k.f.limits[op] = 100_000;
  owner = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "高本", ticketAbility: "edit" });
}, 90_000);
afterAll(async () => {
  await k?.close();
});

// ---------------------------------------------------------------- 手助け
const TEXT = {
  pcClosed:
    "PC の Kaname Bridge が途中で止まったので、ここで止まりました。Bridge を開き直してから、もう一度「AI に任せる」を押してください",
  claudeLogin:
    "Claude Code にログインできていません。Bridge の「ログインする」を押して、ブラウザで 1 回許可してください",
  claudeMissing: "Claude Code は入っていますが、本体が落ちてきていないので動きません。下のボタンで取り直せば直ります",
  bridgeOutdated: "この PC の Bridge が古いので、自分のAI に仕事を渡せません。Bridge を入れ直してください",
  approvalExpired: "承認から 24 時間を過ぎたので、実行の前にもう一度確かめます",
  browser:
    "AI が Chrome を使えませんでした。Chrome を開き、拡張機能「Claude in Chrome」が入っていてこの Claude と同じアカウントでログインしているか確かめてください",
  other: "Claude Code が途中で終わりました（終了コード 1）",
  noReason: "AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます",
} as const;
const STOP_NOW = "あなたが自分で進めることにしたので止めました";

const takeover = (p: Person, runId: string, body: unknown = {}) =>
  k.f.req("POST", `/action_runs/${runId}/takeover`, { body, headers: p.auth });
const ticketData = async (p: Person, id: string) =>
  data<{ can: { delegate: boolean }; stage?: { key: string } }>(
    await k.f.req("GET", `/tickets/${id}`, { headers: p.auth }),
  );
const systemLines = (ticketId: string) =>
  k.q<{ body: string }>(
    "select body from ticket_messages where ticket_id = $1 and kind = 'system' order by created_at",
    [ticketId],
  );
const runRow = async (runId: string) => (await k.q("select * from action_runs where id = $1", [runId]))[0]!;
const jobRow = async (jobId: string) => (await k.q("select * from bridge_jobs where id = $1", [jobId]))[0]!;
const flagOf = async (t: string) =>
  (await k.q("select delegated_to_clone as d from tickets where id = $1", [t]))[0]!["d"] as boolean;
const auditCount = (runId: string) =>
  k.n("select count(*) as n from audit_events where action = 'action_runs.takeover' and target_id = $1", [runId]);
const notices = () => k.n("select count(*) as n from notifications where tenant_id = $1", [k.T.tenantId]);

async function fresh(name: string): Promise<{ p: Person; pc: Device }> {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p, `${name} の PC`) };
}
/** 任せて、PC が取って、止まったと返すまで進める（理由 null は理由を送らない） */
async function stopped(p: Person, pc: Device, reason: string | null, o: { assignee?: Person } = {}) {
  const t = await k.ticket(p, o.assignee ? { assignee: o.assignee } : {});
  const d = await delegateOk(k, p, t);
  const job = await k.takeJob(pc);
  expect(job.job_id).toBe(d.job_id);
  const r = await k.finish(pc, d.job_id, { state: "stopped", ...(reason === null ? {} : { reason }) });
  expect(r.status, await r.clone().text()).toBe(201);
  return { t, runId: d.run_id, jobId: d.job_id };
}
/** 任せて、PC が取って、動いている（running）まで */
async function running(p: Person, pc: Device) {
  const t = await k.ticket(p);
  const d = await delegateOk(k, p, t);
  await k.takeJob(pc);
  return { t, runId: d.run_id, jobId: d.job_id };
}
const view = async (p: Person, runId: string) =>
  data<{ status: string; stopped_reason: string | null; reason_kind: string | null; taken_over_at: string | null }>(
    await k.run(p, runId),
  );

// ---------------------------------------------------------------- 止まった理由の種類（読むとき文と E 番号から決める・P7）
describe("K-485 止まった理由の種類（getActionRun・listTicketRuns の reason_kind）", () => {
  it.each([
    ["K485-API-001 PC の Bridge が途中で止まった（PC が閉じている）", TEXT.pcClosed, "pc_closed"],
    ["K485-API-002 Claude Code にログインできていない", TEXT.claudeLogin, "claude_login"],
    [
      "K485-API-003 本体が落ちてきていない（E 番号が文の中にあっても同じ）",
      `${TEXT.claudeMissing}（E-CONN-011）`,
      "claude_missing",
    ],
    ["K485-API-004 Bridge が古い", TEXT.bridgeOutdated, "bridge_outdated"],
    ["K485-API-005 AI がブラウザ（Chrome の拡張機能）とつながらない", TEXT.browser, "browser_unreachable"],
  ] as const)("%s：止まった実行の reason_kind が決まり、文はそのまま返る", async (_n, reason, kind) => {
    const { p, pc } = await fresh("理由の人");
    const s = await stopped(p, pc, reason);
    const v = await view(p, s.runId);
    expect(v).toMatchObject({ status: "stopped", stopped_reason: reason, reason_kind: kind, taken_over_at: null });
  });

  it("K485-API-006 承認から 24 時間（承認の後の実行が聞き直しになった文）：approval_expired", async () => {
    const { p, pc } = await fresh("二十四時間の人");
    const s = await stopped(p, pc, "止まりました");
    await k.f.admin.query("update action_runs set error_summary = $2 where id = $1", [s.runId, TEXT.approvalExpired]);
    expect((await view(p, s.runId)).reason_kind).toBe("approval_expired");
  });

  it("K485-API-007 どれにも当たらない文・理由が届かなかった：unknown（当て推量しない。文はそのまま返る）", async () => {
    const { p, pc } = await fresh("分からない人");
    const a = await stopped(p, pc, TEXT.other);
    expect(await view(p, a.runId)).toMatchObject({ reason_kind: "unknown", stopped_reason: TEXT.other });
    const b = await stopped(p, pc, null);
    expect(await view(p, b.runId)).toMatchObject({ reason_kind: "unknown", stopped_reason: TEXT.noReason });
    const c = await stopped(p, pc, "サブスクの 5 時間の枠に達しました");
    expect((await view(p, c.runId)).reason_kind).toBe("unknown");
  });

  it("K485-API-008 止まっていない実行（待っている・動いている・作り終えた）は reason_kind が null", async () => {
    const { p, pc } = await fresh("動いている人");
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    expect(await view(p, d.run_id)).toMatchObject({ status: "queued", reason_kind: null });
    await k.takeJob(pc);
    expect(await view(p, d.run_id)).toMatchObject({ status: "running", reason_kind: null, stopped_reason: null });
    const f = await k.finish(pc, d.job_id, { state: "done", result: "成果物の本文" });
    expect(f.status, await f.clone().text()).toBe(201);
    expect(await view(p, d.run_id)).toMatchObject({ status: "done", reason_kind: null });
  });

  it("K485-API-009 実行の一覧（listTicketRuns）も 1 件ずつ reason_kind と taken_over_at を持つ（新しい順・古い止まりと新しい止まり）", async () => {
    const { p, pc } = await fresh("一覧の人");
    const first = await stopped(p, pc, TEXT.claudeLogin);
    const d2 = await delegateOk(k, p, first.t);
    await k.takeJob(pc);
    expect((await k.finish(pc, d2.job_id, { state: "stopped", reason: TEXT.pcClosed })).status).toBe(201);
    const list = await data<{ id: string; reason_kind: string | null; taken_over_at: string | null }[]>(
      await k.runs(p, first.t),
    );
    expect(list.map((x) => [x.id, x.reason_kind, x.taken_over_at])).toEqual([
      [d2.run_id, "pc_closed", null],
      [first.runId, "claude_login", null],
    ]);
  });

  it.each([
    [
      "K485-API-010 E 番号が文より先に効く（文が別の種類でも E 番号の種類）",
      "stopped",
      "ログインできていません（E-CONN-012）",
      "bridge_outdated",
    ],
    ["K485-API-010 全角の E 番号と前後の空白でも当たる", "stopped", "  Ｅ－ＣＯＮＮ－０１０  ", "claude_login"],
    ["K485-API-010 取り消し（cancelled）で止まった実行も種類を持つ", "cancelled", TEXT.pcClosed, "pc_closed"],
    ["K485-API-010 文が null の止まりは unknown", "stopped", null, "unknown"],
    ["K485-API-010 止まっていない状態は null（queued・running・asking・done）", "running", TEXT.pcClosed, null],
    [
      "K485-API-010 「拡張機能」だけで Chrome が文に無い自由な文は browser_unreachable にしない（当て推量しない）",
      "stopped",
      "拡張機能の読み込みを待っていましたが、返事がありませんでした",
      "unknown",
    ],
  ] as const)("%s", async (_n, status, reason, kind) => {
    const { reasonKindOf } = await reasonKindModule();
    expect(reasonKindOf(status, reason)).toBe(kind);
  });

  it("K485-API-011 種類の表は 1 か所：どの種類にも正本（errors.json）の番号があり、文が空でない。unknown は E-STP-012", async () => {
    const { REASON_KIND_ERROR } = await reasonKindModule();
    const kinds: ReasonKind[] = [
      "pc_closed",
      "approval_expired",
      "bridge_outdated",
      "claude_missing",
      "claude_login",
      "browser_unreachable",
      "unknown",
    ];
    expect(Object.keys(REASON_KIND_ERROR).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      const id = REASON_KIND_ERROR[kind];
      expect(kanameError(id).toJSON(), `${kind} の ${id}`).toMatchObject({ code: id });
    }
    expect(REASON_KIND_ERROR.unknown).toBe("E-STP-012");
    expect(REASON_KIND_ERROR.claude_login).toBe("E-CONN-010");
  });
});

// ---------------------------------------------------------------- 自分で直す（takeoverActionRun）
describe("K-485 自分で直す：状態 × 入口 × 利用者の状態", () => {
  it("K485-API-012 止まった実行 × 自分で直す × 担当者：201。実行に taken_over_at・「AI に任せている」の旗は下り、段は作業中のまま。やり取りと証跡に 1 行ずつ。再取得でも同じ", async () => {
    const { p, pc } = await fresh("引き取る人");
    const s = await stopped(p, pc, TEXT.claudeLogin);
    const before = await runRow(s.runId);
    const r = await takeover(p, s.runId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await json(r))["data"] as Record<string, unknown>;
    expect(v).toMatchObject({ id: s.runId, ticket_id: s.t, status: "stopped", reason_kind: "claude_login" });
    expect(typeof v["taken_over_at"]).toBe("string");
    expect(Object.keys(v).sort()).toEqual(
      [
        "by",
        "checks",
        "finished_at",
        "id",
        "last_event_at",
        "pc",
        "phase",
        "progress",
        "reason_kind",
        "return_reason",
        "silent",
        "started_at",
        "status",
        "stopped_reason",
        "taken_over_at",
        "ticket_id",
      ].sort(),
    );
    expect(await flagOf(s.t)).toBe(false);
    expect(await k.stageOf(s.t)).toBe("doing");
    const after = await runRow(s.runId);
    expect(after["status_id"]).toBe("stopped");
    expect(after["error_summary"]).toBe(before["error_summary"]); // 止まった理由は書き換えない（履歴）
    const lines = (await systemLines(s.t)).map((x) => x.body).filter((b) => b.includes("自分で進めることにしました"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("引き取る人");
    expect(await auditCount(s.runId)).toBe(1);
    const again = await view(p, s.runId);
    expect(again.taken_over_at).toBe(v["taken_over_at"]);
    const list = await data<{ id: string; taken_over_at: string | null }[]>(await k.runs(p, s.t));
    expect(list[0]).toMatchObject({ id: s.runId, taken_over_at: v["taken_over_at"] });
  });

  it("K485-API-013 動いている実行（PC が取って running）× 自分で直す：実行と仕事を止める。PC には止める合図が届く", async () => {
    const { p, pc } = await fresh("動いているのを引き取る人");
    const s = await running(p, pc);
    expect(await view(p, s.runId)).toMatchObject({ status: "running" });
    const r = await takeover(p, s.runId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped", error_summary: STOP_NOW });
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_NOW });
    expect(await flagOf(s.t)).toBe(false);
    expect(await k.stageOf(s.t)).toBe("doing");
    const c = await k.control(pc, s.jobId);
    expect(((await json(c))["data"] as { stop: boolean }).stop).toBe(true);
  });

  it("K485-API-014 待っている実行（queued・PC がまだ取っていない）× 自分で直す：止める。PC が取りに来ても渡る仕事は無い", async () => {
    const { p, pc } = await fresh("待っているのを引き取る人");
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    const r = await takeover(p, d.run_id);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await runRow(d.run_id)).toMatchObject({ status_id: "stopped", error_summary: STOP_NOW });
    expect(await jobRow(d.job_id)).toMatchObject({ state_id: "stopped" });
    const took = await k.take(pc);
    expect(took.status).toBe(201);
    expect(((await json(took))["data"] as { job: unknown }).job).toBeNull();
    expect(await k.stageOf(t)).toBe("doing");
  });

  it("K485-API-015 担当者でない人（同じグループで書ける・AI に任せた人でもよい）と、担当者がいないチケット（誰も切り替えられない）：403・E-STP-001。何も変わらない", async () => {
    const { p: mate, pc: matePc } = await fresh("任せた人");
    const t = await k.ticket(owner); // 担当者は owner
    const d = await delegateOk(k, mate, t);
    await k.takeJob(matePc);
    expect((await k.finish(matePc, d.job_id, { state: "stopped", reason: TEXT.pcClosed })).status).toBe(201);
    const r = await takeover(mate, d.run_id);
    expect(r.status).toBe(403);
    expect((await json(r)).code).toBe("E-STP-001");
    expect((await runRow(d.run_id))["taken_over_at"]).toBeNull();
    expect(await systemLines(t).then((l) => l.filter((x) => x.body.includes("自分で進める")))).toHaveLength(0);
    expect(await auditCount(d.run_id)).toBe(0);
    // 担当者本人は切り替えられる
    expect((await takeover(owner, d.run_id)).status).toBe(201);
    // 担当者がいないチケットは、誰も切り替えられない
    {
      const { p, pc } = await fresh("担当の無い人");
      const s = await stopped(p, pc, TEXT.pcClosed);
      await k.f.admin.query("update tickets set assignee_member_id = null where id = $1", [s.t]);
      const r = await takeover(p, s.runId);
      expect(r.status).toBe(403);
      expect((await json(r)).code).toBe("E-STP-001");
      expect((await runRow(s.runId))["taken_over_at"]).toBeNull();
    }
  });

  it("K485-API-016 見えない人（別の会社・見えないグループ）・無い id・消したチケットの実行：404。切り替わらない", async () => {
    const { p, pc } = await fresh("見えない相手の人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const outsider = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    expect((await takeover(outsider, s.runId)).status).toBe(404);
    const g = (
      await k.f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '別のグループ', 'ZZ') returning id",
        [k.T.tenantId],
      )
    ).rows[0]!.id;
    const stranger = await k.f.person(k.T.tenantId, g, { name: "別のグループの人", ticketAbility: "edit" });
    expect((await takeover(stranger, s.runId)).status).toBe(404);
    expect((await takeover(p, randomUUID())).status).toBe(404);
    await k.f.admin.query("update tickets set deleted_at = now() where id = $1", [s.t]);
    expect((await takeover(p, s.runId)).status).toBe(404);
    expect((await runRow(s.runId))["taken_over_at"]).toBeNull();
  });

  it("K485-API-017 承認待ち（作る段が済んだ）・完了のチケット：409・E-STP-002。何も変わらない", async () => {
    const { p, pc } = await fresh("決まっている人");
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    await k.takeJob(pc);
    expect((await k.finish(pc, d.job_id, { state: "done", result: "成果物の本文" })).status).toBe(201);
    expect(await k.stageOf(t)).toBe("awaiting_approval");
    const r = await takeover(p, d.run_id);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe("E-STP-002");
    expect(await k.stageOf(t)).toBe("awaiting_approval");
    // 完了のチケット
    await k.f.admin.query(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = $2 and key = 'done') where id = $1",
      [t, k.T.tenantId],
    );
    const r2 = await takeover(p, d.run_id);
    expect(r2.status).toBe(409);
    expect((await json(r2)).code).toBe("E-STP-002");
    expect((await runRow(d.run_id))["taken_over_at"]).toBeNull();
  });

  it("K485-API-018 承認の後の実行（phase execute）：409・E-STP-002（自分で直すは作る段の止まりだけ）", async () => {
    const { p, pc } = await fresh("実行の後の人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const ex = (
      await k.f.admin.query<{ id: string }>(
        `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, created_by, error_summary, finished_at)
         values ($1, $2, $3, 'execute', 'stopped', $4, $5, now()) returning id`,
        [k.T.tenantId, k.T.rootScope, s.t, p.id, TEXT.pcClosed],
      )
    ).rows[0]!.id;
    const r = await takeover(p, ex);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe("E-STP-002");
    expect((await runRow(ex))["taken_over_at"]).toBeNull();
  });

  it("K485-API-019 もう自分で進めている実行を、もう一度（二度押し）：409・E-STP-003。やり取りの行は 1 つのまま", async () => {
    const { p, pc } = await fresh("二度押しの人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    expect((await takeover(p, s.runId)).status).toBe(201);
    const second = await takeover(p, s.runId);
    expect(second.status).toBe(409);
    expect((await json(second)).code).toBe("E-STP-003");
    const lines = (await systemLines(s.t)).filter((x) => x.body.includes("自分で進めることにしました"));
    expect(lines).toHaveLength(1);
    expect(await auditCount(s.runId)).toBe(1);
  });

  it("K485-API-020 同時に 2 つ（別のタブ）：1 つだけ通る [201, 409]。やり取りと証跡は 1 つずつ", async () => {
    const { p, pc } = await fresh("同時の人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const rs = await Promise.all([takeover(p, s.runId), takeover(p, s.runId)]);
    expect(rs.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await auditCount(s.runId)).toBe(1);
    expect((await systemLines(s.t)).filter((x) => x.body.includes("自分で進めることにしました"))).toHaveLength(1);
  });

  it("K485-API-021 新しい実行がある（古い止まりを指す）：409・E-STP-004。新しい実行は動いたまま", async () => {
    const { p, pc } = await fresh("古いのを指す人");
    const first = await stopped(p, pc, TEXT.claudeLogin);
    const second = await delegateOk(k, p, first.t); // もう一度任せた（新しい実行）
    const r = await takeover(p, first.runId);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe("E-STP-004");
    expect(await runRow(second.run_id)).toMatchObject({ status_id: "queued" });
    expect((await runRow(first.runId))["taken_over_at"]).toBeNull();
  });

  it("K485-API-022 切り替えた後：AI に任せ直せる（can.delegate が true・新しい実行は taken_over_at が null）。古い実行の印は残る", async () => {
    const { p, pc } = await fresh("任せ直す人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    expect((await takeover(p, s.runId)).status).toBe(201);
    expect((await ticketData(p, s.t)).can.delegate).toBe(true);
    const again = await delegateOk(k, p, s.t);
    expect(await flagOf(s.t)).toBe(true);
    expect(await view(p, again.run_id)).toMatchObject({ status: "queued", taken_over_at: null, reason_kind: null });
    expect((await view(p, s.runId)).taken_over_at).not.toBeNull();
  });

  it("K485-API-023 体に知らない項目：422（strict）・何も変わらない。空の体 {} は通る", async () => {
    const { p, pc } = await fresh("体を付ける人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const bad = await takeover(p, s.runId, { reason: "自分でやる" });
    expect(bad.status).toBe(422);
    expect((await runRow(s.runId))["taken_over_at"]).toBeNull();
    expect((await takeover(p, s.runId, {})).status).toBe(201);
  });

  it("K485-API-024 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数", async () => {
    const { p, pc } = await fresh("押しすぎる人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const anon = await k.f.req("POST", `/action_runs/${s.runId}/takeover`, { body: {} });
    expect(anon.status).toBe(401);
    const saved = k.f.limits["takeoverActionRun"];
    delete k.f.limits["takeoverActionRun"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await takeover(p, s.runId);
      expect(last!.status).toBe(429);
      const sec = Number((await json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) k.f.limits["takeoverActionRun"] = saved;
    }
  });

  it("K485-API-025 手順 1「DB に書く」が失敗（関数が使えない・DB が落ちた）：503・E-PAGE-003。実行・仕事・チケット・やり取り・証跡のどれも変わらない", async () => {
    const { p, pc } = await fresh("落ちる人");
    const s = await running(p, pc);
    await k.f.admin.query("revoke execute on function app.run_takeover(uuid) from kaname_app");
    try {
      const r = await takeover(p, s.runId);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("grant execute on function app.run_takeover(uuid) to kaname_app");
    }
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running", taken_over_at: null });
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "running" });
    expect(await flagOf(s.t)).toBe(true);
    expect(await k.stageOf(s.t)).toBe("running");
    expect(await auditCount(s.runId)).toBe(0);
  });

  it("K485-API-026 手順 2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので実行も仕事も切り替わらない", async () => {
    const { p, pc } = await fresh("証跡が落ちる人");
    const s = await running(p, pc);
    await k.f.admin.query(
      `create or replace function public.k485_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'action_runs.takeover' then raise exception 'K-485 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await k.f.admin.query(
      "create trigger k485_fail_audit before insert on audit_events for each row execute function public.k485_fail_audit()",
    );
    try {
      const r = await takeover(p, s.runId);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("drop trigger if exists k485_fail_audit on audit_events");
      await k.f.admin.query("drop function if exists public.k485_fail_audit()");
    }
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running", taken_over_at: null });
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "running" });
    expect(await k.stageOf(s.t)).toBe("running");
    expect(await systemLines(s.t).then((l) => l.filter((x) => x.body.includes("自分で進める")))).toHaveLength(0);
  });

  it("K485-API-027 手順「知らせ」は出さない：切り替えても受け箱の行は 1 つも増えない（会社の全体）", async () => {
    const { p, pc } = await fresh("知らせない人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const before = await notices();
    expect((await takeover(p, s.runId)).status).toBe(201);
    expect(await notices()).toBe(before);
  });

  it("K485-API-028 DB の関数の守り：security definer・search_path に pg_temp・public から外して kaname_app だけに渡す。担当者でない文脈で直に呼ぶと { ok: false, code: FORBIDDEN }", async () => {
    const fn = (
      await k.q<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
        `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
                has_function_privilege('kaname_app', p.oid, 'execute') as app
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'run_takeover'`,
      )
    )[0]!;
    expect(fn.definer).toBe(true);
    expect(fn.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    expect(fn.pub).toBe(false);
    expect(fn.app).toBe(true);
    const { p, pc } = await fresh("直に呼ぶ人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const other = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "担当でない人", ticketAbility: "edit" });
    const c = await k.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [k.T.tenantId, other.id],
      );
      const r = (await c.query<{ v: Record<string, unknown> }>("select app.run_takeover($1) as v", [s.runId])).rows[0]!
        .v;
      expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect((await runRow(s.runId))["taken_over_at"]).toBeNull();
  });

  it("K485-API-029 retryActionRun は契約から外れている：契約の口の一覧に無く、POST /action_runs/:id/retry は 404（前は 501）", async () => {
    expect(ENDPOINTS.some((e) => e.operationId === "retryActionRun")).toBe(false);
    expect(ENDPOINTS.some((e) => e.operationId === "takeoverActionRun")).toBe(true);
    const { p, pc } = await fresh("もう一度の人");
    const s = await stopped(p, pc, TEXT.pcClosed);
    const r = await k.f.req("POST", `/action_runs/${s.runId}/retry`, { body: {}, headers: p.auth });
    expect(r.status).toBe(404);
  });

  it("K485-API-030 失敗（手順 S4：止めた PC への合図）：PC が止める合図を読まないまま結果を返しても 404 で拒まれる（2 回返しても同じ）。実行・仕事は stopped のまま・段は承認待ちにならず承認の行も増えない", async () => {
    const { p, pc } = await fresh("合図を読まない PC");
    const s = await running(p, pc);
    expect((await takeover(p, s.runId)).status).toBe(201);
    for (const result of ["合図を読まずに返した成果物", "もう一度返した成果物"]) {
      expect((await k.finish(pc, s.jobId, { state: "done", result })).status).toBe(404);
    }
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped", error_summary: STOP_NOW });
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_NOW });
    expect(await k.stageOf(s.t)).toBe("doing");
    expect(await k.n("select count(*) as n from approvals where ticket_id = $1", [s.t])).toBe(0);
    const c = await k.control(pc, s.jobId);
    expect(((await json(c))["data"] as { stop: boolean }).stop).toBe(true);
  });
});
