// チケットを直す口の欄の組が共通で使う字の整え（K-387・K-440）。
//   jsonb に入らない対にならないサロゲートを U+FFFD に置き換えて書く（口によって答えを変えない・PM の決め 2026-11-23 04:55）。
//   NUL は前処理が 422 にするので、ここへは来ない
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** 文字なら対にならないサロゲートを U+FFFD にして返す。文字でなければそのまま */
export const replaceLoneSurrogates = (v: unknown): unknown =>
  typeof v === "string" ? v.replace(LONE_SURROGATE, "�") : v;
