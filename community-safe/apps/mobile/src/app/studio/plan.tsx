import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { errorMessage, formatCount, formatDate, type MessageKey } from '@community-safe/shared';
import { Button, Card, Input, Loading, Pill, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { buy, iapAvailable, loadStorePrices, restore } from '@/lib/iap';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fontFor, space, useColors } from '@/lib/theme';

interface Plan { id: string; name: string; price_cents: number | null; price_month_cents: number | null; currency: string; member_limit: number | null; apple_product_id: string | null; apple_product_id_month: string | null }
interface Sub { plan_id: string; status: string; provider: string | null; cancel_at_period_end: boolean; current_period_end: string | null }

// Les abonnements payants se souscrivent et se gèrent sur le site (Stripe). L'app affiche la formule,
// permet de repasser en gratuit quand aucun paiement n'est en cours, et de supprimer le compte.
export default function PlanScreen() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator, signOut } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [selected, setSelected] = useState('discovery');
  const [interval, setInterval_] = useState<'month' | 'year'>('year');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const creatorId = creator?.id;

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('plans').select('id, name, price_cents, price_month_cents, currency, member_limit, apple_product_id, apple_product_id_month').order('sort_order');
    setPlans((p ?? []) as Plan[]);
    if (creatorId) {
      const { data: s } = await supabase.from('subscriptions').select('plan_id, status, provider, cancel_at_period_end, current_period_end').eq('creator_id', creatorId).maybeSingle();
      setSub((s as Sub | null) ?? null);
    }
  }, [creatorId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!iapAvailable || !plans.length) return;
    const skus = plans.flatMap((p) => [p.apple_product_id, p.apple_product_id_month]).filter((x): x is string => !!x);
    if (skus.length) loadStorePrices(skus).then(setPrices).catch(() => {});
  }, [plans]);
  useEffect(() => { if (creator) setSelected(creator.plan_id); }, [creator]);

  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio/plan' } }} />;
  if (!creator) return <Redirect href="/studio/setup" />;

  const money = (p: Plan) => new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency }).format(((interval === 'month' && p.price_month_cents ? p.price_month_cents : p.price_cents) ?? 0) / 100);
  const name = (p: Plan) => { const k = `plan.name.${p.id}` as MessageKey; const v = t(k); return v === k ? p.name : v; };
  const price = (p: Plan) => (p.price_cents === null ? t('plan.quote') : p.price_cents === 0 ? t('plan.free') : `${money(p)} ${interval === 'month' && p.price_month_cents ? t('plan.perMonth') : t('plan.perYear')}`);
  const range = (p: Plan, i: number) => {
    const from = i === 0 ? 0 : (plans[i - 1].member_limit ?? 0) + 1;
    return p.member_limit === null ? t('plan.rangeMore', { from: formatCount(locale, from - 1) }) : t('plan.range', { from: formatCount(locale, from), to: formatCount(locale, p.member_limit) });
  };
  const chosen = plans.find((p) => p.id === selected);
  const paidActive = (sub?.provider === 'stripe' || sub?.provider === 'app_store') && ['active', 'past_due'].includes(sub.status);
  const appleSub = sub?.provider === 'app_store';
  const productId = interval === 'month' ? chosen?.apple_product_id_month : chosen?.apple_product_id;
  const storePrice = productId ? prices[productId] : undefined;

  const purchase = async () => {
    if (!productId || !storePrice || !creatorId) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (await buy(creatorId, productId)) { setNotice(t('plan.purchased')); setTimeout(load, 4000); setTimeout(load, 10000); }
    } catch (e) { setError(errorMessage(locale, e)); }
    setBusy(false);
  };
  const restorePurchases = async () => {
    if (!creatorId) return;
    setBusy(true); setError(null); setNotice(null);
    try { setNotice(t((await restore()) ? 'plan.restored' : 'plan.nothingToRestore')); setTimeout(load, 4000); }
    catch (e) { setError(errorMessage(locale, e)); }
    setBusy(false);
  };
  const downgrade = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('set_free_plan');
    setBusy(false);
    if (err) return setError(errorMessage(locale, err));
    load();
  };
  const remove = async () => {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.functions.invoke('delete-account', { body: { confirm } });
    setBusy(false);
    if (err || data?.ok !== true) return setError(t('account.deleteFail'));
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/');
  };
  void signOut;

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6zM8.8 12l2.4 2.4 4.2-4.4" /></Svg>
        </View>
        <T v="hero" center style={{ fontSize: 28, lineHeight: 34 }}>{t('plan.headline')}</T>
        <T v="muted" center>{t('plan.subtitle')}</T>
      </View>

      {paidActive && sub ? (
        <Card tone="soft">
          <T v="heading">{t('plan.current')}</T>
          {sub.status === 'past_due' ? <T v="small" style={{ color: c.sos }}>{t('plan.pastDue')}</T>
            : sub.current_period_end ? <T v="small">{t(sub.cancel_at_period_end ? 'plan.endsOn' : 'plan.renews', { date: formatDate(locale, sub.current_period_end).split(',')[0] })}</T> : null}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', backgroundColor: '#EEEFF5', borderRadius: 14, padding: 3 }}>
        {(['month', 'year'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => setInterval_(k)} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: interval === k ? '#fff' : 'transparent' }}>
            <T v="heading" style={{ fontSize: 15 }}>{t(k === 'month' ? 'plan.monthly' : 'plan.yearly')}</T>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        {plans.map((p, i) => {
          const on = selected === p.id;
          return (
            <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { setSelected(p.id); setError(null); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: on ? 15 : 16, borderRadius: 20, borderWidth: on ? 1.5 : 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.card }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.primary : '#C9CCD8', backgroundColor: on ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <T v="heading">{name(p)}</T>
                  {p.id === creator.plan_id ? <Pill label={t('plan.currentBadge')} tone="primary" /> : null}
                </View>
                <T v="small">{range(p, i)}</T>
              </View>
              <T v="heading" style={{ fontFamily: fontFor(800) }}>{price(p)}</T>
            </Pressable>
          );
        })}
      </View>

      {chosen ? (
        <View style={{ gap: space.md }}>
          <View>
            <T v="small">{t('plan.selection')}</T>
            <T v="title">{name(chosen)}</T>
            <T v="small">{t('plan.billedYearly')}</T>
          </View>
          {chosen.price_cents === 0 && chosen.id !== creator.plan_id && !paidActive
            ? <Button label={t('plan.activateFree')} onPress={downgrade} loading={busy} /> : null}
          {chosen.price_cents !== 0 && chosen.price_cents !== null && chosen.id !== creator.plan_id && iapAvailable
            ? <Button label={t('plan.subscribeIap', { price: storePrice ?? price(chosen) })} onPress={purchase} loading={busy} disabled={!storePrice} /> : null}
          {chosen.price_cents !== 0 && chosen.id !== creator.plan_id && !iapAvailable
            ? <><T v="small">{t('plan.onWeb')}</T><Button label={t('plan.openWeb')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/plan`)} /></> : null}
          {paidActive ? <Button label={t('plan.manage')} kind="secondary" onPress={() => (appleSub ? Linking.openURL('https://apps.apple.com/account/subscriptions') : WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/plan`))} /> : null}
          {notice ? <T v="small" style={{ color: c.success }}>{notice}</T> : null}
          {chosen.price_cents !== null && chosen.member_limit !== null && creator.member_count > chosen.member_limit ? <T v="small">{t('plan.overCapacity')}</T> : null}
          {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}
        </View>
      ) : null}

      {iapAvailable ? (
        <View style={{ gap: space.sm, alignItems: 'center' }}>
          <T v="small" center>{t('plan.renewNote')}</T>
          <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Pressable onPress={restorePurchases}><T v="small" style={{ color: c.primary, fontWeight: '700' }}>{t('plan.restore')}</T></Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)}><T v="small" style={{ color: c.primary, fontWeight: '700' }}>{t('auth.terms')}</T></Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}><T v="small" style={{ color: c.primary, fontWeight: '700' }}>{t('auth.privacy')}</T></Pressable>
          </View>
        </View>
      ) : null}

      <Card tone="sos">
        <T v="heading">{t('account.danger')}</T>
        {deleting ? (
          <>
            <T v="muted">{t('account.deleteBody', { count: formatCount(locale, creator.member_count) })}</T>
            <Input label={t('account.deleteConfirm', { handle: `@${creator.handle}` })} value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoCorrect={false} />
            <Button label={t('account.deleteAction')} kind="sos" loading={busy} disabled={confirm.replace(/^@/, '').toLowerCase() !== creator.handle}
              onPress={() => Alert.alert(t('account.danger'), t('profile.deleteConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('account.deleteAction'), style: 'destructive', onPress: remove }])} />
            <Button label={t('common.cancel')} kind="ghost" onPress={() => { setDeleting(false); setConfirm(''); }} />
          </>
        ) : <Button label={t('account.danger')} kind="danger" onPress={() => setDeleting(true)} />}
      </Card>
    </Screen>
  );
}
