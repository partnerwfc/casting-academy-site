# Jeu de Vie Financier — « Level Up »

Outil de gestion des dépenses, servi sur **`/finance`** (le site vitrine reste sur `/`).
Version fonctionnelle du prototype `Jeu de Vie Financier autonome`.

## Utilisation

```bash
npm run dev     # http://localhost:5173/finance
npm run build
```

## Ce que fait l'outil

- **Budget du mois** : revenu (modifiable, mémorisé par mois), charges fixes, dépenses,
  reste à vivre, budget par jour restant, et une jauge comparant le rythme de dépense
  à l'avancement du mois.
- **Saisie rapide** : dépense ou gain, montant (virgule acceptée), libellé, date,
  catégorie, marquage « évitable ».
- **Charges fixes éditables** : ajout, modification, suppression, regroupement par
  compte de prélèvement, et simulation de résiliation avec économie mensuelle/annuelle.
- **Historique** : navigation mois par mois, liste filtrable des opérations,
  répartition par catégorie et coût annualisé des dépenses évitables.
- **Gamification** : XP et niveaux, santé financière, flamme (jours sans dépense
  évitable), boss de fin de mois, défis et badges.
- **Sauvegarde** : export JSON (restaurable), export CSV des opérations,
  démarrage à vide, réinitialisation.

## Données

Tout est stocké dans le `localStorage` du navigateur sous la clé `jvf-v2` — rien n'est
envoyé sur un serveur, aucune connexion bancaire. Les données sont donc liées à
l'appareil et au navigateur : exporter le JSON est le seul moyen de les transférer.

## Organisation

| Fichier | Rôle |
| --- | --- |
| `logic.js` | Modèle, calculs du mois, badges/défis, import-export. Sans dépendance UI. |
| `ui.jsx` | Palette et primitives (cartes, barres, champs, modale). |
| `FinanceTool.jsx` | Écran complet et cartes métier. |
