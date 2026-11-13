// Logique de facturation Stripe, sans dépendance : copiée telle quelle dans
// supabase/functions/_shared par `pnpm sync:functions`. Appels HTTP directs, pas de SDK.

export interface NormalizedEvent {
  creator_id?: string;
  customer_id?: string;
  subscription_id?: string;
  plan_id?: string;
  status?: 'active' | 'past_due' | 'canceled';
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  payment?: { id: string; amount_cents: number; tax_cents: number; currency: string; status: 'succeeded' | 'failed' };
}

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Vérifie l'en-tête `Stripe-Signature` (HMAC-SHA256 du corps brut) et refuse les événements trop anciens.
export async function verifyStripeSignature(
  payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`)));
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Les API Stripe attendent du x-www-form-urlencoded avec clés imbriquées : a[b][0][c]=v.
export function stripeForm(input: Record<string, unknown>): string {
  const pairs: string[] = [];
  const walk = (value: unknown, key: string) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${key}[${i}]`));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${key}[${k}]`);
    else pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [k, v] of Object.entries(input)) walk(v, k);
  return pairs.join('&');
}

type Json = Record<string, any>;
const iso = (seconds: unknown) => (typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : undefined);

// Traduit un événement Stripe en événement normalisé, ou null s'il ne nous concerne pas.
// `priceToPlan` associe un identifiant de prix Stripe à un forfait (colonne plans.stripe_price_id).
export function normalizeStripeEvent(event: Json, priceToPlan: Record<string, string>): NormalizedEvent | null {
  const object: Json = event?.data?.object ?? {};
  switch (event?.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const item: Json = object.items?.data?.[0] ?? {};
      const plan = priceToPlan[item.price?.id];
      const raw = event.type === 'customer.subscription.deleted' ? 'canceled' : object.status;
      const status = raw === 'active' || raw === 'trialing' ? 'active'
        : raw === 'past_due' || raw === 'unpaid' ? 'past_due'
        : raw === 'canceled' ? 'canceled' : null;
      if (!status || (!plan && status !== 'canceled')) return null;
      return {
        creator_id: object.metadata?.creator_id, customer_id: object.customer, subscription_id: object.id,
        plan_id: status === 'canceled' ? 'discovery' : plan, status,
        // Selon la version d'API, la fin de période est sur l'abonnement ou sur la ligne.
        current_period_end: iso(object.current_period_end ?? item.current_period_end),
        cancel_at_period_end: Boolean(object.cancel_at_period_end),
      };
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const paid = event.type === 'invoice.paid';
      const tax = typeof object.tax === 'number' ? object.tax
        : (object.total_taxes ?? object.total_tax_amounts ?? []).reduce((sum: number, t: Json) => sum + (t.amount ?? 0), 0);
      return {
        customer_id: object.customer,
        payment: {
          id: object.id, amount_cents: paid ? object.amount_paid : object.amount_due, tax_cents: tax,
          currency: object.currency, status: paid ? 'succeeded' : 'failed',
        },
      };
    }
    default:
      return null;
  }
}
