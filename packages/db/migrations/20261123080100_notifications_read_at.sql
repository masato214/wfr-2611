-- 20261123080100 知らせに「読んだ時刻」の列を足し、鈴の一覧の索引を作る（K-461・契約の口 listNotifications・D-151.2・D-151.4・関門 C2）
--   行の守りは同じ名前の policies（読む＝同じ会社で自分宛て・書く＝同じ会社で自分宛て。前の「同じ会社なら誰でも読める」
--   「notifications の edit を持つ人は誰の行でも書ける」をやめる・D-151.3）。作り手は scripts/ci/gen_rls.py。
--
-- ① read_at：読んだ時刻。空＝未読。既定なし（今ある行は全部未読）。sent_at・failed_at は段 9 のメールの印のままで、鈴は読まない（D-151.2）
-- ② notifications_inbox_unread_idx：未読の一覧と数（自分宛て・鈴に出す行・消していない・読んでいない）
-- ③ notifications_inbox_idx：読んだ分も含む新しい順の一覧（keyset の並び：できた時刻・id）
--   索引は concurrently にしない（migrate.ts は 1 本ずつ begin〜commit の中で当てる・表も小さい。.squawk.toml が同じ規則を外している）。
alter table notifications add column if not exists read_at timestamptz;

create index if not exists notifications_inbox_unread_idx on notifications (member_id, created_at desc, id desc)
  where read_at is null and channel_id = 'inapp' and deleted_at is null;
create index if not exists notifications_inbox_idx on notifications (member_id, created_at desc, id desc)
  where channel_id = 'inapp' and deleted_at is null;
