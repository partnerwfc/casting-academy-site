import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  CAMPAIGN_STEPS, buildTransferKit, creatorUrl, formatCount, type DashboardStats,
} from '@community-safe/shared';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Avatar, Button, Card, Logo, Screen, Stat, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fontFor, space, useColors } from '@/lib/theme';

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

  const tip = (n: number, title: string, desc: string, last?: boolean) => (
    <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#EEEFF5' }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: '#170B2F', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 15, fontFamily: fontFor(800) }}>{n}</Text></View>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 16.5, color: c.text }}>{title}</Text><Text style={{ fontSize: 13.5, color: c.muted }}>{desc}</Text></View>
    </View>
  );
  return (
    <Screen nav={{ back: 'Retour', title: t('kit.navTitle') }}>
      <Text style={{ fontSize: 31, lineHeight: 36, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.9, width: 280 }}>{t('kit.headline')}</Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: c.muted, marginTop: -6 }}>{t('kit.honest')}</Text>

      <View style={{ borderRadius: 26, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#170B2F', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 }}>
        <View style={{ height: 118, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 14 }}>
          <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
            <Defs><LinearGradient id="k" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7C3AED" /><Stop offset="1" stopColor="#5B3BEE" /></LinearGradient></Defs>
            <Rect width={10} height={10} fill="url(#k)" />
          </Svg>
          <Avatar name={creator.display_name} url={creator.avatar_url} size={64} />
          <Logo size={42} />
        </View>
        <View style={{ padding: 16, gap: 2 }}>
          <Text style={{ fontSize: 17.5, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.3 }}>{t('kit.joinTitle', { name: creator.display_name })}</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted }}>{t('kit.joinBody')}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: c.muted }}>{t('kit.yourLink')}</Text>
          <Text numberOfLines={1} style={{ fontSize: 17, color: c.text, fontFamily: fontFor(700) }}>{link.replace('https://', '')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => copy('link', link)} style={{ backgroundColor: '#F0EBFF', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 }}>
          <Text style={{ color: c.primary, fontSize: 16, fontFamily: fontFor(700) }}>{copied === 'link' ? t('common.copied') : t('common.copy')}</Text>
        </Pressable>
      </View>
      <Button label={`⇪  ${t('common.share')}…`} onPress={() => Share.share({ message: `${t('kit.shareText')}\n\n${link}` })} />

      <View style={{ gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase', marginLeft: 6 }}>{t('kit.where')}</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }}>
          {tip(1, t('kit.tip1'), t('kit.tip1d'))}{tip(2, t('kit.tip2'), t('kit.tip2d'))}{tip(3, t('kit.tip3'), t('kit.tip3d'), true)}
        </View>
        <Text style={{ fontSize: 13.5, lineHeight: 19, color: c.muted, marginLeft: 6 }}>{t('kit.note')}</Text>
      </View>

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
