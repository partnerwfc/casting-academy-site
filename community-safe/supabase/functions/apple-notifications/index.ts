// Notifications serveur d'Apple (App Store Server Notifications V2). Aucune confiance accordée au contenu :
// il sert uniquement à savoir QUELLE transaction relire ; l'état est ensuite relu chez Apple avant d'être appliqué.
import { decodeJws, iapConfigured, logEvent, syncSubscription } from '../_shared/apple.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!iapConfigured()) return new Response('unavailable', { status: 503 });
  try {
    const { signedPayload } = await req.json();
    const note = decodeJws(String(signedPayload));
    if (note.notificationType === 'TEST') return new Response('ok');
    const signedTx = note.data?.signedTransactionInfo;
    if (!signedTx) return new Response('ignored');
    const tx = decodeJws(signedTx);
    const r = await syncSubscription(String(tx.originalTransactionId ?? tx.transactionId));
    await logEvent({ ...r, source: 'notification', notification_type: note.notificationType, subtype: note.subtype });
    console.log('apple_notification', note.notificationType, note.subtype, r.result);
    return new Response('ok');
  } catch (e) {
    console.error('apple_notification_failed', String(e)); // 500 : Apple réessaiera
    return new Response('error', { status: 500 });
  }
});
