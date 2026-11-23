-- Nouvelle grille : mensuel ET annuel. price_cents = prix annuel (compatibilité), price_month_cents = prix mensuel.
alter table public.plans add column if not exists price_month_cents integer;
alter table public.plans add column if not exists stripe_price_id_month text;
alter table public.plans add column if not exists apple_product_id_month text unique;

-- « premium » devient « business » (les références suivent, aucune ligne n'est perdue).
insert into public.plans (id, name, price_cents, member_limit, announcements_per_month, features, sort_order)
select 'business', 'Business', price_cents, member_limit, announcements_per_month, features, sort_order
  from public.plans where id = 'premium'
on conflict (id) do nothing;
update public.subscriptions set plan_id = 'business' where plan_id = 'premium';
update public.creator_profiles set plan_id = 'business' where plan_id = 'premium';
update public.plans set stripe_price_id = p.stripe_price_id from public.plans p
 where public.plans.id = 'business' and p.id = 'premium' and public.plans.stripe_price_id is null;
update public.plans set apple_product_id = null where id = 'premium';
delete from public.plans where id = 'premium';

update public.plans set price_cents = 0,     price_month_cents = 0,    member_limit = 100,   announcements_per_month = 1,
  features = '["profile","link","certification","sos","announcements","push"]', sort_order = 1 where id = 'discovery';
update public.plans set price_cents = 5990,  price_month_cents = 599,  member_limit = 2500,  announcements_per_month = 2,
  features = '["all","stats_essential","dashboard"]', sort_order = 2 where id = 'creator';
update public.plans set price_cents = 14990, price_month_cents = 1499, member_limit = 10000, announcements_per_month = 4,
  features = '["all_creator","stats_advanced","priority_support"]', sort_order = 3 where id = 'pro';
update public.plans set price_cents = 39990, price_month_cents = 3999, member_limit = 50000, announcements_per_month = 8,
  features = '["all_creator","stats_advanced","priority_support"]', sort_order = 4 where id = 'business';
update public.plans set sort_order = 5 where id = 'enterprise';

update public.plans set apple_product_id = 'com.savemycommunity.app.creator.yearly',  apple_product_id_month = 'com.savemycommunity.app.creator.monthly'  where id = 'creator';
update public.plans set apple_product_id = 'com.savemycommunity.app.pro.yearly',      apple_product_id_month = 'com.savemycommunity.app.pro.monthly'      where id = 'pro';
update public.plans set apple_product_id = 'com.savemycommunity.app.business.yearly', apple_product_id_month = 'com.savemycommunity.app.business.monthly' where id = 'business';
