import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { fontFor, tint } from '@/lib/theme';

// « Pas de connexion » : une phrase, une action (principe n°4 du design system).
export function OfflineView({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: tint('#fff'), padding: 24, justifyContent: 'center' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: tint('#EEEFF5'), alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#170B2F" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18" />
          </Svg>
        </View>
        <Text style={{ fontSize: 26, color: tint('#170B2F'), fontFamily: fontFor(800), letterSpacing: -0.5 }}>{t('net.title')}</Text>
        <Text style={{ fontSize: 16, lineHeight: 23, color: tint('#6B7385'), textAlign: 'center', paddingHorizontal: 8 }}>{t('net.body')}</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Button label={t('net.retry')} onPress={onRetry} />
        <Button label={t('net.seeAlerts')} kind="ghost" onPress={() => router.replace('/(tabs)/alerts')} />
      </View>
    </View>
  );
}
