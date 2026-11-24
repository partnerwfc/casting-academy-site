import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AlertKind } from '@community-safe/shared';
import { Avatar, Chip, Loading, Pill, Segmented, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { fontFor, useColors, tint } from '@/lib/theme';
import { formatWhen } from '@/lib/when';

interface Item {
  id: string; kind: AlertKind; message: string; created_at: string; unread: boolean;
  name: string; avatar: string | null; href: string;
}
type Filter = 'all' | 'unread' | 'sos' | 'announcement';

export default function Alerts() {
  const { t, locale } = useI18n();
  const c = useColors();
  const top = useSafeAreaInsets().top + 8;
  const { session, creator } = useAuth();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [filter, setFilter] = useState<Filter>('all');
  const [received, setReceived] = useState<Item[] | null>(null);
  const [sent, setSent] = useState<Item[]>([]);
  const creatorId = creator?.id;

  useFocusEffect(useCallback(() => {
    if (!session) return setReceived([]);
    supabase.from('alert_recipients')
      .select('opened_at, alerts!inner(id, kind, message, created_at, creator_profiles!inner(display_name, handle, avatar_url))')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setReceived(((data ?? []) as unknown as { opened_at: string | null; alerts: { id: string; kind: AlertKind; message: string; created_at: string; creator_profiles: { display_name: string; avatar_url: string | null } } }[])
        .map((r) => ({ id: r.alerts.id, kind: r.alerts.kind, message: r.alerts.message, created_at: r.alerts.created_at, unread: !r.opened_at,
          name: r.alerts.creator_profiles.display_name, avatar: r.alerts.creator_profiles.avatar_url, href: `/alert/${r.alerts.id}` }))));
    if (creatorId) {
      supabase.from('alerts').select('id, kind, message, created_at').eq('creator_id', creatorId).neq('kind', 'test').order('created_at', { ascending: false }).limit(100)
        .then(({ data }) => setSent(((data ?? []) as { id: string; kind: AlertKind; message: string; created_at: string }[])
          .map((a) => ({ ...a, unread: false, name: creator!.display_name, avatar: creator!.avatar_url, href: `/studio/alert/${a.id}` }))));
    }
  }, [session, creatorId, creator]));

  const sections = useMemo(() => {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const list = (tab === 'received' ? received ?? [] : sent).filter((i) => filter === 'all' || (filter === 'unread' ? i.unread : i.kind === filter));
    const groups: { key: string; title: string; data: Item[] }[] = [
      { key: 'today', title: t('alerts.gToday'), data: [] }, { key: 'week', title: t('alerts.gWeek'), data: [] }, { key: 'older', title: t('alerts.gOlder'), data: [] },
    ];
    for (const i of list) {
      const ts = new Date(i.created_at).getTime();
      groups[ts >= startToday.getTime() ? 0 : now - ts < 7 * 86400000 ? 1 : 2].data.push(i);
    }
    return groups.filter((g) => g.data.length);
  }, [tab, filter, received, sent, t]);

  const filters: [Filter, string][] = [['all', t('alerts.fAll')], ['unread', t('alerts.fUnread')], ['sos', t('alerts.fSos')], ['announcement', t('alerts.fAnn')]];

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ padding: 20, paddingTop: top, gap: 14 }}>
        <T v="hero">{t('tabs.alerts')}</T>
        {creator ? <Segmented value={tab} onChange={setTab} options={[{ value: 'received', label: t('alerts.received') }, { value: 'sent', label: t('alerts.sent') }]} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {filters.map(([k, label]) => <Chip key={k} label={label} tone="dark" fill selected={filter === k} onPress={() => setFilter(k)} />)}
        </ScrollView>
      </View>
      {received === null ? <Loading /> : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ListEmptyComponent={<T v="muted" center style={{ marginTop: 48 }}>{t('alerts.empty')}</T>}
          renderSectionHeader={({ section }) => (
            <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase', marginTop: 14, marginBottom: 10, marginLeft: 4 }}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const sos = item.kind === 'sos';
            return (
              <Pressable accessibilityRole="button" onPress={() => router.push(item.href as never)}
                style={{ flexDirection: 'row', gap: 14, padding: 14, marginBottom: 12, borderRadius: 22, borderWidth: 1, backgroundColor: sos ? tint('#FFF1F4') : tint('#fff'), borderColor: sos ? tint('#F8C3CF') : tint('#E9E6F3') }}>
                <Avatar name={item.name} url={item.avatar} size={50} />
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pill label={t(`alerts.kind.${item.kind}`).toUpperCase()} tone={sos ? 'sos' : 'primary'} />
                    <Text style={{ marginLeft: 'auto', fontSize: 14, color: c.muted }}>{formatWhen(locale, item.created_at, t('alerts.yesterday'))}</Text>
                    {item.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary }} /> : null}
                  </View>
                  <Text style={{ fontSize: 16, lineHeight: 22, color: c.text, fontFamily: fontFor(item.unread ? 700 : 500), letterSpacing: -0.2 }}>{item.message}</Text>
                  <Text style={{ fontSize: 14.5, color: c.muted }}>{item.name}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
