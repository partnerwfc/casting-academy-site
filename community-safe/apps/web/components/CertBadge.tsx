'use client';

import { useI18n } from '@/lib/i18n';

// Badge bleu « Créateur certifié » : n'apparaît qu'après la présence vérifiée ET l'identité reliée.
export function CertBadge({ small, label = true }: { small?: boolean; label?: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`cbadge${small ? ' sm' : ''}`} title={t('creator.verified')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#2457f5" /><path d="m7.4 12.4 3 3 6.2-6.6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {label ? t('creator.verified') : <span className="sr-only">{t('creator.verified')}</span>}
    </span>
  );
}
