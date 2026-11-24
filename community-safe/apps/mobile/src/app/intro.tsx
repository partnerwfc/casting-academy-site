import { router } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { markIntroSeen } from '@/lib/onboarding';
import { fontFor } from '@/lib/theme';

const LOGO = require('../../assets/images/icon.png');

// Première ouverture : deux présentations très courtes, sans choix de profil.
export default function Intro() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const next = async () => {
    if (step === 0) return setStep(1);
    await markIntroSeen();
    router.replace('/');
  };
  const block = (title: string, body: string) => (
    <View style={{ gap: 8 }} key={title}>
      <Text style={{ color: '#fff', fontSize: 21, fontFamily: fontFor(800), letterSpacing: -0.4 }}>{title}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16.5, lineHeight: 24 }}>{body}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#170B2F' }}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs><LinearGradient id="i" x1="0.2" y1="0.2" x2="1" y2="1"><Stop offset="0" stopColor="#170B2F" /><Stop offset="0.7" stopColor="#1D0F45" /><Stop offset="1" stopColor="#5B21D6" /></LinearGradient></Defs>
        <Rect width={10} height={10} fill="url(#i)" />
      </Svg>
      <SafeAreaView style={{ flex: 1, padding: 26 }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
          <Image source={LOGO} style={{ width: 76, height: 76, borderRadius: 19 }} accessibilityLabel="SaveMyCommunity" />
          {step === 0 ? (
            <View style={{ gap: 16 }}>
              <Text style={{ color: '#fff', fontSize: 33, lineHeight: 38, letterSpacing: -0.9, fontFamily: fontFor(800) }}>{t('intro.t1')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 17.5, lineHeight: 26 }}>{t('intro.b1')}</Text>
            </View>
          ) : (
            <View style={{ gap: 26 }}>
              <Text style={{ color: '#fff', fontSize: 30, lineHeight: 35, letterSpacing: -0.8, fontFamily: fontFor(800) }}>{t('intro.t2')}</Text>
              {block(t('intro.followT'), t('intro.followB'))}
              {block(t('intro.creatorT'), t('intro.creatorB'))}
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
          {[0, 1].map((i) => <View key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? '#fff' : 'rgba(255,255,255,0.3)' }} />)}
        </View>
        <Button label={t('common.continue')} onPress={next} style={{ backgroundColor: '#fff' }} />
      </SafeAreaView>
    </View>
  );
}
