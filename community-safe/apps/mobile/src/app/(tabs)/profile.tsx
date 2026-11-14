import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { LOCALES } from '@community-safe/shared';
import { PushPrompt } from '@/components/PushPrompt';
import { Button, Card, Chip, Screen, T } from '@/components/ui';
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

  return (
    <Screen>
      <T v="title">{t('tabs.profile')}</T>

      {session ? (
        <>
          <T v="muted">{session.user.is_anonymous ? t('auth.anonymousUser') : (session.user.email ?? session.user.app_metadata?.provider)}</T>
          {session.user.is_anonymous ? (
            <Card tone="soft">
              <T v="heading">{t('auth.saveAccount')}</T>
              <T v="muted">{t('auth.saveAccountBody')}</T>
              <Button label={t('auth.google')} kind="secondary" onPress={() => runOAuth('google', true)} />
              <Button label={t('auth.apple')} kind="secondary" onPress={() => runOAuth('apple', true)} />
            </Card>
          ) : null}
          <Card>
            <T v="heading">{t('prefs.title')}</T>
            <PushPrompt showEnabled />
          </Card>
          <Button
            label={creator ? t('profile.creatorSpace') : t('profile.becomeCreator')}
            onPress={() => router.push(creator ? '/studio' : '/studio/setup')}
          />
        </>
      ) : (
        <Button label={t('auth.title')} onPress={() => router.push('/sign-in')} />
      )}

      <Card>
        <T v="heading">{t('profile.language')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {LOCALES.map((l) => <Chip key={l} label={LANGUAGE_NAMES[l]} selected={locale === l} onPress={() => changeLocale(l)} />)}
        </View>
      </Card>

      <View>
        <Button label={t('auth.privacy')} kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
        <Button label={t('auth.terms')} kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} />
        {session ? (
          <>
            <Button label={t('profile.exportData')} kind="ghost" onPress={exportData} loading={busy} />
            <Button label={t('auth.signOut')} kind="ghost" onPress={async () => { await signOut(); router.replace('/'); }} />
            <Button label={t('profile.deleteAccount')} kind="danger" onPress={deleteAccount} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
