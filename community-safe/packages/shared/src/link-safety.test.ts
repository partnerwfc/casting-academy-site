import { describe, expect, it } from 'vitest';
import { checkLink, checkRedirects, DEFAULT_BLOCKED_DOMAINS } from './link-safety';

describe('checkLink', () => {
  it('accepte les destinations HTTPS usuelles', () => {
    for (const url of ['https://t.me/julien', 'https://www.instagram.com/julien.new/', 'https://discord.gg/abc?x=1']) {
      expect(checkLink(url)).toBeNull();
    }
  });
  it('refuse les liens dangereux', () => {
    expect(checkLink('http://example.com')).toBe('link_not_https');
    expect(checkLink('javascript:alert(1)')).toBe('link_not_https');
    expect(checkLink('https://192.168.0.1/admin')).toBe('link_invalid_host');
    expect(checkLink('https://localhost/x')).toBe('link_invalid_host');
    expect(checkLink('https://instagram.com@evil.example/login')).toBe('link_invalid_host');
    expect(checkLink('https://example.com:8443/x')).toBe('link_invalid_host');
    expect(checkLink('https://xn--nstagram-9ib.com')).toBe('link_punycode');
    expect(checkLink('https://bit.ly/abc')).toBe('link_blocked_domain');
    expect(checkLink('https://sub.tinyurl.com/abc')).toBe('link_blocked_domain');
    expect(checkLink('https://example.com/' + 'a'.repeat(500))).toBe('link_too_long');
  });
});

describe('checkRedirects', () => {
  const fetchFrom = (map: Record<string, string | null>) => async (url: string) => {
    if (!(url in map)) throw new Error('network');
    const location = map[url];
    return { status: location ? 302 : 200, headers: { get: () => location } };
  };
  it('laisse passer une redirection propre', async () => {
    const r = await checkRedirects('https://julien.example/new', DEFAULT_BLOCKED_DOMAINS,
      fetchFrom({ 'https://julien.example/new': 'https://t.me/julien', 'https://t.me/julien': null }));
    expect(r).toMatchObject({ ok: true, finalUrl: 'https://t.me/julien' });
  });
  it('bloque une redirection vers HTTP ou un domaine interdit', async () => {
    const r = await checkRedirects('https://julien.example/new', DEFAULT_BLOCKED_DOMAINS,
      fetchFrom({ 'https://julien.example/new': 'http://evil.example/' }));
    expect(r).toMatchObject({ ok: false, reason: 'redirect_link_not_https' });
  });
  it('bloque les boucles de redirection', async () => {
    const r = await checkRedirects('https://a.example/', DEFAULT_BLOCKED_DOMAINS,
      fetchFrom({ 'https://a.example/': 'https://a.example/' }));
    expect(r).toMatchObject({ ok: false, reason: 'redirect_too_many' });
  });
  it('ne bloque pas une destination injoignable', async () => {
    expect((await checkRedirects('https://down.example/', DEFAULT_BLOCKED_DOMAINS, fetchFrom({}))).ok).toBe(true);
  });
});
