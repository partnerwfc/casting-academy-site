'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NotificationPreferences } from '@community-safe/shared';
import { AuthForm } from '@/components/AuthForm';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

const PENDING = 'cs-pending-follow';
const APP_STORE = process.env.NEXT_PUBLIC_APP_STORE_URL;
const PLAY_STORE = process.env.NEXT_PUBLIC_PLAY_STORE_URL;

export function FollowPanel({ creator }: { creator: { id: string; handle: string; display_name: string } }) {
  const { t } = useI18n();
  const session = useSession();
  const [prefs, setPrefs] = useState<NotificationPreferences | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = session?.user.id;

  const source = () => new URLSearchParams(window.location.search).get('s');

  const loadPrefs = useCallback(async () => {
    if (!userId) return setPrefs(null);
    const { data } = await supabase().from('notification_preferences').select('*')
      .eq('creator_id', creator.id).eq('user_id', userId).maybeSingle();
    setPrefs((data as NotificationPreferences | null) ?? null);
  }, [creator.id, userId]);

  const follow = useCallback(async () => {
    setBusy(true);
    await supabase().rpc('follow_creator', { p_handle: creator.handle, p_source: source() });
    sessionStorage.removeItem(PENDING);
    await loadPrefs();
    setBusy(false);
  }, [creator.handle, loadPrefs]);

  // Clic comptabilisé une fois par visite (compteur anonyme, sans cookie).
  useEffect(() => {
    const key = `cs-click-${creator.handle}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    supabase().rpc('record_link_click', { p_handle: creator.handle, p_source: source() }).then(() => {});
  }, [creator.handle]);

  // Après connexion : on exécute le suivi que l'utilisateur avait explicitement demandé.
  useEffect(() => {
    if (session === undefined) return;
    if (session && sessionStorage.getItem(PENDING) === creator.handle) follow();
    else loadPrefs();
  }, [session, creator.handle, follow, loadPrefs]);

  const onFollowClick = () => {
    if (session) return follow();
    sessionStorage.setItem(PENDING, creator.handle); // survit à l'aller-retour Google
    setAsking(true);
  };

  const update = async (sos: boolean, announcements: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, sos_enabled: sos, announcements_enabled: announcements });
    await supabase().rpc('set_notification_preferences', { p_creator_id: creator.id, p_sos: sos, p_announcements: announcements });
  };

  const unfollow = async () => {
    if (!confirm(t('creator.unfollowConfirm', { name: creator.display_name }))) return;
    await supabase().from('community_memberships').delete().eq('creator_id', creator.id).eq('user_id', userId!);
    loadPrefs();
  };

  if (session === undefined || (session && prefs === undefined)) return <p className="small center">{t('common.loading')}</p>;

  if (prefs) {
    return (
      <div className="stack">
        <div className="card soft">
          <h3>✓ {t('creator.following')}</h3>
          <p className="muted">{t('creator.followedWeb', { name: creator.display_name })}</p>
          <div className="row">
            <a className="btn sm" href={`communitysafe://creator/${creator.handle}`}>Community Safe ↗</a>
            {APP_STORE ? <a className="btn sm secondary" href={APP_STORE}>App Store</a> : null}
            {PLAY_STORE ? <a className="btn sm secondary" href={PLAY_STORE}>Google Play</a> : null}
          </div>
        </div>
        <div className="card">
          <span className="eyebrow">{t('prefs.title')}</span>
          <label className="row between" style={{ flexWrap: 'nowrap' }}>
            <span><strong>{t('prefs.sos')}</strong><br /><span className="small">{t('prefs.sosDesc')}</span></span>
            <input type="checkbox" checked={prefs.sos_enabled} onChange={(e) => update(e.target.checked, prefs.announcements_enabled)} />
          </label>
          <label className="row between" style={{ flexWrap: 'nowrap' }}>
            <span><strong>{t('prefs.announcements')}</strong><br /><span className="small">{t('prefs.announcementsDesc')}</span></span>
            <input type="checkbox" checked={prefs.announcements_enabled} onChange={(e) => update(prefs.sos_enabled, e.target.checked)} />
          </label>
        </div>
        <button className="btn ghost" onClick={unfollow}>{t('creator.unfollow')}</button>
      </div>
    );
  }

  return (
    <div className="stack">
      {asking && !session ? (
        <div className="card">
          <p className="muted">{t('auth.followIntent', { name: creator.display_name })}</p>
          <AuthForm />
        </div>
      ) : (
        <>
          <button className="btn block" onClick={onFollowClick} disabled={busy}>{t('creator.follow')}</button>
          <p className="small center">{t('creator.joinBody')}</p>
        </>
      )}
    </div>
  );
}
