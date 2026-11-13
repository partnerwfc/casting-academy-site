'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { Footer, Header } from '@/components/Chrome';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/useSession';

export default function Login() {
  const { t } = useI18n();
  const session = useSession();
  const router = useRouter();
  useEffect(() => { if (session) router.replace('/dashboard'); }, [session, router]);
  return (
    <>
      <Header />
      <main className="narrow stack" style={{ paddingTop: 32 }}>
        <h2>{t('auth.title')}</h2>
        <p className="muted">{t('auth.subtitle')}</p>
        <div className="card"><AuthForm /></div>
      </main>
      <Footer />
    </>
  );
}
