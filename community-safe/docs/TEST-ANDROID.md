# Essai sur un téléphone Android

Prérequis : projet Supabase déployé (`bash scripts/deploy-backend.sh <ref>`), Anonymous sign-ins et Google activés,
compte Expo gratuit, projet Firebase avec `google-services.json` et la clé de service FCM V1 téléchargés.

## 1. Connecter l'app
```bash
cd community-safe && pnpm install
cp apps/mobile/.env.example apps/mobile/.env
```
Renseigner dans `apps/mobile/.env` : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé publique), `EXPO_PUBLIC_WEB_URL=https://savemycommunity.app`.

## 2. Notifications Android
```bash
cp ~/Downloads/google-services.json apps/mobile/google-services.json
```
Dans `apps/mobile/app.json`, sous `expo.android`, ajouter : `"googleServicesFile": "./google-services.json"`.

## 3. Compte Expo et build
```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest credentials --platform android
```
Dans `credentials` : Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → téléverser la clé JSON.
```bash
npx eas-cli@latest build --profile development --platform android
```
Installer l'APK depuis le lien ou le QR code affiché (autoriser les sources inconnues).

## 4. Lancer
```bash
pnpm dev:mobile   # depuis community-safe ; ouvrir l'app installée, elle se connecte au serveur
```

## 5. Scénario
1. Téléphone A (ou site web) : connexion Google → créer l'espace créateur.
2. Téléphone B : ouvrir `savemycommunity.app/@pseudo` ou chercher le créateur → Suivre (sans compte) → autoriser les notifications.
3. Supabase → SQL Editor, pour l'essai uniquement :
```sql
insert into admin_roles (user_id, role) select id, 'admin' from auth.users where email = '<votre-email-google>';
update creator_profiles set verification_status = 'verified' where handle = '<pseudo>';  -- essai uniquement
```
4. A : Lancer une alerte → SOS → confirmer. B doit recevoir la notification app fermée ; toucher la notification ouvre l'alerte.
