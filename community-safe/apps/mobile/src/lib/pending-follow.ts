import AsyncStorage from '@react-native-async-storage/async-storage';

// Mémorise l'intention « suivre @x » pendant l'inscription, puis l'exécute une seule fois.
const KEY = 'cs-pending-follow';
export interface PendingFollow { handle: string; source?: string }

export const setPendingFollow = (p: PendingFollow) => AsyncStorage.setItem(KEY, JSON.stringify(p));

export async function takePendingFollow(): Promise<PendingFollow | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(KEY);
  try { return JSON.parse(raw) as PendingFollow; } catch { return null; }
}
