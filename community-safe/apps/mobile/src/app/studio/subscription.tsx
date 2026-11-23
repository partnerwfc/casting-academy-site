import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { errorMessage, formatCount } from '@community-safe/shared';
import { Loading, Pill, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { restore as restoreIap, iapAvailable } from '@/lib/iap';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fontFor, useColors } from '@/lib/theme';

interface Plan { id: string; name: string; price_cents: number | null; price_month_cents: number | null; member_limit: number | null }
interface Sub { plan_id: string; status: string; provider: string | null; cancel_at_period_end: boolean; current_period_end: string | null; created_at: string }
interface Pay { id: string; created_at: string; amount_cents: number; currency: string; status: string }

// « Mon abonnement » : formule, consommation, échéances, moyen de paiement, historique.
export default function Subscription() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [pays, setPays] = useState<Pay[]>([]);
  const creatorId = creator?.id;
  useEffect(() => {
    if (!creatorId) return;
    supabase.from('plans').select('id, name, price_cents, price_month_cents, member_limit').order('sort_order').then(({ data }) => setPlans((data ?? []) as Plan[]));
    supabase.from('subscriptions').select('plan_id, status, provider, cancel_at_period_end, current_period_end, created_at').eq('creator_id', creatorId).maybeSingle().then(({ data }) => setSub(data as Sub | null));
    supabase.from('payments').select('id, created_at, amount_cents, currency, status').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(10).then(({ data }) => setPays((data ?? []) as Pay[]));
  }, [creatorId]);
  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio/subscription' } }} />;
  if (!creator) return <Redirect href="/studio/setup" />;

  const long = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso));
  const short = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  const money = (cents: number, cur = 'EUR') => new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(cents / 100);
  const plan = plans.find((p) => p.id === (sub?.plan_id ?? creator.plan_id));
  const idx = plans.findIndex((p) => p.id === plan?.id);
  const range = (p: Plan, i: number) => {
    const from = i <= 0 ? 0 : (plans[i - 1].member_limit ?? 0) + 1;
    return p.member_limit === null ? t('sub.rangeMore', { from: formatCount(locale, from - 1) }) : t('sub.range', { from: formatCount(locale, from), to: formatCount(locale, p.member_limit) });
  };
  const limit = plan?.member_limit ?? null;
  const pct = limit ? Math.min(100, Math.round((creator.member_count / limit) * 100)) : 0;
  const paid = !!plan && !!plan.price_cents;
  const apple = sub?.provider === 'app_store';
  const end = sub?.current_period_end ? long(sub.current_period_end) : '';
  const manage = () => (apple ? Linking.openURL('https://apps.apple.com/account/subscriptions') : WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/plan`));
  const link = (label: string, onPress: () => void, arrow: string, last?: boolean) => (
    <Pressable key={label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#EEEFF5' }}>
      <Text style={{ flex: 1, fontSize: 17, color: c.primary }}>{label}</Text><Text style={{ color: '#B6B9C6', fontSize: arrow === '›' ? 22 : 16 }}>{arrow}</Text>
    </Pressable>
  );
  const kv = (k: string, v: string) => (
    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 6 }}>
      <Text style={{ fontSize: 16, color: c.text, flexShrink: 1, maxWidth: 140 }}>{k}</Text>
      <Text style={{ fontSize: 16, color: c.muted, textAlign: 'right', flex: 1 }}>{v}</Text>
    </View>
  );

  return (
    <Screen nav={{ back: t('tabs.profile'), title: t('sub.title') }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 18, gap: 8, shadowColor: '#170B2F', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pill label={sub?.status === 'past_due' ? t('sub.pastDue') : t('sub.active')} tone={sub?.status === 'past_due' ? 'warn' : 'success'} />
          <Text style={{ fontSize: 14, color: c.muted }}>{creator.display_name}</Text>
        </View>
        <Text style={{ fontSize: 21, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.4, marginTop: 6 }}>{plan ? range(plan, idx) : ''}</Text>
        <Text style={{ fontSize: 16, color: c.text }}>
          {paid && plan?.price_cents ? <Text style={{ fontFamily: fontFor(800) }}>{money(plan.price_cents)} </Text> : null}
          <Text style={{ color: c.muted }}>{paid ? t('sub.perYear', { price: '' }).trim() : t('sub.free')}</Text>
        </Text>
        {limit ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: '#EEEFF5' }}><View style={{ width: `${Math.max(pct, 3)}%`, height: 6, borderRadius: 3, backgroundColor: c.primary }} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13.5, color: c.muted }}>{t('sub.membersOf', { count: formatCount(locale, creator.member_count), limit: formatCount(locale, limit) })}</Text>
              <Text style={{ fontSize: 13.5, color: c.muted }}>{pct} %</Text>
            </View>
          </View>
        ) : null}
        {paid ? (
          <View style={{ borderTopWidth: 1, borderTopColor: '#EEEFF5', marginTop: 10, paddingTop: 8 }}>
            {kv(t('sub.start'), long(sub?.created_at ?? creator.created_at))}
            {end ? kv(t('sub.renewal'), end) : null}
            {kv(t('sub.payment'), apple ? t('sub.storeApple') : t('sub.storeWeb'))}
          </View>
        ) : null}
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden' }}>
        {link(t('sub.change'), () => router.push('/studio/plan'), '›', !paid)}
        {paid ? link(apple ? t('sub.manageApple') : t('sub.manageWeb'), manage, '↗', !(apple && iapAvailable)) : null}
        {paid && apple && iapAvailable ? link(t('plan.restore'), async () => {
          try { Alert.alert(t((await restoreIap()) ? 'plan.restored' : 'plan.nothingToRestore')); } catch (e) { Alert.alert(errorMessage(locale, e)); }
        }, '', true) : null}
      </View>

      <Section title={t('sub.history')}>
        {pays.length ? pays.map((p, i) => (
          <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEEFF5' }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 17, color: c.text, fontFamily: fontFor(600) }}>{short(p.created_at)}</Text>
              <Text style={{ fontSize: 13.5, color: c.muted }}>{plan ? range(plan, idx) : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={{ fontSize: 17, color: c.text, fontFamily: fontFor(800) }}>{money(p.amount_cents, p.currency)}</Text>
              <Text style={{ fontSize: 13, color: p.status === 'succeeded' ? '#15803D' : c.sos, fontFamily: fontFor(700) }}>{p.status === 'succeeded' ? t('sub.paid') : p.status}</Text>
            </View>
          </View>
        )) : <View style={{ padding: 16 }}><T v="muted">{t('sub.noPayments')}</T></View>}
        {pays.length ? <Pressable onPress={() => (apple ? Linking.openURL('https://reportaproblem.apple.com') : manage())} style={{ alignItems: 'center', padding: 16 }}><Text style={{ color: c.primary, fontSize: 16, fontFamily: fontFor(600) }}>{t('sub.receipts')}</Text></Pressable> : null}
      </Section>

      {paid ? (
        <View style={{ flexDirection: 'row', gap: 12, backgroundColor: '#EEEFF5', borderRadius: 18, padding: 16 }}>
          <Text style={{ color: c.muted, fontSize: 15 }}>ⓘ</Text>
          <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: c.muted }}>{apple ? t('sub.cancelNote', { date: end }) : t('sub.cancelNoteWeb')}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
