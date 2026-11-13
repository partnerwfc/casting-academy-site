'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LOCALES, type AppLocale } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/useSession';

export function Header({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const session = useSession();
  return (
    <header className="header container">
      <Link href="/" className="brand"><span className="logo">CS</span>Community Safe</Link>
      <nav className="row">
        {children}
        {session ? <Link className="btn sm secondary" href="/dashboard">{t('profile.creatorSpace')}</Link>
          : session === null ? <Link className="btn sm secondary" href="/login">{t('auth.title')}</Link> : null}
      </nav>
    </header>
  );
}

export function Footer() {
  const { t, locale, setLocale } = useI18n();
  return (
    <footer className="site">
      <div className="container row between">
        <span className="small">© Community Safe — {t('app.tagline')}</span>
        <div className="row">
          <Link className="small" href="/privacy">{t('auth.privacy')}</Link>
          <Link className="small" href="/terms">{t('auth.terms')}</Link>
          <select className="input" style={{ width: 'auto', padding: '6px 10px' }} aria-label={t('profile.language')}
            value={locale} onChange={(e) => { setLocale(e.target.value as AppLocale); location.reload(); }}>
            {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </div>
      </div>
    </footer>
  );
}

export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="avatar" src={url} alt="" style={style} /> : <span className="avatar" style={style}>{name.trim().charAt(0).toUpperCase()}</span>;
}
