import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { errorMessage, formatCount, formatDate, type MessageKey } from '@community-safe/shared';
import { Button, Card, Input, Loading, Pill, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fontFor, space, useColors } from '@/lib/theme';

interface Plan { id: string; name: string; price_cents: number | null; currency: string; member_limit: number | null }
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const creatorId = creator?.id;

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('plans').select('id, name, price_cents, currency, member_limit').order('sort_order');
    setPlans((p ?? []) as Plan[]);
    if (creatorId) {
      const { data: s } = await supabase.from('subscriptions').select('plan_id, status, provider, cancel_at_period_end, current_period_end').eq('creator_id', creatorId).maybeSingle();
      setSub((s as Sub | null) ?? null);
    }
  }, [creatorId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (creator) setSelected(creator.plan_id); }, [creator]);

  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio/plan' } }} />;
  if (!creator) return <Redirect href="/studio/setup" />;

  const money = (p: Plan) => new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency }).format((p.price_cents ?? 0) / 100);
  const name = (p: Plan) => { const k = `plan.name.${p.id}` as MessageKey; const v = t(k); return v === k ? p.name : v; };
  const price = (p: Plan) => (p.price_cents === null ? t('plan.quote') : p.price_cents === 0 ? t('plan.free') : `${money(p)} ${t('plan.perYear')}`);
  const range = (p: Plan, i: number) => {
    const from = i === 0 ? 0 : (plans[i - 1].member_limit ?? 0) + 1;
    return p.member_limit === null ? t('plan.rangeMore', { from: formatCount(locale, from - 1) }) : t('plan.range', { from: formatCount(locale, from), to: formatCount(locale, p.member_limit) });
  };
  const paidActive = sub?.provider === 'stripe' && ['active', 'past_due'].includes(sub.status);
  const chosen = plans.find((p) => p.id === selected);

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
      <T v="muted">{t('plan.subtitle')}</T>

      {paidActive && sub ? (
        <Card tone="soft">
          <T v="heading">{t('plan.current')}</T>
          {sub.status === 'past_due' ? <T v="small" style={{ color: c.sos }}>{t('plan.pastDue')}</T>
            : sub.current_period_end ? <T v="small">{t(sub.cancel_at_period_end ? 'plan.endsOn' : 'plan.renews', { date: formatDate(locale, sub.current_period_end).split(',')[0] })}</T> : null}
        </Card>
      ) : null}

      <View style={{ gap: 10 }}>
        {plans.map((p, i) => {
          const on = selected === p.id;
          return (
            <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { setSelected(p.id); setError(null); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: on ? 15 : 16, borderRadius: 18, borderWidth: on ? 2 : 1.5, borderColor: on ? c.primary : c.border, backgroundColor: c.card }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? c.primary : c.border, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <T v="small" style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</T> : null}
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
          {chosen.price_cents !== 0 && chosen.id !== creator.plan_id
            ? <><T v="small">{t('plan.onWeb')}</T><Button label={t('plan.openWeb')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/plan`)} /></> : null}
          {paidActive ? <Button label={t('plan.manage')} kind="secondary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/plan`)} /> : null}
          {chosen.price_cents !== null && chosen.member_limit !== null && creator.member_count > chosen.member_limit ? <T v="small">{t('plan.overCapacity')}</T> : null}
          {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}
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
