import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LOCALES } from '@community-safe/shared';
import { PushPrompt } from '@/components/PushPrompt';
import { ScrollView } from 'react-native';
import { formatCompact } from '@community-safe/shared';
import Svg, { Path } from 'react-native-svg';
import { Avatar, Button, Card, Pill, Row, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { runOAuth } from '@/lib/oauth';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fontFor, space, useColors } from '@/lib/theme';

const LANGUAGE_NAMES = { en: 'English', fr: 'Français', pt: 'Português', es: 'Español' } as const;

export default function Profile() {
  const { t, locale, setLocale } = useI18n();
  const { session, creator, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const changeLocale = (l: (typeof LOCALES)[number]) => {
    setLocale(l);
    // La langue des notifications suit celle du profil.
    if (session) supabase.from('users').update({ locale: l }).eq('id', session.user.id).then(() => {});
  };

  const exportData = async () => {
    setBusy(true);
    const { data } = await supabase.rpc('export_my_data');
    setBusy(false);
    if (data) await Share.share({ title: 'community-safe-data.json', message: JSON.stringify(data, null, 2) });
  };

  // Créateur : la suppression emporte sa communauté, elle se fait sur l'écran Formule avec confirmation du pseudo.
  const deleteAccount = () => {
    if (creator) return router.push('/studio/plan');
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'), style: 'destructive',
        onPress: async () => {
          const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
          if (error || data?.ok !== true) return Alert.alert(t('account.deleteFail'));
          await supabase.auth.signOut({ scope: 'local' });
          router.replace('/');
        },
      },
    ]);
  };

  const c = useColors();
  const top = useSafeAreaInsets().top + 8;
  const [prefs, setPrefs] = useState<{ creator_id: string; sos_enabled: boolean; announcements_enabled: boolean }[]>([]);
  const [sub, setSub] = useState<{ plan_id: string } | null>(null);
  const [plan, setPlan] = useState<{ price_cents: number | null; price_month_cents: number | null } | null>(null);
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    supabase.from('notification_preferences').select('creator_id, sos_enabled, announcements_enabled').eq('user_id', userId).then(({ data }) => setPrefs((data ?? []) as typeof prefs));
  }, [userId]);
  useEffect(() => {
    if (!creator) return;
    supabase.from('plans').select('id, price_cents, price_month_cents').eq('id', creator.plan_id).maybeSingle().then(({ data }) => setPlan(data as typeof plan));
    void sub; void setSub;
  }, [creator]);
  const allSos = prefs.every((p) => p.sos_enabled);
  const allAnn = prefs.every((p) => p.announcements_enabled);
  const setAll = async (sos: boolean, announcements: boolean) => {
    setPrefs((prev) => prev.map((p) => ({ ...p, sos_enabled: sos, announcements_enabled: announcements })));
    await Promise.all(prefs.map((p) => supabase.rpc('set_notification_preferences', { p_creator_id: p.creator_id, p_sos: sos, p_announcements: announcements })));
  };
  const chooseLanguage = () => Alert.alert(t('profile.language'), undefined, [
    ...LOCALES.map((l) => ({ text: LANGUAGE_NAMES[l], onPress: () => changeLocale(l) })),
    { text: t('common.cancel'), style: 'cancel' as const },
  ]);
  const ic = (d: string) => <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d={d} /></Svg>;
  const verified = creator?.verification_status === 'verified';
  const provider = session?.user.app_metadata?.provider;
  const who = session?.user.is_anonymous ? t('auth.anonymousUser') : provider === 'apple' ? t('profile.withApple') : provider === 'google' ? t('profile.withGoogle') : (session?.user.email ?? '');
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const displayName = meta.full_name ?? meta.name ?? creator?.display_name ?? (session?.user.is_anonymous ? t('auth.anonymousUser') : session?.user.email ?? '');
  const price = plan && plan.price_cents ? `${new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(plan.price_cents / 100)}${t('plan.perYearShort')}` : t('plan.free');
  const shadow = { shadowColor: '#170B2F', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: top, paddingBottom: 110, gap: 18 }}>
        <T v="hero">{t('tabs.profile')}</T>

        {session ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 22, padding: 16 }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#A78BFA', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 22, fontFamily: fontFor(800) }}>{(displayName || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: 20, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.3 }}>{displayName}</Text>
                <Text style={{ fontSize: 14.5, lineHeight: 20, color: c.muted }}>{who}</Text>
              </View>
            </View>
            {session.user.is_anonymous ? (
              <Card tone="soft">
                <T v="heading">{t('auth.saveAccount')}</T>
                <T v="muted">{t('auth.saveAccountBody')}</T>
                <Button label={t('auth.google')} kind="secondary" onPress={() => runOAuth('google', true)} />
                <Button label={t('auth.apple')} kind="secondary" onPress={() => runOAuth('apple', true)} />
              </Card>
            ) : null}

            <Pressable accessibilityRole="button" onPress={() => router.push(creator ? '/studio' : '/studio/setup')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 22, padding: 14, ...shadow }}>
              {creator ? <Avatar name={creator.display_name} url={creator.avatar_url} size={52} /> : (
                <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>{ic('M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6z')}</View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18.5, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.3 }}>{creator ? t('profile.creatorSpace') : t('profile.becomeCreator')}</Text>
                  {creator && verified ? <Pill label={t('cert.badge')} tone="success" /> : null}
                </View>
                {creator ? <Text style={{ fontSize: 14.5, color: c.muted }}>{creator.display_name} · {t('profile.protectedMembers', { count: formatCompact(locale, creator.member_count) })}</Text> : null}
              </View>
              <Text style={{ color: '#B6B9C6', fontSize: 22 }}>›</Text>
            </Pressable>

            {creator ? (
              <Section title={t('profile.secCreator')}>
                <Row label={t('profile.rowCert')} value={verified ? t('cert.badge') : undefined} tint="#24B36B" icon={ic('M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6zM8.8 12l2.4 2.4 4.2-4.4')} onPress={() => router.push('/studio/verify')} />
                <Row label={t('profile.rowPlan')} value={price} tint="#633BEE" icon={ic('M3 7h18v10H3zM3 11h18')} onPress={() => router.push('/studio/subscription')} />
                <Row label={t('profile.rowHistory')} tint="#E11D48" icon={ic('M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z')} last onPress={() => router.push('/(tabs)/alerts')} />
              </Section>
            ) : null}

            <Section title={t('profile.secNotifs')}>
              <Row label={t('creator.sosAlerts')} last={false} right={<Switch value={allSos} onValueChange={(v) => setAll(v, allAnn)} trackColor={{ true: c.primary }} />} />
              <Row label={t('creator.annAlerts')} last right={<Switch value={allAnn} onValueChange={(v) => setAll(allSos, v)} trackColor={{ true: c.primary }} />} />
            </Section>
            <PushPrompt />
          </>
        ) : (
          <Button label={t('auth.title')} onPress={() => router.push('/sign-in')} />
        )}

        <Section title={t('profile.secPrefs')}>
          <Row label={t('profile.language')} value={LANGUAGE_NAMES[locale]} tint="#16B8E8" icon={ic('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.500 18.400 12 21c-2.500-2.600-3.800-5.600-3.800-9S9.500 5.600 12 3z')} onPress={chooseLanguage} />
          <Row label={t('auth.terms')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} />
          <Row label={t('auth.privacy')} last onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
        </Section>

        {session ? (
          <Section>
            <Row label={t('profile.exportData')} onPress={exportData} />
            <Row label={t('auth.signOut')} onPress={async () => { await signOut(); router.replace('/'); }} />
            <Row label={t('profile.deleteAccount')} last onPress={deleteAccount} right={<Text style={{ color: c.sos, fontSize: 20 }}>›</Text>} />
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}
