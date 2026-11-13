-- Community Safe — Row Level Security.
-- Principe : tout est fermé par défaut ; les écritures sensibles passent par des RPC (0003).

-- ───────────────────────────── Helpers ─────────────────────────────
create or replace function public.setting_int(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select (value #>> '{}')::integer from app_settings where key = p_key), p_default);
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select (value #>> '{}')::boolean from app_settings where key = p_key), p_default);
$$;

-- Administrateur = rôle en base ET session MFA (aal2), sauf si désactivé explicitement.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from admin_roles where user_id = auth.uid())
     and (not setting_bool('admin_require_mfa', true)
          or coalesce(auth.jwt() ->> 'aal', '') = 'aal2');
$$;

create or replace function public.owns_creator(p_creator_id uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from creator_profiles where id = p_creator_id and owner_user_id = auth.uid());
$$;

create or replace function public.is_alert_recipient(p_alert_id uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from alert_recipients where alert_id = p_alert_id and user_id = auth.uid());
$$;

-- ───────────────────────────── Privilèges de base ─────────────────────────────
revoke all on all tables in schema public from anon, authenticated;

grant select on public.creator_profiles, public.social_accounts, public.plans to anon;

grant select on all tables in schema public to authenticated;
grant update (display_name, locale, timezone, age_confirmed_at) on public.users to authenticated;
-- Un créateur ne peut modifier ni son badge, ni son statut, ni son forfait, ni son compteur.
grant update (display_name, bio, avatar_url, category) on public.creator_profiles to authenticated;
-- Les comptes sociaux s'ajoutent par add_social_account (URL validée) ; supprimer un compte certifié impose une nouvelle vérification.
grant delete on public.social_accounts to authenticated;
grant delete on public.community_memberships to authenticated;
grant update (sos_enabled, announcements_enabled) on public.notification_preferences to authenticated;
grant insert (user_id, kind, subject_id, version, granted) on public.consent_records to authenticated;
grant insert (creator_id, source), delete on public.transfer_links to authenticated;
grant insert (creator_id, completed_steps), update (completed_steps) on public.transfer_campaigns to authenticated;
grant insert (reporter_user_id, creator_id, alert_id, reason, details) on public.abuse_reports to authenticated;
grant update (status) on public.abuse_reports to authenticated;
grant insert, update, delete on public.plans, public.app_settings, public.blocked_link_domains to authenticated;

grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated, service_role;

-- ───────────────────────────── Activation RLS ─────────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ───────────────────────────── Politiques ─────────────────────────────
create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy users_update on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy admin_roles_select on public.admin_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy organizations_select on public.organizations for select to authenticated
  using (owner_user_id = auth.uid() or public.is_admin());

create policy plans_select on public.plans for select to anon, authenticated
  using (is_public or public.is_admin());
create policy plans_admin on public.plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy app_settings_select on public.app_settings for select to authenticated using (true);
create policy app_settings_admin on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy blocked_domains_admin on public.blocked_link_domains for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profils publics : visibles par tous tant qu'ils ne sont pas suspendus.
create policy creators_select on public.creator_profiles for select to anon, authenticated
  using (status = 'active' or owner_user_id = auth.uid() or public.is_admin());
create policy creators_update on public.creator_profiles for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy social_select on public.social_accounts for select to anon, authenticated using (true);
create policy social_delete on public.social_accounts for delete to authenticated
  using (public.owns_creator(creator_id));

create policy verifications_select on public.creator_verifications for select to authenticated
  using (public.owns_creator(creator_id) or public.is_admin());

create policy transfer_links_owner on public.transfer_links for all to authenticated
  using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));
create policy transfer_campaigns_owner on public.transfer_campaigns for all to authenticated
  using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));

-- Un créateur ne voit JAMAIS la liste de ses membres : uniquement des agrégats via RPC.
create policy memberships_select on public.community_memberships for select to authenticated
  using (user_id = auth.uid());
create policy memberships_delete on public.community_memberships for delete to authenticated
  using (user_id = auth.uid());

create policy prefs_select on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());
create policy prefs_update on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy consents_select on public.consent_records for select to authenticated
  using (user_id = auth.uid());
create policy consents_insert on public.consent_records for insert to authenticated
  with check (user_id = auth.uid());

create policy devices_select on public.devices for select to authenticated using (user_id = auth.uid());
create policy push_tokens_select on public.push_tokens for select to authenticated using (user_id = auth.uid());

create policy alerts_select on public.alerts for select to authenticated
  using (public.owns_creator(creator_id)
         or (status in ('sending', 'sent') and public.is_alert_recipient(id))
         or public.is_admin());

create policy recipients_select on public.alert_recipients for select to authenticated
  using (user_id = auth.uid());

create policy delivery_attempts_admin on public.delivery_attempts for select to authenticated
  using (public.is_admin());
create policy link_clicks_admin on public.link_click_events for select to authenticated
  using (public.is_admin());

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.owns_creator(creator_id) or public.is_admin());
create policy payments_select on public.payments for select to authenticated
  using (public.owns_creator(creator_id) or public.is_admin());

create policy reports_select on public.abuse_reports for select to authenticated
  using (reporter_user_id = auth.uid() or public.is_admin());
create policy reports_insert on public.abuse_reports for insert to authenticated
  with check (reporter_user_id = auth.uid());
create policy reports_admin_update on public.abuse_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_admin on public.audit_logs for select to authenticated using (public.is_admin());
