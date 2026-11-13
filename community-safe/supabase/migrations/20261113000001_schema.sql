-- Community Safe — schéma initial (tables, contraintes, index).
-- Les règles d'accès (RLS) sont dans 0002, la logique métier (RPC) dans 0003.

create schema if not exists extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────────── Types ─────────────────────────────
-- unverified : jamais certifié · pending : demande en cours · verified : « Créateur certifié »
-- rejected : refusé · suspended : badge retiré temporairement · revoked : certification retirée
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'suspended', 'revoked');
create type public.creator_status as enum ('active', 'suspended');
create type public.alert_kind as enum ('sos', 'announcement', 'test');
create type public.alert_status as enum ('queued', 'sending', 'sent', 'blocked', 'failed');
create type public.recipient_status as enum ('pending', 'processing', 'sent', 'no_device', 'failed');
create type public.push_permission as enum ('granted', 'denied', 'undetermined');

-- ───────────────────────────── Configuration ─────────────────────────────
-- Paramètres modifiables depuis l'administration (aucun secret ici).
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('alert_message_max_length', '280'),
  ('sos_max_per_24h', '3'),
  ('sos_max_per_30d', '10'),
  ('test_max_per_24h', '10'),
  ('stepup_max_age_minutes', '10'),
  ('admin_require_mfa', 'true'),
  ('delivery_max_attempts', '5');

create table public.blocked_link_domains (
  domain citext primary key,
  reason text,
  created_at timestamptz not null default now()
);

-- Raccourcisseurs : ils masquent la destination réelle d'une alerte.
insert into public.blocked_link_domains (domain, reason) values
  ('bit.ly', 'shortener'), ('tinyurl.com', 'shortener'), ('t.co', 'shortener'),
  ('goo.gl', 'shortener'), ('is.gd', 'shortener'), ('ow.ly', 'shortener'),
  ('cutt.ly', 'shortener'), ('rebrand.ly', 'shortener'), ('shorturl.at', 'shortener');

-- ───────────────────────────── Forfaits ─────────────────────────────
-- Prix et limites pilotés par la base : rien n'est codé en dur dans les apps.
create table public.plans (
  id text primary key,
  name text not null,
  price_cents integer,                    -- null = sur devis
  currency text not null default 'EUR',
  billing_interval text not null default 'year',
  member_limit integer,                   -- null = illimité / personnalisé
  announcements_per_month integer,        -- null = personnalisé
  features jsonb not null default '[]',
  stripe_price_id text,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Prix en centimes d'euro, facturation annuelle. Modifiables depuis l'administration.
-- Au-delà de la capacité d'un forfait, personne n'est supprimé : le SOS reste actif,
-- seules les annonces sont suspendues jusqu'au changement de forfait.
insert into public.plans (id, name, price_cents, member_limit, announcements_per_month, features, sort_order) values
  ('discovery',  'Discovery',  0,    100,    1, '["link","qr","dashboard","sos"]', 1),
  ('creator',    'Creator',    2999, 10000,  2, '["link","qr","dashboard_advanced","transfer","sos"]', 2),
  ('pro',        'Pro',        4999, 100000, 4, '["link","qr","stats_advanced","customization","transfer_advanced","sos"]', 3),
  ('premium',    'Premium',    9999, 500000, 8, '["link","qr","stats_advanced","customization","transfer_advanced","sos","priority_support"]', 4),
  ('enterprise', 'Enterprise', null, null, null, '["multi_admin","priority_support","stats_advanced","organization"]', 5);

-- ───────────────────────────── Utilisateurs ─────────────────────────────
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'en' check (locale in ('en', 'fr', 'pt', 'es')),
  timezone text,
  age_confirmed_at timestamptz,           -- protection des mineurs : déclaration d'âge
  created_at timestamptz not null default now()
);

create table public.admin_roles (
  user_id uuid primary key references public.users (id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- ───────────────────────────── Créateurs ─────────────────────────────
create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  handle citext not null unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text check (char_length(bio) <= 300),
  avatar_url text,
  category text not null default 'creator',
  verification_status public.verification_status not null default 'unverified',
  status public.creator_status not null default 'active',
  plan_id text not null default 'discovery' references public.plans (id),
  member_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index creator_profiles_directory_idx
  on public.creator_profiles (verification_status, status, member_count desc);
create index creator_profiles_category_idx on public.creator_profiles (category);
create index creator_profiles_created_idx on public.creator_profiles (created_at desc);
create index creator_profiles_name_trgm on public.creator_profiles using gin (display_name gin_trgm_ops);
create index creator_profiles_handle_trgm on public.creator_profiles using gin ((handle::text) gin_trgm_ops);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  platform text not null check (platform in
    ('instagram', 'tiktok', 'youtube', 'x', 'twitch', 'facebook', 'snapchat', 'telegram', 'whatsapp', 'discord', 'website', 'other')),
  handle text not null check (char_length(handle) between 1 and 100),
  url text check (url ~ '^https://'),
  verified_at timestamptz,                -- renseigné uniquement par une certification validée
  verified_method text,
  created_at timestamptz not null default now(),
  unique (creator_id, platform, handle)
);
-- Un compte social ne peut être certifié que pour un seul créateur.
create unique index social_accounts_verified_unique on public.social_accounts (platform, lower(handle)) where verified_at is not null;

-- Demandes de certification « Créateur certifié ». Aucune capture d'écran ni pièce d'identité n'est
-- stockée ici : seulement le code temporaire, le résultat des contrôles et la décision.
create table public.creator_verifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  method text not null check (method in ('auto_domain', 'auto_youtube', 'auto_twitch', 'manual_social', 'manual_alt')),
  status text not null default 'awaiting_proof'
    check (status in ('awaiting_proof', 'in_review', 'approved', 'rejected', 'expired', 'failed', 'revoked', 'cancelled')),
  -- Validation 1 — PRÉSENCE : un contrôle vidéo de personne vivante (prestataire spécialisé, détection du
  -- vivant et des deepfakes). Aucune vidéo ni donnée biométrique n'est stockée chez nous : seulement le
  -- résultat et la référence du prestataire. Elle prouve qu'une personne réelle est là, pas qui elle est.
  presence_status text not null default 'pending' check (presence_status in ('pending', 'passed', 'failed', 'expired')),
  presence_attempts integer not null default 0,
  presence_provider text,
  presence_ref text,
  presence_checked_at timestamptz,
  presence_expires_at timestamptz,
  -- Validation 2 — IDENTITÉ : preuve indépendante reliant cette personne à l'identité publique revendiquée
  -- (code publié sur un compte officiel, documents professionnels ou examen humain confidentiel).
  code text,                              -- effacé dès que la demande est décidée ou expirée
  code_expires_at timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_checked_at timestamptz,
  risk_flags text[] not null default '{}',-- ex. similar_name : impose un examen humain
  evidence jsonb not null default '{}',   -- source et date du contrôle, rien de personnel
  note text check (char_length(note) <= 500),
  decision_reason text,
  reviewer_id uuid references public.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index creator_verifications_queue_idx on public.creator_verifications (status, created_at);
create unique index creator_verifications_one_open on public.creator_verifications (creator_id) where status in ('awaiting_proof', 'in_review');

-- ───────────────────────────── Community Transfer ─────────────────────────────
create table public.transfer_links (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  source text not null check (source ~ '^[a-z0-9_-]{1,30}$'),
  created_at timestamptz not null default now(),
  unique (creator_id, source)
);

create table public.transfer_campaigns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creator_profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_steps jsonb not null default '[]'
);

-- Aucune donnée personnelle : ni IP, ni identifiant d'appareil.
create table public.link_click_events (
  id bigint generated always as identity primary key,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  source text,
  occurred_at timestamptz not null default now()
);
create index link_click_events_creator_idx on public.link_click_events (creator_id, occurred_at desc);

-- ───────────────────────────── Communautés ─────────────────────────────
create table public.community_memberships (
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  source text,
  created_at timestamptz not null default now(),
  primary key (creator_id, user_id)
);
create index community_memberships_user_idx on public.community_memberships (user_id, created_at desc);
create index community_memberships_growth_idx on public.community_memberships (creator_id, created_at);

-- SOS et annonces sont deux consentements indépendants.
create table public.notification_preferences (
  creator_id uuid not null,
  user_id uuid not null,
  sos_enabled boolean not null default true,
  announcements_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (creator_id, user_id),
  foreign key (creator_id, user_id)
    references public.community_memberships (creator_id, user_id) on delete cascade
);
create index notification_preferences_user_idx on public.notification_preferences (user_id);

create table public.consent_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'age', 'follow', 'sos_notifications', 'announcement_notifications')),
  subject_id uuid,                        -- créateur concerné, le cas échéant
  version text,
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consent_records_user_idx on public.consent_records (user_id, created_at desc);

-- ───────────────────────────── Appareils & jetons push ─────────────────────────────
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  installation_id text not null,          -- identifiant aléatoire généré par l'app, non lié au matériel
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  locale text,
  notifications_permission public.push_permission not null default 'undetermined',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null default 'expo' check (provider in ('expo', 'fcm', 'apns')),
  token text not null unique,
  status text not null default 'active' check (status in ('active', 'invalid')),
  last_error text,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_active_idx on public.push_tokens (user_id) where status = 'active';

-- ───────────────────────────── Alertes ─────────────────────────────
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  kind public.alert_kind not null,
  reason text check (reason in
    ('hacked', 'suspended', 'deleted', 'platform_down', 'new_account', 'other')),
  message text not null check (char_length(message) between 1 and 1000),
  link_url text check (link_url ~ '^https://'),
  status public.alert_status not null default 'queued',
  blocked_reason text,
  idempotency_key text not null,
  recipients_total integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (creator_id, idempotency_key),   -- un double appui n'envoie jamais deux alertes
  check (kind <> 'sos' or reason is not null)
);
create index alerts_creator_idx on public.alerts (creator_id, created_at desc);
create index alerts_status_idx on public.alerts (status) where status in ('queued', 'sending');

create table public.alert_recipients (
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status public.recipient_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  opened_at timestamptz,
  link_opened_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (alert_id, user_id)         -- déduplication : un destinataire par alerte
);
create index alert_recipients_queue_idx
  on public.alert_recipients (next_attempt_at) where status = 'pending';
create index alert_recipients_inbox_idx on public.alert_recipients (user_id, created_at desc);

create table public.delivery_attempts (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  push_token_id uuid references public.push_tokens (id) on delete set null,
  accepted boolean not null,              -- accepté par le fournisseur ≠ affiché sur le téléphone
  provider_ticket_id text,
  error_code text,
  receipt_status text,                    -- 'ok' | 'error' une fois le reçu consulté
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index delivery_attempts_alert_idx on public.delivery_attempts (alert_id);
create index delivery_attempts_receipts_idx
  on public.delivery_attempts (created_at) where accepted and receipt_status is null;

-- ───────────────────────────── Abonnements (Phase 2) ─────────────────────────────
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creator_profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null default 'active'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  provider text check (provider in ('stripe', 'app_store', 'play_store', 'manual')),
  provider_customer_id text unique,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount_cents integer not null,
  tax_cents integer not null default 0,
  currency text not null,
  status text not null check (status in ('succeeded', 'failed', 'refunded', 'pending')),
  provider text not null,
  provider_payment_id text unique,
  created_at timestamptz not null default now()
);
create index payments_creator_idx on public.payments (creator_id, created_at desc);

-- ───────────────────────────── Confiance & audit ─────────────────────────────
create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.users (id) on delete set null,
  creator_id uuid references public.creator_profiles (id) on delete cascade,
  alert_id uuid references public.alerts (id) on delete cascade,
  reason text not null check (reason in ('impersonation', 'spam', 'malicious_link', 'fraud', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  check (creator_id is not null or alert_id is not null)
);
create index abuse_reports_queue_idx on public.abuse_reports (status, created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,                     -- pas de FK : la trace survit à la suppression du compte
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
