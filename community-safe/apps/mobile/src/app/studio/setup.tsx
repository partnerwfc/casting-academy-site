import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CATEGORIES, HANDLE_PATTERN, errorMessage, normalizeHandle, type MessageKey } from '@community-safe/shared';
import { Button, Chip, Input, Loading, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

export default function Setup() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator, refreshCreator } = useAuth();
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [category, setCategory] = useState<string>('creator');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio/setup' } }} />;
  if (creator) return <Redirect href="/studio" />;

  const clean = normalizeHandle(handle);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('create_creator_profile', {
      p_handle: clean, p_display_name: name.trim(), p_category: category, p_bio: bio.trim() || null,
    });
    setBusy(false);
    if (err) return setError(errorMessage(locale, err));
    await refreshCreator();
    router.replace('/studio');
  };

  return (
    <Screen>
      <T v="muted">{t('app.subPromise')}</T>
      <Input label={t('setup.displayName')} value={name} onChangeText={setName} maxLength={60} />
      <View style={{ gap: 4 }}>
        <Input label={t('setup.handle')} value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} maxLength={31} placeholder="@" />
        <T v="small">{clean ? `savemycommunity.com/@${clean} · ` : ''}{t('setup.handleHint')}</T>
      </View>
      <View style={{ gap: space.sm }}>
        <T v="small" style={{ fontWeight: '600', color: c.text }}>{t('setup.category')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {CATEGORIES.map((cat) => <Chip key={cat} label={t(`category.${cat}` as MessageKey)} selected={category === cat} onPress={() => setCategory(cat)} />)}
        </View>
      </View>
      <Input label={t('setup.bio')} value={bio} onChangeText={setBio} multiline maxLength={300} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      {error ? <T v="small" style={{ color: c.sos }}>{error}</T> : null}
      <Button label={t('setup.create')} onPress={submit} loading={busy} disabled={!HANDLE_PATTERN.test(clean) || !name.trim()} />
    </Screen>
  );
}
