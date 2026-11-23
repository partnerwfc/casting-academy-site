import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatCount, type DeliveryStats } from '@community-safe/shared';
import { Button, Card, Loading, Pill, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { fontFor, space, useColors } from '@/lib/theme';

// Écran « Alerte envoyée » : confirmation, puis suivi technique (compteurs seulement, jamais d'identité d'abonné).
export default function AlertTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const c = useColors();
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    supabase.from('alerts').select('kind, sent_at, created_at').eq('id', id).maybeSingle()
      .then(({ data }) => { setKind(data?.kind ?? null); setSentAt(data?.sent_at ?? data?.created_at ?? null); });
  }, [id]);

  // On interroge tant que l'envoi n'est pas terminé.
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
  const ok = ['sent', 'sending', 'queued'].includes(stats.status);
  const time = sentAt ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(sentAt)) : '';
  const extra = [
    ['track.pending', stats.pending], ['track.delivered', stats.delivered_to_device], ['track.noDevice', stats.no_device],
    ['track.failed', stats.failed], ['track.opened', stats.opened], ['track.linkOpened', stats.link_opened],
  ] as const;

  return (
    <Screen bg="#fff" nav={{ back: false }}
      footer={<>
        <Button label={t('sent.viewAlert')} onPress={() => router.replace(`/alert/${id}`)} />
        <Pressable onPress={() => router.replace('/(tabs)/communities')} style={{ alignItems: 'center', paddingVertical: 12 }}><Text style={{ color: c.primary, fontSize: 17, fontFamily: fontFor(700) }}>{t('sent.done')}</Text></Pressable>
      </>}>
      <View style={{ alignItems: 'center', gap: 12, marginTop: 22 }}>
        {ok ? (
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center', shadowColor: c.success, shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
            <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
          </View>
        ) : null}
        <Text style={{ fontSize: 33, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.9, marginTop: 14 }}>{ok ? t(kind === 'sos' ? 'sent.sos' : 'sent.announcement') : t(`track.status.${stats.status}`)}</Text>
        {ok && time ? <Text style={{ fontSize: 16.5, color: c.muted }}>{t('sent.processed', { time })}</Text> : null}
        {ok ? null : <Pill label={t(`track.status.${stats.status}`)} tone="sos" />}
      </View>
      {stats.blocked_reason ? <Card tone="sos"><T v="muted">{stats.blocked_reason}</T></Card> : null}
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: '#E9E6F3', paddingHorizontal: 18, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ fontSize: 17, color: c.text }}>{t('sent.targeted')}</Text>
          <Text style={{ fontSize: 19, color: c.text, fontFamily: fontFor(800) }}>{formatCount(locale, stats.recipients_total)}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: '#E9E6F3' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, gap: 12 }}>
          <Text style={{ flex: 1, fontSize: 17, color: c.text }}>{t('sent.acceptedBoth')}</Text>
          <Text style={{ fontSize: 19, color: '#15803D', fontFamily: fontFor(800) }}>{formatCount(locale, stats.accepted_by_provider)}</Text>
        </View>
        {more ? extra.map(([key, value]) => (
          <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEEFF5' }}>
            <Text style={{ fontSize: 15, color: c.muted, flex: 1 }}>{t(key)}</Text>
            <Text style={{ fontSize: 15, color: c.text, fontFamily: fontFor(700) }}>{formatCount(locale, value)}</Text>
          </View>
        )) : null}
        {more ? <Text style={{ fontSize: 13, lineHeight: 18, color: c.muted, paddingVertical: 10 }}>{t('compose.noGuarantee')}</Text> : null}
      </View>
      <Text style={{ fontSize: 14.5, lineHeight: 21, color: c.muted, paddingHorizontal: 4 }}>{t('sent.footnote')}</Text>
      <Pressable onPress={() => setMore(!more)} style={{ alignItems: 'center' }}><Text style={{ color: c.primary, fontSize: 15, fontFamily: fontFor(700) }}>{t('sent.details')} {more ? '▴' : '▾'}</Text></Pressable>
    </Screen>
  );
}
