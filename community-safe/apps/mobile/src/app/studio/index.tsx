import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert as RNAlert, Modal, Pressable, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { formatCount, formatDate, type Alert, type DashboardStats } from '@community-safe/shared';
import { CertBadge } from '@/components/CertBadge';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Avatar, Button, Card, Loading, Pill, Screen, Stat, T, VerifiedBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

function GrowthChart({ data }: { data: DashboardStats['growth'] }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const h = 120;
  const max = Math.max(1, ...data.map((d) => d.count));
  const pts = data.map((d, i) => [data.length > 1 ? (i / (data.length - 1)) * w : w / 2, h - 8 - (d.count / max) * (h - 16)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h }} accessibilityLabel="growth chart">
      {w > 0 && pts.length ? (
        <Svg width={w} height={h}>
          <Defs><LinearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.primary} stopOpacity={0.22} /><Stop offset="1" stopColor={c.primary} stopOpacity={0} /></LinearGradient></Defs>
          <Path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#ga)" />
          <Path d={line} stroke={c.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

export default function Studio() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator, refreshCreator } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [testing, setTesting] = useState(false);
  const [plans, setPlans] = useState<{ id: string; name: string; price_cents: number | null; currency: string; member_limit: number | null }[]>([]);
  const [sheetDismissed, setSheetDismissed] = useState(false);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const creatorId = creator?.id;
  useEffect(() => { supabase.from('plans').select('id, name, price_cents, currency, member_limit').order('sort_order').then(({ data }) => setPlans((data ?? []) as typeof plans)); }, []);

  const load = useCallback(async () => {
    if (!creatorId) return;
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.rpc('creator_dashboard_stats'),
      supabase.from('alerts').select('*').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(20),
    ]);
    if (s) setStats(s as DashboardStats);
    setAlerts((a ?? []) as Alert[]);
  }, [creatorId]);

  useFocusEffect(useCallback(() => { refreshCreator(); load(); }, [refreshCreator, load]));

  // Compteur en temps quasi réel : la ligne du créateur change à chaque nouveau membre.
  useEffect(() => {
    if (!creatorId) return;
    const channel = supabase.channel(`creator-${creatorId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'creator_profiles', filter: `id=eq.${creatorId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [creatorId, load]);

  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio' } }} />;
  if (!creator) return <Redirect href="/studio/setup" />;
  if (!stats) return <Loading />;

  const verified = creator.verification_status === 'verified';
  const limit = stats.plan.member_limit;
  const over = limit !== null && stats.members_total > limit;
  const quota = stats.plan.announcements_per_month;

  const sendTest = async () => {
    setTesting(true);
    const { error } = await supabase.rpc('create_alert', {
      p_kind: 'test', p_message: t('dash.test'), p_idempotency_key: Crypto.randomUUID(),
    });
    if (!error) await supabase.functions.invoke('dispatch-alerts', { body: {} });
    setTesting(false);
    RNAlert.alert(error ? t('common.error') : t('dash.testSent'));
    load();
  };

  const fmt = (p?: { price_cents: number | null; currency: string }) => (p && p.price_cents ? `${new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency }).format(p.price_cents / 100)} ${t('plan.perYear')}` : t('plan.free'));
  const curPlan = plans.find((p) => p.id === creator.plan_id);
  const nextPlan = plans.find((p) => p.price_cents !== null && (p.member_limit === null || p.member_limit >= stats.members_total));
  const curPrice = fmt(curPlan);
  const nextPrice = nextPlan ? fmt(nextPlan) : t('plan.quote');
  return (
    <Screen>
      <Modal visible={over && !sheetDismissed} transparent animationType="slide" onRequestClose={() => setSheetDismissed(true)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,11,47,0.45)' }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, gap: space.md, alignItems: 'center' }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: '#D7D8E2' }} />
            <View style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 9, borderColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
              <T v="heading" style={{ fontSize: 15, fontWeight: '800' }}>{formatCount(locale, stats.members_total)}</T>
              <T v="small" style={{ fontSize: 11 }}>/ {limit !== null ? formatCount(locale, limit) : ''}</T>
            </View>
            <T v="title" center>{t('over.title')}</T>
            <T v="muted" center>{t('over.body', { name: creator.display_name, limit: limit !== null ? formatCount(locale, limit) : '' })}</T>
            <View style={{ alignSelf: 'stretch', backgroundColor: c.surface, borderRadius: 16, paddingHorizontal: space.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 }}>
                <T v="body">{t('over.current')}</T><T v="muted">{curPrice}</T>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border }}>
                <T v="heading">{t('over.next')}</T><T v="heading" style={{ color: c.primary }}>{nextPrice}</T>
              </View>
            </View>
            <Button label={t('over.upgrade', { price: nextPrice })} style={{ alignSelf: 'stretch' }} onPress={() => { setSheetDismissed(true); router.push('/studio/plan'); }} />
            <Pressable onPress={() => setSheetDismissed(true)} style={{ padding: space.sm }}><T v="heading" style={{ color: c.primary }}>{t('over.later')}</T></Pressable>
          </View>
        </View>
      </Modal>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={creator.display_name} url={creator.avatar_url} size={56} />
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><T v="heading" style={{ fontSize: 20, fontWeight: '800' }}>{creator.display_name}</T>{verified ? <VerifiedBadge size={18} /> : null}</View>
          <T v="muted">@{creator.handle}</T>
        </View>
      </View>
      <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
        <T v="muted" style={{ fontWeight: '600' }}>{t('dash.members')}</T>
        <T v="hero" style={{ fontSize: 56, lineHeight: 62, letterSpacing: -2 }}>{formatCount(locale, stats.members_total)}</T>
        <Pill label={`↗ +${formatCount(locale, stats.members_today)} ${t('dash.today').toLowerCase()}`} tone="success" />
      </View>

      {verified ? null : (
        <Card tone="soft">
          <T v="heading">{t('cert.title')}</T>
          <T v="muted">{t(creator.verification_status === 'pending' ? 'cert.inReview' : creator.verification_status === 'suspended' ? 'cert.suspended' : 'cert.requiredToSend')}</T>
          <Button label={t(creator.verification_status === 'pending' ? 'cert.title' : 'cert.start')} onPress={() => router.push('/studio/verify')} />
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button label={t('dash.share')} kind="secondary" style={{ flex: 1 }} onPress={() => router.push('/studio/transfer')} />
        <Button label={`+  ${t('dash.sendAlert')}`} style={{ flex: 1 }} disabled={!verified} onPress={() => router.push('/studio/new')} />
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T v="heading" style={{ fontSize: 18 }}>{t('dash.growth')}</T>
          <T v="heading" style={{ color: c.success, fontSize: 15 }}>+{formatCount(locale, stats.growth.slice(-range).reduce((n, d) => n + d.count, 0))}</T>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: '#EEEFF5', borderRadius: 12, padding: 3 }}>
          {([7, 30, 90] as const).map((r) => (
            <Pressable key={r} accessibilityRole="button" onPress={() => setRange(r)} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: range === r ? '#fff' : 'transparent' }}>
              <T v="heading" style={{ fontSize: 14 }}>{t(`dash.d${r}` as 'dash.d7')}</T>
            </Pressable>
          ))}
        </View>
        <GrowthChart data={stats.growth.slice(-range)} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row' }}>
          <Stat label={t('dash.today')} value={`+${formatCount(locale, stats.members_today)}`} />
          <Stat label={t('dash.week')} value={`+${formatCount(locale, stats.members_week)}`} />
          <Stat label={t('dash.month')} value={`+${formatCount(locale, stats.members_month)}`} />
        </View>
      </Card>

      <Card>
        {([
          ['dash.notifAllowed', stats.members_notifications_allowed],
          ['dash.validDevices', stats.devices_with_valid_token],
          ['dash.sosEnabled', stats.members_sos_enabled],
          ['dash.annEnabled', stats.members_announcements_enabled],
          ['dash.alertsSent', stats.alerts_sent],
        ] as const).map(([key, value]) => (
          <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <T v="muted" style={{ flex: 1 }}>{t(key)}</T>
            <T v="heading">{formatCount(locale, value)}</T>
          </View>
        ))}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="heading">{t('dash.plan')} {stats.plan.name}</T>
          {limit !== null ? <T v="muted">{t('dash.capacity', { count: formatCount(locale, stats.members_total), limit: formatCount(locale, limit) })}</T> : null}
        </View>
        {over ? <T v="small" style={{ color: c.sos }}>{t('dash.overCapacity')}</T> : null}
        <Button
          label={quota !== null ? `${t('dash.announce')} · ${t('dash.announceQuota', { used: stats.announcements_this_month, limit: quota })}` : t('dash.announce')}
          kind="secondary"
          disabled={!verified || over || (quota !== null && stats.announcements_this_month >= quota)}
          onPress={() => router.push({ pathname: '/studio/compose', params: { kind: 'announcement' } })}
        />
        <Button label={t('plan.title')} kind="ghost" onPress={() => router.push('/studio/plan')} />
        <Button label={t('dash.test')} kind="ghost" loading={testing} onPress={sendTest} />
      </Card>

      {alerts.length ? (
        <View style={{ gap: space.sm }}>
          <T v="heading">{t('dash.history')}</T>
          {alerts.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push(`/studio/alert/${a.id}`)}
              style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <Pill label={t(`alerts.kind.${a.kind}`)} tone={a.kind === 'sos' ? 'sos' : 'primary'} />
                <Pill label={t(`track.status.${a.status}`)} />
                <T v="small">{formatDate(locale, a.created_at)}</T>
              </View>
              <T v="muted" style={{ color: c.text }}>{a.message}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
