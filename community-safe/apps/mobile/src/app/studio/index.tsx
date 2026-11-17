import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert as RNAlert, Pressable, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { formatCount, formatDate, type Alert, type DashboardStats } from '@community-safe/shared';
import { CertBadge } from '@/components/CertBadge';
import { Button, Card, Loading, Pill, Screen, Stat, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

function GrowthChart({ data }: { data: DashboardStats['growth'] }) {
  const c = useColors();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 2 }} accessibilityLabel="growth chart">
      {data.map((d) => (
        <View key={d.day} style={{ flex: 1, height: Math.max(2, (d.count / max) * 72), backgroundColor: d.count ? c.primary : c.border, borderRadius: 2 }} />
      ))}
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
  const creatorId = creator?.id;

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

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <T v="hero" style={{ fontSize: 44, lineHeight: 50 }}>{formatCount(locale, stats.members_total)}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}><T v="muted">{t('dash.members')} · @{creator.handle}</T>{verified ? <CertBadge small /> : null}</View>
      </View>

      {verified ? null : (
        <Card tone="soft">
          <T v="heading">{t('cert.title')}</T>
          <T v="muted">{t(creator.verification_status === 'pending' ? 'cert.inReview' : creator.verification_status === 'suspended' ? 'cert.suspended' : 'cert.requiredToSend')}</T>
          <Button label={t(creator.verification_status === 'pending' ? 'cert.title' : 'cert.start')} onPress={() => router.push('/studio/verify')} />
        </Card>
      )}

      <Button label={t('dash.sos')} kind="sos" disabled={!verified} onPress={() => router.push({ pathname: '/studio/compose', params: { kind: 'sos' } })} />
      <Button label={t('dash.share')} kind="secondary" onPress={() => router.push('/studio/transfer')} />

      <Card>
        <View style={{ flexDirection: 'row' }}>
          <Stat label={t('dash.today')} value={`+${formatCount(locale, stats.members_today)}`} />
          <Stat label={t('dash.week')} value={`+${formatCount(locale, stats.members_week)}`} />
          <Stat label={t('dash.month')} value={`+${formatCount(locale, stats.members_month)}`} />
        </View>
        <T v="small">{t('dash.growth')}</T>
        <GrowthChart data={stats.growth} />
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
