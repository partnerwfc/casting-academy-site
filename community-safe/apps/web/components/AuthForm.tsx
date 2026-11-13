'use client';

import { useState } from 'react';
import { errorMessage } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

// Connexion sans mot de passe : code à usage unique par e-mail, ou Google.
// `fixedEmail` sert à la vérification renforcée (le créateur reconfirme SON adresse).
export function AuthForm({ fixedEmail, onDone, hideOAuth }: { fixedEmail?: string; onDone?: () => void; hideOAuth?: boolean }) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState(fixedEmail ?? '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = email.trim().toLowerCase();

  const sendCode = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase().auth.signInWithOtp({
      email: address, options: { shouldCreateUser: !fixedEmail, data: { locale } },
    });
    setBusy(false);
    if (err) return setError(errorMessage(locale, err));
    setSent(true);
  };
  const verify = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase().auth.verifyOtp({ email: address, token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) return setError(errorMessage(locale, 'invalid_code'));
    onDone?.();
  };
  const google = () => supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });

  if (sent) {
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); verify(); }}>
        <p className="muted">{t('auth.codeSent', { email: address })}</p>
        <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
          aria-label={t('auth.codePlaceholder')} placeholder={t('auth.codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value)} />
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button className="btn block" disabled={busy || code.trim().length < 6}>{t('auth.verify')}</button>
        <button type="button" className="btn ghost" onClick={() => { setSent(false); setCode(''); }}>{t('common.back')}</button>
      </form>
    );
  }
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); sendCode(); }}>
      {fixedEmail || hideOAuth ? null : <button type="button" className="btn secondary block" onClick={google}>{t('auth.google')}</button>}
      {fixedEmail ? null : (
        <label className="field">{t('auth.email')}
          <input className="input" type="email" autoComplete="email" required placeholder={t('auth.emailPlaceholder')}
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      )}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="btn block" disabled={busy || !/^\S+@\S+\.\S+$/.test(address)}>
        {fixedEmail ? t('compose.stepupSend') : t('auth.sendCode')}
      </button>
      {fixedEmail ? null : <p className="small">{t('auth.legal')}</p>}
    </form>
  );
}
