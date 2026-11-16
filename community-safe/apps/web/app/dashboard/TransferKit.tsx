'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import {
  CAMPAIGN_STEPS, buildTransferKit, creatorUrl, formatCount, type CreatorProfile, type DashboardStats,
} from '@community-safe/shared';
import { useI18n } from '@/lib/i18n';
import { SITE_URL, supabase } from '@/lib/supabase';

// Visuel prêt à publier (carré 1080×1080 ou vertical 1080×1920), généré dans le navigateur.
async function drawVisual(format: 'square' | 'story', creator: CreatorProfile, headline: string, body: string): Promise<string> {
  const width = 1080;
  const height = format === 'square' ? 1080 : 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#EFF6FF'; ctx.fillRect(0, 0, width, height * 0.36);
  const font = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const top = format === 'square' ? 90 : 260;

  ctx.fillStyle = '#2563EB'; ctx.font = `700 34px ${font}`; ctx.textAlign = 'center';
  ctx.fillText('SAVEMYCOMMUNITY', width / 2, top);

  const wrap = (text: string, y: number, size: number, weight: number, color: string, lineHeight: number) => {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${font}`;
    let line = ''; let cursor = y;
    for (const word of text.split(' ')) {
      if (ctx.measureText(`${line} ${word}`).width > width - 160 && line) { ctx.fillText(line, width / 2, cursor); line = word; cursor += lineHeight; }
      else line = line ? `${line} ${word}` : word;
    }
    ctx.fillText(line, width / 2, cursor);
    return cursor + lineHeight;
  };
  let y = wrap(headline, top + 110, 66, 800, '#111827', 80);
  y = wrap(body, y + 10, 36, 400, '#6B7280', 50);

  const qrSize = format === 'square' ? 380 : 520;
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, creatorUrl(SITE_URL, creator.handle, 'qr'), { width: qrSize, margin: 1, color: { dark: '#111827', light: '#FFFFFF' } });
  const qrY = Math.max(y + 20, height - qrSize - (format === 'square' ? 170 : 420));
  ctx.drawImage(qr, (width - qrSize) / 2, qrY, qrSize, qrSize);

  ctx.fillStyle = '#2563EB'; ctx.font = `700 44px ${font}`;
  ctx.fillText(`savemycommunity.app/@${creator.handle}`, width / 2, qrY + qrSize + 80);
  return canvas.toDataURL('image/png');
}

export function TransferKit({ creator, stats }: { creator: CreatorProfile; stats: DashboardStats }) {
  const { t, locale } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const link = creatorUrl(SITE_URL, creator.handle);
  const kit = buildTransferKit(locale, SITE_URL, creator.handle);

  useEffect(() => {
    QRCode.toDataURL(creatorUrl(SITE_URL, creator.handle, 'qr'), { width: 480, margin: 1 }).then(setQr);
    supabase().from('transfer_campaigns').select('completed_steps').eq('creator_id', creator.id).maybeSingle()
      .then(({ data }) => setDone((data?.completed_steps as string[] | undefined) ?? []));
  }, [creator.handle, creator.id]);

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };
  const download = (dataUrl: string, name: string) => {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = name; a.click();
  };
  const visual = async (format: 'square' | 'story') =>
    download(await drawVisual(format, creator, t('kit.story').replace(' 👇', ''), t('creator.joinBody')), `community-safe-${creator.handle}-${format}.png`);
  const toggle = async (step: string) => {
    const next = done.includes(step) ? done.filter((s) => s !== step) : [...done, step];
    setDone(next);
    await supabase().from('transfer_campaigns').upsert({ creator_id: creator.id, completed_steps: next }, { onConflict: 'creator_id' });
  };
  // Aucun taux inventé : affiché seulement si les clics mesurés couvrent les inscriptions.
  const conversion = stats.link_clicks >= stats.members_total && stats.link_clicks > 0 ? `${Math.min(100, Math.round((stats.members_total / stats.link_clicks) * 100))} %` : '—';

  return (
    <section id="transfer" className="stack">
      <h2>{t('kit.title')}</h2>
      <p className="muted">{t('kit.honest')}</p>
      <div className="grid">
        <div className="card">
          <span className="small">{t('kit.link')}</span>
          <strong style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>{link.replace('https://', '')}</strong>
          <button className="btn secondary" onClick={() => copy('link', link)}>{copied === 'link' ? t('common.copied') : t('common.copy')}</button>
          <div className="row between">
            <div><div className="stat-value">{formatCount(locale, stats.link_clicks)}</div><div className="small">{t('dash.clicks')}</div></div>
            <div><div className="stat-value">{formatCount(locale, stats.members_total)}</div><div className="small">{t('dash.members')}</div></div>
            <div><div className="stat-value">{conversion}</div><div className="small">{t('dash.conversion')}</div></div>
          </div>
          {Object.keys(stats.members_by_source).length ? (
            <div>
              <span className="small">{t('dash.sources')}</span>
              {Object.entries(stats.members_by_source).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                <div className="kv" key={source}><span className="muted">{source}</span><strong>{formatCount(locale, count)}</strong></div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card center">
          <h3>{t('kit.qr')}</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt={`QR ${link}`} width={200} height={200} style={{ borderRadius: 12, background: '#fff' }} /> : null}
          <div className="row" style={{ justifyContent: 'center' }}>
            {qr ? <button className="btn sm secondary" onClick={() => download(qr, `community-safe-${creator.handle}-qr.png`)}>QR · PNG</button> : null}
            <button className="btn sm secondary" onClick={() => visual('square')}>1080 × 1080</button>
            <button className="btn sm secondary" onClick={() => visual('story')}>Story 9:16</button>
          </div>
        </div>

        <div className="card">
          <h3>{t('kit.campaign')}</h3>
          {CAMPAIGN_STEPS.map((step) => (
            <label className="row" key={step} style={{ flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={done.includes(step)} onChange={() => toggle(step)} /> {t(`kit.${step}`)}
            </label>
          ))}
        </div>
      </div>

      <h3>{t('kit.texts')}</h3>
      <div className="grid">
        {kit.map((item) => (
          <div className="card" key={item.source}>
            <div className="row between">
              <strong>{item.label}</strong>
              <button className="btn ghost sm" onClick={() => copy(item.source, item.text)}>{copied === item.source ? t('common.copied') : t('common.copy')}</button>
            </div>
            <pre className="copy">{item.text}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
