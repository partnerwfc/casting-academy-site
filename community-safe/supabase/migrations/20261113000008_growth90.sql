-- Courbe de croissance sur 90 jours (écran Tableau de bord : 7 / 30 / 90 jours).
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
        from generate_series(date_trunc('day', now()) - interval '89 days', date_trunc('day', now()), '1 day') d
        left join (select date_trunc('day', created_at) as d0, count(*) as n from community_memberships
                    where creator_id = v_creator.id and created_at >= now() - interval '91 days'
                    group by 1) g on g.d0 = d), '[]'::jsonb),
    'plan', jsonb_build_object('id', v_plan.id, 'name', v_plan.name, 'member_limit', v_plan.member_limit,
                               'announcements_per_month', v_plan.announcements_per_month)
  );
end $$;
