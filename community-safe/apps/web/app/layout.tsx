import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { translate } from '@community-safe/shared';
import { LocaleProvider } from '@/lib/i18n';
import { getLocale } from '@/lib/locale';
import { SITE_URL } from '@/lib/supabase';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: 'Community Safe — Never lose your community', template: '%s · Community Safe' },
    description: translate(locale, 'welcome.subtitle'),
    openGraph: { siteName: 'Community Safe', type: 'website' },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
