import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import type { CreatorProfile } from '@community-safe/shared';
import { CreatorRow } from '@/components/CreatorRow';
import { PushPrompt } from '@/components/PushPrompt';
import { Button, Loading, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function Communities() {
  const { t } = useI18n();
  const { session } = useAuth();
  const [items, setItems] = useState<CreatorProfile[] | null>(null);

  useFocusEffect(useCallback(() => {
    if (!session) return setItems([]);
    supabase.from('community_memberships').select('created_at, creator_profiles(*)').order('created_at', { ascending: false })
      .then(({ data }) => setItems(((data ?? []) as unknown as { creator_profiles: CreatorProfile | null }[])
        .map((r) => r.creator_profiles).filter((x): x is CreatorProfile => !!x)));
  }, [session]));

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <T v="title">{t('tabs.communities')}</T>
        {session && items?.length ? <PushPrompt /> : null}
      </View>
      {items === null ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CreatorRow creator={item} />}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          ListEmptyComponent={
            <View style={{ gap: space.lg, marginTop: space.xxl }}>
              <T v="muted" center>{t('communities.empty')}</T>
              {session
                ? <Button label={t('welcome.discover')} onPress={() => router.push('/(tabs)/discover')} />
                : <Button label={t('auth.title')} onPress={() => router.push('/sign-in')} />}
            </View>
          }
        />
      )}
    </Screen>
  );
}
