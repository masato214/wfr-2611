// 中間テストの準備の道具（口の道・K-64）：画面を通さずに、人のログインの印で契約の口を呼んで「PC をつなぐ」「チケットを 1 枚作る」
//   「同じ会社のもう 1 人」を用意する。人そのものは newcomer.ts（画面とメールを通す）、PC そのものは test-pc.ts（本物の Bridge の引き取り）。
//   画面でつなぐ道（K-58 の openConnect・connectByCode）と画面で作る道（K-58 の createTicket）はその試験の筋なので、ここには寄せない。
//   口は網の手前で差し替えない。中間テスト 3（K-64）が使う（統合テスト K-65 もここを使える）。
//   探したが無かった：目録（03_architecture/catalog.json）の共通の処理・apps/web/tests/_lib に、人の印で契約の口を呼んで PC とチケットを用意する道具は無い。
//   似たもの：api.ts の claimBridge（前の道すじの口を直に叩くだけで Bridge の名乗りを通らない）・viewerViaApi（招待で入る人を作るが、役は viewer で会社も新しく作る）。
//   api.ts は画面の試験のほとんどが読むので、ここでは変えない（変えると、チケットの範囲の CI が読んでいる試験を全部流す）
import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { API, PW, addTestEntry, admin, api, sha256, testIp, uniqEmail } from "./api";
import type { Newcomer } from "./newcomer";
import { testPc, type TestPc } from "./test-pc";

type Body = Record<string, unknown>;

/** 人のログインの印で契約の口を呼ぶ（準備と、画面の外から口を叩く所だけ）。その人の画面と同じブラウザから呼ぶ
 *  （試験の側から直に呼ぶと端末の印が変わり、ログインの印が通らない・D-128.120。K-58 の devicesFor と同じ呼び方）。
 *  POST には冪等キーを付ける（契約の入口が求める）。page はその人がログインしている画面（どのページを開いていてもよい） */
export async function asPerson(page: Page, token: string, method: "GET" | "POST", path: string, body?: Body) {
  const key = method === "POST" ? `prep-${randomBytes(8).toString("hex")}` : null;
  const r = await page.evaluate(
    async ([url, m, tok, k, b]) => {
      const res = await fetch(url, {
        method: m,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tok}`,
          ...(k ? { "idempotency-key": k } : {}),
        },
        ...(b ? { body: b } : {}),
      });
      return { status: res.status, json: (await res.json().catch(() => ({}))) as { data?: unknown; code?: string } };
    },
    [`${API}/api/v1${path}`, method, token, key, body ? JSON.stringify(body) : null] as const,
  );
  return { status: r.status, data: (r.json.data ?? null) as Body | null, code: r.json.code ?? null };
}

/** PC をつなぐ（接続コードは口 createPairingCode で出し、引き取りは本物の Bridge の claimCode・最初の知らせ 1 回）。画面でつなぐ道は K-58 が持つ */
export async function pairedPc(page: Page, token: string, label: string): Promise<TestPc> {
  const c = await asPerson(page, token, "POST", "/bridge/pairing-codes", {});
  if (c.status !== 201) throw new Error(`接続コードの口が ${c.status}`);
  const pc = testPc(label);
  const got = await pc.enterCode(String(c.data?.["code"]));
  if (!got.ok) throw new Error(`引き取れない：${got.message}`);
  const b = await pc.beat();
  if (b >= 300) throw new Error(`最初の知らせが ${b}`);
  return pc;
}

/** チケットの区画（K-60 の createTicket の sections：区画の鍵 → 本文） */
export interface TicketSections {
  purpose: string;
  done: string;
  /** 実施事項（`- ` の行が項目。完了の小窓のチェックになる・K-63） */
  todo: string;
}

/** チケットを口で 1 枚作る（種類「タスク」・担当は本人・期限は 3 日後）。作る画面は K-60・K-58 が持つ */
export async function ticketOf(page: Page, me: Newcomer, title: string, sections: TicketSections): Promise<string> {
  const scope = await admin<{ s: string }>("select scope_id as s from members where id = $1", [me.memberId]);
  const kinds = await asPerson(page, me.token, "GET", "/ticket_kinds");
  const list = (kinds.data as unknown as { id: string; name: string }[] | null) ?? [];
  const kind = list.find((k) => k.name === "タスク");
  if (!kind) throw new Error(`チケットの種類「タスク」が無い（口は ${kinds.status}）`);
  const due = new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
  const r = await asPerson(page, me.token, "POST", "/tickets", {
    scope_id: scope[0]!.s,
    kind_id: kind.id,
    title,
    assignee_member_id: me.memberId,
    due_on: due,
    sections,
  });
  if (r.status !== 201) throw new Error(`チケットを作る口が ${r.status}`);
  const id = (r.data?.["id"] ?? (r.data?.["ticket"] as Body | undefined)?.["id"]) as string | undefined;
  if (!id) throw new Error("作ったチケットの id が答えに無い");
  return id;
}

/** 同じ会社のもう 1 人（招待を受けた人・役は member）。画面は使わない（担当を替える先）。
 *  招待の行を置き、受ける口を通し、今の版の規約に同意させる（api.ts の viewerViaApi と同じ道。あちらは役 viewer で会社も新しく作るので使えない） */
export async function teammate(me: Newcomer, name = "同僚"): Promise<{ memberId: string; token: string }> {
  const tenant = await admin<{ t: string }>("select tenant_id as t from members where id = $1", [me.memberId]);
  const token = randomBytes(24).toString("base64url");
  const email = uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, 'member', $3, now() + interval '7 days', $4)",
    [tenant[0]!.t, email, sha256(token), me.memberId],
  );
  // 招待は契約の口で受ける（K-337 で前の道すじから移した・切る段で替えた）。受諾は今の版に同意したことにする（K-332）
  const r = await api<{ data: { token: string } }>(
    `/api/v1/auth/invitations/${token}/accept`,
    { name, password: PW },
    undefined,
    "POST",
    testIp(),
  );
  if (r.status !== 201) throw new Error(`招待を受ける口が ${r.status}`);
  const u = await admin<{ id: string; m: string }>(
    `select u.id, m.id as m from kaname_auth."user" u join members m on m.auth_user_id = u.id where u.email = $1`,
    [email],
  );
  await addTestEntry(u[0]!.id); // 入り方を 1 つ持つ人にする（付けるまで進めないの印を下ろす・K-337）
  return { memberId: u[0]!.m, token: r.json.data.token };
}
