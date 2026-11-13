// ⚠️ Fichier généré depuis packages/shared/src — ne pas modifier (pnpm sync:functions).
// Contrôles de certification « Créateur certifié », sans dépendance : copié tel quel dans
// supabase/functions/_shared par `pnpm sync:functions`.

export const CODE_PATTERN = /^CS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

// Normalisation tolérante : une bio peut mettre le code en gras, le couper ou changer ses tirets,
// mais pas en modifier les 8 caractères (alphabet aléatoire : aucun risque de faux positif).
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // ni espaces, ni tirets de toute sorte, ni caractères invisibles
}

export function containsCode(text: string | null | undefined, code: string): boolean {
  if (!text || !CODE_PATTERN.test(code)) return false;
  return normalizeForMatch(text).includes(normalizeForMatch(code));
}

export const dnsTxtName = (domain: string) => `_communitysafe.${domain}`;
export const wellKnownUrl = (domain: string) => `https://${domain}/.well-known/community-safe.txt`;

// Réponse DNS-over-HTTPS (format JSON) → valeurs TXT, sans les guillemets.
export function parseDohTxt(json: unknown): string[] {
  const answers = (json as { Answer?: { type?: number; data?: string }[] } | null)?.Answer ?? [];
  return answers.filter((a) => a.type === 16 && typeof a.data === 'string').map((a) => a.data!.replace(/^"|"$/g, '').replace(/"\s*"/g, ''));
}

// Adresses non publiques : un domaine ne doit jamais nous faire appeler le réseau interne (SSRF).
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('::ffff:');
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export const youtubeChannelUrl = (handle: string, apiKey: string) =>
  `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent('@' + handle)}&key=${encodeURIComponent(apiKey)}`;
export const twitchUserUrl = (login: string) => `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`;

// Textes où la preuve peut figurer, selon la réponse de chaque API officielle.
export const youtubeDescription = (json: unknown): string | null =>
  (json as { items?: { snippet?: { description?: string } }[] } | null)?.items?.[0]?.snippet?.description ?? null;
export const twitchDescription = (json: unknown): string | null =>
  (json as { data?: { description?: string }[] } | null)?.data?.[0]?.description ?? null;
