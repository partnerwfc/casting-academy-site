// Achats in-app Apple, sans prestataire intermédiaire : l'état d'un abonnement n'est JAMAIS cru sur parole.
// On interroge l'API App Store Server d'Apple (TLS + clé privée du compte), qui fait foi.
// Les notifications d'Apple ne servent que de déclencheur : on relit l'état réel chez Apple avant d'agir.
import { rpc, select } from './db.ts';

const KEY_ID = () => Deno.env.get('APPLE_IAP_KEY_ID');
const ISSUER_ID = () => Deno.env.get('APPLE_IAP_ISSUER_ID');
const PRIVATE_KEY = () => Deno.env.get('APPLE_IAP_PRIVATE_KEY');
export const BUNDLE_ID = () => Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.savemycommunity.app';
export const iapConfigured = () => !!(KEY_ID() && ISSUER_ID() && PRIVATE_KEY());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const b64u = (input: ArrayBuffer | string): string => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export function decodeJws<T = Record<string, any>>(jws: string): T {
  const part = jws.split('.')[1];
  if (!part) throw new Error('bad_jws');
  const pad = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(pad), (c) => c.charCodeAt(0))));
}

async function appleJwt(): Promise<string> {
  const pem = PRIVATE_KEY()!.replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: KEY_ID(), typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: ISSUER_ID(), iat: now, exp: now + 1500, aud: 'appstoreconnect-v1', bid: BUNDLE_ID() }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`; // WebCrypto rend déjà r||s, le format attendu par JWS
}

// Production d'abord, puis bac à sable (TestFlight, comptes de test).
async function appleGet<T>(path: string): Promise<T | null> {
  const jwt = await appleJwt();
  for (const host of ['api.storekit.itunes.apple.com', 'api.storekit-sandbox.itunes.apple.com']) {
    const res = await fetch(`https://${host}${path}`, { headers: { authorization: `Bearer ${jwt}` } });
    if (res.ok) return (await res.json()) as T;
    if (res.status !== 404 && res.status !== 400) throw new Error(`apple ${res.status}`);
  }
  return null;
}

export interface SyncResult { result: string; creatorId?: string; productId?: string; transactionId?: string; originalTransactionId?: string; environment?: string }

/** Relit l'état réel de l'abonnement chez Apple puis l'applique. `onlyCreator` : l'achat doit appartenir à ce créateur. */
export async function syncSubscription(transactionId: string, opts: { onlyCreator?: string; trustedType?: string } = {}): Promise<SyncResult> {
  if (!iapConfigured()) throw new Error('iap_unavailable');
  if (!/^\d{5,20}$/.test(transactionId)) return { result: 'bad_transaction_id' };
  const data = await appleGet<{ data?: { lastTransactions?: { status: number; signedTransactionInfo: string; signedRenewalInfo?: string }[] }[] }>(`/inApps/v1/subscriptions/${transactionId}`);
  const last = data?.data?.flatMap((g) => g.lastTransactions ?? []).find(Boolean);
  if (!last) return { result: 'not_found' };
  const tx = decodeJws(last.signedTransactionInfo);
  const renewal = last.signedRenewalInfo ? decodeJws(last.signedRenewalInfo) : {};
  const base: SyncResult = { result: '', productId: tx.productId, transactionId: String(tx.transactionId), originalTransactionId: String(tx.originalTransactionId), environment: tx.environment };

  if (tx.bundleId !== BUNDLE_ID()) return { ...base, result: 'wrong_bundle' };
  const plans = await select<{ id: string; apple_product_id: string | null; apple_product_id_month: string | null }>('plans', 'select=id,apple_product_id,apple_product_id_month');
  const plan = plans.find((p) => p.apple_product_id === tx.productId || p.apple_product_id_month === tx.productId);
  if (!plan) return { ...base, result: 'unknown_product' };

  // Propriétaire : le jeton de compte posé à l'achat (id du créateur) ; à défaut, l'abonnement déjà connu.
  let creatorId: string | undefined = UUID.test(String(tx.appAccountToken ?? '')) ? String(tx.appAccountToken).toLowerCase() : undefined;
  if (!creatorId) {
    const [s] = await select<{ creator_id: string }>('subscriptions', `select=creator_id&provider=eq.app_store&provider_subscription_id=eq.${encodeURIComponent(base.originalTransactionId!)}&limit=1`);
    creatorId = s?.creator_id;
  }
  if (!creatorId) return { ...base, result: 'no_owner' };
  if (opts.onlyCreator && creatorId !== opts.onlyCreator) return { ...base, creatorId, result: 'not_yours' };

  // 1 actif · 2 expiré · 3 nouvelle tentative de facturation · 4 période de grâce · 5 révoqué
  const status = last.status === 1 || last.status === 4 ? 'active' : last.status === 3 ? 'past_due' : 'canceled';
  const cancelAtEnd = status === 'active' && renewal.autoRenewStatus === 0;
  const refunded = !!tx.revocationDate;
  const event = {
    provider: 'app_store', creator_id: creatorId, subscription_id: base.originalTransactionId,
    plan_id: status === 'canceled' ? 'discovery' : plan.id, status,
    current_period_end: tx.expiresDate ? new Date(Number(tx.expiresDate)).toISOString() : null,
    cancel_at_period_end: cancelAtEnd,
    payment: status === 'active' && !refunded && typeof tx.price === 'number' && tx.currency ? {
      id: `apple_${tx.transactionId}`, amount_cents: Math.round(tx.price / 10), tax_cents: 0, currency: tx.currency, status: 'succeeded',
    } : undefined,
  };
  const applied = await rpc<string>('apply_subscription_event', { p_event: event });
  return { ...base, creatorId, result: `${applied}:${status}${cancelAtEnd ? ':cancels_at_period_end' : ''}` };
}

export async function logEvent(e: SyncResult & { source: 'client' | 'notification'; notification_type?: string; subtype?: string }): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  await fetch(`${url}/rest/v1/iap_events`, {
    method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      source: e.source, notification_type: e.notification_type ?? null, subtype: e.subtype ?? null, creator_id: e.creatorId ?? null,
      original_transaction_id: e.originalTransactionId ?? null, transaction_id: e.transactionId ?? null,
      product_id: e.productId ?? null, environment: e.environment ?? null, result: e.result,
    }),
  }).catch(() => {});
}
