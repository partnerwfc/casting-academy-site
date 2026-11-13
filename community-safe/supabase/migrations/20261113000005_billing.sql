-- Abonnements : changement de forfait, devis, événements du prestataire de paiement.
-- Le client ne peut JAMAIS s'attribuer un forfait payant : seul le webhook (service_role)
-- le fait, après un vrai paiement.

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  message text check (char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.quote_requests enable row level security;
revoke all on public.quote_requests from anon, authenticated;
grant select, update (status) on public.quote_requests to authenticated;
grant all on public.quote_requests to service_role;
create policy quotes_admin on public.quote_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy quotes_owner_select on public.quote_requests for select to authenticated
  using (public.owns_creator(creator_id));

-- Retour au forfait gratuit. Refusé s'il existe un abonnement payant en cours :
-- il se résilie depuis le portail de facturation (fin de période payée).
create or replace function public.set_free_plan()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_creator creator_profiles;
  v_sub subscriptions;
begin
  select * into v_creator from creator_profiles where owner_user_id = public.require_user();
  if v_creator.id is null then raise exception 'creator_not_found' using errcode = 'P0002'; end if;
  select * into v_sub from subscriptions where creator_id = v_creator.id;
  if v_sub.provider is not null and v_sub.provider <> 'manual' and v_sub.status in ('active', 'past_due') then
    raise exception 'use_billing_portal' using errcode = '42501';
  end if;
  update creator_profiles set plan_id = 'discovery' where id = v_creator.id;
  update subscriptions
     set plan_id = 'discovery', status = 'active', provider = null, provider_subscription_id = null,
         cancel_at_period_end = false, current_period_end = null, updated_at = now()
   where creator_id = v_creator.id;
  perform audit('plan.free', 'creator', v_creator.id::text, jsonb_build_object('from', v_creator.plan_id));
end $$;

create or replace function public.request_quote(p_message text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_creator creator_profiles;
  v_id uuid;
begin
  select * into v_creator from creator_profiles where owner_user_id = public.require_user();
  if v_creator.id is null then raise exception 'creator_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from quote_requests where creator_id = v_creator.id and status = 'open') then
    raise exception 'quote_already_requested' using errcode = '23505';
  end if;
  insert into quote_requests (creator_id, message) values (v_creator.id, left(nullif(trim(p_message), ''), 1000))
  returning id into v_id;
  perform audit('quote.request', 'creator', v_creator.id::text, '{}');
  return v_id;
end $$;

-- Événement normalisé venu du webhook de paiement. Idempotent (état, pas incrément).
-- {creator_id?, customer_id, subscription_id, plan_id, status: active|past_due|canceled,
--  current_period_end?, cancel_at_period_end?, payment?: {id, amount_cents, tax_cents, currency, status}}
create or replace function public.apply_subscription_event(p_event jsonb)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_creator uuid;
  v_status text := p_event ->> 'status';
  v_plan text := p_event ->> 'plan_id';
  v_pay jsonb := p_event -> 'payment';
begin
  v_creator := nullif(p_event ->> 'creator_id', '')::uuid;
  if v_creator is null and p_event ->> 'customer_id' is not null then
    select creator_id into v_creator from subscriptions where provider_customer_id = p_event ->> 'customer_id';
  end if;
  if v_creator is null or not exists (select 1 from creator_profiles where id = v_creator) then
    return 'ignored';
  end if;

  if v_status is not null then
    if v_status not in ('active', 'past_due', 'canceled') then return 'ignored'; end if;
    if v_status = 'canceled' then v_plan := 'discovery'; end if;       -- la communauté reste, le forfait retombe
    if not exists (select 1 from plans where id = v_plan) then return 'ignored'; end if;

    insert into subscriptions (creator_id, plan_id, status, provider, provider_customer_id, provider_subscription_id,
                               current_period_end, cancel_at_period_end)
    values (v_creator, v_plan, v_status, 'stripe', p_event ->> 'customer_id', p_event ->> 'subscription_id',
            nullif(p_event ->> 'current_period_end', '')::timestamptz, coalesce((p_event ->> 'cancel_at_period_end')::boolean, false))
    on conflict (creator_id) do update
      set plan_id = excluded.plan_id, status = excluded.status, provider = 'stripe',
          provider_customer_id = coalesce(excluded.provider_customer_id, subscriptions.provider_customer_id),
          provider_subscription_id = excluded.provider_subscription_id,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now();
    update creator_profiles set plan_id = v_plan where id = v_creator;
    insert into audit_logs (action, target_type, target_id, metadata)
    values ('subscription.' || v_status, 'creator', v_creator::text, jsonb_build_object('plan', v_plan));
  end if;

  if v_pay is not null then
    insert into payments (creator_id, subscription_id, amount_cents, tax_cents, currency, status, provider, provider_payment_id)
    select v_creator, s.id, (v_pay ->> 'amount_cents')::int, coalesce((v_pay ->> 'tax_cents')::int, 0),
           upper(v_pay ->> 'currency'), v_pay ->> 'status', 'stripe', v_pay ->> 'id'
      from (select id from subscriptions where creator_id = v_creator) s
    on conflict (provider_payment_id) do nothing;
  end if;
  return 'applied';
end $$;

-- Demandes de devis visibles côté administration.
create or replace function public.admin_stats_quotes()
returns bigint language sql stable security definer set search_path = public, extensions as $$
  select case when public.is_admin() then (select count(*) from quote_requests where status = 'open') else 0 end;
$$;

revoke execute on function public.set_free_plan(), public.request_quote(text),
  public.apply_subscription_event(jsonb), public.admin_stats_quotes() from public, anon, authenticated;
grant execute on function public.set_free_plan(), public.request_quote(text), public.admin_stats_quotes() to authenticated;
grant execute on function public.apply_subscription_event(jsonb) to service_role;
