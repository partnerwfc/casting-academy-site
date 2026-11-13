import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SOCIAL_PLATFORMS, errorMessage, type MessageKey } from '@community-safe/shared';
import { Button, Card, Chip, Input, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

const METHODS = ['social_control', 'email_domain', 'domain', 'document'] as const;
interface Social { id: string; platform: string; handle: string }

export default function Verify() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { creator, refreshCreator } = useAuth();
  const [method, setMethod] = useState<(typeof METHODS)[number]>('social_control');
  const [evidence, setEvidence] = useState('');
  const [socials, setSocials] = useState<Social[]>([]);
  const [platform, setPlatform] = useState<string>('instagram');
  const [socialHandle, setSocialHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creatorId = creator?.id;

  const loadSocials = () => {
    if (!creatorId) return;
    supabase.from('social_accounts').select('id, platform, handle').eq('creator_id', creatorId)
      .then(({ data }) => setSocials((data ?? []) as Social[]));
  };
  useEffect(loadSocials, [creatorId]);

  const addSocial = async () => {
    await supabase.from('social_accounts').insert({ creator_id: creatorId, platform, handle: socialHandle.trim().replace(/^@/, '') });
    setSocialHandle('');
    loadSocials();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('request_verification', {
      p_method: method, p_evidence: { note: evidence.trim(), socials: socials.map((s) => `${s.platform}:${s.handle}`) },
    });
    setBusy(false);
    if (err) return setError(errorMessage(locale, err));
    await refreshCreator();
    router.back();
  };

  return (
    <Screen>
      <Card>
        <T v="heading">{t('setup.socials')}</T>
        {socials.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T v="body" style={{ flex: 1 }}>{s.platform} · @{s.handle}</T>
            <Button label="✕" kind="ghost" style={{ minHeight: 32 }}
              onPress={async () => { await supabase.from('social_accounts').delete().eq('id', s.id); loadSocials(); }} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {SOCIAL_PLATFORMS.slice(0, 6).map((p) => <Chip key={p} label={p} selected={platform === p} onPress={() => setPlatform(p)} />)}
        </View>
        <Input value={socialHandle} onChangeText={setSocialHandle} placeholder="@" autoCapitalize="none" autoCorrect={false} />
        <Button label={t('setup.addSocial')} kind="secondary" onPress={addSocial} disabled={!socialHandle.trim()} />
      </Card>

      <View style={{ gap: space.sm }}>
        {METHODS.map((m) => <Chip key={m} label={t(`verify.method.${m}` as MessageKey)} selected={method === m} onPress={() => setMethod(m)} />)}
      </View>
      {method === 'social_control' ? <T v="small">{t('verify.socialHint')}</T> : null}
      <Input label={t('verify.evidence')} value={evidence} onChangeText={setEvidence} multiline maxLength={500} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}
      <Button label={t('verify.submit')} onPress={submit} loading={busy} disabled={!evidence.trim() && !socials.length} />
    </Screen>
  );
}
