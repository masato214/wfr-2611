-- 20261123081500 保存した検索条件の名前を 1 人 1 つにそろえる（K-475・契約の口 createSavedView・D-128.83・D-151.9・関門 C2）
--   同じ名前は 1 人 1 つ。大文字小文字・全角半角の違いも同じ名前として数える（口が入口で NFKC に直した名前を入れ、索引は lower(name) で見る）。
--   消した物（deleted_at）は名前をふさがない（見えず直せない物が名前だけふさぐのを避ける）。
--   口の確かめ（同じ人ごとの助言ロックの中で名前と数を数える）をすり抜けた直の書き込みと、同時の 2 回目を止める最後の砦。
--   表は口が無かったので行が入っていない（seeds にも saved_views は無い）。重なる名前を直す手順は要らない。
--   索引は concurrently にしない（migrate.ts は 1 本ずつ begin〜commit の中で当てる・表も小さい。.squawk.toml が同じ規則を外している）。
create unique index if not exists saved_views_name_uq on saved_views (tenant_id, member_id, lower(name)) where deleted_at is null;
