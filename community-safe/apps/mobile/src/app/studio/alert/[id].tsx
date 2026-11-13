import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { formatCount, type DeliveryStats } from '@community-safe/shared';
import { Card, Loading, Pill, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function AlertTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<DeliveryStats | null>(null);

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
    </Screen>
  );
}
