'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// app_settings.security_gate : "off" masque la certification pendant la phase de démarrage (règles complètes par défaut).
export function useSecurityGate(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    supabase().from('app_settings').select('value').eq('key', 'security_gate').maybeSingle()
      .then(({ data }) => setOn(!(data && String(data.value).replace(/"/g, '') === 'off')));
  }, []);
  return on;
}
