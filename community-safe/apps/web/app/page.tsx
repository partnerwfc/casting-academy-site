import Link from 'next/link';
import { formatCount, translate } from '@community-safe/shared';
import { Footer, Header } from '@/components/Chrome';
import { landingCopy } from '@/lib/landing-copy';
import { getLocale } from '@/lib/locale';
import { anonServerClient } from '@/lib/supabase';

interface Plan { id: string; name: string; price_cents: number | null; currency: string; member_limit: number | null; announcements_per_month: number | null }

// Les tarifs viennent de la base : modifiables depuis l'administration, jamais codés en dur.
async function loadPlans(): Promise<Plan[]> {
  const client = anonServerClient();
  if (!client) return [];
  const { data } = await client.from('plans').select('id, name, price_cents, currency, member_limit, announcements_per_month').order('sort_order');
  return (data ?? []) as Plan[];
}

export default async function Landing() {
  const locale = await getLocale();
  const copy = landingCopy[locale];
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const plans = await loadPlans();

  return (
    <>
      <Header />
      <main className="container stack-lg">
        <section className="hero stack" style={{ maxWidth: 720 }}>
          <span className="eyebrow">Community Safe — {t('app.tagline')}</span>
          <h1>{t('app.promise')}</h1>
          <p className="muted" style={{ fontSize: '1.15rem' }}>{t('welcome.subtitle')}</p>
          <div className="row">
            <Link className="btn" href="/dashboard">{t('welcome.creator')}</Link>
            <a className="btn secondary" href="#how">{copy.how}</a>
          </div>
        </section>

        <section className="card soft stack">
          {copy.story.map((line) => <p key={line} style={{ fontSize: '1.1rem' }}>{line}</p>)}
          <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('app.subPromise')}</p>
        </section>

        <section id="how" className="stack">
          <h2>{copy.how}</h2>
          <div className="grid">
            {copy.steps.map(([title, body], i) => (
              <div className="card" key={title}>
                <span className="pill primary" style={{ alignSelf: 'flex-start' }}>{i + 1}</span>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid">
          {([[copy.fans, copy.fansPoints], [copy.creators, copy.creatorsPoints], [copy.trust, copy.trustPoints]] as const).map(([title, points]) => (
            <div className="card" key={title}>
              <h3>{title}</h3>
              {points.map((p) => <p className="muted" key={p}>✓ {p}</p>)}
            </div>
          ))}
        </section>

        {plans.length ? (
          <section className="stack">
            <h2>{copy.pricing}</h2>
            <div className="grid">
              {plans.map((plan) => (
                <div className="card" key={plan.id}>
                  <h3>{plan.name}</h3>
                  <p className="stat-value">
                    {plan.price_cents === null ? copy.quote
                      : `${new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 }).format(plan.price_cents / 100)} ${copy.perYear}`}
                  </p>
                  {plan.member_limit !== null ? <p className="muted">{copy.upTo.replace('{n}', formatCount(locale, plan.member_limit))}</p> : null}
                  {plan.announcements_per_month !== null ? <p className="muted">{copy.annPerMonth.replace('{n}', String(plan.announcements_per_month))}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="stack center" style={{ padding: '24px 0' }}>
          <h2>{copy.closing}</h2>
          <Link className="btn" href="/dashboard">{t('profile.becomeCreator')}</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
