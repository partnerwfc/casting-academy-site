-- Journal des achats in-app Apple (validés auprès d'Apple côté serveur) : lecture réservée à l'administration.
create table public.iap_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('client', 'notification')),
  notification_type text,
  subtype text,
  creator_id uuid references public.creator_profiles (id) on delete set null,
  original_transaction_id text,
  transaction_id text,
  product_id text,
  environment text,
  result text not null
);
create index iap_events_created_idx on public.iap_events (created_at desc);
create index iap_events_creator_idx on public.iap_events (creator_id, created_at desc);
alter table public.iap_events enable row level security;
revoke all on public.iap_events from anon, authenticated;
grant select on public.iap_events to authenticated;
grant all on public.iap_events to service_role;
create policy iap_events_admin on public.iap_events for select to authenticated using (public.is_admin());
