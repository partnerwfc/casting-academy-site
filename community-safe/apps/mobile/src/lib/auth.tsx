import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CreatorProfile } from '@community-safe/shared';
import { takePendingFollow } from './pending-follow';
import { syncDevice, unregisterDevice } from './push';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  creator: CreatorProfile | null;
  refreshCreator: () => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>({
  session: null, loading: true, creator: null, refreshCreator: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshCreator = useCallback(async () => {
    if (!userId) return setCreator(null);
    const { data } = await supabase.from('creator_profiles').select('*').eq('owner_user_id', userId).maybeSingle();
    setCreator((data as CreatorProfile | null) ?? null);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCreator(null);
      return;
    }
    (async () => {
      // Suivi demandé avant l'inscription (lien d'un créateur) : on l'exécute maintenant.
      const pending = await takePendingFollow();
      if (pending) await supabase.rpc('follow_creator', { p_handle: pending.handle, p_source: pending.source ?? null });
      await syncDevice(false); // met à jour le jeton sans afficher de demande système
      await refreshCreator();
    })();
  }, [userId, refreshCreator]);

  const signOut = useCallback(async () => {
    await unregisterDevice(); // cet appareil ne doit plus recevoir les alertes du compte
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, loading, creator, refreshCreator, signOut }),
    [session, loading, creator, refreshCreator, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
