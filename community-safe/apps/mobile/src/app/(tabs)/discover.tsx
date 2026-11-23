import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CATEGORIES, formatCount, type CreatorProfile, type MessageKey } from '@community-safe/shared';
import { CreatorRow } from '@/components/CreatorRow';
import { Button, Chip, Input, Loading, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

const PAGE = 30;

export default function Discover() {
  const { t, locale } = useI18n();
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
        <T v="hero">{t('tabs.discover')}</T>
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
          ListHeaderComponent={items.length && !query.trim() && !category && sort === 'popular' ? (
            <View style={{ borderRadius: 28, overflow: 'hidden', padding: space.xl, marginBottom: space.lg, gap: 6 }}>
              <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
                <Defs><LinearGradient id="f" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#170B2F" /><Stop offset="1" stopColor="#6D28D9" /></LinearGradient></Defs>
                <Rect width={10} height={10} fill="url(#f)" />
              </Svg>
              <T v="small" style={{ color: '#C9B8FF', fontWeight: '800', letterSpacing: 0.8 }}>{t('discover.featured')}</T>
              <T v="hero" style={{ color: '#fff', fontSize: 28, lineHeight: 34 }}>{items[0].display_name}</T>
              <T v="muted" style={{ color: '#E4DAFF' }}>{t(`category.${items[0].category}` as MessageKey)} · {t('creator.members', { count: formatCount(locale, items[0].member_count) })}</T>
              <Pressable accessibilityRole="button" onPress={() => router.push(`/creator/${items[0].handle}`)} style={{ alignSelf: 'flex-start', marginTop: space.md, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}>
                <T v="heading" style={{ fontSize: 15 }}>{t('tabs.discover')}</T>
              </Pressable>
            </View>
          ) : undefined}
          ListEmptyComponent={
            <View style={{ gap: space.lg, marginTop: space.xxl }}>
              <T v="muted" center>{t('discover.empty')}</T>
              <Button label={t('profile.becomeCreator')} kind="secondary" onPress={() => router.push('/studio/setup')} />
            </View>
          }
          ListFooterComponent={hasMore ? <Button label="+" kind="ghost" onPress={() => load(items.length)} /> : undefined}
        />
      )}
    </Screen>
  );
}
