import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { formatCount, type CreatorProfile, type MessageKey } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { space, useColors } from '@/lib/theme';
import { Avatar, Pill, T } from './ui';

export function CreatorRow({ creator }: { creator: CreatorProfile }) {
  const c = useColors();
  const { t, locale } = useI18n();
  const verified = creator.verification_status === 'verified';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/creator/${creator.handle}`)}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md,
        borderBottomWidth: 1, borderBottomColor: c.border, opacity: pressed ? 0.7 : 1,
      })}>
      <Avatar name={creator.display_name} url={creator.avatar_url} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T v="heading">{creator.display_name}</T>
          {verified ? <T v="small" style={{ color: c.primary, fontWeight: '700' }}>✓</T> : null}
        </View>
        <T v="small">
          @{creator.handle} · {t(`category.${creator.category}` as MessageKey)}
        </T>
        <T v="small">{t('creator.members', { count: formatCount(locale, creator.member_count) })}</T>
      </View>
      {verified ? null : <Pill label={t('creator.unverified')} />}
    </Pressable>
  );
}
