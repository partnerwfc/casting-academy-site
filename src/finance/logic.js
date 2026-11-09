// ── Jeu de Vie Financier — modèle de données et calculs purs ────────────────
// Aucune dépendance UI ici : tout est testable et réutilisable.

export const STORE_KEY = 'jvf-v2';

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const CATS = ['Courses', 'Transport', 'Sorties', 'Shopping', 'Santé', 'Logement', 'Abonnements', 'Autre'];

export const CAT_COLS = {
  Courses: '#2e7d43', Transport: '#b06a3a', Sorties: '#e08a1e', Shopping: '#c2551f',
  Santé: '#4a8a8f', Logement: '#7a5aa8', Abonnements: '#c46a9a', Autre: '#9a6a45',
};

export const SEUILS = [0, 120, 300, 550, 900, 1400];
export const NIVEAU_NOMS = ['Débutant', 'Apprenti Fourmi', 'Gestionnaire', 'Chasseur de Frais', 'Stratège', "Maître de l'Épargne"];

export const XP = { tx: 10, coupe: 25, badge: 50, boss: 100, fonds: 15 };

// Charges de départ — modifiables entièrement depuis l'interface.
export const CHARGES_DEPART = [
  { id: 'predica', label: 'Predica ass. Décès', amt: 4.5, day: 4, grp: 'Compte CA', abo: false },
  { id: 'pertevol', label: 'Perte/vol moyens paiement', amt: 1.0, day: 1, grp: 'Compte CA', abo: false },
  { id: 'protjur', label: 'Protection juridique', amt: 9.07, day: 28, grp: 'Compte CA', abo: false },
  { id: 'globe', label: 'Globe Trotter', amt: 2.0, day: 23, grp: 'Compte CA', abo: true },
  { id: 'pacifica', label: 'Tous mobiles (Pacifica)', amt: 10.39, day: 21, grp: 'Compte CA', abo: false },
  { id: 'free', label: 'Free Mobile', amt: 19.99, day: 14, grp: 'Compte CA', abo: false },
  { id: 'cofidis', label: 'COFIDIS', amt: 267.65, day: 5, grp: 'Compte CA', abo: false },
  { id: 'ugc', label: 'UGC Illimité', amt: 39.9, day: 6, grp: 'Compte CA', abo: true },
  { id: 'hd', label: 'HD Assurance (Buggy)', amt: 48.18, day: 5, grp: 'Compte CA', abo: false },
  { id: 'ratp', label: 'RATP', amt: 90.8, day: 1, grp: 'Revolut', abo: false },
  { id: 'circle', label: 'Circle Club', amt: 39.96, day: 4, grp: 'Revolut', abo: true },
  { id: 'netflix', label: 'Netflix', amt: 21.99, day: 1, grp: 'Revolut', abo: true },
  { id: 'apple', label: 'Apple (T.O)', amt: 9.99, day: 24, grp: 'Revolut', abo: true },
  { id: 'ultra', label: 'ULTRA (Revolut)', amt: 55.0, day: 9, grp: 'Revolut', abo: true },
  { id: 'spotify', label: 'Spotify', amt: 12.14, day: 8, grp: 'Revolut', abo: true },
].map(c => ({ ...c, coupe: false }));

export const BADGES = [
  { id: 'first', nom: 'Première saisie', aide: 'Enregistre une opération', cond: c => c.nbTx >= 1 },
  { id: 'streak7', nom: 'Flamme 7 jours', aide: '7 jours sans dépense évitable', cond: c => c.streak >= 7 },
  { id: 'chasseur', nom: "Chasseur d'abos", aide: 'Coupe un abonnement', cond: c => c.nbCoupees >= 1 },
  { id: 'epargne', nom: 'Épargne du mois', aide: "Objectif d'épargne tenu après le 25", cond: c => c.reste >= c.objEpargne && c.jour >= 25 },
  { id: 'zerodecouvert', nom: 'Zéro découvert', aide: 'Finir un mois dans le vert', cond: c => c.reste >= 0 && c.moisFini },
  { id: 'fonds25', nom: 'Fonds 25 %', aide: "1/4 du fonds d'urgence atteint", cond: c => c.fonds >= c.fondsCible * 0.25 },
  { id: 'fondsplein', nom: "Fonds d'urgence plein", aide: 'Cible du fonds atteinte', cond: c => c.fonds >= c.fondsCible },
  { id: 'rythme', nom: 'Rythme maîtrisé', aide: 'Après le 20, moins de 90 % du rythme', cond: c => c.jour >= 20 && c.pace <= 0.9 && c.txs.length > 0 },
  { id: 'boss', nom: 'Tueur de Golem', aide: 'Vaincre un boss de fin de mois', cond: c => c.bossVaincus >= 1 },
];

// ── Dates ──────────────────────────────────────────────────────────────────
// Toujours en heure locale : toISOString() décale d'un jour en soirée l'été.
export function isoLocal(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function moisKey(d) { return isoLocal(d).slice(0, 7); }

export function joursDansMois(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function moisLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MOIS[m - 1]} ${y}`;
}

export function moisCourt(key) { return MOIS[Number(key.slice(5, 7)) - 1]; }

export function decaleMois(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return moisKey(d);
}

export function labelJour(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MOIS[m - 1].slice(0, 4)}.`;
}

export function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(n) ? n : 0);
}

export function fmtCourt(n) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' €';
}

export function parseMontant(v) {
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── État par défaut ────────────────────────────────────────────────────────
export function etatInitial(now = new Date()) {
  const key = moisKey(now);
  const jour = now.getDate();
  const j = n => `${key}-${String(Math.min(n, jour)).padStart(2, '0')}`;
  return {
    version: 2,
    revenuDefaut: 2200,
    revenus: {},                 // { '2026-08': 2300 } — surcharge ponctuelle
    charges: CHARGES_DEPART,
    txs: [
      { id: uid(), d: j(3), label: 'Courses Carrefour', amt: 54.3, cat: 'Courses', evit: false, gain: false },
      { id: uid(), d: j(8), label: 'Resto sushis', amt: 28.5, cat: 'Sorties', evit: true, gain: false },
      { id: uid(), d: j(12), label: 'Essence', amt: 45, cat: 'Transport', evit: false, gain: false },
      { id: uid(), d: j(16), label: 'Courses Lidl', amt: 38.7, cat: 'Courses', evit: false, gain: false },
      { id: uid(), d: j(18), label: 'Ciné + popcorn', amt: 15, cat: 'Sorties', evit: true, gain: false },
    ],
    fonds: 120,
    xp: 20,
    badges: {},                  // { id: 'YYYY-MM-DD' }
    boss: {},                    // { '2026-08': true } — boss vaincu, XP versée
    defisReussis: {},            // { '2026-08:streak3': true }
    params: { objectifEpargne: 200, fondsUrgenceCible: 1000, coachStrict: false, versementFonds: 50 },
  };
}

// Même structure, sans les données d'exemple : pour démarrer sur ses vrais
// chiffres sans avoir à supprimer les opérations de démonstration.
export function etatVide(now = new Date()) {
  return { ...etatInitial(now), txs: [], xp: 0, fonds: 0, badges: {}, boss: {}, defisReussis: {} };
}

export function chargerEtat(now = new Date()) {
  const base = etatInitial(now);
  try {
    const brut = JSON.parse(localStorage.getItem(STORE_KEY));
    if (brut && Array.isArray(brut.txs)) return fusionner(base, brut);
  } catch (e) { /* stockage illisible : on repart de zéro */ }
  return base;
}

// Fusion tolérante : un état sauvegardé par une version antérieure garde ses
// données et récupère les champs manquants.
export function fusionner(base, brut) {
  return {
    ...base,
    ...brut,
    charges: Array.isArray(brut.charges) && brut.charges.length
      ? brut.charges.map(c => ({ abo: false, coupe: false, grp: 'Autre', day: 1, ...c, amt: Number(c.amt) || 0 }))
      : base.charges,
    txs: brut.txs.map(t => ({ ...t, amt: Number(t.amt) || 0, gain: !!t.gain, evit: !!t.evit })),
    revenus: brut.revenus || {},
    badges: brut.badges || {},
    boss: brut.boss || {},
    defisReussis: brut.defisReussis || {},
    params: { ...base.params, ...(brut.params || {}) },
  };
}

export function sauverEtat(etat) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(etat)); } catch (e) { /* quota plein */ }
}

// ── Calculs du mois ────────────────────────────────────────────────────────
export function revenuDuMois(etat, key) {
  const v = etat.revenus?.[key];
  return Number.isFinite(v) ? v : etat.revenuDefaut;
}

export function calcMois(etat, key, now = new Date()) {
  const keyCourant = moisKey(now);
  const jours = joursDansMois(key);
  const passe = key < keyCourant;
  const futur = key > keyCourant;
  const moisFini = passe;
  // Jour de référence : aujourd'hui pour le mois courant, fin de mois pour un
  // mois passé, premier jour pour un mois à venir.
  const jour = key === keyCourant ? now.getDate() : passe ? jours : 1;

  const charges = etat.charges.filter(c => !c.coupe);
  const chargesTotal = charges.reduce((a, c) => a + c.amt, 0);
  const chargesCoupees = etat.charges.filter(c => c.coupe);
  const economie = chargesCoupees.reduce((a, c) => a + c.amt, 0);

  const txs = etat.txs.filter(t => t.d.slice(0, 7) === key);
  const depense = txs.filter(t => !t.gain).reduce((a, t) => a + t.amt, 0);
  const gains = txs.filter(t => t.gain).reduce((a, t) => a + t.amt, 0);
  const revenu = revenuDuMois(etat, key);
  const reste = revenu + gains - chargesTotal - depense;
  const varBudget = Math.max(1, revenu - chargesTotal);

  const evitables = txs.filter(t => t.evit && !t.gain);
  const nbEvit = evitables.length;

  // La flamme se mesure sur tout l'historique, pas seulement sur le mois vu.
  const derniereEvit = etat.txs.filter(t => t.evit && !t.gain).reduce((max, t) => (t.d > max ? t.d : max), '');
  const streak = derniereEvit
    ? Math.max(0, Math.round((dateMinuit(now) - dateMinuit(new Date(derniereEvit + 'T00:00:00'))) / 86400000))
    : Math.min(99, etat.txs.length ? joursDepuis(etat.txs, now) : 0);

  const pace = depense / (varBudget * Math.max(0.05, jour / jours));
  let sante = 100 - nbEvit * 6 - Math.max(0, pace - 1) * 80;
  if (reste < 0) sante = Math.min(sante, 10);
  sante = Math.round(Math.max(0, Math.min(100, sante)));

  const objEpargne = etat.params.objectifEpargne;
  const fondsCible = Math.max(1, etat.params.fondsUrgenceCible);

  const consoPct = Math.round(Math.min(100, (depense / varBudget) * 100));
  const tempsPct = Math.round((jour / jours) * 100);
  const joursRestants = Math.max(1, jours - jour + 1);
  const budgetJour = Math.max(0, reste - objEpargne) / joursRestants;

  // Boss : prélèvements pas encore passés dans le mois courant.
  const futures = charges.filter(c => c.day > jour).sort((a, b) => a.day - b.day);
  const bossRestant = futur ? chargesTotal : passe ? 0 : futures.reduce((a, c) => a + c.amt, 0);
  const bossPct = Math.round(((chargesTotal - bossRestant) / Math.max(1, chargesTotal)) * 100);

  const defis = [
    { id: 'streak3', ok: streak >= 3, txt: `3 jours sans dépense évitable (${Math.min(3, streak)}/3)`, rec: 30 },
    { id: 'evit2', ok: txs.length > 0 && nbEvit <= 2 && jour >= 7, txt: `Max 2 évitables ce mois (${nbEvit}/2)`, rec: 30 },
    { id: 'moitie', ok: txs.length > 0 && jour >= 15 && depense <= varBudget * 0.5, txt: 'À la mi-mois, moins de 50 % du budget variable dépensé', rec: 30 },
  ];

  const victoires = [
    { ok: reste >= 0, txt: 'Finir le mois sans découvert' },
    { ok: reste >= objEpargne, txt: `Garder ${fmt(objEpargne)} d'épargne de côté` },
    { ok: nbEvit <= 3, txt: `Max 3 dépenses évitables (${nbEvit}/3)` },
  ];
  const bossVaincu = victoires.every(v => v.ok);

  const parCat = CATS.map(nom => ({
    nom,
    total: txs.filter(t => !t.gain && t.cat === nom).reduce((a, t) => a + t.amt, 0),
    col: CAT_COLS[nom],
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const maxCat = parCat.reduce((m, c) => Math.max(m, c.total), 0);

  return {
    key, keyCourant, jour, jours, passe, futur, moisFini, moisFiniOuEnCours: !futur,
    revenu, charges, chargesTotal, chargesCoupees, economie,
    txs, depense, gains, reste, varBudget, nbEvit, evitables,
    streak, pace, sante, objEpargne, fondsCible, fonds: etat.fonds,
    consoPct, tempsPct, joursRestants, budgetJour,
    futures, bossRestant, bossPct, victoires, bossVaincu, defis,
    parCat, maxCat,
    nbTx: etat.txs.length, nbCoupees: chargesCoupees.length,
    bossVaincus: Object.values(etat.boss || {}).filter(Boolean).length,
  };
}

function dateMinuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

function joursDepuis(txs, now) {
  const premiere = txs.reduce((min, t) => (!min || t.d < min ? t.d : min), '');
  if (!premiere) return 0;
  return Math.max(0, Math.round((dateMinuit(now) - dateMinuit(new Date(premiere + 'T00:00:00'))) / 86400000));
}

export function niveauDepuisXp(xp) {
  let niveau = 1;
  SEUILS.forEach((seuil, i) => { if (xp >= seuil) niveau = i + 1; });
  const suivant = SEUILS[niveau] ?? Math.round(SEUILS[SEUILS.length - 1] * 1.5);
  const precedent = SEUILS[niveau - 1];
  const pct = Math.round(Math.min(100, ((xp - precedent) / Math.max(1, suivant - precedent)) * 100));
  return { niveau, nom: NIVEAU_NOMS[niveau - 1], suivant, pct, restant: Math.max(0, suivant - xp) };
}

// Badges nouvellement obtenus (l'appelant décide de les enregistrer).
export function nouveauxBadges(etat, c, now = new Date()) {
  return BADGES.filter(b => !etat.badges[b.id] && b.cond(c)).map(b => b.id);
}

// Balaye tous les mois connus et renvoie les récompenses pas encore versées.
export function recompensesEnAttente(etat, now = new Date()) {
  const keys = new Set(etat.txs.map(t => t.d.slice(0, 7)));
  keys.add(moisKey(now));
  const boss = {}; const defis = {}; let xp = 0; const messages = [];
  [...keys].sort().forEach(key => {
    const c = calcMois(etat, key, now);
    if (c.moisFini && c.bossVaincu && !etat.boss[key]) {
      boss[key] = true; xp += XP.boss;
      messages.push(`Golem de ${moisLabel(key)} vaincu ! +${XP.boss} XP`);
    }
    c.defis.forEach(d => {
      const cle = `${key}:${d.id}`;
      if (d.ok && !etat.defisReussis?.[cle]) {
        defis[cle] = true; xp += d.rec;
        messages.push(`Défi réussi : ${d.txt.replace(/\s*\([^)]*\)$/, '')} · +${d.rec} XP`);
      }
    });
  });
  return { xp, boss, defis, messages };
}

// ── Import / export ────────────────────────────────────────────────────────
export function versCsv(txs) {
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const lignes = [['date', 'libelle', 'montant', 'type', 'categorie', 'evitable'].join(';')];
  txs.slice().sort((a, b) => a.d.localeCompare(b.d)).forEach(t => {
    lignes.push([t.d, esc(t.label), String(t.amt).replace('.', ','), t.gain ? 'gain' : 'depense', t.gain ? '' : t.cat, t.evit ? 'oui' : 'non'].join(';'));
  });
  return lignes.join('\n');
}

export function valideImport(brut) {
  if (!brut || typeof brut !== 'object' || !Array.isArray(brut.txs)) throw new Error('Fichier non reconnu');
  return fusionner(etatInitial(), brut);
}
