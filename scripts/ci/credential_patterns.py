"""預けたログイン情報の口（createCredential・updateCredential）が、打ったとおりの入力を照らす pattern（K-383）。
契約（05_flow/screen_api.d/K-352.py・K-353.py の VALUE_RANGES）と口（apps/api/src/features/F3/credentials/patterns.ts）が同じ字を使う。
同じ字かは試験 K352-API-026 が 08_api/openapi.yaml と照らす。公開の接尾辞の一覧は patterns.ts の PUBLIC_SUFFIXES と同じ並び。"""

# trim が落とす字（全角の空白 U+3000 も）
WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
PUBLIC_SUFFIXES = ["co.jp", "ne.jp", "or.jp", "ac.jp", "ad.jp", "ed.jp", "go.jp", "gr.jp", "lg.jp", "co.uk", "org.uk", "ac.uk", "gov.uk",
                   "com.au", "net.au", "org.au", "co.nz", "co.kr", "com.cn", "com.tw", "com.sg", "com.br"]
FULL = {c: chr(ord(c) - ord("a") + 0xFF41) for c in "abcdefghijklmnopqrstuvwxyz"}  # 全角の小文字


def _ch(c: str) -> str:
    """英字 1 字を、大文字・小文字・全角で受ける"""
    return f"[{c}{c.upper()}{FULL[c]}{chr(ord(FULL[c]) - 0x20)}]"


def _word(s: str) -> str:
    return "".join(_ch(c) for c in s)


NAME = f"^[{WS}]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]{{0,63}}[{WS}]*$"

# ---- 使える場所 1 つ（表記ゆらぎの決まり：前に受けていた入力は今も受ける）----
# scheme（全角の ：／／ も）・@ の前・ポート・道・問い合わせ・断片は任意。ホストのラベルは「空白・区切り・記号以外の字の 1 字以上」
# （字の種類・長さで絞らない＝日本語・々・ハングル・キリル・混ざり・長い名前・そのままの punycode・全角ハイフン・空のポートを受ける）。頭の *. も受ける。
# 前は受けたが断る約物・バックスラッシュ・百分率・ゼロ幅空白・NFKC が「.」を含む互換の字は試験に名指しする。公開の接尾辞だけは断る。
# 口は同じ pattern で打ったとおりを照らし、同じ pattern の取り出し（1 番目＝頭の *. ・2 番目＝ホスト）で名前を取る
_DOT = "[.．。｡]"
_EXCL = ("\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~"
         "\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b")
_LC = f"[^{_EXCL}]"
_NLC = f"[^{_EXCL}0-9０-９]"
_LABEL = f"{_LC}+"
_TLD = f"{_LC}*{_NLC}{_LC}*"
_HOST = f"((?:{_LABEL}{_DOT})+{_TLD}{_DOT}?)"
_END = f"(?:[:：/／?？#＃]|[{WS}]|$)"
_SUFFIX_LOOK = "(?!(?:" + "|".join("".join(_DOT if c == "." else _ch(c) for c in x) for x in PUBLIC_SUFFIXES) + f"){_DOT}?{_END})"
_SCHEME = f"(?:{_word('http')}{_ch('s')}?[:：][/／][/／])?"
_USERINFO = f"(?:[^{WS}/／?？#＃\\\\]*[@＠])?"
_PORT = "(?:[:：][0-9０-９]{0,5})?"
_PATH = f"(?:[/／?？#＃][^{WS}]*)?"
DEST = f"^[{WS}]*(\\*{_DOT})?{_SCHEME}{_USERINFO}{_SUFFIX_LOOK}{_HOST}{_PORT}{_PATH}[{WS}]*$"

# 認証アプリの鍵：空白（WS）を挟んでよい大文字・小文字・全角の Base32 を 16 字以上。詰めの = は全角の ＝ も
TOTP = f"^[{WS}]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][{WS}]*){{16,}}[=＝]*[{WS}]*$"

# 期限：年-月-日（全角の数字とハイフンも）。暦に在る日だけ（うるう年の 2 月 29 日まで）。日本の今日との前後は口が決める（時刻で決まる・409）
_H = "[-－]"
_M31 = "(?:[0０][13578１３５７８]|[1１][02０２])" + _H + "(?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][01０１])"
_M30 = "(?:[0０][469４６９]|[1１][1１])" + _H + "(?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][0０])"
_FEB = "[0０][2２]" + _H + "(?:[0０][1-9１-９]|[1１][0-9０-９]|[2２][0-8０-８])"
_LEAP = ("(?:[0-9０-９]{2}(?:[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])"
         "|(?:[0０]{2}|[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])[0０]{2})" + _H + "[0０][2２]" + _H + "[2２][9９]")
EXPIRES = f"^[{WS}]*(?:[0-9０-９]{{4}}{_H}(?:{_M31}|{_M30}|{_FEB})|{_LEAP})[{WS}]*$"

# ログイン名：空白だけでない（\S と同じ。JS の \s の字を並べて書く：schemathesis の Python の \S は字の集まりが違う・K-1117）
LOGIN = f"[^{WS}]"
