# Déploiement

Ce qui suit demande des comptes que vous seul pouvez créer. Rien n'est facturé avant
la mise en production, sauf le compte développeur Apple.

## 1. Supabase

1. Créer un projet sur supabase.com (région UE).
2. Lier et pousser le schéma :

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

3. Authentification → Email : longueur du code OTP = 6. Remplacer le contenu des deux
   modèles **Confirm signup** et **Magic Link** par `supabase/templates/otp.html`
   (ils doivent afficher `{{ .Token }}` : l'app attend un code, pas un lien).
4. Authentification → URL : `https://communitysafe.com` et le schéma `communitysafe://auth-callback`.
5. Fournisseurs Apple et Google (identifiants obtenus aux étapes 3 et 4).
6. Brancher un vrai service d'e-mail (SMTP) : l'envoi intégré est limité à quelques
   messages par heure.
7. Déployer le worker et ses secrets :

```bash
npx supabase secrets set DISPATCH_SECRET=<valeur aléatoire longue> EXPO_ACCESS_TOKEN=<jeton Expo>
```

```bash
npx supabase functions deploy dispatch-alerts
```

8. Planification (reprises et reçus) — dans l'éditeur SQL :

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/dispatch-alerts', 'dispatch_url');
select vault.create_secret('<DISPATCH_SECRET>', 'dispatch_secret');
```

9. Premier administrateur (après s'être connecté une fois sur le site) :

```sql
insert into admin_roles (user_id, role)
select id, 'admin' from auth.users where email = 'vous@exemple.com';
```

   À la première visite de `/admin`, l'application d'authentification (TOTP) est exigée.
10. Activer les sauvegardes PITR et planifier un test de restauration.

## 2. Site web (Vercel)

Nouveau projet Vercel, **Root Directory** : `community-safe/apps/web`.
Variables : voir `apps/web/.env.example`. Domaine : `communitysafe.com`.

## 3. iOS

1. Compte Apple Developer (99 $/an).
2. Identifiant d'app `com.communitysafe.app` avec *Push Notifications*,
   *Sign in with Apple* et *Associated Domains*.
3. Renseigner `APPLE_TEAM_ID` sur Vercel (active les Universal Links).

## 4. Android

1. Compte Google Play Console (25 $ une fois).
2. Projet Firebase → ajouter l'app Android → `google-services.json` dans
   `apps/mobile/`, puis `"googleServicesFile": "./google-services.json"` dans
   `app.json` (`expo.android`).
3. Clé de compte de service FCM V1 à téléverser dans Expo (*Credentials*).
4. Empreinte SHA-256 du certificat de signature → `ANDROID_SHA256_FINGERPRINTS` sur Vercel.

## 5. Application (EAS)

```bash
cd apps/mobile && npx eas-cli@latest init
```

Renseigne `extra.eas.projectId` dans `app.json` (indispensable aux jetons push).

```bash
npx eas-cli@latest build --profile development --platform all
```

Installer ce build sur un **vrai téléphone** : les notifications push ne fonctionnent
ni sur simulateur iOS ni dans Expo Go.

```bash
npx eas-cli@latest build --profile production --platform all
```

```bash
npx eas-cli@latest submit --platform all
```

## 6. Recette avant lancement public

Sur un iPhone et un Android réels :

- [ ] Ouvrir `communitysafe.com/@test` sans l'app → suivre → installer → se connecter → la communauté est là.
- [ ] Même lien avec l'app installée → ouvre directement le profil.
- [ ] Autoriser les notifications → « M'envoyer une alerte de test » → la notification arrive, app fermée.
- [ ] Appui sur la notification → détail de l'alerte, pas le lien.
- [ ] SOS réel d'un créateur vérifié vers un second téléphone ; suivi d'envoi cohérent.
- [ ] Désactiver les SOS d'un créateur → ne plus rien recevoir.
- [ ] Refuser les notifications → message clair, aucun jeton en base.
- [ ] Exporter puis supprimer un compte.

## 7. Phase 2 — paiements

- Web : Stripe Checkout + portail client + webhook (Edge Function) qui met à jour
  `subscriptions` et `payments`. Renseigner `plans.stripe_price_id`.
- iOS / Android : l'abonnement créateur est un service numérique consommé dans
  l'app ; les règles des stores imposent en principe l'achat intégré s'il est
  vendu **dans** l'app. Option la plus simple au départ : souscription sur le web
  uniquement, sans lien ni incitation d'achat dans l'app, puis achats intégrés
  (RevenueCat) si nécessaire. À valider au moment de la soumission, les règles évoluent.

## 8. Supervision

Ajouter Sentry (`@sentry/react-native`, `@sentry/nextjs`) et une alerte sur les
journaux `dispatch_failed` / `expo_send_http_error` de la fonction.
