-- Certification « Créateur certifié ».
-- Principe : un badge n'est JAMAIS accordé sur un pseudo, une capture d'écran ou une pièce d'identité.
-- Il exige la preuve de contrôle du compte officiel (code unique publié sur le compte), puis :
--   · contrôle automatique quand la plateforme l'autorise officiellement (domaine, YouTube, Twitch) ;
--   · sinon examen humain du profil public par l'administration ;
--   · procédure alternative (échange hors application) si la preuve ne peut pas être publiée.

insert into public.app_settings (key, value) values
  ('certification_auto_platforms', '["website"]'),   -- + "youtube", "twitch" une fois leurs clés API configurées
  ('certification_code_ttl_days', '7'),
  ('certification_max_attempts', '5'),
  ('certification_max_per_day', '3'),
  ('certification_similarity_x100', '55')
on conflict (key) do nothing;

-- Journal des décisions : conservé, sans donnée personnelle de l'abonné.
create table public.certification_events (
  id bigint generated always as identity primary key,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  verification_id uuid references public.creator_verifications (id) on delete set null,
  actor_user_id uuid,                       -- null = le système
  action text not null check (action in (
    'requested', 'code_issued', 'auto_check_passed', 'auto_check_failed', 'sent_to_review', 'alternative_requested',
    'presence_passed', 'presence_failed', 'approved', 'rejected', 'suspended', 'reinstated', 'revoked', 'expired', 'reverification_required', 'owner_transferred')),
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index certification_events_creator_idx on public.certification_events (creator_id, created_at desc);
alter table public.certification_events enable row level security;
revoke all on public.certification_events from anon, authenticated;
grant select on public.certification_events to authenticated;
grant all on public.certification_events to service_role;
create policy cert_events_select on public.certification_events for select to authenticated
  using (public.owns_creator(creator_id) or public.is_admin());

create or replace function public.cert_event(p_creator uuid, p_verification uuid, p_action text, p_reason text default null, p_meta jsonb default '{}')
returns void language sql security definer set search_path = public, extensions as $$
  insert into certification_events (creator_id, verification_id, actor_user_id, action, reason, metadata)
  values (p_creator, p_verification, auth.uid(), p_action, left(p_reason, 500), coalesce(p_meta, '{}'));
  insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'certification.' || p_action, 'creator', p_creator::text, coalesce(p_meta, '{}'));
$$;

-- ───────────── Comptes sociaux : URL validée par plateforme ─────────────
-- Retourne l'identifiant (ou le domaine) si l'URL correspond bien à un profil de cette plateforme.
create or replace function public.parse_social_url(p_platform text, p_url text)
returns text language plpgsql immutable as $$
declare
  v_url text := trim(p_url);
  v_pattern text;
  v_handle text;
begin
  if v_url is null or char_length(v_url) > 200 or v_url !~ '^https://' then return null; end if;
  v_pattern := case p_platform
    when 'instagram' then '^https://(?:www\.)?instagram\.com/([A-Za-z0-9._]{1,30})/?(?:\?.*)?$'
    when 'tiktok'    then '^https://(?:www\.)?tiktok\.com/@([A-Za-z0-9._]{2,24})/?(?:\?.*)?$'
    when 'youtube'   then '^https://(?:www\.)?youtube\.com/@([A-Za-z0-9._-]{3,30})/?(?:\?.*)?$'
    when 'x'         then '^https://(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})/?(?:\?.*)?$'
    when 'twitch'    then '^https://(?:www\.)?twitch\.tv/([A-Za-z0-9_]{4,25})/?(?:\?.*)?$'
    when 'snapchat'  then '^https://(?:www\.)?snapchat\.com/add/([A-Za-z0-9._-]{3,15})/?(?:\?.*)?$'
    when 'facebook'  then '^https://(?:www\.)?facebook\.com/([A-Za-z0-9.]{5,50})/?(?:\?.*)?$'
    when 'website'   then '^https://(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#].*)?$'
    else null end;
  if v_pattern is null then return null; end if;
  v_handle := substring(case when p_platform = 'website' then lower(v_url) else v_url end from v_pattern);
  if p_platform = 'website' and v_handle ~ '(^|\.)(localhost|local|internal|test|example)$' then return null; end if;
  return v_handle;
end $$;

create or replace function public.add_social_account(p_platform text, p_url text)
returns public.social_accounts language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_creator creator_profiles;
  v_handle text;
  v_row social_accounts;
begin
  select * into v_creator from creator_profiles where owner_user_id = v_user;
  if v_creator.id is null then raise exception 'creator_not_found' using errcode = 'P0002'; end if;
  v_handle := public.parse_social_url(p_platform, p_url);
  if v_handle is null then raise exception 'invalid_social_url' using errcode = '22023'; end if;
  if (select count(*) from social_accounts where creator_id = v_creator.id) >= 8 then
    raise exception 'too_many_accounts' using errcode = '54000';
  end if;
  insert into social_accounts (creator_id, platform, handle, url)
  values (v_creator.id, p_platform, v_handle, trim(p_url))
  on conflict (creator_id, platform, handle) do update set url = excluded.url
  returning * into v_row;
  return v_row;
end $$;

-- ───────────── Re-certification automatique après un changement sensible ─────────────
create or replace function public.require_reverification(p_creator uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update creator_profiles set verification_status = 'unverified'
   where id = p_creator and verification_status in ('verified', 'suspended');
  if found then
    update social_accounts set verified_at = null, verified_method = null where creator_id = p_creator;
    update alerts set status = 'blocked', blocked_reason = 'certification_required'
     where creator_id = p_creator and status in ('queued', 'sending');
    perform public.cert_event(p_creator, null, 'reverification_required', p_reason);
  end if;
end $$;

-- Nom public modifié sur un profil certifié → nouvelle vérification (anti-détournement de badge).
create or replace function public.guard_certified_profile()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if old.verification_status in ('verified', 'suspended')
     and (new.display_name is distinct from old.display_name or new.handle is distinct from old.handle) then
    new.verification_status := 'unverified';
    update social_accounts set verified_at = null, verified_method = null where creator_id = old.id;
    insert into certification_events (creator_id, actor_user_id, action, reason)
    values (old.id, auth.uid(), 'reverification_required', 'identity_changed');
  end if;
  return new;
end $$;
create trigger creator_profiles_guard before update on public.creator_profiles
  for each row execute function public.guard_certified_profile();

-- Compte social officiel retiré ou modifié → nouvelle vérification.
create or replace function public.guard_social_account()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if old.verified_at is not null then
    perform public.require_reverification(old.creator_id, 'official_account_changed');
  end if;
  return coalesce(new, old);
end $$;
create trigger social_accounts_guard after delete or update of platform, handle, url on public.social_accounts
  for each row execute function public.guard_social_account();

-- ───────────── Demande de certification ─────────────
create or replace function public.cert_alphabet_code()
returns text language plpgsql volatile as $$
declare
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- sans 0/O/1/I/L : lisible et recopiable
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_out text := '';
begin
  for i in 0..7 loop
    v_out := v_out || substr(v_chars, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return 'CS-' || substr(v_out, 1, 4) || '-' || substr(v_out, 5, 4);
end $$;

create or replace function public.start_certification(p_social_account_id uuid)
returns public.creator_verifications language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := public.require_user();
  v_creator creator_profiles;
  v_account social_accounts;
  v_row creator_verifications;
  v_auto jsonb := coalesce((select value from app_settings where key = 'certification_auto_platforms'), '[]');
  v_method text;
begin
  select * into v_creator from creator_profiles where owner_user_id = v_user for update;
  if v_creator.id is null then raise exception 'creator_not_found' using errcode = 'P0002'; end if;
  if v_creator.status <> 'active' then raise exception 'creator_suspended' using errcode = '42501'; end if;
  if v_creator.verification_status in ('verified', 'suspended') then raise exception 'already_certified' using errcode = '23505'; end if;
  select * into v_account from social_accounts where id = p_social_account_id and creator_id = v_creator.id;
  if v_account.id is null then raise exception 'social_account_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from social_accounts where platform = v_account.platform and lower(handle) = lower(v_account.handle)
              and verified_at is not null and creator_id <> v_creator.id) then
    raise exception 'social_account_taken' using errcode = '23505';
  end if;
  if (select count(*) from creator_verifications where creator_id = v_creator.id and created_at > now() - interval '24 hours')
       >= public.setting_int('certification_max_per_day', 3) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  -- Une seule demande ouverte : la précédente est annulée et son code effacé.
  update creator_verifications set status = 'cancelled', code = null, decided_at = now()
   where creator_id = v_creator.id and status in ('awaiting_proof', 'in_review');

  v_method := case
    when v_account.platform = 'website' and v_auto ? 'website' then 'auto_domain'
    when v_account.platform = 'youtube' and v_auto ? 'youtube' then 'auto_youtube'
    when v_account.platform = 'twitch' and v_auto ? 'twitch' then 'auto_twitch'
    else 'manual_social' end;

  insert into creator_verifications (creator_id, social_account_id, method, code, code_expires_at, max_attempts)
  values (v_creator.id, v_account.id, v_method, public.cert_alphabet_code(),
          now() + make_interval(days => public.setting_int('certification_code_ttl_days', 7)),
          public.setting_int('certification_max_attempts', 5))
  returning * into v_row;
  update creator_profiles set verification_status = 'pending' where id = v_creator.id;
  perform public.cert_event(v_creator.id, v_row.id, 'code_issued', null,
    jsonb_build_object('method', v_method, 'platform', v_account.platform));
  return v_row;
end $$;

-- La présence (contrôle vidéo du vivant) doit avoir réussi, et être récente, avant toute preuve d'identité.
create or replace function public.cert_presence_ok(p_verification_id uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select presence_status = 'passed' and presence_expires_at > now() from creator_verifications where id = p_verification_id), false);
$$;

-- Résultat du contrôle vidéo, envoyé par le prestataire (webhook signé, service_role uniquement).
create or replace function public.record_presence_result(p_verification_id uuid, p_passed boolean, p_provider text, p_ref text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_row creator_verifications;
begin
  select * into v_row from creator_verifications where id = p_verification_id for update;
  if v_row.id is null or v_row.status <> 'awaiting_proof' or v_row.presence_status = 'passed' then
    return coalesce(v_row.presence_status, 'not_found');
  end if;
  update creator_verifications
     set presence_attempts = presence_attempts + 1, presence_provider = left(p_provider, 40), presence_ref = left(p_ref, 120),
         presence_checked_at = now(),
         presence_status = case when p_passed then 'passed' else 'failed' end,
         presence_expires_at = case when p_passed then now() + interval '24 hours' end
   where id = v_row.id returning * into v_row;
  perform public.cert_event(v_row.creator_id, v_row.id, case when p_passed then 'presence_passed' else 'presence_failed' end,
    null, jsonb_build_object('provider', p_provider, 'attempt', v_row.presence_attempts));
  if not p_passed and v_row.presence_attempts >= 3 then
    update creator_verifications set status = 'failed', code = null, decided_at = now() where id = v_row.id;
    update creator_profiles set verification_status = 'unverified' where id = v_row.creator_id and verification_status = 'pending';
    return 'failed';
  end if;
  return case when p_passed then 'passed' else 'failed' end;
end $$;

-- « J'ai publié le code » pour les plateformes sans contrôle automatique → examen humain.
create or replace function public.request_certification_review(p_verification_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_row creator_verifications;
begin
  select v.* into v_row from creator_verifications v join creator_profiles c on c.id = v.creator_id
   where v.id = p_verification_id and c.owner_user_id = public.require_user() for update of v;
  if v_row.id is null then raise exception 'verification_not_found' using errcode = 'P0002'; end if;
  if v_row.status <> 'awaiting_proof' then raise exception 'verification_not_open' using errcode = '22023'; end if;
  if v_row.code_expires_at < now() then raise exception 'code_expired' using errcode = '22023'; end if;
  if not public.cert_presence_ok(v_row.id) then raise exception 'presence_required' using errcode = '22023'; end if;
  if v_row.method not in ('manual_social', 'manual_alt') then raise exception 'use_automatic_check' using errcode = '22023'; end if;
  update creator_verifications set status = 'in_review',
         risk_flags = public.cert_risk_flags(v_row.creator_id, v_row.social_account_id) where id = v_row.id;
  perform public.cert_event(v_row.creator_id, v_row.id, 'sent_to_review');
end $$;

-- Procédure alternative : le code ne peut pas être publié (compte privé, plateforme fermée…).
-- Aucun document n'est téléversé ici : l'équipe organise un échange sécurisé hors application.
create or replace function public.request_alternative_certification(p_verification_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_row creator_verifications;
begin
  select v.* into v_row from creator_verifications v join creator_profiles c on c.id = v.creator_id
   where v.id = p_verification_id and c.owner_user_id = public.require_user() for update of v;
  if v_row.id is null then raise exception 'verification_not_found' using errcode = 'P0002'; end if;
  if v_row.status not in ('awaiting_proof', 'failed', 'expired') then raise exception 'verification_not_open' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 10 then raise exception 'note_required' using errcode = '22023'; end if;
  if not public.cert_presence_ok(v_row.id) then raise exception 'presence_required' using errcode = '22023'; end if;
  update creator_verifications set method = 'manual_alt', status = 'in_review', note = left(trim(p_note), 500),
         risk_flags = public.cert_risk_flags(v_row.creator_id, v_row.social_account_id) where id = v_row.id;
  perform public.cert_event(v_row.creator_id, v_row.id, 'alternative_requested');
end $$;

-- Signaux de risque : nom ou pseudo trop proche d'un créateur déjà certifié → examen humain obligatoire.
create or replace function public.cert_risk_flags(p_creator uuid, p_account uuid)
returns text[] language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_thr real := (public.setting_int('certification_similarity_x100', 55)::real) / 100;
  v_me creator_profiles;
  v_flags text[] := '{}';
begin
  select * into v_me from creator_profiles where id = p_creator;
  if exists (select 1 from creator_profiles o
              where o.id <> p_creator and o.verification_status in ('verified', 'suspended')
                and (similarity(o.display_name, v_me.display_name) >= v_thr or similarity(o.handle::text, v_me.handle::text) >= v_thr)) then
    v_flags := array_append(v_flags, 'similar_name');
  end if;
  if (select count(*) from creator_profiles where created_at > now() - interval '1 hour') > 50 then
    v_flags := array_append(v_flags, 'signup_burst');
  end if;
  return v_flags;
end $$;

-- ───────────── Contrôle automatique (appelé par la fonction `certify`, service_role) ─────────────
-- Retourne l'état de la demande après contrôle.
create or replace function public.record_auto_check(p_verification_id uuid, p_found boolean, p_source text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row creator_verifications;
  v_flags text[];
begin
  select * into v_row from creator_verifications where id = p_verification_id for update;
  if v_row.id is null or v_row.status <> 'awaiting_proof' or v_row.method not like 'auto_%' then return coalesce(v_row.status, 'not_found'); end if;
  if not public.cert_presence_ok(v_row.id) then return 'presence_required'; end if;
  if v_row.code_expires_at < now() then
    update creator_verifications set status = 'expired', code = null, decided_at = now() where id = v_row.id;
    perform public.cert_event(v_row.creator_id, v_row.id, 'expired');
    update creator_profiles set verification_status = 'unverified' where id = v_row.creator_id and verification_status = 'pending';
    return 'expired';
  end if;

  update creator_verifications set attempts = attempts + 1, last_checked_at = now() where id = v_row.id
  returning * into v_row;

  if not p_found then
    perform public.cert_event(v_row.creator_id, v_row.id, 'auto_check_failed', null, jsonb_build_object('source', p_source, 'attempt', v_row.attempts));
    if v_row.attempts >= v_row.max_attempts then
      update creator_verifications set status = 'failed', code = null, decided_at = now() where id = v_row.id;
      update creator_profiles set verification_status = 'unverified' where id = v_row.creator_id and verification_status = 'pending';
      return 'failed';
    end if;
    return 'awaiting_proof';
  end if;

  perform public.cert_event(v_row.creator_id, v_row.id, 'auto_check_passed', null, jsonb_build_object('source', p_source));
  v_flags := public.cert_risk_flags(v_row.creator_id, v_row.social_account_id);
  if array_length(v_flags, 1) is not null then
    -- Preuve de contrôle valide, mais risque d'usurpation : un humain décide.
    update creator_verifications set status = 'in_review', risk_flags = v_flags,
           evidence = jsonb_build_object('source', p_source, 'checked_at', now()) where id = v_row.id;
    perform public.cert_event(v_row.creator_id, v_row.id, 'sent_to_review', 'risk:' || array_to_string(v_flags, ','));
    return 'in_review';
  end if;
  perform public.cert_approve(v_row.id, null, 'automatic:' || p_source);
  return 'approved';
end $$;

-- Validation (automatique ou humaine). Efface le code : on ne garde que la décision.
create or replace function public.cert_approve(p_verification_id uuid, p_reviewer uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_row creator_verifications;
begin
  -- Le badge exige les DEUX validations : présence vérifiée ET identité reliée. Jamais l'une sans l'autre.
  if not public.cert_presence_ok(p_verification_id) then raise exception 'presence_required' using errcode = '22023'; end if;
  update creator_verifications
     set status = 'approved', code = null, reviewer_id = p_reviewer, decided_at = now(), decision_reason = left(p_reason, 500),
         evidence = evidence || jsonb_build_object('approved_at', now())
   where id = p_verification_id and status in ('awaiting_proof', 'in_review') returning * into v_row;
  if v_row.id is null then raise exception 'verification_not_found' using errcode = 'P0002'; end if;
  update creator_profiles set verification_status = 'verified' where id = v_row.creator_id;
  update social_accounts set verified_at = now(), verified_method = v_row.method where id = v_row.social_account_id;
  perform public.cert_event(v_row.creator_id, v_row.id, 'approved', p_reason, jsonb_build_object('method', v_row.method));
end $$;

-- ───────────── Administration ─────────────
create or replace function public.admin_review_certification(p_verification_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_row creator_verifications;
begin
  perform public.require_admin();
  select * into v_row from creator_verifications where id = p_verification_id for update;
  if v_row.id is null or v_row.status <> 'in_review' then raise exception 'verification_not_found' using errcode = 'P0002'; end if;
  if p_approve then
    -- Un signal de risque (nom proche d'un créateur certifié…) exige une justification écrite.
    if array_length(v_row.risk_flags, 1) is not null and char_length(trim(coalesce(p_reason, ''))) < 10 then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    perform public.cert_approve(v_row.id, auth.uid(), coalesce(p_reason, 'reviewed'));
  else
    if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
    update creator_verifications set status = 'rejected', code = null, reviewer_id = auth.uid(), decided_at = now(), decision_reason = left(p_reason, 500)
     where id = v_row.id;
    update creator_profiles set verification_status = 'rejected' where id = v_row.creator_id;
    perform public.cert_event(v_row.creator_id, v_row.id, 'rejected', p_reason);
  end if;
end $$;

create or replace function public.admin_suspend_certification(p_creator_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  update creator_profiles set verification_status = 'suspended' where id = p_creator_id and verification_status = 'verified';
  if not found then raise exception 'not_certified' using errcode = 'P0002'; end if;
  update alerts set status = 'blocked', blocked_reason = 'certification_suspended' where creator_id = p_creator_id and status in ('queued', 'sending');
  perform public.cert_event(p_creator_id, null, 'suspended', p_reason);
end $$;

create or replace function public.admin_reinstate_certification(p_creator_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  update creator_profiles set verification_status = 'verified' where id = p_creator_id and verification_status = 'suspended';
  if not found then raise exception 'not_suspended' using errcode = 'P0002'; end if;
  perform public.cert_event(p_creator_id, null, 'reinstated', p_reason);
end $$;

create or replace function public.admin_revoke_certification(p_creator_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  update creator_profiles set verification_status = 'revoked' where id = p_creator_id and verification_status in ('verified', 'suspended');
  if not found then raise exception 'not_certified' using errcode = 'P0002'; end if;
  update social_accounts set verified_at = null, verified_method = null where creator_id = p_creator_id;
  update creator_verifications set status = 'revoked' where creator_id = p_creator_id and status = 'approved';
  update alerts set status = 'blocked', blocked_reason = 'certification_revoked' where creator_id = p_creator_id and status in ('queued', 'sending');
  perform public.cert_event(p_creator_id, null, 'revoked', p_reason);
end $$;

-- Changement de propriétaire : la certification est retirée, le nouveau propriétaire doit se faire certifier.
create or replace function public.admin_transfer_owner(p_creator_id uuid, p_new_owner uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  update creator_profiles set owner_user_id = p_new_owner where id = p_creator_id;
  perform public.cert_event(p_creator_id, null, 'owner_transferred', p_reason);
  perform public.require_reverification(p_creator_id, 'owner_changed');
end $$;

-- ───────────── Authentification renforcée du SOS ─────────────
-- Le SOS exige une preuve d'identité récente MÊME après certification. Si le créateur a activé une
-- application d'authentification (TOTP), c'est elle qui est exigée ; sinon, un code e-mail récent.
create or replace function public.has_strong_recent_auth()
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_window integer := public.setting_int('stepup_max_age_minutes', 10) * 60;
  v_totp boolean;
  v_last bigint;
begin
  select exists (select 1 from auth.mfa_factors where user_id = auth.uid() and factor_type = 'totp' and status = 'verified') into v_totp;
  if not v_totp then return public.has_recent_auth(); end if;
  select max((e ->> 'timestamp')::bigint) into v_last
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e where e ->> 'method' = 'totp';
  return coalesce(v_last, 0) >= extract(epoch from now()) - v_window and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
end $$;

create or replace function public.has_totp_factor()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from auth.mfa_factors where user_id = auth.uid() and factor_type = 'totp' and status = 'verified');
$$;

-- ───────────── Minimisation (RGPD) ─────────────
-- Codes expirés effacés ; demandes closes et journaux de refus purgés après un an.
create or replace function public.purge_certification_data()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v_n integer;
begin
  update creator_verifications set status = 'expired', code = null, decided_at = now()
   where status = 'awaiting_proof' and code_expires_at < now();
  get diagnostics v_n = row_count;
  update creator_profiles c set verification_status = 'unverified'
   where verification_status = 'pending' and not exists (select 1 from creator_verifications v where v.creator_id = c.id and v.status in ('awaiting_proof', 'in_review'));
  delete from creator_verifications where status in ('rejected', 'expired', 'failed', 'cancelled') and coalesce(decided_at, created_at) < now() - interval '12 months';
  update creator_verifications set note = null where status <> 'in_review' and note is not null and coalesce(decided_at, created_at) < now() - interval '90 days';
  return v_n;
end $$;

-- ───────────── Privilèges ─────────────
revoke execute on function
  public.cert_event(uuid, uuid, text, text, jsonb), public.parse_social_url(text, text), public.add_social_account(text, text),
  public.require_reverification(uuid, text), public.guard_certified_profile(), public.guard_social_account(),
  public.cert_alphabet_code(), public.start_certification(uuid), public.request_certification_review(uuid),
  public.request_alternative_certification(uuid, text), public.cert_risk_flags(uuid, uuid),
  public.record_auto_check(uuid, boolean, text), public.cert_approve(uuid, uuid, text), public.cert_presence_ok(uuid), public.record_presence_result(uuid, boolean, text, text),
  public.admin_review_certification(uuid, boolean, text), public.admin_suspend_certification(uuid, text),
  public.admin_reinstate_certification(uuid, text), public.admin_revoke_certification(uuid, text),
  public.admin_transfer_owner(uuid, uuid, text), public.has_strong_recent_auth(), public.has_totp_factor(),
  public.purge_certification_data() from public, anon, authenticated;
grant execute on function
  public.parse_social_url(text, text), public.add_social_account(text, text), public.start_certification(uuid),
  public.request_certification_review(uuid), public.request_alternative_certification(uuid, text),
  public.admin_review_certification(uuid, boolean, text), public.admin_suspend_certification(uuid, text),
  public.admin_reinstate_certification(uuid, text), public.admin_revoke_certification(uuid, text),
  public.admin_transfer_owner(uuid, uuid, text), public.has_strong_recent_auth(), public.has_totp_factor() to authenticated;
grant execute on function public.record_auto_check(uuid, boolean, text), public.record_presence_result(uuid, boolean, text, text), public.purge_certification_data() to service_role;
