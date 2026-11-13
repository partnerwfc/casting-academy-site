'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SOS_REASONS, checkLink, errorMessage, notificationTitle, type Alert, type CreatorProfile, type SosReason,
} from '@community-safe/shared';
import { AuthForm } from '@/components/AuthForm';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export function Composer({ kind, creator, email, onClose, onSent }: {
  kind: 'sos' | 'announcement'; creator: CreatorProfile; email: string; onClose: () => void; onSent: (alertId: string) => void;
}) {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState<SosReason | null>(null);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [maxLength, setMaxLength] = useState(280);
  const [checkedMessage, setCheckedMessage] = useState(false);
  const [checkedLink, setCheckedLink] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Une seule clé par rédaction : un double clic n'envoie jamais deux alertes.
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    supabase().from('app_settings').select('value').eq('key', 'alert_message_max_length').maybeSingle()
      .then(({ data }) => { if (typeof data?.value === 'number') setMaxLength(data.value); });
    supabase().rpc('has_recent_auth').then(({ data }) => setFresh(data === true));
  }, []);

  const trimmedLink = link.trim();
  const linkError = trimmedLink ? checkLink(trimmedLink) : null;
  const ready = (kind !== 'sos' || reason) && message.trim() && !linkError && checkedMessage && (!trimmedLink || checkedLink) && fresh;

  const send = async () => {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase().rpc('create_alert', {
      p_kind: kind, p_message: message.trim(), p_idempotency_key: idempotencyKey.current,
      p_reason: kind === 'sos' ? reason : null, p_link_url: trimmedLink || null,
    });
    if (err) {
      setBusy(false);
      if (err.message === 'stepup_required') setFresh(false);
      return setError(errorMessage(locale, err));
    }
    // Réveille le worker ; en cas d'échec, la planification serveur prend le relais.
    supabase().functions.invoke('dispatch-alerts', { body: {} }).catch(() => {});
    onSent((data as Alert).id);
  };

  return (
    <section className={`card ${kind === 'sos' ? 'sos' : 'soft'}`} aria-label={t(kind === 'sos' ? 'compose.sosTitle' : 'compose.announceTitle')}>
      <div className="row between">
        <h2>{t(kind === 'sos' ? 'compose.sosTitle' : 'compose.announceTitle')}</h2>
        <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
      </div>

      {kind === 'sos' ? (
        <div className="stack">
          <strong>1 · {t('compose.reason')}</strong>
          <div className="row">
            {SOS_REASONS.map((r) => <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{t(`reason.${r}`)}</button>)}
          </div>
        </div>
      ) : null}

      <label className="field">{t('compose.message')}
        <textarea className="input" rows={4} maxLength={maxLength} placeholder={t('compose.messagePlaceholder')} value={message} onChange={(e) => setMessage(e.target.value)} />
        <span className="small" style={{ textAlign: 'right' }}>{message.length} / {maxLength}</span>
      </label>
      <label className="field">{t('compose.link')}
        <input className="input" type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => { setLink(e.target.value); setCheckedLink(false); }} />
        {linkError ? <span className="error">{t(`errors.${linkError}`)}</span> : null}
      </label>

      <div className="stack">
        <strong>{t('compose.preview')}</strong>
        <div className="preview">
          <span className="logo">CS</span>
          <div>
            <div className="small" style={{ letterSpacing: '0.06em' }}>COMMUNITY SAFE</div>
            <strong>{notificationTitle(kind, creator.display_name, locale)}</strong>
            <div>{message.trim() || '…'}</div>
          </div>
        </div>
        <span className="small">{t('compose.previewHint')}</span>
      </div>

      <div className="stack">
        <strong>{t('compose.confirmTitle')}</strong>
        <label className="row"><input type="checkbox" checked={checkedMessage} onChange={(e) => setCheckedMessage(e.target.checked)} /> {t('compose.confirmMessage')}</label>
        {trimmedLink ? <label className="row"><input type="checkbox" checked={checkedLink} onChange={(e) => setCheckedLink(e.target.checked)} /> {t('compose.confirmLink')} — {trimmedLink}</label> : null}
        {fresh ? null : (
          <div className="card">
            <p className="muted">{t('compose.stepup')}</p>
            <AuthForm fixedEmail={email} onDone={() => setFresh(true)} />
          </div>
        )}
      </div>

      <p className="small">{t('compose.recipients')} {t('compose.noGuarantee')}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className={`btn ${kind === 'sos' ? 'sos' : ''}`} disabled={!ready || busy} onClick={send}>{t('compose.send')}</button>
    </section>
  );
}
