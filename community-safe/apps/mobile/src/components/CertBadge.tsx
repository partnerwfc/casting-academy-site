import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useI18n } from '@/lib/i18n';
import { radius, useColors } from '@/lib/theme';
import { T } from './ui';

// Badge bleu « Créateur certifié ».
export function CertBadge({ small }: { small?: boolean }) {
  const { t } = useI18n();
  const c = useColors();
  const size = small ? 15 : 18;
  return (
    <View accessibilityLabel={t('creator.verified')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.primarySoft, borderRadius: radius.pill, paddingVertical: small ? 2 : 4, paddingLeft: 4, paddingRight: small ? 8 : 11 }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="11" fill={c.primary} />
        <Path d="m7.4 12.4 3 3 6.2-6.6" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <T v="small" style={{ color: c.primary, fontWeight: '700', fontSize: small ? 11 : 12.5 }}>{t('creator.verified')}</T>
    </View>
  );
}
