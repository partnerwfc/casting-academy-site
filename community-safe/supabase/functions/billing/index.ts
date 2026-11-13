// Paiement des abonnements créateurs (Stripe). Aucune carte ne transite par nos serveurs :
// l'utilisateur est redirigé vers Stripe Checkout (souscription) ou le Customer Portal
// (changer de formule, résilier, factures, moyen de paiement).
//   POST { action: 'checkout', plan_id, return_url }   → { url }
//   POST { action: 'portal', return_url }              → { url }
import { stripeForm } from '../_shared/billing.ts';
import { authUser, cors, json, patch, select, SITE_URL, stripe } from '../_shared/db.ts';

interface Creator { id: string; handle: string }
interface Subscription { provider: string | null; status: string; provider_customer_id: string | null }
interface Plan { id: string; price_cents: number | null; stripe_price_id: string | null }

// Le retour doit rester sur notre site : jamais de redirection vers une adresse choisie par le client.
const safeReturn = (value: unknown) =>
  typeof value === 'string' && (value === SITE_URL || value.startsWith(`${SITE_URL}/`)) ? value : `${SITE_URL}/dashboard/plan`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const user = await authUser(req);
  if (!user) return json({ error: 'not_authenticated' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const [creator] = await select<Creator>('creator_profiles', `select=id,handle&owner_user_id=eq.${user.id}&limit=1`);
    if (!creator) return json({ error: 'creator_not_found' }, 404);
    const [sub] = await select<Subscription>('subscriptions', `select=provider,status,provider_customer_id&creator_id=eq.${creator.id}&limit=1`);
    const returnUrl = safeReturn(body.return_url);

    if (body.action === 'portal') {
      if (!sub?.provider_customer_id) return json({ error: 'no_billing_account' }, 400);
      const session = await stripe<{ url: string }>('/billing_portal/sessions', 'POST',
        stripeForm({ customer: sub.provider_customer_id, return_url: returnUrl }));
      return json({ url: session.url });
    }

    if (body.action === 'checkout') {
      const planId = String(body.plan_id ?? '');
      const [plan] = await select<Plan>('plans', `select=id,price_cents,stripe_price_id&id=eq.${encodeURIComponent(planId)}&is_public=eq.true&limit=1`);
      if (!plan || !plan.price_cents || !plan.stripe_price_id) return json({ error: 'plan_not_purchasable' }, 400);
      // Un abonnement payant existe déjà : on change de formule depuis le portail, pas avec un second abonnement.
      if (sub?.provider === 'stripe' && ['active', 'past_due'].includes(sub.status)) return json({ error: 'use_billing_portal' }, 409);

      let customer = sub?.provider_customer_id;
      if (!customer) {
        const created = await stripe<{ id: string }>('/customers', 'POST',
          stripeForm({ email: user.email ?? undefined, metadata: { creator_id: creator.id, handle: creator.handle } }));
        customer = created.id;
        await patch('subscriptions', `creator_id=eq.${creator.id}`, { provider_customer_id: customer });
      }
      const session = await stripe<{ url: string }>('/checkout/sessions', 'POST', stripeForm({
        mode: 'subscription', customer, client_reference_id: creator.id,
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        subscription_data: { metadata: { creator_id: creator.id } },
        success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}checkout=success`,
        cancel_url: returnUrl,
        billing_address_collection: 'auto',
        ...(Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true' ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto', name: 'auto' } } : {}),
      }));
      return json({ url: session.url });
    }
    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    const message = String((e as Error).message);
    console.error('billing_failed', message);
    return json({ error: message === 'billing_unavailable' ? 'billing_unavailable' : 'billing_failed' }, message === 'billing_unavailable' ? 503 : 500);
  }
});
