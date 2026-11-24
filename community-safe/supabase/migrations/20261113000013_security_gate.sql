-- Interrupteur « sécurité » (phase de démarrage). Réglage app_settings.security_gate :
--   "off" = tout créateur connecté peut envoyer (certification et ré-authentification renforcée masquées) ;
--   "on"  = règles complètes : identité certifiée + ré-authentification renforcée pour envoyer.
-- Rien n'est supprimé : repasser à "on" (admin > Settings, ou SQL) réactive tout immédiatement.
-- Les limites de débit, la vérification des liens et le blocage des alertes restent actifs dans les deux modes.
insert into public.app_settings (key, value) values ('security_gate', '"off"') on conflict (key) do nothing;

create or replace function public.security_gate_on()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select value #>> '{}' from app_settings where key = 'security_gate'), 'on') <> 'off';
$$;
grant execute on function public.security_gate_on() to anon, authenticated, service_role;

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
    if public.security_gate_on() then
      if v_creator.verification_status <> 'verified' then
        raise exception 'creator_not_verified' using errcode = '42501';
      end if;
      if not public.has_strong_recent_auth() then
        raise exception 'stepup_required' using errcode = '42501';
      end if;
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
