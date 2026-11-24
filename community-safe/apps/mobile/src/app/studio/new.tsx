import { Redirect, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatCount } from '@community-safe/shared';
import { Avatar, Button, Card, Loading, Pill, Screen, T, VerifiedBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSecurityGate } from '@/lib/gate';
import { useI18n } from '@/lib/i18n';
import { fontFor, space, useColors } from '@/lib/theme';

function Option({ kind, title, desc, tag }: { kind: 'sos' | 'announcement'; title: string; desc: string; tag: string }) {
  const c = useColors();
  const sos = kind === 'sos';
  const tone = sos ? c.sos : c.primary;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/studio/compose', params: { kind } })}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 14, padding: 18, borderRadius: 26, borderWidth: 1, backgroundColor: '#fff', overflow: 'hidden', borderColor: sos ? '#F8C3CF' : '#DDD3F7', opacity: pressed ? 0.9 : 1, shadowColor: tone, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 })}>
      {sos ? <View style={{ position: 'absolute', left: -14, top: -14, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(225,29,72,0.07)' }} /> : null}
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {sos ? <Path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.4v.1" /> : <Path d="M3 11v3l10 5V6zM13 6l7-3v16l-7-3M6 15v4a2 2 0 0 0 4 0" />}
        </Svg>
      </View>
      <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 21, color: '#170B2F', fontFamily: fontFor(800), letterSpacing: -0.4 }}>{title}</Text>
        <Text style={{ fontSize: 16, lineHeight: 22, color: '#6B7385' }}>{desc}</Text>
        <Pill label={tag} tone={sos ? 'sos' : 'primary'} />
      </View>
    </Pressable>
  );
}

export default function NewAlert() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator } = useAuth();
  const gate = useSecurityGate();
  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio/new' } }} />;
  if (!creator) return <Redirect href="/studio/setup" />;
  const verified = creator.verification_status === 'verified' || !gate;
  return (
    <Screen nav={{ close: true }}>
      <T v="hero">{t('new.title')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4 }}>
        <Avatar name={creator.display_name} url={creator.avatar_url} size={34} />
        <Text style={{ fontSize: 16, color: c.muted }}>{t('new.for')} <Text style={{ color: c.text, fontFamily: fontFor(700) }}>{creator.display_name}</Text> · {t('creator.members', { count: formatCount(locale, creator.member_count) })}</Text>
      </View>
      {verified ? (
        <>
          <Option kind="sos" title={t('new.sosTitle')} desc={t('new.sosDesc')} tag={t('new.sosTag')} />
          <Option kind="announcement" title={t('compose.announceTitle')} desc={t('new.annDesc')} tag={t('new.annTag')} />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 6 }}>
            <VerifiedBadge size={18} />
            <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: c.muted }}>{t('new.certified', { name: creator.display_name })}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={{ opacity: 0.45, gap: space.md }} pointerEvents="none">
            <Option kind="sos" title={t('new.sosTitle')} desc={t('new.sosDesc')} tag={t('new.sosTag')} />
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
