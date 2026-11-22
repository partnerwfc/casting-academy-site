-- Achat in-app Apple (via RevenueCat) : identifiant produit par forfait, fournisseur dans l'événement d'abonnement.
alter table public.plans add column if not exists apple_product_id text unique;
update public.plans set apple_product_id = 'com.savemycommunity.app.creator.yearly' where id = 'creator' and apple_product_id is null;
update public.plans set apple_product_id = 'com.savemycommunity.app.pro.yearly' where id = 'pro' and apple_product_id is null;
update public.plans set apple_product_id = 'com.savemycommunity.app.premium.yearly' where id = 'premium' and apple_product_id is null;

create or replace function public.apply_subscription_event(p_event jsonb)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_creator uuid;
  v_status text := p_event ->> 'status';
  v_plan text := p_event ->> 'plan_id';
  v_pay jsonb := p_event -> 'payment';
  v_provider text := coalesce(nullif(p_event ->> 'provider', ''), 'stripe');
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
    values (v_creator, v_plan, v_status, v_provider, p_event ->> 'customer_id', p_event ->> 'subscription_id',
            nullif(p_event ->> 'current_period_end', '')::timestamptz, coalesce((p_event ->> 'cancel_at_period_end')::boolean, false))
    on conflict (creator_id) do update
      set plan_id = excluded.plan_id, status = excluded.status, provider = v_provider,
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
           upper(v_pay ->> 'currency'), v_pay ->> 'status', v_provider, v_pay ->> 'id'
      from (select id from subscriptions where creator_id = v_creator) s
    on conflict (provider_payment_id) do nothing;
  end if;
  return 'applied';
end $$;


revoke execute on function public.apply_subscription_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(jsonb) to service_role;
