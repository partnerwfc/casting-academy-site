import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { HANDLE_PATTERN, errorMessage, normalizeHandle, type MessageKey } from '@community-safe/shared';
import { Button, Chip, Loading, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { fontFor, space, useColors } from '@/lib/theme';

function Field({ label, last, counter, style, ...rest }: TextInputProps & { label: string; last?: boolean; counter?: string }) {
  const c = useColors();
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="small" style={{ fontWeight: '700' }}>{label}</T>
        {counter ? <T v="small">{counter}</T> : null}
      </View>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} {...rest}
        style={[{ fontSize: 17, color: c.text, fontFamily: 'Inter_400Regular', paddingVertical: 2, minHeight: rest.multiline ? 64 : undefined, textAlignVertical: rest.multiline ? 'top' : 'center' }, style]} />
    </View>
  );
}

const SETUP_CATEGORIES = ['creator', 'artist', 'brand', 'company', 'nonprofit', 'media'] as const;

export default function Setup() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator, refreshCreator } = useAuth();
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [category, setCategory] = useState<string>('creator');
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: '/studio/setup' } }} />;
  if (creator) return <Redirect href="/studio" />;

  const pickLogo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets[0]) { setLogo(r.assets[0].uri); setLogoUri(r.assets[0].uri); }
  };
  const clean = normalizeHandle(handle);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('create_creator_profile', {
      p_handle: clean, p_display_name: name.trim(), p_category: category, p_bio: bio.trim() || null,
    });
    setBusy(false);
    if (err) return setError(errorMessage(locale, err));
    if (logoUri) {
      try {
        const buffer = await (await fetch(logoUri)).arrayBuffer();
        const path = `${session.user.id}/logo-${Date.now()}.jpg`;
        const up = await supabase.storage.from('avatars').upload(path, buffer, { contentType: 'image/jpeg' });
        if (!up.error) await supabase.from('creator_profiles').update({ avatar_url: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl }).eq('owner_user_id', session.user.id);
      } catch { /* le logo se change plus tard : la création a réussi */ }
    }
    await refreshCreator();
    router.replace('/studio');
  };

  return (
    <Screen nav={{ back: t('common.cancel'), noChevron: true, title: t('setup.navTitle') }}
      footer={<>
        {error ? <Text style={{ color: c.sos, fontSize: 13.5 }}>{error}</Text> : null}
        <Button label={t('setup.create')} onPress={submit} loading={busy} disabled={!HANDLE_PATTERN.test(clean) || !name.trim()} />
      </>}>
      <Text style={{ fontSize: 31, lineHeight: 36, color: c.text, fontFamily: fontFor(800), letterSpacing: -0.9 }}>{t('setup.headline')}</Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: c.muted, marginTop: -6, paddingRight: 30 }}>{t('setup.sub')}</Text>
      <View style={{ alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('setup.logo')} onPress={pickLogo}
          style={{ width: 92, height: 92, borderRadius: 26, borderWidth: logo ? 0 : 2, borderStyle: 'dashed', borderColor: '#C9CCD8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 92, height: 92 }} /> : (
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c.primary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx="12" cy="13" r="3.2" /></Svg>
              <Text style={{ color: c.primary, fontSize: 13.5, fontFamily: fontFor(700) }}>{t('setup.logo')}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 18 }}>
        <Field label={t('setup.displayName')} value={name} onChangeText={setName} maxLength={60} placeholder={t('setup.namePlaceholder')} />
        <Field label={t('setup.handle')} value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} maxLength={31} placeholder="@icastt" />
        <Field label={t('setup.bio')} value={bio} onChangeText={setBio} multiline maxLength={120} last counter={`${bio.length}/120`} placeholder={t('setup.bioPlaceholder')} />
      </View>
      <Text style={{ fontSize: 13.5, color: c.muted, marginTop: -8, marginLeft: 6 }}>{t('setup.linkNote', { handle: clean || t('setup.yourHandle') })}</Text>
      <View style={{ gap: 10 }}>
        <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase', marginLeft: 6 }}>{t('setup.category')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {SETUP_CATEGORIES.map((cat) => <Chip key={cat} label={t(`category.${cat}` as MessageKey)} tone="dark" fill selected={category === cat} onPress={() => setCategory(cat)} />)}
        </View>
      </View>
    </Screen>
  );
}
