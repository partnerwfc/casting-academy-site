import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '@community-safe/shared';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { appleAvailable, signInWith } from '@/lib/oauth';
import { isConfigured, WEB_URL } from '@/lib/supabase';
import { fontFor } from '@/lib/theme';

const MOSAIC = require('../../assets/images/welcome-mosaic.jpg');
const LOGO = require('../../assets/images/icon.png');

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
      <Path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.2 1-3.8 1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
      <Path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.2H2.1a11 11 0 0 0 0 9.6z" />
      <Path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.2L5.7 10c.9-2.6 3.4-4.6 6.3-4.6z" />
    </Svg>
  );
}

export default function Welcome() {
  const { session, loading } = useAuth();
  const { t, locale } = useI18n();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { appleAvailable().then(setApple); }, []);
  if (loading) return <Loading />;
  if (session) return <Redirect href="/how-it-works" />;

  const run = async (provider: 'apple' | 'google') => {
    setBusy(true); setError(null);
    try { await signInWith(provider); } catch (e) { setError(errorMessage(locale, e)); } finally { setBusy(false); }
  };
  const link = (label: string, path: string) => (
    <Text style={{ textDecorationLine: 'underline', color: '#fff' }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)}>{label}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#170B2F' }}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs><LinearGradient id="w" x1="0.2" y1="0.4" x2="1" y2="1"><Stop offset="0" stopColor="#170B2F" /><Stop offset="0.65" stopColor="#1D0F45" /><Stop offset="1" stopColor="#6D28D9" /></LinearGradient></Defs>
        <Rect width={10} height={10} fill="url(#w)" />
      </Svg>
      <Image source={MOSAIC} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }} />
      <Image source={LOGO} style={{ position: 'absolute', top: 296, alignSelf: 'center', width: 88, height: 88, borderRadius: 22 }} accessibilityLabel="SaveMyCommunity" />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'flex-end' }} edges={['bottom', 'left', 'right']}>
        <View style={{ alignItems: 'center', gap: 14, paddingBottom: 18 }}>
          <Text style={{ color: '#fff', fontSize: 32, lineHeight: 36, letterSpacing: -0.8, textAlign: 'center', fontFamily: fontFor(800) }}>
            {t('welcome.title1')}{'\n'}<Text style={{ color: '#FF6B9A' }}>{t('welcome.title2')}</Text>
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 23, textAlign: 'center', paddingHorizontal: 6 }}>{t('welcome.subtitle')}</Text>
          {isConfigured ? null : <Text style={{ color: '#FFB4C0', fontSize: 13 }}>Configuration manquante (EXPO_PUBLIC_SUPABASE_*).</Text>}
        </View>
        <View style={{ gap: 12 }}>
          {apple ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => run('apple')} style={{ height: 54, borderRadius: 27, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontSize: 20, color: '#000', marginTop: -2 }}></Text>
              <Text style={{ color: '#000', fontSize: 16.5, fontFamily: fontFor(700) }}>{t('auth.apple')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => run('google')} style={{ height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy ? 0.6 : 1 }}>
            <GoogleG />
            <Text style={{ color: '#fff', fontSize: 16.5, fontFamily: fontFor(700) }}>{t('auth.google')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/sign-in', params: { next: '/studio' } })} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontFamily: fontFor(700) }}>{t('welcome.creator')}  →</Text>
          </Pressable>
          {error ? <Text style={{ color: '#FFB4C0', fontSize: 13, textAlign: 'center' }}>{error}</Text> : null}
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17, textAlign: 'center', paddingBottom: 6 }}>
            {t('welcome.legalPre')} {link(t('welcome.termsShort'), '/terms')} {t('welcome.legalAnd')} {link(t('welcome.privacyShort'), '/privacy')}.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
