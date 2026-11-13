import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { errorMessage } from '@community-safe/shared';
import { Button, Input, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

export default function SignIn() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session } = useAuth();
  const { next, name } = useLocalSearchParams<{ next?: string; name?: string }>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

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

  const sendCode = () => run(async () => {
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, data: { locale } },
    });
    if (err) throw err;
    setSent(true);
  });

  const verify = () => run(async () => {
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (err) throw 'invalid_code';
  });

  const withApple = () => run(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error('apple_no_token');
    const { error: err } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (err) throw err;
  });

  const withGoogle = () => run(async () => {
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
    });
    if (err || !data.url) throw err ?? new Error('oauth');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;
    const authCode = Linking.parse(result.url).queryParams?.code;
    if (typeof authCode !== 'string') throw new Error('oauth');
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
    if (exchangeError) throw exchangeError;
  });

  return (
    <Screen>
      <View style={{ gap: space.sm }}>
        <T v="title">{t('auth.title')}</T>
        <T v="muted">{name ? t('auth.followIntent', { name }) : t('auth.subtitle')}</T>
      </View>

      {sent ? (
        <View style={{ gap: space.md }}>
          <T v="muted">{t('auth.codeSent', { email: email.trim() })}</T>
          <Input label={t('auth.codePlaceholder')} value={code} onChangeText={setCode} keyboardType="number-pad"
            autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} autoFocus />
          <Button label={t('auth.verify')} onPress={verify} loading={busy} disabled={code.trim().length < 6} />
          <Button label={t('common.back')} kind="ghost" onPress={() => { setSent(false); setCode(''); }} />
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          {appleAvailable ? <Button label={` ${t('auth.apple')}`} kind="secondary" onPress={withApple} disabled={busy} /> : null}
          <Button label={t('auth.google')} kind="secondary" onPress={withGoogle} disabled={busy} />
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />
          <Input label={t('auth.email')} value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <Button label={t('auth.sendCode')} onPress={sendCode} loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} />
        </View>
      )}

      {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}

      <T v="small">{t('auth.legal')}</T>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Button label={t('auth.terms')} kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} style={{ minHeight: 32, paddingHorizontal: 0 }} />
        <Button label={t('auth.privacy')} kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} style={{ minHeight: 32, paddingHorizontal: 0 }} />
      </View>
    </Screen>
  );
}
