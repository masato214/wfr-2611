// 運営の画面（段 13・/ops の下）の試験が使う口の答えの見本（K-965 が持ち込む・ブラウザの試験と画面の外の試験の両方が読む）。
//   形は 11_tickets/K-1006.md の「画面が使う答えの形」。字・数は下絵（features/F12/ops/ops-sample.ts・views-list.tsx）と同じになる値。
//   Playwright を読まない（vitest の画面の外の試験からも読むため）。テストはチケットを作る人が書き、実装する人は変えない
export const uid = (n: number): string => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;

// ---------------------------------------------------------------- 口の答えの形（K-1006）
export interface Attention {
  /** 気にかけるの種類は 3 つ（上限に近い会社は出さない＝D-156.72） */
  kind: "overdue" | "stuck" | "pc";
  label_value: number;
}
export interface WsRowA {
  id: string;
  name: string;
  admin_name: string;
  plan_name: string | null;
  members: { count: number; limit: number | null };
  pc: { connected: number; total: number } | null;
  runs_month: number | null;
  attention: Attention[];
  billing_state: "unpaid" | "paid" | "overdue" | null;
  state: "active" | "stopped" | "closing";
  state_since: string;
}
export interface ShellA {
  operator: { member_id: string; caps: string[] };
  inbox: { unassigned: number; mine: number; waiting: number; later: number };
  invoices: { overdue_count: number; overdue_amount: number } | null;
  workspaces: {
    total: number;
    active: number;
    stopped: number;
    closing: number;
    attention: number;
    by_plan: { free: number; team: number; business: number };
  };
  runs_month: { count: number; prev_ratio: number | null };
  pwned: { unchecked: number };
}

/** 下絵 op-list の上の数と同じ外枠の答え */
export const shellOf = (o: Partial<ShellA> = {}): ShellA => ({
  operator: { member_id: uid(0x9a1), caps: ["inquiry", "money"] },
  inbox: { unassigned: 3, mine: 1, waiting: 2, later: 0 },
  invoices: { overdue_count: 2, overdue_amount: 49500 },
  workspaces: {
    total: 48,
    active: 46,
    stopped: 1,
    closing: 1,
    attention: 3,
    by_plan: { free: 21, team: 19, business: 8 },
  },
  runs_month: { count: 48210, prev_ratio: 1.12 },
  pwned: { unchecked: 0 },
  ...o,
});

const row = (n: number, o: Partial<WsRowA> & Pick<WsRowA, "name" | "admin_name">): WsRowA => ({
  id: uid(0x7000 + n),
  plan_name: "チーム",
  members: { count: 4, limit: 10 },
  pc: { connected: 4, total: 4 },
  runs_month: 0,
  attention: [],
  billing_state: "paid",
  state: "active",
  state_since: "2026-04-01T00:00:00Z",
  ...o,
});

/** 下絵 op-list の 8 行（ops-sample.ts の WS_ROWS と同じ字になる答え・並びも同じ） */
export const WS_A: WsRowA[] = [
  row(1, {
    name: "合同会社ミナト企画",
    admin_name: "湊 さくら",
    members: { count: 8, limit: 10 },
    pc: { connected: 6, total: 8 },
    runs_month: 1284,
    attention: [{ kind: "stuck", label_value: 3 }],
  }),
  row(2, {
    name: "北村デザイン事務所",
    admin_name: "北村 透",
    members: { count: 4, limit: 10 },
    pc: { connected: 4, total: 4 },
    runs_month: 512,
    attention: [{ kind: "overdue", label_value: 9 }],
    billing_state: "overdue",
  }),
  row(3, {
    name: "株式会社オオタ物流",
    admin_name: "太田 誠",
    plan_name: "ビジネス",
    members: { count: 27, limit: 30 },
    pc: { connected: 19, total: 27 },
    runs_month: 6930,
    attention: [],
  }),
  row(4, {
    name: "山田工務店",
    admin_name: "山田 健二",
    plan_name: "無料",
    members: { count: 2, limit: 3 },
    pc: { connected: 0, total: 2 },
    runs_month: 0,
    attention: [{ kind: "pc", label_value: 14 }],
    billing_state: null,
  }),
  row(5, {
    name: "株式会社サクラ会計",
    admin_name: "桜井 恵子",
    plan_name: "ビジネス",
    members: { count: 22, limit: 30 },
    pc: { connected: 20, total: 22 },
    runs_month: 8115,
  }),
  row(6, {
    name: "株式会社ENGINE BASE",
    admin_name: "高本 聖斗",
    members: { count: 5, limit: 10 },
    pc: { connected: 5, total: 5 },
    runs_month: 2040,
  }),
  row(7, {
    name: "株式会社ハル製作所",
    admin_name: "春日 亮",
    members: { count: 6, limit: 10 },
    pc: { connected: 0, total: 6 },
    runs_month: 0,
    attention: [{ kind: "overdue", label_value: 61 }],
    billing_state: "overdue",
    state: "stopped",
    state_since: "2026-10-19T15:00:00Z", // 日本時間 10/20
  }),
  row(8, {
    name: "佐々木 恵",
    admin_name: "佐々木 恵",
    plan_name: "無料",
    members: { count: 1, limit: 3 },
    pc: { connected: 1, total: 1 },
    runs_month: 86,
    billing_state: null,
    state: "closing",
    state_since: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 申し込んで 2 日（あと 12 日）
  }),
];
