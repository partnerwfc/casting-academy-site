import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BADGES, CATS, CAT_COLS, MOIS, XP,
  calcMois, chargerEtat, decaleMois, etatInitial, etatVide, fmt, fmtCourt, isoLocal, joursDansMois,
  labelJour, moisKey, moisLabel, niveauDepuisXp, nouveauxBadges, parseMontant, sauverEtat,
  recompensesEnAttente, uid, valideImport, versCsv, NIVEAU_NOMS, STORE_KEY,
} from './logic';
import { Aide, Barre, Bouton, C, Carte, Champ, Interrupteur, Ligne, Modale, Puce, Titre } from './ui';

// ── Styles globaux injectés une fois ───────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
  html, body { margin:0; padding:0; background:${C.fond}; font-family:'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif; }
  #root { min-height:100vh; }
  .jvf * { box-sizing:border-box; }
  .jvf input:focus { outline:2px solid ${C.orangeVif}; outline-offset:1px; }
  .jvf button:hover:not(:disabled) { filter:brightness(1.06); }
  .jvf-grid { width:100%; max-width:1160px; column-count:1; column-gap:18px; }
  .jvf-grid > * { break-inside:avoid; page-break-inside:avoid; margin-bottom:18px; }
  @media (min-width: 760px) { .jvf-grid { column-count:2; } }
  @media (min-width: 1120px) { .jvf-grid { column-count:3; } }
  @keyframes jvf-bob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
  @keyframes jvf-flick { 0%,100% { transform:scale(1) rotate(-2deg); } 50% { transform:scale(1.12) rotate(3deg); } }
  @keyframes jvf-pop { 0% { transform:scale(0.6); opacity:0; } 70% { transform:scale(1.06); } 100% { transform:scale(1); opacity:1; } }
  @keyframes jvf-slidein { 0% { transform:translateY(-8px); opacity:0; } 100% { transform:translateY(0); opacity:1; } }
`;

function useCssGlobal() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
    const titre = document.title;
    document.title = 'Jeu de Vie Financier — Level Up';
    return () => { document.head.removeChild(el); document.title = titre; };
  }, []);
}

// ── Avatar Flouz ───────────────────────────────────────────────────────────
const VISAGES = {
  happy: { g: 'M38 46 Q44 40 50 46', d: 'M70 46 Q76 40 82 46', b: 'M42 72 Q60 88 78 72', col: '#f9b080' },
  neutre: { g: 'M38 46 L50 46', d: 'M70 46 L82 46', b: 'M45 76 L75 76', col: '#f5a06a' },
  inquiet: { g: 'M38 48 Q44 43 50 46', d: 'M82 48 Q76 43 70 46', b: 'M44 80 Q60 70 76 80', col: '#ef8352' },
  ko: { g: 'M38 40 L50 52 M50 40 L38 52', d: 'M70 40 L82 52 M82 40 L70 52', b: 'M44 80 Q60 70 76 80', col: '#e06030' },
};

const COACH = {
  happy: {
    doux: 'Flouz rayonne ! Tu gères ton budget comme un chef. Continue et le boss du mois ne tiendra pas.',
    strict: 'Bien. Ne relâche rien : chaque euro non dépensé est un point de plus.',
  },
  neutre: {
    doux: 'Ça tient, mais Flouz commence à transpirer. Un ou deux jours sans dépense évitable et ta jauge remonte.',
    strict: 'Attention. Ton rythme de dépenses grimpe. Reprends le contrôle maintenant.',
  },
  inquiet: {
    doux: 'Flouz s’inquiète : le rythme est trop élevé. Vise ton budget/jour et rallume ta flamme !',
    strict: 'Tu dépenses trop vite. Stop aux achats évitables jusqu’à nouvel ordre.',
  },
  ko: {
    doux: 'Flouz est KO : tu es dans le rouge. Chaque dépense évitée le ranime — on remonte ensemble !',
    strict: 'Découvert. Plan d’urgence : zéro dépense non vitale.',
  },
};

function Flouz({ couleur, visage }) {
  return (
    <div style={{ animation: 'jvf-bob 3s ease-in-out infinite', flexShrink: 0 }}>
      <svg width="104" height="104" viewBox="0 0 120 120" role="img" aria-label="Flouz, ton compagnon financier">
        <circle cx="60" cy="60" r="54" fill={couleur} stroke={C.brique} strokeWidth="4" />
        <circle cx="60" cy="60" r="43" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeDasharray="5 7" />
        <path d={visage.g} stroke="#6b2f10" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d={visage.d} stroke="#6b2f10" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d={visage.b} stroke="#6b2f10" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <circle cx="36" cy="68" r="6" fill="rgba(240,112,64,0.35)" />
        <circle cx="84" cy="68" r="6" fill="rgba(240,112,64,0.35)" />
      </svg>
    </div>
  );
}

function Flamme({ allumee }) {
  return (
    <div style={{ animation: 'jvf-flick 1.2s ease-in-out infinite', transformOrigin: '50% 90%' }}>
      <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden="true">
        <path d="M10 1 C13 6 17 9 17 15 A7 7 0 0 1 3 15 C3 11 6 9 7 6 C8.2 8 9.5 9 10 11 C11.5 8 10.5 4 10 1 Z"
          fill={allumee ? C.orange : '#d9c4a8'} />
      </svg>
    </div>
  );
}

function Golem() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M12 54 L12 26 Q12 10 32 10 Q52 10 52 26 L52 54 L44 46 L38 54 L32 46 L26 54 L20 46 Z" fill={C.orange} />
      <circle cx="24" cy="28" r="5" fill={C.sombre} /><circle cx="40" cy="28" r="5" fill={C.sombre} />
      <circle cx="24" cy="28" r="2" fill="#ffd28f" /><circle cx="40" cy="28" r="2" fill="#ffd28f" />
      <path d="M24 42 L28 38 L32 42 L36 38 L40 42" stroke={C.sombre} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── État applicatif ────────────────────────────────────────────────────────
function useEtat() {
  const [etat, setEtat] = useState(() => (typeof window === 'undefined' ? etatInitial() : chargerEtat()));
  const premier = useRef(true);

  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    sauverEtat(etat);
  }, [etat]);

  const maj = useCallback(patch => {
    setEtat(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  return [etat, maj, setEtat];
}

// ── Écran principal ────────────────────────────────────────────────────────
export default function FinanceTool() {
  useCssGlobal();
  const [etat, maj, setEtat] = useEtat();
  const [now] = useState(() => new Date());
  const [mois, setMois] = useState(() => moisKey(now));
  const [modale, setModale] = useState(null);       // 'params' | 'donnees' | 'charge' | 'ops'
  const [chargeEdit, setChargeEdit] = useState(null);
  const [toasts, setToasts] = useState([]);

  const c = useMemo(() => calcMois(etat, mois, now), [etat, mois, now]);
  const niv = niveauDepuisXp(etat.xp);

  const toast = useCallback(txt => {
    const id = uid();
    setToasts(t => [...t, { id, txt }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  // Badges et boss : attribués automatiquement dès que les conditions passent.
  useEffect(() => {
    const gagnes = nouveauxBadges(etat, c, now);
    if (gagnes.length) {
      maj(prev => {
        const badges = { ...prev.badges };
        gagnes.forEach(id => { badges[id] = isoLocal(now); });
        return { badges, xp: prev.xp + gagnes.length * XP.badge };
      });
      gagnes.forEach(id => toast(`Badge débloqué : ${BADGES.find(b => b.id === id).nom} (+${XP.badge} XP)`));
    }
  }, [c, etat, maj, now, toast]);

  // Boss de fin de mois et défis : balayés sur tout l'historique, pas
  // seulement sur le mois affiché — sinon une victoire passée serait perdue.
  useEffect(() => {
    const r = recompensesEnAttente(etat, now);
    if (r.xp > 0) {
      maj(prev => ({
        boss: { ...prev.boss, ...r.boss },
        defisReussis: { ...prev.defisReussis, ...r.defis },
        xp: prev.xp + r.xp,
      }));
      r.messages.forEach(toast);
    }
  }, [etat, maj, now, toast]);

  const humeur = c.reste < 0 ? 'ko' : c.sante >= 70 ? 'happy' : c.sante >= 40 ? 'neutre' : 'inquiet';
  const santeCouleur = c.sante >= 70 ? C.vert : c.sante >= 40 ? C.ambre : C.rouge;
  const alerte = !c.futur && (c.reste < 0 || c.pace > 1.15);

  const moisDispo = useMemo(() => {
    const set = new Set(etat.txs.map(t => t.d.slice(0, 7)));
    set.add(moisKey(now)); set.add(mois);
    return [...set].sort();
  }, [etat.txs, mois, now]);

  const ajouterTx = tx => {
    maj(prev => ({ txs: [tx, ...prev.txs], xp: prev.xp + XP.tx }));
    toast(`${tx.gain ? 'Gain' : 'Dépense'} enregistré · +${XP.tx} XP`);
    if (tx.d.slice(0, 7) !== mois) setMois(tx.d.slice(0, 7));
  };

  const supprimerTx = id => maj(prev => ({ txs: prev.txs.filter(t => t.id !== id) }));

  const basculerCharge = id => {
    maj(prev => {
      const charges = prev.charges.map(ch => (ch.id === id ? { ...ch, coupe: !ch.coupe } : ch));
      const coupee = charges.find(ch => ch.id === id).coupe;
      if (coupee) toast(`Abonnement coupé (simulation) · +${XP.coupe} XP`);
      return { charges, xp: prev.xp + (coupee ? XP.coupe : 0) };
    });
  };

  const enregistrerCharge = charge => {
    maj(prev => ({
      charges: prev.charges.some(ch => ch.id === charge.id)
        ? prev.charges.map(ch => (ch.id === charge.id ? charge : ch))
        : [...prev.charges, charge],
    }));
    setModale(null); setChargeEdit(null);
  };

  const supprimerCharge = id => {
    maj(prev => ({ charges: prev.charges.filter(ch => ch.id !== id) }));
    setModale(null); setChargeEdit(null);
  };

  const verserFonds = () => {
    const montant = Math.max(1, etat.params.versementFonds || 50);
    maj(prev => ({
      fonds: prev.fonds + montant,
      xp: prev.xp + XP.fonds,
      txs: [{ id: uid(), d: isoLocal(now), label: "Versement fonds d'urgence", amt: montant, cat: 'Autre', evit: false, gain: false }, ...prev.txs],
    }));
    toast(`${fmt(montant)} versés au fonds d'urgence · +${XP.fonds} XP`);
  };

  return (
    <div className="jvf" style={{ minHeight: '100vh', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, color: C.encre }}>
      <Entete niv={niv} xp={etat.xp} c={c} mois={mois} moisDispo={moisDispo} setMois={setMois} now={now} />

      {alerte && (
        <div style={{
          width: '100%', maxWidth: 1160, borderRadius: 14, padding: '14px 18px',
          background: c.reste < 0 ? C.rouge : C.ambre, color: '#fff', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 20px rgba(180,40,10,0.3)', animation: 'jvf-slidein 0.4s ease',
        }}>
          <span style={{ fontSize: 20, fontWeight: 900 }}>!</span>
          <span>{c.reste < 0
            ? `DÉCOUVERT ! Ton reste à vivre est négatif (${fmt(c.reste)}). Zéro dépense évitable jusqu'à la fin du mois.`
            : `Tu dépenses trop vite : ${c.consoPct} % du budget utilisé alors que le mois est à ${c.tempsPct} %. Lève le pied !`}</span>
        </div>
      )}

      <div className="jvf-grid">
        <CarteFlouz c={c} humeur={humeur} santeCouleur={santeCouleur} strict={etat.params.coachStrict} />
        <CarteBudget etat={etat} maj={maj} c={c} mois={mois} />
        <CarteSaisie c={c} mois={mois} now={now} onAjout={ajouterTx} onSupprimer={supprimerTx} onVoirTout={() => setModale('ops')} />
        <CarteBoss c={c} mois={mois} />
        <CarteCharges c={c} etat={etat} onBasculer={basculerCharge}
          onEditer={ch => { setChargeEdit(ch); setModale('charge'); }}
          onAjouter={() => { setChargeEdit(null); setModale('charge'); }} />
        <CarteObjectifs c={c} etat={etat} onVerser={verserFonds} onParams={() => setModale('params')} />
        <CarteRepartition c={c} />
      </div>

      <div style={{ width: '100%', maxWidth: 1160, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, color: C.pale }}>
        <span>Données enregistrées sur cet appareil uniquement · aucune connexion bancaire</span>
        <div style={{ display: 'flex', gap: 14 }}>
          <Bouton variante="fantome" onClick={() => setModale('params')}>Paramètres</Bouton>
          <Bouton variante="fantome" onClick={() => setModale('donnees')}>Sauvegarde &amp; export</Bouton>
        </div>
      </div>

      {modale === 'params' && <ModaleParams etat={etat} maj={maj} onFermer={() => setModale(null)} />}
      {modale === 'donnees' && <ModaleDonnees etat={etat} setEtat={setEtat} toast={toast} onFermer={() => setModale(null)} now={now} />}
      {modale === 'charge' && <ModaleCharge charge={chargeEdit} onEnregistrer={enregistrerCharge} onSupprimer={supprimerCharge} comptes={[...new Set(etat.charges.map(ch => ch.grp))]} onFermer={() => { setModale(null); setChargeEdit(null); }} />}
      {modale === 'ops' && <ModaleOperations c={c} mois={mois} onSupprimer={supprimerTx} onFermer={() => setModale(null)} />}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none', zIndex: 80 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: C.sombre, color: '#fbe4cd', borderRadius: 12, padding: '11px 18px', fontSize: 13,
            fontWeight: 700, boxShadow: '0 10px 26px rgba(60,25,8,0.4)', animation: 'jvf-pop 0.3s ease', maxWidth: '90vw',
          }}>{t.txt}</div>
        ))}
      </div>
    </div>
  );
}

// ── Entête : niveau, parcours, navigation entre les mois ───────────────────
function Entete({ niv, xp, c, mois, moisDispo, setMois, now }) {
  const idx = moisDispo.indexOf(mois);
  const nav = delta => setMois(decaleMois(mois, delta));
  return (
    <div style={{
      width: '100%', maxWidth: 1160, borderRadius: 20, padding: '22px 24px 18px',
      background: `radial-gradient(ellipse at 20% 0%, #ffd0a0 0%, transparent 55%), linear-gradient(155deg, ${C.orangeClair} 0%, ${C.orangeVif} 55%, ${C.orange} 100%)`,
      boxShadow: '0 8px 32px rgba(180,70,20,0.25)', color: '#fff',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.85 }}>Jeu de vie financier</div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5, textShadow: '0 2px 14px rgba(140,40,0,0.3)' }}>LEVEL UP</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <FlecheMois sens="-" onClick={() => nav(-1)} />
            <div style={{ fontSize: 12.5, fontWeight: 700, minWidth: 150, textAlign: 'center' }}>
              {moisLabel(mois)}
              <span style={{ opacity: 0.85, fontWeight: 500 }}>{c.key === c.keyCourant ? ` · jour ${c.jour}/${c.jours}` : c.passe ? ' · mois clos' : ' · à venir'}</span>
            </div>
            <FlecheMois sens="+" onClick={() => nav(1)} />
            {mois !== moisKey(now) && (
              <button onClick={() => setMois(moisKey(now))} style={{ border: 'none', background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Aujourd’hui</button>
            )}
          </div>
          {idx > -1 && moisDispo.length > 1 && (
            <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.8, marginTop: 4 }}>{moisDispo.length} mois enregistrés</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 260, maxWidth: 560 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>Niveau {niv.niveau} — {niv.nom}</span>
            <span>{xp} XP{niv.restant > 0 ? ` · ${niv.restant} avant le niveau ${niv.niveau + 1}` : ''}</span>
          </div>
          <Barre pct={niv.pct} couleur="linear-gradient(90deg,#fff3e0,#ffd28f)" fond="rgba(120,40,10,0.35)" />
          <div style={{ display: 'flex', marginTop: 12, gap: 4 }}>
            {NIVEAU_NOMS.map((nom, i) => (
              <div key={nom} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: i < niv.niveau ? 1 : 0.45 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: i < niv.niveau ? '#fff' : 'rgba(120,40,10,0.3)',
                  color: i < niv.niveau ? C.orange : '#fff', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.7)',
                }}>{i + 1}</div>
                <div style={{ fontSize: 8.5, fontWeight: 700, textAlign: 'center', letterSpacing: '0.03em', lineHeight: 1.2 }}>{nom}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlecheMois({ sens, onClick }) {
  return (
    <button onClick={onClick} aria-label={sens === '-' ? 'Mois précédent' : 'Mois suivant'} style={{
      border: 'none', cursor: 'pointer', width: 24, height: 24, borderRadius: 8,
      background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 13, fontWeight: 900, lineHeight: 1, fontFamily: 'inherit',
    }}>{sens === '-' ? '‹' : '›'}</button>
  );
}

// ── Carte Flouz / santé financière ─────────────────────────────────────────
function CarteFlouz({ c, humeur, santeCouleur, strict }) {
  const v = VISAGES[humeur];
  return (
    <Carte style={{ gap: 14 }}>
      <Titre>Flouz, ton compagnon</Titre>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Flouz couleur={v.col} visage={v} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Santé financière</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: santeCouleur }}>{c.sante}<span style={{ fontSize: 12, fontWeight: 700 }}>/100</span></span>
          </div>
          <Barre pct={c.sante} couleur={santeCouleur} hauteur={14} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flamme allumee={c.streak > 0} />
            <span style={{ fontSize: 13, fontWeight: 800 }}>{c.streak} j</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.doux }}>sans dépense évitable</span>
          </div>
        </div>
      </div>
      <div style={{ borderRadius: 12, padding: '12px 14px', background: 'linear-gradient(120deg,#fdf1e2,#fbe4cd)', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: C.brun }}>
        {COACH[humeur][strict ? 'strict' : 'doux']}
      </div>
    </Carte>
  );
}

// ── Carte budget du mois ───────────────────────────────────────────────────
function CarteBudget({ etat, maj, c, mois }) {
  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState('');

  const ouvrir = () => { setSaisie(String(c.revenu)); setEdition(true); };
  const valider = () => {
    const n = parseMontant(saisie);
    if (Number.isFinite(n) && n >= 0) {
      // Le mois courant (ou un mois à venir) redéfinit aussi le revenu par
      // défaut : c'est presque toujours un changement durable de salaire.
      maj(prev => ({
        revenus: { ...prev.revenus, [mois]: n },
        revenuDefaut: mois >= c.keyCourant ? n : prev.revenuDefaut,
      }));
    }
    setEdition(false);
  };

  return (
    <Carte>
      <Titre>Budget de {moisLabel(mois)}</Titre>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600, gap: 8 }}>
        <span>Revenu du mois</span>
        {edition ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Champ type="montant" valeur={saisie} onChange={setSaisie} style={{ width: 100, textAlign: 'right', fontWeight: 800 }} ariaLabel="Revenu du mois" />
            <Bouton variante="doux" onClick={valider} style={{ padding: '7px 10px', fontSize: 12 }}>OK</Bouton>
          </span>
        ) : (
          <button onClick={ouvrir} style={{ border: `1.5px solid ${C.bord}`, background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 14, fontWeight: 800, color: C.encre, cursor: 'pointer', fontFamily: 'inherit' }}>
            {fmt(c.revenu)} ✎
          </button>
        )}
      </div>
      {c.gains > 0 && <Ligne label="Gains du mois" valeur={`+ ${fmt(c.gains)}`} couleur={C.vert} />}
      <Ligne label="Charges fixes" valeur={`− ${fmt(c.chargesTotal)}`} couleur={C.brique} />
      <Ligne label="Dépensé ce mois" valeur={`− ${fmt(c.depense)}`} couleur={C.brique} />
      <div style={{ height: 1.5, background: C.rail }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reste à vivre</span>
        <span style={{ fontSize: 28, fontWeight: 900, color: c.reste < 0 ? C.rouge : c.reste < c.objEpargne ? C.ambre : C.vert }}>{fmt(c.reste)}</span>
      </div>
      <div>
        <Barre pct={c.consoPct} hauteur={16} repere={c.tempsPct}
          couleur={c.consoPct > c.tempsPct + 10 ? C.rouge : c.consoPct > c.tempsPct ? C.ambre : C.vert} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700, color: C.doux, marginTop: 4, gap: 8 }}>
          <span>{c.consoPct} % du budget variable utilisé</span>
          <span>▲ où tu devrais en être ({c.tempsPct} %)</span>
        </div>
      </div>
      <div style={{ borderRadius: 12, padding: '10px 14px', background: C.creme, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>Budget par jour restant</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: C.vert }}>{fmt(c.budgetJour)} /j</span>
      </div>
      <Aide>Objectif d’épargne ({fmt(c.objEpargne)}) déjà déduit · {c.joursRestants} jour(s) restant(s).</Aide>
    </Carte>
  );
}

// ── Carte saisie rapide ────────────────────────────────────────────────────
function CarteSaisie({ c, mois, now, onAjout, onSupprimer, onVoirTout }) {
  const dateDefaut = mois === moisKey(now) ? isoLocal(now) : `${mois}-${String(Math.min(joursDansMois(mois), 15)).padStart(2, '0')}`;
  const [gain, setGain] = useState(false);
  const [montant, setMontant] = useState('');
  const [label, setLabel] = useState('');
  const [cat, setCat] = useState('Courses');
  const [evit, setEvit] = useState(false);
  const [date, setDate] = useState(dateDefaut);
  const [erreur, setErreur] = useState('');

  useEffect(() => { setDate(dateDefaut); }, [dateDefaut]);

  const soumettre = () => {
    const amt = parseMontant(montant);
    if (!Number.isFinite(amt) || amt <= 0) { setErreur('Saisis un montant supérieur à 0.'); return; }
    setErreur('');
    onAjout({
      id: uid(), d: date, amt: Math.round(amt * 100) / 100,
      label: label.trim() || (gain ? 'Gain' : cat), cat: gain ? 'Autre' : cat,
      evit: gain ? false : evit, gain,
    });
    setMontant(''); setLabel(''); setEvit(false);
  };

  const recentes = c.txs.slice().sort((a, b) => b.d.localeCompare(a.d) || String(b.id).localeCompare(String(a.id))).slice(0, 6);

  return (
    <Carte>
      <Titre extra={<span style={{ fontSize: 11, fontWeight: 800, color: C.vert }}>+{XP.tx} XP</span>}>Saisie rapide</Titre>
      <div style={{ display: 'flex', gap: 6, background: C.creme2, borderRadius: 12, padding: 4 }}>
        <OngletSaisie actif={!gain} onClick={() => setGain(false)} couleur={C.orange}>− Dépense</OngletSaisie>
        <OngletSaisie actif={gain} onClick={() => { setGain(true); setEvit(false); }} couleur={C.vert}>+ Gain d’argent</OngletSaisie>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Champ type="montant" valeur={montant} onChange={setMontant} placeholder="0,00"
          style={{ flex: 1, fontSize: 22, fontWeight: 900 }} ariaLabel="Montant" />
        <div style={{ fontSize: 22, fontWeight: 900, alignSelf: 'center' }}>€</div>
      </div>
      <Champ valeur={label} onChange={setLabel} placeholder={gain ? 'Libellé (ex. remboursement, vente, prime)' : 'Libellé (ex. courses Carrefour)'} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.doux }}>Date</span>
        <Champ type="date" valeur={date} onChange={setDate} style={{ flex: 1 }} ariaLabel="Date de l’opération" />
      </div>
      {!gain && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATS.map(nom => <Puce key={nom} actif={cat === nom} onClick={() => setCat(nom)}>{nom}</Puce>)}
          </div>
          <button onClick={() => setEvit(v => !v)} style={{
            border: 'none', cursor: 'pointer', borderRadius: 12, padding: '11px 14px', fontSize: 13, fontWeight: 700,
            textAlign: 'left', fontFamily: 'inherit', background: evit ? C.rouge : C.creme, color: evit ? '#fff' : C.brun,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
          }}>
            <span>Dépense évitable ? (casse ta flamme)</span>
            <span style={{ fontWeight: 900 }}>{evit ? 'OUI' : 'NON'}</span>
          </button>
        </>
      )}
      {erreur && <div style={{ fontSize: 12, fontWeight: 700, color: C.rouge }}>{erreur}</div>}
      <Bouton variante={gain ? 'vert' : 'principal'} onClick={soumettre}
        style={{ padding: 14, fontSize: 15, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {gain ? 'Ajouter le gain' : 'Ajouter la dépense'}
      </Bouton>

      {recentes.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderBottom: `1px solid ${C.ligne}`, animation: 'jvf-pop 0.3s ease' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.gain ? C.vert : (CAT_COLS[t.cat] || C.doux), flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.doux }}>
              {labelJour(t.d)} · {t.gain ? 'Gain' : t.cat}{t.evit ? ' · évitable' : ''}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.gain ? C.vert : C.brique }}>{t.gain ? '+' : '−'} {fmt(t.amt)}</div>
          <button onClick={() => onSupprimer(t.id)} aria-label={`Supprimer ${t.label}`} style={{ border: 'none', cursor: 'pointer', background: 'none', color: '#c9a583', fontSize: 16, fontWeight: 800, padding: '2px 6px' }}>×</button>
        </div>
      ))}
      {c.txs.length === 0 && <Aide>Aucune opération sur {moisLabel(mois)} pour l’instant.</Aide>}
      {c.txs.length > 6 && <Bouton variante="fantome" onClick={onVoirTout}>Voir les {c.txs.length} opérations du mois</Bouton>}
    </Carte>
  );
}

function OngletSaisie({ actif, onClick, couleur, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: 9, fontSize: 13, fontWeight: 800,
      fontFamily: 'inherit', background: actif ? couleur : 'transparent', color: actif ? '#fff' : C.brun, transition: 'background 0.15s',
    }}>{children}</button>
  );
}

// ── Carte boss de fin de mois ──────────────────────────────────────────────
function CarteBoss({ c, mois }) {
  return (
    <Carte sombre style={{ gap: 13 }}>
      <Titre couleur={C.orangeClair}>Boss de fin de mois</Titre>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Golem />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Le Golem des Charges</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.8 }}>PV restants : {fmt(c.bossRestant)} de prélèvements à encaisser</div>
          <div style={{ marginTop: 6 }}>
            <Barre pct={c.bossPct} hauteur={12} fond="rgba(0,0,0,0.4)" couleur={`linear-gradient(90deg,${C.orangeClair},${C.orange})`} />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3, opacity: 0.75 }}>{c.bossPct} % du boss vaincu</div>
        </div>
      </div>
      <div style={{ borderRadius: 12, padding: '11px 14px', background: 'rgba(249,176,128,0.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 700, gap: 10 }}>
        <span>Prochaine attaque</span>
        <span style={{ color: '#ffd28f', textAlign: 'right' }}>
          {c.futures.length ? `${c.futures[0].label} · ${fmt(c.futures[0].amt)} · le ${String(c.futures[0].day).padStart(2, '0')}` : 'Aucune — tout est prélevé ce mois'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {c.victoires.map(v => (
          <div key={v.txt} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 700 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6, background: v.ok ? C.vert : 'rgba(249,176,128,0.25)',
              color: v.ok ? '#fff' : C.orangeClair, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, flexShrink: 0,
            }}>{v.ok ? '✓' : '·'}</div>
            <span style={{ opacity: v.ok ? 1 : 0.65 }}>{v.txt}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, lineHeight: 1.4 }}>
        Remplis les 3 conditions au {c.jours} {MOIS[Number(mois.slice(5, 7)) - 1]} pour vaincre le boss et gagner +{XP.boss} XP.
      </div>
    </Carte>
  );
}

// ── Carte charges fixes (entièrement éditables) ────────────────────────────
function CarteCharges({ c, etat, onBasculer, onEditer, onAjouter }) {
  const comptes = [...new Set(etat.charges.map(ch => ch.grp))];
  return (
    <Carte style={{ gap: 10 }}>
      <Titre extra={<div style={{ fontSize: 17, fontWeight: 900, color: C.brique }}>{fmt(c.chargesTotal)}<span style={{ fontSize: 11, fontWeight: 700, color: C.doux }}> /mois</span></div>}>Charges fixes</Titre>
      <Aide>Coupe un abonnement (simulation) pour gagner +{XP.coupe} XP et voir l’économie annuelle. Touche une ligne pour la modifier.</Aide>
      {comptes.map(compte => {
        const items = etat.charges.filter(ch => ch.grp === compte).sort((a, b) => a.day - b.day);
        const total = items.filter(ch => !ch.coupe).reduce((a, ch) => a + ch.amt, 0);
        return (
          <div key={compte} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.label, padding: '8px 0 4px' }}>
              <span>{compte}</span><span>{fmt(total)}</span>
            </div>
            {items.map(ch => (
              <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.ligne}` }}>
                <Interrupteur actif={!ch.coupe} onClick={() => onBasculer(ch.id)} titre={ch.coupe ? 'Réactiver' : 'Couper (simulation)'} />
                <button onClick={() => onEditer(ch)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'inherit', color: C.encre }}>
                  <div style={{ fontSize: 13, fontWeight: 700, textDecoration: ch.coupe ? 'line-through' : 'none', opacity: ch.coupe ? 0.45 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.label}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: C.doux }}>le {String(ch.day).padStart(2, '0')}{ch.abo ? ' · abonnement' : ''}</div>
                </button>
                <div style={{ fontSize: 13.5, fontWeight: 800, textDecoration: ch.coupe ? 'line-through' : 'none', opacity: ch.coupe ? 0.45 : 1 }}>{fmt(ch.amt)}</div>
              </div>
            ))}
          </div>
        );
      })}
      {c.economie > 0 && (
        <div style={{ borderRadius: 12, padding: '11px 14px', background: 'linear-gradient(120deg,#e4f2e2,#d2ecd4)', fontSize: 13, fontWeight: 800, color: C.vert, animation: 'jvf-pop 0.3s ease' }}>
          Économie simulée : {fmt(c.economie)} /mois — soit {fmt(c.economie * 12)} /an !
        </div>
      )}
      <Bouton variante="doux" onClick={onAjouter} style={{ marginTop: 4 }}>+ Ajouter une charge fixe</Bouton>
    </Carte>
  );
}

// ── Carte objectifs / défis / badges ───────────────────────────────────────
function CarteObjectifs({ c, etat, onVerser, onParams }) {
  const objectifs = [
    {
      nom: `Épargner ${fmt(c.objEpargne)} ce mois`,
      pct: Math.round(Math.max(0, Math.min(100, (c.reste / Math.max(1, c.objEpargne)) * 100))),
      stat: c.reste >= c.objEpargne ? 'sécurisé ✓' : `${fmt(Math.max(0, c.reste))} dispo`,
      col: c.reste >= c.objEpargne ? C.vert : C.ambre,
    },
    {
      nom: `Fonds d’urgence (${fmt(c.fondsCible)})`,
      pct: Math.round(Math.min(100, (c.fonds / c.fondsCible) * 100)),
      stat: fmt(c.fonds), col: C.bleu,
    },
    {
      nom: 'Zéro découvert', pct: c.reste >= 0 ? 100 : 0,
      stat: c.reste >= 0 ? 'en règle ✓' : 'dans le rouge', col: c.reste >= 0 ? C.vert : C.rouge,
    },
  ];
  return (
    <Carte style={{ gap: 14 }}>
      <Titre extra={<Bouton variante="fantome" onClick={onParams}>Régler</Bouton>}>Objectifs du mois</Titre>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {objectifs.map(o => (
          <div key={o.nom}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 4, gap: 8 }}>
              <span>{o.nom}</span><span style={{ color: o.col }}>{o.stat}</span>
            </div>
            <Barre pct={o.pct} couleur={o.col} hauteur={9} />
          </div>
        ))}
      </div>
      <Bouton variante="contour" onClick={onVerser}>+ Verser {fmt(etat.params.versementFonds || 50)} au fonds d’urgence</Bouton>

      <Titre>Défis de la semaine</Titre>
      {c.defis.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '10px 12px', background: d.ok ? '#e4f2e2' : C.creme }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: d.ok ? C.vert : '#d9b184', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{d.ok ? '✓' : '…'}</div>
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>{d.txt}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.label }}>{d.ok ? 'réussi' : `+${d.rec} XP`}</div>
        </div>
      ))}

      <Titre>Badges</Titre>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {BADGES.map(b => {
          const ok = !!etat.badges[b.id];
          return (
            <div key={b.id} title={ok ? `Obtenu le ${labelJour(etat.badges[b.id])}` : b.aide} style={{
              borderRadius: 12, padding: '10px 6px', textAlign: 'center', opacity: ok ? 1 : 0.5,
              background: ok ? 'linear-gradient(135deg,#fdf1e2,#fbe0be)' : C.creme2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 900, background: ok ? `linear-gradient(135deg,${C.orangeClair},${C.orange})` : '#e3cdb2', color: ok ? '#fff' : C.pale,
              }}>{ok ? '★' : '?'}</div>
              <div style={{ fontSize: 10, fontWeight: 800, lineHeight: 1.25 }}>{b.nom}</div>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

// ── Carte répartition par catégorie ────────────────────────────────────────
function CarteRepartition({ c }) {
  const evitTotal = c.evitables.reduce((a, t) => a + t.amt, 0);
  return (
    <Carte style={{ gap: 12 }}>
      <Titre extra={<span style={{ fontSize: 15, fontWeight: 900, color: C.brique }}>{fmt(c.depense)}</span>}>Où part l’argent</Titre>
      {c.parCat.length === 0 && <Aide>Aucune dépense enregistrée sur ce mois.</Aide>}
      {c.parCat.map(cat => (
        <div key={cat.nom}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
            <span>{cat.nom}</span>
            <span style={{ color: cat.col }}>{fmt(cat.total)} · {Math.round((cat.total / Math.max(1, c.depense)) * 100)} %</span>
          </div>
          <Barre pct={(cat.total / Math.max(1, c.maxCat)) * 100} couleur={cat.col} hauteur={9} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Stat label="Opérations" valeur={c.txs.length} />
        <Stat label="Évitables" valeur={`${c.nbEvit} · ${fmtCourt(evitTotal)}`} couleur={c.nbEvit > 3 ? C.rouge : C.encre} />
        <Stat label="Moyenne/jour" valeur={fmtCourt(c.depense / Math.max(1, c.jour))} />
      </div>
      {evitTotal > 0 && (
        <Aide>En supprimant tes dépenses évitables de ce mois, tu récupérais {fmt(evitTotal)} — soit {fmt(evitTotal * 12)} sur un an.</Aide>
      )}
    </Carte>
  );
}

function Stat({ label, valeur, couleur = C.encre }) {
  return (
    <div style={{ flex: 1, borderRadius: 12, padding: '10px 8px', background: C.creme, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: couleur }}>{valeur}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.doux, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Modales ────────────────────────────────────────────────────────────────
function ModaleParams({ etat, maj, onFermer }) {
  const p = etat.params;
  const set = patch => maj(prev => ({ params: { ...prev.params, ...patch } }));
  return (
    <Modale titre="Paramètres" onFermer={onFermer}>
      <ChampReglage label="Objectif d’épargne mensuel" valeur={p.objectifEpargne} onChange={v => set({ objectifEpargne: Math.max(0, v) })} unite="€" />
      <ChampReglage label="Cible du fonds d’urgence" valeur={p.fondsUrgenceCible} onChange={v => set({ fondsUrgenceCible: Math.max(1, v) })} unite="€" />
      <ChampReglage label="Versement par clic au fonds" valeur={p.versementFonds} onChange={v => set({ versementFonds: Math.max(1, v) })} unite="€" />
      <ChampReglage label="Revenu par défaut (nouveaux mois)" valeur={etat.revenuDefaut} onChange={v => maj({ revenuDefaut: Math.max(0, v) })} unite="€" />
      <ChampReglage label="Fonds d’urgence actuel" valeur={etat.fonds} onChange={v => maj({ fonds: Math.max(0, v) })} unite="€" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Coach strict</div>
          <Aide>Des messages sans concession plutôt que bienveillants.</Aide>
        </div>
        <Interrupteur actif={p.coachStrict} onClick={() => set({ coachStrict: !p.coachStrict })} titre="Coach strict" />
      </div>
      <Bouton onClick={onFermer}>Fermer</Bouton>
    </Modale>
  );
}

function ChampReglage({ label, valeur, onChange, unite }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Champ type="montant" valeur={valeur} onChange={v => onChange(parseMontant(v) || 0)} style={{ width: 100, textAlign: 'right', fontWeight: 800 }} ariaLabel={label} />
        <span style={{ fontWeight: 800 }}>{unite}</span>
      </span>
    </div>
  );
}

function ModaleCharge({ charge, onEnregistrer, onSupprimer, comptes, onFermer }) {
  const [form, setForm] = useState(() => charge || { id: uid(), label: '', amt: '', day: 1, grp: comptes[0] || 'Compte principal', abo: true, coupe: false });
  const [erreur, setErreur] = useState('');
  const champ = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const valider = () => {
    const amt = parseMontant(form.amt);
    if (!form.label.trim()) { setErreur('Donne un nom à cette charge.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setErreur('Montant invalide.'); return; }
    const day = Math.min(31, Math.max(1, parseInt(form.day, 10) || 1));
    onEnregistrer({ ...form, label: form.label.trim(), amt: Math.round(amt * 100) / 100, day, grp: (form.grp || 'Compte principal').trim() });
  };

  return (
    <Modale titre={charge ? 'Modifier la charge' : 'Nouvelle charge fixe'} onFermer={onFermer} largeur={460}>
      <Champ valeur={form.label} onChange={v => champ('label', v)} placeholder="Nom (ex. Netflix, loyer, assurance)" />
      <div style={{ display: 'flex', gap: 10 }}>
        <Champ type="montant" valeur={form.amt} onChange={v => champ('amt', v)} placeholder="Montant" style={{ flex: 1 }} ariaLabel="Montant" />
        <Champ type="number" valeur={form.day} onChange={v => champ('day', v)} placeholder="Jour" min="1" step="1" style={{ width: 90 }} ariaLabel="Jour de prélèvement" />
      </div>
      <div>
        <Aide>Compte de prélèvement</Aide>
        <Champ valeur={form.grp} onChange={v => champ('grp', v)} placeholder="Compte (ex. Compte CA, Revolut)" style={{ width: '100%', marginTop: 4 }} />
        {comptes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {comptes.map(cp => <Puce key={cp} actif={form.grp === cp} onClick={() => champ('grp', cp)}>{cp}</Puce>)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Abonnement résiliable</div>
          <Aide>Sert à repérer ce qui peut être coupé.</Aide>
        </div>
        <Interrupteur actif={form.abo} onClick={() => champ('abo', !form.abo)} titre="Abonnement" />
      </div>
      {erreur && <div style={{ fontSize: 12, fontWeight: 700, color: C.rouge }}>{erreur}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <Bouton onClick={valider} style={{ flex: 1 }}>Enregistrer</Bouton>
        {charge && <Bouton variante="doux" onClick={() => { if (window.confirm(`Supprimer « ${charge.label} » ?`)) onSupprimer(charge.id); }} style={{ color: C.rouge }}>Supprimer</Bouton>}
      </div>
    </Modale>
  );
}

function ModaleOperations({ c, mois, onSupprimer, onFermer }) {
  const [filtre, setFiltre] = useState('tout');
  const liste = c.txs
    .filter(t => (filtre === 'tout' ? true : filtre === 'evit' ? t.evit : filtre === 'gain' ? t.gain : t.cat === filtre))
    .sort((a, b) => b.d.localeCompare(a.d) || String(b.id).localeCompare(String(a.id)));
  const total = liste.reduce((a, t) => a + (t.gain ? 0 : t.amt), 0);
  return (
    <Modale titre={`Opérations · ${moisLabel(mois)}`} onFermer={onFermer} largeur={560}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Puce actif={filtre === 'tout'} onClick={() => setFiltre('tout')}>Tout ({c.txs.length})</Puce>
        <Puce actif={filtre === 'gain'} onClick={() => setFiltre('gain')} couleurActive={C.vert}>Gains</Puce>
        <Puce actif={filtre === 'evit'} onClick={() => setFiltre('evit')} couleurActive={C.rouge}>Évitables</Puce>
        {c.parCat.map(cat => <Puce key={cat.nom} actif={filtre === cat.nom} onClick={() => setFiltre(cat.nom)} couleurActive={cat.col}>{cat.nom}</Puce>)}
      </div>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {liste.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', borderBottom: `1px solid ${C.ligne}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.gain ? C.vert : (CAT_COLS[t.cat] || C.doux), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: C.doux }}>{labelJour(t.d)} · {t.gain ? 'Gain' : t.cat}{t.evit ? ' · évitable' : ''}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.gain ? C.vert : C.brique }}>{t.gain ? '+' : '−'} {fmt(t.amt)}</div>
            <button onClick={() => onSupprimer(t.id)} aria-label={`Supprimer ${t.label}`} style={{ border: 'none', cursor: 'pointer', background: 'none', color: '#c9a583', fontSize: 16, fontWeight: 800, padding: '2px 6px' }}>×</button>
          </div>
        ))}
        {liste.length === 0 && <Aide>Rien à afficher avec ce filtre.</Aide>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
        <span>Total dépenses affichées</span><span style={{ color: C.brique }}>{fmt(total)}</span>
      </div>
    </Modale>
  );
}

function ModaleDonnees({ etat, setEtat, toast, onFermer, now }) {
  const fichier = useRef(null);
  const [erreur, setErreur] = useState('');

  const telecharger = (contenu, nom, type) => {
    const url = URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importer = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const etatImporte = valideImport(JSON.parse(await f.text()));
      setEtat(etatImporte); sauverEtat(etatImporte);
      toast('Sauvegarde restaurée'); onFermer();
    } catch (err) {
      setErreur('Import impossible : ' + err.message);
    }
  };

  const stamp = isoLocal(now);
  return (
    <Modale titre="Sauvegarde &amp; export" onFermer={onFermer} largeur={480}>
      <Aide>Tout est stocké dans le navigateur de cet appareil. Exporte régulièrement pour ne rien perdre (nouveau téléphone, cache vidé…).</Aide>
      <Bouton onClick={() => telecharger(JSON.stringify(etat, null, 2), `jeu-de-vie-financier-${stamp}.json`, 'application/json')}>Exporter la sauvegarde (JSON)</Bouton>
      <Bouton variante="doux" onClick={() => telecharger('﻿' + versCsv(etat.txs), `operations-${stamp}.csv`, 'text/csv;charset=utf-8')}>Exporter les opérations (CSV, Excel)</Bouton>
      <Bouton variante="doux" onClick={() => fichier.current?.click()}>Restaurer une sauvegarde JSON</Bouton>
      <input ref={fichier} type="file" accept="application/json,.json" onChange={importer} style={{ display: 'none' }} />
      {erreur && <div style={{ fontSize: 12, fontWeight: 700, color: C.rouge }}>{erreur}</div>}
      <div style={{ height: 1, background: C.ligne }} />
      <Bouton variante="doux" onClick={() => {
        if (window.confirm('Effacer les opérations d’exemple et démarrer sur tes vrais chiffres ? Les charges fixes sont conservées.')) {
          const vide = { ...etatVide(now), charges: etat.charges, params: etat.params, revenuDefaut: etat.revenuDefaut };
          setEtat(vide); sauverEtat(vide);
          toast('Prêt : à toi de jouer');
          onFermer();
        }
      }}>Démarrer à vide (garder mes charges)</Bouton>
      <Bouton variante="doux" style={{ color: C.rouge }} onClick={() => {
        if (window.confirm('Tout remettre à zéro ? Les opérations, XP et badges seront perdus.')) {
          const frais = etatInitial(now);
          localStorage.removeItem(STORE_KEY);
          setEtat(frais); sauverEtat(frais);
          onFermer();
        }
      }}>Réinitialiser l’application</Bouton>
      <Aide>{etat.txs.length} opérations · {etat.charges.length} charges · {Object.keys(etat.badges).length} badges · {etat.xp} XP</Aide>
    </Modale>
  );
}
