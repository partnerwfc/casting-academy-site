// Contrôle des liens d'alerte. Fichier autonome (aucun import) : il est copié tel quel
// dans supabase/functions/_shared par `pnpm sync:functions`.
// Le même contrôle existe en SQL (check_alert_link) : le serveur reste la référence.

export type LinkError =
  | 'link_too_long'
  | 'link_not_https'
  | 'link_invalid_host'
  | 'link_punycode'
  | 'link_blocked_domain';

export const DEFAULT_BLOCKED_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at',
];

export function linkHost(url: string): string | null {
  const m = /^https:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : null;
}

export function checkLink(url: string, blockedDomains: readonly string[] = DEFAULT_BLOCKED_DOMAINS): LinkError | null {
  const value = url.trim();
  if (value.length > 500) return 'link_too_long';
  if (!/^https:\/\//i.test(value)) return 'link_not_https';
  const host = linkHost(value);
  // Refuse userinfo (https://instagram.com@evil.tld), ports, IP et hôtes locaux.
  if (!host || /[@:\s]/.test(host)) return 'link_invalid_host';
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return 'link_invalid_host';
  if (/(^|\.)xn--/.test(host)) return 'link_punycode';
  if (blockedDomains.some((d) => host === d.toLowerCase() || host.endsWith('.' + d.toLowerCase()))) {
    return 'link_blocked_domain';
  }
  return null;
}

export interface RedirectCheck {
  ok: boolean;
  reason?: string;
  finalUrl?: string;
}

// Suit les redirections une à une : chaque saut doit rester un lien HTTPS autorisé.
// Une destination momentanément injoignable ne bloque pas l'alerte (elle peut être en panne).
export async function checkRedirects(
  url: string,
  blockedDomains: readonly string[],
  fetchImpl: (input: string, init: { method: string; redirect: 'manual'; signal?: AbortSignal }) => Promise<{
    status: number;
    headers: { get(name: string): string | null };
  }>,
  maxHops = 5,
  timeoutMs = 4000,
): Promise<RedirectCheck> {
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    const error = checkLink(current, blockedDomains);
    if (error) return { ok: false, reason: hop === 0 ? error : `redirect_${error}`, finalUrl: current };
    let res;
    try {
      res = await fetchImpl(current, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      return { ok: true, finalUrl: current };
    }
    if (res.status < 300 || res.status >= 400) return { ok: true, finalUrl: current };
    const location = res.headers.get('location');
    if (!location) return { ok: true, finalUrl: current };
    try {
      current = new URL(location, current).toString();
    } catch {
      return { ok: false, reason: 'redirect_invalid', finalUrl: current };
    }
  }
  return { ok: false, reason: 'redirect_too_many', finalUrl: current };
}
