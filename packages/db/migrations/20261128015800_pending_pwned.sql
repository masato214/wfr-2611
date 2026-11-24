-- K-1018 照合が使えなかった登録の印（D-156.35）。
--   登録の口が、パスワードの照合先が落ちて照合できなかった申し込みに時刻を入れる（空なら照合できた）。
--   メールの確認で確定したとき、印があればその会社に pwned_check_unavailable を 1 行書く（確定の口）。
--   登録し直すと最後の照合に従って入れ直す。索引は要らない（メールの主キーで引く）
alter table kaname_auth.pending_signup add column if not exists pwned_unchecked_at timestamptz;
