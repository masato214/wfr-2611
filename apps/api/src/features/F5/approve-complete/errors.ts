// 承認して完了する（K-63 の孫 K-161〜K-166）の DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   ログに成果物の中身・差し戻しの理由・メールを出さない（ログは言葉と場所だけ）。
//   K-161 は読む口（not_found）。K-162 は承認（not_member・not_approver・not_writable → 403・decided → 409・guard_failed → 503）。
//   K-163 は差し戻し（reason_empty → 422）。K-165 は完了（done・stage → 409／not_confirmed・children_left → 422。K-566 で todo_changed・todo_left・todo_out_of_range は外した）。
//   K-166 は完了の not_doing → 409（作業中でない）・children_left の明細に子の id・見えない子は件数だけ・guard_failed と知らない言葉 → 503
import { isUuid } from "@kaname/contracts";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー（欄つき） */
export const fromCatalog = (code: string, status: number, o: { field?: string } = {}): HookReply => {
  const e = kanameError(code);
  return {
    status,
    body: {
      ...e.toJSON(),
      ...(o.field ? { field: o.field, details: [{ field: o.field, message: e.entry.message }] } : {}),
    },
  };
};
/** 明細の 1 件。id は終わっていない子のチケットの id（画面が /tickets/<id> のリンクを作る・K63-API-095）。見えない子の件には付けない */
export type Detail = { field: string; id?: string; message: string };
/** 正本のエラーに、項目ごとの明細（残っている実施事項・終わっていない子）を付ける。明細の文はチケットの中身（項目の文・番号と題名）で、ログには出さない */
export const withDetails = (code: string, status: number, details: Detail[]): HookReply => ({
  status,
  body: { ...kanameError(code).toJSON(), details },
});
/** 見つからない（他の会社の id・消されたチケット・成果物でない承認も同じ。中身を返さない・D-131.11） */
export const notFound = (): HookReply => fromCatalog("E-PAGE-001", 404);
/** 入力の形違い（422・欄つき）。入口（op.ts）と同じ形 */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[approve-complete] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return fromCatalog("E-PAGE-003", 503);
};

/** 終わっていない子の明細。DB の関数（app.ticket_complete）は見える子を {id, label} で、見えない子を数（children_hidden）で返す */
function childDetails(children: unknown, hidden: unknown): Detail[] {
  const seen = (Array.isArray(children) ? children : []).map((c): Detail => {
    const { id, label } = (c ?? {}) as { id?: unknown; label?: unknown };
    return { field: "children", ...(typeof id === "string" && isUuid(id) ? { id } : {}), message: String(label ?? "") };
  });
  const n = Number.isInteger(hidden) ? (hidden as number) : 0;
  return n > 0 ? [...seen, { field: "children", message: `ほかに、あなたに見えない子が ${n} 件あります` }] : seen;
}

/** DB の関数の答え { error: <言葉> } → 答え。知らない言葉は止める側（503・言葉は記録にだけ残し、答えに出さない） */
export function replyOf(
  r: {
    error?: unknown;
    children?: unknown;
    children_hidden?: unknown;
  },
  where: string,
): HookReply {
  const word = String(r.error);
  if (word === "not_found") return notFound();
  // 承認する人でない・今のメンバーでない・書けない（副作用なし。担当者がいない承認も not_approver）
  if (word === "not_member" || word === "not_approver" || word === "not_writable")
    return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  // 決まった・取り下げた承認（E-CONF-003「この承認はもう処理されています」）
  if (word === "decided") return fromCatalog("E-CONF-003", 409);
  // 差し戻す理由が空・空白だけ・制御文字だけ（E-VAL-020・欄 note・何も書かない・K-163）
  if (word === "reason_empty") return fromCatalog("E-VAL-020", 422, { field: "note" });
  // 完了（K-165）：もう完了している・承認待ち／実行中／確認中か走っている実行がある（未チェックは止めない・K-566）
  if (word === "done") return fromCatalog("E-CONF-018", 409);
  if (word === "stage") return fromCatalog("E-CONF-016", 409);
  // 完了にできるのは作業中だけ（未着手・保留・決める人の答え db67f3cde899 ②・83361b2157fd・K63-API-098）
  if (word === "not_doing") return fromCatalog("E-CONF-019", 409);
  if (word === "not_confirmed") return fromCatalog("E-VAL-023", 422, { field: "conditions_confirmed" });
  // 終わっていない子（D-128.138）：押した人に見える子は id と「番号 題名」（K63-API-095）。
  //   見えない子は id・番号・題名を出さず、件数だけを 1 件で足す（決める人の答え db67f3cde899 ①・K63-API-096・097）
  if (word === "children_left") return withDetails("E-VAL-024", 422, childDetails(r.children, r.children_hidden));
  // 守りの判定で例外（guard_failed・fail-closed・K63-API-059・063）。知らない言葉（bad_decision を含む）も止める側
  return down(where, word);
}
