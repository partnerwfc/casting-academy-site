import { useEffect, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { CATEGORIES, type CreatorProfile, type MessageKey } from '@community-safe/shared';
import { CreatorRow } from '@/components/CreatorRow';
import { Button, Chip, Input, Loading, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

const PAGE = 30;

export default function Discover() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'popular' | 'new'>('popular');
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const load = async (offset: number) => {
    // L'annuaire ne liste que les identités vérifiées : pas de faux comptes officiels.
    let q = supabase.from('creator_profiles').select('*').eq('verification_status', 'verified').eq('status', 'active');
    const term = query.trim().replace(/^@/, '').replace(/[%,()\\*]/g, '');
    if (term) q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
    if (category) q = q.eq('category', category);
    q = sort === 'popular' ? q.order('member_count', { ascending: false }) : q.order('created_at', { ascending: false });
    const { data } = await q.range(offset, offset + PAGE - 1);
    const rows = (data ?? []) as CreatorProfile[];
    setItems((prev) => (offset === 0 ? rows : [...prev, ...rows]));
    setHasMore(rows.length === PAGE);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => load(0), 250); // évite une requête par frappe
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, category]);

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <T v="title">{t('tabs.discover')}</T>
        <Input value={query} onChangeText={setQuery} placeholder={t('discover.search')} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label={t('discover.popular')} selected={sort === 'popular'} onPress={() => setSort('popular')} />
          <Chip label={t('discover.new')} selected={sort === 'new'} onPress={() => setSort('new')} />
          <View style={{ width: space.sm }} />
          <Chip label={t('discover.all')} selected={!category} onPress={() => setCategory(null)} />
          {CATEGORIES.map((cat) => (
            <Chip key={cat} label={t(`category.${cat}` as MessageKey)} selected={category === cat} onPress={() => setCategory(cat)} />
          ))}
        </ScrollView>
      </View>
      {loading ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CreatorRow creator={item} />}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          ListEmptyComponent={<T v="muted" center style={{ marginTop: space.xxl }}>{t('discover.empty')}</T>}
          ListFooterComponent={hasMore ? <Button label="+" kind="ghost" onPress={() => load(items.length)} /> : undefined}
        />
      )}
    </Screen>
  );
}
