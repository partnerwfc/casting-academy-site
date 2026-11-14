'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

// Vérification renforcée sans e-mail : application d'authentification (TOTP).
// Première utilisation : on l'active en scannant un QR code, puis on saisit le code.
export function TotpStepUp({ onDone }: { onDone: () => void }) {
  const { t, locale } = useI18n();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === 'verified');
      if (verified) return setFactorId(verified.id);
      for (const f of data?.all.filter((x) => x.status === 'unverified') ?? []) await supabase().auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: err } = await supabase().auth.mfa.enroll({ factorType: 'totp' });
      if (err || !enrolled) return setError(errorMessage(locale, err));
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
    })();
  }, [locale]);

  const verify = async () => {
    if (!factorId) return;
    const { error: err } = await supabase().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (err) return setError(errorMessage(locale, 'invalid_code'));
    onDone();
  };

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); verify(); }}>
      <p className="muted">{qr ? t('compose.totpSetup') : t('compose.stepupTotp')}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <img src={qr} alt="QR" width={180} height={180} style={{ background: '#fff', borderRadius: 12 }} /> : null}
      <input className="input" inputMode="numeric" maxLength={6} autoComplete="one-time-code" aria-label={t('auth.codePlaceholder')}
        placeholder={t('auth.codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value)} />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="btn" disabled={code.trim().length < 6}>{t('auth.verify')}</button>
    </form>
  );
}
