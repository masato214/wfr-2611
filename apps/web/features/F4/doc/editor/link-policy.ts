// リンクの許し方（K-567）：http・https・mailto だけ。画面（帯・貼り付け）と読む形の描き（K-577）が同じ物を使う（1 か所）。
//   前後の空白は落としてから見る。途中の空白・制御文字・NUL を含む物、2048 字を超える物は許さない（文書の木の上限 DOC_HREF_MAX と同じ数）
import { DOC_HREF_MAX } from "@kaname/contracts";

const SCHEME_OK = /^(https?:\/\/|mailto:)/i;
// 空白・制御文字（C0・DEL・C1）を 1 つでも含めば許さない
// eslint-disable-next-line no-control-regex
const BAD_CHAR = /[\s\u0000-\u001f\u007f-\u009f]/;

/** 許されたリンク先か（前後の空白は落としてから見る） */
export function isAllowedHref(href: string): boolean {
  if (typeof href !== "string") return false;
  const h = href.trim();
  if (h === "" || h.length > DOC_HREF_MAX) return false;
  if (BAD_CHAR.test(h)) return false;
  return SCHEME_OK.test(h);
}

/** 許されたリンク先を、文書に入れる形（前後の空白を落とし、頭の http・https・mailto を小文字にした字）にする。許されなければ null。
 *  文書の木の確かめ（validateDoc）は頭の字を小文字で見るので、ここでそろえる */
export function normalizeHref(href: string): string | null {
  if (!isAllowedHref(href)) return null;
  return href.trim().replace(/^[a-z]+:/i, (m) => m.toLowerCase());
}
