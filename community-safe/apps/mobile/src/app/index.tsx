import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { Button, Loading, Logo, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { space } from '@/lib/theme';
import { isConfigured } from '@/lib/supabase';

export default function Welcome() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;
  if (session) return <Redirect href="/(tabs)/communities" />;
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
        <Logo size={64} />
        <T v="small" style={{ letterSpacing: 1.2, fontWeight: '700' }}>SAVEMYCOMMUNITY</T>
        <T v="hero">{t('app.promise')}</T>
        <T v="muted" style={{ fontSize: 17, lineHeight: 25 }}>{t('welcome.subtitle')}</T>
        {isConfigured ? null : <T v="small" style={{ color: '#DC2626' }}>Configuration manquante : EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.</T>}
      </View>
      <View style={{ gap: space.md, paddingBottom: space.xl }}>
        <Button label={t('welcome.discover')} onPress={() => router.push('/(tabs)/discover')} />
        <Button label={t('welcome.creator')} kind="secondary" onPress={() => router.push({ pathname: '/sign-in', params: { next: '/studio' } })} />
      </View>
    </Screen>
  );
}
