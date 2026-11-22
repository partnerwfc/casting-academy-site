import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { LOCALES } from '@community-safe/shared';
import { PushPrompt } from '@/components/PushPrompt';
import Svg, { Path } from 'react-native-svg';
import { Button, Card, Chip, Row, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { runOAuth } from '@/lib/oauth';
import { supabase, WEB_URL } from '@/lib/supabase';
import { space } from '@/lib/theme';

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

  const ic = (d: string) => <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d={d} /></Svg>;
  const verified = creator?.verification_status === 'verified';
  return (
    <Screen>
      <T v="hero">{t('tabs.profile')}</T>

      {session ? (
        <>
          <Card>
            <T v="heading" style={{ fontSize: 20 }}>{creator?.display_name ?? (session.user.is_anonymous ? t('auth.anonymousUser') : (session.user.email ?? session.user.app_metadata?.provider))}</T>
            {creator ? <T v="muted">{session.user.is_anonymous ? t('auth.anonymousUser') : (session.user.email ?? session.user.app_metadata?.provider)}</T> : null}
          </Card>
          {session.user.is_anonymous ? (
            <Card tone="soft">
              <T v="heading">{t('auth.saveAccount')}</T>
              <T v="muted">{t('auth.saveAccountBody')}</T>
              <Button label={t('auth.google')} kind="secondary" onPress={() => runOAuth('google', true)} />
              <Button label={t('auth.apple')} kind="secondary" onPress={() => runOAuth('apple', true)} />
            </Card>
          ) : null}
          <Section>
            <Row label={creator ? t('profile.creatorSpace') : t('profile.becomeCreator')} value={creator ? (verified ? t('cert.badge') : undefined) : undefined}
              tint="#6D28D9" icon={ic('M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6z')} last
              onPress={() => router.push(creator ? '/studio' : '/studio/setup')} />
          </Section>
          {creator ? (
            <Section title={t('profile.secCreator')}>
              <Row label={t('profile.rowCert')} tint="#24B36B" icon={ic('M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6zM8.8 12l2.4 2.4 4.2-4.4')} onPress={() => router.push('/studio/verify')} />
              <Row label={t('profile.rowPlan')} tint="#633BEE" icon={ic('M3 7h18v10H3zM3 11h18')} last onPress={() => router.push('/studio/plan')} />
            </Section>
          ) : null}
          <Section title={t('profile.secNotifs')}><View style={{ padding: 16 }}><PushPrompt showEnabled /></View></Section>
        </>
      ) : (
        <Button label={t('auth.title')} onPress={() => router.push('/sign-in')} />
      )}

      <Section title={t('profile.secPrefs')}>
        <View style={{ padding: 16, gap: space.sm }}>
          <T v="heading">{t('profile.language')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {LOCALES.map((l) => <Chip key={l} label={LANGUAGE_NAMES[l]} selected={locale === l} onPress={() => changeLocale(l)} />)}
          </View>
        </View>
        <Row label={t('auth.privacy')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
        <Row label={t('auth.terms')} last onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} />
      </Section>

      {session ? (
        <Section>
          <Row label={t('profile.exportData')} onPress={exportData} />
          <Row label={t('auth.signOut')} onPress={async () => { await signOut(); router.replace('/'); }} />
          <Row label={t('profile.deleteAccount')} last onPress={deleteAccount} />
        </Section>
      ) : null}
    </Screen>
  );
}
