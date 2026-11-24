// K-956「困ったとき・お知らせのホームとお知らせ 1 件」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（listNotices・getServiceStatusForMember・listMyInquiries）→ 部品の値（features/F12/help/help-shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-956.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { inquiryView, noticeDetailView, noticeView, statusView, windowOf } from "../features/F12/help/help-shape";

type NoticeIn = Parameters<typeof noticeView>[0];
type InquiryIn = Parameters<typeof inquiryView>[0];
const notice = (over: Partial<NoticeIn> = {}): NoticeIn =>
  ({
    id: "n1",
    kind: "incident",
    title: "分身の実行が遅れています",
    body: "送る順番の仕組みを入れ替えています。データは消えていません",
    state: "identified",
    published_at: "2025-11-02T01:20:00Z",
    unread: true,
    maintenance: null,
    updates: [],
    ...over,
  }) as NoticeIn;
const inquiry = (over: Partial<InquiryIn> = {}): InquiryIn =>
  ({
    id: "q1",
    title: "PC をつけているのに実行待ちのまま",
    topic: "trouble",
    state: "replied",
    created_at: "2025-11-02T00:40:00Z",
    last_reply_at: "2025-11-02T01:15:00Z",
    has_unread_reply: true,
    ...over,
  }) as InquiryIn;
const NOW = Date.parse("2025-11-12T03:00:00Z");

describe("K-956 答え → 部品の値", () => {
  it("K956-UN-001 お知らせの 1 行：種類 3 つの字・障害は日時（日本時間）でほかは日付だけ・障害の状態 4 つの字・要約は本文の 1 行目・未読の印", () => {
    expect(noticeView(notice())).toEqual({
      id: "n1",
      kind: "障害",
      title: "分身の実行が遅れています",
      body: "送る順番の仕組みを入れ替えています。データは消えていません",
      when: "11/02 10:20",
      unread: true,
      state: "原因が分かった",
    });
    const words = ["investigating", "identified", "monitoring", "resolved"].map(
      (s) => noticeView(notice({ state: s as NoticeIn["state"] })).state,
    );
    expect(words).toEqual(["調べている", "原因が分かった", "様子を見ている", "直った"]);
    const m = noticeView(
      notice({
        kind: "maintenance",
        state: null,
        unread: false,
        body: "1 行目\n2 行目",
        published_at: "2025-11-03T00:00:00Z",
      }),
    );
    expect(m).toEqual({ id: "n1", kind: "メンテ", title: "分身の実行が遅れています", body: "1 行目", when: "11/03" });
    expect(noticeView(notice({ kind: "release", state: null })).kind).toBe("リリース");
  });

  it("K956-UN-002 お知らせ 1 件：メンテの時間は「11/10（月）2:00〜3:00」・影響・内容は本文の 2 行目から（1 行だけなら 1 行目）", () => {
    expect(windowOf("2025-11-09T17:00:00Z", "2025-11-09T18:00:00Z")).toBe("11/10（月）2:00〜3:00");
    const d = noticeDetailView(
      notice({
        kind: "maintenance",
        state: null,
        body: "要約\n中身の 1\n中身の 2",
        maintenance: { from: "2025-11-09T17:00:00Z", to: "2025-11-09T18:00:00Z", impact: "この間は使えません" },
      }),
    );
    expect(d.window).toBe("11/10（月）2:00〜3:00");
    expect(d.impact).toBe("この間は使えません");
    expect(d.full).toBe("中身の 1\n中身の 2");
    const one = noticeDetailView(notice({ body: "これだけ" }));
    expect(one.full).toBe("これだけ");
    expect(one.window).toBeUndefined();
    expect(one.impact).toBeUndefined();
  });

  it("K956-UN-003 稼働状況：normal・degraded・down は「ふつう」「遅れている」「止まっている」・知らない値は「遅れている」（ふつうに見せない・G-15）", () => {
    expect(statusView({ key: "web", label: "画面", state: "normal" })).toEqual({ label: "画面", state: "ふつう" });
    expect(statusView({ key: "runs", label: "分身の実行", state: "degraded" }).state).toBe("遅れている");
    expect(statusView({ key: "pc", label: "PC とのつながり", state: "down" }).state).toBe("止まっている");
    expect(statusView({ key: "x", label: "x", state: "???" as "normal" }).state).toBe("遅れている");
  });

  it("K956-UN-004 自分の問い合わせ：何について 4 つの字・状態 3 つ（返事を待っている・返事あり・済み）・1 分以内は「いま」・ほかは日付", () => {
    expect(inquiryView(inquiry(), NOW)).toEqual({
      id: "q1",
      title: "PC をつけているのに実行待ちのまま",
      kind: "うまく動かない",
      when: "11/02",
      replied: true,
    });
    expect(inquiryView(inquiry({ state: "done", topic: "usage" }), NOW)).toMatchObject({
      kind: "使い方",
      replied: true,
      done: true,
    });
    expect(inquiryView(inquiry({ state: "waiting", topic: "billing" }), NOW)).toMatchObject({
      kind: "お金・プラン",
      waiting: true,
    });
    const fresh = inquiryView(
      inquiry({ state: "waiting", topic: "other", created_at: new Date(NOW - 30_000).toISOString() }),
      NOW,
    );
    expect(fresh).toMatchObject({ kind: "ほか", when: "いま", waiting: true });
  });
});
