// 段 9（F8 渡す・配る）の口が共に使う依存（K-401 が置き場を作る。K-402〜K-410 は同じ形を使う）
import type pg from "pg";

/** メールの送出（関門 C6・server.ts の 1 か所）。無ければ送れない扱い */
export type HandoverMailer = (m: { to: string; subject: string; text: string }) => Promise<void>;

export interface HandoverDeps {
  /** kaname_app の接続（関門 C2・渡しの DB の関数） */
  appPool: pg.Pool;
  mailer?: HandoverMailer;
  /** メールの Kaname を開くリンクの頭 */
  config: { webBaseUrl: string };
}
