// 期限の小窓の日付の計算（K-444・段 5 の下絵）。日付は YYYY-MM-DD の文字、月は YYYY-MM の文字。口にも時計にも触らない（今日は引数で受ける）
const DAY_MS = 86_400_000;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;
const FRIDAY = 5;
const MONDAY = 1;
const DAYS_IN_WEEK = 7;

export const WEEKDAYS: readonly string[] = WEEK;

const utc = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`);
export const addDays = (ymd: string, n: number): string => new Date(utc(ymd) + n * DAY_MS).toISOString().slice(0, 10);
export const weekdayOf = (ymd: string): number => new Date(utc(ymd)).getUTCDay();

/** YYYY-MM-DD → 「MM/DD」 */
export const mmdd = (ymd: string): string => `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}`;
/** YYYY-MM-DD → 「MM/DD（曜）」 */
export const mmddWeek = (ymd: string): string => `${mmdd(ymd)}（${WEEK[weekdayOf(ymd)] ?? ""}）`;
/** YYYY-MM-DD → 読み上げの名前「11月27日（金）」 */
export const spoken = (ymd: string): string =>
  `${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日（${WEEK[weekdayOf(ymd)] ?? ""}）`;

export interface QuickDate {
  label: string;
  ymd: string;
}

/** 「今日・明日・今週の金曜・来週の月曜」。今週の金曜は、今日が金曜なら今日 */
export function quickDates(today: string): QuickDate[] {
  const dow = weekdayOf(today);
  const toFriday = (FRIDAY - dow + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const toMonday = (MONDAY - dow + DAYS_IN_WEEK) % DAYS_IN_WEEK || DAYS_IN_WEEK;
  return [
    { label: "今日", ymd: today },
    { label: "明日", ymd: addDays(today, 1) },
    { label: "今週の金曜", ymd: addDays(today, toFriday) },
    { label: "来週の月曜", ymd: addDays(today, toMonday) },
  ];
}

export interface CalCell {
  ymd: string;
  day: number;
}

/** 月の格子（日曜はじまり・月の外は null）。1 行 7 マス */
export function monthWeeks(month: string): (CalCell | null)[][] {
  const lead = weekdayOf(`${month}-01`);
  const total = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells: (CalCell | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => ({ ymd: `${month}-${String(i + 1).padStart(2, "0")}`, day: i + 1 })),
  ];
  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null);
  return Array.from({ length: cells.length / DAYS_IN_WEEK }, (_, w) =>
    cells.slice(w * DAYS_IN_WEEK, (w + 1) * DAYS_IN_WEEK),
  );
}

export const monthLabel = (month: string): string => `${month.slice(0, 4)}年 ${Number(month.slice(5, 7))}月`;

/** 月を前後に動かす */
export function shiftMonth(month: string, delta: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
