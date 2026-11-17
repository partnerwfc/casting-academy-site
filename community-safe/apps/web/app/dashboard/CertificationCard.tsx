'use client';

import { useCallback, useEffect, useState } from 'react';
import { SOCIAL_PLATFORMS_CERT, errorMessage, formatDate, type Certification, type CreatorProfile } from '@community-safe/shared';
import { CertBadge } from '@/components/CertBadge';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', twitch: 'Twitch', snapchat: 'Snapchat', facebook: 'Facebook', website: 'Site web / Website' };
const PLACEHOLDER: Record<string, string> = {
  instagram: 'https://instagram.com/…', tiktok: 'https://tiktok.com/@…', youtube: 'https://youtube.com/@…', x: 'https://x.com/…',
  twitch: 'https://twitch.tv/…', snapchat: 'https://snapchat.com/add/…', facebook: 'https://facebook.com/…', website: 'https://…',
};

// Certification en deux validations : 1) présence (contrôle vidéo en direct), 2) identité (code publié sur le compte officiel).
export function CertificationCard({ creator, onChange }: { creator: CreatorProfile; onChange: () => void }) {
  const { t, locale } = useI18n();
  const [cert, setCert] = useState<Certification | null | undefined>(undefined);
  const [presenceMode, setPresenceMode] = useState('manual');
  const [platform, setPlatform] = useState<string>('instagram');
  const [url, setUrl] = useState('');
  const [callLink, setCallLink] = useState('');
  const [availability, setAvailability] = useState('');
  const [altOpen, setAltOpen] = useState(false);
  const [altNote, setAltNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = supabase();
    const { data } = await db.from('creator_verifications').select('*').eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setCert((data as Certification | null) ?? null);
    const { data: mode } = await db.from('app_settings').select('value').eq('key', 'certification_presence_mode').maybeSingle();
    if (typeof mode?.value === 'string') setPresenceMode(mode.value);
  }, [creator.id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<{ message?: string } | void>) => {
    setBusy(true); setError(null); setMessage(null);
    try { const r = await fn(); if (r?.message) setMessage(r.message); await load(); onChange(); }
    catch (e) { setError(errorMessage(locale, e)); }
    setBusy(false);
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error: err } = await supabase().rpc(name, args);
    if (err) throw err;
    return data;
  };

  const start = () => run(async () => {
    const account = await rpc('add_social_account', { p_platform: platform, p_url: url.trim() });
    await rpc('start_certification', { p_social_account_id: (account as { id: string }).id });
    setUrl('');
  });
  const requestCall = (id: string) => run(async () => {
    await rpc('request_presence_call', { p_verification_id: id, p_link: callLink.trim(), p_availability: availability.trim() || null });
    return { message: t('cert.callRequested') };
  });
  const check = (id: string) => run(async () => {
    const { data, error: err } = await supabase().functions.invoke('certify', { body: { verification_id: id } });
    const detail = err ? await (err as { context?: Response }).context?.json?.().catch(() => null) : null;
    const code = detail?.error ?? (data as { error?: string } | null)?.error;
    if (code) throw code;
    const result = data as { status: string; attempts_left?: number };
    if (result.status === 'awaiting_proof') return { message: t('cert.notFound', { left: result.attempts_left ?? 0 }) };
  });

  if (cert === undefined) return null;
  const status = creator.verification_status;

  if (status === 'verified') {
    return (
      <section className="card soft">
        <div className="row"><CertBadge /></div>
        <p className="muted">{t('cert.approvedBody')}</p>
      </section>
    );
  }

  const presenceOk = presenceMode === 'off' || cert?.presence_status === 'passed';
  const open = cert && ['awaiting_proof', 'in_review'].includes(cert.status);

  return (
    <section className="card soft" aria-label={t('cert.title')}>
      <h3>{t('cert.title')}</h3>
      {status === 'suspended' ? <p className="error">{t('cert.suspended')}</p> : null}
      {status === 'revoked' ? <p className="error">{t('cert.revoked')}</p> : null}
      {!open && cert?.status === 'rejected' ? <p className="error">{t('cert.rejected')}{cert.decision_reason ? ` · ${cert.decision_reason}` : ''}</p> : null}
      {!open && cert?.status === 'expired' ? <p className="error">{t('cert.expired')}</p> : null}
      {!open && cert?.status === 'failed' ? <p className="error">{t('cert.failed')}</p> : null}
      {status === 'suspended' ? null : (
        <>
          <p className="muted">{t('cert.intro')}</p>
          <div>
            <div className={`lvl ${presenceOk ? 'ok' : open ? 'cur' : ''}`}><span className="ic">{presenceOk ? '✓' : '1'}</span><div><strong>{presenceOk ? t('cert.presenceOk') : t('cert.step1')}</strong><div className="small">{t('cert.step1Body')}</div></div></div>
            <div className={`lvl ${open && presenceOk ? 'cur' : ''}`}><span className="ic">2</span><div><strong>{t('cert.step2')}</strong><div className="small">{t('cert.step2Body')}</div></div></div>
          </div>
        </>
      )}

      {status !== 'suspended' && !open ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); start(); }}>
          <label className="field">{t('cert.platform')}
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {SOCIAL_PLATFORMS_CERT.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="field">{t('cert.url')}
            <input className="input" type="url" required placeholder={PLACEHOLDER[platform]} value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button className="btn" disabled={busy || !url.trim()}>{cert ? t('cert.restart') : t('cert.start')} →</button>
        </form>
      ) : null}

      {open && cert.status === 'in_review' ? (
        <div className="stack"><strong>{t('cert.inReview')}</strong><p className="muted">{t('cert.inReviewBody')}</p></div>
      ) : null}

      {open && cert.status === 'awaiting_proof' && !presenceOk ? (
        cert.evidence?.call_link ? (
          <div className="stack"><p className="okc" style={{ color: 'var(--success)' }}>{t('cert.callRequested')}</p><p className="small">{cert.evidence.call_link}{cert.evidence.availability ? ` · ${cert.evidence.availability}` : ''}</p></div>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); requestCall(cert.id); }}>
            <label className="field">{t('cert.callLink')}<input className="input" type="url" required placeholder="https://meet.google.com/…" value={callLink} onChange={(e) => setCallLink(e.target.value)} /></label>
            <label className="field">{t('cert.availability')}<input className="input" maxLength={200} value={availability} onChange={(e) => setAvailability(e.target.value)} /></label>
            <button className="btn" disabled={busy || !callLink.trim()}>{t('cert.requestCall')} →</button>
          </form>
        )
      ) : null}

      {open && cert.status === 'awaiting_proof' && presenceOk ? (
        <div className="stack">
          <strong>{t('cert.codeTitle')}</strong>
          <p className="muted">{t('cert.codeBody')}</p>
          <div className="codebox" aria-label="code">{cert.code}</div>
          <p className="small center">{cert.code_expires_at ? t('cert.codeExpires', { date: formatDate(locale, cert.code_expires_at).split(',')[0] }) : ''}</p>
          <div className="row">
            <button type="button" className="btn secondary sm" onClick={() => navigator.clipboard.writeText(cert.code ?? '').then(() => setMessage(t('common.copied')))}>{t('common.copy')}</button>
            {cert.method.startsWith('auto_')
              ? <button type="button" className="btn" disabled={busy} onClick={() => check(cert.id)}>{t('cert.checkNow')} →</button>
              : <button type="button" className="btn" disabled={busy} onClick={() => run(async () => { await rpc('request_certification_review', { p_verification_id: cert.id }); })}>{t('cert.published')} →</button>}
          </div>
          {altOpen ? (
            <div className="stack">
              <p className="small">{t('cert.altBody')}</p>
              <textarea className="input" rows={3} maxLength={500} value={altNote} onChange={(e) => setAltNote(e.target.value)} />
              <button type="button" className="btn secondary" disabled={busy || altNote.trim().length < 10}
                onClick={() => run(async () => { await rpc('request_alternative_certification', { p_verification_id: cert.id, p_note: altNote.trim() }); })}>{t('cert.altSend')}</button>
            </div>
          ) : <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAltOpen(true)}>{t('cert.alt')}</button>}
        </div>
      ) : null}

      {message ? <p className="small" role="status">{message}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}
