import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SOCIAL_PLATFORMS_CERT, errorMessage, formatDate, type Certification } from '@community-safe/shared';
import { Button, Card, Chip, Loading, Pill, Screen, T, VerifiedBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { fontFor, space, useColors, tint } from '@/lib/theme';

const LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', twitch: 'Twitch', snapchat: 'Snapchat', facebook: 'Facebook', website: 'Web' };
type Method = 'account' | 'website' | 'document' | 'other';

// ───────────── Étape 2 : vidéo selfie silencieuse ─────────────
function Selfie({ onClose, onDone }: { onClose: () => void; onDone: (path: string) => void }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const camRef = useRef<CameraView>(null);
  const [perm, askPerm] = useCameraPermissions();
  const [phase, setPhase] = useState<'idle' | 'face' | 'left' | 'right' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    if (!perm?.granted) {
      const r = await askPerm();
      if (!r.granted) return setError(t('cert2.camDenied'));
    }
    try {
      setPhase('face');
      const t1 = setTimeout(() => setPhase('left'), 3000);
      const t2 = setTimeout(() => setPhase('right'), 5500);
      const rec = camRef.current?.recordAsync({ maxDuration: 8 });
      const stop = setTimeout(() => camRef.current?.stopRecording(), 8000);
      const video = await rec;
      [t1, t2, stop].forEach(clearTimeout);
      if (!video?.uri) throw new Error('no_video');
      setPhase('uploading');
      const ext = video.uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
      const buffer = await (await fetch(video.uri)).arrayBuffer();
      const path = `${session!.user.id}/selfie-${Date.now()}.${ext}`;
      const { error: up } = await supabase.storage.from('cert-videos').upload(path, buffer, { contentType: ext === 'mov' ? 'video/quicktime' : 'video/mp4' });
      if (up) throw up;
      onDone(path);
    } catch (e) {
      setPhase('idle');
      setError(String((e as Error).message ?? e));
    }
  };

  const prompt = phase === 'face' ? t('cert2.face') : phase === 'left' ? t('cert2.left') : phase === 'right' ? t('cert2.right') : phase === 'uploading' ? t('cert2.uploading') : t('cert2.place');
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0E1A' }}>
      <SafeAreaView style={{ flex: 1, padding: 20 }} edges={['top', 'bottom', 'left', 'right']}>
        <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} style={{ position: 'absolute', left: 0, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
          </Pressable>
          <Text style={{ color: '#fff', fontSize: 15, fontFamily: fontFor(700) }}>{t('cert2.stepOf', { n: 2 })}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <View style={{ width: 254, height: 326, borderRadius: '50%' as unknown as number, overflow: 'hidden', borderWidth: 6, borderColor: phase === 'idle' ? 'rgba(148,163,200,0.55)' : '#6D28D9', backgroundColor: '#161B33', alignItems: 'center', justifyContent: 'flex-end' }}>
            {perm?.granted ? <CameraView ref={camRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} facing="front" mode="video" mute /> : (
              <Svg width={242} height={314} viewBox="0 0 280 360">
                <Ellipse cx={140} cy={150} rx={62} ry={74} fill="#4E5A86" />
                <Ellipse cx={140} cy={340} rx={105} ry={90} fill="#4E5A86" />
                <Circle cx={140} cy={150} r={2.5} fill="#2A3358" />
              </Svg>
            )}
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontFamily: fontFor(800), letterSpacing: -0.4, textAlign: 'center' }}>{prompt}</Text>
            <Text style={{ color: '#9AA3C2', fontSize: 15.5, textAlign: 'center' }}>{phase === 'idle' ? t('cert2.light') : t('cert2.recording')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['face', 'left', 'right'].map((p) => <View key={p} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: phase === p ? '#fff' : 'rgba(255,255,255,0.28)' }} />)}
          </View>
          {error ? <Text style={{ color: '#FDA4AF', fontSize: 14, textAlign: 'center' }}>{error}</Text> : null}
          {error && !perm?.granted ? <Pressable onPress={() => Linking.openSettings()}><Text style={{ color: '#C4B5FD', fontSize: 15, fontFamily: fontFor(700) }}>Réglages</Text></Pressable> : null}
        </View>
        <Text style={{ color: '#9AA3C2', fontSize: 13.5, textAlign: 'center', marginBottom: 12 }}>🔇 {t('cert2.noSound')}</Text>
        <Pressable accessibilityRole="button" disabled={phase !== 'idle'} onPress={start} style={{ height: 56, borderRadius: 18, backgroundColor: tint('#fff'), alignItems: 'center', justifyContent: 'center', opacity: phase === 'idle' ? 1 : 0.6 }}>
          <Text style={{ color: tint('#170B2F'), fontSize: 17, fontFamily: fontFor(700) }}>{phase === 'idle' ? t('cert2.record') : phase === 'uploading' ? t('cert2.uploading') : t('cert2.recording')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

export default function Certification() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { creator, refreshCreator } = useAuth();
  const [cert, setCert] = useState<Certification | null | undefined>(undefined);
  const [mode, setMode] = useState<'overview' | 'selfie' | 'proof'>('overview');
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>('account');
  const [platform, setPlatform] = useState<string>('instagram');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const creatorId = creator?.id;

  const load = useCallback(async () => {
    if (!creatorId) return;
    const { data } = await supabase.from('creator_verifications').select('*').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setCert((data as Certification | null) ?? null);
  }, [creatorId]);
  useEffect(() => { load(); }, [load]);

  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error: err } = await supabase.rpc(name, args);
    if (err) throw err;
    return data;
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setMessage(null);
    try { await fn(); await load(); await refreshCreator(); } catch (e) { setError(errorMessage(locale, e)); }
    setBusy(false);
  };

  if (!creator || cert === undefined) return <Loading />;
  const status = creator.verification_status;

  if (status === 'verified') {
    return (
      <Screen nav={{ back: t('tabs.profile'), title: t('profile.rowCert') }} footer={<Button label={t('common.continue')} onPress={() => router.back()} />}>
        <View style={{ alignItems: 'center', gap: space.md, marginTop: space.xl }}>
          <VerifiedBadge size={72} />
          <T v="title" center>{t('cert.approved')}</T>
          <T v="muted" center>{t('cert.approvedBody')}</T>
        </View>
      </Screen>
    );
  }
  if (status === 'suspended') {
    return <Screen nav={{ back: t('tabs.profile'), title: t('profile.rowCert') }}><Card tone="sos"><T v="muted">{t('cert.suspended')}</T></Card></Screen>;
  }

  const open = !!cert && ['awaiting_proof', 'in_review'].includes(cert.status);
  const hasVideo = !!videoPath || !!(cert?.evidence as { video_path?: string } | undefined)?.video_path;
  const inReview = !!cert && cert.status === 'in_review';
  const hasCode = !!cert && cert.status === 'awaiting_proof' && !!cert.code;
  const stepState = (n: number): 'done' | 'current' | 'todo' => {
    if (n === 1) return 'done';
    if (n === 2) return hasVideo ? 'done' : 'current';
    if (n === 3) return inReview ? 'done' : hasVideo ? 'current' : 'todo';
    return inReview ? 'current' : 'todo';
  };

  if (mode === 'selfie') {
    return <Selfie onClose={() => setMode('overview')} onDone={(path) => { setVideoPath(path); setMode('proof'); }} />;
  }

  // ───────────── Étape 3 : preuve complémentaire ─────────────
  if (mode === 'proof') {
    const methods: { id: Method; title: string; desc: string }[] = [
      { id: 'account', title: t('cert2.m1t'), desc: t('cert2.m1d') },
      { id: 'website', title: t('cert2.m2t'), desc: t('cert2.m2d') },
      { id: 'document', title: t('cert2.m3t'), desc: t('cert2.m3d') },
      { id: 'other', title: t('cert2.m4t'), desc: t('cert2.m4d') },
    ];
    const needsNote = method === 'document' || method === 'other';
    // Crée la demande (compte + code) et rattache la vidéo déjà envoyée.
    const ensureCert = async (): Promise<Certification> => {
      let current = cert && cert.status === 'awaiting_proof' ? cert : null;
      if (!current) {
        const account = await rpc('add_social_account', { p_platform: method === 'website' ? 'website' : platform, p_url: url.trim() });
        current = (await rpc('start_certification', { p_social_account_id: (account as { id: string }).id })) as Certification;
      }
      if (videoPath && !(current.evidence as { video_path?: string } | undefined)?.video_path) {
        await rpc('attach_presence_video', { p_verification_id: current.id, p_path: videoPath });
      }
      return current;
    };
    const primary = () => run(async () => {
      const current = await ensureCert();
      if (needsNote) await rpc('request_alternative_certification', { p_verification_id: current.id, p_note: note.trim() });
      else if (hasCode) { await rpc('request_certification_review', { p_verification_id: current.id }); }
      if (needsNote || hasCode) setMode('overview');
    });
    const ready = (method === 'document' || method === 'other' ? note.trim().length >= 10 : true) && (hasCode || !!url.trim());
    const label = !needsNote && !hasCode ? t('cert2.genCode') : t('cert2.send');
    return (
      <Screen nav={{ back: t('common.back'), title: t('profile.rowCert'), onBack: () => setMode('overview') }}
        footer={<>
          {error ? <Text style={{ color: c.sos, fontSize: 13.5 }}>{error}</Text> : null}
          <Button label={label} onPress={primary} loading={busy} disabled={!ready} />
        </>}>
        <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase' }}>{t('cert2.stepOf', { n: 3 })}</Text>
        <Text style={{ fontSize: 29, lineHeight: 33, letterSpacing: -0.8, color: c.text, fontFamily: fontFor(800), marginTop: -6 }}>{t('cert2.proofTitle', { name: creator.display_name })}</Text>
        <Text style={{ fontSize: 15.5, lineHeight: 22, color: c.muted }}>{t('cert2.proofIntro')}</Text>
        <View style={{ gap: 12 }}>
          {methods.map((m) => {
            const on = method === m.id;
            return (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { if (!hasCode) setMethod(m.id); }}
                style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 14, borderRadius: 20, borderWidth: on ? 1.5 : 1, borderColor: on ? c.primary : tint('#E9E6F3'), backgroundColor: tint('#fff') }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? c.primary : tint('#C9CCD8'), alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {on ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c.primary }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 17, color: c.text, fontFamily: fontFor(700) }}>{m.title}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 19, color: c.muted }}>{m.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {!hasCode ? (
          <View style={{ gap: 12 }}>
            {method === 'account' || needsNote ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SOCIAL_PLATFORMS_CERT.filter((p) => p !== 'website').map((p) => <Chip key={p} label={LABEL[p]} selected={platform === p} onPress={() => setPlatform(p)} />)}
              </View>
            ) : null}
            <View style={{ backgroundColor: tint('#fff'), borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, color: c.muted, fontFamily: fontFor(700) }}>{t('cert2.account')}</Text>
              <TextInput value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="https://" placeholderTextColor={c.muted}
                style={{ fontSize: 17, color: c.text, paddingVertical: 6, fontFamily: 'Inter_400Regular' }} />
            </View>
            {needsNote ? (
              <View style={{ backgroundColor: tint('#fff'), borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, color: c.muted, fontFamily: fontFor(700) }}>{t('cert2.docNote')}</Text>
                <TextInput value={note} onChangeText={setNote} multiline maxLength={500} placeholderTextColor={c.muted}
                  style={{ fontSize: 16, color: c.text, minHeight: 80, textAlignVertical: 'top', paddingVertical: 6, fontFamily: 'Inter_400Regular' }} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ backgroundColor: tint('#fff'), borderRadius: 20, padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 13.5, color: c.muted, fontFamily: fontFor(700) }}>{t('cert2.codeLabel')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text selectable style={{ fontSize: 27, letterSpacing: 1.5, color: c.text, fontFamily: fontFor(800) }}>{cert?.code}</Text>
              <Pressable accessibilityRole="button" onPress={() => Clipboard.setStringAsync(cert?.code ?? '').then(() => setMessage(t('common.copied')))} style={{ backgroundColor: tint('#F0EBFF'), borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}>
                <Text style={{ color: c.primary, fontSize: 15, fontFamily: fontFor(700) }}>{message === t('common.copied') ? t('common.copied') : t('common.copy')}</Text>
              </Pressable>
            </View>
            {cert?.code_expires_at ? <Text style={{ fontSize: 13, color: c.muted }}>{t('cert.codeExpires', { date: formatDate(locale, cert.code_expires_at).split(',')[0] })}</Text> : null}
          </View>
        )}
      </Screen>
    );
  }

  // ───────────── Vue d'ensemble ─────────────
  const stepTitle = [t('cert2.s1t'), t('cert2.s2t'), t('cert2.s3t'), t('cert2.s4t')];
  const stepDesc = [t('cert2.s1d'), t('cert2.s2d'), t('cert2.s3d'), t('cert2.s4d')];
  const cta = inReview ? null : hasVideo ? t('cert2.keepGoing') : t('cert2.begin');
  return (
    <Screen
      nav={{ back: t('tabs.profile'), title: t('profile.rowCert') }}
      footer={cta ? <Button label={cta} onPress={() => setMode(hasVideo ? 'proof' : 'selfie')} /> : null}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={c.brand} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 3l7.5 3v5.6c0 4.4-3 7.7-7.5 9.4-4.5-1.7-7.5-5-7.5-9.4V6zM8.8 12l2.4 2.4 4.2-4.4" /></Svg>
        </View>
        <Pill label={inReview ? t('cert2.statusReview') : t('creator.unverified')} tone={inReview ? 'warn' : 'neutral'} />
        <Text style={{ fontSize: 29, lineHeight: 34, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.8, textAlign: 'center' }}>{t('cert.headline')}</Text>
        <Text style={{ fontSize: 16, lineHeight: 23, color: c.muted, textAlign: 'center', paddingHorizontal: 4 }}>{t('cert.intro')}</Text>
      </View>

      {status === 'revoked' ? <Text style={{ color: c.sos, fontSize: 14 }}>{t('cert.revoked')}</Text> : null}
      {!open && cert?.status === 'rejected' ? <Text style={{ color: c.sos, fontSize: 14 }}>{t('cert.rejected')}{cert.decision_reason ? ` · ${cert.decision_reason}` : ''}</Text> : null}
      {!open && cert?.status === 'expired' ? <Text style={{ color: c.sos, fontSize: 14 }}>{t('cert.expired')}</Text> : null}
      {!open && cert?.status === 'failed' ? <Text style={{ color: c.sos, fontSize: 14 }}>{t('cert.failed')}</Text> : null}

      <View style={{ gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase', marginLeft: 6 }}>{t('cert2.stepsLabel')}</Text>
        <View style={{ backgroundColor: tint('#fff'), borderRadius: 22, overflow: 'hidden' }}>
          {[1, 2, 3, 4].map((n) => {
            const st = stepState(n);
            return (
              <View key={n} style={{ flexDirection: 'row', gap: 14, padding: 16, borderBottomWidth: n < 4 ? 1 : 0, borderBottomColor: tint('#EEEFF5') }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: st === 'done' ? c.success : st === 'current' ? c.primary : tint('#EEEFF5'), alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                  <Text style={{ color: st === 'todo' ? c.muted : '#fff', fontSize: 15, fontFamily: fontFor(800) }}>{st === 'done' ? '✓' : n}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 17.5, color: c.text, fontFamily: fontFor(700), letterSpacing: -0.2 }}>{stepTitle[n - 1]}</Text>
                  <Text style={{ fontSize: 14.5, lineHeight: 20, color: c.muted }}>{stepDesc[n - 1]}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {inReview ? <Card tone="soft"><T v="heading">{t('cert2.inReviewTitle')}</T><T v="muted">{t('cert2.inReviewBody')}</T></Card> : null}
      <View style={{ flexDirection: 'row', gap: 12, backgroundColor: tint('#fff'), borderRadius: 20, padding: 16 }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.primary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></Svg>
        <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: c.muted }}>{t('cert2.privacy')}</Text>
      </View>
      {message && message !== t('common.copied') ? <T v="small">{message}</T> : null}
      {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}
    </Screen>
  );
}
