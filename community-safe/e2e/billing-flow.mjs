// Test de bout en bout du paiement sur Supabase local : webhook signé → forfait, puis résiliation,
// suppression de compte, et refus de tout ce qui ne vient pas d'un vrai paiement.
// (Stripe lui-même n'est pas appelé : il faut un compte Stripe pour tester Checkout.)
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_local_test';
const run = randomUUID().slice(0, 8);
const step = (label) => console.log(`✔ ${label}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const service = createClient(API, SERVICE, { auth: { persistSession: false } });

async function otpFor(email) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (list.messages?.length) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: [list.messages[0].ID] }) });
      return /\b(\d{6})\b/.exec(m.Text)[1];
    }
    await sleep(250);
  }
  throw new Error('aucun code reçu');
}
async function signIn(name) {
  const email = `${name}.${run}@example.com`;
  const db = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.ifError((await db.auth.signInWithOtp({ email })).error);
  const { data, error } = await db.auth.verifyOtp({ email, token: await otpFor(email), type: 'email' });
  assert.ifError(error);
  return { db, user: data.user, token: data.session.access_token };
}
const webhook = async (event, secret = WEBHOOK_SECRET) => {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return fetch(`${API}/functions/v1/stripe-webhook`, { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body });
};
const subEvent = (creatorId, over = {}, type = 'customer.subscription.updated') => ({
  id: `evt_${randomUUID()}`, type,
  data: { object: { id: `sub_${run}`, customer: `cus_${run}`, status: 'active', cancel_at_period_end: false, metadata: { creator_id: creatorId },
    items: { data: [{ price: { id: `price_creator_${run}` }, current_period_end: Math.floor(Date.now() / 1000) + 31_536_000 }] }, ...over } },
});

const julie = await signIn('payjulie');
const handle = `pay_${run}`;
const { data: profile } = await julie.db.rpc('create_creator_profile', { p_handle: handle, p_display_name: 'Julie' });
await service.from('plans').update({ stripe_price_id: `price_creator_${run}` }).eq('id', 'creator');
await service.from('plans').update({ stripe_price_id: `price_pro_${run}` }).eq('id', 'pro');

// 1. Tout le monde commence en Discovery (gratuit, 100 membres).
let { data: stats } = await julie.db.rpc('creator_dashboard_stats');
assert.equal(stats.plan.id, 'discovery');
assert.equal(stats.plan.member_limit, 100);
step('nouveau créateur : forfait Discovery gratuit, 100 membres');

// 2. Un client ne peut pas se donner un forfait payant, ni appeler le webhook sans signature valide.
assert.ok((await julie.db.from('creator_profiles').update({ plan_id: 'premium' }).eq('id', profile.id)).error);
assert.ok((await julie.db.rpc('apply_subscription_event', { p_event: { creator_id: profile.id, plan_id: 'premium', status: 'active' } })).error);
assert.equal((await webhook(subEvent(profile.id), 'mauvais_secret')).status, 400);
assert.equal((await fetch(`${API}/functions/v1/stripe-webhook`, { method: 'POST', body: '{}' })).status, 400);
({ data: stats } = await julie.db.rpc('creator_dashboard_stats'));
assert.equal(stats.plan.id, 'discovery');
step('sécurité : forfait payant impossible sans paiement (client, RPC, webhook non signé)');

// 3. Le paiement réussit : Stripe signale l'abonnement, puis la facture.
assert.equal((await webhook(subEvent(profile.id))).status, 200);
const paid = { id: `evt_${randomUUID()}`, type: 'invoice.paid', data: { object: { id: `in_${run}`, customer: `cus_${run}`, amount_paid: 2999, currency: 'eur', total_taxes: [{ amount: 500 }] } } };
assert.equal((await webhook(paid)).status, 200);
assert.equal((await webhook(paid)).status, 200); // Stripe renvoie parfois deux fois
({ data: stats } = await julie.db.rpc('creator_dashboard_stats'));
assert.equal(stats.plan.id, 'creator');
assert.equal(stats.plan.member_limit, 10000);
const { data: payments } = await service.from('payments').select('amount_cents, tax_cents, currency, status').eq('creator_id', profile.id);
assert.deepEqual(payments, [{ amount_cents: 2999, tax_cents: 500, currency: 'EUR', status: 'succeeded' }]);
step('paiement : forfait Creator (10 000 membres) actif, facture enregistrée une seule fois');

// 4. Changer / annuler : résiliation programmée, puis fin de période.
await webhook(subEvent(profile.id, { cancel_at_period_end: true }));
const { data: sub } = await julie.db.from('subscriptions').select('plan_id, status, cancel_at_period_end').single();
assert.deepEqual(sub, { plan_id: 'creator', status: 'active', cancel_at_period_end: true });
assert.equal((await julie.db.rpc('set_free_plan')).error?.message, 'use_billing_portal');
await webhook(subEvent(profile.id, { items: { data: [{ price: { id: `price_pro_${run}` } }] }, cancel_at_period_end: false }));
({ data: stats } = await julie.db.rpc('creator_dashboard_stats'));
assert.equal(stats.plan.id, 'pro');
await webhook(subEvent(profile.id, { status: 'canceled' }, 'customer.subscription.deleted'));
({ data: stats } = await julie.db.rpc('creator_dashboard_stats'));
assert.equal(stats.plan.id, 'discovery');
step('abonnement : résiliation programmée, changement vers Pro, puis retour à Discovery à la fin');

// 5. Les fonctions d'envoi refusent les inconnus ; sans clé Stripe, l'erreur est propre.
assert.equal((await fetch(`${API}/functions/v1/billing`, { method: 'POST', body: '{}' })).status, 401);
const checkout = await fetch(`${API}/functions/v1/billing`, { method: 'POST', headers: { authorization: `Bearer ${julie.token}` }, body: JSON.stringify({ action: 'checkout', plan_id: 'creator' }) });
assert.ok([503, 400].includes(checkout.status), `checkout sans Stripe : ${checkout.status}`);
const free = await fetch(`${API}/functions/v1/billing`, { method: 'POST', headers: { authorization: `Bearer ${julie.token}` }, body: JSON.stringify({ action: 'checkout', plan_id: 'discovery' }) });
assert.equal(free.status, 400);
step('billing : refus sans connexion, forfait gratuit non achetable, erreur propre sans Stripe');

// 6. Suppression du compte : pseudo à retaper, puis tout disparaît.
const del = (confirm) => fetch(`${API}/functions/v1/delete-account`, { method: 'POST', headers: { authorization: `Bearer ${julie.token}` }, body: JSON.stringify({ confirm }) });
assert.equal((await del('autre')).status, 400);
assert.equal((await del(`@${handle}`)).status, 200);
const { data: gone } = await service.from('creator_profiles').select('id').eq('id', profile.id);
assert.equal(gone.length, 0);
const { data: authUsers } = await service.auth.admin.listUsers({ perPage: 200 });
assert.ok(!authUsers.users.some((u) => u.id === julie.user.id));
step('suppression : refusée sans le pseudo, puis profil, compte et données effacés');
console.log('\nParcours abonnements validé.');
