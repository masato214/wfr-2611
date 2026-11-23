-- 20261120160000 DB の関数を、誰でも（PUBLIC）呼べる形から外す（K-426・関門 C2・D-128.171）
--   決まり D-128.171：security definer の関数は、呼んでよい役だけに execute を渡し public から外す。
--   関数ごとに `revoke all … from public` を書いて守ってきたが、書き忘れた物が 146 件残った（本線 77207947 で数えた）。
--   この migration は関数ごとの revoke を並べず、根本を消す。
--
-- ① これから作る関数：migration を流す役の既定の権限から PUBLIC の execute を外す。
--      PostgreSQL の決まり：スキーマを付けた `alter default privileges in schema … revoke … from public` は、
--      全体の既定（関数は PUBLIC に execute）を外せない（スキーマごとの既定は全体の既定に足すだけ）。だからスキーマを付けずに書く。
--      これからの関数は初めから誰にも渡らない。呼ぶ役には、今までどおり migration に `grant execute … to kaname_app` を書く。
-- ② 今ある関数：app の関数全部と、public のスキーマの security definer の関数 2 つ（0002 の visible_scopes・has_permission）から
--      PUBLIC を一度に外す。public の拡張の関数（vector・pgcrypto・pg_trgm）は触らない。
-- ②b 呼んでよい役は 持ち主・kaname_app・kaname_auth の 3 つ。それ以外の役に明示で渡した実行権と、migration を流す役の
--      既定の権限でほかの役に渡す行も外す（staging／本番の Supabase の anon・authenticated・service_role や、
--      手で作った kaname_ci_read に当たる）。役の名前は決め打ちしない。手元と CI の DB には該当が無く何もしない。
-- ③ 呼び手の権限で動く所が呼ぶ物で、まだ kaname_app に明示で渡していない 6 つだけを渡す：
--      行の守り（RLS）の式は文を流した役の権限で関数を呼ぶ → app.tenant_id()・app.user_id()・app.ops_grant_ok(uuid)・
--      public.visible_scopes(uuid)・public.has_permission(uuid, text, uuid, text)。
--      呼び手の権限で動く引き金（app.agent_notify_job・app.agent_notify_conversation）の本文が app.agent_notify_member(uuid) を呼ぶ。
--      引き金の関数そのものは動くときに execute を見ないので渡さない。security definer の関数の中から呼ぶ物は持ち主の権限で動く。
-- 中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形にする。

-- ① これから作る関数（スキーマを付けない）
alter default privileges revoke execute on functions from public;

-- ② 今ある関数から PUBLIC を外す
revoke execute on all functions in schema app from public;
revoke execute on function public.visible_scopes(uuid), public.has_permission(uuid, text, uuid, text) from public;

-- ②b 持ち主・kaname_app・kaname_auth のほかの役に渡した実行権と、既定の権限の行を外す
do $$
declare r record;
begin
  for r in
    select distinct p.oid::regprocedure as f, a.grantee::regrole as g
      from pg_proc p cross join lateral aclexplode(p.proacl) a
     where (p.pronamespace = 'app'::regnamespace
            or (p.pronamespace = 'public'::regnamespace and p.prosecdef
                and not exists (select 1 from pg_depend d
                                 where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')))
       and a.grantee <> 0 and a.grantee <> p.proowner
       and a.grantee not in ('kaname_app'::regrole, 'kaname_auth'::regrole)
  loop
    execute format('revoke execute on function %s from %s', r.f, r.g);
  end loop;
  for r in
    select distinct d.defaclnamespace as ns, a.grantee::regrole as g
      from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
     where d.defaclrole = current_user::regrole and d.defaclobjtype = 'f'
       and a.grantee <> 0 and a.grantee <> d.defaclrole
       and a.grantee not in ('kaname_app'::regrole, 'kaname_auth'::regrole)
  loop
    if r.ns = 0 then
      execute format('alter default privileges revoke execute on functions from %s', r.g);
    else
      execute format('alter default privileges in schema %s revoke execute on functions from %s', r.ns::regnamespace, r.g);
    end if;
  end loop;
end $$;

-- ③ 呼び手の権限で動く所が呼ぶ物だけを kaname_app に渡す
grant execute on function app.tenant_id(), app.user_id(), app.ops_grant_ok(uuid), app.agent_notify_member(uuid),
  public.visible_scopes(uuid), public.has_permission(uuid, text, uuid, text) to kaname_app;
