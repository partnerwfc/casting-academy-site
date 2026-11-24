import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const MARKER = '/storage/v1/object/public/avatars/';

/** Choisit une photo carrée, l'envoie dans le dossier du propriétaire, met à jour le profil et supprime l'ancienne. */
export async function changeAvatar(userId: string, creatorId: string, previousUrl: string | null): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (r.canceled || !r.assets[0]) return null;
  const buffer = await (await fetch(r.assets[0].uri)).arrayBuffer();
  const path = `${userId}/logo-${Date.now()}.jpg`;
  const up = await supabase.storage.from('avatars').upload(path, buffer, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from('creator_profiles').update({ avatar_url: url }).eq('id', creatorId);
  if (error) throw error;
  if (previousUrl?.includes(MARKER)) await supabase.storage.from('avatars').remove([previousUrl.split(MARKER)[1]]).catch(() => {});
  return url;
}
