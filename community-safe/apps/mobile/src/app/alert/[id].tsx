import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useEffect, useState } from 'react';
import { Alert as RNAlert, Linking, Pressable, Share, Text, View } from 'react-native';
import { checkLink, creatorUrl, formatDate, linkHost, type Alert, type MessageKey } from '@community-safe/shared';
import { Avatar, Button, Loading, Pill, Screen, T, VerifiedBadge } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fontFor, space, useColors, tint } from '@/lib/theme';

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
  if (alert === null) return <Screen nav={{ back: t('tabs.alerts') }}><T v="muted" center style={{ marginTop: space.xxl }}>{t('alerts.empty')}</T></Screen>;

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
  const when = new Date(alert.created_at);
  const today = when.toDateString() === new Date().toDateString();
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(when);
  const dateLabel = today ? t('alerts.today', { time }) : formatDate(locale, alert.created_at);
  // Le message est un seul texte : on en fait le titre s'il est court, sinon le corps (première ligne en titre).
  const [first, ...restLines] = alert.message.split('\n');
  const hasTitle = restLines.length > 0 || alert.message.length <= 90;
  const title = hasTitle ? first : null;
  const body = hasTitle ? restLines.join('\n').trim() : alert.message;
  return (
    <Screen bg="#fff" nav={{ back: t('tabs.alerts') }}>
      {sos ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, borderWidth: 1, borderColor: tint('#F8C3CF'), backgroundColor: tint('#FFE9EE'), overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: -30, top: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(225,29,72,0.10)' }} />
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.sos, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.4v.1" /></Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.sos, fontSize: 18, letterSpacing: 0.5, fontFamily: fontFor(800) }}>{t('detail.sosBanner')}</Text>
            <Text style={{ color: c.muted, fontSize: 13.5 }}>{t('detail.sosBannerSub')}</Text>
          </View>
        </View>
      ) : <Pill label={t(`alerts.kind.${alert.kind}`).toUpperCase()} tone="primary" />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={creator.display_name} url={creator.avatar_url} size={48} />
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18, color: c.text, fontFamily: fontFor(700) }}>{creator.display_name}</Text>
            {creator.verification_status === 'verified' ? <VerifiedBadge size={18} /> : null}
          </View>
          <Text style={{ fontSize: 14.5, color: c.muted }}>{dateLabel} · @{creator.handle}</Text>
        </View>
      </View>
      {alert.reason ? <Pill label={t(`reason.${alert.reason}` as MessageKey)} /> : null}
      <View style={{ gap: 10 }}>
        {title ? <Text style={{ fontSize: 28, lineHeight: 33, letterSpacing: -0.7, color: c.text, fontFamily: fontFor(800) }}>{title}</Text> : null}
        {body ? <Text style={{ fontSize: 18, lineHeight: 27, color: tint('#3B3F4E') }}>{body}</Text> : null}
      </View>
      {alert.link_url && linkSafe ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: tint('#E9E6F3'), backgroundColor: tint('#fff') }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tint('#EEEFF5'), alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 17, color: c.text, fontFamily: fontFor(700) }}>{host}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></Svg>
                <Text style={{ fontSize: 13.5, color: tint('#15803D'), fontFamily: fontFor(600) }}>{t('detail.linkVerified')}</Text>
              </View>
            </View>
          </View>
          <Button label={`${t('alerts.followNew')}   ↗`} onPress={openLink} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 4 }}>
        <Pressable onPress={() => Share.share({ message: `${alert.message}\n\n${creatorUrl(WEB_URL, creator.handle)}` })}><Text style={{ fontSize: 17, color: c.primary, fontFamily: fontFor(700) }}>{t('detail.share')}</Text></Pressable>
        <Pressable onPress={() => router.push(`/creator/${creator.handle}`)}><Text style={{ fontSize: 17, color: c.muted, fontFamily: fontFor(700) }}>{t('detail.report')}</Text></Pressable>
      </View>
    </Screen>
  );
}
