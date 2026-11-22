import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, View } from 'react-native';
import { formatDate, type AlertKind } from '@community-safe/shared';
import { Avatar, Chip, Loading, Pill, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { fontFor, space, useColors } from '@/lib/theme';

interface Item {
  id: string; kind: AlertKind; message: string; created_at: string; unread: boolean;
  name: string; avatar: string | null; href: string;
}
type Filter = 'all' | 'unread' | 'sos' | 'announcement';

export default function Alerts() {
  const { t, locale } = useI18n();
  const c = useColors();
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
    <Screen scroll={false} padded={false}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <T v="hero">{t('tabs.alerts')}</T>
        {creator ? (
          <View style={{ flexDirection: 'row', backgroundColor: '#EEEFF5', borderRadius: 14, padding: 3 }}>
            {(['received', 'sent'] as const).map((k) => (
              <Pressable key={k} accessibilityRole="button" onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: tab === k ? '#fff' : 'transparent' }}>
                <T v="heading" style={{ fontSize: 15 }}>{t(k === 'received' ? 'alerts.received' : 'alerts.sent')}</T>
              </Pressable>
            ))}
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {filters.map(([k, label]) => <Chip key={k} label={label} selected={filter === k} onPress={() => setFilter(k)} />)}
        </ScrollView>
      </View>
      {received === null ? <Loading /> : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          ListEmptyComponent={<T v="muted" center style={{ marginTop: space.xxl }}>{t('alerts.empty')}</T>}
          renderSectionHeader={({ section }) => (
            <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.6, fontFamily: fontFor(700), textTransform: 'uppercase', marginTop: space.md, marginBottom: 8, marginLeft: 6 }}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(item.href as never)}
              style={{ flexDirection: 'row', gap: space.md, padding: space.md, marginBottom: space.md, borderRadius: 20, borderWidth: 1,
                backgroundColor: item.kind === 'sos' ? c.sosSoft : c.card, borderColor: item.kind === 'sos' ? '#FBC5CF' : c.border }}>
              <Avatar name={item.name} url={item.avatar} size={48} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Pill label={t(`alerts.kind.${item.kind}`)} tone={item.kind === 'sos' ? 'sos' : 'primary'} />
                  <T v="small" style={{ marginLeft: 'auto' }}>{formatDate(locale, item.created_at).split(',')[0]}</T>
                  {item.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} /> : null}
                </View>
                <T v="heading" style={{ fontSize: 16, fontWeight: item.unread ? '700' : '500' }}>{item.message}</T>
                <T v="small">{item.name}</T>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
