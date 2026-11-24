import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CATEGORIES, formatCompact, type CreatorProfile, type MessageKey } from '@community-safe/shared';
import { CreatorRow } from '@/components/CreatorRow';
import { Button, Chip, Loading, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSecurityGate } from '@/lib/gate';
import { useI18n } from '@/lib/i18n';
import { continueAnonymously } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { fontFor, isDark, tint, useColors } from '@/lib/theme';

const PAGE = 30;

function FollowToggle({ following, onPress, label }: { following: boolean; onPress: () => void; label: string }) {
  const c = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  // Petit « pop » à chaque changement d'état (abonné / désabonné).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    scale.setValue(0.78);
    Animated.spring(scale, { toValue: 1, friction: 3.2, tension: 190, useNativeDriver: true }).start();
  }, [following, scale]);
  const press = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: following }} onPress={press}
        style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: following ? c.primary : tint('#fff'), borderWidth: following ? 0 : 1.5, borderColor: isDark() ? '#4A1A3A' : '#DDD3F7' }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={following ? '#fff' : c.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          {following ? <Path d="m5 12.5 4.5 4.5L19 7.5" /> : <Path d="M12 5v14M5 12h14" />}
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

export default function Discover() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session } = useAuth();
  const gate = useSecurityGate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'popular' | 'new'>('popular');
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<CreatorProfile[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const reqId = useRef(0);
  const load = async (offset: number) => {
    const id = ++reqId.current; // une réponse plus ancienne ne remplace jamais la plus récente
    // L'annuaire ne liste que les identités vérifiées : pas de faux comptes officiels.
    let q = supabase.from('creator_profiles').select('*').eq('status', 'active');
    if (gate) q = q.eq('verification_status', 'verified');
    const term = query.trim().replace(/^@/, '').replace(/[%,()\\*]/g, '');
    if (term) q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
    if (category) q = q.eq('category', category);
    q = sort === 'popular' ? q.order('member_count', { ascending: false }) : q.order('created_at', { ascending: false });
    const { data } = await q.range(offset, offset + PAGE - 1);
    if (id !== reqId.current) return;
    const rows = (data ?? []) as CreatorProfile[];
    setItems((prev) => (offset === 0 ? rows : [...prev, ...rows]));
    setHasMore(rows.length === PAGE);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => { setLoading(true); load(0); }, 300); // évite une requête par frappe
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, category, gate]);

  const loadMine = useCallback(async () => {
    if (!session) return setMine(new Set());
    const { data } = await supabase.from('community_memberships').select('creator_id').eq('user_id', session.user.id);
    setMine(new Set(((data ?? []) as { creator_id: string }[]).map((r) => r.creator_id)));
  }, [session]);
  useEffect(() => { loadMine(); }, [loadMine]);

  // Mise à jour immédiate (état du bouton + compteur), puis confirmation serveur ; retour arrière si la requête échoue.
  const apply = (creator: CreatorProfile, follow: boolean) => {
    setMine((prev) => { const n = new Set(prev); if (follow) n.add(creator.id); else n.delete(creator.id); return n; });
    setItems((prev) => prev.map((x) => (x.id === creator.id ? { ...x, member_count: Math.max(0, x.member_count + (follow ? 1 : -1)) } : x)));
  };
  const toggle = async (creator: CreatorProfile) => {
    if (mine.has(creator.id)) {
      return Alert.alert(t('creator.unfollow'), t('creator.unfollowConfirm', { name: creator.display_name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('creator.unfollow'), style: 'destructive', onPress: async () => {
          apply(creator, false);
          const { error } = await supabase.from('community_memberships').delete().eq('creator_id', creator.id).eq('user_id', session!.user.id);
          if (error) apply(creator, true);
          loadMine(); load(0);
        } },
      ]);
    }
    if (!session) { try { await continueAnonymously(); } catch { return; } }
    apply(creator, true);
    const { error } = await supabase.rpc('follow_creator', { p_handle: creator.handle, p_source: null });
    if (error) apply(creator, false);
    loadMine(); load(0); // relit les vrais compteurs
  };

  const featured = items.length && !query.trim() && !category && sort === 'popular' ? items[0] : null;
  const list = featured ? items.slice(1) : items;

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ gap: 6 }}>
        <T v="hero">{t('tabs.discover')}</T>
        <Text style={{ fontSize: 14.5, color: c.muted, fontFamily: fontFor(400) }}>{t('discover.subtitle')}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: tint('#fff'), borderRadius: 18, paddingHorizontal: 16, height: 52, shadowColor: '#170B2F', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round"><Circle cx="10.8" cy="10.8" r="6.8" /><Path d="m20.4 20.4-4.8-4.8" /></Svg>
        <TextInput value={query} onChangeText={setQuery} placeholder={t('discover.search')} placeholderTextColor="#8B90A0" autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          style={{ flex: 1, fontSize: 16, color: c.text, fontFamily: fontFor(400) }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        <Chip label={t('discover.popular')} selected={sort === 'popular'} onPress={() => setSort('popular')} />
        <Chip label={t('discover.new')} selected={sort === 'new'} onPress={() => setSort('new')} />
        {CATEGORIES.map((cat) => <Chip key={cat} label={t(`category.${cat}` as MessageKey)} selected={category === cat} onPress={() => setCategory(category === cat ? null : cat)} />)}
      </ScrollView>
      {featured ? (
        <View style={{ borderRadius: 28, overflow: 'hidden', padding: 22, minHeight: 176, justifyContent: 'space-between' }}>
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs><LinearGradient id="f" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#1B0B3B" /><Stop offset="0.55" stopColor="#3B1D8A" /><Stop offset="1" stopColor="#6D4AD0" /></LinearGradient></Defs>
            <Rect width={100} height={100} fill="url(#f)" />
          </Svg>
          <View style={{ gap: 2 }}>
            <Text style={{ color: '#C9B8FF', fontSize: 12, letterSpacing: 1, fontFamily: fontFor(800) }}>{t('discover.featured')}</Text>
            <Text style={{ color: '#fff', fontSize: 26, fontFamily: fontFor(800), letterSpacing: -0.4 }}>{featured.display_name}</Text>
            <Text style={{ color: '#E4DAFF', fontSize: 15 }}>{t(`category.${featured.category}` as MessageKey)} · {t('creator.members', { count: formatCompact(locale, featured.member_count) })}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/creator/${featured.handle}`)} style={{ alignSelf: 'flex-start', backgroundColor: tint('#fff'), borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, marginTop: 14 }}>
            <Text style={{ fontSize: 15, color: c.text, fontFamily: fontFor(700) }}>{t('tabs.discover')}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ fontSize: 22, lineHeight: 28, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.4, width: 190 }}>{t('discover.popularTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, paddingBottom: 4 }}>{t(items.length === 1 ? 'discover.countOne' : 'discover.count', { count: items.length })}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <CreatorRow creator={item} trailing={<FollowToggle following={mine.has(item.id)} label={t(mine.has(item.id) ? 'creator.following' : 'creator.follow')} onPress={() => toggle(item)} />} />}
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 100 }}
        ListEmptyComponent={loading ? <View style={{ marginTop: 24 }}><Loading /></View> : (
          <View style={{ gap: 16, marginTop: 24 }}>
            <T v="muted" center>{t('discover.empty')}</T>
            <Button label={t('profile.becomeCreator')} kind="secondary" onPress={() => router.push('/studio/setup')} />
          </View>
        )}
        ListFooterComponent={hasMore ? <Button label="+" kind="ghost" onPress={() => load(items.length)} /> : undefined}
      />
    </View>
  );
}
