#!/usr/bin/env bash
# Déploie le backend SaveMyCommunity sur votre projet Supabase : migrations, fonctions, secrets.
#
# Usage :   bash scripts/deploy-backend.sh <référence-du-projet>
#   la référence est la partie « xxxx » de https://xxxx.supabase.co (Settings → General).
# Prérequis : Node 22, `npx supabase login` déjà fait sur cette machine.
#
# Les secrets sont lus dans le fichier .env.backend (jamais commité, voir .env.backend.example)
# ou saisis à l'invite. Rien n'est affiché à l'écran.
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${1:-}"
if [[ -z "$REF" ]]; then echo "Usage : bash scripts/deploy-backend.sh <référence-du-projet>"; exit 1; fi
SB="npx --yes supabase@latest"

echo "▶ 1/5  Liaison au projet $REF"
$SB link --project-ref "$REF"

echo "▶ 2/5  Migrations de la base de données"
$SB db push --remote

# Secrets : .env.backend si présent, sinon invite masquée pour les indispensables.
[[ -f .env.backend ]] && set -a && source .env.backend && set +a
ask() { # $1 = nom, $2 = invite, $3 = "optional"
  local name="$1" value="${!1:-}"
  if [[ -z "$value" && -t 0 ]]; then read -r -s -p "$2 : " value; echo; fi
  if [[ -z "$value" && "${3:-}" != "optional" ]]; then echo "✖ $name manquant (renseignez-le dans .env.backend)"; exit 1; fi
  printf -v "$name" '%s' "$value"
}
# Secrets générés une fois si absents (à conserver : ils relient le planificateur aux fonctions).
save_secret() { # enregistre (ou remplace) NOM=valeur dans .env.backend, lisible par vous seul
  touch .env.backend && chmod 600 .env.backend
  { grep -v "^$1=" .env.backend || true; echo "$1=$2"; } > .env.backend.tmp && mv .env.backend.tmp .env.backend && chmod 600 .env.backend
}
if [[ -z "${DISPATCH_SECRET:-}" ]]; then DISPATCH_SECRET="$(openssl rand -hex 32)"; save_secret DISPATCH_SECRET "$DISPATCH_SECRET"; echo "ℹ DISPATCH_SECRET généré et enregistré dans .env.backend"; fi
if [[ -z "${PRESENCE_WEBHOOK_SECRET:-}" ]]; then PRESENCE_WEBHOOK_SECRET="$(openssl rand -hex 32)"; save_secret PRESENCE_WEBHOOK_SECRET "$PRESENCE_WEBHOOK_SECRET"; fi
if [[ -z "${REVENUECAT_WEBHOOK_SECRET:-}" ]]; then REVENUECAT_WEBHOOK_SECRET="$(openssl rand -hex 32)"; save_secret REVENUECAT_WEBHOOK_SECRET "$REVENUECAT_WEBHOOK_SECRET"; echo "ℹ REVENUECAT_WEBHOOK_SECRET généré : à coller dans RevenueCat > Webhooks > Authorization header (voir .env.backend)"; fi

SITE_URL="${SITE_URL:-https://savemycommunity.app}"
ask STRIPE_SECRET_KEY "Clé secrète Stripe (sk_…), vide pour plus tard" optional
ask STRIPE_WEBHOOK_SECRET "Secret du webhook Stripe (whsec_…), vide pour plus tard" optional
ask EXPO_ACCESS_TOKEN "Jeton Expo (facultatif)" optional
ask YOUTUBE_API_KEY "Clé API YouTube (facultatif, certification automatique)" optional
ask TWITCH_CLIENT_ID "Twitch client id (facultatif)" optional
ask TWITCH_CLIENT_SECRET "Twitch client secret (facultatif)" optional

echo "▶ 3/5  Secrets des fonctions"
args=(SITE_URL="$SITE_URL" DISPATCH_SECRET="$DISPATCH_SECRET" PRESENCE_WEBHOOK_SECRET="$PRESENCE_WEBHOOK_SECRET" REVENUECAT_WEBHOOK_SECRET="$REVENUECAT_WEBHOOK_SECRET")
for n in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET EXPO_ACCESS_TOKEN YOUTUBE_API_KEY TWITCH_CLIENT_ID TWITCH_CLIENT_SECRET; do
  [[ -n "${!n:-}" ]] && args+=("$n=${!n}")
done
$SB secrets set "${args[@]}" --project-ref "$REF" --yes >/dev/null

echo "▶ 4/5  Fonctions"
for fn in dispatch-alerts billing stripe-webhook delete-account certify presence-webhook revenuecat-webhook; do
  echo "   · $fn"; $SB functions deploy "$fn" --project-ref "$REF" --no-verify-jwt
done

echo "▶ 5/5  Planification des envois (reprises, reçus, purges)"
echo "   À coller UNE FOIS dans Supabase → SQL Editor (remplacez les valeurs) :"
echo "   select vault.create_secret('https://$REF.supabase.co/functions/v1/dispatch-alerts', 'dispatch_url');"
echo "   select vault.create_secret('<valeur de DISPATCH_SECRET dans .env.backend>', 'dispatch_secret');"

cat <<MSG

✔ Backend déployé.
Reste à faire dans le tableau de bord Supabase (réglages qui ne passent pas par le code) :
  · Authentication → Providers : activer Anonymous sign-ins et Manual linking ; Apple et Google ; désactiver Email.
  · Authentication → Attack protection : activer un CAPTCHA (Turnstile ou hCaptcha).
  · Authentication → URL configuration : Site URL = $SITE_URL ; redirections : savemycommunity://auth-callback
  · Database → Backups : activer les sauvegardes quotidiennes / PITR.
  · Premier administrateur (après votre première connexion sur le site) :
      insert into admin_roles (user_id, role) select id, 'admin' from auth.users where id = '<votre-user-id>';
MSG
