import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SOCIAL_PLATFORMS_CERT, errorMessage, formatDate, type Certification } from '@community-safe/shared';
import { CertBadge } from '@/components/CertBadge';
import { Button, Card, Chip, Input, Loading, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

const LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', twitch: 'Twitch', snapchat: 'Snapchat', facebook: 'Facebook', website: 'Web' };

// Certification en deux validations : 1) présence (appel vidéo en direct), 2) identité (code publié sur le compte officiel).
export default function Certification() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { creator, refreshCreator } = useAuth();
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
  const creatorId = creator?.id;

  const load = useCallback(async () => {
    if (!creatorId) return;
    const { data } = await supabase.from('creator_verifications').select('*').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setCert((data as Certification | null) ?? null);
    const { data: mode } = await supabase.from('app_settings').select('value').eq('key', 'certification_presence_mode').maybeSingle();
    if (typeof mode?.value === 'string') setPresenceMode(mode.value);
  }, [creatorId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<{ message?: string } | void>) => {
    setBusy(true); setError(null); setMessage(null);
    try { const r = await fn(); if (r?.message) setMessage(r.message); await load(); await refreshCreator(); }
    catch (e) { setError(errorMessage(locale, e)); }
    setBusy(false);
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error: err } = await supabase.rpc(name, args);
    if (err) throw err;
    return data;
  };

  if (!creator || cert === undefined) return <Loading />;
  const status = creator.verification_status;

  if (status === 'verified') {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: space.md, marginTop: space.xl }}>
          <CertBadge />
          <T v="title" center>{t('cert.approved')}</T>
          <T v="muted" center>{t('cert.approvedBody')}</T>
        </View>
        <Button label={t('common.continue')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const presenceOk = presenceMode === 'off' || cert?.presence_status === 'passed';
  const open = !!cert && ['awaiting_proof', 'in_review'].includes(cert.status);

  const start = () => run(async () => {
    const account = await rpc('add_social_account', { p_platform: platform, p_url: url.trim() });
    await rpc('start_certification', { p_social_account_id: (account as { id: string }).id });
    setUrl('');
  });
  const check = (id: string) => run(async () => {
    const { data, error: err } = await supabase.functions.invoke('certify', { body: { verification_id: id } });
    const code = (data as { error?: string } | null)?.error ?? (err ? 'billing_failed' : null);
    if (code) throw code;
    const result = data as { status: string; attempts_left?: number };
    if (result.status === 'awaiting_proof') return { message: t('cert.notFound', { left: result.attempts_left ?? 0 }) };
  });

  const Level = ({ n, ok, current, title, body }: { n: string; ok?: boolean; current?: boolean; title: string; body: string }) => (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ok ? c.success : current ? c.primary : c.border, alignItems: 'center', justifyContent: 'center' }}>
        <T v="small" style={{ color: '#fff', fontWeight: '800' }}>{ok ? '✓' : n}</T>
      </View>
      <View style={{ flex: 1 }}><T v="heading">{title}</T><T v="small">{body}</T></View>
    </View>
  );

  return (
    <Screen>
      {status === 'suspended' ? <Card tone="sos"><T v="muted">{t('cert.suspended')}</T></Card> : (
        <>
          {status === 'revoked' ? <T v="small" style={{ color: c.sos }}>{t('cert.revoked')}</T> : null}
          {!open && cert?.status === 'rejected' ? <T v="small" style={{ color: c.sos }}>{t('cert.rejected')}{cert.decision_reason ? ` · ${cert.decision_reason}` : ''}</T> : null}
          {!open && cert?.status === 'expired' ? <T v="small" style={{ color: c.sos }}>{t('cert.expired')}</T> : null}
          {!open && cert?.status === 'failed' ? <T v="small" style={{ color: c.sos }}>{t('cert.failed')}</T> : null}
          <T v="muted">{t('cert.intro')}</T>
          <Card>
            <Level n="1" ok={presenceOk} current={open && !presenceOk} title={presenceOk ? t('cert.presenceOk') : t('cert.step1')} body={t('cert.step1Body')} />
            <Level n="2" current={open && presenceOk} title={t('cert.step2')} body={t('cert.step2Body')} />
          </Card>

          {!open ? (
            <View style={{ gap: space.md }}>
              <T v="small" style={{ fontWeight: '600', color: c.text }}>{t('cert.platform')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {SOCIAL_PLATFORMS_CERT.map((p) => <Chip key={p} label={LABEL[p]} selected={platform === p} onPress={() => setPlatform(p)} />)}
              </View>
              <Input label={t('cert.url')} value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="https://" />
              <Button label={`${cert ? t('cert.restart') : t('cert.start')} →`} onPress={start} loading={busy} disabled={!url.trim()} />
            </View>
          ) : null}

          {open && cert.status === 'in_review' ? <Card tone="soft"><T v="heading">{t('cert.inReview')}</T><T v="muted">{t('cert.inReviewBody')}</T></Card> : null}

          {open && cert.status === 'awaiting_proof' && !presenceOk ? (
            cert.evidence?.call_link ? (
              <Card tone="soft"><T v="heading">{t('cert.callRequested')}</T><T v="small">{cert.evidence.call_link}{cert.evidence.availability ? ` · ${cert.evidence.availability}` : ''}</T></Card>
            ) : (
              <View style={{ gap: space.md }}>
                <Input label={t('cert.callLink')} value={callLink} onChangeText={setCallLink} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="https://meet.google.com/…" />
                <Input label={t('cert.availability')} value={availability} onChangeText={setAvailability} maxLength={200} />
                <Button label={`${t('cert.requestCall')} →`} loading={busy} disabled={!callLink.trim()}
                  onPress={() => run(async () => { await rpc('request_presence_call', { p_verification_id: cert.id, p_link: callLink.trim(), p_availability: availability.trim() || null }); return { message: t('cert.callRequested') }; })} />
              </View>
            )
          ) : null}

          {open && cert.status === 'awaiting_proof' && presenceOk ? (
            <View style={{ gap: space.md }}>
              <T v="heading">{t('cert.codeTitle')}</T>
              <T v="muted">{t('cert.codeBody')}</T>
              <Card><T v="title" center style={{ letterSpacing: 2 }}>{cert.code}</T></Card>
              <T v="small" center>{cert.code_expires_at ? t('cert.codeExpires', { date: formatDate(locale, cert.code_expires_at).split(',')[0] }) : ''}</T>
              <Button label={t('common.copy')} kind="secondary" onPress={() => Clipboard.setStringAsync(cert.code ?? '').then(() => setMessage(t('common.copied')))} />
              {cert.method.startsWith('auto_')
                ? <Button label={`${t('cert.checkNow')} →`} onPress={() => check(cert.id)} loading={busy} />
                : <Button label={`${t('cert.published')} →`} loading={busy} onPress={() => run(async () => { await rpc('request_certification_review', { p_verification_id: cert.id }); })} />}
              {altOpen ? (
                <View style={{ gap: space.sm }}>
                  <T v="small">{t('cert.altBody')}</T>
                  <Input value={altNote} onChangeText={setAltNote} multiline maxLength={500} style={{ minHeight: 80, textAlignVertical: 'top' }} />
                  <Button label={t('cert.altSend')} kind="secondary" loading={busy} disabled={altNote.trim().length < 10}
                    onPress={() => run(async () => { await rpc('request_alternative_certification', { p_verification_id: cert.id, p_note: altNote.trim() }); })} />
                </View>
              ) : <Button label={t('cert.alt')} kind="ghost" onPress={() => setAltOpen(true)} />}
            </View>
          ) : null}
        </>
      )}
      {message ? <T v="small">{message}</T> : null}
      {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}
    </Screen>
  );
}
