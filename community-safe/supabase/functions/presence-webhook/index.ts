// Résultat du contrôle vidéo de présence (détection du vivant), envoyé par le prestataire de vérification.
// Contrat volontairement indépendant du prestataire : un petit adaptateur (chez nous ou chez lui) traduit
// son format vers celui-ci. Authentifié par signature HMAC (même schéma que le webhook de paiement).
//   POST  corps : { "verification_id": "<uuid>", "status": "passed" | "failed", "provider": "nom", "session_ref": "id" }
//         en-tête : x-presence-signature: t=<timestamp>,v1=<hmac_sha256(secret, "<timestamp>.<corps>")>
// Aucune vidéo, aucun gabarit biométrique ne transite ici : seulement le résultat et une référence.
import { verifyStripeSignature as verifySignature } from '../_shared/billing.ts';
import { rpc } from '../_shared/db.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = Deno.env.get('PRESENCE_WEBHOOK_SECRET');
  const payload = await req.text();
  if (!secret || !(await verifySignature(payload, req.headers.get('x-presence-signature'), secret))) {
    return new Response('invalid signature', { status: 400 });
  }
  try {
    const body = JSON.parse(payload);
    const id = String(body.verification_id ?? '');
    if (!/^[0-9a-f-]{36}$/.test(id) || !['passed', 'failed'].includes(body.status)) return new Response('invalid body', { status: 400 });
    const result = await rpc<string>('record_presence_result', {
      p_verification_id: id, p_passed: body.status === 'passed',
      p_provider: String(body.provider ?? 'unknown'), p_ref: String(body.session_ref ?? ''),
    });
    console.log('presence_result', result);
    return new Response('ok');
  } catch (e) {
    console.error('presence_webhook_failed', String(e)); // 500 : le prestataire réessaiera
    return new Response('error', { status: 500 });
  }
});
