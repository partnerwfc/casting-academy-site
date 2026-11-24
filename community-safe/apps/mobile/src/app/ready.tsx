import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { fontFor, tint } from '@/lib/theme';


// « C'est prêt ! » : confirmation après la connexion, puis autorisation des notifications.
export default function Ready() {
  const { t } = useI18n();
  const V = tint('#6D28D9'), INK = tint('#170B2F'), MUTED = tint('#6B7385');
  const go = () => router.replace('/notifications-intro');
  const tick = (text: string) => (
    <View key={text} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={V} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1 }}><Path d="m4 12.5 5 5L20 6.5" /></Svg>
      <Text style={{ flex: 1, fontSize: 17, lineHeight: 23, color: INK, fontFamily: fontFor(500) }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: tint('#fff') === '#0E0E10' ? '#000' : '#fff' }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ alignItems: 'flex-end', height: 44, justifyContent: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={go} hitSlop={12}><Text style={{ fontSize: 24, color: INK }}>✕</Text></Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 14, paddingTop: 40 }}>
          <View style={{ width: 82, height: 82, borderRadius: 41, overflow: 'hidden', shadowColor: V, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
            <Svg width={82} height={82} viewBox="0 0 82 82">
              <Defs><LinearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7C3AED" /><Stop offset="1" stopColor="#4F46E5" /></LinearGradient></Defs>
              <Circle cx={41} cy={41} r={41} fill="url(#rg)" />
              <Path d="m24 42 12 12 23-26" stroke="#fff" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </View>
          <Text style={{ fontSize: 37, color: INK, fontFamily: fontFor(800), letterSpacing: -1, marginTop: 14 }}>{t('ob.ready')}</Text>
          <Text style={{ fontSize: 18, lineHeight: 26, color: MUTED, textAlign: 'center', paddingHorizontal: 30 }}>{t('ob.readySub')}</Text>
          <View style={{ alignSelf: 'stretch', backgroundColor: tint('#fff'), borderRadius: 22, padding: 22, gap: 18, marginTop: 26, shadowColor: INK, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
            <Text style={{ fontSize: 19, color: INK, fontFamily: fontFor(800) }}>{t('ob.nextStep')}</Text>
            {[t('ob.n1'), t('ob.n2'), t('ob.n3')].map(tick)}
          </View>
        </View>
        <View style={{ paddingBottom: 8 }}><Button label={t('ob.start')} onPress={go} /></View>
      </SafeAreaView>
    </View>
  );
}
