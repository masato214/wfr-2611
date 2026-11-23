-- 20261122100600 完了の関数の直し：未チェックは数えて返すだけ・完了で本文を書き換えない（K-566・K-59 の葉・D-150.35・D-150.42・D-150.56・D-128.138）
--   新しい表・列は作らない。足すのは中だけの数える関数 1 本と、app.ticket_complete の作り直し（0101 の本体を写し、引数は同じ）。
--   ★ K-566 が変えた所：見張り 3 つ（実施事項の版 todo_changed・範囲の外の番号 todo_out_of_range・残っている項目 todo_left）を外し、
--   実施事項の書き換え（全部「- [x]」にして版を足す）をやめ、書く前に未チェックを数えて答えの unchecked に入れる。
--   p_todo_checked・p_todo_version は使わない（null でも通る。引数を消すのは K-578）。
--   見る順：完了済み → 段・走っている実行・承認待ち → 作業中か → 確かめ印 → 終わっていない子 → 書く。

-- ① 本文の文書の木の中の未チェックの箱の数（中だけで使う・誰にも execute を渡さない）
--   根から content の並びだけを辿り、type が taskItem で attrs.checked が真偽の true でない節を数える。
--   jsonpath の $.** は使わない（lax だと同じ節を 2 度数え、strict では attrs が無い節で式が不明になる）
create or replace function app.ticket_body_unchecked(p_doc jsonb) returns integer
language sql stable set search_path = public, app, pg_temp as $$
  with recursive n(node) as (
    select p_doc where jsonb_typeof(p_doc) = 'object'
    union all
    select c.value from n, jsonb_array_elements(case when jsonb_typeof(n.node -> 'content') = 'array' then n.node -> 'content' else '[]'::jsonb end) c
     where jsonb_typeof(c.value) = 'object'
  )
  select count(*)::integer from n
   where node ->> 'type' = 'taskItem' and coalesce(node #> '{attrs,checked}', 'false'::jsonb) is distinct from 'true'::jsonb
$$;
revoke all on function app.ticket_body_unchecked(jsonb) from public;

-- ② 完了にする
create or replace function app.ticket_complete(p_ticket uuid, p_todo_checked integer[], p_todo_version integer, p_confirmed boolean)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text;
        v_doc jsonb; v_text text; v_line text; v_body_n integer := 0; v_specs_n integer := 0; v_kids jsonb;
        v_err text; v_hidden integer := 0;   -- ★ K-166 が足した所：守りの判定の言葉・押した人に見えない終わっていない子の数
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じチケットの同時の 2 本は 1 本にする（チケットの行で待ち合わせる。後の 1 本は完了の後の行を見る）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  -- ★ K-166 が直した所（ここから v_err の if の終わりまで）：守りの判定（今のメンバーか・書けるか）の所で例外になったら、
  --   外に投げずに guard_failed を返して何も書かない（fail-closed・口は 503・K63-API-063）。判定の中身と順は 0100 のまま
  begin
    if not app.approval_member_now() then v_err := 'not_member';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  if v_stage = 'done' then return jsonb_build_object('error', 'done'); end if;
  -- 承認待ち・実行中・確認中、走っている実行、決まっていない承認待ちがあるうちは完了にできない（D-128.49）
  if v_stage in ('awaiting_approval', 'running', 'checking')
     or exists (select 1 from action_runs r
                 where r.ticket_id = t.id and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null)
     or exists (select 1 from approvals a
                 where a.ticket_id = t.id and a.decision is null and a.withdrawn_at is null and a.deleted_at is null) then
    return jsonb_build_object('error', 'stage');
  end if;
  -- ★ K-166 が足した所（この 1 行）：完了にできるのは作業中だけ。未着手・保留は not_doing（409・E-CONF-019・決める人の答え db67f3cde899 ②・83361b2157fd）
  if coalesce(v_stage, '') <> 'doing' then return jsonb_build_object('error', 'not_doing'); end if;
  if p_confirmed is distinct from true then return jsonb_build_object('error', 'not_confirmed'); end if;
  -- 終わっていない子（消されていない・段が完了でない）。番号と題名を返す（D-128.138）
  -- ★ K-166 が直した所（ここから children_left の if の終わりまで）：押した人に見える子（app.ticket_visible）だけを children に入れ、
  --   見えない子は数だけを children_hidden で返す（id・番号・題名を出さない・決める人の答え db67f3cde899 ①）。
  --   見える子が 0 でも見えない子が 1 つでもあれば断る（K63-API-096・097）
  select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.number || ' ' || c.title) order by c.number, c.id) filter (where k.seen),
         count(*) filter (where not k.seen)
    into v_kids, v_hidden
    from tickets c left join ticket_stages s on s.id = c.stage_id
         cross join lateral (select coalesce(app.ticket_visible(c.id), false) as seen) k
   where c.parent_ticket_id = t.id and c.tenant_id = t.tenant_id and c.deleted_at is null and coalesce(s.key, '') <> 'done';
  if v_kids is not null or v_hidden > 0 then
    return jsonb_build_object('error', 'children_left', 'children', coalesce(v_kids, '[]'::jsonb), 'children_hidden', v_hidden);
  end if;

  -- 未チェックを数える（書く前の同じ取引の中・チケットの行を for update で取った後。止めない・答えに返すだけ・D-150.42）
  --   本文の行（鍵 body・消していない）が在れば、文書の木の taskItem のうち attrs.checked が真偽の true でない物。
  --   本文の行が無い前の形は、実施事項の区画の字の「- 」の行のうち「- [x]」（X も）でない行。確認項目は消していない行の checked_at が空の物
  select s.body->'doc' into v_doc from ticket_sections s
   where s.ticket_id = t.id and s.section_key = 'body' and s.deleted_at is null;
  if found then
    v_body_n := app.ticket_body_unchecked(v_doc);
  else
    select s.body->>'text' into v_text from ticket_sections s
     where s.ticket_id = t.id and s.section_key = 'todo' and s.deleted_at is null;
    if v_text is not null then
      foreach v_line in array regexp_split_to_array(v_text, E'\n') loop
        if v_line ~ '^\s*- ' and v_line !~ '^\s*- \[[xX]\](\s|$)' then v_body_n := v_body_n + 1; end if;
      end loop;
    end if;
  end if;
  select count(*)::integer into v_specs_n from test_specs x
   where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null and x.checked_at is null;

  -- 書く（1 回の書き込み）：段・完了の時刻と押した人・やり取りの 1 行・証跡。実施事項の区画・本文の行・確認項目は書かない
  perform app.ticket_stage_to(t.id, 'done', v_me);
  update tickets set completed_at = now(), completed_by = v_me where id = t.id returning * into t;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が完了にしました');
  -- ナレッジの候補は骨格では出さない（「候補はまだ出していません」・D-128.138）ので、候補の数は 0 と記録する
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.complete', 'tickets', t.id::text, 'C2',
            jsonb_build_object('number', t.number, 'knowledge_candidates', 0), v_me);
  return jsonb_build_object('ticket_id', t.id, 'number', t.number, 'completed_at', t.completed_at, 'completed_by', v_me,
                            'notify_member_ids', coalesce((select jsonb_agg(x) from app.ticket_completed_recipients(t.id) x), '[]'::jsonb),
                            'unchecked', jsonb_build_object('body', v_body_n, 'specs', v_specs_n));
end $$;
revoke all on function app.ticket_complete(uuid, integer[], integer, boolean) from public;
grant execute on function app.ticket_complete(uuid, integer[], integer, boolean) to kaname_app;
