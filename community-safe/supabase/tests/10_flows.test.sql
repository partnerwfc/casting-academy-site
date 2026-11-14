-- Tests de bout en bout : parcours abonné, parcours créateur, permissions, file d'envoi.
\set QUIET on
create schema t;
\o /dev/null
create function t.login(p_user uuid, p_auth_age_seconds integer default 0, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'aal', p_aal,
    'amr', json_build_array(json_build_object('method', 'otp',
           'timestamp', extract(epoch from now())::bigint - p_auth_age_seconds)))::text, false);
end $$;
create function t.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  perform set_config('role', 'postgres', false);
end $$;
-- Vérifie qu'une instruction échoue avec le message attendu.
create function t.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_like then
      raise exception 'TEST: attendu "%", obtenu "%" pour: %', p_like, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'TEST: aurait dû échouer (%): %', p_like, p_sql;
end $$;
create function t.presence(p_id uuid, p_passed boolean default true) returns text language sql security definer as
  $$ select public.record_presence_result(p_id, p_passed, 'test-provider', 'ref-' || p_id) $$;
create function t.eq(p_got anycompatible, p_want anycompatible, p_label text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'TEST %: attendu %, obtenu %', p_label, p_want, p_got;
  end if;
end $$;
grant usage on schema t to authenticated, anon, service_role;
grant execute on all functions in schema t to authenticated, anon, service_role;

-- Jeu de données : 1 créatrice, 1 imposteur, 3 abonnés, 1 admin.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'julie@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'fake@example.com'),
  ('00000000-0000-0000-0000-000000000001', 'fan1@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'fan2@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'fan3@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
select t.eq((select count(*) from public.users), 6::bigint, 'trigger handle_new_user');
insert into admin_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000ad', 'admin');

-- ── Créateur : création de profil ──
select t.login('00000000-0000-0000-0000-00000000000a');
select t.expect_error($$select create_creator_profile('admin', 'X')$$, 'handle_reserved');
select t.expect_error($$select create_creator_profile('a b', 'X')$$, 'invalid_handle');
select (create_creator_profile('@Julie', 'Julie')).handle \gset julie_
select t.eq(:'julie_handle', 'julie', 'handle normalisé');
select t.expect_error($$select create_creator_profile('julie2', 'X')$$, 'creator_already_exists');
select id as julie_id from creator_profiles where handle = 'julie' \gset
-- Un créateur ne peut pas s'auto-vérifier ni changer de forfait.
select t.expect_error($$update creator_profiles set verification_status = 'verified'$$, 'permission denied%');
select t.expect_error($$update creator_profiles set plan_id = 'pro'$$, 'permission denied%');
select t.expect_error($$insert into alerts (creator_id, kind, message, idempotency_key)
  select id, 'test', 'x', 'direct-insert' from creator_profiles$$, 'permission denied%');

select t.login('00000000-0000-0000-0000-00000000000b');
select t.expect_error($$select create_creator_profile('JULIE', 'Fausse Julie')$$, 'handle_taken');
select create_creator_profile('julie.officiel', 'Julie') is not null as ok \gset
update creator_profiles set display_name = 'Pirate' where handle = 'julie';
select t.eq((select display_name from creator_profiles where handle = 'julie'), 'Julie', 'RLS update créateur tiers');

-- ── Abonnés : suivi et préférences ──
select t.login('00000000-0000-0000-0000-000000000001');
select follow_creator('@julie', 'instagram') is not null as ok \gset
select follow_creator('julie') is not null as ok \gset
select t.eq((select member_count from creator_profiles where handle = 'julie'), 1, 'compteur après double suivi');
select t.eq((select sos_enabled from notification_preferences), true, 'SOS par défaut');
select t.eq((select announcements_enabled from notification_preferences), false, 'annonces en opt-in');
select register_device('install-fan1-ios', 'ios', 'granted', 'ExponentPushToken[fan1tokenAAAA]') is not null as ok \gset
select t.expect_error($$select register_device('install-fan1-bad', 'ios', 'granted', 'not-a-token')$$, 'invalid_push_token');

select t.login('00000000-0000-0000-0000-000000000002');
select follow_creator('julie', 'qr') is not null as ok \gset
select set_notification_preferences(:'julie_id', true, true);
select register_device('install-fan2-android', 'android', 'granted', 'ExponentPushToken[fan2tokenBBBB]') is not null as ok \gset
select t.eq((select count(*) from community_memberships), 1::bigint, 'RLS: je ne vois que mes suivis');
select t.eq((select count(*) from push_tokens), 1::bigint, 'RLS: je ne vois que mes jetons');

select t.login('00000000-0000-0000-0000-000000000003');
select follow_creator('julie') is not null as ok \gset
select set_notification_preferences(:'julie_id', false, false);   -- tout désactivé
select register_device('install-fan3-ios', 'ios', 'denied') is not null as ok \gset

-- Anonyme : profil public visible, données privées invisibles, clic comptabilisé.
select t.logout();
set role anon;
select t.eq((select count(*) from creator_profiles where handle = 'julie'), 1::bigint, 'profil public');
select t.expect_error($$select * from community_memberships$$, 'permission denied%');
select t.expect_error($$select * from users$$, 'permission denied%');
select t.expect_error($$select follow_creator('julie')$$, 'permission denied%');
select record_link_click('julie', 'instagram');
select record_link_click('julie', '<script>');

-- ── Créateur : SOS ──
select t.login('00000000-0000-0000-0000-00000000000a');
select t.eq((select count(*) from community_memberships), 0::bigint, 'le créateur ne voit pas ses membres');
select t.eq((creator_dashboard_stats() ->> 'members_total')::int, 3, 'stats: membres');
select t.eq((creator_dashboard_stats() ->> 'members_notifications_allowed')::int, 2, 'stats: notifications autorisées');
select t.eq((creator_dashboard_stats() ->> 'devices_with_valid_token')::int, 2, 'stats: jetons valides');
select t.eq((creator_dashboard_stats() ->> 'link_clicks')::int, 2, 'stats: clics');
select t.expect_error($$select create_alert('sos', 'Compte piraté', 'key-sos-00001', 'hacked')$$, 'creator_not_verified');
-- Certification : URL validée, code unique, examen humain (Instagram n'a pas de contrôle automatique).
select t.expect_error($$select add_social_account('instagram', 'http://instagram.com/julie')$$, 'invalid_social_url');
select t.expect_error($$select add_social_account('instagram', 'https://evil.example/instagram.com/julie')$$, 'invalid_social_url');
select t.expect_error($$select add_social_account('tiktok', 'https://instagram.com/julie')$$, 'invalid_social_url');
select (add_social_account('instagram', 'https://www.instagram.com/julie.officiel/')).id as acct_id \gset
select t.eq((select handle from social_accounts where id = :'acct_id'), 'julie.officiel', 'identifiant extrait de l''URL');
select t.expect_error($$update social_accounts set verified_at = now()$$, 'permission denied%');
select t.expect_error($$insert into social_accounts (creator_id, platform, handle) select id, 'x', 'julie' from creator_profiles$$, 'permission denied%');
select (start_certification(:'acct_id')).id as verif_id \gset
select t.eq((select code ~ '^CS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' from creator_verifications where id = :'verif_id'), true, 'code unique lisible');
select t.eq((select method from creator_verifications where id = :'verif_id'), 'manual_social', 'Instagram : contrôle manuel');
select t.eq((select verification_status::text from creator_profiles where handle = 'julie'), 'pending', 'demande en cours');
select t.expect_error(format($$select request_alternative_certification(%L, 'court')$$, :'verif_id'), 'note_required');
select t.expect_error(format($$select request_certification_review(%L)$$, :'verif_id'), 'presence_required');   -- pas d'examen sans contrôle vidéo
select t.eq(t.presence(:'verif_id', false), 'failed', 'contrôle vidéo échoué');
select t.expect_error(format($$select request_certification_review(%L)$$, :'verif_id'), 'presence_required');
select t.eq(t.presence(:'verif_id'), 'passed', 'présence vérifiée');
select request_certification_review(:'verif_id');
select t.eq((select status from creator_verifications where id = :'verif_id'), 'in_review', 'envoyée à l''examen');
select t.expect_error($$select start_certification(gen_random_uuid())$$, 'social_account_not_found');
-- Alerte de test possible avant vérification, vers soi uniquement.
select (create_alert('test', 'Ceci est un test', 'key-test-0001')).recipients_total as n \gset
select t.eq(:n, 1, 'test: destinataire unique');
select t.expect_error(format($$select admin_review_certification(%L, true)$$, :'verif_id'), 'forbidden');

-- Admin : MFA obligatoire.
select t.login('00000000-0000-0000-0000-0000000000ad', 0, 'aal1');
select t.expect_error($$select admin_stats()$$, 'forbidden');
select t.login('00000000-0000-0000-0000-0000000000ad', 0, 'aal2');
select t.expect_error(format($$select admin_review_certification(%L, false)$$, :'verif_id'), 'reason_required');
select admin_review_certification(:'verif_id', true, 'profil public consulté, code présent dans la bio');
select t.eq((select code is null from creator_verifications where id = :'verif_id'), true, 'code effacé après décision');
select t.eq((select verified_at is not null from social_accounts where id = :'acct_id'), true, 'compte social certifié');
select t.eq((select count(*) from certification_events where action in ('code_issued','presence_failed','presence_passed','sent_to_review','approved')), 5::bigint, 'décisions journalisées');
select t.eq((admin_stats() ->> 'creators_verified')::int, 1, 'admin: créateurs vérifiés');

-- Session trop ancienne → vérification renforcée exigée.
select t.login('00000000-0000-0000-0000-00000000000a', 3600);
select t.expect_error($$select create_alert('sos', 'Compte piraté', 'key-sos-00001', 'hacked')$$, 'stepup_required');
select t.login('00000000-0000-0000-0000-00000000000a', 30);
select t.expect_error($$select create_alert('sos', 'x', 'key-sos-00001', 'hacked', 'http://evil.example')$$, 'link_not_https');
select t.expect_error($$select create_alert('sos', 'x', 'key-sos-00001', 'hacked', 'https://192.168.1.1/x')$$, 'link_invalid_host');
select t.expect_error($$select create_alert('sos', 'x', 'key-sos-00001', 'hacked', 'https://instagram.com@evil.example/x')$$, 'link_invalid_host');
select t.expect_error($$select create_alert('sos', 'x', 'key-sos-00001', 'hacked', 'https://bit.ly/abc')$$, 'link_blocked_domain');
select t.expect_error($$select create_alert('sos', 'x', 'key-sos-00001', 'hacked', 'https://xn--nstagram-9ib.com')$$, 'link_punycode');
select t.expect_error($$select create_alert('sos', 'x', 'key-sos-00001')$$, 'reason_required');
select t.expect_error(format($$select create_alert('sos', %L, 'key-sos-00001', 'hacked')$$, repeat('a', 281)), 'message_too_long');

select (create_alert('sos', 'Mon Instagram est piraté. Retrouvez-moi ici.', 'key-sos-00001', 'hacked', 'https://t.me/julie')).id as sos_id \gset
select (create_alert('sos', 'doublon', 'key-sos-00001', 'hacked')).id as sos_id2 \gset
select t.eq(:'sos_id2', :'sos_id', 'idempotence');
select t.eq((select recipients_total from alerts where id = :'sos_id'), 2, 'SOS: fan3 a désactivé les SOS');

-- Annonce : seuls les opt-in, quota Starter = 1 / mois.
select (create_alert('announcement', 'Nouvelle chaîne !', 'key-ann-00001')).recipients_total as n \gset
select t.eq(:n, 1, 'annonce: opt-in uniquement');
select t.expect_error($$select create_alert('announcement', 'Encore', 'key-ann-00002')$$, 'announcement_quota_exceeded');
-- Limite SOS : 3 / 24 h.
select create_alert('sos', 'SOS 2', 'key-sos-00002', 'other') is not null as ok \gset
select create_alert('sos', 'SOS 3', 'key-sos-00003', 'other') is not null as ok \gset
select t.expect_error($$select create_alert('sos', 'SOS 4', 'key-sos-00004', 'other')$$, 'rate_limited');
-- Le worker n'est pas appelable par un utilisateur.
select t.expect_error($$select * from claim_alert_recipients(10)$$, 'permission denied%');
select t.expect_error($$select vet_alert(gen_random_uuid(), true)$$, 'permission denied%');

-- L'imposteur non vérifié ne peut rien envoyer.
select t.login('00000000-0000-0000-0000-00000000000b', 0);
select t.expect_error($$select create_alert('sos', 'Arnaque', 'key-fake-0001', 'hacked')$$, 'creator_not_verified');

-- Tant que l'alerte n'est pas validée, l'abonné ne la voit pas.
select t.login('00000000-0000-0000-0000-000000000001');
select t.eq((select count(*) from alerts), 0::bigint, 'alerte en file invisible');

-- ── Worker (service_role) ──
select t.logout();
set role service_role;
select t.eq((select count(*) from alerts_to_vet()), 5::bigint, 'alertes à contrôler');
select t.eq((select count(*) from claim_alert_recipients(100)), 0::bigint, 'rien à envoyer avant contrôle');
select vet_alert(id, true) from alerts_to_vet();
create temp table claimed as select * from claim_alert_recipients(100);
grant all on claimed to public;
select t.eq((select count(*) from claimed), 8::bigint, 'destinataires réservés');
select t.eq((select count(*) from claim_alert_recipients(100)), 0::bigint, 'pas de double réservation');
select t.eq((select jsonb_array_length(tokens) from claimed
  where alert_id = :'sos_id' and user_id = '00000000-0000-0000-0000-000000000001'), 1, 'jeton joint');
-- fan1 : accepté ; fan2 : jeton invalide ; créatrice (test) : aucun appareil ; reste : erreur réessayable.
select record_delivery_results((
  select jsonb_agg(jsonb_build_object(
    'alert_id', alert_id, 'user_id', user_id,
    'retryable', user_id not in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
    'attempts', (select coalesce(jsonb_agg(jsonb_build_object(
        'push_token_id', t ->> 'id',
        'accepted', user_id = '00000000-0000-0000-0000-000000000001',
        'ticket_id', case when user_id = '00000000-0000-0000-0000-000000000001' then 'ticket-' || alert_id end,
        'error_code', case when user_id = '00000000-0000-0000-0000-000000000002' then 'DeviceNotRegistered' end)), '[]')
      from jsonb_array_elements(tokens) t)))
  from claimed));
select t.eq((select status::text from alert_recipients where alert_id = :'sos_id'
  and user_id = '00000000-0000-0000-0000-000000000001'), 'sent', 'fan1 envoyé');
select t.eq((select status::text from alert_recipients where alert_id = :'sos_id'
  and user_id = '00000000-0000-0000-0000-000000000002'), 'failed', 'fan2 échec définitif');
select t.eq((select status from push_tokens where token like '%fan2%'), 'invalid', 'jeton invalide désactivé');
select t.eq((select status::text from alert_recipients where user_id = '00000000-0000-0000-0000-00000000000a'), 'no_device', 'aucun appareil');
select finalize_alerts() as finalized \gset
select t.eq(:finalized, 5, 'alertes finalisées');

-- ── Abonné : boîte de réception ──
select t.login('00000000-0000-0000-0000-000000000001');
select t.eq((select count(*) from alerts), 3::bigint, 'fan1 voit ses 3 SOS');
select mark_alert_opened(:'sos_id', true);
select t.login('00000000-0000-0000-0000-000000000003');
select t.eq((select count(*) from alerts), 0::bigint, 'fan3 (SOS désactivés) ne voit rien');

select t.login('00000000-0000-0000-0000-00000000000a');
select t.eq((alert_delivery_stats(:'sos_id') ->> 'accepted_by_provider')::int, 1, 'suivi: acceptés');
select t.eq((alert_delivery_stats(:'sos_id') ->> 'opened')::int, 1, 'suivi: ouverts');
select t.login('00000000-0000-0000-0000-00000000000b');
select t.expect_error(format($$select alert_delivery_stats(%L)$$, :'sos_id'), 'alert_not_found');

-- ── Suspension par l'admin ──
select t.login('00000000-0000-0000-0000-0000000000ad', 0, 'aal2');
select admin_set_creator_status((select id from creator_profiles where handle = 'julie.officiel'), 'suspended', 'usurpation');
select t.logout();
set role anon;
select t.eq((select count(*) from creator_profiles where handle = 'julie.officiel'), 0::bigint, 'profil suspendu masqué');

-- ── RGPD ──
select t.login('00000000-0000-0000-0000-000000000001');
select t.eq(jsonb_array_length(export_my_data() -> 'memberships'), 1, 'export des données');
delete from community_memberships where creator_id = :'julie_id';
select t.eq((select count(*) from notification_preferences), 0::bigint, 'désabonnement supprime les préférences');
select delete_my_account();
select t.logout();
select t.eq((select count(*) from public.users where id = '00000000-0000-0000-0000-000000000001'), 0::bigint, 'compte supprimé');
select t.eq((select member_count from creator_profiles where handle = 'julie'), 2, 'compteur après départs');

select t.login('00000000-0000-0000-0000-00000000000a', 30);
select t.eq((select plan_id from creator_profiles where handle = 'julie'), 'discovery', 'forfait gratuit par défaut');
select t.expect_error($$update creator_profiles set plan_id = 'premium'$$, 'permission denied%');
select t.expect_error($$update subscriptions set plan_id = 'premium'$$, 'permission denied%');
select t.expect_error($$select apply_subscription_event('{"status":"active","plan_id":"premium"}')$$, 'permission denied%');
select request_quote('Plus de 500 000 membres') is not null as ok \gset
select t.expect_error($$select request_quote()$$, 'quote_already_requested');
select t.logout();
set role service_role;
select t.eq(apply_subscription_event(jsonb_build_object('creator_id', :'julie_id', 'customer_id', 'cus_1', 'subscription_id', 'sub_1',
  'plan_id', 'creator', 'status', 'active', 'current_period_end', '2027-11-13T00:00:00Z',
  'payment', jsonb_build_object('id', 'in_1', 'amount_cents', 2999, 'tax_cents', 500, 'currency', 'eur', 'status', 'succeeded'))), 'applied', 'abonnement activé');
select apply_subscription_event(jsonb_build_object('customer_id', 'cus_1', 'payment', jsonb_build_object('id', 'in_1', 'amount_cents', 2999, 'currency', 'eur', 'status', 'succeeded')));
select t.eq((select count(*) from payments), 1::bigint, 'paiement non dupliqué');
select t.eq((select plan_id from creator_profiles where id = :'julie_id'), 'creator', 'forfait Creator appliqué');
select t.eq(apply_subscription_event('{"customer_id":"cus_inconnu","status":"active","plan_id":"pro"}'), 'ignored', 'client inconnu ignoré');
select t.eq(apply_subscription_event(jsonb_build_object('customer_id', 'cus_1', 'status', 'active', 'plan_id', 'inexistant')), 'ignored', 'forfait inconnu ignoré');
select t.logout();
select t.login('00000000-0000-0000-0000-00000000000a', 30);
select t.expect_error($$select set_free_plan()$$, 'use_billing_portal');
select t.expect_error($$select delete_my_account()$$, 'cancel_subscription_first');
select t.eq((creator_dashboard_stats() -> 'plan' ->> 'member_limit')::int, 10000, 'capacité Creator');
select t.logout();
set role service_role;
-- Résiliation chez le prestataire : la communauté reste, le forfait retombe à Discovery.
select apply_subscription_event(jsonb_build_object('customer_id', 'cus_1', 'status', 'canceled', 'plan_id', 'creator'));
select t.eq((select plan_id from creator_profiles where id = :'julie_id'), 'discovery', 'retour à Discovery');
select t.eq((select member_count from creator_profiles where id = :'julie_id'), 2, 'la communauté est conservée');
select t.logout();
select t.login('00000000-0000-0000-0000-00000000000a', 30);
select set_free_plan();
select t.eq((select status from subscriptions where creator_id = :'julie_id'), 'active', 'abonnement gratuit actif');
select t.logout();

-- ── Certification : usurpation, changement sensible, suspension, révocation ──
select t.logout();
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'imposteur@example.com');
select t.login('00000000-0000-0000-0000-0000000000c1');
select create_creator_profile('julie_officielle', 'Julie') is not null as ok \gset
select (add_social_account('instagram', 'https://instagram.com/julie.officiel')).id as acct2 \gset
select t.expect_error(format($$select start_certification(%L)$$, :'acct2'), 'social_account_taken');   -- compte déjà certifié ailleurs
select (add_social_account('instagram', 'https://instagram.com/julie.fan')).id as acct3 \gset
select (start_certification(:'acct3')).id as v3 \gset
select t.presence(:'v3');
select request_certification_review(:'v3');
select t.eq((select 'similar_name' = any(risk_flags) from creator_verifications where id = :'v3'), true, 'nom proche d''un créateur certifié signalé');
select t.logout();
select t.login('00000000-0000-0000-0000-0000000000ad', 0, 'aal2');
select t.expect_error(format($$select admin_review_certification(%L, true)$$, :'v3'), 'reason_required');   -- justification obligatoire
select admin_review_certification(:'v3', false, 'usurpation probable');
select t.eq((select verification_status::text from creator_profiles where handle = 'julie_officielle'), 'rejected', 'refus');
select t.logout();
-- Changement du nom public d'un profil certifié → nouvelle vérification
select t.login('00000000-0000-0000-0000-00000000000a', 30);
update creator_profiles set bio = 'Nouvelle bio' where handle = 'julie';
select t.eq((select verification_status::text from creator_profiles where handle = 'julie'), 'verified', 'la bio ne change pas la certification');
update creator_profiles set display_name = 'Julie M.' where handle = 'julie';
select t.eq((select verification_status::text from creator_profiles where handle = 'julie'), 'unverified', 'nom modifié : nouvelle certification requise');
select t.expect_error($$select create_alert('sos', 'x', 'key-after-rename', 'hacked')$$, 'creator_not_verified');
select t.eq((select verified_at is null from social_accounts where id = :'acct_id'), true, 'preuve de compte retirée');
select t.logout();
-- Re-certification, puis suspension, réhabilitation et révocation par l'administration
select t.login('00000000-0000-0000-0000-00000000000a', 30);
select (start_certification(:'acct_id')).id as v4 \gset
select t.presence(:'v4');
select request_certification_review(:'v4');
select t.logout();
select t.login('00000000-0000-0000-0000-0000000000ad', 0, 'aal2');
select admin_review_certification(:'v4', true);
select admin_suspend_certification(:'julie_id', 'signalement en cours');
select t.eq((select verification_status::text from creator_profiles where id = :'julie_id'), 'suspended', 'certification suspendue');
select admin_reinstate_certification(:'julie_id', 'signalement classé');
select admin_revoke_certification(:'julie_id', 'usurpation avérée');
select t.eq((select verification_status::text from creator_profiles where id = :'julie_id'), 'revoked', 'certification révoquée');
select t.expect_error($$select admin_revoke_certification(gen_random_uuid(), 'x')$$, 'reason_required');
select t.eq((select count(*) >= 8 from certification_events where creator_id = :'julie_id'), true, 'journal complet');
select t.logout();
-- Authentification renforcée : avec TOTP activé, un simple code e-mail ne suffit plus pour le SOS
select t.login('00000000-0000-0000-0000-00000000000a', 30);
select t.eq(has_totp_factor(), false, 'pas de TOTP');
select t.logout();
insert into auth.mfa_factors (user_id, factor_type, status) values ('00000000-0000-0000-0000-00000000000a', 'totp', 'verified');
select t.login('00000000-0000-0000-0000-00000000000a', 30);
select t.eq(has_strong_recent_auth(), false, 'TOTP exigé : le code e-mail seul est refusé');
select t.logout();

-- ── Présence sans prestataire : appel vidéo mené par l'équipe, ou désactivée ──
select t.login('00000000-0000-0000-0000-0000000000c1');
select (start_certification((select id from social_accounts where creator_id = (select id from creator_profiles where handle = 'julie_officielle') limit 1))).id as v5 \gset
select t.expect_error(format($$select request_certification_review(%L)$$, :'v5'), 'presence_required');
select t.expect_error(format($$select admin_confirm_presence(%L, true)$$, :'v5'), 'forbidden');   -- seul l'administrateur confirme
select t.logout();
select t.login('00000000-0000-0000-0000-0000000000ad', 0, 'aal2');
select admin_confirm_presence(:'v5', true, 'appel vidéo en direct, 3 mouvements demandés');
select t.eq((select presence_provider from creator_verifications where id = :'v5'), 'manual_call', 'présence confirmée par appel');
select t.logout();
select t.login('00000000-0000-0000-0000-0000000000c1');
select request_certification_review(:'v5');
select t.logout();
update app_settings set value = '"off"' where key = 'certification_presence_mode';
select t.eq(cert_presence_ok(gen_random_uuid()), true, 'mode off : aucun contrôle de présence');
update app_settings set value = '"manual"' where key = 'certification_presence_mode';
