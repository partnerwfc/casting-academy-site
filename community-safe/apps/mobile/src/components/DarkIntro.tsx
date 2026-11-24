import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '@community-safe/shared';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { appleAvailable, signInWith } from '@/lib/oauth';
import { markIntroSeen } from '@/lib/onboarding';
import { WEB_URL } from '@/lib/supabase';
import { fontFor } from '@/lib/theme';

const LOGO = require('../../assets/images/logo-dark.png');
const PINK = '#FA0973', ORANGE = '#FC8E26', GREY = '#A1A1AA';

// Vague lumineuse rose → orange de la maquette sombre.
function Wave({ top, height = 150 }: { top: number; height?: number }) {
  return (
    <Svg style={{ position: 'absolute', left: 0, right: 0, top }} width="100%" height={height} viewBox="0 0 390 150" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="wv" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={PINK} /><Stop offset="0.55" stopColor="#FF2D6A" /><Stop offset="1" stopColor={ORANGE} /></LinearGradient>
      </Defs>
      <Path d="M-10 92 C70 30 150 110 240 70 S350 20 400 52" stroke="url(#wv)" strokeOpacity={0.07} strokeWidth={120} fill="none" strokeLinecap="round" />
      <Path d="M-10 92 C70 30 150 110 240 70 S350 20 400 52" stroke="url(#wv)" strokeOpacity={0.13} strokeWidth={86} fill="none" strokeLinecap="round" />
      <Path d="M-10 92 C70 30 150 110 240 70 S350 20 400 52" stroke="url(#wv)" strokeOpacity={0.28} strokeWidth={50} fill="none" strokeLinecap="round" />
      <Path d="M-10 92 C70 30 150 110 240 70 S350 20 400 52" stroke="url(#wv)" strokeWidth={13} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
const Dots = ({ i }: { i: number }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
    {[0, 1, 2].map((k) => <View key={k} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: k === i ? PINK : '#3A3A42' }} />)}
  </View>
);
const Card = ({ icon, title, body, tone }: { icon: string; title: string; body: string; tone: 'pink' | 'orange' }) => (
  <View style={{ flexDirection: 'row', gap: 16, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: tone === 'pink' ? '#3A1030' : '#3A2210', backgroundColor: tone === 'pink' ? '#14080F' : '#150C08' }}>
    <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: tone === 'pink' ? '#3A1030' : '#3A2210', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={30} height={30} viewBox="0 0 24 24" fill={tone === 'pink' ? PINK : ORANGE} stroke={tone === 'pink' ? PINK : ORANGE} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><Path d={icon} /></Svg>
    </View>
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ fontSize: 21, color: '#fff', fontFamily: fontFor(800), letterSpacing: -0.4 }}>{title}</Text>
      <Text style={{ fontSize: 16.5, lineHeight: 23, color: '#C4C4CC' }}>{body}</Text>
    </View>
  </View>
);
const USERS = 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20c0-3.300 2.800-5.500 6.500-5.500s6.500 2.200 6.500 5.500M17 4.500a3.500 3.500 0 0 1 0 6.500M18 14.600c2.400.6 3.800 2.600 3.800 5.400z';
const SHIELD = 'M12 3l7.500 3v5.600c0 4.400-3 7.700-7.500 9.400-4.500-1.700-7.500-5-7.500-9.400V6z';

export function DarkIntro({ startLogin }: { startLogin?: boolean }) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const [step, setStep] = useState(startLogin ? 2 : 0);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => { appleAvailable().then(setApple); }, []);
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    if (step === 2) markIntroSeen();
  }, [step, anim]);
  useEffect(() => { if (session && step === 2) router.replace('/ready'); }, [session, step]);
  const run = async (provider: 'apple' | 'google') => {
    setBusy(true); setError(null);
    try { await signInWith(provider); } catch (e) { setError(errorMessage(locale, e)); } finally { setBusy(false); }
  };
  const motion = { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] };
  const ghost = (label: string, onPress: () => void) => <Pressable onPress={onPress} style={{ alignItems: 'center', paddingVertical: 14 }}><Text style={{ color: GREY, fontSize: 17 }}>{label}</Text></Pressable>;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 22 }}>
        <Animated.View style={[{ flex: 1 }, motion]}>
          {step === 0 ? (
            <>
              <Wave top={290} height={190} />
              <View style={{ alignItems: 'center', paddingTop: 70 }}><Image source={LOGO} style={{ width: 190, height: 185 }} resizeMode="contain" accessibilityLabel="SaveMyCommunity" /></View>
              <View style={{ flex: 1, justifyContent: 'flex-end', gap: 14, paddingBottom: 12 }}>
                <Text style={{ fontSize: 40, color: '#fff', fontFamily: fontFor(800), letterSpacing: -1.2, textAlign: 'center' }}>{t('dk.s1t')}</Text>
                <Text style={{ fontSize: 20, lineHeight: 28, color: '#B5B5BD', textAlign: 'center', paddingHorizontal: 10 }}>{t('dk.s1b')}</Text>
                <View style={{ marginVertical: 12 }}><Dots i={0} /></View>
                <Button label={t('dk.discover')} onPress={() => setStep(1)} />
                {ghost(t('dk.skip'), () => setStep(2))}
              </View>
            </>
          ) : step === 1 ? (
            <>
              <View style={{ paddingTop: 30, gap: 10 }}>
                <Text style={{ fontSize: 34, color: '#fff', fontFamily: fontFor(800), letterSpacing: -0.9 }}>{t('dk.s2t')}</Text>
                <Text style={{ fontSize: 19, lineHeight: 27, color: '#B5B5BD' }}>{t('dk.s2b')}</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
                <Card tone="pink" icon={USERS} title={t('intro.followT')} body={t('intro.followB')} />
                <Card tone="orange" icon={SHIELD} title={t('intro.creatorT')} body={t('intro.creatorB')} />
              </View>
              <View style={{ gap: 14, paddingBottom: 12 }}>
                <Dots i={1} />
                <Button label={t('common.continue')} onPress={() => setStep(2)} />
                {ghost(t('common.back'), () => setStep(0))}
              </View>
            </>
          ) : (
            <>
              <Wave top={560} height={190} />
              <View style={{ alignItems: 'center', paddingTop: 50, gap: 16 }}>
                <Image source={LOGO} style={{ width: 170, height: 165 }} resizeMode="contain" accessibilityLabel="SaveMyCommunity" />
                <Text style={{ fontSize: 34, color: '#fff', fontFamily: fontFor(800), letterSpacing: -0.9, marginTop: 8 }}>{t('signin.title')}</Text>
                <Text style={{ fontSize: 19, lineHeight: 27, color: '#B5B5BD', textAlign: 'center', paddingHorizontal: 24 }}>{t('signin.sub')}</Text>
              </View>
              <View style={{ gap: 14, marginTop: 28 }}>
                {apple ? (
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => run('apple')} style={{ height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: '#2A2A32', backgroundColor: '#050505', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy ? 0.6 : 1 }}>
                    <Text style={{ fontSize: 24, color: '#fff', marginTop: -2 }}></Text>
                    <Text style={{ color: '#fff', fontSize: 18, fontFamily: fontFor(700) }}>{t('auth.apple')}</Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => run('google')} style={{ height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: '#2A2A32', backgroundColor: '#050505', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: busy ? 0.6 : 1 }}>
                  <Svg width={24} height={24} viewBox="0 0 24 24">
                    <Path fill="#4285F4" d="M22.500 12.200c0-.8-.1-1.500-.2-2.200H12v4.200h5.900a5 5 0 0 1-2.200 3.300v2.700h3.500c2.100-1.900 3.300-4.700 3.300-8z" />
                    <Path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.500-2.700c-1 .7-2.200 1-3.800 1-2.900 0-5.400-2-6.300-4.600H2.100v2.800A11 11 0 0 0 12 23z" />
                    <Path fill="#FBBC05" d="M5.700 14c-.2-.7-.4-1.300-.4-2s.1-1.400.4-2V7.200H2.100a11 11 0 0 0 0 9.600z" />
                    <Path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.700l3.100-3.100A11 11 0 0 0 2.100 7.200L5.700 10c.9-2.600 3.400-4.600 6.300-4.600z" />
                  </Svg>
                  <Text style={{ color: '#fff', fontSize: 18, fontFamily: fontFor(700) }}>{t('auth.google')}</Text>
                </Pressable>
                {error ? <Text style={{ color: '#FF3355', fontSize: 13, textAlign: 'center' }}>{error}</Text> : null}
              </View>
              <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 14 }}>
                <Text style={{ color: '#D4D4D8', fontSize: 16, lineHeight: 24, textAlign: 'center' }}>
                  {t('dk.legalPre')}{' '}
                  <Text style={{ color: PINK, textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)}>{t('auth.terms')}</Text> {t('ob.and')}{' '}
                  <Text style={{ color: PINK, textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}>{t('auth.privacy')}</Text>.
                </Text>
              </View>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
