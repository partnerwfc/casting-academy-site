# Community Safe

**Never lose your community.** — « Ton compte peut disparaître. Pas ta communauté. »

Canal de secours indépendant entre un créateur et sa communauté : les abonnés suivent
gratuitement, le créateur envoie une alerte SOS (ou une annonce importante) le jour où
son compte disparaît. Pas de fil, pas de likes, pas de messagerie.

> Ce dossier vit pour l'instant dans le dépôt `casting-academy-site`, sans toucher au
> site existant. Il est autonome et peut être déplacé tel quel dans son propre dépôt.

## Contenu

| Dossier | Rôle |
| --- | --- |
| `apps/mobile` | Application iOS/Android (Expo SDK 58, expo-router, TypeScript) |
| `apps/web` | Site, liens universels `/@pseudo`, tableau de bord créateur, administration (Next.js 16) |
| `packages/shared` | Types, traductions (en/fr/pt/es), contrôle des liens, logique d'envoi push |
| `supabase/migrations` | Schéma PostgreSQL, RLS, fonctions métier, planification |
| `supabase/functions/dispatch-alerts` | Worker d'envoi des notifications (Edge Function) |
| `supabase/tests`, `e2e` | Tests base de données et test de bout en bout |
| `docs` | Architecture, déploiement, sécurité & RGPD |

## Démarrage local

Prérequis : Node 22, pnpm 10, Docker (pour Supabase local).

```bash
pnpm install
```

```bash
npx supabase start
```

Copier les clés affichées dans `apps/web/.env.local` et `apps/mobile/.env`
(modèles : `.env.example`), puis :

```bash
pnpm dev:web
```

```bash
pnpm dev:mobile
```

Les e-mails de connexion (codes à 6 chiffres) arrivent dans Mailpit : http://127.0.0.1:54324.

Les notifications push exigent un **vrai téléphone** et un build de développement
(`eas build --profile development`) : voir `docs/DEPLOYMENT.md`.

## Tests

```bash
pnpm test
```

Tests unitaires (contrôle des liens, lots push, interprétation des tickets).

```bash
PGUSER=postgres pnpm test:db
```

Rejoue les migrations sur une base jetable et vérifie permissions, quotas, file d'envoi, RGPD.

```bash
pnpm test:e2e
```

Parcours complet sur Supabase local : inscription, suivi, vérification, SOS, envoi push
(serveur Expo simulé), boîte de réception.

```bash
pnpm typecheck
```

## État d'avancement

Fait (MVP, phase 1) : authentification sans mot de passe, profils créateurs, annuaire,
suivi, préférences SOS/annonces, tableau de bord et compteur temps réel, liens
universels, Community Transfer (lien, QR, textes, visuels, plan 7 jours, conversion),
SOS sécurisé, annonces avec quotas, file d'envoi push, historique et suivi d'envoi,
administration, export/suppression RGPD, 4 langues.

Fait mais non testé avec un vrai compte Stripe : abonnements annuels (Discovery gratuit,
Creator 29,99 €, Pro 49,99 €, Premium 99,99 €, Enterprise sur devis), changement, résiliation,
suppression de compte. Pas encore fait : achats intégrés iOS/Android, photos de profil, passkeys.

Voir `docs/DEPLOYMENT.md` pour ce qu'il reste à configurer avant un lancement.
