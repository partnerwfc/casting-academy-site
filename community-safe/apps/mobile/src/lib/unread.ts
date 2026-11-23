import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './auth';
import { supabase } from './supabase';

// Nombre d'alertes reçues non ouvertes (pastille rouge de la cloche).
export function useUnreadCount(): number {
  const { session } = useAuth();
  const [n, setN] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!session) return setN(0);
    supabase.from('alert_recipients').select('alert_id', { count: 'exact', head: true }).eq('user_id', session.user.id).is('opened_at', null)
      .then(({ count }) => setN(count ?? 0));
  }, [session]));
  return n;
}
