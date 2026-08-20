import React, { useEffect } from 'react';

// ── Palette et primitives visuelles du Jeu de Vie Financier ────────────────
export const C = {
  fond: '#f2e4d0', carte: '#fffdf9', creme: '#fdf1e2', creme2: '#f7ecdc',
  bord: '#e8cdb8', ligne: '#f5e6d0', rail: '#f0dcc4',
  encre: '#4a2410', doux: '#9a6a45', label: '#b06a3a', pale: '#a97c53',
  orange: '#e86535', orangeClair: '#f9b080', orangeVif: '#f07040',
  brique: '#c2551f', brun: '#7a3a18', sombre: '#3d1f0e',
  vert: '#2e7d43', ambre: '#e08a1e', rouge: '#c93a1c', bleu: '#4a8a8f',
};

export const ombre = '0 4px 18px rgba(122,58,24,0.1)';

export function Carte({ children, style = {}, sombre = false }) {
  return (
    <div style={{
      background: sombre ? 'linear-gradient(160deg,#3d1f0e,#5c2d12)' : C.carte,
      color: sombre ? '#fbe4cd' : C.encre,
      borderRadius: 18, padding: 20,
      boxShadow: sombre ? '0 8px 26px rgba(60,25,8,0.4)' : ombre,
      display: 'flex', flexDirection: 'column', gap: 12, ...style,
    }}>{children}</div>
  );
}

export function Titre({ children, couleur = C.label, extra = null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: couleur }}>{children}</div>
      {extra}
    </div>
  );
}

export function Barre({ pct, couleur, hauteur = 10, fond = C.rail, repere = null }) {
  return (
    <div style={{ height: hauteur, borderRadius: 99, background: fond, overflow: 'hidden', position: 'relative' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: couleur, borderRadius: 99, transition: 'width 0.6s ease, background 0.6s ease' }} />
      {repere !== null && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.max(0, Math.min(100, repere))}%`, width: 2.5, background: C.encre }} />
      )}
    </div>
  );
}

export function Ligne({ label, valeur, couleur = C.encre, gras = 800 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, gap: 10 }}>
      <span>{label}</span>
      <span style={{ fontWeight: gras, color: couleur, whiteSpace: 'nowrap' }}>{valeur}</span>
    </div>
  );
}

export function Bouton({ children, onClick, variante = 'principal', style = {}, titre, type = 'button', disabled = false }) {
  const base = {
    border: 'none', cursor: disabled ? 'default' : 'pointer', borderRadius: 12, padding: '12px 14px',
    fontSize: 14, fontWeight: 800, fontFamily: 'inherit', transition: 'filter 0.15s, background 0.15s',
    opacity: disabled ? 0.5 : 1,
  };
  const variantes = {
    principal: { background: `linear-gradient(135deg,${C.orangeVif},${C.orange})`, color: '#fff', boxShadow: '0 6px 18px rgba(122,58,24,0.3)' },
    vert: { background: `linear-gradient(135deg,#3d9457,${C.vert})`, color: '#fff', boxShadow: '0 6px 18px rgba(20,90,45,0.28)' },
    contour: { background: '#fff', color: C.vert, border: `2px solid ${C.vert}` },
    doux: { background: C.creme, color: C.brun },
    fantome: { background: 'none', color: C.pale, fontSize: 12, fontWeight: 700, textDecoration: 'underline', padding: '6px 4px' },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} title={titre} disabled={disabled}
      style={{ ...base, ...variantes[variante], ...style }}>{children}</button>
  );
}

// type="montant" : champ texte à clavier numérique. Un <input type="number">
// refuse la virgule, or « 23,40 » est la saisie naturelle en français.
export function Champ({ valeur, onChange, type = 'text', placeholder, style = {}, min, step, ariaLabel }) {
  const montant = type === 'montant';
  return (
    <input
      type={montant ? 'text' : type} value={valeur} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      min={min} step={step} aria-label={ariaLabel || placeholder}
      inputMode={montant ? 'decimal' : type === 'number' ? 'numeric' : undefined}
      style={{
        fontSize: 13.5, fontWeight: 600, color: C.encre, border: `1.5px solid ${C.bord}`,
        borderRadius: 10, padding: '10px 12px', background: '#fff', fontFamily: 'inherit', minWidth: 0, ...style,
      }}
    />
  );
}

export function Interrupteur({ actif, onClick, titre }) {
  return (
    <button onClick={onClick} title={titre} aria-pressed={actif} style={{
      border: 'none', cursor: 'pointer', width: 34, height: 20, borderRadius: 99,
      background: actif ? C.vert : C.rouge, position: 'relative', flexShrink: 0, transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: actif ? 2 : 16, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  );
}

export function Modale({ titre, onFermer, children, largeur = 520 }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFermer]);
  return (
    <div onClick={onFermer} style={{
      position: 'fixed', inset: 0, background: 'rgba(60,25,8,0.45)', zIndex: 60,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 14px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.carte, borderRadius: 18, padding: 22, width: '100%', maxWidth: largeur,
        boxShadow: '0 18px 50px rgba(60,25,8,0.35)', display: 'flex', flexDirection: 'column', gap: 14, color: C.encre,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{titre}</div>
          <button onClick={onFermer} aria-label="Fermer" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, fontWeight: 800, color: C.doux, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Puce({ children, actif, onClick, couleurActive = C.orange }) {
  return (
    <button onClick={onClick} style={{
      border: 'none', cursor: 'pointer', borderRadius: 99, padding: '7px 13px', fontSize: 12,
      fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.15s',
      background: actif ? couleurActive : C.creme, color: actif ? '#fff' : C.brun,
    }}>{children}</button>
  );
}

export function Aide({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: C.doux, lineHeight: 1.4 }}>{children}</div>;
}
