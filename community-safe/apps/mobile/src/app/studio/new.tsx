import { Redirect, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatCount } from '@community-safe/shared';
import { Avatar, Button, Card, Loading, Pill, Screen, T, VerifiedBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { space, useColors } from '@/lib/theme';

function Option({ kind, title, desc, tag }: { kind: 'sos' | 'announcement'; title: string; desc: string; tag: string }) {
  const c = useColors();
  const sos = kind === 'sos';
  const tone = sos ? c.sos : c.primary;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/studio/compose', params: { kind } })}
      style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: 24, borderWidth: 1, backgroundColor: c.card, borderColor: sos ? '#FBC5CF' : '#DDD3F7', opacity: pressed ? 0.85 : 1, shadowColor: tone, shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {sos ? <Path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.4v.1" /> : <Path d="M3 11v3l10 5V6zM13 6l7-3v16l-7-3M6 15v4a2 2 0 0 0 4 0" />}
        </Svg>
      </View>
      <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
        <T v="heading" style={{ fontSize: 20, fontWeight: '800' }}>{title}</T>
        <T v="muted">{desc}</T>
        <Pill label={tag} tone={sos ? 'sos' : 'primary'} />
      </View>
    </Pressable>
  );
}

export default function NewAlert() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio/new' } }} />;
  if (!creator) return <Redirect href="/studio/setup" />;
  const verified = creator.verification_status === 'verified';
  return (
    <Screen>
      <T v="hero">{t('new.title')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar name={creator.display_name} url={creator.avatar_url} size={34} />
        <T v="muted">{t('new.for')} <T v="heading" style={{ fontSize: 15 }}>{creator.display_name}</T> · {t('creator.members', { count: formatCount(locale, creator.member_count) })}</T>
      </View>
      {verified ? (
        <>
          <Option kind="sos" title={t('compose.sosTitle')} desc={t('new.sosDesc')} tag={t('new.sosTag')} />
          <Option kind="announcement" title={t('compose.announceTitle')} desc={t('new.annDesc')} tag={t('new.annTag')} />
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <VerifiedBadge size={18} />
            <T v="small" style={{ flex: 1, fontSize: 14, color: c.muted }}>{t('new.certified', { name: creator.display_name })}</T>
          </View>
        </>
      ) : (
        <>
          <View style={{ opacity: 0.45, gap: space.md }} pointerEvents="none">
            <Option kind="sos" title={t('compose.sosTitle')} desc={t('new.sosDesc')} tag={t('new.sosTag')} />
            <Option kind="announcement" title={t('compose.announceTitle')} desc={t('new.annDesc')} tag={t('new.annTag')} />
          </View>
          <Card tone="soft">
            <T v="heading">{t('cert.title')}</T>
            <T v="muted">{t('cert.requiredToSend')}</T>
            <Button label={t('cert.start')} onPress={() => router.push('/studio/verify')} />
          </Card>
        </>
      )}
    </Screen>
  );
}
