import React, { useEffect, useRef, useState } from 'react';

const APPLY_SCRIPT_URL = import.meta.env.VITE_APPLY_SCRIPT_URL;

// ── Logo Casting Academy ───────────────────────────────────────────────────
function CastingAcademyLogo({ height = 56, opacity = 1 }) {
  return (
    <img src="/logo.png" alt="Casting Academy" height={height} style={{ height, width: 'auto', display: 'block', opacity }} />
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

function ApplicationForm() {
  const [form, setForm] = useState({ nom: '', prenom: '', age: '', insta: '', tel: '', ville: '', motivation: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | done | error

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff', padding: '16px 18px', fontFamily: "'Inter', sans-serif", fontSize: 14,
    outline: 'none', transition: 'border-color 0.3s',
  };
  const labelStyle = { display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 10 };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!APPLY_SCRIPT_URL) { setStatus('error'); return; }
    setStatus('sending');
    try {
      await fetch(APPLY_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(form),
      });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '60px 40px', textAlign: 'center' }}>
        <h3 className="ca-serif-h3" style={{ marginBottom: 16 }}>Candidature envoyée.</h3>
        <p className="ca-body">Nous revenons vers toi sous 48h pour un échange de 5 minutes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ca-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <label style={labelStyle}>Nom</label>
        <input required style={inputStyle} value={form.nom} onChange={set('nom')} />
      </div>
      <div>
        <label style={labelStyle}>Prénom</label>
        <input required style={inputStyle} value={form.prenom} onChange={set('prenom')} />
      </div>
      <div>
        <label style={labelStyle}>Âge</label>
        <input required type="number" min="1" style={inputStyle} value={form.age} onChange={set('age')} />
      </div>
      <div>
        <label style={labelStyle}>Ville</label>
        <input required style={inputStyle} value={form.ville} onChange={set('ville')} />
      </div>
      <div>
        <label style={labelStyle}>Instagram</label>
        <input required placeholder="@pseudo" style={inputStyle} value={form.insta} onChange={set('insta')} />
      </div>
      <div>
        <label style={labelStyle}>Téléphone</label>
        <input required type="tel" style={inputStyle} value={form.tel} onChange={set('tel')} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Pourquoi toi ?</label>
        <textarea required rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: "'Inter', sans-serif" }} value={form.motivation} onChange={set('motivation')} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <button type="submit" disabled={status === 'sending'} className="ca-btn-primary" style={{ width: '100%', justifyContent: 'center', border: 'none', cursor: status === 'sending' ? 'wait' : 'pointer', opacity: status === 'sending' ? 0.6 : 1 }}>
          {status === 'sending' ? 'Envoi en cours…' : 'Envoyer ma candidature →'}
        </button>
        {status === 'error' && (
          <p style={{ marginTop: 16, color: 'rgba(255,120,120,0.9)', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
            Une erreur est survenue. Réessaie ou contacte-nous directement.
          </p>
        )}
      </div>
    </form>
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
        .ca-serif-h1 { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(44px, 8.5vw, 104px); font-weight: 800; line-height: 0.98; letter-spacing: -2px; color: #fff; }
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
        .ca-compare-col { padding: 40px; }
        input:focus, textarea:focus { border-color: rgba(255,255,255,0.6) !important; }
        @media (max-width: 768px) {
          .ca-hero-text { padding: 0 24px !important; }
          .ca-grid-2col { grid-template-columns: 1fr !important; gap: 48px !important; }
          .ca-grid-3col { grid-template-columns: 1fr !important; }
          .ca-grid-4col { grid-template-columns: 1fr 1fr !important; }
          .ca-info-row { grid-template-columns: 1fr !important; gap: 8px !important; }
          .ca-sticky-bar { padding: 12px 20px !important; }
          .ca-sticky-bar .sticky-label { display: none; }
          .ca-section-pad { padding: 80px 24px !important; }
          .ca-hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .ca-hero-btns a { text-align: center; justify-content: center !important; }
          .ca-video-portrait { max-width: 100%; }
          .ca-form-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .ca-serif-h1 { font-size: 40px !important; letter-spacing: -1px !important; }
          .ca-section-pad { padding: 60px 20px !important; }
          .ca-grid-4col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Sticky Bar */}
      <div className={`ca-sticky-bar${scrolled ? ' visible' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <CastingAcademyLogo height={22} opacity={0.9} />
          <span className="sticky-label" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>Saison 2026/2027 — 20 places</span>
        </div>
        <a href="#candidature" className="ca-btn-primary" style={{ padding: '10px 24px', fontSize: 11 }}>Candidater →</a>
      </div>

      {/* HERO */}
      <section style={{ position: 'relative', height: '100vh', minHeight: 600, overflow: 'hidden', background: '#000' }}>
        <video autoPlay muted loop playsInline src="/video-hero.mp4" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,1) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, transparent 50%)' }} />
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3, opacity: heroLoaded ? 1 : 0, transform: heroLoaded ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.96)', transition: 'opacity 1.6s ease 0.3s, transform 1.6s cubic-bezier(.16,1,.3,1) 0.3s' }}>
          <CastingAcademyLogo height={64} opacity={0.95} />
        </div>
        <div className="ca-hero-text" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 60px 72px', opacity: heroLoaded ? 1 : 0, transform: heroLoaded ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 1.2s ease 0.6s, transform 1.2s cubic-bezier(.16,1,.3,1) 0.6s' }}>
          <div className="ca-label" style={{ marginBottom: 20 }}>Ouverture Officielle · Issy-les-Moulineaux</div>
          <h1 className="ca-serif-h1" style={{ margin: '0 0 8px', maxWidth: 900 }}>La mode a décidé<br />qui avait le droit<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>de rêver.</em></h1>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(16px, 2vw, 22px)', fontWeight: 300, color: 'rgba(255,255,255,0.7)', margin: '20px 0 36px', maxWidth: 540, lineHeight: 1.6, letterSpacing: 0.3 }}>
            Nous avons décidé de changer les règles. 20 places, candidatures ouvertes pour la saison 2026/2027.
          </p>
          <div className="ca-hero-btns" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <a href="#candidature" className="ca-btn-primary">Je candidate →</a>
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
          {Array(4).fill(['CASTING ACADEMY', 'CANDIDATURES OUVERTES', '20 PLACES', 'PARIS', 'CATWALK', 'CASTINGS', 'SAISON 2026/2027', 'PERSONAL BRANDING', 'ISSY-LES-MOULINEAUX']).flat().map((item, i) => (
            <span key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', paddingRight: 48 }}>
              {item} <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: 48 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* PENDANT DES ANNÉES — DOULEUR */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <p className="ca-body" style={{ fontStyle: 'italic', marginBottom: 32 }}>Pendant des années...</p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.6vw, 28px)', fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: '0 0 40px' }}>
              « Trop petit. » · « Trop grand. » · « Trop vieux. »<br />
              « Pas assez mince. » · « Pas assez beau. »<br />
              « Trop tatoué. » · « Trop différent. »
            </p>
          </Reveal>
          <Reveal delay={100}>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>Alors elles ont abandonné.</p>
            <p className="ca-body" style={{ margin: '0 auto 40px', maxWidth: 620 }}>Pas parce qu'elles n'avaient pas de talent. Parce qu'elles n'avaient jamais eu leur chance.</p>
          </Reveal>
          <Reveal delay={200}>
            <p className="ca-body" style={{ margin: '0 auto 48px', maxWidth: 620 }}>
              La Casting Academy est née pour une seule raison : donner une véritable opportunité à ceux que l'industrie n'a jamais regardés.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '40px 32px' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>Nous ne promettons pas la célébrité.</p>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Nous promettons une chose beaucoup plus importante :</p>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontStyle: 'italic', fontWeight: 400, color: '#fff', margin: 0 }}>Une vraie chance de prouver ce dont tu es capable.</p>
            </div>
          </Reveal>
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
                <div className="ca-label" style={{ marginBottom: 28 }}>Ce que nous construisons</div>
                <h2 className="ca-serif-h2" style={{ margin: '0 0 32px' }}>Pas des mannequins.<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>Des artistes.</em></h2>
                <p className="ca-body" style={{ marginBottom: 24 }}>La Casting Academy n'est pas un cours en ligne — c'est une salle, des coachs, des caméras et des candidats sélectionnés qui veulent vraiment percer.</p>
                <p className="ca-body" style={{ marginBottom: 40 }}>2 sessions par mois à la Casting Academy, plus un suivi individuel chaque semaine. Groupe limité à 20 talents : tu n'es jamais un numéro.</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <a href="#candidature" className="ca-btn-primary">Je candidate →</a>
                  <a href="#programme" className="ca-btn-ghost">Programme</a>
                </div>
              </div>
            </RevealLeft>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="ca-section-pad" style={{ padding: '100px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.08)' }}>
            {[
              { num: '87 000', label: 'emplois générés\npar les industries créatives', source: 'BMO France Travail 2025' },
              { num: '20', label: 'places seulement\npour la saison 2026/2027', source: 'Sélection sur candidature' },
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

      {/* IMAGINE TA VIE DANS UN AN */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 72 }}>
              <div className="ca-label" style={{ marginBottom: 20 }}>Projection</div>
              <h2 className="ca-serif-h2">Imagine ta vie<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>dans un an.</em></h2>
              <p className="ca-body" style={{ maxWidth: 560, margin: '32px auto 0' }}>Ferme les yeux quelques secondes. Nous sommes en septembre 2027. Ton téléphone sonne.</p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '32px 40px', marginBottom: 4 }}>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: 18, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>Bonjour,</p>
              <p className="ca-body" style={{ margin: 0 }}>Nous avons vu votre profil. Nous aimerions vous proposer un casting.</p>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="ca-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(255,255,255,0.08)', marginTop: 40 }}>
              <div className="ca-compare-col" style={{ background: '#000' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>Il y a un an, tu n'avais...</p>
                {['aucun book', 'aucune expérience', 'aucun réseau', 'aucune méthode', "aucune idée pour entrer dans ce milieu"].map(t => (
                  <p key={t} className="ca-body" style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.4)' }}>— {t}</p>
                ))}
              </div>
              <div className="ca-compare-col" style={{ background: '#000' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', margin: '0 0 24px' }}>Aujourd'hui, tu...</p>
                {['arrives en casting avec confiance', 'sais marcher, sais poser, sais parler de toi', 'connais les codes du métier', 'évites les erreurs qui éliminent 90% des candidats', 'comprends cette industrie et développes ton réseau'].map(t => (
                  <p key={t} className="ca-body" style={{ margin: '0 0 14px', color: '#fff', fontWeight: 400 }}>— {t}</p>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div style={{ textAlign: 'center', marginTop: 56 }}>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>Voilà ce que nous construisons.</p>
              <p className="ca-body">Pas des mannequins. Des artistes capables d'ouvrir eux-mêmes les bonnes portes.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* LE VRAI COÛT */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#050505' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <div className="ca-label" style={{ marginBottom: 20 }}>Le temps compte</div>
            <h2 className="ca-serif-h2" style={{ marginBottom: 56 }}>Le vrai coût,<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>c'est de ne rien faire.</em></h2>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ marginBottom: 56 }}>
              {[
                ['Pendant que tu réfléchis...', "Quelqu'un d'autre apprend."],
                ['Pendant que tu hésites...', "Quelqu'un d'autre progresse."],
                ['Pendant que tu attends « le bon moment »...', 'Quelqu\'un prend la place que tu aurais pu avoir.'],
              ].map(([a, b]) => (
                <div key={a} style={{ marginBottom: 20 }}>
                  <p className="ca-body" style={{ fontStyle: 'italic', margin: '0 0 4px' }}>{a}</p>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 19, fontWeight: 600, color: '#fff', margin: 0 }}>{b}</p>
                </div>
              ))}
              <p className="ca-body" style={{ marginTop: 32 }}>Le temps passe. Les rêves attendent rarement.</p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <p className="ca-body" style={{ maxWidth: 640, margin: '0 auto 48px' }}>
              C'est pour cela que nous avons créé un véritable écosystème. Pas seulement des cours. Un environnement. Une communauté. Une équipe. Des professionnels. Des opportunités.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '48px 40px', textAlign: 'left' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 28px' }}>Tu accèdes notamment à :</p>
              <div className="ca-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 40px' }}>
                {['Des shootings professionnels', 'Une bande démo', 'Des ateliers en présentiel', 'Une préparation aux castings', 'Des coachings personnalisés', 'Des conseils image', 'Des rencontres pros', 'Les événements Salon Du Casting', 'Une plateforme de castings dédiée','Une communauté de dizaines de milliers de talents', 'Un accompagnement humain'].map(t => (
                  <p key={t} className="ca-body" style={{ margin: 0 }}>— {t}</p>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <p style={{ marginTop: 48, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: '#fff' }}>
              Nous ne pouvons pas faire le travail à ta place.<br />
              <em style={{ fontStyle: 'italic', fontWeight: 400 }}>Mais nous pouvons faire en sorte que tu n'avances plus jamais seul.</em>
            </p>
          </Reveal>
        </div>
      </section>

      {/* PROGRAMME */}
      <section id="programme" className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 64 }}>
              <div className="ca-label" style={{ marginBottom: 20 }}>Voici concrètement ce qui t'attend</div>
              <h2 className="ca-serif-h2">Le programme<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>de la saison</em></h2>
            </div>
          </Reveal>
          <div className="ca-grid-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 4 }}>
            {[
              { period: 'SEPT — OCT', title: '1. Fondations', desc: "Audit d'entrée, posture, démarche, présence. Tu apprends les codes." },
              { period: 'NOV — JAN', title: '2. Ton image pro', desc: 'Shooting professionnel, book, bande démo, réseaux : ta vitrine se construit.' },
              { period: 'FÉV — AVR', title: '3. Castings réels', desc: 'Tu postules aux castings, préparé(e) et suivi(e). Figuration rémunérée possible.' },
              { period: 'MAI — JUIN', title: '4. Révélation', desc: 'Défilés, événements Salon Du Casting, mises en relation agences. Tu es lancé(e).' },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div style={{ background: '#000', padding: '36px 28px', height: '100%' }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', margin: '0 0 20px' }}>{p.period}</p>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 21, fontWeight: 700, color: '#fff', margin: '0 0 14px' }}>{p.title}</h3>
                  <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.75 }}>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <p className="ca-body" style={{ marginTop: 24 }}>
              <strong style={{ color: '#fff', fontWeight: 400 }}>Le rythme :</strong> 2 sessions/mois à la Casting Academy + 1 suivi individuel chaque semaine. Groupe limité à 20 : tu n'es jamais un numéro — tu es vu(e), corrigé(e) et suivi(e) personnellement.
            </p>
          </Reveal>

          <div className="ca-grid-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.08)', marginTop: 80 }}>
            {[
              { title: 'Démarche', desc: 'Posture, présence, techniques de podium.', img: '/pilier-demarche.jpg' },
              { title: 'Pose & Photo', desc: 'Shooting avec notre photographe, book.', img: '/pilier-pose-photo.jpg' },
              { title: 'Prépa Casting', desc: 'Book, polas, attitude, entretien.', img: '/pilier-prepa-casting.jpg' },
              { title: 'Image & Business', desc: 'Personal branding, réseaux, contrats.', img: '/pilier-image-business.jpg' },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div style={{ position: 'relative', height: 320, overflow: 'hidden' }}>
                  <img src={p.img} alt={p.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(15%)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.1) 100%)' }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 24px' }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', margin: '0 0 10px' }}>{p.title}</p>
                    <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.7 }}>{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={100}>
            <p className="ca-body" style={{ marginTop: 24 }}>
              + <strong style={{ color: '#fff', fontWeight: 400 }}>Module Business de l'artiste</strong> : tarifs, contrats, monétisation de ton image — pour vivre de ta passion.
            </p>
          </Reveal>
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
                <p className="ca-body">En petits groupes, vous travaillez avec des coachs professionnels en activité.</p>
              </div>
            </Reveal>
            <div>
              {[
                { label: 'Lieu', val: 'Le Nida\n11 Prom. Cœur de Ville, Issy-les-Moulineaux' },
                { label: 'Places', val: '20 talents · sélection sur candidature' },
                { label: 'Rythme', val: '2 sessions par mois\n+ 1 suivi individuel chaque semaine' },
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
              <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src="/jenny.jpg" alt="Jennifer — Présidente de la Casting Academy" style={{ width: '100%', objectFit: 'cover', aspectRatio: '3/4', display: 'block', filter: 'grayscale(15%)' }} />
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
                  <p className="ca-body">Commence par déposer ta candidature. Viens voir. Viens ressentir. L'équipe est là pour toi.</p>
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
        </div>
      </section>

      {/* LES CANDIDATURES SONT OUVERTES */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <div className="ca-label" style={{ marginBottom: 20 }}>Sélection</div>
            <h2 className="ca-serif-h2" style={{ marginBottom: 48 }}>Les candidatures<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>sont ouvertes.</em></h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="ca-body" style={{ marginBottom: 8 }}>Nous ne recherchons pas les plus beaux.</p>
            <p className="ca-body" style={{ marginBottom: 8 }}>Nous ne recherchons pas les plus grands.</p>
            <p className="ca-body" style={{ marginBottom: 32 }}>Nous ne recherchons pas les profils parfaits.</p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>Nous recherchons...</p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>Des personnes capables de travailler.</p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: '#fff', margin: '0 0 32px' }}>D'apprendre. De tomber. De recommencer. De progresser.</p>
            <p className="ca-body" style={{ marginBottom: 48 }}>Parce que c'est exactement comme cela qu'une carrière se construit.</p>
          </Reveal>
          <Reveal delay={200}>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 20px' }}>Nous limitons volontairement la promotion à 20 talents.</p>
            <p className="ca-body" style={{ marginBottom: 8 }}>Pourquoi ? Parce que nous voulons connaître chaque élève, comprendre son projet, suivre sa progression.</p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 56 }}>Tu ne seras jamais un numéro.</p>
          </Reveal>
          <Reveal delay={300}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '48px 40px', textAlign: 'left', marginBottom: 56 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 28px' }}>Comment rejoindre la Casting Academy ?</p>
              {[
                ['01', 'Tu déposes ta candidature', 'remplis le formulaire ci-dessous.'],
                ['02', 'Nous échangeons avec toi', 'pour comprendre ton projet, tes ambitions, ton état d\'esprit.'],
                ['03', 'Si nous pensons pouvoir t\'aider', 'nous t\'invitons à rejoindre la prochaine promotion.'],
              ].map(([n, t, d]) => (
                <div key={n} style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', minWidth: 20 }}>{n}</span>
                  <p className="ca-body" style={{ margin: 0 }}><strong style={{ color: '#fff', fontWeight: 400 }}>{t}</strong><br />{d}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={350}>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', margin: '0 0 12px' }}>« Suis-je assez beau ? »</p>
            <p className="ca-label" style={{ marginBottom: 12 }}>La vraie question est :</p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 20px' }}>Suis-je prêt(e) à travailler plus que les autres ?</p>
            <p className="ca-body" style={{ marginBottom: 40 }}>La beauté attire parfois un regard. Le travail construit une carrière.</p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>Nous ne créons pas des mannequins.<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>Nous révélons des talents.</em></p>
          </Reveal>
        </div>
      </section>

      {/* OFFRE / PRICING */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <video autoPlay muted loop playsInline src="/video-hero.mp4" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }} />
        <div className="ca-section-pad" style={{ padding: '160px 60px', position: 'relative' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <Reveal>
              <div className="ca-label" style={{ marginBottom: 32 }}>Offre de lancement</div>
              <h2 className="ca-serif-h2" style={{ margin: '0 0 56px' }}>Prêt(e) à faire partie<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>de l'aventure ?</em></h2>
            </Reveal>
            <Reveal delay={100}>
              <div style={{ border: '1px solid rgba(255,255,255,0.25)', padding: '48px 40px', textAlign: 'left' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: 1, color: '#fff', margin: '0 0 24px' }}>Adhésion annuelle 2026/2027</p>
                <div className="ca-hairline" style={{ marginBottom: 24 }} />
                <p className="ca-body" style={{ marginBottom: 24 }}>Paiement flexible en plusieurs fois sans frais, à ton rythme.</p>
                <p className="ca-body" style={{ marginBottom: 24 }}>Inclus : 2 sessions/mois à la Casting Academy + suivi hebdomadaire individuel + audit d'entrée + module Business de l'artiste + communauté &amp; événements.</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Tarifs communiqués lors de l'échange · offre de lancement réservée aux 20 premiers talents sélectionnés · cadre associatif.</p>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <a href="#candidature" className="ca-btn-primary" style={{ fontSize: 13, marginTop: 40 }}>Je dépose ma candidature →</a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 60 }}>
              <div className="ca-label" style={{ marginBottom: 20 }}>Tes questions, nos réponses</div>
              <h2 className="ca-serif-h2">Questions<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>fréquentes</em></h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              {[
                { q: 'Et si je débute totalement ?', a: "C'est fait pour toi : audit d'entrée, progression par étapes, suivi personnel chaque semaine." },
                { q: 'Je peux payer en plusieurs fois ?', a: "Oui : un acompte bloque ta place, puis tu choisis 1, 2 ou 3 fois sans frais pour le solde. Les montants sont détaillés lors de l'échange." },
                { q: 'Et si je ne peux pas venir à une session ?', a: 'Le suivi hebdomadaire individuel maintient ta progression, et les sessions sont rattrapables sur l\'année.' },
                { q: "Qu'est-ce qui vous différencie des écoles en ligne ?", a: 'Du présentiel réel, un suivi humain, et surtout : de vrais castings à la clé — pas seulement des vidéos.' },
                { q: 'Qui sont les coachs ?', a: "Lionel Fundéré — directeur, fondateur du Salon du Casting et de la Models House, ancien mannequin (100+ fashion weeks). Et Jennifer, Présidente de la Casting Academy." },
              ].map((item, i) => <FaqItem key={item.q} q={item.q} a={item.a} index={i} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CANDIDATURE FORM */}
      <section id="candidature" className="ca-section-pad" style={{ padding: '120px 60px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#050505' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div className="ca-label" style={{ marginBottom: 20 }}>3 étapes pour démarrer</div>
              <h2 className="ca-serif-h2" style={{ marginBottom: 24 }}>Dépose ta<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>candidature.</em></h2>
              <p className="ca-body" style={{ maxWidth: 480, margin: '0 auto' }}>Remplis le formulaire. Nous échangeons 5 minutes pour confirmer que c'est fait pour toi. Tu rejoins les 20 talents sélectionnés pour la saison 2026/2027.</p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <ApplicationForm />
          </Reveal>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="ca-section-pad" style={{ padding: '120px 60px', textAlign: 'center' }}>
        <Reveal>
          <h2 className="ca-serif-h2" style={{ margin: '0 0 20px' }}>Il ne reste que 20 places.<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>Dépose ta candidature.</em></h2>
          <p className="ca-body" style={{ maxWidth: 480, margin: '0 auto 48px' }}>Sélection sur candidature pour la saison 2026/2027. Réponse sous 48h.</p>
          <a href="#candidature" className="ca-btn-primary" style={{ fontSize: 13 }}>Je candidate maintenant →</a>
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
        </div>
      </section>
    </div>
  );
}
