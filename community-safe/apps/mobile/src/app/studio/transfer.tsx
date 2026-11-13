import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  CAMPAIGN_STEPS, buildTransferKit, creatorUrl, formatCount, type DashboardStats,
} from '@community-safe/shared';
import { Button, Card, Screen, Stat, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

export default function Transfer() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { creator } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const creatorId = creator?.id;

  useEffect(() => {
    if (!creatorId) return;
    supabase.rpc('creator_dashboard_stats').then(({ data }) => data && setStats(data as DashboardStats));
    supabase.from('transfer_campaigns').select('completed_steps').eq('creator_id', creatorId).maybeSingle()
      .then(({ data }) => setDone(((data?.completed_steps as string[] | undefined) ?? [])));
  }, [creatorId]);

  if (!creator) return null;
  const link = creatorUrl(WEB_URL, creator.handle);
  const kit = buildTransferKit(locale, WEB_URL, creator.handle);

  const copy = async (id: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };
  const toggleStep = async (step: string) => {
    const next = done.includes(step) ? done.filter((s) => s !== step) : [...done, step];
    setDone(next);
    await supabase.from('transfer_campaigns').upsert({ creator_id: creator.id, completed_steps: next }, { onConflict: 'creator_id' });
  };
  // Aucun taux inventé : affiché seulement si les clics mesurés couvrent les inscriptions.
  const conversion = stats && stats.link_clicks >= stats.members_total && stats.link_clicks > 0 ? `${Math.min(100, Math.round((stats.members_total / stats.link_clicks) * 100))} %` : '—';

  return (
    <Screen>
      <T v="muted">{t('kit.honest')}</T>

      <Card>
        <T v="small">{t('kit.link')}</T>
        <T v="heading" style={{ color: c.primary }}>{link.replace('https://', '')}</T>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label={copied === 'link' ? t('common.copied') : t('common.copy')} kind="secondary" style={{ flex: 1 }} onPress={() => copy('link', link)} />
          <Button label={t('common.share')} style={{ flex: 1 }} onPress={() => Share.share({ message: `${t('kit.shareText')}\n\n${link}` })} />
        </View>
      </Card>

      {stats ? (
        <Card>
          <View style={{ flexDirection: 'row' }}>
            <Stat label={t('dash.clicks')} value={formatCount(locale, stats.link_clicks)} />
            <Stat label={t('dash.members')} value={formatCount(locale, stats.members_total)} />
            <Stat label={t('dash.conversion')} value={conversion} />
          </View>
          {Object.keys(stats.members_by_source).length ? (
            <>
              <T v="small">{t('dash.sources')}</T>
              {Object.entries(stats.members_by_source).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                <View key={source} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="muted">{source}</T><T v="body">{formatCount(locale, count)}</T>
                </View>
              ))}
            </>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ alignItems: 'center' }}>
        <T v="heading">{t('kit.qr')}</T>
        <View style={{ backgroundColor: '#FFFFFF', padding: space.md, borderRadius: 12 }}>
          <QRCode value={creatorUrl(WEB_URL, creator.handle, 'qr')} size={180} color="#111827" backgroundColor="#FFFFFF" />
        </View>
        <T v="small">@{creator.handle}</T>
      </Card>

      <View style={{ gap: space.sm }}>
        <T v="heading">{t('kit.texts')}</T>
        {kit.map((item) => (
          <Card key={item.source}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="heading">{item.label}</T>
              <Button label={copied === item.source ? t('common.copied') : t('common.copy')} kind="ghost" style={{ minHeight: 32 }} onPress={() => copy(item.source, item.text)} />
            </View>
            <T v="muted">{item.text}</T>
          </Card>
        ))}
      </View>

      <Card>
        <T v="heading">{t('kit.campaign')}</T>
        {CAMPAIGN_STEPS.map((step) => (
          <Pressable key={step} accessibilityRole="checkbox" accessibilityState={{ checked: done.includes(step) }} onPress={() => toggleStep(step)}
            style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: 6 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: done.includes(step) ? c.success : c.border, backgroundColor: done.includes(step) ? c.success : 'transparent' }} />
            <T v="body" style={{ flex: 1 }}>{t(`kit.${step}`)}</T>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
