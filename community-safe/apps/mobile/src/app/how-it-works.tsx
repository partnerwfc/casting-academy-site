import { router } from 'expo-router';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fontFor, useColors } from '@/lib/theme';

function Ico({ kind, tint, bg }: { kind: 'join' | 'bell' | 'shield'; tint: string; bg: string }) {
  const p = { stroke: tint, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={26} height={26} viewBox="0 0 24 24">
        {kind === 'join' ? <><Circle cx="9" cy="8" r="3.4" {...p} /><Path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6M18 8v5M15.5 10.5h5" {...p} /></> : null}
        {kind === 'bell' ? <Path d="M6 9.4a6 6 0 1 1 12 0c0 5.6 2.4 7 2.4 7H3.6S6 15 6 9.4zM9.8 19.8a2.3 2.3 0 0 0 4.4 0" {...p} /> : null}
        {kind === 'shield' ? <><Path d="M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6z" {...p} /><Path d="m8.8 12 2.4 2.4 4.2-4.4" {...p} /></> : null}
      </Svg>
    </View>
  );
}

export default function HowItWorks() {
  const { t } = useI18n();
  const c = useColors();
  const { session, creator } = useAuth();
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const first = (meta.full_name ?? meta.name ?? creator?.display_name ?? '').split(' ')[0];
  const rows = [
    { k: 'join' as const, t: t('onb.how.1t'), d: t('onb.how.1d'), tint: c.primary, bg: c.primarySoft },
    { k: 'bell' as const, t: t('onb.how.2t'), d: t('onb.how.2d'), tint: c.sos, bg: '#FFE9EE' },
    { k: 'shield' as const, t: t('onb.how.3t'), d: t('onb.how.3d'), tint: c.primary, bg: c.primarySoft },
  ];
  return (
    <Screen bg="#fff" scroll={false} padded={false}
      footer={<>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#EEEFF5', borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6B7385" strokeWidth={1.8} strokeLinecap="round"><Circle cx="12" cy="12" r="9" /><Path d="M12 11v5M12 7.8v.1" /></Svg>
          <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: '#6B7385' }}>{t('onb.how.info')}</Text>
        </View>
        <Button label={t('common.continue')} onPress={() => router.push('/notifications-intro')} />
      </>}>
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 58, gap: 34 }}>
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, letterSpacing: 0.6, color: '#6B7385', fontFamily: fontFor(700), textTransform: 'uppercase' }}>{first ? `${t('onb.how.kicker')} ${first}` : t('onb.how.kicker')}</Text>
          <Text style={{ fontSize: 33, lineHeight: 37, letterSpacing: -1, color: c.text, fontFamily: fontFor(800), width: 250 }}>{t('onb.how.title')}</Text>
        </View>
        <View style={{ gap: 26 }}>
          {rows.map((r) => (
            <View key={r.k} style={{ flexDirection: 'row', gap: 16 }}>
              <Ico kind={r.k} tint={r.tint} bg={r.bg} />
              <View style={{ flex: 1, gap: 3, paddingRight: 40 }}>
                <Text style={{ fontSize: 18.5, color: c.text, fontFamily: fontFor(700), letterSpacing: -0.3 }}>{r.t}</Text>
                <Text style={{ fontSize: 15.5, lineHeight: 22, color: '#6B7385' }}>{r.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
