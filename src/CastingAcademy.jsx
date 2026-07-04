import React, { useEffect, useRef, useState } from 'react';

const BOOK_URL = 'https://www.icastt.com/events/porte-ouverte-casting-academy/book';

// ── Logo Casting/Academy — SVG inline ─────────────────────────────────────────
function CastingAcademyLogo({ height = 56, color = '#ffffff' }) {
  return (
    <svg viewBox="0 0 560 72" height={height} style={{ width: 'auto', display: 'block', overflow: 'visible' }} aria-label="Casting Academy">
      <text x="0" y="62" fontFamily="'Cormorant Garamond', Didot, 'Bodoni MT', Georgia, serif" fontSize="68" fontWeight="700" fontStyle="italic" fill={color} letterSpacing="-1">Casting</text>
      <text x="277" y="62" fontFamily="'Cormorant Garamond', Didot, 'Bodoni MT', Georgia, serif" fontSize="68" fontWeight="300" fill={color} letterSpacing="-1">/Academy</text>
    </svg>
  );
}

function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = '', style = {} }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(40px)', transition: `opacity 0.9s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.9s cubic-bezier(.16,1,.3,1) ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

function RevealLeft({ children, delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-50px)', transition: `opacity 1s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 1s cubic-bezier(.16,1,.3,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

function FaqItem({ q, a, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(p => !p)} style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', padding: '28px 0', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.3)', fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: 2, minWidth: 24, paddingTop: 3 }}>0{index + 1}</span>
          <p style={{ fontWeight: 400, color: '#fff', fontSize: 16, margin: 0, fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: 0.3, lineHeight: 1.5 }}>{q}</p>
        </div>
        <span style={{ color: '#fff', fontSize: 22, flexShrink: 0, transition: 'transform 0.4s cubic-bezier(.16,1,.3,1)', transform: open ? 'rotate(45deg)' : 'none', fontWeight: 200, lineHeight: 1 }}>+</span>
      </div>
      <div style={{ overflow: 'hidden', maxHeight: open ? 400 : 0, transition: 'max-height 0.5s cubic-bezier(.16,1,.3,1)' }}>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: '20px 0 0 48px', lineHeight: 1.9, fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 0.3 }}>{a}</p>
      </div>
    </div>
  );
}

export default function CastingAcademy() {
  const [scrolled, setScrolled] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setHeroLoaded(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ background: '#000', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .ca-label { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.45); }
        .ca-serif-h1 { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(52px, 10vw, 120px); font-weight: 700; line-height: 0.95; letter-spacing: -2px; color: #fff; }
        .ca-serif-h2 { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(36px, 6vw, 72px); font-weight: 700; line-height: 1.0; letter-spacing: -1px; color: #fff; }
        .ca-serif-h3 { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(22px, 3vw, 36px); font-weight: 600; letter-spacing: -0.3px; color: #fff; }
        .ca-body { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(16px, 2vw, 20px); font-weight: 300; line-height: 1.85; color: rgba(255,255,255,0.65); letter-spacing: 0.2px; }
        .ca-btn-primary { display: inline-flex; align-items: center; gap: 10px; background: #fff; color: #000; border: none; padding: 18px 40px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: background 0.3s, color 0.3s; }
        .ca-btn-primary:hover { background: #f0f0f0; }
        .ca-btn-ghost { display: inline-flex; align-items: center; gap: 10px; background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.3); padding: 17px 36px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: border-color 0.3s, background 0.3s; }
        .ca-btn-ghost:hover { border-color: #fff; background: rgba(255,255,255,0.05); }
        .ca-hairline { background: rgba(255,255,255,0.12); height: 1px; width: 100%; }
        .ca-info-row { display: grid; grid-template-columns: 160px 1fr; gap: 24px; padding: 24px 0; border-bottom: 1px solid rgba(255,255,255,0.08); align-items: start; }
        .ca-sticky-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 90; background: rgba(0,0,0,0.95); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.1); padding: 12px 40px; display: flex; justify-content: space-between; align-items: center; transform: translateY(-100%); transition: transform 0.4s cubic-bezier(.16,1,.3,1); }
        .ca-sticky-bar.visible { transform: translateY(0); }
        @keyframes ca-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ca-ticker-track { display: flex; white-space: nowrap; animation: ca-ticker 20s linear infinite; }
        .ca-video-portrait { position: relative; width: 100%; aspect-ratio: 9/16; max-width: 380px; overflow: hidden; background: #111; }
        @media (max-width: 768px) {
          .ca-hero-text { padding: 0 24px !important; }
          .ca-grid-2col { grid-template-columns: 1fr !important; gap: 48px !important; }
          .ca-grid-3col { grid-template-columns: 1fr !important; }
          .ca-info-row { grid-template-columns: 1fr !important; gap: 8px !important; }
          .ca-sticky-bar { padding: 12px 20px !important; }
          .ca-sticky-bar .sticky-label { display: none; }
          .ca-section-pad { padding: 80px 24px !important; }
          .ca-hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .ca-hero-btns a { text-align: center; justify-content: center !important; }
          .ca-video-portrait { max-width: 100%; }
        }
        @media (max-width: 480px) {
          .ca-serif-h1 { font-size: 44px !important; letter-spacing: -1px !important; }
          .ca-section-pad { padding: 60px 20px !important; }
        }
      `}</style>

      {/* Sticky Bar */}
      <div className={`ca-sticky-bar${scrolled ? ' visible' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <CastingAcademyLogo height={22} color="rgba(255,255,255,0.85)" />
          <span className="sticky-label" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>Prochaine Porte Ouverte — Gratuit</span>
        </div>
        <a href={BOOK_URL} className="ca-btn-primary" style={{ padding: '10px 24px', fontSize: 11 }}>Réserver →</a>
      </div>

      {/* HERO */}
      <section style={{ position: 'relative', height: '100vh', minHeight: 600, overflow: 'hidden', background: '#000' }}>
        <video autoPlay muted loop playsInline src="/video-hero.mp4" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,1) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, transparent 50%)' }} />
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3, opacity: heroLoaded ? 1 : 0, transform: heroLoaded ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.96)', transition: 'opacity 1.6s ease 0.3s, transform 1.6s cubic-bezier(.16,1,.3,1) 0.3s' }}>
          <CastingAcademyLogo height={56} color="rgba(255,255,255,0.92)" />
        </div>
        <div className="ca-hero-text" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 60px 72px', opacity: heroLoaded ? 1 : 0, transform: heroLoaded ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 1.2s ease 0.6s, transform 1.2s cubic-bezier(.16,1,.3,1) 0.6s' }}>
          <div className="ca-label" style={{ marginBottom: 20 }}>École de Casting · Paris · Île-de-France</div>
          <h1 className="ca-serif-h1" style={{ margin: '0 0 8px', maxWidth: 900 }}>La Casting<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>Academy</em></h1>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(16px, 2vw, 22px)', fontWeight: 300, color: 'rgba(255,255,255,0.7)', margin: '20px 0 36px', maxWidth: 540, lineHeight: 1.6, letterSpacing: 0.3 }}>
            L'école qui transforme votre présence en opportunités concrètes — castings, défilés, shootings et scène.
          </p>
          <div className="ca-hero-btns" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <a href={BOOK_URL} className="ca-btn-primary">Porte Ouverte Gratuite →</a>
            <a href="#programme" className="ca-btn-ghost">Découvrir le programme</a>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 32, right: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: heroLoaded ? 0.4 : 0, transition: 'opacity 1s ease 1.5s' }}>
          <span style={{ fontSize: 9, letterSpacing: 3, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>Scroll</span>
          <div style={{ width: 1, height: 48, background: 'rgba(255,255,255,0.4)' }} />
        </div>
      </section>

      {/* TICKER */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '14px 0', overflow: 'hidden', background: '#000' }}>
        <div className="ca-ticker-track">
          {Array(4).fill(['CASTING ACADEMY', 'DÉFILÉS', 'PARIS', 'CATWALK', 'CASTINGS', 'SHOOTINGS', 'SCÈNE', 'PERSONAL BRANDING', 'ISSY-LES-MOULINEAUX']).flat().map((item, i) => (
            <span key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', paddingRight: 48 }}>
              {item} <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: 48 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section className="ca-section-pad" style={{ padding: '100px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.08)' }}>
            {[
              { num: '87 000', label: 'emplois générés\npar les industries créatives', source: 'BMO France Travail 2025' },
              { num: '1 seule', label: 'académie dédiée au\ncasting pro en Île-de-France', source: 'Et vous y êtes' },
              { num: '100+', label: 'fashion weeks\nde l\'équipe pédagogique', source: 'Expérience terrain' },
            ].map(({ num, label, source }, i) => (
              <Reveal key={num} delay={i * 100}>
                <div style={{ background: '#000', padding: '48px 40px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 700, color: '#fff', margin: '0 0 12px', letterSpacing: -1 }}>{num}</p>
                  <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{label}</p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', margin: 0 }}>{source}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* VIDEO SHOWCASE */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="ca-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <Reveal>
              <div className="ca-video-portrait" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <video autoPlay muted loop playsInline src="/video-academy.mp4" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.8) 100%)' }} />
                <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Casting Academy · Atelier</span>
                </div>
              </div>
            </Reveal>
            <RevealLeft delay={200}>
              <div>
                <div className="ca-label" style={{ marginBottom: 28 }}>Ce que nous faisons</div>
                <h2 className="ca-serif-h2" style={{ margin: '0 0 32px' }}>Devenez<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>incontournable</em></h2>
                <p className="ca-body" style={{ marginBottom: 24 }}>La Casting Academy n'est pas un cours en ligne — c'est une salle, des coachs, des caméras et des participants comme vous qui veulent vraiment percer.</p>
                <p className="ca-body" style={{ marginBottom: 40 }}>Chaque vendredi soir au Nida (Issy-les-Moulineaux), nos coachs professionnels en activité vous transmettent les techniques qui font la différence lors des vrais castings.</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <a href={BOOK_URL} className="ca-btn-primary">Porte Ouverte →</a>
                  <a href="#programme" className="ca-btn-ghost">Programme</a>
                </div>
              </div>
            </RevealLeft>
          </div>
        </div>
      </section>

      {/* PROGRAMME */}
      <section id="programme" className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 80 }}>
              <div className="ca-label" style={{ marginBottom: 20 }}>Le Programme</div>
              <h2 className="ca-serif-h2">3 piliers pour<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>devenir incontournable</em></h2>
            </div>
          </Reveal>
          <div className="ca-grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(255,255,255,0.08)' }}>
            {[
              { num: '01', title: 'Jeu &\nPrésence', desc: 'Travail du texte, présence caméra, sincérité. Les fondamentaux pour le casting fiction, publicité et scène. Apprenez à captiver dès les premières secondes.' },
              { num: '02', title: 'Catwalk &\nDéfilé', desc: 'Technique du podium, port, allure et maîtrise de soi. Coaché par un ancien mannequin professionnel ayant défilé sur plus de 100 fashion weeks.' },
              { num: '03', title: 'Image &\nPersonal Branding', desc: 'Book, styling, réseaux. Construisez une image cohérente et mémorable pour que les directeurs de casting vous retiennent durablement.' },
            ].map((p, i) => (
              <Reveal key={p.num} delay={i * 120}>
                <div style={{ background: '#000', padding: '48px 40px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none', height: '100%' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0a0a0a'}
                  onMouseLeave={e => e.currentTarget.style.background = '#000'}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 56, fontWeight: 700, color: 'rgba(255,255,255,0.06)', lineHeight: 1 }}>{p.num}</span>
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 20px', lineHeight: 1.2, whiteSpace: 'pre-line' }}>{p.title}</h3>
                  <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.85 }}>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DÉTAILS */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="ca-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 100, alignItems: 'start' }}>
            <Reveal>
              <div style={{ position: 'sticky', top: 120 }}>
                <div className="ca-label" style={{ marginBottom: 28 }}>Organisation</div>
                <h2 className="ca-serif-h2" style={{ margin: '0 0 28px' }}>Concret,<br />régulier,<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>avec de vrais pros</em></h2>
                <p className="ca-body">Chaque vendredi soir, en petits groupes, vous travaillez avec des coachs professionnels en activité.</p>
              </div>
            </Reveal>
            <div>
              {[
                { label: 'Lieu', val: 'Le Nida\n11 Prom. Cœur de Ville, Issy-les-Moulineaux' },
                { label: 'Fréquence', val: 'Tous les vendredis soir' },
                { label: 'Créneaux', val: '18h15 · 19h15 · 20h15\n3 sessions de 45 min par soir (fin à 21h)' },
                { label: 'Coachs', val: 'Directeur de casting\nCoach catwalk · Ancien mannequin pro\nTous en activité' },
                { label: 'Terrain', val: 'Défilés et shootings réguliers\nPour bâtir votre book et votre réseau' },
                { label: 'Opportunités', val: 'Accès prioritaire aux castings\nSimulations filmées et retours personnalisés' },
              ].map((item, i) => (
                <Reveal key={item.label} delay={i * 60}>
                  <div className="ca-info-row">
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>{item.label}</p>
                    <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 300, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{item.val}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* JENNIFER */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal><div className="ca-label" style={{ marginBottom: 60, textAlign: 'center' }}>Mot de la Présidente</div></Reveal>
          <div className="ca-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 80, alignItems: 'center' }}>
            <Reveal>
              <div style={{ position: 'relative' }}>
                <img src="/jenny.png" alt="Jennifer — Présidente de la Casting Academy" style={{ width: '100%', objectFit: 'cover', aspectRatio: '3/4', display: 'block', filter: 'grayscale(20%)' }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <div style={{ display: 'none', width: '100%', aspectRatio: '3/4', background: '#111', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Jennifer</p>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '60px 28px 28px', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)' }}>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>Jennifer</p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Présidente · Casting Academy</p>
                </div>
              </div>
            </Reveal>
            <RevealLeft delay={200}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 400, fontStyle: 'italic', lineHeight: 1.2, color: '#fff', margin: '0 0 40px' }}>
                  "J'ai créé l'école<br />que j'aurais voulu<br />avoir."
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <p className="ca-body">Quand j'ai commencé dans le monde du casting, il n'existait pas de lieu où apprendre les codes, construire sa présence et se connecter aux vrais professionnels en même temps.</p>
                  <p className="ca-body">La Casting Academy, c'est ma réponse à ce manque. Un espace concret, bienveillant et exigeant — où chaque participant repart avec des outils réels et des opportunités tangibles.</p>
                  <p className="ca-body">Commencez par la Porte Ouverte. Venez voir. Venez ressentir. L'équipe est là pour vous.</p>
                </div>
                <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.3)' }} />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Jennifer, Présidente</span>
                </div>
              </div>
            </RevealLeft>
          </div>
        </div>
      </section>

      {/* ÉQUIPE */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#050505' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal><div className="ca-label" style={{ marginBottom: 60 }}>Votre équipe</div></Reveal>
          <Reveal delay={100}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 60px', alignItems: 'start', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 60, marginBottom: 60 }}>
              <div style={{ width: 100, height: 100, background: '#111', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#fff' }}>LF</span>
              </div>
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', marginBottom: 16 }}>
                  <h3 className="ca-serif-h3" style={{ margin: 0 }}>Lionel Fundéré</h3>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.25)', padding: '5px 14px' }}>Directeur & Professeur</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                  {['Coach Catwalk', 'Coach Business Artistique', 'Ancien Mannequin Pro'].map(tag => (
                    <span key={tag} style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>· {tag}</span>
                  ))}
                </div>
                <p className="ca-body" style={{ maxWidth: 700 }}>Fondateur du <strong style={{ color: '#fff', fontWeight: 400 }}>Salon du Casting</strong> et de la <strong style={{ color: '#fff', fontWeight: 400 }}>Models House</strong>, Lionel Fundéré est l'un des acteurs majeurs de l'industrie du mannequinat et du casting en France. Fort d'une expérience sur <strong style={{ color: '#fff', fontWeight: 400 }}>plus de 100 fashion weeks</strong>, il transmet ses techniques de catwalk et ses méthodes de développement business artistique directement aux participants.</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 60px', alignItems: 'start', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 60 }}>
              <div style={{ width: 100, height: 100, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                <img src="/mohammed.jpg" alt="Mohammed — Responsable Image" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: 'grayscale(15%)' }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <div style={{ display: 'none', width: '100%', height: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#fff' }}>M</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', marginBottom: 16 }}>
                  <h3 className="ca-serif-h3" style={{ margin: 0 }}>Mohammed</h3>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.25)', padding: '5px 14px' }}>Responsable Image</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                  {["Vidéos & Books Photo", "Design en Ligne", "Agence d'Influenceurs", "Digitalisation des Profils"].map(tag => (
                    <span key={tag} style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>· {tag}</span>
                  ))}
                </div>
                <p className="ca-body" style={{ maxWidth: 700 }}>À la tête d'une <strong style={{ color: '#fff', fontWeight: 400 }}>agence d'influenceurs</strong>, Mohammed est expert en image des modèles — vidéos professionnelles, créations de books photo et design en ligne.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA PORTE OUVERTE */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <video autoPlay muted loop playsInline src="/video-hero.mp4" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
        <div className="ca-section-pad" style={{ padding: '160px 60px', position: 'relative' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
            <Reveal>
              <div className="ca-label" style={{ marginBottom: 32 }}>Événement Gratuit · Juillet 2026</div>
              <h2 className="ca-serif-h2" style={{ margin: '0 0 16px' }}>Porte Ouverte<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>Casting Academy</em></h2>
              <p className="ca-body" style={{ maxWidth: 540, margin: '32px auto 16px' }}>Venez découvrir l'école, rencontrer les coachs et vivre votre première mise en situation.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center', margin: '40px 0', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                <span>Tous les vendredis de juillet</span>
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                <span>18h15 · 19h15 · 20h15</span>
              </div>
              <a href={BOOK_URL} className="ca-btn-primary" style={{ fontSize: 13 }}>Réserver ma place — Gratuit →</a>
              <p style={{ marginTop: 20, fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Confirmation WhatsApp immédiate</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 60 }}>
              <div className="ca-label" style={{ marginBottom: 20 }}>FAQ</div>
              <h2 className="ca-serif-h2">Questions<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>fréquentes</em></h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              {[
                { q: "Faut-il de l'expérience pour s'inscrire ?", a: "Aucune. La Casting Academy accueille les débutants complets comme les profils déjà expérimentés. Nos coachs adaptent leur accompagnement à chaque niveau." },
                { q: "À quoi ressemble la Porte Ouverte ?", a: "C'est une séance de 45 min où vous découvrez l'école, rencontrez les coachs et vivez une première mise en situation réelle. C'est gratuit et sans engagement." },
                { q: "Comment se déroulent les séances ?", a: "Chaque vendredi soir au Nida (Issy-les-Moulineaux). 3 créneaux : 18h15, 19h15 et 20h15 (fin à 21h). Groupes de 8 à 12 personnes." },
                { q: "Est-ce que je vais vraiment avoir des castings ?", a: "L'objectif est de vous préparer et vous connecter aux opportunités réelles. Les membres ont accès en priorité aux castings publiés sur notre plateforme partenaire." },
                { q: "Qui sont les coachs ?", a: "Lionel Fundéré — directeur, fondateur du Salon du Casting et de la Models House, ancien mannequin (100+ fashion weeks). Et Jennifer, Présidente de la Casting Academy." },
              ].map((item, i) => <FaqItem key={item.q} q={item.q} a={item.a} index={i} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', textAlign: 'center' }}>
        <Reveal>
          <h2 className="ca-serif-h2" style={{ margin: '0 0 20px' }}>Les groupes sont réduits.<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>Réservez votre créneau.</em></h2>
          <p className="ca-body" style={{ maxWidth: 480, margin: '0 auto 48px' }}>Commencez par la Porte Ouverte gratuite. Réservation en quelques secondes, confirmation WhatsApp immédiate.</p>
          <a href={BOOK_URL} className="ca-btn-primary" style={{ fontSize: 13 }}>Je réserve ma place — Gratuit →</a>
        </Reveal>
      </section>

      {/* FOOTER */}
      <section style={{ padding: '48px 60px', background: '#000', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24, marginBottom: 32 }}>
            {[
              { label: 'Forme juridique', val: 'Association loi 1901' },
              { label: 'Siège social', val: 'Issy-les-Moulineaux (92130)' },
              { label: 'Numéro RNA', val: "En cours d'attribution" },
              { label: 'Contact', val: 'contact@casting-academy.fr' },
            ].map(({ label, val }) => (
              <div key={label}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', margin: '0 0 6px' }}>{label}</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{val}</p>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
            Réservation via <strong style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>iCastt</strong>, partenaire de l'association.
          </p>
        </div>
      </section>
    </div>
  );
}
