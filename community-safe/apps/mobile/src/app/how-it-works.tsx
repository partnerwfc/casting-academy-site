import { router } from 'expo-router';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { space, useColors } from '@/lib/theme';

function Ico({ kind, tint, bg }: { kind: 'join' | 'bell' | 'shield'; tint: string; bg: string }) {
  const p = { stroke: tint, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        {kind === 'join' ? <><Circle cx="9" cy="8" r="3.4" {...p} /><Path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6M18 8v5M15.5 10.5h5" {...p} /></> : null}
        {kind === 'bell' ? <><Path d="M6 9.4a6 6 0 1 1 12 0c0 5.6 2.4 7 2.4 7H3.6S6 15 6 9.4zM9.8 19.8a2.3 2.3 0 0 0 4.4 0" {...p} /></> : null}
        {kind === 'shield' ? <><Path d="M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6z" {...p} /><Path d="m8.8 12 2.4 2.4 4.2-4.4" {...p} /></> : null}
      </Svg>
    </View>
  );
}

export default function HowItWorks() {
  const { t } = useI18n();
  const c = useColors();
  const rows = [
    { k: 'join' as const, t: t('onb.how.1t'), d: t('onb.how.1d'), tint: c.primary, bg: c.primarySoft },
    { k: 'bell' as const, t: t('onb.how.2t'), d: t('onb.how.2d'), tint: c.sos, bg: c.sosSoft },
    { k: 'shield' as const, t: t('onb.how.3t'), d: t('onb.how.3d'), tint: c.primary, bg: c.primarySoft },
  ];
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <View style={{ gap: space.sm }}>
          <T v="small" style={{ fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('onb.how.kicker')}</T>
          <T v="hero">{t('onb.how.title')}</T>
        </View>
        {rows.map((r) => (
          <View key={r.k} style={{ flexDirection: 'row', gap: space.md }}>
            <Ico kind={r.k} tint={r.tint} bg={r.bg} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="heading" style={{ fontSize: 18 }}>{r.t}</T>
              <T v="muted">{r.d}</T>
            </View>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: '#EEEFF5', borderRadius: 16, padding: space.lg }}><T v="small" style={{ fontSize: 14, lineHeight: 20 }}>{t('onb.how.info')}</T></View>
      <Button label={t('common.continue')} onPress={() => router.push('/notifications-intro')} />
    </Screen>
  );
}
