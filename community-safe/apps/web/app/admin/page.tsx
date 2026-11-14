'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { Header } from '@/components/Chrome';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

// Outil interne (en anglais). Toutes les actions passent par des RPC qui revérifient
// côté serveur : rôle admin en base ET session MFA (aal2).
type Row = Record<string, unknown>;

function MfaGate({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === 'verified');
      if (verified) return setFactorId(verified.id);
      // Nettoie une inscription inachevée puis en démarre une nouvelle.
      for (const f of data?.all.filter((x) => x.status === 'unverified') ?? []) await supabase().auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: err } = await supabase().auth.mfa.enroll({ factorType: 'totp' });
      if (err || !enrolled) return setError(err?.message ?? 'MFA enrollment failed');
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
    })();
  }, []);

  const verify = async () => {
    if (!factorId) return;
    const { error: err } = await supabase().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (err) return setError(err.message);
    onVerified();
  };

  return (
    <form className="narrow stack card" onSubmit={(e) => { e.preventDefault(); verify(); }}>
      <h2>Two-factor authentication</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <><p className="muted">Scan this QR code with an authenticator app, then enter the 6-digit code.</p><img src={qr} alt="TOTP QR code" width={200} height={200} style={{ background: '#fff', borderRadius: 12 }} /></> : <p className="muted">Enter the code from your authenticator app.</p>}
      <input className="input" inputMode="numeric" maxLength={6} autoFocus aria-label="Authenticator code" value={code} onChange={(e) => setCode(e.target.value)} />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="btn" disabled={code.trim().length < 6}>Verify</button>
    </form>
  );
}

function Table({ rows, columns, actions }: { rows: Row[]; columns: string[]; actions?: (row: Row) => React.ReactNode }) {
  if (!rows.length) return <p className="small">Nothing here.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}{actions ? <th /> : null}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? row.key ?? i)}>
              {columns.map((c) => {
                const value = c.split('.').reduce<unknown>((acc, k) => (acc as Row | null)?.[k], row);
                return <td key={c}>{value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>;
              })}
              {actions ? <td><div className="row">{actions(row)}</div></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Console() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [verifications, setVerifications] = useState<Row[]>([]);
  const [reports, setReports] = useState<Row[]>([]);
  const [creators, setCreators] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row[]>([]);
  const [logs, setLogs] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = supabase();
    const term = search.trim().replace(/[%,()\\*]/g, '');
    let creatorQuery = db.from('creator_profiles').select('id, handle, display_name, category, verification_status, status, plan_id, member_count').order('created_at', { ascending: false }).limit(50);
    if (term) creatorQuery = creatorQuery.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
    const [s, v, r, c, a, p, st, l] = await Promise.all([
      db.rpc('admin_stats'),
      db.from('creator_verifications').select('id, method, evidence, created_at, creator_profiles(handle, display_name, category)').eq('status', 'pending').order('created_at'),
      db.from('abuse_reports').select('id, reason, details, created_at, creator_id, alert_id, creator_profiles(handle)').eq('status', 'open').order('created_at'),
      creatorQuery,
      db.from('alerts').select('id, kind, status, message, link_url, recipients_total, created_at, creator_profiles(handle)').neq('kind', 'test').order('created_at', { ascending: false }).limit(30),
      db.from('plans').select('*').order('sort_order'),
      db.from('app_settings').select('*').order('key'),
      db.from('audit_logs').select('id, action, target_type, target_id, metadata, created_at').order('created_at', { ascending: false }).limit(50),
    ]);
    if (s.error) return setError(s.error.message);
    setStats(s.data as Record<string, number>);
    setVerifications((v.data ?? []) as Row[]); setReports((r.data ?? []) as Row[]); setCreators((c.data ?? []) as Row[]);
    setAlerts((a.data ?? []) as Row[]); setPlans((p.data ?? []) as Row[]); setSettings((st.data ?? []) as Row[]); setLogs((l.data ?? []) as Row[]);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: err } = await fn;
    setError(err?.message ?? null);
    load();
  };
  const db = supabase();
  const money = (cents: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  return (
    <div className="stack-lg">
      {error ? <p className="error" role="alert">{error}</p> : null}
      {stats ? (
        <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {Object.entries(stats).map(([key, value]) => (
            <div className="card" key={key}>
              <div className="stat-value">{key.endsWith('_cents') ? money(value) : new Intl.NumberFormat('en').format(value)}</div>
              <div className="small">{key.replace(/_cents$/, '').replaceAll('_', ' ')}</div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card"><h3>Pending verifications</h3>
        <Table rows={verifications} columns={['creator_profiles.handle', 'creator_profiles.display_name', 'method', 'evidence', 'created_at']} actions={(row) => (<>
          <button className="btn sm" onClick={() => act(db.rpc('admin_review_verification', { p_verification_id: row.id, p_approve: true }))}>Approve</button>
          <button className="btn sm danger" onClick={() => act(db.rpc('admin_review_verification', { p_verification_id: row.id, p_approve: false, p_notes: prompt('Reason?') }))}>Reject</button>
        </>)} />
      </section>

      <section className="card"><h3>Open reports</h3>
        <Table rows={reports} columns={['creator_profiles.handle', 'reason', 'details', 'created_at']} actions={(row) => (<>
          {row.creator_id ? <button className="btn sm danger" onClick={() => confirm('Suspend this creator?') && act(db.rpc('admin_set_creator_status', { p_creator_id: row.creator_id, p_status: 'suspended', p_reason: `report:${row.reason}` }))}>Suspend creator</button> : null}
          <button className="btn sm secondary" onClick={() => act(db.from('abuse_reports').update({ status: 'reviewed' }).eq('id', row.id))}>Mark reviewed</button>
          <button className="btn sm ghost" onClick={() => act(db.from('abuse_reports').update({ status: 'dismissed' }).eq('id', row.id))}>Dismiss</button>
        </>)} />
      </section>

      <section className="card"><h3>Creators</h3>
        <input className="input" placeholder="Search handle or name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search creators" />
        <Table rows={creators} columns={['handle', 'display_name', 'verification_status', 'status', 'plan_id', 'member_count']} actions={(row) => (<>
          {row.status === 'active'
            ? <button className="btn sm danger" onClick={() => confirm(`Suspend @${row.handle}?`) && act(db.rpc('admin_set_creator_status', { p_creator_id: row.id, p_status: 'suspended', p_reason: prompt('Reason?') }))}>Suspend</button>
            : <button className="btn sm secondary" onClick={() => act(db.rpc('admin_set_creator_status', { p_creator_id: row.id, p_status: 'active' }))}>Reactivate</button>}
          <select className="input" style={{ width: 'auto', padding: '6px 8px' }} aria-label="Plan" value={String(row.plan_id)}
            onChange={(e) => act(db.rpc('admin_set_creator_plan', { p_creator_id: row.id, p_plan_id: e.target.value }))}>
            {plans.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
          </select>
        </>)} />
      </section>

      <section className="card"><h3>Recent alerts</h3>
        <Table rows={alerts} columns={['creator_profiles.handle', 'kind', 'status', 'message', 'link_url', 'recipients_total', 'created_at']} actions={(row) => (
          ['queued', 'sending'].includes(String(row.status)) ? <button className="btn sm danger" onClick={() => act(db.rpc('admin_block_alert', { p_alert_id: row.id, p_reason: prompt('Reason?') }))}>Block</button> : null
        )} />
      </section>

      <section className="card"><h3>Plans</h3><p className="small">Prices in cents. Empty = custom / unlimited.</p>
        <Table rows={plans} columns={['id', 'name', 'price_cents', 'member_limit', 'announcements_per_month', 'is_public']} actions={(row) => (
          <button className="btn sm secondary" onClick={() => {
            const num = (label: string, current: unknown) => { const v = prompt(label, current === null ? '' : String(current)); return v === null ? undefined : v.trim() === '' ? null : Number(v); };
            const price = num('Price (cents)', row.price_cents); if (price === undefined) return;
            const members = num('Member limit', row.member_limit); if (members === undefined) return;
            const announcements = num('Announcements per month', row.announcements_per_month); if (announcements === undefined) return;
            act(db.from('plans').update({ price_cents: price, member_limit: members, announcements_per_month: announcements, updated_at: new Date().toISOString() }).eq('id', row.id));
          }}>Edit</button>
        )} />
      </section>

      <section className="card"><h3>Sending limits & settings</h3>
        <Table rows={settings} columns={['key', 'value']} actions={(row) => (
          <button className="btn sm secondary" onClick={() => {
            const v = prompt(String(row.key), JSON.stringify(row.value)); if (v === null) return;
            try { act(db.from('app_settings').update({ value: JSON.parse(v), updated_at: new Date().toISOString() }).eq('key', row.key)); } catch { setError('Invalid JSON value'); }
          }}>Edit</button>
        )} />
      </section>

      <section className="card"><h3>Audit log</h3>
        <Table rows={logs} columns={['created_at', 'action', 'target_type', 'target_id', 'metadata']} />
      </section>
    </div>
  );
}

export default function Admin() {
  const session = useSession();
  const [state, setState] = useState<'loading' | 'forbidden' | 'mfa' | 'ok'>('loading');
  const userId = session?.user.id;

  const check = useCallback(async () => {
    if (!userId) return;
    const { data: role } = await supabase().from('admin_roles').select('role').eq('user_id', userId).maybeSingle();
    if (!role) return setState('forbidden');
    const { data } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
    setState(data?.currentLevel === 'aal2' ? 'ok' : 'mfa');
  }, [userId]);
  useEffect(() => { check(); }, [check]);

  return (
    <>
      <Header />
      <main className="container stack" style={{ paddingTop: 16 }}>
        <h2>Administration</h2>
        {session === undefined ? <p className="small">Loading…</p>
          : !session ? <div className="narrow card"><AuthForm /></div>
          : state === 'forbidden' ? <p className="muted">This account has no administrator role.</p>
          : state === 'mfa' ? <MfaGate onVerified={check} />
          : state === 'ok' ? <Console /> : <p className="small">Loading…</p>}
      </main>
    </>
  );
}
