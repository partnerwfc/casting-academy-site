// Achat in-app Apple : l'app envoie l'identifiant de transaction, le serveur le vérifie auprès d'Apple.
import { BUNDLE_ID, iapConfigured, logEvent, syncSubscription } from '../_shared/apple.ts';
import { authUser, cors, json, select } from '../_shared/db.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const user = await authUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);
    if (!iapConfigured()) return json({ error: 'iap_unavailable' }, 503);
    const body = await req.json().catch(() => ({}));
    const [creator] = await select<{ id: string }>('creator_profiles', `select=id&owner_user_id=eq.${user.id}&limit=1`);
    if (!creator) return json({ error: 'creator_not_found' }, 404);
    const r = await syncSubscription(String(body.transaction_id ?? ''), { onlyCreator: creator.id });
    await logEvent({ ...r, creatorId: r.creatorId ?? creator.id, source: 'client' });
    const ok = r.result.startsWith('applied');
    return json({ ok, result: r.result, bundle: BUNDLE_ID() }, ok ? 200 : 422);
  } catch (e) {
    console.error('apple_iap_failed', String(e));
    return json({ error: 'iap_failed' }, 500);
  }
});
