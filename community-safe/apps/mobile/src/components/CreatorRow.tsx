import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { formatCount, type CreatorProfile } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { space, useColors } from '@/lib/theme';
import { Avatar, Pill, T, VerifiedBadge } from './ui';

export function CreatorRow({ creator }: { creator: CreatorProfile }) {
  const c = useColors();
  const { t, locale } = useI18n();
  const verified = creator.verification_status === 'verified';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/creator/${creator.handle}`)}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginBottom: space.md,
        backgroundColor: c.card, borderRadius: 20, opacity: pressed ? 0.8 : 1,
        shadowColor: '#170B2F', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
      })}>
      <Avatar name={creator.display_name} url={creator.avatar_url} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T v="heading">{creator.display_name}</T>
          {verified ? <VerifiedBadge /> : null}
        </View>
        <T v="small">
          @{creator.handle} · {t('creator.members', { count: formatCount(locale, creator.member_count) })}
        </T>
      </View>
      {verified ? null : <Pill label={t('creator.unverified')} />}
    </Pressable>
  );
}
