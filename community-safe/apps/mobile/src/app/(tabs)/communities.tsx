import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { CreatorProfile } from '@community-safe/shared';
import { CreatorRow } from '@/components/CreatorRow';
import { PushPrompt } from '@/components/PushPrompt';
import { Button, Loading, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { fontFor, useColors } from '@/lib/theme';
import { useSecurityGate } from '@/lib/gate';
import { useUnreadCount } from '@/lib/unread';

function Bell({ dot }: { dot: boolean }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#170B2F', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#170B2F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 9.4a6 6 0 1 1 12 0c0 5.6 2.4 7 2.4 7H3.6S6 15 6 9.4zM9.8 19.8a2.3 2.3 0 0 0 4.4 0" />
      </Svg>
      {dot ? <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F43F5E' }} /> : null}
    </View>
  );
}

function ActionCard({ kind, title, desc, onPress }: { kind: 'sos' | 'announcement'; title: string; desc: string; onPress: () => void }) {
  const sos = kind === 'sos';
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: sos ? '#E11D48' : '#F0EBFF', shadowColor: sos ? '#E11D48' : 'transparent', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: sos ? 6 : 0 }}>
      {sos ? (
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs><LinearGradient id="sg" x1="0" y1="0" x2="1" y2="0.4"><Stop offset="0" stopColor="#FF3358" /><Stop offset="0.6" stopColor="#E11D48" /><Stop offset="1" stopColor="#C8346A" /></LinearGradient></Defs>
          <Rect width={100} height={100} fill="url(#sg)" />
          <Circle cx={92} cy={20} r={46} fill="#fff" fillOpacity={0.1} />
        </Svg>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 }}>
        <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: sos ? 'rgba(255,255,255,0.22)' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={sos ? '#fff' : '#6D28D9'} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            {sos ? <Path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.4v.1" /> : <Path d="M3 11v3l10 5V6zM13 6l7-3v16l-7-3M6 15v4a2 2 0 0 0 4 0" />}
          </Svg>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 20, color: sos ? '#fff' : '#170B2F', fontFamily: fontFor(800) }}>{title}</Text>
          <Text style={{ fontSize: 14.5, lineHeight: 20, color: sos ? 'rgba(255,255,255,0.92)' : '#6B7385', fontFamily: fontFor(400) }}>{desc}</Text>
        </View>
        <Text style={{ color: sos ? '#fff' : '#6D28D9', fontSize: 26 }}>›</Text>
      </View>
    </Pressable>
  );
}

export default function Communities() {
  const { t } = useI18n();
  const c = useColors();
  const { session, creator } = useAuth();
  const unread = useUnreadCount();
  const gate = useSecurityGate();
  const [items, setItems] = useState<CreatorProfile[] | null>(null);
  const [sosBy, setSosBy] = useState<Record<string, number>>({});

  useFocusEffect(useCallback(() => {
    if (!session) return setItems([]);
    supabase.from('community_memberships').select('created_at, creator_profiles(*)').order('created_at', { ascending: false })
      .then(({ data }) => setItems(((data ?? []) as unknown as { creator_profiles: CreatorProfile | null }[])
        .map((r) => r.creator_profiles).filter((x): x is CreatorProfile => !!x)));
    supabase.from('alert_recipients').select('alerts!inner(creator_id, kind)').eq('user_id', session.user.id).is('opened_at', null)
      .then(({ data }) => {
        const by: Record<string, number> = {};
        for (const r of (data ?? []) as unknown as { alerts: { creator_id: string; kind: string } }[]) if (r.alerts.kind === 'sos') by[r.alerts.creator_id] = (by[r.alerts.creator_id] ?? 0) + 1;
        setSosBy(by);
      });
  }, [session]));

  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = (meta.full_name ?? meta.name ?? '').split(' ')[0];
  const verified = creator?.verification_status === 'verified' || !gate;
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 100, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#A78BFA', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 19, fontFamily: fontFor(700) }}>{(name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, color: c.text, fontFamily: fontFor(800) }}>{name ? t('home.hello', { name }) : t('home.helloAnon')}</Text>
            <Text style={{ fontSize: 14, color: c.muted }}>{t('home.welcome')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('tabs.alerts')} onPress={() => router.push('/(tabs)/alerts')}><Bell dot={unread > 0} /></Pressable>
        </View>

        {creator ? (
          <View style={{ gap: 12 }}>
            <ActionCard kind="sos" title={t('home.sosTitle')} desc={t('home.sosDesc')} onPress={() => router.push(verified ? { pathname: '/studio/compose', params: { kind: 'sos' } } : '/studio/verify')} />
            <ActionCard kind="announcement" title={t('home.annTitle')} desc={t('home.annDesc')} onPress={() => router.push(verified ? { pathname: '/studio/compose', params: { kind: 'announcement' } } : '/studio/verify')} />
          </View>
        ) : null}

        {session && items?.length ? <PushPrompt /> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 22, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.4 }}>{t('home.myCommunities')}</Text>
          <Pressable onPress={() => router.push('/(tabs)/discover')}><Text style={{ fontSize: 15, color: c.primary, fontFamily: fontFor(700) }}>{t('home.seeAll')}</Text></Pressable>
        </View>

        {items === null ? <Loading /> : items.length ? (
          <View>{items.map((it) => <CreatorRow key={it.id} creator={it} badge={sosBy[it.id] ? `${sosBy[it.id]} SOS` : undefined} />)}</View>
        ) : (
          <View style={{ gap: 16, marginTop: 24 }}>
            <T v="muted" center>{t('communities.empty')}</T>
            {session
              ? <Button label={t('welcome.discover')} onPress={() => router.push('/(tabs)/discover')} />
              : <Button label={t('auth.title')} onPress={() => router.push('/sign-in')} />}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
