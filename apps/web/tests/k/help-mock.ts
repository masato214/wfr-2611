// 困ったとき・お知らせ・問い合わせ・帯（段 13・領域 user：K-956・K-953・K-1007・K-957・K-1008）の画面の試験の道具（K-956 が持ち込む）：
//   利用者の口を網の手前で差し替える。答えの形は 11_tickets/K-948.md・K-1004.md の「画面が使う答えの形」（違えばこの 1 枚だけを合わせる）。
//   名前・字・数は下絵（app/(dev)/dev/mock/f12-user/render.tsx の見本）と同じにする（モックとの突き合わせのため）。
//   上げる先（uploadInquiryAttachment の upload_url＝本番は置き場の署名つき URL）への PUT と、上げ終わり（done_url）への POST も受ける。本人の Bridge（127.0.0.1:38617）は届かせない（網の手前で 404）。
//   固定の待ちは使わない（答えは hold() で止め、返した関数を呼ぶと答える）。テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";

export const uid = (n: number): string => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const N_INCIDENT = uid(0x5001);
export const N_MAINT = uid(0x5002);
export const N_THREAD = uid(0x5003);
export const N_GUEST = uid(0x5004);
export const Q_STUCK = uid(0x6001);
export const Q_KNOW = uid(0x6002);
export const Q_NEW = uid(0x6003);
export const GONE = uid(0xffff);
/** 上げる先（偽の置き場・本番は K-950 の口が返す置き場の署名つき URL） */
export const UPLOAD = (n: number): string => `http://127.0.0.1:3011/__k956_upload/${n}`;
/** 上げ終わり（偽・本番は K-950 の口の外の受け口 /api/uploads/inquiry/<印>/done） */
export const DONE = (n: number): string => `http://127.0.0.1:3011/__k956_done/${n}`;

// ---------------------------------------------------------------- 口の答えの形（K-1004）
export interface NoticeA {
  id: string;
  kind: "incident" | "maintenance" | "release";
  title: string;
  body: string;
  state: "investigating" | "identified" | "monitoring" | "resolved" | null;
  published_at: string;
  unread: boolean;
  maintenance: { from: string; to: string; impact: string | null } | null;
  updates: { state: string; body: string; at: string }[];
}
export interface BandA {
  kind: "incident" | "maintenance" | "stop" | "peek";
  notice_id?: string;
  title: string;
  state?: string;
  from?: string;
  to?: string;
  closable: boolean;
  more: number;
}
export interface StatusA {
  components: { key: string; label: string; state: "normal" | "degraded" | "down" }[];
  bands: BandA[];
  maintenance_now: { from: string; to: string } | null;
}
// ---------------------------------------------------------------- 口の答えの形（K-948）
export interface InquiryA {
  id: string;
  title: string;
  topic: "usage" | "trouble" | "billing" | "other";
  state: "waiting" | "replied" | "done";
  created_at: string;
  last_reply_at: string | null;
  has_unread_reply: boolean;
}
export interface MessageA {
  id: string;
  from: "me" | "ops";
  author_name: string;
  body: string;
  attachments: { id: string; name: string; size: number }[];
  created_at: string;
}
export interface InquiryDetailA extends InquiryA {
  messages: MessageA[];
  /** いま見ている画面の情報（K-948 の getMyInquiry に足す欄・まとめ役に頼んだ・K-1007） */
  context: { screen?: string; browser?: string; pc?: boolean; at?: string } | null;
}

// 時刻は日本時間で下絵の字になる値（UTC で書く。2025-11-10 は月曜）
export const noticesTaka = (): NoticeA[] => [
  {
    id: N_INCIDENT,
    kind: "incident",
    title: "分身の実行が遅れています",
    body: "送る順番の仕組みを入れ替えています。データは消えていません",
    state: "identified",
    published_at: "2025-11-02T01:20:00Z",
    unread: true,
    maintenance: null,
    updates: [],
  },
  {
    id: N_MAINT,
    kind: "maintenance",
    title: "11/10（月）2:00〜3:00 メンテナンス",
    body: "この間は使えません。承認したものは終わってから動きます\nデータベースの入れ替えのため、予定の間はメンテナンスにします。終わると自動で画面が切り替わります。",
    state: null,
    published_at: "2025-11-03T00:00:00Z",
    unread: true,
    maintenance: {
      from: "2025-11-09T17:00:00Z",
      to: "2025-11-09T18:00:00Z",
      impact:
        "この間は使えません。実行中のものは区切りまで進めて止め、承認したものは終わってから動きます。書きかけはこの PC に残ります",
    },
    updates: [],
  },
  {
    id: N_THREAD,
    kind: "release",
    title: "チケットにスレッドができました",
    body: "チケットごとに人と話して調整できます",
    state: null,
    published_at: "2025-10-28T00:00:00Z",
    unread: false,
    maintenance: null,
    updates: [],
  },
  {
    id: N_GUEST,
    kind: "release",
    title: "先方の人を招けるようにしました",
    body: "先方の人を招いて、依頼と検収をやり取りできます",
    state: null,
    published_at: "2025-10-14T00:00:00Z",
    unread: false,
    maintenance: null,
    updates: [],
  },
];
export const statusTaka = (): StatusA => ({
  components: [
    { key: "web", label: "画面", state: "normal" },
    { key: "runs", label: "分身の実行", state: "degraded" },
    { key: "pc", label: "PC とのつながり", state: "normal" },
  ],
  bands: [],
  maintenance_now: null,
});
export const incidentBand = (over: Partial<BandA> = {}): BandA => ({
  kind: "incident",
  notice_id: N_INCIDENT,
  title: "分身の実行が遅れています",
  state: "identified",
  from: "2025-11-02T00:40:00Z",
  closable: true,
  more: 0,
  ...over,
});
export const maintBand = (over: Partial<BandA> = {}): BandA => ({
  kind: "maintenance",
  notice_id: N_MAINT,
  title: "11/10（月）2:00〜3:00 メンテナンス",
  from: "2025-11-09T17:00:00Z",
  to: "2025-11-09T18:00:00Z",
  closable: true,
  more: 0,
  ...over,
});
export const inquiriesTaka = (): InquiryA[] => [
  {
    id: Q_STUCK,
    title: "PC をつけているのに実行待ちのまま",
    topic: "trouble",
    state: "replied",
    created_at: "2025-11-02T00:40:00Z",
    last_reply_at: "2025-11-02T01:15:00Z",
    has_unread_reply: true,
  },
  {
    id: Q_KNOW,
    title: "ナレッジの取り込みの形式",
    topic: "usage",
    state: "done",
    created_at: "2025-10-20T01:00:00Z",
    last_reply_at: "2025-10-20T03:00:00Z",
    has_unread_reply: false,
  },
];
export const ME = "高本 聖斗";
export const OPS = "Kaname 運営（佐野）";
export const threadTaka = (): InquiryDetailA => ({
  ...inquiriesTaka()[0]!,
  context: { screen: "チケット EG-128", browser: "Chrome 130", pc: true, at: "2025-11-02T00:38:00Z" },
  messages: [
    {
      id: uid(0x7001),
      from: "me",
      author_name: ME,
      body: "請求書を送るチケット（EG-128）を承認したのですが、30 分たっても「実行待ち」のままです。PC はつけています。",
      attachments: [],
      created_at: "2025-11-02T00:40:00Z",
    },
    {
      id: uid(0x7002),
      from: "ops",
      author_name: OPS,
      body: "お問い合わせありがとうございます。実行の記録を確かめたところ、預けている Gmail のログイン情報（GMAIL_WORK）の期限が切れて止まっていました。右上の顔 › 自分の設定 › 預けたログイン情報 から「預け直す」をお願いします。預け直すと、実行待ちのものがすぐ動きます。",
      attachments: [],
      created_at: "2025-11-02T01:15:00Z",
    },
  ],
});

// ---------------------------------------------------------------- 差し替え
export type HOp =
  "notices" | "read" | "status" | "inquiries" | "inquiry" | "create" | "upload" | "put" | "done" | "post" | "resolve";
export interface Reply {
  status: number;
  body: unknown;
}
export interface Call {
  op: HOp;
  id: string | undefined;
  url: string;
  body: Record<string, unknown>;
  size: number;
  contentType: string | undefined;
}
export interface HMock {
  notices: NoticeA[];
  status: StatusA;
  inquiries: InquiryA[];
  thread: InquiryDetailA;
  calls: Call[];
  count: (op: HOp) => number;
  last: (op: HOp) => Call | undefined;
  /** 次の回だけ、この答え（"network" は網が切れる）で答える */
  script: (op: HOp, ...replies: (Reply | "network")[]) => void;
  /** この口の答えを止める（返した関数を呼ぶと答える） */
  hold: (op: HOp) => () => void;
}
/** 口が断る答え。404・409 は欄・details を付けない（控え帳） */
export const err = (status: number, code: string): Reply => ({ status, body: { error: code.toLowerCase(), code } });

const API = /\/api\/v1\/(notices|service-status|inquiries)(\/|\?|$)/;

export async function mockHelp(
  page: Page,
  init: { notices?: NoticeA[]; status?: StatusA; inquiries?: InquiryA[]; thread?: InquiryDetailA } = {},
): Promise<HMock> {
  const scripted = new Map<HOp, (Reply | "network")[]>();
  const gates = new Map<HOp, Promise<void>>();
  let uploads = 0;
  const mk: HMock = {
    notices: init.notices ?? noticesTaka(),
    status: init.status ?? statusTaka(),
    inquiries: init.inquiries ?? inquiriesTaka(),
    thread: init.thread ?? threadTaka(),
    calls: [],
    count: (op) => mk.calls.filter((c) => c.op === op).length,
    last: (op) => [...mk.calls].reverse().find((c) => c.op === op),
    script: (op, ...r) => scripted.set(op, [...(scripted.get(op) ?? []), ...r]),
    hold: (op) => {
      let open = (): void => undefined;
      gates.set(op, new Promise<void>((r) => (open = r)));
      return () => {
        open();
        gates.delete(op);
      };
    },
  };
  const answer = async (op: HOp, route: Route, req: Request, id: string | undefined, def: () => Reply) => {
    const buf = req.postDataBuffer();
    let body: Record<string, unknown> = {};
    if (op !== "put" && buf?.length) body = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
    mk.calls.push({ op, id, url: req.url(), body, size: buf?.length ?? 0, contentType: req.headers()["content-type"] });
    const gate = gates.get(op);
    if (gate) await gate;
    const next = scripted.get(op)?.shift();
    if (next === "network") return route.abort("failed");
    const r = next ?? def();
    return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  };
  const ok = (data: unknown, status = 200): Reply => ({ status, body: { data } });
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/__k956_upload\//, (route, req) => answer("put", route, req, undefined, () => ok({}, 200)));
  await page.route(/\/__k956_done\//, (route, req) =>
    answer("done", route, req, undefined, () => ok({ id: uid(0x8000 + Number(req.url().split("/").pop())), size: 0 })),
  );
  await page.route(API, async (route: Route, req: Request) => {
    const seg = new URL(req.url()).pathname.replace("/api/v1", "").split("/").filter(Boolean);
    const m = req.method();
    const head = seg[0]!;
    if (head === "service-status" && m === "GET") return answer("status", route, req, undefined, () => ok(mk.status));
    if (head === "notices") {
      if (m === "GET" && seg.length === 1) return answer("notices", route, req, undefined, () => ok(mk.notices));
      if (m === "POST" && seg[2] === "read")
        return answer("read", route, req, seg[1], () => {
          const n = mk.notices.find((x) => x.id === seg[1]);
          if (!n) return err(404, "NOT_FOUND");
          n.unread = false;
          return ok({ id: n.id, read_at: "2025-11-12T00:00:00Z" });
        });
    }
    if (head === "inquiries") {
      if (seg[1] === "attachments" && m === "POST")
        return answer("upload", route, req, undefined, () => {
          uploads += 1;
          return ok(
            {
              id: uid(0x8000 + uploads),
              upload_url: UPLOAD(uploads),
              done_url: DONE(uploads),
              expires_at: "2025-11-12T00:10:00Z",
            },
            201,
          );
        });
      if (seg.length === 1 && m === "GET") return answer("inquiries", route, req, undefined, () => ok(mk.inquiries));
      if (seg.length === 1 && m === "POST")
        return answer("create", route, req, undefined, () => {
          const b = mk.calls.at(-1)!.body;
          const row: InquiryA = {
            id: Q_NEW,
            title: String(b["title"]),
            topic: b["topic"] as InquiryA["topic"],
            state: "waiting",
            created_at: new Date().toISOString(),
            last_reply_at: null,
            has_unread_reply: false,
          };
          mk.inquiries = [row, ...mk.inquiries];
          return ok(row, 201);
        });
      if (seg.length === 2 && m === "GET")
        return answer("inquiry", route, req, seg[1], () =>
          seg[1] === mk.thread.id ? ok(mk.thread) : err(404, "NOT_FOUND"),
        );
      if (seg[2] === "messages" && m === "POST")
        return answer("post", route, req, seg[1], () => {
          const msg: MessageA = {
            id: uid(0x7100 + mk.thread.messages.length),
            from: "me",
            author_name: ME,
            body: String(mk.calls.at(-1)!.body["body"]),
            attachments: [],
            created_at: new Date().toISOString(),
          };
          mk.thread = { ...mk.thread, state: "waiting", messages: [...mk.thread.messages, msg] };
          return ok(msg, 201);
        });
      if (seg[2] === "resolve" && m === "POST")
        return answer("resolve", route, req, seg[1], () => {
          mk.thread = { ...mk.thread, state: "done" };
          return ok({ ...mk.thread, messages: undefined });
        });
    }
    return route.fallback();
  });
  return mk;
}
