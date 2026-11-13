'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIES, HANDLE_PATTERN, errorMessage, formatCount, formatDate, normalizeHandle,
  type Alert, type CreatorProfile, type DashboardStats, type MessageKey,
} from '@community-safe/shared';
import { AuthForm } from '@/components/AuthForm';
import { Footer, Header } from '@/components/Chrome';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { Composer } from './Composer';
import { Tracking } from './Tracking';
import { TransferKit } from './TransferKit';
import { VerificationCard } from './VerificationCard';

function Setup({ onCreated }: { onCreated: () => void }) {
  const { t, locale } = useI18n();
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [category, setCategory] = useState('creator');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = normalizeHandle(handle);

  const submit = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase().rpc('create_creator_profile', {
      p_handle: clean, p_display_name: name.trim(), p_category: category, p_bio: bio.trim() || null,
    });
    setBusy(false);
    if (err) return setError(errorMessage(locale, err));
    onCreated();
  };

  return (
    <form className="narrow stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h2>{t('setup.title')}</h2>
      <label className="field">{t('setup.displayName')}
        <input className="input" value={name} maxLength={60} required onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">{t('setup.handle')}
        <input className="input" value={handle} maxLength={31} required autoCapitalize="none" placeholder="@" onChange={(e) => setHandle(e.target.value)} />
        <span className="small">{clean ? `communitysafe.com/@${clean} · ` : ''}{t('setup.handleHint')}</span>
      </label>
      <label className="field">{t('setup.category')}
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}` as MessageKey)}</option>)}
        </select>
      </label>
      <label className="field">{t('setup.bio')}
        <textarea className="input" rows={3} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="btn" disabled={busy || !HANDLE_PATTERN.test(clean) || !name.trim()}>{t('setup.create')}</button>
    </form>
  );
}

export default function Dashboard() {
  const { t, locale } = useI18n();
  const session = useSession();
  const [creator, setCreator] = useState<CreatorProfile | null | undefined>(undefined);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [composing, setComposing] = useState<'sos' | 'announcement' | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase().from('creator_profiles').select('*').eq('owner_user_id', userId).maybeSingle();
    const row = (data as CreatorProfile | null) ?? null;
    setCreator(row);
    if (!row) return;
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase().rpc('creator_dashboard_stats'),
      supabase().from('alerts').select('*').eq('creator_id', row.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (s) setStats(s as DashboardStats);
    setAlerts((a ?? []) as Alert[]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Compteur en temps quasi réel.
  const creatorId = creator?.id;
  useEffect(() => {
    if (!creatorId) return;
    const channel = supabase().channel(`creator-${creatorId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'creator_profiles', filter: `id=eq.${creatorId}` }, () => load())
      .subscribe();
    return () => { supabase().removeChannel(channel); };
  }, [creatorId, load]);

  const sendTest = async () => {
    const { error } = await supabase().rpc('create_alert', {
      p_kind: 'test', p_message: t('dash.test'), p_idempotency_key: crypto.randomUUID(),
    });
    if (!error) await supabase().functions.invoke('dispatch-alerts', { body: {} });
    setNotice(error ? errorMessage(locale, error) : t('dash.testSent'));
    load();
  };

  let body;
  if (session === undefined || (session && creator === undefined)) {
    body = <p className="small center">{t('common.loading')}</p>;
  } else if (!session) {
    body = <div className="narrow stack"><h2>{t('auth.title')}</h2><div className="card"><AuthForm /></div></div>;
  } else if (!creator) {
    body = <Setup onCreated={load} />;
  } else if (!stats) {
    body = <p className="small center">{t('common.loading')}</p>;
  } else {
    const verified = creator.verification_status === 'verified';
    const limit = stats.plan.member_limit;
    const over = limit !== null && stats.members_total > limit;
    const quota = stats.plan.announcements_per_month;
    const max = Math.max(1, ...stats.growth.map((d) => d.count));
    body = (
      <div className="stack-lg">
        <section className="stack">
          <span className="eyebrow">{t('dash.title')}</span>
          <div className="big-number">{formatCount(locale, stats.members_total)}</div>
          <p className="muted">{t('dash.members')} · @{creator.handle} {verified ? '✓' : ''}</p>
          <div className="row">
            <button className="btn sos" disabled={!verified} onClick={() => setComposing('sos')}>{t('dash.sos')}</button>
            <a className="btn secondary" href="#transfer">{t('dash.share')}</a>
          </div>
          {notice ? <p className="small" role="status">{notice}</p> : null}
        </section>

        {verified ? null : <VerificationCard creator={creator} onChange={load} />}
        {composing ? <Composer kind={composing} creator={creator} email={session.user.email ?? ''} onClose={() => setComposing(null)}
          onSent={(id) => { setComposing(null); setTracking(id); load(); }} /> : null}
        {tracking ? <Tracking alertId={tracking} onClose={() => setTracking(null)} /> : null}

        <section className="grid">
          <div className="card">
            <div className="row between">
              {([['dash.today', stats.members_today], ['dash.week', stats.members_week], ['dash.month', stats.members_month]] as const).map(([k, v]) => (
                <div key={k}><div className="stat-value">+{formatCount(locale, v)}</div><div className="small">{t(k)}</div></div>
              ))}
            </div>
            <span className="small">{t('dash.growth')}</span>
            <div className="chart" role="img" aria-label={t('dash.growth')}>
              {stats.growth.map((d) => <span key={d.day} className={d.count ? '' : 'empty'} style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }} title={`${d.day}: ${d.count}`} />)}
            </div>
          </div>
          <div className="card">
            {([
              ['dash.notifAllowed', stats.members_notifications_allowed], ['dash.validDevices', stats.devices_with_valid_token],
              ['dash.sosEnabled', stats.members_sos_enabled], ['dash.annEnabled', stats.members_announcements_enabled],
              ['dash.alertsSent', stats.alerts_sent],
            ] as const).map(([k, v]) => <div className="kv" key={k}><span className="muted">{t(k)}</span><strong>{formatCount(locale, v)}</strong></div>)}
          </div>
          <div className="card">
            <div className="row between">
              <h3>{t('dash.plan')} {stats.plan.name}</h3>
              {limit !== null ? <span className="small">{t('dash.capacity', { count: formatCount(locale, stats.members_total), limit: formatCount(locale, limit) })}</span> : null}
            </div>
            {over ? <p className="error">{t('dash.overCapacity')}</p> : null}
            <Link className="btn secondary" href="/dashboard/plan">{t('plan.title')}</Link>
            <button className="btn secondary" onClick={() => setComposing('announcement')}
              disabled={!verified || over || (quota !== null && stats.announcements_this_month >= quota)}>
              {t('dash.announce')}{quota !== null ? ` · ${t('dash.announceQuota', { used: stats.announcements_this_month, limit: quota })}` : ''}
            </button>
            <button className="btn ghost" onClick={sendTest}>{t('dash.test')}</button>
          </div>
        </section>

        <TransferKit creator={creator} stats={stats} />

        {alerts.length ? (
          <section className="stack">
            <h2>{t('dash.history')}</h2>
            <div className="table-wrap card">
              <table>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id}>
                      <td><span className={`pill ${a.kind === 'sos' ? 'sos' : 'primary'}`}>{t(`alerts.kind.${a.kind}`)}</span></td>
                      <td>{a.message}</td>
                      <td className="small">{formatDate(locale, a.created_at)}</td>
                      <td><button className="btn ghost sm" onClick={() => setTracking(a.id)}>{t(`track.status.${a.status}`)} →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => supabase().auth.signOut()}>{t('auth.signOut')}</button>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="container" style={{ paddingTop: 16 }}>{body}</main>
      <Footer />
    </>
  );
}
