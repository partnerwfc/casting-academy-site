'use client';

import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

// Pas d'e-mail ni de mot de passe : connexion avec Google. (Apple pour le web : à ajouter une fois le service configuré.)
export function AuthForm() {
  const { t } = useI18n();
  const google = () => supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
  return (
    <div className="stack">
      <button type="button" className="btn block" onClick={google}>{t('auth.google')}</button>
      <p className="small">{t('auth.legal')}</p>
    </div>
  );
}
