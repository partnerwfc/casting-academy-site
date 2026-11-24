import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Interrupteur « sécurité » (app_settings.security_gate) : "off" masque la certification et la ré-authentification
// renforcée pendant la phase de démarrage. Par défaut (chargement, erreur) : règles complètes affichées.
let cache: boolean | null = null;
const waiters: ((v: boolean) => void)[] = [];

export function useSecurityGate(): boolean {
  const [on, setOn] = useState<boolean>(cache ?? true);
  useEffect(() => {
    if (cache !== null) return setOn(cache);
    waiters.push(setOn);
    if (waiters.length > 1) return;
    supabase.from('app_settings').select('value').eq('key', 'security_gate').maybeSingle().then(({ data }) => {
      cache = !(data && String(data.value).replace(/"/g, '') === 'off');
      waiters.splice(0).forEach((w) => w(cache as boolean));
    });
  }, []);
  return on;
}
