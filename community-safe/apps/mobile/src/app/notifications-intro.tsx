import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button, Logo, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { syncDevice } from '@/lib/push';
import { fontFor, space, useColors } from '@/lib/theme';
import { useState } from 'react';

function Notif({ kind, title, time, label, offset }: { kind: 'sos' | 'ann'; title: string; time: string; label: string; offset?: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: '#fff', marginHorizontal: offset ?? 0, shadowColor: '#170B2F', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
      <Logo size={40} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: kind === 'sos' ? c.sos : c.primary, fontSize: 13, fontFamily: fontFor(700) }}>{label}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{time}</Text>
        </View>
        <Text style={{ color: '#170B2F', fontSize: 15, fontFamily: fontFor(700) }}>{title}</Text>
      </View>
    </View>
  );
}

export default function NotificationsIntro() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const done = () => router.replace('/(tabs)/communities');
  return (
    <Screen scroll={false}>
      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Notif kind="sos" label={t('onb.notif.sos')} time={t('onb.notif.now')} title={`${t('onb.notif.sosTitle')}\n${t('onb.notif.sosBody')}`} />
        <Notif kind="ann" label={t('onb.notif.ann')} time={t('onb.notif.ago')} title={t('onb.notif.annTitle')} offset={14} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
        <T v="hero" style={{ fontSize: 30, lineHeight: 36 }}>{t('onb.notif.title')}</T>
        <T v="muted" style={{ fontSize: 17, lineHeight: 26 }}>{t('onb.notif.body')}</T>
      </View>
      <Button label={t('onb.notif.enable')} loading={busy} onPress={async () => { setBusy(true); await syncDevice(true).catch(() => null); setBusy(false); done(); }} />
      <Pressable onPress={done} style={{ alignItems: 'center', padding: space.sm }}><T v="heading" style={{ color: '#6D28D9' }}>{t('onb.notif.later')}</T></Pressable>
    </Screen>
  );
}
