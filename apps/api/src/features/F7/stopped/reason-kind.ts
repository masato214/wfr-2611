// 止まった理由の種類（K-485・D-151.17・PM の決め P7）。止める所（約 10 の DB の関数）は直さず、読むとき止まった理由の文と E 番号から決める。
//   判定の表はこのファイルの 1 か所だけ。DB を読まない純関数（画面の文は正本 errors.json から REASON_KIND_ERROR の番号で引く）。
//   どれにも当たらなければ unknown（当て推量しない。文はそのまま返る）。Bridge の文が変わったときも、黙って別の種類にはならず unknown に落ちる

export const REASON_KINDS = [
  "pc_closed",
  "approval_expired",
  "bridge_outdated",
  "claude_missing",
  "claude_login",
  "browser_unreachable",
  "unknown",
] as const;
export type ReasonKind = (typeof REASON_KINDS)[number];

/** 種類 → 正本（errors.json）の番号。画面の文と次の一手はここから引く */
export const REASON_KIND_ERROR: Readonly<Record<ReasonKind, string>> = {
  pc_closed: "E-CONN-002",
  approval_expired: "E-STP-010",
  bridge_outdated: "E-CONN-012",
  claude_missing: "E-CONN-011",
  claude_login: "E-CONN-010",
  browser_unreachable: "E-STP-011",
  unknown: "E-STP-012",
};

/** 文の中に E 番号があるときの種類（E 番号が文の言い回しより先に効く） */
const KIND_OF_CODE: Readonly<Record<string, ReasonKind>> = {
  "E-CONN-002": "pc_closed",
  "E-CONN-003": "pc_closed",
  "E-CONN-010": "claude_login",
  "E-CONN-011": "claude_missing",
  "E-CONN-012": "bridge_outdated",
  "E-STP-010": "approval_expired",
  "E-STP-011": "browser_unreachable",
  "E-STP-012": "unknown",
};

/** 文の決まった言い回し（正規化した文に当てる） */
const PHRASES: readonly (readonly [RegExp, ReasonKind])[] = [
  [/PC\s*の\s*Kaname\s*Bridge\s*が途中で止まった/i, "pc_closed"],
  [/PC\s*を外したので止まりました/i, "pc_closed"],
  [/にログインできていません/, "claude_login"],
  [/本体が落ちてきていない/, "claude_missing"],
  [/Claude\s*Code\s*が見つかりません/i, "claude_missing"],
  [/Bridge\s*が古い/i, "bridge_outdated"],
  [/承認から\s*24\s*時間を過ぎた/, "approval_expired"],
  [/Chrome\s*を使えませんでした/i, "browser_unreachable"],
];

const STOPPED_STATUSES: ReadonlySet<string> = new Set(["stopped", "cancelled"]);
const E_CODE = /E-[A-Z]+-\d{3}/g;
const SENTENCE_BREAK = /[。！？\n]/;

/** 全角・前後の空白をそろえる（NFKC は全角の英数字とハイフンを半角にする） */
const normalize = (s: string): string => s.normalize("NFKC").trim();

/** 「拡張機能」は、同じ文の中に「Chrome」があるときだけ当てる（AI の自由な文に混ざっただけでは当てない） */
const mentionsBrowserExtension = (text: string): boolean =>
  text.split(SENTENCE_BREAK).some((s) => /拡張機能/.test(s) && /Chrome/i.test(s));

/** 止まった実行（stopped・cancelled）の種類。止まっていない状態は null */
export function reasonKindOf(status: string, stoppedReason: string | null | undefined): ReasonKind | null {
  if (!STOPPED_STATUSES.has(status)) return null;
  if (stoppedReason == null) return "unknown";
  const text = normalize(stoppedReason);
  const codes = text.toUpperCase().match(E_CODE) ?? [];
  for (const code of codes) {
    const kind = KIND_OF_CODE[code];
    if (kind) return kind;
  }
  for (const [re, kind] of PHRASES) if (re.test(text)) return kind;
  return mentionsBrowserExtension(text) ? "browser_unreachable" : "unknown";
}

/** 実行の 1 件の答え（DB の関数 app.action_run_json）に reason_kind を足す。読む 2 つの口と自分で直す口が同じに使う */
export function withReasonKind<T extends { status: string; stopped_reason?: string | null }>(
  run: T,
): T & { reason_kind: ReasonKind | null } {
  return { ...run, reason_kind: reasonKindOf(run.status, run.stopped_reason) };
}
