// Contrôle automatique de la preuve de certification, UNIQUEMENT par des moyens autorisés :
//   · site web : enregistrement DNS TXT ou fichier /.well-known (le créateur contrôle son domaine) ;
//   · YouTube : API officielle Data v3 (description publique de la chaîne) ;
//   · Twitch : API officielle Helix (description publique du profil).
// Instagram, TikTok, X, Snapchat et Facebook n'offrent pas de lecture publique autorisée du profil :
// ces demandes passent par l'examen humain (le code est vérifié à la main sur le profil public).
// Aucun scraping. Aucune capture d'écran. Le résultat est enregistré par `record_auto_check`.
import {
  containsCode, dnsTxtName, isPrivateIp, parseDohTxt, twitchDescription, twitchUserUrl, wellKnownUrl,
  youtubeChannelUrl, youtubeDescription,
} from '../_shared/certification.ts';
import { authUser, cors, json, rpc } from '../_shared/db.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const DOH = Deno.env.get('DOH_URL') ?? 'https://cloudflare-dns.com/dns-query'; // surchargé par les tests
const TIMEOUT = 4000;

interface Request {
  id: string; status: string; method: string; code: string | null; code_expires_at: string; attempts: number; max_attempts: number;
  last_checked_at: string | null; social_account: { platform: string; handle: string } | null;
}

async function doh(name: string, type: 'TXT' | 'A' | 'AAAA'): Promise<unknown> {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(TIMEOUT),
  });
  return res.ok ? await res.json() : null;
}

async function checkDomain(domain: string, code: string): Promise<boolean> {
  // 1. TXT sur _savemycommunity.<domaine> : la méthode de référence, sans aucune requête vers le site.
  const txt = parseDohTxt(await doh(dnsTxtName(domain), 'TXT').catch(() => null));
  if (txt.some((value) => containsCode(value, code))) return true;
  // 2. Fichier /.well-known : seulement si le domaine résout vers des adresses publiques (anti-SSRF), sans redirection.
  const records = [...((await doh(domain, 'A').catch(() => null) as { Answer?: { type: number; data: string }[] } | null)?.Answer ?? [])]
    .filter((a) => a.type === 1).map((a) => a.data);
  if (!records.length || records.some(isPrivateIp)) return false;
  const res = await fetch(wellKnownUrl(domain), { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null);
  if (!res || res.status !== 200) return false;
  return containsCode((await res.text()).slice(0, 2048), code);
}

async function checkYoutube(handle: string, code: string): Promise<boolean | null> {
  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return null;
  const res = await fetch(youtubeChannelUrl(handle, key), { signal: AbortSignal.timeout(TIMEOUT) });
  return res.ok ? containsCode(youtubeDescription(await res.json()), code) : false;
}

async function checkTwitch(login: string, code: string): Promise<boolean | null> {
  const id = Deno.env.get('TWITCH_CLIENT_ID'), secret = Deno.env.get('TWITCH_CLIENT_SECRET');
  if (!id || !secret) return null;
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!tokenRes.ok) return false;
  const { access_token } = await tokenRes.json();
  const res = await fetch(twitchUserUrl(login), { headers: { 'client-id': id, authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(TIMEOUT) });
  return res.ok ? containsCode(twitchDescription(await res.json()), code) : false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const user = await authUser(req);
  if (!user) return json({ error: 'not_authenticated' }, 401);
  try {
    const { verification_id } = await req.json().catch(() => ({}));
    if (typeof verification_id !== 'string' || !/^[0-9a-f-]{36}$/.test(verification_id)) return json({ error: 'invalid_request' }, 400);

    // Lecture avec le jeton de l'utilisateur : la politique RLS garantit qu'il ne lit que sa propre demande.
    const res = await fetch(`${URL_}/rest/v1/creator_verifications?id=eq.${verification_id}&select=id,status,method,code,code_expires_at,attempts,max_attempts,last_checked_at,social_account:social_accounts(platform,handle)`, {
      headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, authorization: `Bearer ${user.token}` },
    });
    const [row] = (await res.json()) as Request[];
    if (!row) return json({ error: 'verification_not_found' }, 404);
    if (row.status !== 'awaiting_proof') return json({ status: row.status });
    if (!row.method.startsWith('auto_') || !row.code || !row.social_account) return json({ error: 'use_review' }, 400);
    if (row.last_checked_at && Date.now() - Date.parse(row.last_checked_at) < 15_000) return json({ error: 'too_fast' }, 429);

    const { platform, handle } = row.social_account;
    const found = platform === 'website' ? await checkDomain(handle, row.code)
      : platform === 'youtube' ? await checkYoutube(handle, row.code)
      : platform === 'twitch' ? await checkTwitch(handle, row.code) : false;
    if (found === null) return json({ error: 'auto_unavailable' }, 503); // clé API non configurée : l'administration doit la renseigner

    const status = await rpc<string>('record_auto_check', { p_verification_id: row.id, p_found: found, p_source: row.method });
    return json({ status, attempts_left: Math.max(0, row.max_attempts - row.attempts - 1) });
  } catch (e) {
    console.error('certify_failed', String(e));
    return json({ error: 'certify_failed' }, 500);
  }
});
