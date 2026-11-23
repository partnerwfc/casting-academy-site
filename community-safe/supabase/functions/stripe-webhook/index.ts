// Webhook Stripe : seule voie par laquelle un forfait payant est attribué, après un vrai paiement.
import { normalizeStripeEvent, verifyStripeSignature } from '../_shared/billing.ts';
import { rpc, select } from '../_shared/db.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const payload = await req.text(); // corps brut : la signature porte sur ces octets exacts
  if (!secret || !(await verifyStripeSignature(payload, req.headers.get('stripe-signature'), secret))) {
    return new Response('invalid signature', { status: 400 });
  }
  try {
    const event = JSON.parse(payload);
    const plans = await select<{ id: string; stripe_price_id: string | null; stripe_price_id_month: string | null }>('plans', 'select=id,stripe_price_id,stripe_price_id_month');
    const priceToPlan: Record<string, string> = {};
    for (const p of plans) { if (p.stripe_price_id) priceToPlan[p.stripe_price_id] = p.id; if (p.stripe_price_id_month) priceToPlan[p.stripe_price_id_month] = p.id; }
    const normalized = normalizeStripeEvent(event, priceToPlan);
    const result = normalized ? await rpc<string>('apply_subscription_event', { p_event: normalized }) : 'not_relevant';
    console.log('stripe_event', event.type, result);
    return new Response('ok');
  } catch (e) {
    console.error('stripe_webhook_failed', String(e)); // 500 : Stripe réessaiera
    return new Response('error', { status: 500 });
  }
});
