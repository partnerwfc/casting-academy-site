import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Button, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { getRole, markOnboarded } from '@/lib/onboarding';
import { syncDevice } from '@/lib/push';
import { fontFor, useColors } from '@/lib/theme';

const LOGO = require('../../assets/images/icon.png');

function Notif({ kind, title, body, time, label, inset }: { kind: 'sos' | 'ann'; title: string; body?: string; time: string; label: string; inset?: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 22, backgroundColor: '#fff', marginHorizontal: inset ?? 0, shadowColor: '#170B2F', shadowOpacity: kind === 'sos' ? 0.14 : 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: kind === 'sos' ? 5 : 3 }}>
      <Image source={LOGO} style={{ width: 36, height: 36, borderRadius: 10 }} />
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: kind === 'sos' ? c.sos : c.primary, fontSize: 13, fontFamily: fontFor(800) }}>{label}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>{time}</Text>
        </View>
        <Text style={{ color: '#170B2F', fontSize: 15.5, lineHeight: 20, fontFamily: fontFor(700) }}>{title}</Text>
        {body ? <Text style={{ color: '#4B5263', fontSize: 14.5, lineHeight: 19 }}>{body}</Text> : null}
      </View>
    </View>
  );
}

export default function NotificationsIntro() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const done = async () => { await markOnboarded(); const role = await getRole(); router.replace(role === 'creator' ? '/studio/setup' : '/(tabs)/discover'); };
  return (
    <Screen bg="#F7F8FC" scroll={false} padded={false}
      footer={<>
        <Button label={t('onb.notif.enable')} loading={busy} onPress={async () => { setBusy(true); await syncDevice(true).catch(() => null); setBusy(false); done(); }} />
        <Pressable onPress={done} style={{ alignItems: 'center', paddingVertical: 12 }}><Text style={{ color: '#6D28D9', fontSize: 17, fontFamily: fontFor(700) }}>{t('onb.notif.later')}</Text></Pressable>
      </>}>
      <View style={{ position: 'absolute', top: -60, left: 0, right: 0, height: 380 }} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
          <Defs><LinearGradient id="n" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#F0EBFF" /><Stop offset="1" stopColor="#F7F8FC" /></LinearGradient></Defs>
          <Rect width={10} height={10} fill="url(#n)" />
        </Svg>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 40, gap: 10 }}>
        <Notif kind="sos" label={t('onb.notif.sos')} time={t('onb.notif.now')} title={t('onb.notif.sosTitle')} body={t('onb.notif.sosBody')} />
        <Notif kind="ann" label={t('onb.notif.ann')} time={t('onb.notif.ago')} title={t('onb.notif.annTitle')} inset={14} />
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-start', paddingHorizontal: 28, gap: 14, paddingTop: 138 }}>
        <Text style={{ fontSize: 31, lineHeight: 36, letterSpacing: -0.9, color: '#170B2F', fontFamily: fontFor(800) }}>{t('onb.notif.title')}</Text>
        <Text style={{ fontSize: 17, lineHeight: 25, color: '#6B7385', paddingRight: 24 }}>{t('onb.notif.body')}</Text>
      </View>
    </Screen>
  );
}
