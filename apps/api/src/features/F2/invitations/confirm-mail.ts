// K-422 招待のリンクで新しく入る人に送る「参加を確かめてください」のメールの文（関門 C6 の送出の口に渡す）。
//   載せるのは名前・ワークスペースの名前・招いた人の名前・確認のリンク・期限（24 時間）・心当たりが無いときの案内だけ。
//   パスワード・リンクの招待のトークンは入れない（確認のリンクのトークンは別の物）。値が無いときに null の字を出さない

export interface LinkJoinMailFacts {
  name: string;
  workspaceName: string | null;
  inviterName: string | null;
  url: string;
}

/** 確認のリンクの道（画面の葉 K-423 が開く） */
export const CONFIRM_PATH = "/invite/confirm/";

/** 答えに載せるメール：先頭 2 字・* が 4 つ・@ の後（入れたメールの字をそのまま返さない） */
export function maskEmail(email: string): string {
  return email.replace(/^([^@]{0,2})[^@]*(@.*)?$/su, "$1****$2");
}

export function linkJoinMail(f: LinkJoinMailFacts): { subject: string; text: string } {
  const ws = f.workspaceName ? f.workspaceName : "ワークスペース";
  const by = f.inviterName ? `${f.inviterName} さんの招待で、` : "";
  const text = `${f.name} さん

${by}「${ws}」への参加を受け付けました。
次のリンクを押すと、参加が決まります。押すまでは参加は決まりません。

${f.url}

このリンクは 24 時間で切れます。
心当たりが無ければ、このメールは捨ててください（何も起きません）。`;
  return { subject: `【Kaname】${ws} への参加を確かめてください`, text };
}
