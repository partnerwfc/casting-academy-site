// Suppression définitive du compte (droit à l'effacement, exigée aussi par l'App Store).
// 1. résilie immédiatement l'abonnement payant ; 2. supprime le compte et, en cascade, toutes les données.
import { authUser, cors, deleteAuthUser, json, rpc, select, stripe } from '../_shared/db.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const user = await authUser(req);
  if (!user) return json({ error: 'not_authenticated' }, 401);

  try {
    const { confirm } = await req.json().catch(() => ({}));
    const [creator] = await select<{ id: string; handle: string }>('creator_profiles', `select=id,handle&owner_user_id=eq.${user.id}&limit=1`);
    // Pour un créateur, la suppression emporte sa communauté : il doit retaper son pseudo.
    if (creator && String(confirm ?? '').replace(/^@/, '').toLowerCase() !== creator.handle) return json({ error: 'confirmation_required' }, 400);

    if (creator) {
      const [sub] = await select<{ status: string; provider: string | null; provider_subscription_id: string | null; provider_customer_id: string | null }>(
        'subscriptions', `select=status,provider,provider_subscription_id,provider_customer_id&creator_id=eq.${creator.id}&limit=1`);
      if (sub?.provider === 'stripe' && sub.provider_subscription_id && ['active', 'past_due'].includes(sub.status)) {
        // Facturation d'abord : si la résiliation échoue, rien n'est supprimé et la facturation ne continue pas dans le vide.
        try { await stripe(`/subscriptions/${sub.provider_subscription_id}`, 'DELETE'); }
        catch (e) { if (!String(e).includes('No such subscription')) throw e; }
      }
      if (sub?.provider_customer_id) {
        try { await stripe(`/customers/${sub.provider_customer_id}`, 'DELETE'); } catch { /* client déjà supprimé */ }
      }
      if (sub?.provider === 'stripe') {
        await rpc('apply_subscription_event', { p_event: { creator_id: creator.id, customer_id: sub.provider_customer_id, status: 'canceled', plan_id: 'discovery' } });
      }
    }
    await rpc('delete_my_account', {}, user.token);
    await deleteAuthUser(user.id).catch(() => {}); // déjà supprimé par delete_my_account ; sans effet sinon
    return json({ ok: true });
  } catch (e) {
    console.error('delete_account_failed', String(e));
    return json({ error: 'delete_failed' }, 500);
  }
});
