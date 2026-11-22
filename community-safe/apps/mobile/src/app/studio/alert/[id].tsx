import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { formatCount, type DeliveryStats } from '@community-safe/shared';
import Svg, { Path } from 'react-native-svg';
import { Button, Card, Loading, Pill, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

export default function AlertTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const c = useColors();
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  useEffect(() => { supabase.from('alerts').select('kind').eq('id', id).maybeSingle().then(({ data }) => setKind(data?.kind ?? null)); }, [id]);

  // Suivi technique : on interroge tant que l'envoi n'est pas terminé.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const poll = async () => {
      const { data } = await supabase.rpc('alert_delivery_stats', { p_alert_id: id });
      if (!active) return;
      if (data) setStats(data as DeliveryStats);
      const running = !data || ['queued', 'sending'].includes((data as DeliveryStats).status);
      timer = setTimeout(poll, running ? 3000 : 30000);
    };
    poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [id]);

  if (!stats) return <Loading />;
  const rows = [
    ['track.targeted', stats.recipients_total],
    ['track.pending', stats.pending],
    ['track.accepted', stats.accepted_by_provider],
    ['track.delivered', stats.delivered_to_device],
    ['track.noDevice', stats.no_device],
    ['track.failed', stats.failed],
    ['track.opened', stats.opened],
    ['track.linkOpened', stats.link_opened],
  ] as const;

  return (
    <Screen>
      {['sent', 'sending', 'queued'].includes(stats.status) ? (
        <View style={{ alignItems: 'center', gap: space.md, marginTop: space.lg }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center', shadowColor: c.success, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
            <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
          </View>
          <T v="hero" center>{t(kind === 'sos' ? 'sent.sos' : 'sent.announcement')}</T>
        </View>
      ) : null}
      <Pill label={t(`track.status.${stats.status}`)} tone={stats.status === 'blocked' || stats.status === 'failed' ? 'sos' : stats.status === 'sent' ? 'success' : 'primary'} />
      {stats.blocked_reason ? <Card tone="sos"><T v="muted">{stats.blocked_reason}</T></Card> : null}
      <Card>
        {rows.map(([key, value]) => (
          <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <T v="muted" style={{ flex: 1 }}>{t(key)}</T>
            <T v="heading">{formatCount(locale, value)}</T>
          </View>
        ))}
      </Card>
      <T v="small">{t('compose.noGuarantee')}</T>
      <Button label={t('sent.done')} kind="ghost" onPress={() => router.replace('/studio')} />
    </Screen>
  );
}
