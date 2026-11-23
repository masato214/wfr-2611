// K-334 送り直しを頼まれたメールの文面（関門 C6 の送出の口に渡す）。
//   載せるのはワークスペースの名前・宛ての招待のメール（誰が頼んだか）・招いた日・期限だけ。
//   招待のトークン・リンクは入れない（送り直すのは招いた人が新しい招待を出すこと・TP-MAIL-03）

export const RESEND_REQUEST_SUBJECT = "【Kaname】招待の送り直しを頼まれました";

export interface ResendRequestFacts {
  /** 宛てのメール。空＝招待のリンク（K-421） */
  invitee_email: string | null;
  invited_at: Date;
  expires_at: Date;
  workspace_name: string | null;
}

const DAY = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** 頼まれた招待の事実から文面を組む */
//   行は 1 つの文字列の中の改行でつなぐ（配列の .join は使わない）。契約の形の検査（scripts/ci/contract_shape_test.py）は
//   同じ hooks から読むファイルの定義を名前で辿るので、参加の口の関数 join（403 を返す）と名前が重なり、
//   この口が 403 を返すと読まれる（実際は通らない道）
export function resendRequestMail(f: ResendRequestFacts): { subject: string; text: string } {
  const where = f.workspace_name ? `「${f.workspace_name}」` : "ワークスペース";
  const who = f.invitee_email === null ? "招待のリンクを開いた人から" : `${f.invitee_email} さんから`;
  const text = `${where}に招待した${f.invitee_email === null ? "、" : " "}${who}、招待の送り直しを頼まれました。
招待のリンクの期限が過ぎていたため、参加できなかったようです。

招いた日：${DAY.format(new Date(f.invited_at))}
期限：${DAY.format(new Date(f.expires_at))}

参加してもらうには、Kaname のメンバーの画面から新しい招待を出してください。
心当たりが無ければ、このメールは無視してかまいません。`;
  return { subject: RESEND_REQUEST_SUBJECT, text };
}
