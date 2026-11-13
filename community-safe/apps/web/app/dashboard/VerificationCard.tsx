'use client';

import { useState } from 'react';
import { errorMessage, type CreatorProfile, type MessageKey } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const METHODS = ['social_control', 'email_domain', 'domain', 'document'] as const;

export function VerificationCard({ creator, onChange }: { creator: CreatorProfile; onChange: () => void }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>('social_control');
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState<string | null>(null);
  const status = creator.verification_status;

  const submit = async () => {
    setError(null);
    const { error: err } = await supabase().rpc('request_verification', { p_method: method, p_evidence: { note: evidence.trim() } });
    if (err) return setError(errorMessage(locale, err));
    setOpen(false);
    onChange();
  };

  return (
    <section className="card soft">
      <p>{t(status === 'pending' ? 'verify.pending' : status === 'rejected' ? 'verify.rejected' : 'verify.needed')}</p>
      {status === 'pending' ? null : open ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label={t('verify.title')}>
            {METHODS.map((m) => <option key={m} value={m}>{t(`verify.method.${m}` as MessageKey)}</option>)}
          </select>
          {method === 'social_control' ? <p className="small">{t('verify.socialHint')}</p> : null}
          <label className="field">{t('verify.evidence')}
            <textarea className="input" rows={3} maxLength={500} required value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </label>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button className="btn">{t('verify.submit')}</button>
        </form>
      ) : <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>{t('verify.cta')}</button>}
    </section>
  );
}
