# Architecture

## Vue d'ensemble

```
 App mobile (Expo) ─┐                       ┌─ Expo Push ─ APNs ─ iPhone
                    ├─ Supabase (Auth, API, │
 Site web (Next.js) ┘   Postgres + RLS)     └─ Expo Push ─ FCM ── Android
                             │
                 Edge Function `dispatch-alerts`
                 (réveillée par l'app + pg_cron)
```

Aucune dépendance aux API d'Instagram, TikTok, X ou YouTube : si elles tombent,
Community Safe continue d'envoyer.

## Choix structurants

**Monorepo pnpm.** Le mobile et le web partagent types, traductions et règles
(contrôle des liens, textes de notification) via `packages/shared`.

**Supabase comme backend unique.** Auth (code e-mail, Apple, Google, TOTP), PostgreSQL,
RLS, temps réel pour le compteur, Edge Functions pour l'envoi.

**La base de données fait autorité.** Le client n'écrit jamais dans `alerts`,
`community_memberships`, `devices` ou `push_tokens`. Tout passe par des fonctions
`security definer` qui revérifient identité, propriété, statut, quotas et liens.
Un client modifié ou une requête forgée n'obtient rien de plus que l'interface.

**Expo Push Service** devant APNs et FCM : un seul format de jeton, un seul appel
d'envoi. Le fournisseur est isolé dans `packages/shared/src/push.ts` et la colonne
`push_tokens.provider` permet de passer à FCM/APNs en direct sans migration lourde.

## Parcours d'une alerte SOS

1. Le créateur rédige l'alerte. L'app demande une **vérification renforcée** : un code
   e-mail à usage unique, valable 10 minutes (paramètre `stepup_max_age_minutes`).
2. `create_alert` (SQL) vérifie : propriétaire du profil, compte actif, **identité
   vérifiée**, authentification récente, longueur, lien (HTTPS, pas d'IP, pas
   d'identifiants dans l'URL, pas de punycode, pas de raccourcisseur), limites SOS
   (3 / 24 h, 10 / 30 j) ou quota d'annonces du forfait. Une clé d'idempotence empêche
   tout double envoi.
3. Dans la même transaction, les destinataires sont figés dans `alert_recipients` :
   uniquement les membres ayant autorisé **ce** type d'alerte.
4. `dispatch-alerts` contrôle les **redirections** du lien, puis réserve les
   destinataires par lots de 500 (`FOR UPDATE SKIP LOCKED` : plusieurs workers en
   parallèle sans doublon), envoie par paquets de 100, enregistre chaque tentative.
5. Erreur passagère → nouvel essai avec délai exponentiel (30 s, 1 min, 2 min… 5 essais).
   `DeviceNotRegistered` → le jeton est invalidé. Un worker interrompu libère ses
   destinataires au bout de 5 minutes.
6. Les **reçus** Expo sont consultés 15 minutes plus tard pour confirmer la remise à
   Apple/Google.
7. Sur le téléphone, l'appui ouvre le **détail de l'alerte**. Le lien externe ne
   s'ouvre qu'après un second appui qui affiche le domaine de destination.

## Indicateurs — ne pas les confondre

| Indicateur | Source |
| --- | --- |
| Membres inscrits | `creator_profiles.member_count` (trigger) |
| Membres ayant autorisé les notifications | `devices.notifications_permission = 'granted'` |
| Appareils avec jeton valide | `push_tokens.status = 'active'` |
| Acceptées par le fournisseur | `alert_recipients.status = 'sent'` |
| Remise confirmée à Apple/Google | `delivery_attempts.receipt_status = 'ok'` |
| Ouvertes | `alert_recipients.opened_at` |

Aucun de ces chiffres ne prouve qu'une notification s'est affichée à l'écran : ni
Apple ni Google ne le communiquent.

## Lien universel `/@pseudo`

- Next.js réécrit `/@julien` vers `/c/julien` (rendu serveur, données publiques).
- iOS : `/.well-known/apple-app-site-association` · Android : `/.well-known/assetlinks.json`.
- App installée : `+native-intent.ts` convertit le lien en `/creator/julien`.
- App absente : la page web permet de suivre immédiatement (code e-mail ou Google).
  L'intention de suivi est conservée pendant la connexion, puis exécutée une fois.
  En se connectant ensuite dans l'app **avec le même compte**, l'abonné retrouve ses
  communautés — aucun pistage d'installation n'est nécessaire.
- `?s=instagram` mesure la provenance par compteur anonyme (ni IP, ni cookie).

## Montée en charge

Prêt aujourd'hui : index sur toutes les files et listes, pagination de l'annuaire,
diffusion en une requête ensembliste, workers parallélisables, compteur dénormalisé.

À faire avant plusieurs centaines de milliers de membres par créateur :
test de charge du worker (objectif mesuré, pas supposé), plusieurs workers en
parallèle déclenchés par file, partitionnement de `alert_recipients` et
`delivery_attempts` par mois, purge planifiée, envoi direct FCM/APNs si les quotas
Expo deviennent limitants.

## Continuité de service

Si Community Safe est indisponible, les alertes déjà en file restent en base et
repartent au retour du service (statuts `queued` / `pending`). Sauvegardes Supabase
quotidiennes + restauration à un instant donné (PITR) à activer en production, avec
un test de restauration trimestriel.
