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

3. **Authentification sans e-mail** (Authentification → Fournisseurs) :
   - activer **Anonymous sign-ins** (abonnés sans compte) et **Manual linking** (relier plus tard Apple/Google) ;
   - activer **Apple** et **Google** (identifiants obtenus aux étapes 3 et 4) ;
   - **désactiver le fournisseur Email** : aucun e-mail n'est envoyé, aucun SMTP n'est nécessaire ;
   - activer un **CAPTCHA** (Cloudflare Turnstile ou hCaptcha) : les connexions anonymes sont sinon exposées aux robots
     qui gonfleraient les compteurs.
4. URL du site : `https://<votre domaine>` et schéma `savemycommunity://auth-callback`.
5. Les alertes passent **uniquement par notification push** (Expo → APNs/FCM). Aucun e-mail de notification n'existe.
6. Récupération de compte : un créateur retrouve son compte via Apple/Google ; un abonné anonyme perd ses suivis s'il
   perd son téléphone sans avoir relié un compte (l'app le propose dans Profil → Sauvegarder mon compte).
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

## 2. Domaine `savemycommunity.app`

Le `.app` impose le HTTPS (liste de préchargement des navigateurs) : tout fonctionne en `https://`, jamais en `http://`.
1. Chez le registrar, pointer le domaine vers Vercel (enregistrements affichés par Vercel : `A` pour la racine, `CNAME` pour `www`).
2. Ajouter le domaine dans Vercel (Settings → Domains) ; le certificat est automatique.
3. Vérifier que ces deux adresses répondent en JSON (sans redirection) une fois `APPLE_TEAM_ID` et l'empreinte Android renseignés :
   `https://savemycommunity.app/.well-known/apple-app-site-association` et `https://savemycommunity.app/.well-known/assetlinks.json`.
4. Dans Supabase (Authentification → URL), mettre `https://savemycommunity.app` comme URL du site.

## 3. Site web (Vercel)

Nouveau projet Vercel, **Root Directory** : `community-safe/apps/web`.
Variables : voir `apps/web/.env.example`. Domaine : celui que vous aurez acheté (à vérifier chez un registrar ; j'ai écrit `savemycommunity.app` par défaut,
à remplacer dans `EXPO_PUBLIC_WEB_URL`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `associatedDomains` et `intentFilters` de `apps/mobile/app.json`).

## 3. iOS

1. Compte Apple Developer (99 $/an).
2. Identifiant d'app `com.savemycommunity.app` avec *Push Notifications*,
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

- [ ] Ouvrir `savemycommunity.app/@test` sans l'app → suivre → installer → se connecter → la communauté est là.
- [ ] Même lien avec l'app installée → ouvre directement le profil.
- [ ] Autoriser les notifications → « M'envoyer une alerte de test » → la notification arrive, app fermée.
- [ ] Appui sur la notification → détail de l'alerte, pas le lien.
- [ ] SOS réel d'un créateur vérifié vers un second téléphone ; suivi d'envoi cohérent.
- [ ] Désactiver les SOS d'un créateur → ne plus rien recevoir.
- [ ] Refuser les notifications → message clair, aucun jeton en base.
- [ ] Exporter puis supprimer un compte.

## 7. Paiements (Stripe)

Le code est écrit et testé de bout en bout avec des événements Stripe signés. Il reste à
brancher votre compte Stripe : rien ne peut être testé ni encaissé sans lui.

1. Utiliser votre compte Stripe (si c'est celui d'iCastt : voir la note ci-dessous), puis **un produit par formule payante** (Creator, Pro, Premium) avec un
   **prix annuel** récurrent (29,99 €, 49,99 €, 99,99 €).
2. Copier l'identifiant de chaque prix (`price_...`) dans `plans.stripe_price_id` :

```sql
update plans set stripe_price_id = 'price_...' where id = 'creator';
update plans set stripe_price_id = 'price_...' where id = 'pro';
update plans set stripe_price_id = 'price_...' where id = 'business';
-- Prix mensuels (créer aussi un prix mensuel par forfait dans Stripe) :
update plans set stripe_price_id_month = 'price_...' where id in ('creator');  -- idem pro, business
```

3. Portail client (Paramètres → Facturation → Portail client) : autoriser **changer de formule**
   (ajouter les trois produits), **résilier à la fin de la période**, factures et moyen de paiement.
4. Webhook : endpoint `https://<ref>.supabase.co/functions/v1/stripe-webhook`, événements
   `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid`, `invoice.payment_failed`.
5. Secrets et déploiement :

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... SITE_URL=https://savemycommunity.app
```

```bash
npx supabase functions deploy billing stripe-webhook delete-account
```

6. TVA : activer Stripe Tax, puis `STRIPE_AUTOMATIC_TAX=true` dans les secrets.
7. Tester d'abord en mode test avec la carte `4242 4242 4242 4242` : souscription, changement de
   formule, résiliation, échec de paiement, suppression de compte.

**Compte Stripe partagé avec iCastt.** Techniquement possible (produits et prix distincts), mais un compte Stripe correspond
à une entité juridique : les paiements, la TVA, les remboursements, le relevé bancaire et les litiges des deux activités se
mélangent, et un litige sur l'une peut geler l'autre. Si les deux activités relèvent de la même entreprise, créez au moins un
second compte Stripe dans la même organisation et utilisez un libellé de relevé distinct (`SaveMyCommunity`).

**Règles de fonctionnement**
- Aucun client ne peut s'attribuer un forfait payant : seul le webhook signé le fait.
- Résilier : l'abonnement reste actif jusqu'à la fin de la période payée, puis retombe à Discovery.
  La communauté n'est jamais supprimée.
- Communauté plus grande que la formule : personne n'est retiré, le SOS continue, les annonces sont suspendues.
- Supprimer son compte : l'abonnement est résilié immédiatement chez Stripe, puis toutes les données sont effacées.
  Un créateur doit retaper son pseudo.

**Apple et Google.** L'app mobile n'affiche pas de bouton d'achat : elle renvoie vers le site. Les règles des
stores sur la vente d'abonnements numériques dépendent du pays et évoluent ; à faire valider avant la soumission
(sinon, passer aux achats intégrés avec RevenueCat). Les formules payantes ne sont donc pas vendables dans l'app.

## 8. Supervision

Ajouter Sentry (`@sentry/react-native`, `@sentry/nextjs`) et une alerte sur les
journaux `dispatch_failed` / `expo_send_http_error` de la fonction.
