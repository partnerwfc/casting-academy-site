import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { errorMessage, type MessageKey } from '@community-safe/shared';
import { Avatar, Button, Chip, Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { changeAvatar } from '@/lib/avatar';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { fontFor, useColors } from '@/lib/theme';

const CATEGORIES = ['creator', 'artist', 'brand', 'company', 'nonprofit', 'media'] as const;

function Field({ label, last, counter, ...rest }: TextInputProps & { label: string; last?: boolean; counter?: string }) {
  const c = useColors();
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, color: c.muted, fontFamily: fontFor(700) }}>{label}</Text>
        {counter ? <Text style={{ fontSize: 13, color: c.muted }}>{counter}</Text> : null}
      </View>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} {...rest}
        style={{ fontSize: 17, color: c.text, fontFamily: 'Inter_400Regular', paddingVertical: 2, minHeight: rest.multiline ? 64 : undefined, textAlignVertical: rest.multiline ? 'top' : 'center' }} />
    </View>
  );
}

// « Modifier » : photo de profil, nom, description, catégorie. Le pseudo (lien) ne change pas.
export default function EditCommunity() {
  const { t, locale } = useI18n();
  const c = useColors();
  const { session, loading, creator, refreshCreator } = useAuth();
  const [name, setName] = useState(creator?.display_name ?? '');
  const [bio, setBio] = useState(creator?.bio ?? '');
  const [category, setCategory] = useState(creator?.category ?? 'creator');
  const [avatar, setAvatar] = useState<string | null>(creator?.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (!session || !creator) return <Redirect href="/(tabs)/profile" />;

  const pick = async () => {
    setError(null);
    try { const url = await changeAvatar(session.user.id, creator.id, avatar); if (url) { setAvatar(url); await refreshCreator(); } }
    catch (e) { setError(errorMessage(locale, e)); }
  };
  const save = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('creator_profiles').update({ display_name: name.trim(), bio: bio.trim() || null, category }).eq('id', creator.id);
    setBusy(false);
    if (err) return setError(errorMessage(locale, err));
    await refreshCreator();
    router.back();
  };
  return (
    <Screen nav={{ back: t('common.cancel'), noChevron: true, title: t('edit.title') }}
      footer={<>{error ? <Text style={{ color: c.sos, fontSize: 13.5 }}>{error}</Text> : null}<Button label={t('edit.save')} onPress={save} loading={busy} disabled={!name.trim()} /></>}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('edit.photo')} onPress={pick}>
          <Avatar name={name || creator.display_name} url={avatar} size={96} />
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, borderWidth: 3, borderColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx="12" cy="13" r="3.2" /></Svg>
          </View>
        </Pressable>
        <Pressable onPress={pick}><Text style={{ color: c.primary, fontSize: 16, fontFamily: fontFor(700) }}>{t('edit.photo')}</Text></Pressable>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 18 }}>
        <Field label={t('setup.displayName')} value={name} onChangeText={setName} maxLength={60} />
        <Field label={t('setup.bio')} value={bio} onChangeText={setBio} multiline maxLength={120} last counter={`${bio.length}/120`} placeholder={t('setup.bioPlaceholder')} />
      </View>
      <View style={{ gap: 10 }}>
        <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase', marginLeft: 6 }}>{t('setup.category')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATEGORIES.map((cat) => <Chip key={cat} label={t(`category.${cat}` as MessageKey)} tone="dark" fill selected={category === cat} onPress={() => setCategory(cat)} />)}
        </View>
      </View>
    </Screen>
  );
}
