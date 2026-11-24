-- 20261121092200 招待のリンクで新しく入る人の保留の行（K-422・D-148.51・関門 C2）
-- ログインしていない人が招待のリンクで「参加」を押しても、その時点では認証の利用者も所属も作らない。
-- この表の 1 行（保留）と確認のメールだけを置き、確認のリンクを押したときに参加を決める。
-- 会社のデータではない（まだ会社の人ではない）ので public ではなく kaname_auth に置く（保留の申し込み 0022 と同じ置き場と形）。
-- 触れるのは認証の接続だけ（0059 の既定の権限の取り消しのまま・kaname_app には何も渡さない）。
-- パスワードは平文で持たず、鍵（用途 invitation-link-join）で包んで預かる。
create table if not exists kaname_auth.invitation_link_joins (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null,
  -- 招待のリンクの印の sha256（確認のときに受諾の関数を呼ぶために要る。招待の行は kaname_app の側にあり、id だけでは引けない）
  invitation_token_hash text not null,
  tenant_id     uuid not null,
  email         text not null,
  display_name  text not null,
  -- 包んだパスワード：参加が決まった後と閉じた後は空にする（持つ理由が無い・保留の申し込み pending_signup と同じ形）
  pw_iv         text,
  pw_tag        text,
  pw_data       text,
  token_hash    text not null,
  expires_at    timestamptz not null,
  -- 送れたか。送れていないのに「送りました」と画面に出さないため（G-15）
  sent_at       timestamptz,
  send_error    text,
  -- 確認のリンクを押して「使う」の印を付けた時刻（同時に何回押しても 1 回だけ取れる）
  confirmed_at  timestamptz,
  -- 閉じた（参加が決まらないと分かった保留の行）。閉じた行は「無い」と同じに扱う
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- 同じ招待・同じメールの待っている行は 1 つ（押し直しは同じ行のトークンと期限を替える）
create unique index if not exists invitation_link_joins_waiting
  on kaname_auth.invitation_link_joins (invitation_id, email)
  where confirmed_at is null and deleted_at is null;
create index if not exists invitation_link_joins_token on kaname_auth.invitation_link_joins (token_hash);
create index if not exists invitation_link_joins_expires on kaname_auth.invitation_link_joins (expires_at);
