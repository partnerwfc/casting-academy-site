import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert as RNAlert, Linking, View } from 'react-native';
import { checkLink, formatDate, linkHost, type Alert, type MessageKey } from '@community-safe/shared';
import { Avatar, Button, Card, Loading, Pill, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

type AlertWithCreator = Alert & { creator_profiles: { display_name: string; handle: string; avatar_url: string | null } };

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const [alert, setAlert] = useState<AlertWithCreator | null | undefined>(undefined);

  useEffect(() => {
    supabase.from('alerts').select('*, creator_profiles!inner(display_name, handle, avatar_url)').eq('id', id).maybeSingle()
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

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={creator.display_name} url={creator.avatar_url} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="heading">{creator.display_name} ✓</T>
          <T v="small">@{creator.handle} · {formatDate(locale, alert.created_at)}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pill label={t(`alerts.kind.${alert.kind}`)} tone={alert.kind === 'sos' ? 'sos' : 'primary'} />
        {alert.reason ? <Pill label={t(`reason.${alert.reason}` as MessageKey)} /> : null}
      </View>
      <Card tone={alert.kind === 'sos' ? 'sos' : 'soft'}>
        <T v="body" style={{ fontSize: 18, lineHeight: 27 }}>{alert.message}</T>
      </Card>
      {alert.link_url && linkSafe ? (
        <View style={{ gap: space.sm }}>
          <Button label={t('alerts.openLink', { name: creator.display_name })} kind={alert.kind === 'sos' ? 'sos' : 'primary'} onPress={openLink} />
          <T v="small" center>{host}</T>
        </View>
      ) : null}
    </Screen>
  );
}
