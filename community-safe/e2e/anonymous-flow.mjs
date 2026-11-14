// Abonné sans compte : aucun e-mail, aucune saisie. Il peut suivre et recevoir, pas devenir créateur.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const client = () => createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(API, SERVICE, { auth: { persistSession: false } });

// Un créateur existant (via le compte de service, sans e-mail à lire).
const { data: owner } = await service.auth.admin.createUser({ email: `anon.owner.${randomUUID().slice(0, 6)}@example.com`, email_confirm: true });
const handle = `anon_${randomUUID().slice(0, 6)}`;
const { data: creator } = await service.from('creator_profiles').insert({ owner_user_id: owner.user.id, handle, display_name: 'Créatrice' }).select().single();

const fan = client();
const { data: session, error } = await fan.auth.signInAnonymously();
assert.ifError(error);
assert.equal(session.user.is_anonymous, true);
assert.ok(!session.user.email);
console.log('✔ connexion anonyme : aucun e-mail, aucune saisie');

assert.ifError((await fan.rpc('follow_creator', { p_handle: handle, p_source: 'qr' })).error);
assert.ifError((await fan.rpc('register_device', { p_installation_id: `install-anon-${randomUUID().slice(0, 6)}`, p_platform: 'ios', p_permission: 'granted', p_token: `ExponentPushToken[anon${randomUUID().slice(0, 8)}]` })).error);
const { data: mine } = await fan.from('community_memberships').select('creator_id');
assert.equal(mine.length, 1);
const { data: count } = await service.from('creator_profiles').select('member_count').eq('id', creator.id).single();
assert.equal(count.member_count, 1);
console.log('✔ suivi et appareil enregistrés, compteur du créateur mis à jour');

assert.equal((await fan.rpc('create_creator_profile', { p_handle: `x_${randomUUID().slice(0, 5)}`, p_display_name: 'X' })).error?.message, 'account_required');
console.log('✔ un compte anonyme ne peut pas devenir créateur');

assert.ifError((await service.auth.admin.deleteUser(session.user.id)).error);
await service.auth.admin.deleteUser(owner.user.id);
console.log('\nParcours abonné sans compte validé.');
