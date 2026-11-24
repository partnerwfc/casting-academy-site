import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '@community-safe/shared';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { appleAvailable, signInWith } from '@/lib/oauth';
import { markIntroSeen, setRole, type Role } from '@/lib/onboarding';
import { supabase, WEB_URL } from '@/lib/supabase';
import { DarkIntro } from '@/components/DarkIntro';
import { fontFor, isDark } from '@/lib/theme';

const LOGO_DARK = require('../../assets/images/logo-dark.png');
const LOGO_LIGHT = require('../../assets/images/logo-light.png');
const MARK = require('../../assets/images/logo-mark.png');
const TEXT = require('../../assets/images/logo-text-dark.png');
const V = '#6D28D9', INK = '#170B2F', MUTED = '#6B7385';

const Dots = ({ i, n = 3, dark }: { i: number; n?: number; dark?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 9 }}>
    {Array.from({ length: n }, (_, k) => <View key={k} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k === i ? (dark ? '#fff' : V) : dark ? 'rgba(255,255,255,0.35)' : '#D8D3EA' }} />)}
  </View>
);
const Wordmark = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <Image source={MARK} style={{ width: 66, height: 45 }} resizeMode="contain" />
    <Image source={TEXT} style={{ width: 96, height: 31 }} resizeMode="contain" />
  </View>
);
const Cta = ({ label, onPress, light }: { label: string; onPress: () => void; light?: boolean }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ height: 56, borderRadius: 18, backgroundColor: light ? '#fff' : V, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, opacity: pressed ? 0.88 : 1 })}>
    <Text style={{ color: light ? INK : '#fff', fontSize: 17.5, fontFamily: fontFor(700) }}>{label}</Text>
    {light ? <Text style={{ color: INK, fontSize: 22, position: 'absolute', right: 24 }}>→</Text> : null}
  </Pressable>
);
const Check = ({ bold, grey }: { bold: string; grey?: string }) => (
  <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
    <View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: V, alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><Path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
    </View>
    <Text style={{ flex: 1, fontSize: 16.5, lineHeight: 22, color: INK, fontFamily: fontFor(600) }}>{bold}{grey ? <Text style={{ color: MUTED, fontFamily: fontFor(400) }}>{grey}</Text> : null}</Text>
  </View>
);
const Feature = ({ icon, tint, bg, title, desc }: { icon: string; tint: string; bg: string; title: string; desc: string }) => (
  <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
    <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={icon} /></Svg>
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 18, color: INK, fontFamily: fontFor(800), letterSpacing: -0.3 }}>{title}</Text>
      <Text style={{ fontSize: 15, lineHeight: 21, color: MUTED }}>{desc}</Text>
    </View>
  </View>
);
const RoleCard = ({ on, icon, title, desc, onPress }: { on: boolean; icon: string; title: string; desc: string; onPress: () => void }) => (
  <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 22, borderRadius: 24, borderWidth: on ? 1.5 : 1, borderColor: on ? V : '#ECE9F6', backgroundColor: on ? '#F7F3FF' : '#fff', shadowColor: INK, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }}>
    <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={V} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d={icon} /></Svg>
    </View>
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ fontSize: 20, color: INK, fontFamily: fontFor(800), letterSpacing: -0.3 }}>{title}</Text>
      <Text style={{ fontSize: 15.5, lineHeight: 21, color: MUTED }}>{desc}</Text>
    </View>
    <Text style={{ fontSize: 24, color: INK }}>›</Text>
  </Pressable>
);
const Pill = ({ label, icon }: { label: string; icon: string }) => (
  <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: V, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 }}>
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d={icon} /></Svg>
    <Text style={{ color: '#fff', fontSize: 18, fontFamily: fontFor(700) }}>{label}</Text>
  </View>
);
const Sparks = () => (
  <Svg width={46} height={46} viewBox="0 0 46 46" style={{ position: 'absolute', right: 6, top: -4 }}>
    <Path d="M10 36 4 26M24 22l-1-14M37 26l10-8" stroke={V} strokeWidth={3} strokeLinecap="round" />
  </Svg>
);
const ICON = {
  shield: 'M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6zM8.8 12l2.4 2.4 4.2-4.4',
  bell: 'M6 9.4a6 6 0 1 1 12 0c0 5.6 2.4 7 2.4 7H3.6S6 15 6 9.4zM9.8 19.8a2.3 2.3 0 0 0 4.4 0',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  userPlus: 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20c0-3.5 3-6 7-6s7 2.500 7 6M19 8v6M16 11h6',
  users: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20c0-3.300 2.800-5.500 6.500-5.500s6.500 2.200 6.500 5.500M17 4.500a3.500 3.500 0 0 1 0 6.500M18 14.600c2.400.6 3.800 2.600 3.800 5.400',
};

function PhoneIllustration() {
  return (
    <View style={{ height: 230, alignItems: 'center', overflow: 'hidden' }}>
      <Sparks />
      <View style={{ marginTop: 36, width: 250, height: 250, borderRadius: 38, borderWidth: 7, borderColor: '#322A4F', backgroundColor: '#F4F0FF', transform: [{ rotate: '-8deg' }], alignItems: 'center', paddingTop: 12 }}>
        <View style={{ width: 70, height: 16, borderRadius: 8, backgroundColor: '#322A4F', marginBottom: 22 }} />
        <View style={{ width: 192, height: 52, borderRadius: 16, backgroundColor: '#F43F5E', transform: [{ rotate: '-7deg' }], flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 14, shadowColor: '#E11D48', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 4 2.800 20h18.400zM12 10v4.500M12 17.400v.1" /></Svg>
          <Text style={{ color: '#fff', fontSize: 17, fontFamily: fontFor(800) }}>{'Alerte SOS'}</Text>
        </View>
        <View style={{ width: 186, height: 50, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDD3F7', transform: [{ rotate: '-7deg' }], flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={V} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 11v3l10 5V6zM13 6l7-3v16l-7-3M6 15v4a2 2 0 0 0 4 0" /></Svg>
          <Text style={{ color: V, fontSize: 17, fontFamily: fontFor(800) }}>{'Annonce'}</Text>
        </View>
      </View>
    </View>
  );
}

function LightIntro() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const { step: startStep } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState(startStep === 'login' ? 5 : 0);
  const [role, setRoleState] = useState<Role>('creator');
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => { appleAvailable().then(setApple); }, []);
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    if (step >= 5) markIntroSeen();
  }, [step, anim]);
  useEffect(() => { if (session && step >= 5) router.replace('/ready'); }, [session, step]);

  const go = (n: number) => setStep(n);
  const run = async (provider: 'apple' | 'google') => {
    setBusy(true); setError(null);
    try { await signInWith(provider); } catch (e) { setError(errorMessage(locale, e)); } finally { setBusy(false); }
  };
  const motion = { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] };

  // Écran 1 : fond sombre
  if (step === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: INK }}>
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="a" x1="0.3" y1="0" x2="0.8" y2="1"><Stop offset="0" stopColor="#0B0618" /><Stop offset="0.6" stopColor="#1D0F45" /><Stop offset="1" stopColor="#7C3AED" /></LinearGradient>
            <RadialGradient id="g" cx="50" cy="26" r="40" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor="#E11D48" stopOpacity={0.35} /><Stop offset="1" stopColor="#E11D48" stopOpacity={0} /></RadialGradient>
          </Defs>
          <Rect width={100} height={100} fill="url(#a)" />
          <Rect width={100} height={100} fill="url(#g)" />
        </Svg>
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 26 }}>
          <Animated.View style={[{ flex: 1 }, motion]}>
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 96, gap: 38 }}>
              <Image source={LOGO_DARK} style={{ width: 236, height: 230 }} resizeMode="contain" accessibilityLabel="SaveMyCommunity" />
              <Text style={{ color: '#fff', fontSize: 25, lineHeight: 33, textAlign: 'center', fontFamily: fontFor(500), paddingHorizontal: 4 }}>{t('ob.s1')}</Text>
              <Dots i={1} dark />
            </View>
            <View style={{ paddingBottom: 8 }}><Cta label={t('ob.start')} onPress={() => go(1)} light /></View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  const body = (() => {
    if (step === 1) return (
      <>
        <View style={{ gap: 22, alignItems: 'center' }}><Wordmark /><Text style={{ fontSize: 31, color: INK, fontFamily: fontFor(800), letterSpacing: -0.8 }}>{t('ob.why')}</Text></View>
        <Text style={{ fontSize: 16.5, lineHeight: 23, color: MUTED, textAlign: 'center', marginTop: -6 }}>{t('ob.whySub')}</Text>
        <View style={{ gap: 26, marginTop: 14 }}>
          <Feature icon={ICON.shield} tint={V} bg="#F0EBFF" title={t('ob.w1t')} desc={t('ob.w1d')} />
          <Feature icon={ICON.bell} tint="#E11D48" bg="#FFE9EE" title={t('ob.w2t')} desc={t('ob.w2d')} />
          <Feature icon={ICON.bolt} tint="#4F46E5" bg="#EDEBFF" title={t('ob.w3t')} desc={t('ob.w3d')} />
        </View>
      </>
    );
    if (step === 2) return (
      <>
        <View style={{ gap: 22, alignItems: 'center' }}><Wordmark /><Text style={{ fontSize: 31, color: INK, fontFamily: fontFor(800), letterSpacing: -0.8 }}>{t('ob.who')}</Text></View>
        <Text style={{ fontSize: 16.5, lineHeight: 23, color: MUTED, textAlign: 'center', marginTop: -6 }}>{t('ob.whoSub')}</Text>
        <View style={{ gap: 14, marginTop: 14 }}>
          <RoleCard on={role === 'creator'} icon={ICON.userPlus} title={t('ob.rCreator')} desc={t('ob.rCreatorD')} onPress={() => { setRoleState('creator'); setRole('creator'); }} />
          <RoleCard on={role === 'follower'} icon={ICON.users} title={t('ob.rFollower')} desc={t('ob.rFollowerD')} onPress={() => { setRoleState('follower'); setRole('follower'); }} />
        </View>
      </>
    );
    if (step === 3) return (
      <>
        <Pill label={t('ob.pillCreator')} icon={ICON.userPlus} />
        <Text style={{ fontSize: 31, color: INK, fontFamily: fontFor(800), letterSpacing: -0.8, textAlign: 'center' }}>{t('ob.forCreators')}</Text>
        <View style={{ gap: 19, marginTop: 8 }}>
          <Check bold={t('ob.c1')} />
          <Check bold={t('ob.c2')} grey={t('ob.c2g')} />
          <Check bold={t('ob.c3')} grey={t('ob.c3g')} />
          <Check bold={t('ob.c4')} />
          <Check bold={t('ob.c5')} grey={t('ob.c5g')} />
        </View>
        <PhoneIllustration />
      </>
    );
    return (
      <>
        <Pill label={t('ob.pillFollower')} icon={ICON.users} />
        <Text style={{ fontSize: 31, color: INK, fontFamily: fontFor(800), letterSpacing: -0.8, textAlign: 'center' }}>{t('ob.forFollowers')}</Text>
        <View style={{ gap: 19, marginTop: 8 }}>
          <Check bold={t('ob.f1')} />
          <Check bold={t('ob.f2')} />
          <Check bold={t('ob.f3')} grey={t('ob.f3g')} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: V, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><Path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
            </View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 16, lineHeight: 22, color: INK, fontFamily: fontFor(600) }}>{t('ob.f4')}</Text><Text style={{ fontSize: 15, color: MUTED }}>{t('ob.f4g')}</Text></View>
          </View>
        </View>
        <View style={{ height: 150, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: '#fff', transform: [{ rotate: '-5deg' }], shadowColor: INK, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 }}>
            <Image source={LOGO_LIGHT} style={{ width: 40, height: 40 }} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#E11D48', fontSize: 14, fontFamily: fontFor(800) }}>{t('ob.notifTitle')}</Text><Text style={{ color: MUTED, fontSize: 13 }}>{t('ob.now')}</Text></View>
              <Text style={{ fontSize: 14.5, lineHeight: 20, color: '#3B3F4E' }}>{t('ob.notifBody')}</Text>
            </View>
          </View>
        </View>
      </>
    );
  })();

  if (step === 6) {
    const send = async () => {
      setBusy(true); setError(null);
      const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      setBusy(false);
      if (err) return setError(errorMessage(locale, err));
      setSent(true);
    };
    const verify = async () => {
      setBusy(true); setError(null);
      const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      setBusy(false);
      if (err) return setError(errorMessage(locale, err));
    };
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
          <Animated.View style={[{ flex: 1, gap: 16, paddingTop: 12 }, motion]}>
            <Pressable accessibilityRole="button" onPress={() => go(5)} hitSlop={12}><Text style={{ fontSize: 17, color: INK }}>‹  {t('common.back')}</Text></Pressable>
            <Text style={{ fontSize: 31, color: INK, fontFamily: fontFor(800), letterSpacing: -0.8, marginTop: 20 }}>{t('ob.emailTitle')}</Text>
            <Text style={{ fontSize: 16.5, lineHeight: 23, color: MUTED }}>{sent ? t('ob.emailSent', { email: email.trim() }) : t('ob.emailSub')}</Text>
            <TextInput value={sent ? code : email} onChangeText={sent ? setCode : setEmail} autoCapitalize="none" autoCorrect={false} keyboardType={sent ? 'number-pad' : 'email-address'} maxLength={sent ? 8 : 120}
              placeholder={sent ? '123456' : 'nom@exemple.com'} placeholderTextColor="#9AA0B0"
              style={{ height: 56, borderRadius: 16, borderWidth: 1, borderColor: '#E4E0F2', paddingHorizontal: 18, fontSize: 19, color: INK, fontFamily: 'Inter_500Medium', letterSpacing: sent ? 6 : 0 }} />
            {error ? <Text style={{ color: '#E11D48', fontSize: 13.5 }}>{error}</Text> : null}
            <Cta label={busy ? '…' : sent ? t('ob.emailVerify') : t('ob.emailSend')} onPress={sent ? verify : send} />
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  if (step === 5) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
          <Animated.View style={[{ flex: 1 }, motion]}>
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 36, gap: 14 }}>
              <Image source={LOGO_LIGHT} style={{ width: 128, height: 122 }} resizeMode="contain" accessibilityLabel="SaveMyCommunity" />
              <Text style={{ fontSize: 35, color: INK, fontFamily: fontFor(800), letterSpacing: -1, marginTop: 8 }}>{t('ob.login')}</Text>
              <Text style={{ fontSize: 17.5, lineHeight: 25, color: MUTED, textAlign: 'center', paddingHorizontal: 18 }}>{t('ob.loginSub')}</Text>
              <View style={{ alignSelf: 'stretch', gap: 14, marginTop: 28 }}>
                {apple ? (
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => run('apple')} style={{ height: 56, borderRadius: 14, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
                    <Text style={{ fontSize: 21, color: '#fff', marginTop: -2 }}></Text>
                    <Text style={{ color: '#fff', fontSize: 17, fontFamily: fontFor(700) }}>{t('auth.apple')}</Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => run('google')} style={{ height: 56, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy ? 0.6 : 1, shadowColor: INK, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
                  <Svg width={21} height={21} viewBox="0 0 24 24">
                    <Path fill="#4285F4" d="M22.500 12.200c0-.8-.1-1.500-.2-2.200H12v4.200h5.900a5 5 0 0 1-2.200 3.300v2.700h3.500c2.100-1.900 3.300-4.700 3.300-8z" />
                    <Path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.500-2.700c-1 .7-2.200 1-3.800 1-2.900 0-5.400-2-6.300-4.600H2.100v2.800A11 11 0 0 0 12 23z" />
                    <Path fill="#FBBC05" d="M5.700 14c-.2-.7-.4-1.300-.4-2s.1-1.400.4-2V7.200H2.100a11 11 0 0 0 0 9.600z" />
                    <Path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.700l3.100-3.100A11 11 0 0 0 2.100 7.200L5.700 10c.9-2.600 3.400-4.600 6.300-4.600z" />
                  </Svg>
                  <Text style={{ color: INK, fontSize: 17, fontFamily: fontFor(700) }}>{t('auth.google')}</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 2 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: '#E4E0F2' }} /><Text style={{ color: MUTED, fontSize: 15 }}>{t('ob.or')}</Text><View style={{ flex: 1, height: 1, backgroundColor: '#E4E0F2' }} />
                </View>
                <Pressable accessibilityRole="button" onPress={() => go(6)} style={{ height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#CFC4F2', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={V} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 6h18v12H3zM3 7l9 7 9-7" /></Svg>
                  <Text style={{ color: V, fontSize: 17, fontFamily: fontFor(700) }}>{t('ob.email')}</Text>
                </Pressable>
                {error ? <Text style={{ color: '#E11D48', fontSize: 13, textAlign: 'center' }}>{error}</Text> : null}
              </View>
            </View>
            <Text style={{ color: MUTED, fontSize: 13.5, lineHeight: 20, textAlign: 'center', paddingVertical: 10 }}>
              {t('ob.legalPre')}{' '}
              <Text style={{ color: INK, fontFamily: fontFor(700), textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)}>{t('ob.terms')}</Text> {t('ob.and')}{' '}
              <Text style={{ color: INK, fontFamily: fontFor(700), textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}>{t('ob.privacy')}</Text>.
            </Text>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  const nextStep = step === 2 ? (role === 'creator' ? 3 : 4) : step === 3 || step === 4 ? 5 : step + 1;
  const dotIndex = step === 1 ? 0 : step === 2 ? 1 : 2;
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 20 }}>
        <Animated.View style={[{ flex: 1 }, motion]}>
          <View style={{ flex: 1, justifyContent: step <= 2 ? 'flex-start' : 'flex-start', gap: 16, paddingTop: step <= 2 ? 26 : 14 }}>{body}</View>
          {step <= 2 ? <View style={{ marginBottom: 20 }}><Dots i={dotIndex} /></View> : null}
          <View style={{ paddingBottom: 8 }}><Cta label={step === 1 ? t('ob.next') : t('common.continue')} onPress={() => go(nextStep)} /></View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

export default function Intro() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  return isDark() ? <DarkIntro startLogin={step === 'login'} /> : <LightIntro />;
}
