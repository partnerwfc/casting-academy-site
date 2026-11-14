import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { translate } from '@community-safe/shared';
import { LocaleProvider } from '@/lib/i18n';
import { getLocale } from '@/lib/locale';
import { SITE_URL } from '@/lib/supabase';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400', '500', '600', '700', '800'], display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: 'SaveMyCommunity — Never lose your community', template: '%s · SaveMyCommunity' },
    description: translate(locale, 'welcome.subtitle'),
    openGraph: { siteName: 'SaveMyCommunity', type: 'website' },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
