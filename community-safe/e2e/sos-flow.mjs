// Test de bout en bout sur Supabase local : du suivi d'un créateur jusqu'à la notification SOS.
// Prérequis : `npx supabase start` avec supabase/functions/.env (voir .env.example).
// Les vrais services (Auth, API, RLS, Edge Function) tournent ; seul Expo est simulé.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const run = randomUUID().slice(0, 8);
const step = (label) => console.log(`✔ ${label}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = () => createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(API, SERVICE, { auth: { persistSession: false } });

// ── Faux serveur Expo Push : enregistre ce que le worker envoie réellement ──
const pushed = [];
const expo = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = JSON.parse(body || '{}');
    res.setHeader('content-type', 'application/json');
    if (req.url.endsWith('/send')) {
      pushed.push(...json);
      // Le jeton « dead » simule un appareil désinstallé.
      res.end(JSON.stringify({ data: json.map((m, i) => m.to.includes('dead')
        ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: `ticket-${pushed.length}-${i}` }) }));
    } else res.end(JSON.stringify({ data: {} }));
  });
});
await new Promise((r) => expo.listen(8787, '0.0.0.0', r));

// ── Connexion sans mot de passe : le code arrive par e-mail (Mailpit en local) ──
async function otpFor(email) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (list.messages?.length) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const code = /\b(\d{6})\b/.exec(message.Text ?? '')?.[1];
      await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: [list.messages[0].ID] }) });
      if (code) return code;
    }
    await sleep(250);
  }
  throw new Error(`aucun code reçu pour ${email}`);
}
async function signIn(name) {
  const email = `${name}.${run}@example.com`;
  const db = client();
  const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { locale: 'fr' } } });
  assert.ifError(error);
  const { data, error: verifyError } = await db.auth.verifyOtp({ email, token: await otpFor(email), type: 'email' });
  assert.ifError(verifyError);
  return { db, user: data.user, email };
}
const expectError = async (promise, message) => {
  const { error } = await promise;
  assert.equal(error?.message, message);
};
// Code TOTP (RFC 6238) pour la double authentification de l'administrateur.
function totp(secretBase32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secretBase32.replace(/=+$/, '')].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

try {
  // 1. Le créateur crée son espace et demande sa vérification.
  const creator = await signIn('julie');
  const handle = `julie_${run}`;
  const { data: profile, error: profileError } = await creator.db.rpc('create_creator_profile', {
    p_handle: `@${handle.toUpperCase()}`, p_display_name: 'Julie', p_category: 'influencer', p_bio: 'Créatrice',
  });
  assert.ifError(profileError);
  assert.equal(profile.handle, handle);
  await expectError(creator.db.rpc('create_alert', { p_kind: 'sos', p_message: 'x', p_idempotency_key: randomUUID(), p_reason: 'hacked' }), 'creator_not_verified');
  const { data: account, error: accountError } = await creator.db.rpc('add_social_account', { p_platform: 'instagram', p_url: `https://instagram.com/${handle.replace(/_/g, '.')}` });
  assert.ifError(accountError);
  const { data: started, error: requestError } = await creator.db.rpc('start_certification', { p_social_account_id: account.id });
  assert.ifError(requestError);
  assert.match(started.code, /^CS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  const verificationId = started.id;
  assert.equal((await creator.db.rpc('request_certification_review', { p_verification_id: verificationId })).error?.message, 'presence_required');
  assert.ifError((await service.rpc('record_presence_result', { p_verification_id: verificationId, p_passed: true, p_provider: 'test', p_ref: 'ref' })).error);
  assert.ifError((await creator.db.rpc('request_certification_review', { p_verification_id: verificationId })).error);
  step('créateur : profil créé, SOS refusé tant que non vérifié, vérification demandée');

  // 2. L'administrateur (MFA obligatoire) valide l'identité.
  const admin = await signIn('admin');
  await service.from('admin_roles').insert({ user_id: admin.user.id, role: 'admin' });
  await expectError(admin.db.rpc('admin_review_certification', { p_verification_id: verificationId, p_approve: true, p_reason: 'code présent sur le profil public' }), 'forbidden');
  const { data: factor, error: enrollError } = await admin.db.auth.mfa.enroll({ factorType: 'totp' });
  assert.ifError(enrollError);
  const { error: mfaError } = await admin.db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) });
  assert.ifError(mfaError);
  const { error: reviewError } = await admin.db.rpc('admin_review_certification', { p_verification_id: verificationId, p_approve: true, p_reason: 'code présent sur le profil public' });
  assert.ifError(reviewError);
  step('admin : refusé sans MFA, vérification approuvée avec MFA');

  // 3. Deux abonnés suivent le créateur via son lien ; un troisième refuse les SOS.
  const fans = [];
  for (const [name, token] of [['fan1', `ExponentPushToken[live-${run}-1]`], ['fan2', `ExponentPushToken[dead-${run}-2]`], ['fan3', `ExponentPushToken[live-${run}-3]`]]) {
    const fan = await signIn(name);
    const { error: followError } = await fan.db.rpc('follow_creator', { p_handle: handle, p_source: 'instagram' });
    assert.ifError(followError);
    const { error: deviceError } = await fan.db.rpc('register_device', {
      p_installation_id: `install-${name}-${run}`, p_platform: name === 'fan2' ? 'android' : 'ios', p_permission: 'granted', p_token: token,
    });
    assert.ifError(deviceError);
    fans.push(fan);
  }
  const { error: prefError } = await fans[2].db.rpc('set_notification_preferences', { p_creator_id: profile.id, p_sos: false, p_announcements: false });
  assert.ifError(prefError);
  const { data: members } = await fans[0].db.from('community_memberships').select('creator_id');
  assert.equal(members.length, 1);
  const { data: stats } = await creator.db.rpc('creator_dashboard_stats');
  assert.equal(stats.members_total, 3);
  assert.equal(stats.devices_with_valid_token, 3);
  const { data: leaked } = await creator.db.from('community_memberships').select('user_id');
  assert.equal(leaked.length, 0, 'un créateur ne doit pas voir la liste de ses membres');
  step('abonnés : 3 suivis, appareils enregistrés, compteur = 3, liste des membres invisible du créateur');

  // 4. Garde-fous : un abonné ne peut ni créer d'alerte ni réveiller le worker.
  await expectError(fans[0].db.rpc('create_alert', { p_kind: 'sos', p_message: 'faux', p_idempotency_key: randomUUID(), p_reason: 'hacked' }), 'creator_not_found');
  const { error: insertError } = await fans[0].db.from('alerts').insert({ creator_id: profile.id, kind: 'sos', reason: 'hacked', message: 'faux', idempotency_key: randomUUID() });
  assert.ok(insertError, 'écriture directe dans alerts refusée');
  const forbidden = await fans[0].db.functions.invoke('dispatch-alerts', { body: {} });
  assert.equal(forbidden.error?.context?.status, 403);
  await expectError(creator.db.rpc('create_alert', { p_kind: 'sos', p_message: 'x', p_idempotency_key: randomUUID(), p_reason: 'hacked', p_link_url: 'https://bit.ly/x' }), 'link_blocked_domain');
  step('sécurité : alerte forgée, écriture directe, worker et lien raccourci refusés');

  // 5. Le créateur envoie son SOS (deux appuis = une seule alerte).
  const key = randomUUID();
  const payload = { p_kind: 'sos', p_message: 'Mon Instagram est piraté. Retrouvez-moi sur Telegram.', p_idempotency_key: key, p_reason: 'hacked', p_link_url: 'https://t.me/julie' };
  const { data: alert, error: alertError } = await creator.db.rpc('create_alert', payload);
  assert.ifError(alertError);
  const { data: twice } = await creator.db.rpc('create_alert', payload);
  assert.equal(twice.id, alert.id);
  assert.equal(alert.recipients_total, 2, 'fan3 a désactivé les SOS');
  const { data: hidden } = await fans[0].db.from('alerts').select('id');
  assert.equal(hidden.length, 0, 'alerte invisible avant contrôle');

  const dispatch = await creator.db.functions.invoke('dispatch-alerts', { body: {} });
  assert.ifError(dispatch.error);
  assert.equal(dispatch.data.recipients, 2);
  assert.equal(dispatch.data.accepted, 1);
  step(`worker : ${JSON.stringify(dispatch.data)}`);

  // 6. Ce qu'Expo a réellement reçu.
  const mine = pushed.filter((m) => m.data.alertId === alert.id);
  assert.equal(mine.length, 2);
  const live = mine.find((m) => m.to.includes('live'));
  assert.equal(live.title, '🚨 Julie a envoyé une alerte');
  assert.equal(live.body, payload.p_message);
  assert.equal(live.channelId, 'sos');
  assert.ok(!mine.some((m) => m.to.includes(`${run}-3`)), 'aucun envoi à fan3');
  step('push : 2 notifications émises, titre localisé, rien pour l’abonné ayant refusé');

  // 7. Suivi d'envoi, jeton mort purgé, boîte de réception de l'abonné.
  const { data: tracking } = await creator.db.rpc('alert_delivery_stats', { p_alert_id: alert.id });
  assert.equal(tracking.status, 'sent');
  assert.equal(tracking.accepted_by_provider, 1);
  assert.equal(tracking.failed, 1);
  const { data: tokens } = await fans[1].db.from('push_tokens').select('status');
  assert.equal(tokens[0].status, 'invalid');
  const { data: inbox } = await fans[0].db.from('alert_recipients')
    .select('opened_at, alerts!inner(id, message, link_url, creator_profiles!inner(display_name))').eq('user_id', fans[0].user.id);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].alerts.creator_profiles.display_name, 'Julie');
  await fans[0].db.rpc('mark_alert_opened', { p_alert_id: alert.id, p_link: true });
  const { data: after } = await creator.db.rpc('alert_delivery_stats', { p_alert_id: alert.id });
  assert.equal(after.opened, 1);
  assert.equal(after.link_opened, 1);
  step('suivi : statut « sent », 1 acceptée, 1 jeton invalide purgé, alerte lue par l’abonné');

  // 8. Un second passage du worker ne renvoie rien.
  const before = pushed.length;
  await fetch(`${API}/functions/v1/dispatch-alerts`, { method: 'POST', headers: { 'x-dispatch-secret': 'local-dispatch-secret' } });
  assert.equal(pushed.length, before);
  step('idempotence : aucun doublon au second passage (déclenchement cron)');

  // 9. RGPD : export puis suppression.
  const { data: exported } = await fans[0].db.rpc('export_my_data');
  assert.equal(exported.memberships[0].creator, handle);
  assert.ifError((await fans[0].db.rpc('delete_my_account')).error);
  const { data: afterDelete } = await creator.db.rpc('creator_dashboard_stats');
  assert.equal(afterDelete.members_total, 2);
  step('RGPD : export complet, suppression de compte, compteur mis à jour');

  console.log(`\nParcours complet validé (créateur @${handle}).`);
  if (process.env.E2E_KEEP) console.log(`handle=${handle}`);
} finally {
  expo.close();
}
