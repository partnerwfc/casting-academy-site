-- Abonnés sans compte (connexion anonyme) : aucune donnée saisie, aucun e-mail.
-- Les comptes anonymes sans aucune communauté depuis 30 jours sont supprimés (évite l'accumulation de comptes vides).
create or replace function public.purge_anonymous_users()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v_n integer;
begin
  delete from auth.users u
   where u.is_anonymous and u.created_at < now() - interval '30 days'
     and not exists (select 1 from public.community_memberships m where m.user_id = u.id)
     and not exists (select 1 from public.creator_profiles c where c.owner_user_id = u.id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.purge_anonymous_users() from public, anon, authenticated;
grant execute on function public.purge_anonymous_users() to service_role;

do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-anonymous', '41 3 * * *', 'select public.purge_anonymous_users()');
  end if;
end $outer$;
