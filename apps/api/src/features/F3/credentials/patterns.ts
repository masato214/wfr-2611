// 預けたログイン情報の口（預ける・上書きする）が、打ったとおりの入力を照らす pattern（K-383）。
//   契約（08_api/openapi.yaml の CredentialCreateInput・CredentialUpdateInput）と同じ字。契約の側は scripts/ci/credential_patterns.py が作る。
//   同じ字かは試験 K352-API-026 が openapi.yaml と照らす（pattern と字がずれたら赤）。口はこの pattern に合う入力だけを整えて使う
/** 公開の接尾辞（誰でも下に名前を取れる 2 段の名前）。これだけを使える場所にすると、よその会社の宛先にも当たる（代表の答え answer=449e72553c59）。
 *  1 段だけの名前（jp・com）は形の確かめが先に断る。全部の一覧（Public Suffix List）は部品の追加が要るので、日本とよく使う国の分だけを持つ */
export const PUBLIC_SUFFIXES_LIST: readonly string[] = [
  "co.jp", "ne.jp", "or.jp", "ac.jp", "ad.jp", "ed.jp", "go.jp", "gr.jp", "lg.jp",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.kr", "com.cn", "com.tw", "com.sg", "com.br",
]; // prettier-ignore

/** trim が落とす字（全角の空白 U+3000 も） */
const WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";
const ch = (c: string): string => {
  const full = String.fromCharCode(c.charCodeAt(0) - 0x61 + 0xff41);
  return `[${c}${c.toUpperCase()}${full}${String.fromCharCode(full.charCodeAt(0) - 0x20)}]`;
};
const word = (s: string): string => [...s].map(ch).join("");

/** 名前：半角と全角の英字で始まり、英字・数字・_ の 64 文字まで。ß・ı・ſ のように大文字にすると英字になる字は入れない */
export const NAME_PATTERN = `^[${WS}]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]{0,63}[${WS}]*$`;

// ---- 使える場所 1 つ（表記ゆらぎの決まり：前に受けていた入力は今も受ける）----
// scheme（全角の ：／／ も）・@ の前・ポート・道・問い合わせ・断片は任意。ホストのラベルは「空白・区切り・記号以外の字の 1 字以上」
// （字の種類・長さで絞らない＝日本語・々・ハングル・キリル・混ざり・長い名前を受ける）。頭の *. も受ける。公開の接尾辞だけは断る。
// 口は同じ pattern で打ったとおりを照らし、同じ pattern の取り出し（1 番目＝頭の *. ・2 番目＝ホスト）で名前を取る
const DOT = "[.．。｡]";
const EXCL =
  "\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~" +
  "\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff" +
  "\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b";
const LC = `[^${EXCL}]`;
const NLC = `[^${EXCL}0-9０-９]`;
const LABEL = `${LC}+`;
const TLD = `${LC}*${NLC}${LC}*`;
const HOST = `((?:${LABEL}${DOT})+${TLD}${DOT}?)`;
const END = `(?:[:：/／?？#＃]|[${WS}]|$)`;
const SUFFIX_LOOK = `(?!(?:${PUBLIC_SUFFIXES_LIST.map((x) => [...x].map((c) => (c === "." ? DOT : ch(c))).join("")).join("|")})${DOT}?${END})`;
const SCHEME = `(?:${word("http")}${ch("s")}?[:：][/／][/／])?`;
const USERINFO = `(?:[^${WS}/／?？#＃\\\\]*[@＠])?`;
const PORT = "(?:[:：][0-9０-９]{0,5})?";
const PATH = `(?:[/／?？#＃][^${WS}]*)?`;
export const DESTINATION_PATTERN = `^[${WS}]*(\\*${DOT})?${SCHEME}${USERINFO}${SUFFIX_LOOK}${HOST}${PORT}${PATH}[${WS}]*$`;

/** 認証アプリの鍵：空白（WS）を挟んでよい大文字・小文字・全角の Base32 を 16 字以上。詰めの = は全角の ＝ も */
export const TOTP_PATTERN = `^[${WS}]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][${WS}]*){16,}[=＝]*[${WS}]*$`;

// 期限：年-月-日（全角の数字とハイフンも）。暦に在る日だけ（うるう年の 2 月 29 日まで）。日本の今日との前後は口が決める（時刻で決まる・409）
const H = "[-－]";
const M31 = `(?:[0０][13578１３５７８]|[1１][02０２])${H}(?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][01０１])`;
const M30 = `(?:[0０][469４６９]|[1１][1１])${H}(?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][0０])`;
const FEB = `[0０][2２]${H}(?:[0０][1-9１-９]|[1１][0-9０-９]|[2２][0-8０-８])`;
const LEAP =
  "(?:[0-9０-９]{2}(?:[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])" +
  "|(?:[0０]{2}|[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])[0０]{2})" +
  `${H}[0０][2２]${H}[2２][9９]`;
export const EXPIRES_PATTERN = `^[${WS}]*(?:[0-9０-９]{4}${H}(?:${M31}|${M30}|${FEB})|${LEAP})[${WS}]*$`;

/** ログイン名：空白だけでない（\S と同じ。契約が Python でも同じ字の集まりになるよう、字を並べて書く・上の WS と同じ字。試験 K1117-CT-007 が字のまま読むので 1 つの文字で書く・K-1117） */
// prettier-ignore
export const LOGIN_PATTERN = "[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";

export const NAME_RE_RAW = new RegExp(NAME_PATTERN);
export const DESTINATION_RE_RAW = new RegExp(DESTINATION_PATTERN);
export const TOTP_RE_RAW = new RegExp(TOTP_PATTERN);
export const EXPIRES_RE_RAW = new RegExp(EXPIRES_PATTERN);
export const LOGIN_RE_RAW = new RegExp(LOGIN_PATTERN);
