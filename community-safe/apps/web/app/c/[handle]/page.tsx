import type { Metadata } from 'next';
import { formatCount, normalizeHandle, translate, HANDLE_PATTERN, type CreatorProfile, type MessageKey } from '@community-safe/shared';
import { Avatar, Footer, Header } from '@/components/Chrome';
import { getLocale } from '@/lib/locale';
import { anonServerClient } from '@/lib/supabase';
import { FollowPanel } from './FollowPanel';

async function loadCreator(raw: string): Promise<CreatorProfile | null> {
  const handle = normalizeHandle(decodeURIComponent(raw));
  const client = anonServerClient();
  if (!client || !HANDLE_PATTERN.test(handle)) return null;
  const { data } = await client.from('creator_profiles').select('*').eq('handle', handle).maybeSingle();
  return (data as CreatorProfile | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const creator = await loadCreator((await params).handle);
  const locale = await getLocale();
  if (!creator) return { title: 'SaveMyCommunity', robots: { index: false } };
  return {
    title: translate(locale, 'creator.joinTitle', { name: creator.display_name }),
    description: translate(locale, 'creator.joinBody'),
    // Un profil non vérifié ne doit pas être référencé comme page officielle.
    robots: creator.verification_status === 'verified' ? undefined : { index: false },
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const creator = await loadCreator((await params).handle);
  const locale = await getLocale();
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);

  return (
    <>
      <Header />
      <main className="narrow stack" style={{ paddingTop: 24 }}>
        {creator ? (
          <>
            <div className="stack center">
              <Avatar name={creator.display_name} url={creator.avatar_url} size={104} />
              <h2>{creator.display_name}</h2>
              <p className="muted">@{creator.handle} · {t(`category.${creator.category}` as MessageKey)}</p>
              <span className={`pill ${creator.verification_status === 'verified' ? 'primary' : ''}`}>
                {creator.verification_status === 'verified' ? `✓ ${t('creator.verified')}` : t('creator.unverified')}
              </span>
              <p className="small">{t('creator.members', { count: formatCount(locale, creator.member_count) })}</p>
              {creator.bio ? <p>{creator.bio}</p> : null}
            </div>
            {creator.verification_status === 'verified' ? null : <div className="card sos"><p className="muted">{t('creator.unverifiedWarning')}</p></div>}
            <FollowPanel creator={{ id: creator.id, handle: creator.handle, display_name: creator.display_name }} />
          </>
        ) : (
          <p className="muted center" style={{ padding: '64px 0' }}>{t('creator.notFound')}</p>
        )}
      </main>
      <Footer />
    </>
  );
}
