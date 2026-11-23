import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatCompact, type CreatorProfile } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { fontFor, useColors } from '@/lib/theme';
import { Avatar, Pill, VerifiedBadge } from './ui';

// Ligne de communauté des maquettes : carte blanche, avatar carré arrondi, « @pseudo · 12,4 k membres ».
export function CreatorRow({ creator, badge, trailing }: { creator: CreatorProfile; badge?: string; trailing?: 'chevron' | 'none' | React.ReactNode }) {
  const c = useColors();
  const { t, locale } = useI18n();
  const verified = creator.verification_status === 'verified';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/creator/${creator.handle}`)}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, opacity: pressed ? 0.85 : 1,
        shadowColor: '#170B2F', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
      })}>
      <Avatar name={creator.display_name} url={creator.avatar_url} size={50} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ fontSize: 17, color: c.text, fontFamily: fontFor(700), flexShrink: 1 }}>{creator.display_name}</Text>
          {verified ? <VerifiedBadge size={16} /> : null}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 13, color: c.muted, fontFamily: fontFor(400) }}>
          @{creator.handle} · {t('creator.members', { count: formatCompact(locale, creator.member_count) })}
        </Text>
      </View>
      {!verified ? <Pill label={t('creator.unverified')} /> : null}
      {badge ? <Pill label={badge} tone="sos" /> : null}
      {trailing === undefined || trailing === 'chevron' ? <Text style={{ color: '#B6B9C6', fontSize: 22 }}>›</Text> : trailing === 'none' ? null : trailing}
    </Pressable>
  );
}
