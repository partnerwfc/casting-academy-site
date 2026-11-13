'use client';

import { useEffect, useState } from 'react';
import { formatCount, type DeliveryStats } from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export function Tracking({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<DeliveryStats | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const poll = async () => {
      const { data } = await supabase().rpc('alert_delivery_stats', { p_alert_id: alertId });
      if (!active) return;
      if (data) setStats(data as DeliveryStats);
      const running = !data || ['queued', 'sending'].includes((data as DeliveryStats).status);
      timer = setTimeout(poll, running ? 3000 : 30000);
    };
    poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [alertId]);

  const rows = stats ? ([
    ['track.targeted', stats.recipients_total], ['track.pending', stats.pending], ['track.accepted', stats.accepted_by_provider],
    ['track.delivered', stats.delivered_to_device], ['track.noDevice', stats.no_device], ['track.failed', stats.failed],
    ['track.opened', stats.opened], ['track.linkOpened', stats.link_opened],
  ] as const) : [];

  return (
    <section className="card" aria-live="polite">
      <div className="row between">
        <h2>{t('track.title')}</h2>
        <button className="btn ghost" onClick={onClose}>✕</button>
      </div>
      {stats ? (
        <>
          <span className={`pill ${stats.status === 'blocked' || stats.status === 'failed' ? 'sos' : 'primary'}`} style={{ alignSelf: 'flex-start' }}>{t(`track.status.${stats.status}`)}</span>
          {stats.blocked_reason ? <p className="error">{stats.blocked_reason}</p> : null}
          <div>{rows.map(([k, v]) => <div className="kv" key={k}><span className="muted">{t(k)}</span><strong>{formatCount(locale, v)}</strong></div>)}</div>
          <p className="small">{t('compose.noGuarantee')}</p>
        </>
      ) : <p className="small">{t('common.loading')}</p>}
    </section>
  );
}
