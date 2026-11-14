import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  formatCount, normalizeHandle, type CreatorProfile, type MessageKey, type NotificationPreferences,
} from '@community-safe/shared';
import { PushPrompt } from '@/components/PushPrompt';
import { Avatar, Button, Card, Loading, Pill, Screen, SwitchRow, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { continueAnonymously } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

interface Social { id: string; platform: string; handle: string; url: string | null; verified_at: string | null }

export default function CreatorScreen() {
  const params = useLocalSearchParams<{ handle: string; s?: string }>();
  const handle = normalizeHandle(params.handle ?? '');
  const { t, locale } = useI18n();
  const { session } = useAuth();
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
  // Clic comptabilisé une fois par ouverture du lien (compteur anonyme).
  useEffect(() => {
    if (handle && params.s) supabase.rpc('record_link_click', { p_handle: handle, p_source: params.s }).then(() => {});
  }, [handle, params.s]);

  if (creator === undefined) return <Loading />;
  if (creator === null) return <Screen><T v="muted" center style={{ marginTop: space.xxl }}>{t('creator.notFound')}</T></Screen>;

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

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <Avatar name={creator.display_name} url={creator.avatar_url} size={96} />
        <T v="title" center>{creator.display_name}</T>
        <T v="muted">@{creator.handle} · {t(`category.${creator.category}` as MessageKey)}</T>
        <Pill label={verified ? `✓ ${t('creator.verified')}` : t('creator.unverified')} tone={verified ? 'primary' : 'neutral'} />
        <T v="small">{t('creator.members', { count: formatCount(locale, creator.member_count) })}</T>
        {creator.bio ? <T v="body" center>{creator.bio}</T> : null}
      </View>

      {verified ? null : <Card tone="sos"><T v="muted">{t('creator.unverifiedWarning')}</T></Card>}

      {prefs ? (
        <>
          <Card>
            <T v="small" style={{ fontWeight: '700' }}>{t('prefs.title').toUpperCase()}</T>
            <SwitchRow title={t('prefs.sos')} desc={t('prefs.sosDesc')} value={prefs.sos_enabled}
              onChange={(v) => updatePrefs({ sos: v, announcements: prefs.announcements_enabled })} />
            <SwitchRow title={t('prefs.announcements')} desc={t('prefs.announcementsDesc')} value={prefs.announcements_enabled}
              onChange={(v) => updatePrefs({ sos: prefs.sos_enabled, announcements: v })} />
          </Card>
          <PushPrompt />
          <Button label={t('creator.unfollow')} kind="ghost" onPress={unfollow} />
        </>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button label={t('creator.follow')} onPress={follow} loading={busy} />
          <T v="small" center>{t('creator.joinBody')}</T>
        </View>
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

      <Button label={t('creator.report')} kind="danger" onPress={report} />
    </Screen>
  );
}
