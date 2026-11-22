import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loading, Logo } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fontFor, space } from '@/lib/theme';
import { isConfigured } from '@/lib/supabase';

export default function Welcome() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;
  if (session) return <Redirect href="/(tabs)/communities" />;
  return (
    <View style={{ flex: 1, backgroundColor: '#170B2F' }}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs><LinearGradient id="w" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#170B2F" /><Stop offset=".55" stopColor="#2A1169" /><Stop offset="1" stopColor="#6D28D9" /></LinearGradient></Defs>
        <Rect width={10} height={10} fill="url(#w)" />
      </Svg>
      <SafeAreaView style={{ flex: 1, padding: space.xl }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
          <Logo size={72} />
          <Text style={{ color: '#fff', fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontFamily: fontFor(800) }}>{t('app.promise')}</Text>
          <Text style={{ color: '#D9CFF5', fontSize: 17, lineHeight: 25, fontFamily: fontFor(400) }}>{t('welcome.subtitle')}</Text>
          {isConfigured ? null : <Text style={{ color: '#FFB4C0', fontSize: 13 }}>Configuration manquante : EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text>}
        </View>
        <View style={{ gap: space.md, paddingBottom: space.md }}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/how-it-works')} style={{ minHeight: 54, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#6D28D9', fontSize: 16, fontFamily: fontFor(700) }}>{t('welcome.discover')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/sign-in', params: { next: '/studio' } })} style={{ minHeight: 54, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontFamily: fontFor(700) }}>{t('welcome.creator')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
