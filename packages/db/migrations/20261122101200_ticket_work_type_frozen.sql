-- 20261122101200 業務の型の列を凍結する（K-582・D-150.60）
--   業務の型は物として無くした（種別の本文のひな形 ticket_kinds.body_template とナレッジのページで受ける）。
--   列 tickets.work_type_id・work_type_version は消さない（本番に値が入っていれば消えるため。扱いは段 10）。
--   表の目録（db-catalog.json）は表の区分だけなので、列の凍結は列の注で言う。表・値・制約・権限・関数は変えない。
comment on column tickets.work_type_id is '凍結（K-582・D-150.60）：業務の型は物として無くした。口もコードも読まない・書かない。列と値は残す（扱いは段 10）';
comment on column tickets.work_type_version is '凍結（K-582・D-150.60）：業務の型は物として無くした。口もコードも読まない・書かない。列と値は残す（扱いは段 10）';
