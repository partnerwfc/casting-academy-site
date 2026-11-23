import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@community-safe/shared';
import { Button, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { appleAvailable, continueAnonymously, signInWith } from '@/lib/oauth';
import { WEB_URL } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

// Pas d'e-mail ni de mot de passe : Apple, Google, ou (abonnés uniquement) aucun compte du tout.
export default function SignIn() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session } = useAuth();
  const { next, name } = useLocalSearchParams<{ next?: string; name?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apple, setApple] = useState(false);
  const creatorFlow = next?.startsWith('/studio');

  useEffect(() => { appleAvailable().then(setApple); }, []);

  // Connecté : on reprend le parcours là où il s'était arrêté.
  useEffect(() => {
    if (!session) return;
    if (next) router.replace(next as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/discover');
  }, [session, next]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(errorMessage(locale, e)); } finally { setBusy(false); }
  };

  return (
    <Screen nav={{ close: true }}>
      <View style={{ gap: space.sm }}>
        <T v="title">{t('auth.title')}</T>
        <T v="muted">{name ? t('auth.followIntent', { name }) : t('auth.subtitle')}</T>
      </View>

      <View style={{ gap: space.md }}>
        {apple ? <Button label={` ${t('auth.apple')}`} kind="secondary" onPress={() => run(() => signInWith('apple'))} disabled={busy} /> : null}
        <Button label={t('auth.google')} kind="secondary" onPress={() => run(() => signInWith('google'))} disabled={busy} />
        {creatorFlow ? null : (
          <>
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />
            <Button label={t('auth.anonymous')} onPress={() => run(continueAnonymously)} loading={busy} />
            <T v="small" center>{t('auth.anonymousNote')}</T>
          </>
        )}
      </View>

      {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}

      <T v="small">{t('auth.legal')}</T>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Button label={t('auth.terms')} kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} style={{ minHeight: 32, paddingHorizontal: 0 }} />
        <Button label={t('auth.privacy')} kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} style={{ minHeight: 32, paddingHorizontal: 0 }} />
      </View>
    </Screen>
  );
}
