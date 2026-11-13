-- Community Safe — logique métier côté serveur.
-- Toute écriture sensible (suivi, alertes, appareils, administration) passe par ces fonctions.

-- ───────────────────────────── Utilitaires ─────────────────────────────
create or replace function public.audit(p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}')
returns void language sql security definer set search_path = public, extensions as $$
  insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'));
$$;

create or replace function public.require_user()
returns uuid language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

-- Vérification renforcée : la dernière authentification (OTP, passkey ou MFA) doit être récente.
create or replace function public.has_recent_auth()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select max((e ->> 'timestamp')::bigint)
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
  ), 0) >= extract(epoch from now()) - public.setting_int('stepup_max_age_minutes', 10) * 60;
$$;

-- Contrôle statique d'un lien d'alerte. Les redirections sont contrôlées par le worker d'envoi.
create or replace function public.check_alert_link(p_url text)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_host text;
begin
  if p_url is null then return null; end if;
  if char_length(p_url) > 500 then return 'link_too_long'; end if;
  if p_url !~* '^https://' then return 'link_not_https'; end if;
  v_host := lower(substring(p_url from '^[hH][tT][tT][pP][sS]://([^/?#]+)'));
  if v_host is null or v_host ~ '[@:\s]' then return 'link_invalid_host'; end if;      -- userinfo, port, espaces
  if v_host !~ '^([a-z0-9-]+\.)+[a-z]{2,}$' then return 'link_invalid_host'; end if;     -- exclut IP et hôtes locaux
  if v_host ~ '(^|\.)xn--' then return 'link_punycode'; end if;                          -- homographes
  if exists (
    select 1 from blocked_link_domains d
    where v_host = d.domain::text or v_host like '%.' || d.domain::text
  ) then return 'link_blocked_domain'; end if;
  return null;
end $$;

-- ───────────────────────────── Triggers ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.users (id, display_name, locale)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80), ''),
    case when new.raw_user_meta_data ->> 'locale' in ('en', 'fr', 'pt', 'es')
         then new.raw_user_meta_data ->> 'locale' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_member_count()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    update creator_profiles set member_count = member_count + 1 where id = new.creator_id;
  elsif tg_op = 'DELETE' then
    update creator_profiles set member_count = greatest(member_count - 1, 0) where id = old.creator_id;
  end if;
  return null;
end $$;

create trigger memberships_count after insert or delete on public.community_memberships
  for each row execute function public.sync_member_count();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger prefs_touch before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

-- ───────────────────────────── Abonné : suivre / préférences ─────────────────────────────
-- Suivi = action explicite de l'utilisateur. Idempotent.
create or replace function public.follow_creator(p_handle text, p_source text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_creator creator_profiles;
  v_new boolean;
begin
  select * into v_creator from creator_profiles where handle = lower(trim(leading '@' from p_handle));
  if v_creator.id is null or v_creator.status <> 'active' then
    raise exception 'creator_not_found' using errcode = 'P0002';
  end if;

  insert into community_memberships (creator_id, user_id, source)
  values (v_creator.id, v_user, nullif(left(p_source, 30), ''))
  on conflict do nothing;
  v_new := found;

  if v_new then
    -- SOS activé par défaut (c'est l'objet du suivi), annonces en opt-in.
    insert into notification_preferences (creator_id, user_id) values (v_creator.id, v_user)
    on conflict do nothing;
    insert into consent_records (user_id, kind, subject_id, granted) values
      (v_user, 'follow', v_creator.id, true),
      (v_user, 'sos_notifications', v_creator.id, true);
  end if;
  return v_creator.id;
end $$;

create or replace function public.set_notification_preferences(
  p_creator_id uuid, p_sos boolean, p_announcements boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_old notification_preferences;
begin
  select * into v_old from notification_preferences
    where creator_id = p_creator_id and user_id = v_user for update;
  if v_old.user_id is null then
    raise exception 'not_following' using errcode = 'P0002';
  end if;
  update notification_preferences
     set sos_enabled = p_sos, announcements_enabled = p_announcements
   where creator_id = p_creator_id and user_id = v_user;
  -- Trace de consentement pour chaque changement.
  if v_old.sos_enabled is distinct from p_sos then
    insert into consent_records (user_id, kind, subject_id, granted)
    values (v_user, 'sos_notifications', p_creator_id, p_sos);
  end if;
  if v_old.announcements_enabled is distinct from p_announcements then
    insert into consent_records (user_id, kind, subject_id, granted)
    values (v_user, 'announcement_notifications', p_creator_id, p_announcements);
  end if;
end $$;

-- Clic sur un lien de transfert : compteur anonyme, sans donnée personnelle.
create or replace function public.record_link_click(p_handle text, p_source text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_creator uuid;
begin
  select id into v_creator from creator_profiles
   where handle = lower(trim(leading '@' from p_handle)) and status = 'active';
  if v_creator is null then return; end if;
  insert into link_click_events (creator_id, source)
  values (v_creator, nullif(substring(lower(coalesce(p_source, '')) from '^[a-z0-9_-]{1,30}$'), ''));
end $$;

-- ───────────────────────────── Appareils ─────────────────────────────
create or replace function public.register_device(
  p_installation_id text, p_platform text, p_permission public.push_permission,
  p_token text default null, p_app_version text default null, p_locale text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_device uuid;
begin
  if p_installation_id is null or char_length(p_installation_id) not between 8 and 100 then
    raise exception 'invalid_installation_id' using errcode = '22023';
  end if;

  insert into devices (user_id, installation_id, platform, app_version, locale, notifications_permission)
  values (v_user, p_installation_id, p_platform, left(p_app_version, 30), left(p_locale, 20), p_permission)
  on conflict (user_id, installation_id) do update
    set platform = excluded.platform, app_version = excluded.app_version, locale = excluded.locale,
        notifications_permission = excluded.notifications_permission, last_seen_at = now()
  returning id into v_device;

  if p_token is not null and p_permission = 'granted' then
    if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
      raise exception 'invalid_push_token' using errcode = '22023';
    end if;
    -- Un jeton appartient au dernier compte connecté sur l'appareil.
    insert into push_tokens (device_id, user_id, token)
    values (v_device, v_user, p_token)
    on conflict (token) do update
      set device_id = excluded.device_id, user_id = excluded.user_id, status = 'active',
          last_error = null, invalidated_at = null, updated_at = now();
    delete from push_tokens where device_id = v_device and token <> p_token;
  else
    -- Permission retirée : on ne conserve aucun jeton.
    delete from push_tokens where device_id = v_device;
  end if;
  return v_device;
end $$;

-- À la déconnexion : l'appareil ne doit plus recevoir les alertes de ce compte.
create or replace function public.unregister_device(p_installation_id text)
returns void language sql security definer set search_path = public, extensions as $$
  delete from devices where user_id = auth.uid() and installation_id = p_installation_id;
$$;

-- ───────────────────────────── Créateur ─────────────────────────────
create or replace function public.create_creator_profile(
  p_handle text, p_display_name text, p_category text default 'creator', p_bio text default null)
returns public.creator_profiles language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_handle text := lower(trim(leading '@' from trim(p_handle)));
  v_row creator_profiles;
begin
  if v_handle !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'invalid_handle' using errcode = '22023';
  end if;
  if v_handle = any (array['admin', 'support', 'help', 'api', 'www', 'app', 'login', 'dashboard', 'official',
                           'communitysafe', 'community_safe', 'community.safe', 'sos', 'security', 'legal',
                           'privacy', 'terms', 'about', 'pricing', 'null', 'undefined']) then
    raise exception 'handle_reserved' using errcode = '23505';
  end if;
  if exists (select 1 from creator_profiles where owner_user_id = v_user) then
    raise exception 'creator_already_exists' using errcode = '23505';
  end if;
  if exists (select 1 from creator_profiles where handle = v_handle) then
    raise exception 'handle_taken' using errcode = '23505';
  end if;

  insert into creator_profiles (owner_user_id, handle, display_name, category, bio)
  values (v_user, v_handle, trim(p_display_name), coalesce(nullif(p_category, ''), 'creator'), nullif(trim(p_bio), ''))
  returning * into v_row;

  insert into subscriptions (creator_id, plan_id, status) values (v_row.id, v_row.plan_id, 'active');
  insert into transfer_links (creator_id, source)
  select v_row.id, s from unnest(array['instagram', 'tiktok', 'youtube', 'x', 'whatsapp', 'newsletter', 'qr']) s;
  perform audit('creator.create', 'creator', v_row.id::text, jsonb_build_object('handle', v_handle));
  return v_row;
end $$;

create or replace function public.request_verification(p_method text, p_evidence jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_creator creator_profiles;
  v_id uuid;
begin
  select * into v_creator from creator_profiles where owner_user_id = v_user;
  if v_creator.id is null then raise exception 'creator_not_found' using errcode = 'P0002'; end if;
  if v_creator.verification_status = 'verified' then raise exception 'already_verified'; end if;
  if exists (select 1 from creator_verifications where creator_id = v_creator.id and status = 'pending') then
    raise exception 'verification_already_pending' using errcode = '23505';
  end if;
  insert into creator_verifications (creator_id, method, evidence)
  values (v_creator.id, p_method, coalesce(p_evidence, '{}')) returning id into v_id;
  update creator_profiles set verification_status = 'pending' where id = v_creator.id;
  perform audit('verification.request', 'creator', v_creator.id::text, jsonb_build_object('method', p_method));
  return v_id;
end $$;

-- ───────────────────────────── SOS / annonces ─────────────────────────────
-- Seul point d'entrée pour créer une alerte. Le client ne peut jamais écrire dans `alerts`.
create or replace function public.create_alert(
  p_kind public.alert_kind, p_message text, p_idempotency_key text,
  p_reason text default null, p_link_url text default null)
returns public.alerts language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_creator creator_profiles;
  v_plan plans;
  v_alert alerts;
  v_message text := trim(coalesce(p_message, ''));
  v_link text := nullif(trim(coalesce(p_link_url, '')), '');
  v_link_error text;
  v_count integer;
begin
  select * into v_creator from creator_profiles where owner_user_id = v_user;
  if v_creator.id is null then raise exception 'creator_not_found' using errcode = 'P0002'; end if;
  if v_creator.status <> 'active' then raise exception 'creator_suspended' using errcode = '42501'; end if;

  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  -- Sérialise les envois d'un même créateur (quotas et idempotence sans course).
  perform pg_advisory_xact_lock(hashtext('alert:' || v_creator.id::text));

  select * into v_alert from alerts
   where creator_id = v_creator.id and idempotency_key = p_idempotency_key;
  if v_alert.id is not null then return v_alert; end if;

  if char_length(v_message) = 0 then raise exception 'message_required' using errcode = '22023'; end if;
  if char_length(v_message) > public.setting_int('alert_message_max_length', 280) then
    raise exception 'message_too_long' using errcode = '22023';
  end if;
  v_link_error := public.check_alert_link(v_link);
  if v_link_error is not null then raise exception '%', v_link_error using errcode = '22023'; end if;

  if p_kind = 'test' then
    select count(*) into v_count from alerts
     where creator_id = v_creator.id and kind = 'test' and created_at > now() - interval '24 hours';
    if v_count >= public.setting_int('test_max_per_24h', 10) then
      raise exception 'rate_limited' using errcode = '54000';
    end if;
  else
    -- Règle de confiance : seules les identités vérifiées alertent une communauté.
    if v_creator.verification_status <> 'verified' then
      raise exception 'creator_not_verified' using errcode = '42501';
    end if;
    if not public.has_recent_auth() then
      raise exception 'stepup_required' using errcode = '42501';
    end if;

    if p_kind = 'sos' then
      if p_reason is null then raise exception 'reason_required' using errcode = '22023'; end if;
      select count(*) into v_count from alerts
       where creator_id = v_creator.id and kind = 'sos' and status <> 'blocked'
         and created_at > now() - interval '24 hours';
      if v_count >= public.setting_int('sos_max_per_24h', 3) then
        raise exception 'rate_limited' using errcode = '54000';
      end if;
      select count(*) into v_count from alerts
       where creator_id = v_creator.id and kind = 'sos' and status <> 'blocked'
         and created_at > now() - interval '30 days';
      if v_count >= public.setting_int('sos_max_per_30d', 10) then
        raise exception 'rate_limited' using errcode = '54000';
      end if;
    else
      select * into v_plan from plans where id = v_creator.plan_id;
      if v_plan.member_limit is not null and v_creator.member_count > v_plan.member_limit then
        raise exception 'plan_capacity_exceeded' using errcode = '54000';
      end if;
      select count(*) into v_count from alerts
       where creator_id = v_creator.id and kind = 'announcement' and status <> 'blocked'
         and created_at >= date_trunc('month', now());
      if v_plan.announcements_per_month is not null and v_count >= v_plan.announcements_per_month then
        raise exception 'announcement_quota_exceeded' using errcode = '54000';
      end if;
    end if;
  end if;

  insert into alerts (creator_id, created_by, kind, reason, message, link_url, idempotency_key)
  values (v_creator.id, v_user, p_kind, case when p_kind = 'sos' then p_reason end, v_message, v_link, p_idempotency_key)
  returning * into v_alert;

  -- Diffusion : uniquement les membres ayant autorisé CE type d'alerte.
  if p_kind = 'test' then
    insert into alert_recipients (alert_id, user_id) values (v_alert.id, v_user);
  else
    insert into alert_recipients (alert_id, user_id)
    select v_alert.id, p.user_id
      from notification_preferences p
     where p.creator_id = v_creator.id
       and case when p_kind = 'sos' then p.sos_enabled else p.announcements_enabled end;
  end if;
  get diagnostics v_count = row_count;
  update alerts set recipients_total = v_count where id = v_alert.id returning * into v_alert;

  perform audit('alert.create', 'alert', v_alert.id::text,
    jsonb_build_object('kind', p_kind, 'reason', p_reason, 'recipients', v_count, 'has_link', v_link is not null));
  return v_alert;
end $$;

create or replace function public.mark_alert_opened(p_alert_id uuid, p_link boolean default false)
returns void language sql security definer set search_path = public, extensions as $$
  update alert_recipients
     set opened_at = coalesce(opened_at, now()),
         link_opened_at = case when p_link then coalesce(link_opened_at, now()) else link_opened_at end
   where alert_id = p_alert_id and user_id = auth.uid();
$$;

-- ───────────────────────────── Worker d'envoi (service_role uniquement) ─────────────────────────────
create or replace function public.alerts_to_vet(p_limit integer default 20)
returns table (id uuid, link_url text) language sql security definer set search_path = public, extensions as $$
  select a.id, a.link_url from alerts a where a.status = 'queued' order by a.created_at limit p_limit;
$$;

create or replace function public.vet_alert(p_alert_id uuid, p_ok boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update alerts
     set status = case when p_ok then 'sending' else 'blocked' end::alert_status,
         blocked_reason = case when p_ok then null else p_reason end
   where id = p_alert_id and status = 'queued';
  if found and not p_ok then
    insert into audit_logs (action, target_type, target_id, metadata)
    values ('alert.blocked', 'alert', p_alert_id::text, jsonb_build_object('reason', p_reason));
  end if;
end $$;

-- Réserve un lot de destinataires. SKIP LOCKED : plusieurs workers peuvent tourner sans doublon.
create or replace function public.claim_alert_recipients(p_limit integer default 500)
returns table (
  alert_id uuid, user_id uuid, kind public.alert_kind, creator_name text, creator_handle text,
  message text, locale text, tokens jsonb)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
  with picked as (
    select r.alert_id, r.user_id
      from alert_recipients r
      join alerts a on a.id = r.alert_id
     where r.status = 'pending' and r.next_attempt_at <= now() and a.status = 'sending'
     order by r.next_attempt_at
     limit p_limit
     for update of r skip locked
  ), claimed as (
    update alert_recipients r
       set status = 'processing', locked_at = now(), attempts = r.attempts + 1
      from picked
     where r.alert_id = picked.alert_id and r.user_id = picked.user_id
    returning r.alert_id, r.user_id
  )
  select c.alert_id, c.user_id, a.kind, cp.display_name, cp.handle::text, a.message, u.locale,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', t.id, 'token', t.token))
             from push_tokens t where t.user_id = c.user_id and t.status = 'active'
         ), '[]'::jsonb)
    from claimed c
    join alerts a on a.id = c.alert_id
    join creator_profiles cp on cp.id = a.creator_id
    join users u on u.id = c.user_id;
end $$;

-- p_results : [{alert_id, user_id, retryable, attempts: [{push_token_id, accepted, ticket_id, error_code}]}]
create or replace function public.record_delivery_results(p_results jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
  a jsonb;
  v_any_accepted boolean;
  v_attempts integer;
  v_max integer := public.setting_int('delivery_max_attempts', 5);
begin
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    v_any_accepted := false;
    for a in select * from jsonb_array_elements(coalesce(r -> 'attempts', '[]'::jsonb)) loop
      insert into delivery_attempts (alert_id, user_id, push_token_id, accepted, provider_ticket_id, error_code)
      values ((r ->> 'alert_id')::uuid, (r ->> 'user_id')::uuid, (a ->> 'push_token_id')::uuid,
              coalesce((a ->> 'accepted')::boolean, false), a ->> 'ticket_id', a ->> 'error_code');
      if coalesce((a ->> 'accepted')::boolean, false) then v_any_accepted := true; end if;
      if a ->> 'error_code' = 'DeviceNotRegistered' then
        update push_tokens set status = 'invalid', last_error = 'DeviceNotRegistered',
               invalidated_at = now(), updated_at = now()
         where id = (a ->> 'push_token_id')::uuid;
      end if;
    end loop;

    select attempts into v_attempts from alert_recipients
     where alert_id = (r ->> 'alert_id')::uuid and user_id = (r ->> 'user_id')::uuid;

    update alert_recipients
       set locked_at = null,
           status = case
             when v_any_accepted then 'sent'
             when jsonb_array_length(coalesce(r -> 'attempts', '[]'::jsonb)) = 0 then 'no_device'
             when coalesce((r ->> 'retryable')::boolean, false) and v_attempts < v_max then 'pending'
             else 'failed' end::recipient_status,
           -- Backoff exponentiel : 30 s, 1 min, 2 min, 4 min…
           next_attempt_at = now() + make_interval(secs => 30 * power(2, greatest(v_attempts - 1, 0)))
     where alert_id = (r ->> 'alert_id')::uuid and user_id = (r ->> 'user_id')::uuid
       and status = 'processing';
  end loop;
end $$;

create or replace function public.finalize_alerts()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v_done integer;
begin
  -- Un worker interrompu ne doit pas bloquer ses destinataires.
  update alert_recipients set status = 'pending', locked_at = null
   where status = 'processing' and locked_at < now() - interval '5 minutes';

  update alerts a set status = 'sent', sent_at = now()
   where a.status = 'sending'
     and not exists (select 1 from alert_recipients r
                      where r.alert_id = a.id and r.status in ('pending', 'processing'));
  get diagnostics v_done = row_count;
  return v_done;
end $$;

create or replace function public.pending_receipts(p_limit integer default 1000)
returns table (id bigint, provider_ticket_id text) language sql security definer set search_path = public, extensions as $$
  select d.id, d.provider_ticket_id from delivery_attempts d
   where d.accepted and d.receipt_status is null and d.provider_ticket_id is not null
     and d.created_at between now() - interval '23 hours' and now() - interval '15 minutes'
   order by d.created_at limit p_limit;
$$;

-- p_receipts : [{id, status, error_code}]
create or replace function public.record_receipts(p_receipts jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_receipts, '[]'::jsonb)) loop
    update delivery_attempts
       set receipt_status = r ->> 'status', receipt_checked_at = now(),
           error_code = coalesce(r ->> 'error_code', error_code)
     where id = (r ->> 'id')::bigint;
    if r ->> 'error_code' = 'DeviceNotRegistered' then
      update push_tokens set status = 'invalid', last_error = 'DeviceNotRegistered',
             invalidated_at = now(), updated_at = now()
       where id = (select push_token_id from delivery_attempts where id = (r ->> 'id')::bigint);
    end if;
  end loop;
end $$;

-- ───────────────────────────── Statistiques créateur (agrégats uniquement) ─────────────────────────────
create or replace function public.creator_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_creator creator_profiles;
  v_plan plans;
begin
  select * into v_creator from creator_profiles where owner_user_id = public.require_user();
  if v_creator.id is null then raise exception 'creator_not_found' using errcode = 'P0002'; end if;
  select * into v_plan from plans where id = v_creator.plan_id;

  return jsonb_build_object(
    'members_total', v_creator.member_count,
    'members_today', (select count(*) from community_memberships
                       where creator_id = v_creator.id and created_at >= date_trunc('day', now())),
    'members_week', (select count(*) from community_memberships
                      where creator_id = v_creator.id and created_at >= now() - interval '7 days'),
    'members_month', (select count(*) from community_memberships
                       where creator_id = v_creator.id and created_at >= now() - interval '30 days'),
    -- Trois indicateurs distincts, à ne jamais confondre :
    'members_notifications_allowed', (
      select count(distinct m.user_id) from community_memberships m
        join devices d on d.user_id = m.user_id and d.notifications_permission = 'granted'
       where m.creator_id = v_creator.id),
    'devices_with_valid_token', (
      select count(*) from community_memberships m
        join push_tokens t on t.user_id = m.user_id and t.status = 'active'
       where m.creator_id = v_creator.id),
    'members_sos_enabled', (select count(*) from notification_preferences
                             where creator_id = v_creator.id and sos_enabled),
    'members_announcements_enabled', (select count(*) from notification_preferences
                                       where creator_id = v_creator.id and announcements_enabled),
    'alerts_sent', (select count(*) from alerts
                     where creator_id = v_creator.id and kind <> 'test' and status in ('sending', 'sent')),
    'announcements_this_month', (select count(*) from alerts
                                  where creator_id = v_creator.id and kind = 'announcement'
                                    and status <> 'blocked' and created_at >= date_trunc('month', now())),
    'link_clicks', (select count(*) from link_click_events where creator_id = v_creator.id),
    'clicks_by_source', coalesce((
      select jsonb_object_agg(s, c) from (
        select coalesce(source, 'direct') s, count(*) c from link_click_events
         where creator_id = v_creator.id group by 1) x), '{}'::jsonb),
    'members_by_source', coalesce((
      select jsonb_object_agg(s, c) from (
        select coalesce(source, 'direct') s, count(*) c from community_memberships
         where creator_id = v_creator.id group by 1) x), '{}'::jsonb),
    'growth', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(n, 0)) order by d)
        from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), '1 day') d
        left join (select date_trunc('day', created_at) as d0, count(*) as n from community_memberships
                    where creator_id = v_creator.id and created_at >= now() - interval '31 days'
                    group by 1) g on g.d0 = d), '[]'::jsonb),
    'plan', jsonb_build_object('id', v_plan.id, 'name', v_plan.name, 'member_limit', v_plan.member_limit,
                               'announcements_per_month', v_plan.announcements_per_month)
  );
end $$;

-- Suivi technique d'une alerte : compteurs seulement, jamais d'identité d'abonné.
create or replace function public.alert_delivery_stats(p_alert_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v_alert alerts;
begin
  select * into v_alert from alerts where id = p_alert_id;
  if v_alert.id is null or not (public.owns_creator(v_alert.creator_id) or public.is_admin()) then
    raise exception 'alert_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'status', v_alert.status,
    'blocked_reason', v_alert.blocked_reason,
    'recipients_total', v_alert.recipients_total,
    'pending', (select count(*) from alert_recipients where alert_id = p_alert_id and status in ('pending', 'processing')),
    'accepted_by_provider', (select count(*) from alert_recipients where alert_id = p_alert_id and status = 'sent'),
    'no_device', (select count(*) from alert_recipients where alert_id = p_alert_id and status = 'no_device'),
    'failed', (select count(*) from alert_recipients where alert_id = p_alert_id and status = 'failed'),
    'delivered_to_device', (select count(distinct user_id) from delivery_attempts
                             where alert_id = p_alert_id and receipt_status = 'ok'),
    'opened', (select count(*) from alert_recipients where alert_id = p_alert_id and opened_at is not null),
    'link_opened', (select count(*) from alert_recipients where alert_id = p_alert_id and link_opened_at is not null)
  );
end $$;

-- ───────────────────────────── Administration ─────────────────────────────
create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'users', (select count(*) from users),
    'creators', (select count(*) from creator_profiles),
    'creators_verified', (select count(*) from creator_profiles where verification_status = 'verified'),
    'creators_suspended', (select count(*) from creator_profiles where status = 'suspended'),
    'communities_active', (select count(*) from creator_profiles where member_count > 0),
    'memberships', (select count(*) from community_memberships),
    'users_notifications_allowed', (select count(distinct user_id) from devices where notifications_permission = 'granted'),
    'subscriptions_active', (select count(*) from subscriptions where status = 'active'),
    'revenue_cents', (select coalesce(sum(amount_cents), 0) from payments where status = 'succeeded'),
    'arr_cents', (select coalesce(sum(p.price_cents), 0) from subscriptions s join plans p on p.id = s.plan_id
                   where s.status = 'active' and p.billing_interval = 'year'),
    'alerts_sent', (select count(*) from alerts where kind <> 'test' and status in ('sending', 'sent')),
    'alerts_blocked', (select count(*) from alerts where status = 'blocked'),
    'delivery_errors', (select count(*) from delivery_attempts where not accepted or receipt_status = 'error'),
    'reports_open', (select count(*) from abuse_reports where status = 'open'),
    'verifications_pending', (select count(*) from creator_verifications where status = 'pending')
  );
end $$;

create or replace function public.admin_review_verification(p_verification_id uuid, p_approve boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_creator uuid;
begin
  perform public.require_admin();
  update creator_verifications
     set status = case when p_approve then 'approved' else 'rejected' end,
         notes = p_notes, reviewer_id = auth.uid(), reviewed_at = now()
   where id = p_verification_id and status = 'pending'
  returning creator_id into v_creator;
  if v_creator is null then raise exception 'verification_not_found' using errcode = 'P0002'; end if;
  update creator_profiles
     set verification_status = case when p_approve then 'verified' else 'rejected' end::verification_status
   where id = v_creator;
  perform audit('verification.review', 'creator', v_creator::text, jsonb_build_object('approved', p_approve));
end $$;

create or replace function public.admin_set_creator_status(p_creator_id uuid, p_status public.creator_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  update creator_profiles
     set status = p_status,
         verification_status = case when p_status = 'suspended' then 'unverified' else verification_status end
   where id = p_creator_id;
  if p_status = 'suspended' then
    -- Stoppe immédiatement les envois en cours du compte suspendu.
    update alerts set status = 'blocked', blocked_reason = 'creator_suspended'
     where creator_id = p_creator_id and status in ('queued', 'sending');
  end if;
  perform audit('creator.status', 'creator', p_creator_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_block_alert(p_alert_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  update alerts set status = 'blocked', blocked_reason = coalesce(p_reason, 'admin')
   where id = p_alert_id and status in ('queued', 'sending');
  perform audit('alert.block', 'alert', p_alert_id::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_set_creator_plan(p_creator_id uuid, p_plan_id text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  update creator_profiles set plan_id = p_plan_id where id = p_creator_id;
  update subscriptions set plan_id = p_plan_id, updated_at = now() where creator_id = p_creator_id;
  perform audit('creator.plan', 'creator', p_creator_id::text, jsonb_build_object('plan', p_plan_id));
end $$;

-- ───────────────────────────── RGPD ─────────────────────────────
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v_user uuid := public.require_user();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'user', (select to_jsonb(u) from users u where id = v_user),
    'creator_profile', (select to_jsonb(c) from creator_profiles c where owner_user_id = v_user),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('creator', c.handle, 'since', m.created_at, 'source', m.source,
                                          'sos_enabled', p.sos_enabled, 'announcements_enabled', p.announcements_enabled))
        from community_memberships m
        join creator_profiles c on c.id = m.creator_id
        left join notification_preferences p on p.creator_id = m.creator_id and p.user_id = m.user_id
       where m.user_id = v_user), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'permission', notifications_permission,
                                                              'last_seen_at', last_seen_at))
                           from devices where user_id = v_user), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at)
                            from consent_records c where user_id = v_user), '[]'::jsonb),
    'alerts_received', coalesce((select jsonb_agg(jsonb_build_object('alert_id', alert_id, 'received_at', created_at,
                                                                     'opened_at', opened_at))
                                   from alert_recipients where user_id = v_user), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) - 'reporter_user_id')
                           from abuse_reports r where reporter_user_id = v_user), '[]'::jsonb)
  );
end $$;

-- Droit à l'effacement : supprime le compte et, en cascade, toutes les données liées.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_user uuid := public.require_user();
begin
  -- Un abonnement payant doit d'abord être résilié chez le prestataire de paiement
  -- (la fonction `delete-account` s'en charge), sinon la facturation continuerait.
  if exists (select 1 from subscriptions s join creator_profiles c on c.id = s.creator_id
              where c.owner_user_id = v_user and s.provider is not null and s.provider <> 'manual'
                and s.status in ('active', 'past_due')) then
    raise exception 'cancel_subscription_first' using errcode = '42501';
  end if;
  insert into audit_logs (actor_user_id, action, target_type, target_id)
  values (null, 'user.delete', 'user', md5(v_user::text));  -- trace sans identifiant réutilisable
  delete from auth.users where id = v_user;
end $$;

-- ───────────────────────────── Privilèges d'exécution ─────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_admin(), public.owns_creator(uuid), public.is_alert_recipient(uuid),
  public.setting_int(text, integer), public.setting_bool(text, boolean)
  to anon, authenticated, service_role;

grant execute on function public.record_link_click(text, text) to anon, authenticated;

grant execute on function
  public.follow_creator(text, text),
  public.set_notification_preferences(uuid, boolean, boolean),
  public.register_device(text, text, public.push_permission, text, text, text),
  public.unregister_device(text),
  public.create_creator_profile(text, text, text, text),
  public.request_verification(text, jsonb),
  public.create_alert(public.alert_kind, text, text, text, text),
  public.mark_alert_opened(uuid, boolean),
  public.has_recent_auth(),
  public.check_alert_link(text),
  public.creator_dashboard_stats(),
  public.alert_delivery_stats(uuid),
  public.admin_stats(),
  public.admin_review_verification(uuid, boolean, text),
  public.admin_set_creator_status(uuid, public.creator_status, text),
  public.admin_block_alert(uuid, text),
  public.admin_set_creator_plan(uuid, text),
  public.export_my_data(),
  public.delete_my_account()
  to authenticated;

grant execute on function
  public.alerts_to_vet(integer), public.vet_alert(uuid, boolean, text),
  public.claim_alert_recipients(integer), public.record_delivery_results(jsonb),
  public.finalize_alerts(), public.pending_receipts(integer), public.record_receipts(jsonb)
  to service_role;

-- Compteur de membres en temps réel sur le tableau de bord.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.creator_profiles, public.alerts;
  end if;
end $$;
