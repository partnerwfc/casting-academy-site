// Worker d'envoi des alertes (Edge Function Supabase, Deno).
//
// Déclenché de deux façons :
//   1. par l'app du créateur juste après `create_alert` (envoi immédiat) ;
//   2. par pg_cron chaque minute (reprises sur erreur, reçus, filet de sécurité).
// Il est idempotent : les destinataires sont réservés en base avec SKIP LOCKED,
// plusieurs exécutions simultanées n'envoient donc jamais deux fois la même alerte.
import {
  buildMessages, chunk, toDeliveryResults, EXPO_CHUNK_SIZE,
  type ClaimedRecipient, type ExpoTicket, type OutgoingMessage,
} from '../_shared/push.ts';
import { checkRedirects } from '../_shared/link-safety.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISPATCH_SECRET = Deno.env.get('DISPATCH_SECRET');       // utilisé par pg_cron
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');   // optionnel (sécurité renforcée Expo)

// Surchargable pour les tests d'intégration (serveur Expo simulé).
const EXPO_BASE_URL = Deno.env.get('EXPO_PUSH_BASE_URL') ?? 'https://exp.host/--/api/v2/push';
const EXPO_SEND_URL = `${EXPO_BASE_URL}/send`;
const EXPO_RECEIPTS_URL = `${EXPO_BASE_URL}/getReceipts`;
const TIME_BUDGET_MS = 45_000;
const CLAIM_SIZE = 500;
const PARALLEL_CHUNKS = 4;

// Accès base avec la clé de service, en HTTP direct : aucune dépendance externe à charger
// au démarrage (le worker doit partir vite, y compris à froid).
const serviceHeaders = {
  apikey: SERVICE_ROLE_KEY,
  authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'content-type': 'application/json',
};

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: serviceHeaders, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${name} failed: ${res.status} ${await res.text()}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

async function select<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: serviceHeaders });
  if (!res.ok) throw new Error(`select ${table} failed: ${res.status}`);
  return (await res.json()) as T[];
}

function expoHeaders(): HeadersInit {
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
  };
}

// Qui a le droit de réveiller le worker : le cron (secret) ou un créateur ayant une alerte en attente.
async function isAuthorized(req: Request): Promise<boolean> {
  if (DISPATCH_SECRET && req.headers.get('x-dispatch-secret') === DISPATCH_SECRET) return true;
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return false;
  if (token === SERVICE_ROLE_KEY) return true;
  // Jeton utilisateur : validé par le service d'authentification, jamais décodé localement.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return false;
  const user = (await userRes.json()) as { id?: string };
  if (!user.id || !/^[0-9a-f-]{36}$/.test(user.id)) return false;
  const pending = await select<{ id: string }>(
    'alerts', `select=id&created_by=eq.${user.id}&status=in.(queued,sending)&limit=1`);
  return pending.length > 0;
}

// Étape 1 — contrôle des liens (redirections comprises) avant tout envoi.
async function vetQueuedAlerts(): Promise<number> {
  const alerts = await rpc<{ id: string; link_url: string | null }[]>('alerts_to_vet', { p_limit: 20 });
  if (!alerts?.length) return 0;
  const blockedDomains = (await select<{ domain: string }>('blocked_link_domains', 'select=domain')).map((b) => b.domain);
  for (const alert of alerts) {
    const verdict = alert.link_url
      ? await checkRedirects(alert.link_url, blockedDomains, (url, init) => fetch(url, init))
      : { ok: true as const, reason: undefined };
    await rpc('vet_alert', { p_alert_id: alert.id, p_ok: verdict.ok, p_reason: verdict.reason ?? null });
  }
  return alerts.length;
}

async function sendChunk(messages: OutgoingMessage[]): Promise<(ExpoTicket | null)[]> {
  try {
    const res = await fetch(EXPO_SEND_URL, {
      method: 'POST',
      headers: expoHeaders(),
      body: JSON.stringify(messages.map((m) => m.message)),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('expo_send_http_error', res.status);
      return messages.map(() => null);
    }
    const json = await res.json();
    const tickets: ExpoTicket[] = Array.isArray(json?.data) ? json.data : [];
    return messages.map((_, i) => tickets[i] ?? null);
  } catch (e) {
    console.error('expo_send_network_error', String(e));
    return messages.map(() => null); // lot entier à réessayer
  }
}

// Étape 2 — envoi par lots.
async function dispatchBatch(): Promise<{ recipients: number; accepted: number }> {
  const recipients = (await rpc<ClaimedRecipient[]>('claim_alert_recipients', { p_limit: CLAIM_SIZE })) ?? [];
  if (!recipients.length) return { recipients: 0, accepted: 0 };

  const outgoing = buildMessages(recipients);
  const chunks = chunk(outgoing, EXPO_CHUNK_SIZE);
  const tickets: (ExpoTicket | null)[] = [];
  for (const group of chunk(chunks, PARALLEL_CHUNKS)) {
    const settled = await Promise.all(group.map(sendChunk));
    for (const t of settled) tickets.push(...t);
  }

  const results = toDeliveryResults(recipients, outgoing, tickets);
  await rpc('record_delivery_results', { p_results: results });
  return {
    recipients: recipients.length,
    accepted: results.filter((r) => r.attempts.some((a) => a.accepted)).length,
  };
}

// Étape 3 — reçus Expo : confirme la remise au fournisseur (APNs/FCM) et purge les jetons morts.
async function checkReceipts(): Promise<number> {
  const pending = (await rpc<{ id: number; provider_ticket_id: string }[]>('pending_receipts', { p_limit: 1000 })) ?? [];
  if (!pending.length) return 0;
  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify({ ids: pending.map((p) => p.provider_ticket_id) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return 0;
  const receipts = ((await res.json())?.data ?? {}) as Record<string, { status: string; details?: { error?: string } }>;
  const updates = pending
    .filter((p) => receipts[p.provider_ticket_id])
    .map((p) => ({
      id: p.id,
      status: receipts[p.provider_ticket_id].status,
      error_code: receipts[p.provider_ticket_id].details?.error ?? null,
    }));
  if (updates.length) await rpc('record_receipts', { p_receipts: updates });
  return updates.length;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!(await isAuthorized(req))) return new Response('forbidden', { status: 403 });

  const started = Date.now();
  const summary = { vetted: 0, recipients: 0, accepted: 0, finalized: 0, receipts: 0 };
  try {
    summary.vetted = await vetQueuedAlerts();
    while (Date.now() - started < TIME_BUDGET_MS) {
      const batch = await dispatchBatch();
      if (!batch.recipients) break;
      summary.recipients += batch.recipients;
      summary.accepted += batch.accepted;
    }
    summary.finalized = (await rpc<number>('finalize_alerts')) ?? 0;
    summary.receipts = await checkReceipts();
    console.log('dispatch_summary', JSON.stringify(summary));
    return Response.json(summary);
  } catch (e) {
    console.error('dispatch_failed', e);
    return Response.json({ error: 'dispatch_failed', ...summary }, { status: 500 });
  }
});
