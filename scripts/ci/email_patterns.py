"""登録とログインの口のメールの形（K-1116・K-1117）。

口は正規化（NFKC・空白を除く・小文字）の後に EMAIL_RE と、ログインの部品 better-auth の z.email()（zod 4.6.7 の email の形・英数字と _'+-. だけ）で見て、
外なら 422 E-VAL-004。契約はその形を前後の空白で挟む（口より狭く書く・全角や途中の空白は契約の外）。
空白は \\s にしない（schemathesis の Python の \\s は \\x1c〜\\x1f・\\x85 を含み、口の正規化（JS の \\s）が除かない字を作る）。
部品の形と字まで同じかは scripts/ci/k1116_fuzz_contract_test.py の K1116-CT-004 と k1117_portable_contract_test.py の K1117-CT-005 が見る
"""

LOGIN_EMAIL = "^[ \\t\\n\\r]*(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}[ \\t\\n\\r]*$"
