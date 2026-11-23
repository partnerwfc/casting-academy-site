'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  errorMessage, formatCount, formatDate, type CreatorProfile, type MessageKey,
} from '@community-safe/shared';
import { Footer, Header } from '@/components/Chrome';
import { useI18n } from '@/lib/i18n';
import { SITE_URL, supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { useRouter } from 'next/navigation';

interface Plan { id: string; name: string; price_cents: number | null; price_month_cents: number | null; currency: string; member_limit: number | null; sort_order: number }
interface Subscription { plan_id: string; status: string; provider: string | null; cancel_at_period_end: boolean; current_period_end: string | null }

export default function PlanPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const session = useSession();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [selected, setSelected] = useState<string>('discovery');
  const [interval, setInterval_] = useState<'month' | 'year'>('year');
  const [quote, setQuote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const db = supabase();
    const { data: c } = await db.from('creator_profiles').select('*').eq('owner_user_id', userId).maybeSingle();
    setCreator((c as CreatorProfile | null) ?? null);
    const { data: p } = await db.from('plans').select('id, name, price_cents, price_month_cents, currency, member_limit, sort_order').order('sort_order');
    setPlans((p ?? []) as Plan[]);
    if (c) {
      const { data: s } = await db.from('subscriptions').select('plan_id, status, provider, cancel_at_period_end, current_period_end').eq('creator_id', c.id).maybeSingle();
      setSub((s as Subscription | null) ?? null);
      setSelected((c as CreatorProfile).plan_id);
    }
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (session === null) router.replace('/login'); }, [session, router]);

  const money = (plan: Plan) => new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency }).format(((interval === 'month' && plan.price_month_cents ? plan.price_month_cents : plan.price_cents) ?? 0) / 100);
  const planName = (plan: Plan) => t(`plan.name.${plan.id}` as MessageKey) === `plan.name.${plan.id}` ? plan.name : t(`plan.name.${plan.id}` as MessageKey);
  const range = (plan: Plan, index: number) => {
    const from = index === 0 ? 0 : (plans[index - 1].member_limit ?? 0) + 1;
    return plan.member_limit === null ? t('plan.rangeMore', { from: formatCount(locale, from - 1) })
      : t('plan.range', { from: formatCount(locale, from), to: formatCount(locale, plan.member_limit) });
  };
  const priceLabel = (plan: Plan) => plan.price_cents === null ? t('plan.quote') : plan.price_cents === 0 ? t('plan.free') : `${money(plan)} ${interval === 'month' && plan.price_month_cents ? t('plan.perMonth') : t('plan.perYear')}`;

  const current = creator?.plan_id ?? 'discovery';
  const chosen = plans.find((p) => p.id === selected);
  const paidActive = sub?.provider === 'stripe' && sub.status !== 'canceled' && ['active', 'past_due'].includes(sub.status);

  const callBilling = async (action: 'checkout' | 'portal') => {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase().functions.invoke('billing', {
      body: { action, plan_id: selected, interval, return_url: `${SITE_URL}/dashboard/plan` },
    });
    setBusy(false);
    const code = (data as { error?: string } | null)?.error ?? (err ? 'billing_failed' : null);
    if (code) {
      // Le corps d'erreur d'une fonction arrive dans err.context ; on en extrait le code pour un message précis.
      const detail = await (err as { context?: Response } | null)?.context?.json?.().catch(() => null);
      return setError(errorMessage(locale, detail?.error ?? code));
    }
    window.location.href = (data as { url: string }).url;
  };

  const act = async () => {
    if (!chosen) return;
    setMessage(null); setError(null);
    if (chosen.id === current && !paidActive) return;
    if (chosen.price_cents === null) {
      setBusy(true);
      const { error: err } = await supabase().rpc('request_quote', { p_message: quote.trim() || null });
      setBusy(false);
      return err ? setError(errorMessage(locale, err)) : setMessage(t('plan.quoteSent'));
    }
    if (chosen.price_cents === 0) {
      if (paidActive) return callBilling('portal'); // résilier un abonnement payant passe par le portail
      setBusy(true);
      const { error: err } = await supabase().rpc('set_free_plan');
      setBusy(false);
      if (err) return setError(errorMessage(locale, err));
      return load();
    }
    return callBilling(paidActive ? 'portal' : 'checkout');
  };

  const remove = async () => {
    if (!creator) return;
    setBusy(true); setError(null);
    const { data, error: err } = await supabase().functions.invoke('delete-account', { body: { confirm } });
    setBusy(false);
    if (err || (data as { ok?: boolean } | null)?.ok !== true) {
      const detail = await (err as { context?: Response } | null)?.context?.json?.().catch(() => null);
      return setError(detail?.error === 'confirmation_required' ? errorMessage(locale, 'confirmation_required') : t('account.deleteFail'));
    }
    await supabase().auth.signOut({ scope: 'local' });
    window.location.href = '/';
  };

  const ctaLabel = !chosen ? '' :
    chosen.price_cents === null ? t('plan.requestQuote')
    : chosen.id === current && !paidActive ? t('plan.current')
    : chosen.price_cents === 0 ? (paidActive ? t('plan.manage') : t('plan.activateFree'))
    : paidActive ? t('plan.manage') : t('plan.subscribe', { price: money(chosen) });

  return (
    <>
      <Header />
      <main className="narrow stack" style={{ paddingTop: 16, paddingBottom: 32 }}>
        <div className="stack">
          <span className="eyebrow">{t('tabs.profile')} · {t('profile.creatorSpace')}</span>
          <h2>{t('plan.title')}</h2>
          <p className="muted">{t('plan.subtitle')}</p>
        </div>

        {sub && paidActive ? (
          <div className="card soft">
            <strong>{t('plan.current')} · {planName(plans.find((p) => p.id === sub.plan_id) ?? { id: sub.plan_id, name: sub.plan_id } as Plan)}</strong>
            {sub.status === 'past_due' ? <p className="error">{t('plan.pastDue')}</p>
              : sub.current_period_end ? <p className="muted">{sub.cancel_at_period_end ? t('plan.endsOn', { date: formatDate(locale, sub.current_period_end).split(',')[0] }) : t('plan.renews', { date: formatDate(locale, sub.current_period_end).split(',')[0] })}</p> : null}
            <p className="small">{t('plan.changeNote')}</p>
          </div>
        ) : null}

        <div role="tablist" style={{ display: 'flex', background: 'var(--surface, #EEEFF5)', borderRadius: 14, padding: 3 }}>
          {(['month', 'year'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={interval === k} onClick={() => setInterval_(k)}
              style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: 0, fontWeight: 700, background: interval === k ? '#fff' : 'transparent', cursor: 'pointer' }}>
              {t(k === 'month' ? 'plan.monthly' : 'plan.yearly')}
            </button>
          ))}
        </div>
        <div className="stack" role="radiogroup" aria-label={t('plan.title')} style={{ gap: 10 }}>
          {plans.map((plan, i) => (
            <button key={plan.id} type="button" role="radio" aria-checked={selected === plan.id} className="plan" onClick={() => { setSelected(plan.id); setMessage(null); setError(null); }}>
              <span className="radio">{selected === plan.id ? '✓' : ''}</span>
              <span>
                <span className="name">{planName(plan)}</span>
                {plan.id === current ? <span className="pill primary" style={{ marginLeft: 8 }}>{t('plan.currentBadge')}</span> : null}
                <br /><span className="small">{range(plan, i)}</span>
              </span>
              <span className="price">{priceLabel(plan)}</span>
            </button>
          ))}
        </div>

        {chosen ? (
          <div className="stack" style={{ gap: 12 }}>
            <div>
              <span className="small">{t('plan.selection')}</span>
              <h3 style={{ fontSize: '1.4rem' }}>{planName(chosen)} · {priceLabel(chosen)}</h3>
              <p className="small">{t('plan.billedYearly')}</p>
            </div>
            {chosen.price_cents === null ? (
              <textarea className="input" rows={3} maxLength={1000} placeholder={t('plan.quotePlaceholder')} value={quote} onChange={(e) => setQuote(e.target.value)} />
            ) : null}
            {chosen.price_cents !== null && chosen.member_limit !== null && creator && creator.member_count > chosen.member_limit
              ? <p className="small">{t('plan.overCapacity')}</p> : null}
            {message ? <p className="okc" role="status" style={{ color: 'var(--success)' }}>{message}</p> : null}
            {error ? <p className="error" role="alert">{error}</p> : null}
            <button className="btn block" onClick={act} disabled={busy || (chosen.id === current && !paidActive && chosen.price_cents !== null)}>{ctaLabel} →</button>
            {paidActive && chosen.id !== current ? null : null}
          </div>
        ) : null}

        {paidActive ? <button className="btn secondary block" onClick={() => callBilling('portal')} disabled={busy}>{t('plan.manage')}</button> : null}

        {creator ? (
          <section className="card sos" style={{ marginTop: 24 }}>
            <h3>{t('account.danger')}</h3>
            {deleting ? (
              <>
                <p>{t('account.deleteBody', { count: formatCount(locale, creator.member_count) })}</p>
                <label className="field">{t('account.deleteConfirm', { handle: `@${creator.handle}` })}
                  <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="none" autoComplete="off" />
                </label>
                <div className="row">
                  <button className="btn sos" disabled={busy || confirm.replace(/^@/, '').toLowerCase() !== creator.handle} onClick={remove}>{t('account.deleteAction')}</button>
                  <button className="btn ghost" onClick={() => { setDeleting(false); setConfirm(''); }}>{t('common.cancel')}</button>
                </div>
              </>
            ) : <button className="btn danger" style={{ alignSelf: 'flex-start' }} onClick={() => setDeleting(true)}>{t('account.danger')}</button>}
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
