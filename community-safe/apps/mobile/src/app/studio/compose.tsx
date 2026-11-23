import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SOS_REASONS, checkLink, errorMessage, type Alert, type SosReason } from '@community-safe/shared';
import { NotificationPreview } from '@/components/NotificationPreview';
import { Button, Card, Chip, Input, Screen, SwitchRow, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { signInWith, type Provider } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

type Step = 'reason' | 'message' | 'preview' | 'confirm';

export default function Compose() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === 'announcement' ? 'announcement' : 'sos';
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, creator } = useAuth();
  const [step, setStep] = useState<Step>(kind === 'sos' ? 'reason' : 'message');
  const [reason, setReason] = useState<SosReason | null>(null);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [maxLength, setMaxLength] = useState(280);
  const [checkedMessage, setCheckedMessage] = useState(false);
  const [checkedLink, setCheckedLink] = useState(false);
  const [hasTotp, setHasTotp] = useState(false);
  const [code, setCode] = useState('');
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Une seule clé par rédaction : un double appui ou un nouvel essai n'envoie jamais deux alertes.
  const idempotencyKey = useRef(Crypto.randomUUID());

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'alert_message_max_length').maybeSingle()
      .then(({ data }) => { if (typeof data?.value === 'number') setMaxLength(data.value); });
    supabase.rpc('has_strong_recent_auth').then(({ data }) => setFresh(data === true));
    supabase.rpc('has_totp_factor').then(({ data }) => setHasTotp(data === true));
  }, []);

  if (!creator || !session) return null;
  const trimmedLink = link.trim();
  const linkError = trimmedLink ? checkLink(trimmedLink) : null;
  const steps: Step[] = kind === 'sos' ? ['reason', 'message', 'preview', 'confirm'] : ['message', 'preview', 'confirm'];
  const index = steps.indexOf(step);

  const fail = (e: unknown) => setError(errorMessage(locale, e));

  // Vérification renforcée sans e-mail : application d'authentification si elle est activée, sinon nouvelle connexion Apple/Google.
  const provider = (session.user.app_metadata?.provider === 'apple' ? 'apple' : 'google') as Provider;
  const reauth = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWith(provider);
      const { data } = await supabase.rpc('has_strong_recent_auth');
      if (data === true) setFresh(true);
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const verifyTotp = async () => {
    setBusy(true);
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === 'verified');
    const { error: err } = factor ? await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() }) : { error: new Error('no_factor') };
    setBusy(false);
    if (err) return fail('invalid_code');
    setFresh(true);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('create_alert', {
      p_kind: kind, p_message: message.trim(), p_idempotency_key: idempotencyKey.current,
      p_reason: kind === 'sos' ? reason : null, p_link_url: trimmedLink || null,
    });
    if (err) {
      setBusy(false);
      if (err.message === 'stepup_required') { setFresh(false); setCode(''); }
      return fail(err);
    }
    // Réveille le worker tout de suite ; s'il échoue, la planification serveur prend le relais.
    supabase.functions.invoke('dispatch-alerts', { body: {} }).catch(() => {});
    setBusy(false);
    router.replace(`/studio/alert/${(data as Alert).id}`);
  };

  return (
    <Screen nav={{ back: t('common.back'), title: t(kind === 'sos' ? 'compose.sosTitle' : 'compose.announceTitle') }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {steps.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? (kind === 'sos' ? c.sos : c.primary) : c.border }} />)}
      </View>

      {step === 'reason' ? (
        <>
          <T v="title">{t('compose.reason')}</T>
          <View style={{ gap: space.sm }}>
            {SOS_REASONS.map((r) => <Chip key={r} label={t(`reason.${r}`)} selected={reason === r} onPress={() => setReason(r)} />)}
          </View>
          <Button label={t('common.continue')} onPress={() => setStep('message')} disabled={!reason} />
        </>
      ) : null}

      {step === 'message' ? (
        <>
          <View style={{ gap: 4 }}>
            <Input label={t('compose.message')} value={message} onChangeText={setMessage} multiline maxLength={maxLength}
              placeholder={t('compose.messagePlaceholder')} style={{ minHeight: 120, textAlignVertical: 'top' }} autoFocus />
            <T v="small" style={{ textAlign: 'right' }}>{message.length} / {maxLength}</T>
          </View>
          <View style={{ gap: 4 }}>
            <Input label={t('compose.link')} value={link} onChangeText={setLink} placeholder={t('compose.linkPlaceholder')}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            {linkError ? <T v="small" style={{ color: c.sos }}>{t(`errors.${linkError}`)}</T> : null}
          </View>
          <Button label={t('common.continue')} onPress={() => setStep('preview')} disabled={!message.trim() || !!linkError} />
        </>
      ) : null}

      {step === 'preview' ? (
        <>
          <T v="title">{t('compose.preview')}</T>
          <NotificationPreview kind={kind} creatorName={creator.display_name} message={message.trim()} />
          <T v="small">{t('compose.previewHint')}</T>
          {trimmedLink ? <Card><T v="small">{t('compose.link')}</T><T v="body">{trimmedLink}</T></Card> : null}
          <Button label={t('common.continue')} onPress={() => setStep('confirm')} />
        </>
      ) : null}

      {step === 'confirm' ? (
        <>
          <T v="title">{t('compose.confirmTitle')}</T>
          <Card>
            <SwitchRow title={t('compose.confirmMessage')} value={checkedMessage} onChange={setCheckedMessage} />
            {trimmedLink ? <SwitchRow title={t('compose.confirmLink')} desc={trimmedLink} value={checkedLink} onChange={setCheckedLink} /> : null}
          </Card>
          {fresh ? null : (
            <Card tone="soft">
              <T v="muted">{t('compose.stepup')}</T>
              {hasTotp ? (
                <>
                  <T v="small">{t('compose.stepupTotp')}</T>
                  <Input value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder={t('auth.codePlaceholder')} />
                  <Button label={t('auth.verify')} onPress={verifyTotp} loading={busy} disabled={code.trim().length < 6} />
                </>
              ) : <Button label={t('compose.reauth', { provider: provider === 'apple' ? 'Apple' : 'Google' })} kind="secondary" onPress={reauth} loading={busy} />}
            </Card>
          )}
          <T v="small">{t('compose.recipients')} {t('compose.noGuarantee')}</T>
          {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}
          <Button label={t('compose.send')} kind={kind === 'sos' ? 'sos' : 'primary'} onPress={send} loading={busy && fresh}
            disabled={!fresh || !checkedMessage || (!!trimmedLink && !checkedLink)} />
        </>
      ) : null}

      {index > 0 ? <Button label={t('common.back')} kind="ghost" onPress={() => setStep(steps[index - 1])} /> : null}
    </Screen>
  );
}
