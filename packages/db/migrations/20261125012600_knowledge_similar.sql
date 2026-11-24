-- 20261125012600 似たページを探す（K-686・契約の口 findSimilarKnowledge・D-152.14）
--   新しい表・列は作らない。① pg_trgm を入れる（無い DB・権限の無い DB でも migration は通す・G-11・0102 と同じ形）
--   ② 関数 app.kn_similar（plpgsql＝拡張が無い DB でも作れ、呼んだときに断る）。同じ migration をもう 1 度当てても壊れない。
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    raise notice 'pg_trgm が無いので似たページは探せない（app.kn_similar は呼ぶと断る）';
    return;
  end if;
  begin
    create extension if not exists pg_trgm;
  exception when insufficient_privilege then
    raise notice 'pg_trgm を入れる権限が無いので似たページは探せない';
    return;
  end;
end $$;

-- app.kn_similar(p_head, p_body, p_exclude, p_min)：似たページの上位 3 件。
--   公開済みのページ（消していない・p_exclude でない）ごとに、公開済みの最新の版を付け、点 ＝ 題名＋1 行の説明どうしの似ている度合いと、
--   本文の頭 500 字どうしの似ている度合い（本文を送ったときだけ）の大きい方。p_min 以上を点の大きい順・id の順に 3 件。
--   security invoker：見えるかどうかは呼ぶ人の行の守り（knowledge_pages_read）に任せる（共有〔K-689〕が入ると共有された物も入る）。
--   棚の名前とフォルダは選んだ 3 件だけに付ける
create or replace function app.kn_similar(p_head text, p_body text, p_exclude uuid, p_min real default 0.3)
returns table (id uuid, title text, summary text, shelf_name text, folders text[], score real)
language plpgsql stable security invoker set search_path = public, app, pg_temp as $$
#variable_conflict use_column
begin
  return query
  select top.id, top.title, top.summary,
         app.kn_shelf_name(top.scope_id, top.is_personal),
         case when top.folder_id is null then '{}'::text[] else app.kn_folder_names(top.folder_id) end,
         top.score
    from (
      select p.id, p.title, p.summary, p.scope_id, p.is_personal, p.folder_id, s.score
        from knowledge_pages p
        left join lateral (
          select v.body from knowledge_page_versions v
           where v.page_id = p.id and v.kind = 'published' and v.deleted_at is null
           order by v.version desc limit 1) v on true
        cross join lateral (
          select greatest(
                   similarity(lower(coalesce(p_head, '')), lower(p.title || ' ' || p.summary)),
                   case when coalesce(p_body, '') <> ''
                        then similarity(lower(left(p_body, 500)), lower(left(coalesce(v.body->>'text', ''), 500)))
                        else 0 end)::real as score) s
       where p.tenant_id = app.tenant_id() and p.state = 'published' and p.deleted_at is null
         and (p_exclude is null or p.id <> p_exclude)
         and s.score >= p_min
       order by s.score desc, p.id
       limit 3) top
   order by top.score desc, top.id;
end $$;

revoke execute on function app.kn_similar(text, text, uuid, real) from public;
grant execute on function app.kn_similar(text, text, uuid, real) to kaname_app;
