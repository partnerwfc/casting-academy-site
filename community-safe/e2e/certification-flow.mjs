// Certification « Créateur certifié » sur Supabase local : preuve par DNS (fonction `certify`, DNS simulé),
// signaux d'usurpation, examen humain, révocation et blocage du SOS.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const run = randomUUID().slice(0, 6);
const step = (l) => console.log(`✔ ${l}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const service = createClient(API, SERVICE, { auth: { persistSession: false } });

// Faux DNS-over-HTTPS : renvoie ce que le test place dans `txt`.
const txt = new Map();
const doh = createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); const name = url.searchParams.get('name'); const type = url.searchParams.get('type');
  res.setHeader('content-type', 'application/dns-json');
  const answers = type === 'TXT' ? (txt.get(name) ?? []).map((d) => ({ type: 16, data: `"${d}"` })) : [{ type: 1, data: '93.184.216.34' }];
  res.end(JSON.stringify({ Answer: answers }));
});
await new Promise((r) => doh.listen(8788, '0.0.0.0', r));

async function otpFor(email) {
  for (let i = 0; i < 40; i++) {
    const l = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (l.messages?.length) { const m = await (await fetch(`${MAILPIT}/api/v1/message/${l.messages[0].ID}`)).json();
      await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: [l.messages[0].ID] }) });
      return /\b(\d{6})\b/.exec(m.Text)[1]; }
    await sleep(250);
  }
  throw new Error('aucun code');
}
async function signIn(name) {
  const email = `${name}.${run}@example.com`; const db = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.ifError((await db.auth.signInWithOtp({ email })).error);
  const { data, error } = await db.auth.verifyOtp({ email, token: await otpFor(email), type: 'email' }); assert.ifError(error);
  return { db, user: data.user, token: data.session.access_token };
}
const certify = (who, id) => fetch(`${API}/functions/v1/certify`, { method: 'POST', headers: { authorization: `Bearer ${who.token}` }, body: JSON.stringify({ verification_id: id }) });
const expectError = async (p, m) => assert.equal((await p).error?.message, m);

try {
  const admin = await signIn('certadmin');
  await service.from('admin_roles').insert({ user_id: admin.user.id, role: 'admin' });
  const { data: factor } = await admin.db.auth.mfa.enroll({ factorType: 'totp' });
  const { createHmac } = await import('node:crypto');
  const totp = (secret) => { const al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; const bits = [...secret].map((c) => al.indexOf(c).toString(2).padStart(5, '0')).join('');
    const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))); const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const h = createHmac('sha1', key).update(ctr).digest(); const o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0'); };
  assert.ifError((await admin.db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) })).error);
  await service.from('app_settings').update({ value: ['website'] }).eq('key', 'certification_auto_platforms');

  // 1. Créatrice : URL invalide refusée, domaine ajouté, code généré.
  const julie = await signIn('certjulie'); const handle = `cj_${run}`; const domain = `julie-${run}.com`;
  const { data: profile } = await julie.db.rpc('create_creator_profile', { p_handle: handle, p_display_name: `Studio ${run}` });
  await expectError(julie.db.rpc('add_social_account', { p_platform: 'instagram', p_url: 'https://evil.example/instagram.com/julie' }), 'invalid_social_url');
  const { data: account } = await julie.db.rpc('add_social_account', { p_platform: 'website', p_url: `https://www.${domain}/` });
  assert.equal(account.handle, domain);
  const { data: req1 } = await julie.db.rpc('start_certification', { p_social_account_id: account.id });
  assert.equal(req1.method, 'auto_domain'); assert.equal(req1.status, 'awaiting_proof');
  step(`code unique généré : ${req1.code} (expire dans 7 jours)`);

  // 2. Sans preuve publiée : refus ; avec le mauvais code : refus ; un client ne peut pas tricher.
  await expectError(julie.db.rpc('request_certification_review', { p_verification_id: req1.id }), 'use_automatic_check');
  const r0 = await (await certify(julie, req1.id)).json(); assert.equal(r0.status, 'awaiting_proof');
  txt.set(`_communitysafe.${domain}`, ['CS-AAAA-BBBB']);
  await sleep(16000);
  const r1 = await (await certify(julie, req1.id)).json(); assert.equal(r1.status, 'awaiting_proof');
  assert.equal((await certify(julie, req1.id)).status, 429);
  const { data: status0 } = await julie.db.from('creator_profiles').select('verification_status').eq('id', profile.id).single();
  assert.equal(status0.verification_status, 'pending');
  assert.ok((await julie.db.from('creator_profiles').update({ verification_status: 'verified' }).eq('id', profile.id)).error);
  await expectError(julie.db.rpc('create_alert', { p_kind: 'sos', p_message: 'x', p_idempotency_key: randomUUID(), p_reason: 'hacked' }), 'creator_not_verified');
  step('refus : aucune preuve, mauvais code, cadence limitée, badge impossible à s\'attribuer, SOS bloqué');

  // 3. Le code est publié dans le DNS : validation automatique, code effacé, badge, journal.
  txt.set(`_communitysafe.${domain}`, [req1.code]);
  await sleep(16000);
  const r2 = await (await certify(julie, req1.id)).json(); assert.equal(r2.status, 'approved');
  const { data: done } = await julie.db.from('creator_verifications').select('status, code').eq('id', req1.id).single();
  assert.equal(done.status, 'approved'); assert.equal(done.code, null);
  const { data: certified } = await julie.db.from('creator_profiles').select('verification_status').eq('id', profile.id).single();
  assert.equal(certified.verification_status, 'verified');
  const { data: events } = await julie.db.from('certification_events').select('action').eq('creator_id', profile.id).order('id');
  assert.deepEqual(events.map((e) => e.action), ['code_issued', 'auto_check_failed', 'auto_check_failed', 'auto_check_passed', 'approved']);
  step('preuve DNS valide : « Créateur certifié » accordé, code effacé, 5 événements journalisés');

  // 4. Usurpation : même nom, même preuve technique → jamais automatique, examen humain obligatoire.
  const fake = await signIn('certfake'); const fakeHandle = `cf_${run}`; const fakeDomain = `julie-fan-${run}.com`;
  const { data: fp } = await fake.db.rpc('create_creator_profile', { p_handle: fakeHandle, p_display_name: `Studio ${run}` });
  const { data: fa } = await fake.db.rpc('add_social_account', { p_platform: 'website', p_url: `https://${fakeDomain}` });
  const { data: freq } = await fake.db.rpc('start_certification', { p_social_account_id: fa.id });
  txt.set(`_communitysafe.${fakeDomain}`, [freq.code]);
  const rf = await (await certify(fake, freq.id)).json(); assert.equal(rf.status, 'in_review');
  const { data: flagged } = await service.from('creator_verifications').select('risk_flags').eq('id', freq.id).single();
  assert.deepEqual(flagged.risk_flags, ['similar_name']);
  await expectError(admin.db.rpc('admin_review_certification', { p_verification_id: freq.id, p_approve: true }), 'reason_required');
  assert.ifError((await admin.db.rpc('admin_review_certification', { p_verification_id: freq.id, p_approve: false, p_reason: 'usurpation probable de Julie' })).error);
  const { data: fs } = await fake.db.from('creator_profiles').select('verification_status').eq('id', fp.id).single();
  assert.equal(fs.verification_status, 'rejected');
  step('usurpation : preuve technique valide mais nom proche → examen humain → refusé avec motif');

  // 5. Changement sensible : renommer un profil certifié retire le badge.
  assert.ifError((await julie.db.from('creator_profiles').update({ bio: 'nouvelle bio' }).eq('id', profile.id)).error);
  let { data: still } = await julie.db.from('creator_profiles').select('verification_status').eq('id', profile.id).single(); assert.equal(still.verification_status, 'verified');
  await julie.db.from('creator_profiles').update({ display_name: 'Autre Nom' }).eq('id', profile.id);
  ({ data: still } = await julie.db.from('creator_profiles').select('verification_status').eq('id', profile.id).single()); assert.equal(still.verification_status, 'unverified');
  step('re-certification : la bio ne change rien, le nom public retire le badge');

  // 6. Suspension / révocation par l'administration (MFA obligatoire).
  await sleep(1000);
  await julie.db.from('creator_profiles').update({ display_name: `Studio ${run}` }).eq('id', profile.id);
  const { data: again } = await julie.db.rpc('start_certification', { p_social_account_id: account.id });
  await sleep(16000);
  assert.equal((await (await certify(julie, again.id)).json()).status, 'approved');
  await expectError(julie.db.rpc('admin_revoke_certification', { p_creator_id: profile.id, p_reason: 'x' }), 'forbidden');
  assert.ifError((await admin.db.rpc('admin_suspend_certification', { p_creator_id: profile.id, p_reason: 'signalement en cours' })).error);
  assert.ifError((await admin.db.rpc('admin_reinstate_certification', { p_creator_id: profile.id })).error);
  assert.ifError((await admin.db.rpc('admin_revoke_certification', { p_creator_id: profile.id, p_reason: 'usurpation avérée' })).error);
  const { data: revoked } = await julie.db.from('creator_profiles').select('verification_status').eq('id', profile.id).single();
  assert.equal(revoked.verification_status, 'revoked');
  await expectError(julie.db.rpc('create_alert', { p_kind: 'sos', p_message: 'x', p_idempotency_key: randomUUID(), p_reason: 'hacked' }), 'creator_not_verified');
  step('administration : suspension, réhabilitation, révocation ; le SOS est bloqué après révocation');
  console.log('\nParcours certification validé.');
} finally { doh.close(); }
