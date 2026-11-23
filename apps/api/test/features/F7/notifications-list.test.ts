// K-461「知らせを読む口（listNotifications）と、読んだ印の列 read_at・読みの行の守りを自分宛てだけに絞る・種類 → 札と行き先の表」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K461-API-…）は 11_tickets/K-461.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と 05_flow/screen_api.d/K-461.py で直す）:
//   listNotifications  GET /api/v1/notifications（本人・120 回／分／人）
//     問い合わせ：unread（true／false・無ければ全部）・actor_member_id（uuid・その人が起こした知らせだけ）・limit（1〜50・既定 20）・cursor（この口が出した鍵）
//     200 { data: Item[], meta: { next_cursor: string | null, actors: { id, name }[] } }・Cache-Control: private, no-store
//     Item = { id, kind, tag, href, ticket_id, number, title, actor: { id, name } | null, params, read, read_at, created_at }（鍵はちょうど 12 個）
//     見える行：自分宛て（member_id が自分）・channel_id が inapp・消していない・種類が表（kinds.ts）にある・チケットの種類は今そのチケットが見える
//               ＋ 未読は全部／読んだものは読んだ時刻から 30 日以内（P3）
//     並び：できた時刻の新しい順 → id の新しい順。続きは keyset の鍵（読んでいる間に増えても重ならない）。meta.actors は、見える行を起こした人（絞り込みに関わらず・最初の分だけ）
// DB（migration 20261123086100_notifications_read_at.sql）:
//   notifications に read_at（timestamptz・null＝未読）。索引 notifications_inbox_unread_idx（未読だけ）と notifications_inbox_idx。
//   行の守り：読む＝同じ会社で自分宛て／書く＝同じ会社で自分宛て（前の「同じ会社なら誰でも読める」「notifications の edit を持つ人は誰の行でも書ける」をやめる・P2）
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  asApp,
  auth,
  boss,
  clearNotices,
  f,
  json,
  limits,
  listNotices,
  member,
  notice,
  one,
  outsider,
  pageOf,
  ready,
  req,
  rowOf,
  rowsAs,
  setupNotify,
  T,
  ticket,
  ticketPayload,
  writer,
} from "./notify.harness.js";

setupNotify();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const KEYS = [
  "actor",
  "created_at",
  "href",
  "id",
  "kind",
  "number",
  "params",
  "read",
  "read_at",
  "tag",
  "ticket_id",
  "title",
];
const bridge = (label = "仕事用の PC") => ({ device_id: "dev-1", device_label: label });

/** 本番の画面の道（apps/web/app の page.tsx）の集まり。(group) は道に出ない・[x] は動く部分 */
function routesOf(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) {
      if (name === "page.tsx") out.push(prefix || "/");
      continue;
    }
    if (name === "(dev)") continue;
    const seg = /^\(.+\)$/.test(name) ? "" : `/${name}`;
    out.push(...routesOf(p, prefix + seg));
  }
  return out;
}

describe("K-461 知らせを読む口", () => {
  it("K461-API-001 一覧の形：自分宛ての 3 件が新しい順。鍵はちょうど 12 個で、チケットの種類は行き先と番号と題名を持ち、設定の種類は持たない", async () => {
    await ready();
    const p = await member("読む人");
    const t1 = await ticket({ assignee: p, title: "請求書を送る" });
    const t2 = await ticket({ assignee: p, title: "見積を直す" });
    const a = await notice(p, {
      kind: "ticket.assigned",
      payload: ticketPayload(t1, "請求書を送る"),
      actor: boss.id,
      ageMin: 30,
    });
    const b = await notice(p, {
      kind: "approval.requested",
      payload: ticketPayload(t2, "見積を直す", { approval_id: "ap-1" }),
      ageMin: 20,
    });
    const c = await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 10 });
    const page = await pageOf(p);
    expect(page.data.map((x) => x.id)).toEqual([c, b, a]);
    for (const x of page.data) expect(Object.keys(x).sort()).toEqual(KEYS);
    const [ic, ib, ia] = page.data;
    expect(ia).toMatchObject({
      kind: "ticket.assigned",
      tag: "write",
      href: `/tickets/${t1.id}`,
      ticket_id: t1.id,
      number: t1.number,
      title: "請求書を送る",
      read: false,
      read_at: null,
    });
    expect(ia!.actor).toEqual({ id: boss.id, name: "高本" });
    expect(ib).toMatchObject({
      kind: "approval.requested",
      tag: "approval",
      href: `/tickets/${t2.id}`,
      ticket_id: t2.id,
    });
    expect(ib!.params).toEqual({ approval_id: "ap-1" });
    expect(ic).toMatchObject({
      kind: "bridge.connected",
      tag: "setting",
      href: "/setup/bridge",
      ticket_id: null,
      number: null,
      title: null,
      actor: null,
    });
    expect(ic!.params).toEqual({ device_label: "仕事用の PC" });
    expect(Number.isNaN(Date.parse(ic!.created_at))).toBe(false);
  });

  it("K461-API-002 守り：同じ会社の別の人宛ての行は、権限のある人（notifications の edit）にも出ない", async () => {
    await ready();
    const a = await member("読む人");
    const b = await member("別の人");
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'notifications', null, 'edit')",
      [T.tenantId, a.id],
    );
    const mine = await notice(a, { kind: "bridge.connected", payload: bridge("自分の PC") });
    const yours = await notice(b, { kind: "bridge.connected", payload: bridge("別の人の PC") });
    const ids = (await pageOf(a)).data.map((x) => x.id);
    expect(ids).toEqual([mine]);
    expect(ids).not.toContain(yours);
    expect(JSON.stringify(await pageOf(a))).not.toContain("別の人の PC");
  });

  it("K461-API-003 守り：別の会社の人には、この会社の行が出ない。別の会社の人の一覧にはその人の行だけが出る", async () => {
    await ready();
    const a = await member("読む人");
    await notice(a, { kind: "bridge.connected", payload: bridge("会社 A の PC") });
    const theirs = await notice(outsider, { kind: "bridge.connected", payload: bridge("会社 B の PC") });
    const page = await pageOf(outsider);
    expect(page.data.map((x) => x.id)).toContain(theirs);
    expect(JSON.stringify(page)).not.toContain("会社 A の PC");
    await clearNotices(outsider);
  });

  it("K461-API-004 出さない行：メールの印の行（channel email）・消した行は出ない", async () => {
    await ready();
    const p = await member("読む人");
    const shown = await notice(p, { kind: "bridge.connected", payload: bridge() });
    await notice(p, { kind: "bridge.connected", channel: "email", payload: bridge() });
    await notice(p, { kind: "bridge.connected", deleted: true, payload: bridge() });
    expect((await pageOf(p)).data.map((x) => x.id)).toEqual([shown]);
  });

  it("K461-API-005 未読は全部・読んだものは 30 日分：40 日前にできた未読は出る。読んで 29 日の行は出て、読んで 31 日の行は出ない", async () => {
    await ready();
    const p = await member("読む人");
    const oldUnread = await notice(p, { kind: "bridge.connected", payload: bridge("古い未読"), ageMin: 40 * 1440 });
    const read29 = await notice(p, {
      kind: "bridge.connected",
      payload: bridge("読んで 29 日"),
      ageMin: 50 * 1440,
      readAgoDays: 29,
    });
    const read31 = await notice(p, {
      kind: "bridge.connected",
      payload: bridge("読んで 31 日"),
      ageMin: 50 * 1440,
      readAgoDays: 31,
    });
    const ids = (await pageOf(p)).data.map((x) => x.id);
    expect(ids).toContain(oldUnread);
    expect(ids).toContain(read29);
    expect(ids).not.toContain(read31);
    const read = (await pageOf(p)).data.find((x) => x.id === read29)!;
    expect(read.read).toBe(true);
    expect(Number.isNaN(Date.parse(String(read.read_at)))).toBe(false);
  });

  it("K461-API-006 未読だけ：unread=true は未読だけ・false と空は全部・true と false 以外は 422（欄 unread）", async () => {
    await ready();
    const p = await member("読む人");
    const u = await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 5 });
    const r = await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 6, readAgoDays: 1 });
    expect((await pageOf(p, "unread=true")).data.map((x) => x.id)).toEqual([u]);
    expect((await pageOf(p, "unread=false")).data.map((x) => x.id)).toEqual([u, r]);
    expect((await pageOf(p, "unread=")).data.map((x) => x.id)).toEqual([u, r]);
    const bad = await listNotices(p, "unread=maybe");
    expect(bad.status).toBe(422);
    expect(JSON.stringify(await json(bad))).toContain("unread");
  });

  it("K461-API-007 人で絞る：actor_member_id でその人が起こした知らせだけ。meta.actors は絞り込みに関わらず見える行を起こした人（名前つき）", async () => {
    await ready();
    const p = await member("読む人");
    const fromBoss = await notice(p, { kind: "bridge.connected", payload: bridge(), actor: boss.id, ageMin: 5 });
    const fromWriter = await notice(p, { kind: "bridge.connected", payload: bridge(), actor: writer.id, ageMin: 6 });
    await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 7 });
    const byBoss = await pageOf(p, `actor_member_id=${boss.id}`);
    expect(byBoss.data.map((x) => x.id)).toEqual([fromBoss]);
    expect((await pageOf(p, `actor_member_id=${writer.id}`)).data.map((x) => x.id)).toEqual([fromWriter]);
    const who = [...byBoss.meta.actors].sort((x, y) => x.name.localeCompare(y.name, "ja"));
    expect(who).toEqual(
      [
        ...[
          { id: boss.id, name: "高本" },
          { id: writer.id, name: "佐藤" },
        ],
      ].sort((x, y) => x.name.localeCompare(y.name, "ja")),
    );
    expect((await pageOf(p, `actor_member_id=${(await member("起こしていない人")).id}`)).data).toEqual([]);
    const second = await pageOf(p, "limit=1");
    const next = await pageOf(p, `limit=1&cursor=${second.meta.next_cursor}`);
    expect(next.meta.actors).toEqual([]);
  });

  it("K461-API-008 20 件ずつ：25 件あれば 1 回目は新しい 20 件と next_cursor・2 回目は残り 5 件で next_cursor が null。重ならず、抜けない", async () => {
    await ready();
    const p = await member("読む人");
    const ids: string[] = [];
    for (let i = 1; i <= 25; i++)
      ids.push(await notice(p, { kind: "bridge.connected", payload: bridge(`PC ${i}`), ageMin: i }));
    const first = await pageOf(p);
    expect(first.data).toHaveLength(20);
    expect(first.data.map((x) => x.id)).toEqual(ids.slice(0, 20));
    expect(first.meta.next_cursor).toEqual(expect.any(String));
    const second = await pageOf(p, `cursor=${first.meta.next_cursor}`);
    expect(second.data.map((x) => x.id)).toEqual(ids.slice(20));
    expect(second.meta.next_cursor).toBeNull();
  });

  it("K461-API-009 続きは keyset：読んでいる間に新しい知らせが増えても、2 回目の分は 1 回目と重ならない。同じ時刻の行は id で割れる", async () => {
    await ready();
    const p = await member("読む人");
    const same = new Date(Date.now() - 60_000);
    const three = [
      await notice(p, { kind: "bridge.connected", payload: bridge("同じ時刻 1"), createdAt: same }),
      await notice(p, { kind: "bridge.connected", payload: bridge("同じ時刻 2"), createdAt: same }),
      await notice(p, { kind: "bridge.connected", payload: bridge("同じ時刻 3"), createdAt: same }),
    ];
    const first = await pageOf(p, "limit=2");
    await notice(p, { kind: "bridge.connected", payload: bridge("途中で増えた"), ageMin: 0 });
    const second = await pageOf(p, `limit=2&cursor=${first.meta.next_cursor}`);
    const got = [...first.data, ...second.data].map((x) => x.id);
    expect(new Set(got).size).toBe(got.length);
    expect([...got].sort()).toEqual([...three].sort());
    expect(second.meta.next_cursor).toBeNull();
  });

  it("K461-API-010 limit：50 まで通る・既定は 20・0・51・数でない値は 422", async () => {
    await ready();
    const p = await member("読む人");
    for (let i = 1; i <= 22; i++) await notice(p, { kind: "bridge.connected", payload: bridge(`PC ${i}`), ageMin: i });
    expect((await pageOf(p)).data).toHaveLength(20);
    expect((await pageOf(p, "limit=50")).data).toHaveLength(22);
    expect((await pageOf(p, "limit=3")).data).toHaveLength(3);
    for (const bad of ["limit=0", "limit=51", "limit=abc"]) expect((await listNotices(p, bad)).status, bad).toBe(422);
    // 入口（op.ts）は既定 50・上限 200 を見るだけ。51 は入口を通るので、口が自分で欄 limit の 422 を返す
    expect(JSON.stringify(await json(await listNotices(p, "limit=51")))).toContain("limit");
  });

  it("K461-API-011 続きの鍵：形（base64url の 1〜200 字）に合わない鍵は 422（欄 cursor・入口）。形に合うのに今の状態では読めない鍵（JSON でない・中身が合わない）は 409・E-NTF-001・欄なし。500 にしない。最初から読み直せば 200", async () => {
    await ready();
    const p = await member("読む人");
    await notice(p, { kind: "bridge.connected", payload: bridge() });
    const b64 = (v: string) => Buffer.from(v, "utf8").toString("base64url");
    const unreadable = [
      b64(JSON.stringify(["いつか", "id でない"])),
      b64("これは鍵ではない"),
      b64(JSON.stringify({ x: 1 })),
    ];
    for (const cursor of ["!!!", "a".repeat(201)]) {
      const r = await listNotices(p, `cursor=${cursor}`);
      expect(r.status, cursor).toBe(422);
      expect(JSON.stringify(await json(r))).toContain("cursor");
    }
    for (const cursor of unreadable) {
      const r = await listNotices(p, `cursor=${cursor}`);
      expect(r.status, cursor).toBe(409);
      const body = await json(r);
      expect(body["code"], cursor).toBe("E-NTF-001");
      expect(body["field"], cursor).toBeUndefined();
      expect(body["details"], cursor).toBeUndefined();
    }
    expect((await pageOf(p)).data).toHaveLength(1);
  });

  it("K461-API-012 知らない種類は読み飛ばす：表に無い種類の行は出ず、あとの行は出る（500 にしない）", async () => {
    await ready();
    const p = await member("読む人");
    await notice(p, { kind: "future.unknown_kind", payload: { text: "知らない" }, ageMin: 1 });
    const known = await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 2 });
    const page = await pageOf(p);
    expect(page.data.map((x) => x.id)).toEqual([known]);
  });

  it("K461-API-013 payload は決めた欄だけ：本文・url・due_on・知らない欄は出ない。文字は文字の単位で 200 字に切る。stage は key と name だけ。題名の無い ticket.completed は title が null", async () => {
    await ready();
    const p = await member("読む人");
    const t = await ticket({ assignee: p, title: "書き込みのあったチケット" });
    const title = "書き込みのあったチケット";
    const msg = await notice(p, {
      kind: "ticket.message",
      payload: ticketPayload(t, title, {
        message_id: "m-1",
        url: `/tickets/${t.id}`,
        due_on: "2099-12-31",
        body: "秘密の本文",
        secret: "s3cret",
        note: "メモ",
      }),
      ageMin: 6,
    });
    const stopped = await notice(p, {
      kind: "ticket.stopped",
      payload: ticketPayload(t, title, { reason: "あ".repeat(300), job_id: "j-1" }),
      ageMin: 5,
    });
    const emoji = await notice(p, {
      kind: "ticket.stopped",
      payload: ticketPayload(t, title, { reason: "😀".repeat(300), job_id: "j-2" }),
      ageMin: 4,
    });
    const staged = await notice(p, {
      kind: "ticket.stage_changed",
      payload: ticketPayload(t, title, { message_id: "m-2", stage: { key: "doing", name: "作業中", extra: "余分" } }),
      ageMin: 3,
    });
    const badStage = await notice(p, {
      kind: "ticket.decision",
      payload: ticketPayload(t, title, { decision_id: "d-1", action: "add", stage: { key: "doing", name: 5 } }),
      ageMin: 2,
    });
    const completed = await notice(p, {
      kind: "ticket.completed",
      payload: { ticket_id: t.id, number: t.number, url: `/tickets/${t.id}` },
      ageMin: 1,
    });
    const page = await pageOf(p);
    const by = (id: string) => page.data.find((x) => x.id === id)!;
    expect(by(msg).params).toEqual({ message_id: "m-1" });
    expect(Object.keys(by(stopped).params).sort()).toEqual(["job_id", "reason"]);
    expect(String(by(stopped).params["reason"])).toHaveLength(200);
    expect(by(emoji).params["reason"]).toBe("😀".repeat(200));
    expect(by(staged).params).toEqual({ message_id: "m-2", stage: { key: "doing", name: "作業中" } });
    expect(by(badStage).params).toEqual({ decision_id: "d-1", action: "add" });
    expect(by(completed)).toMatchObject({ title: null, number: t.number, href: `/tickets/${t.id}`, params: {} });
    const text = JSON.stringify(page);
    for (const leak of ["秘密の本文", "s3cret", "メモ", "余分", "2099-12-31"]) expect(text).not.toContain(leak);
  });

  it("K461-API-014 見えないチケットの行は出ない：権限の無いグループ・消したチケット・権限を外された後。担当者になれば見える", async () => {
    await ready();
    const p = await member("読む人");
    const other = await member("担当の人");
    const seen = await ticket({ assignee: other, title: "見えるチケット" });
    const sc = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '見えないグループ', 'ZZ') returning id",
      [T.tenantId],
    );
    // 席が会社の全体のままだと、権限（permissions）を外しても席の層で全部見えたままになる。席を別の層に移し、会社の全体は権限だけで見える形にする
    const seat = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '読む人の席', 'ZS') returning id",
      [T.tenantId],
    );
    await f.admin.query("update members set scope_id = $2 where id = $1", [p.id, seat.id]);
    const hidden = await ticket({ assignee: other, scope: sc.id, title: "見えないチケット" });
    const n1 = await notice(p, {
      kind: "approval.requested",
      payload: ticketPayload(seen, "見えるチケット"),
      ageMin: 2,
    });
    const n2 = await notice(p, {
      kind: "approval.requested",
      payload: ticketPayload(hidden, "見えないチケット"),
      ageMin: 1,
    });
    expect((await pageOf(p)).data.map((x) => x.id)).toEqual([n1]);
    expect(JSON.stringify(await pageOf(p))).not.toContain("見えないチケット");
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [seen.id]);
    expect((await pageOf(p)).data).toEqual([]);
    await f.admin.query("update tickets set deleted_at = null where id = $1", [seen.id]);
    expect((await pageOf(p)).data.map((x) => x.id)).toEqual([n1]);
    await f.admin.query("delete from permissions where grantee_member_id = $1", [p.id]);
    expect((await pageOf(p)).data).toEqual([]);
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [seen.id, p.id]);
    expect((await pageOf(p)).data.map((x) => x.id)).toEqual([n1]);
    expect(n2).not.toBe(n1);
  });

  it("K461-API-015 行き先は実在する道：チケットの種類は /tickets/<id>・設定の種類は /mfa-setup か /setup/bridge・行き先の無い種類は null。全部が本番の画面の道の集まりに入る", async () => {
    const { KINDS, hrefOf } = await import("../../../src/features/F7/notifications/kinds.js");
    const routes = routesOf(join(ROOT, "apps", "web", "app"));
    expect(routes).toContain("/tickets/[id]");
    const id = "11111111-1111-4111-8111-111111111111";
    const seen = new Set<string>();
    for (const [kind, rule] of Object.entries(KINDS)) {
      const href = hrefOf(kind, { ticket_id: id });
      if (rule.ticket) {
        expect(href, kind).toBe(`/tickets/${id}`);
        continue;
      }
      if (href === null) continue;
      expect(routes, `${kind} の行き先 ${href} が本番の道に無い`).toContain(href);
      seen.add(href);
    }
    expect([...seen].sort()).toEqual(["/mfa-setup", "/setup/bridge"]);
    expect(hrefOf("invitation_resend_requested", {})).toBeNull();
    // 管理者が受け取る知らせは本人の 2 段階認証の設定の道では用が足りない。取り消し系は押せない行
    expect(hrefOf("security.admin_recovery_requested", { ticket_id: id })).toBeNull();
    expect(hrefOf("handover.withdrawn", { ticket_id: id })).toBeNull();
    expect(hrefOf("security.new_device", {})).toBe("/mfa-setup");
    expect(hrefOf("ticket.assigned", { ticket_id: "uuid でない" })).toBeNull();
    expect(hrefOf("ticket.assigned", {})).toBeNull();
  });

  it("K461-API-016 種類の表：本線の migration が書く種類は全部ある。段 5・段 7・段 9・段 8 の種類も入っている。札は決まった 6 つのどれか", async () => {
    const { KINDS, KNOWN_KINDS, TICKET_KINDS, PARAM_KEYS } =
      await import("../../../src/features/F7/notifications/kinds.js");
    const dir = join(ROOT, "packages", "db", "migrations");
    const written = new Set<string>();
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql"))) {
      for (const m of readFileSync(join(dir, name), "utf8").matchAll(/'inapp'\s*,\s*'([a-z_.]+)'/g)) written.add(m[1]!);
    }
    expect(written.size).toBeGreaterThan(3);
    for (const kind of written) expect(Object.keys(KINDS), `migration が書く種類 ${kind} が表に無い`).toContain(kind);
    const planned = [
      "ticket.assigned",
      "ticket.created",
      "ticket.completed",
      "ticket.mentioned",
      "ticket.message",
      "ticket.stage_changed",
      "ticket.decision",
      "ticket.due_changed",
      "ticket.sort_changed",
      "ticket.stopped",
      "approval.requested",
      "handover.requested",
      "handover.offered",
      "handover.accepted",
      "handover.declined",
      "handover.withdrawn",
      "handover.reminded",
      "handover.overdue",
      "handover.managers",
      "handover.distributed",
      "handover.reassigned",
      "handover.distributed_done",
      "handover.claimed",
      "handover.group_distributed",
      "security.new_device",
      "security.admin_recovery_requested",
      "bridge.connected",
      "invitation_resend_requested",
    ];
    for (const kind of planned) expect(Object.keys(KINDS), kind).toContain(kind);
    const tags = new Set(["handover", "approval", "mention", "stopped", "write", "setting"]);
    for (const [kind, rule] of Object.entries(KINDS)) expect(tags.has(rule.tag), `${kind} の札 ${rule.tag}`).toBe(true);
    expect([...KNOWN_KINDS].sort()).toEqual(Object.keys(KINDS).sort());
    expect(TICKET_KINDS.every((k) => KINDS[k]!.ticket)).toBe(true);
    // 段 5（K-440）が優先度・親を変えたとき担当者に書く知らせ：札 write・チケットに結ぶ
    expect(KINDS["ticket.sort_changed"]).toMatchObject({ tag: "write", ticket: true });
    expect(KINDS["ticket.mentioned"]!.tag).toBe("mention");
    expect(KINDS["ticket.stopped"]!.tag).toBe("stopped");
    expect(KINDS["approval.requested"]!.tag).toBe("approval");
    expect(KINDS["handover.requested"]!.tag).toBe("handover");
    expect(KINDS["bridge.connected"]!.ticket).toBe(false);
    expect(KINDS["handover.offered"]).toMatchObject({ tag: "handover", ticket: true });
    // 取り消し系は消した後も出す（D-148.5）：チケットの見え方を見ず・行き先なし
    expect(KINDS["handover.withdrawn"]).toMatchObject({ tag: "write", ticket: false, href: null, afterDelete: true });
    expect(
      Object.entries(KINDS)
        .filter(([, r]) => r.afterDelete)
        .map(([k]) => k),
    ).toEqual(["handover.withdrawn"]);
    expect(KINDS["security.admin_recovery_requested"]!.href).toBeNull();
    expect([...PARAM_KEYS].sort()).toEqual([
      "action",
      "approval_id",
      "decision_id",
      "device_label",
      "from_name",
      "handover_id",
      "job_id",
      "message_id",
      "reason",
      "reply_due",
      "stage",
    ]);
  });

  it("K461-API-017 ログインしていない：401 で、一覧を返さない", async () => {
    await ready();
    const r = await req("GET", "/notifications");
    expect(r.status).toBe(401);
    expect((await json(r))["data"]).toBeUndefined();
  });

  it("K461-API-018 上限：同じ人が上限を超えたら 429 と retry_after_sec（1〜60 の整数）", async () => {
    await ready();
    const p = await member("読む人");
    limits["listNotifications"] = 2;
    try {
      expect((await listNotices(p)).status).toBe(200);
      expect((await listNotices(p)).status).toBe(200);
      const r = await listNotices(p);
      expect(r.status).toBe(429);
      const s = Number((await json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
    } finally {
      delete limits["listNotifications"];
    }
  });

  it("K461-API-019 貯めない：Cache-Control に private と no-store", async () => {
    await ready();
    const p = await member("読む人");
    const r = await listNotices(p);
    expect(r.status).toBe(200);
    const cc = r.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });

  it("K461-API-020 1 件も無い：200・data は空・next_cursor は null・actors は空", async () => {
    await ready();
    const p = await member("読む人");
    const page = await pageOf(p);
    expect(page.data).toEqual([]);
    expect(page.meta).toEqual({ next_cursor: null, actors: [] });
  });

  it("K461-API-021 読むだけ：一覧を何度読んでも行は変わらない（read_at・updated_at・件数）", async () => {
    await ready();
    const p = await member("読む人");
    const id = await notice(p, { kind: "bridge.connected", payload: bridge() });
    const before = await rowOf(id);
    await pageOf(p);
    await pageOf(p, "unread=true");
    const after = await rowOf(id);
    expect(after).toEqual(before);
    expect(after!["read_at"]).toBeNull();
  });

  it("K461-API-022 read_at の列：timestamptz で null を許し、足した後に入れた行も前からの行も既定は null（未読）", async () => {
    await ready();
    const col = await one<{ data_type: string; is_nullable: string; column_default: string | null }>(
      "select data_type, is_nullable, column_default from information_schema.columns where table_name = 'notifications' and column_name = 'read_at'",
    );
    expect(col.data_type).toBe("timestamp with time zone");
    expect(col.is_nullable).toBe("YES");
    expect(col.column_default).toBeNull();
    const p = await member("読む人");
    const r = await one<{ id: string }>(
      "insert into notifications (tenant_id, member_id, channel_id, event_kind_id) values ($1, $2, 'inapp', 'bridge.connected') returning id",
      [p.tenantId, p.id],
    );
    expect((await rowOf(r.id))!["read_at"]).toBeNull();
  });

  it("K461-API-023 行の守り（読む）：自分の行は 1 行・同じ会社の別の人の行は 0 行（notifications の edit を持つ人でも）・別の会社の人も 0 行", async () => {
    await ready();
    const a = await member("読む人");
    const b = await member("別の人");
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'notifications', null, 'edit')",
      [T.tenantId, a.id],
    );
    const mine = await notice(a, { kind: "bridge.connected" });
    const yours = await notice(b, { kind: "bridge.connected" });
    const sql = "select id from notifications where id = any($1::uuid[])";
    expect((await rowsAs<{ id: string }>(a, sql, [[mine, yours]])).map((r) => r.id)).toEqual([mine]);
    expect(await rowsAs(b, sql, [[mine]])).toEqual([]);
    expect(await rowsAs(outsider, sql, [[mine, yours]])).toEqual([]);
  });

  it("K461-API-024 行の守り（書く）：自分の行は直せ・足せる。別の人の行は直せず消せず（権限のある人でも）、別の人宛てを足すことも断られる", async () => {
    await ready();
    const a = await member("書く人");
    const b = await member("別の人");
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'notifications', null, 'edit')",
      [T.tenantId, a.id],
    );
    const mine = await notice(a, { kind: "bridge.connected" });
    const yours = await notice(b, { kind: "bridge.connected" });
    expect(await asApp(a, "update notifications set read_at = now() where id = $1", [mine])).toBe(1);
    expect(await asApp(a, "update notifications set read_at = now() where id = $1", [yours])).toBe(0);
    expect((await rowOf(yours))!["read_at"]).toBeNull();
    expect(await asApp(a, "delete from notifications where id = $1", [yours])).toBe(0);
    expect(await rowOf(yours)).toBeTruthy();
    const ins =
      "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload) values ($1, $2, 'inapp', 'bridge.connected', '{}'::jsonb)";
    expect(await asApp(a, ins, [T.tenantId, b.id])).toBe("denied");
    expect(await asApp(a, ins, [T.tenantId, a.id])).toBe(1);
  });

  it("K461-API-025 索引：未読だけの部分索引と、自分宛ての新しい順の索引がある", async () => {
    await ready();
    const idx = (
      await f.admin.query<{ indexname: string; indexdef: string }>(
        "select indexname, indexdef from pg_indexes where tablename = 'notifications' and indexname in ('notifications_inbox_unread_idx', 'notifications_inbox_idx')",
      )
    ).rows;
    const by = Object.fromEntries(idx.map((r) => [r.indexname, r.indexdef]));
    expect(Object.keys(by).sort()).toEqual(["notifications_inbox_idx", "notifications_inbox_unread_idx"]);
    expect(by["notifications_inbox_unread_idx"]).toMatch(/member_id/);
    expect(by["notifications_inbox_unread_idx"]).toMatch(/read_at IS NULL/);
    expect(by["notifications_inbox_idx"]).toMatch(/member_id/);
    expect(by["notifications_inbox_idx"]).toMatch(/created_at DESC/);
  });

  it("K461-API-026 メールの印と別：sent_at・failed_at が入っていても read_at が空なら未読。一覧は sent_at・failed_at を変えず、読んだことにもしない", async () => {
    await ready();
    const p = await member("読む人");
    const sent = await notice(p, {
      kind: "bridge.connected",
      payload: bridge("送った印あり"),
      sentAt: new Date(),
      ageMin: 2,
    });
    const failed = await notice(p, {
      kind: "bridge.connected",
      payload: bridge("失敗の印あり"),
      failedAt: new Date(),
      ageMin: 1,
    });
    const page = await pageOf(p, "unread=true");
    expect(page.data.map((x) => x.id)).toEqual([failed, sent]);
    expect(page.data.every((x) => x.read === false && x.read_at === null)).toBe(true);
    expect((await rowOf(sent))!["sent_at"]).not.toBeNull();
    expect((await rowOf(sent))!["read_at"]).toBeNull();
    expect((await rowOf(failed))!["failed_at"]).not.toBeNull();
  });

  it("K461-API-027 起こした人：起こした人がいない行は actor null。別の会社の人が起こしたことになっていても名前を出さない", async () => {
    await ready();
    const p = await member("読む人");
    const a = await notice(p, { kind: "bridge.connected", payload: bridge("起こした人なし"), ageMin: 2 });
    const b = await notice(p, {
      kind: "bridge.connected",
      payload: bridge("他社の人が起こした設定"),
      actor: outsider.id,
      ageMin: 1,
    });
    const page = await pageOf(p);
    expect(page.data.find((x) => x.id === a)!.actor).toBeNull();
    expect(page.data.find((x) => x.id === b)!.actor).toBeNull();
    expect(page.meta.actors).toEqual([]);
    expect(JSON.stringify(page)).not.toContain("別の会社の人");
  });

  it("K461-API-028 チケットの種類で ticket_id が無い・uuid でない行は出ない（500 にしない）。あとの行は出る", async () => {
    await ready();
    const p = await member("読む人");
    await notice(p, { kind: "approval.requested", payload: { number: "EG-1", title: "id なし" }, ageMin: 3 });
    await notice(p, {
      kind: "approval.requested",
      payload: { ticket_id: "uuid ではない", number: "EG-2", title: "壊れた id" },
      ageMin: 2,
    });
    const ok = await notice(p, { kind: "bridge.connected", payload: bridge(), ageMin: 1 });
    const r = await listNotices(p);
    expect(r.status).toBe(200);
    expect(((await json(r)) as unknown as { data: { id: string }[] }).data.map((x) => x.id)).toEqual([ok]);
  });
  it("K461-API-029 取引先の人・運営の人は 403（社内の外枠の鈴だけ・P11）：会社の人でない役では読めず、行を返さない", async () => {
    await ready();
    const p = await member("読む人");
    await notice(p, { kind: "bridge.connected", payload: bridge() });
    for (const role of ["client", "ops"]) {
      const r = await req("GET", "/notifications", { headers: auth(p, { role }) });
      expect(r.status, role).toBe(403);
      expect((await json(r))["data"]).toBeUndefined();
    }
  });

  it("K461-API-030 取り消し系（handover.withdrawn）はチケットを消した後・見えないグループでも出る。番号だけで、題名とチケットの id と行き先は無い", async () => {
    await ready();
    const p = await member("読む人");
    const other = await member("担当の人");
    const gone = await ticket({ assignee: other, title: "消したチケット" });
    const sc = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '見えないグループ 30', 'ZY') returning id",
      [T.tenantId],
    );
    const hidden = await ticket({ assignee: other, scope: sc.id, title: "見えないグループのチケット" });
    const body = (t: { id: string; number: string }, title: string) =>
      ticketPayload(t, title, { handover_id: "h-1", from_name: "渡した人", cause: "deleted" });
    const w1 = await notice(p, { kind: "handover.withdrawn", payload: body(gone, "消したチケット"), ageMin: 4 });
    const w2 = await notice(p, {
      kind: "handover.withdrawn",
      payload: body(hidden, "見えないグループのチケット"),
      ageMin: 3,
    });
    const w3 = await notice(p, {
      kind: "handover.withdrawn",
      payload: { number: "EG-9", handover_id: "h-3", from_name: "渡した人" },
      ageMin: 2,
    });
    const a1 = await notice(p, { kind: "ticket.assigned", payload: ticketPayload(gone, "消したチケット"), ageMin: 1 });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const page = await pageOf(p);
    expect(page.data.map((x) => x.id)).toEqual([w3, w2, w1]);
    for (const x of page.data) {
      expect(x).toMatchObject({ kind: "handover.withdrawn", tag: "write", href: null, ticket_id: null, title: null });
    }
    expect(page.data.map((x) => x.number)).toEqual(["EG-9", hidden.number, gone.number]);
    expect(page.data.find((x) => x.id === w1)!.params).toEqual({ handover_id: "h-1", from_name: "渡した人" });
    expect(page.data.map((x) => x.id)).not.toContain(a1);
    const text = JSON.stringify(page);
    for (const leak of ["消したチケット", "見えないグループのチケット", gone.id, hidden.id])
      expect(text).not.toContain(leak);
  });
});
