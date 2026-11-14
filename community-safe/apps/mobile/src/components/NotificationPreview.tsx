import { View } from 'react-native';
import { notificationTitle, type AlertKind } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { radius, space, useColors } from '@/lib/theme';
import { Logo, T } from './ui';

// Aperçu indicatif d'une notification sur l'écran verrouillé.
export function NotificationPreview({ kind, creatorName, message }: { kind: AlertKind; creatorName: string; message: string }) {
  const c = useColors();
  const { locale } = useI18n();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, flexDirection: 'row', gap: space.md, borderWidth: 1, borderColor: c.border }}>
      <Logo size={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="small" style={{ letterSpacing: 0.6 }}>SAVEMYCOMMUNITY</T>
        <T v="heading" style={{ fontSize: 15 }}>{notificationTitle(kind, creatorName, locale)}</T>
        <T v="muted" style={{ color: c.text }}>{message || '…'}</T>
      </View>
    </View>
  );
}
