// Webhook RevenueCat (achats in-app Apple) : attribue le forfait après un vrai achat validé par Apple.
// app_user_id = identifiant du profil créateur (défini à la configuration du SDK dans l'app).
import { rpc, select } from '../_shared/db.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const ACTIVE = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const auth = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '');
  if (!secret || !safeEqual(auth, secret)) return new Response('unauthorized', { status: 401 });
  try {
    const ev = (await req.json()).event as Record<string, any> | undefined;
    if (!ev || !UUID.test(String(ev.app_user_id ?? ''))) return new Response('ignored');
    if (ev.store && ev.store !== 'APP_STORE') return new Response('ignored');

    let status: 'active' | 'past_due' | 'canceled' | null = null;
    let cancelAtEnd = false;
    if (ACTIVE.has(ev.type)) status = 'active';
    else if (ev.type === 'CANCELLATION') { status = 'active'; cancelAtEnd = true; }
    else if (ev.type === 'BILLING_ISSUE') status = 'past_due';
    else if (ev.type === 'EXPIRATION') status = 'canceled';
    if (!status) return new Response('not_relevant');

    const plans = await select<{ id: string; apple_product_id: string | null; apple_product_id_month: string | null }>('plans', 'select=id,apple_product_id,apple_product_id_month');
    const plan = plans.find((p) => p.apple_product_id === ev.product_id || p.apple_product_id_month === ev.product_id);
    if (!plan && status !== 'canceled') return new Response('unknown_product');

    const priced = status === 'active' && !cancelAtEnd && typeof ev.price_in_purchased_currency === 'number' && ev.transaction_id;
    const event = {
      provider: 'app_store',
      creator_id: ev.app_user_id,
      subscription_id: ev.original_transaction_id ?? ev.transaction_id ?? null,
      plan_id: plan?.id ?? 'discovery',
      status,
      current_period_end: ev.expiration_at_ms ? new Date(Number(ev.expiration_at_ms)).toISOString() : null,
      cancel_at_period_end: cancelAtEnd,
      payment: priced ? {
        id: `apple_${ev.transaction_id}`, amount_cents: Math.round(ev.price_in_purchased_currency * 100),
        tax_cents: Math.round((ev.tax_percentage ? ev.price_in_purchased_currency * ev.tax_percentage : 0) * 100),
        currency: ev.currency ?? 'EUR', status: 'succeeded',
      } : undefined,
    };
    const result = await rpc<string>('apply_subscription_event', { p_event: event });
    console.log('revenuecat_event', ev.type, result);
    return new Response('ok');
  } catch (e) {
    console.error('revenuecat_webhook_failed', String(e)); // 500 : RevenueCat réessaiera
    return new Response('error', { status: 500 });
  }
});
