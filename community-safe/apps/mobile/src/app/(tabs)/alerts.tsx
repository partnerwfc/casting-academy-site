import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { formatDate, type AlertKind } from '@community-safe/shared';
import { Avatar, Loading, Pill, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

interface InboxRow {
  opened_at: string | null;
  alerts: {
    id: string; kind: AlertKind; message: string; created_at: string;
    creator_profiles: { display_name: string; handle: string; avatar_url: string | null };
  };
}

export default function Alerts() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session } = useAuth();
  const [rows, setRows] = useState<InboxRow[] | null>(null);

  useFocusEffect(useCallback(() => {
    if (!session) return setRows([]);
    supabase.from('alert_recipients')
      .select('opened_at, alerts!inner(id, kind, message, created_at, creator_profiles!inner(display_name, handle, avatar_url))')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setRows((data ?? []) as unknown as InboxRow[]));
  }, [session]));

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ padding: space.lg }}><T v="title">{t('tabs.alerts')}</T></View>
      {rows === null ? <Loading /> : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.alerts.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          ListEmptyComponent={<T v="muted" center style={{ marginTop: space.xxl }}>{t('alerts.empty')}</T>}
          renderItem={({ item }) => {
            const a = item.alerts;
            return (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/alert/${a.id}`)}
                style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Avatar name={a.creator_profiles.display_name} url={a.creator_profiles.avatar_url} size={44} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <T v="heading" style={{ flexShrink: 1 }}>{a.creator_profiles.display_name}</T>
                    <Pill label={t(`alerts.kind.${a.kind}`)} tone={a.kind === 'sos' ? 'sos' : 'primary'} />
                    {item.opened_at ? null : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />}
                  </View>
                  <T v="muted" style={{ color: c.text }}>{a.message}</T>
                  <T v="small">{formatDate(locale, a.created_at)}</T>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
