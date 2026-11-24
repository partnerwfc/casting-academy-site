import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, Switch, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  creatorUrl, formatCount, normalizeHandle, type CreatorProfile, type MessageKey, type NotificationPreferences,
} from '@community-safe/shared';
import { PushPrompt } from '@/components/PushPrompt';
import { Avatar, Button, Card, Loading, Pill, Screen, T, VerifiedBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSecurityGate } from '@/lib/gate';
import { useI18n } from '@/lib/i18n';
import { continueAnonymously } from '@/lib/oauth';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fontFor, space, useColors, tint } from '@/lib/theme';

interface Social { id: string; platform: string; handle: string; url: string | null; verified_at: string | null }

export default function CreatorScreen() {
  const params = useLocalSearchParams<{ handle: string; s?: string }>();
  const handle = normalizeHandle(params.handle ?? '');
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const c = useColors();
  const gate = useSecurityGate();
  const [unread, setUnread] = useState(0);
  const [creator, setCreator] = useState<CreatorProfile | null | undefined>(undefined);
  const [socials, setSocials] = useState<Social[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    const { data } = await supabase.from('creator_profiles').select('*').eq('handle', handle).maybeSingle();
    const row = (data as CreatorProfile | null) ?? null;
    setCreator(row);
    if (!row) return;
    supabase.from('social_accounts').select('id, platform, handle, url, verified_at').eq('creator_id', row.id)
      .then(({ data: s }) => setSocials((s ?? []) as Social[]));
    if (userId) {
      const { data: p } = await supabase.from('notification_preferences').select('*')
        .eq('creator_id', row.id).eq('user_id', userId).maybeSingle();
      setPrefs((p as NotificationPreferences | null) ?? null);
    } else {
      setPrefs(null);
    }
  }, [handle, userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!userId || !creator) return;
    supabase.from('alert_recipients').select('alerts!inner(creator_id)', { count: 'exact', head: true }).eq('user_id', userId).is('opened_at', null).eq('alerts.creator_id', creator.id)
      .then(({ count }) => setUnread(count ?? 0));
  }, [userId, creator]);
  // Clic comptabilisé une fois par ouverture du lien (compteur anonyme).
  useEffect(() => {
    if (handle && params.s) supabase.rpc('record_link_click', { p_handle: handle, p_source: params.s }).then(() => {});
  }, [handle, params.s]);

  if (creator === undefined) return <Loading />;
  if (creator === null) return <Screen nav={{}}><T v="muted" center style={{ marginTop: space.xxl }}>{t('creator.notFound')}</T></Screen>;

  const verified = creator.verification_status === 'verified';

  const follow = async () => {
    setBusy(true);
    // Aucun compte, aucune saisie : un compte anonyme est créé au premier suivi.
    if (!session) {
      try { await continueAnonymously(); } catch { setBusy(false); return; }
    }
    await supabase.rpc('follow_creator', { p_handle: handle, p_source: params.s ?? null });
    await load();
    setBusy(false);
  };

  const unfollow = () => Alert.alert(t('creator.unfollow'), t('creator.unfollowConfirm', { name: creator.display_name }), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('creator.unfollow'), style: 'destructive',
      onPress: async () => {
        await supabase.from('community_memberships').delete().eq('creator_id', creator.id).eq('user_id', userId!);
        await load();
      },
    },
  ]);

  const updatePrefs = async (next: { sos: boolean; announcements: boolean }) => {
    if (!prefs) return;
    setPrefs({ ...prefs, sos_enabled: next.sos, announcements_enabled: next.announcements }); // retour visuel immédiat
    const { error } = await supabase.rpc('set_notification_preferences', {
      p_creator_id: creator.id, p_sos: next.sos, p_announcements: next.announcements,
    });
    if (error) load();
  };

  const report = () => {
    if (!session) return router.push('/sign-in');
    const send = async (reason: string) => {
      await supabase.from('abuse_reports').insert({ reporter_user_id: userId, creator_id: creator.id, reason });
      Alert.alert(t('creator.reportSent'));
    };
    Alert.alert(t('creator.report'), undefined, [
      { text: 'Impersonation', onPress: () => send('impersonation') },
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Fraud', onPress: () => send('fraud') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const Tile = ({ tint, children }: { tint: string; children: React.ReactNode }) => (
    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
    </View>
  );
  const row = (key: string, icon: React.ReactNode, label: string, right: React.ReactNode, last?: boolean, onPress?: () => void) => (
    <Pressable key={key} disabled={!onPress} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 58, borderBottomWidth: last ? 0 : 1, borderBottomColor: tint('#EEEFF5') }}>
      {icon}<Text style={{ flex: 1, fontSize: 17, color: c.text }}>{label}</Text>{right}
    </Pressable>
  );
  const unreadLabel = unread === 1 ? t('creator.unreadOne') : t('creator.unreadMany', { count: unread });

  return (
    <Screen
      nav={{ back: 'Retour', title: creator.display_name }}
      footer={null}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <View style={{ shadowColor: '#170B2F', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6, marginTop: -6 }}>
          <Avatar name={creator.display_name} url={creator.avatar_url} size={86} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Text style={{ fontSize: 31, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.8 }}>{creator.display_name}</Text>
          {verified ? <VerifiedBadge size={22} /> : null}
        </View>
        <Text style={{ fontSize: 15.5, color: c.muted }}>@{creator.handle} · {t('creator.members', { count: formatCount(locale, creator.member_count) })}</Text>
        {verified || !gate ? null : <Pill label={t('creator.unverified')} />}
        {creator.bio ? <Text style={{ fontSize: 16.5, lineHeight: 24, color: c.text, textAlign: 'center', marginTop: 8, paddingHorizontal: 10 }}>{creator.bio}</Text> : null}
        <View style={{ marginTop: 14, alignSelf: 'center', width: 230 }}>
          {prefs
            ? <Button label={`✓   ${t('creator.following')}`} kind="neutral" onPress={unfollow} />
            : <Button label={t('creator.follow')} onPress={follow} loading={busy} />}
        </View>
      </View>

      {verified || !gate ? null : <Card tone="sos"><T v="muted">{t('creator.unverifiedWarning')}</T></Card>}

      <View style={{ flexDirection: 'row', gap: 14, backgroundColor: tint('#fff'), borderRadius: 22, padding: 16 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tint('#F0EBFF'), alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#6D28D9" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6z" /></Svg>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontSize: 17, lineHeight: 24, color: c.text, fontFamily: fontFor(700) }}>{t('creator.quote')}</Text>
          <Text style={{ fontSize: 14.5, lineHeight: 21, color: c.muted }}>{t('creator.quoteSub', { name: creator.display_name })}</Text>
        </View>
      </View>

      {prefs ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase', marginLeft: 6 }}>{t('creator.forCommunity')}</Text>
          <View style={{ backgroundColor: tint('#fff'), borderRadius: 22, overflow: 'hidden' }}>
            {row('rec', <Tile tint="#6D28D9"><Path d="M6 9.4a6 6 0 1 1 12 0c0 5.6 2.4 7 2.4 7H3.6S6 15 6 9.4zM9.8 19.8a2.3 2.3 0 0 0 4.4 0" /></Tile>, t('creator.received'),
              <>{unread > 0 ? <Pill label={unreadLabel} tone="sos" /> : null}<Text style={{ color: tint('#B6B9C6'), fontSize: 22 }}>›</Text></>, false, () => router.push('/(tabs)/alerts'))}
            {row('sos', <Tile tint="#E11D48"><Path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.4v.1" /></Tile>, t('creator.sosAlerts'),
              <Switch value={prefs.sos_enabled} onValueChange={(v) => updatePrefs({ sos: v, announcements: prefs.announcements_enabled })} trackColor={{ true: c.primary }} />)}
            {row('ann', <Tile tint="#7C3AED"><Path d="M3 11v3l10 5V6zM13 6l7-3v16l-7-3M6 15v4a2 2 0 0 0 4 0" /></Tile>, t('creator.annAlerts'),
              <Switch value={prefs.announcements_enabled} onValueChange={(v) => updatePrefs({ sos: prefs.sos_enabled, announcements: v })} trackColor={{ true: c.primary }} />, true)}
          </View>
          <PushPrompt />
        </View>
      ) : (
        <T v="small" center>{t('creator.joinBody')}</T>
      )}

      {socials.length ? (
        <Card>
          {socials.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <T v="body" style={{ flex: 1 }}>{s.platform} · {s.handle}{s.verified_at ? ' ✓' : ''}</T>
              {s.url ? <Button label="↗" kind="ghost" style={{ minHeight: 32 }} onPress={() => WebBrowser.openBrowserAsync(s.url!)} /> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
        <Pressable onPress={() => Share.share({ message: creatorUrl(WEB_URL, creator.handle) })}><Text style={{ fontSize: 16, color: c.primary, fontFamily: fontFor(700) }}>{t('detail.share')}</Text></Pressable>
        <Pressable onPress={report}><Text style={{ fontSize: 16, color: c.muted, fontFamily: fontFor(700) }}>{t('creator.report')}</Text></Pressable>
      </View>
    </Screen>
  );
}
