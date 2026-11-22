import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useEffect, useState } from 'react';
import { Alert as RNAlert, Linking, Pressable, Share, View } from 'react-native';
import { checkLink, creatorUrl, formatDate, linkHost, type Alert, type MessageKey } from '@community-safe/shared';
import { Avatar, Button, Loading, Pill, Screen, T, VerifiedBadge } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

type AlertWithCreator = Alert & { creator_profiles: { display_name: string; handle: string; avatar_url: string | null; verification_status: string } };

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const c = useColors();
  const [alert, setAlert] = useState<AlertWithCreator | null | undefined>(undefined);

  useEffect(() => {
    supabase.from('alerts').select('*, creator_profiles!inner(display_name, handle, avatar_url, verification_status)').eq('id', id).maybeSingle()
      .then(({ data }) => setAlert((data as AlertWithCreator | null) ?? null));
    supabase.rpc('mark_alert_opened', { p_alert_id: id, p_link: false }).then(() => {});
  }, [id]);

  if (alert === undefined) return <Loading />;
  if (alert === null) return <Screen><T v="muted" center style={{ marginTop: space.xxl }}>{t('alerts.empty')}</T></Screen>;

  const creator = alert.creator_profiles;
  const host = alert.link_url ? linkHost(alert.link_url) : null;
  const linkSafe = alert.link_url ? checkLink(alert.link_url) === null : false;

  // Le lien externe ne s'ouvre qu'après un appui explicite, en affichant la destination réelle.
  const openLink = () => RNAlert.alert(t('alerts.openLink', { name: creator.display_name }), t('alerts.linkWarning', { host: host ?? '' }), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.continue'),
      onPress: () => {
        supabase.rpc('mark_alert_opened', { p_alert_id: alert.id, p_link: true }).then(() => {});
        Linking.openURL(alert.link_url!);
      },
    },
  ]);

  const sos = alert.kind === 'sos';
  return (
    <Screen>
      {sos ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 22, borderWidth: 1, borderColor: '#FBC5CF', backgroundColor: c.sosSoft }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.sos, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.4v.1" /></Svg>
          </View>
          <View style={{ flex: 1 }}>
            <T v="heading" style={{ color: c.sos, fontWeight: '800', letterSpacing: 0.4 }}>{t('detail.sosBanner')}</T>
            <T v="small">{t('detail.sosBannerSub')}</T>
          </View>
        </View>
      ) : <Pill label={t(`alerts.kind.${alert.kind}`)} tone="primary" />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={creator.display_name} url={creator.avatar_url} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T v="heading" style={{ fontSize: 18, fontWeight: '800' }}>{creator.display_name}</T>
            {creator.verification_status === 'verified' ? <VerifiedBadge size={18} /> : null}
          </View>
          <T v="small">{formatDate(locale, alert.created_at)} · @{creator.handle}</T>
        </View>
      </View>
      {alert.reason ? <Pill label={t(`reason.${alert.reason}` as MessageKey)} /> : null}
      <T v="hero" style={{ fontSize: 30, lineHeight: 36 }}>{alert.message}</T>
      {alert.link_url && linkSafe ? (
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEEFF5', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>
            </View>
            <View style={{ flex: 1 }}>
              <T v="heading" style={{ fontSize: 16 }}>{host}</T>
              <T v="small" style={{ color: c.success, fontWeight: '600' }}>{t('detail.linkVerified')}</T>
            </View>
          </View>
          <Button label={`${t('alerts.openLink', { name: creator.display_name })}  ↗`} kind={sos ? 'sos' : 'primary'} onPress={openLink} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl }}>
        <Pressable onPress={() => Share.share({ message: `${alert.message}\n\n${creatorUrl(WEB_URL, creator.handle)}` })}><T v="heading" style={{ color: c.primary }}>{t('detail.share')}</T></Pressable>
        <Pressable onPress={() => router.push(`/creator/${creator.handle}`)}><T v="heading" style={{ color: c.muted }}>{t('detail.report')}</T></Pressable>
      </View>
    </Screen>
  );
}
