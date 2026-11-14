# Certification « Créateur certifié »

Objectif : un abonné qui reçoit un SOS doit pouvoir faire confiance à l'identité de l'expéditeur.
Principe : **deux validations distinctes, et le badge bleu seulement après les deux.**

| Validation | Ce qu'elle prouve | Comment |
| --- | --- | --- |
| **1. Présence vérifiée** | Une personne réelle, vivante, est devant la caméra maintenant (pas une photo, pas un deepfake). Elle ne dit **pas qui** elle est. | Mini-contrôle vidéo (face → gauche → droite) fait par un **prestataire spécialisé**, facturé au contrôle. |
| **2. Identité certifiée** | Cette personne est bien l'identité publique revendiquée. | Preuve indépendante : code publié sur un compte officiel, documents d'agence ou professionnels, ou examen humain confidentiel. |

Aucun badge n'est donné sur un pseudo, une capture d'écran ou une pièce d'identité non contrôlée.

## Ce qui est construit (backend, testé)

- Comptes sociaux ajoutés avec une **URL validée par plateforme** (impossible de déclarer le compte d'un autre domaine).
- **Code unique** `CS-XXXX-XXXX`, temporaire (7 jours), 5 essais, un seul actif par créateur, effacé dès la décision.
- Validation 1 : la fonction `presence-webhook` reçoit le résultat du prestataire (signé HMAC) ; sans présence réussie
  et récente (24 h), **aucune preuve d'identité n'est examinée et aucun badge n'est possible**. 3 échecs ferment la demande.
- Validation 2 :
  - **automatique** quand la plateforme l'autorise officiellement : domaine (DNS TXT ou fichier `/.well-known`),
    YouTube (API Data), Twitch (API Helix) ;
  - **examen humain** sinon (Instagram, TikTok, X, Snapchat, Facebook n'offrent pas de lecture publique autorisée) ;
  - **procédure alternative** (documents d'agence, créateur ayant perdu ses réseaux) : échange hors application, aucune
    pièce stockée chez nous.
- **Signaux d'usurpation** : nom ou pseudo proche d'un créateur déjà certifié → jamais automatique, examen humain
  obligatoire, justification écrite exigée pour approuver.
- Administration : examiner, valider, refuser (motif obligatoire), **suspendre**, réhabiliter, **révoquer**,
  transférer un propriétaire. Toute décision est journalisée (`certification_events`).
- **Re-certification automatique** si le nom public change, si le compte officiel est modifié ou retiré, ou si le
  propriétaire change.
- Un créateur non certifié (ou suspendu, révoqué) ne peut envoyer **aucune alerte** ; le SOS exige toujours une
  authentification renforcée récente, et une application TOTP si le créateur en a activé une.
- Minimisation : codes expirés effacés chaque nuit, demandes closes purgées après 12 mois, notes après 90 jours.

## Lancer sans prestataire (mode actuel)

Réglage `certification_presence_mode` dans `app_settings` :

| Mode | Fonctionnement | Quand |
| --- | --- | --- |
| `manual` (défaut) | L'équipe mène un **appel vidéo en direct** (face, gauche, droite), puis confirme (`admin_confirm_presence`). Rien n'est enregistré. | Premiers créateurs, volume faible. |
| `off` | Pas de contrôle de présence : seule la **preuve d'identité** compte (code sur compte officiel, domaine, YouTube/Twitch, examen humain). | Tout début, créateurs peu exposés. |
| `provider` | Contrôle vidéo automatisé par un prestataire. | Quand le volume ou le risque le justifie. |

Limites à connaître : un humain en visio ne détecte pas à coup sûr un deepfake en temps réel, et ce mode ne tient pas la
charge au-delà de quelques dizaines de demandes par semaine. La vraie protection reste la **preuve de contrôle du compte
officiel** et la révision humaine des profils à risque. Pour les gros comptes ou les personnalités, garder l'appel vidéo
même quand le prestataire sera en place.

## Ce qui n'est PAS construit

1. **Le contrôle vidéo automatisé.** Détecter le vivant et les deepfakes ne se développe pas soi-même de façon fiable :
   il faut un prestataire (choix à faire : Persona, Veriff, Onfido, Sumsub, Jumio, iProov, Yoti, Stripe Identity…).
   À comparer sur : sélfie/vivant **sans document**, détection d'attaques par injection et deepfake, SDK iOS/Android/web,
   prix par contrôle, hébergement dans l'UE, durée de conservation réglable, et réutilisation d'un contrôle de référence.
   Il restera à écrire un petit adaptateur qui lance la session chez lui et appelle `presence-webhook`.
2. **L'interface réelle** (web, mobile, administration) de la certification : seul le **prototype** existe.
3. **La nouvelle vérification vidéo pour récupérer un compte** (comparer le visage à une référence établie à la
   première certification) : elle dépend du prestataire retenu.

## RGPD : le point à traiter avant tout

Un visage comparé à une référence est une **donnée biométrique** (catégorie particulière, article 9) :
- consentement explicite, séparé et révocable avant le contrôle ;
- analyse d'impact (AIPD) avant lancement ;
- **ni vidéo ni gabarit biométrique stockés chez SaveMyCommunity** : le prestataire fait le contrôle, nous ne gardons que le
  résultat, sa date et la référence de session ;
- durée de conservation côté prestataire la plus courte possible, contractuellement encadrée ;
- alternative non biométrique proposée (examen humain) pour ceux qui refusent ;
- à faire valider par un juriste, y compris pour la référence réutilisable.

## Réglages (administration → `app_settings`)

`certification_auto_platforms` (liste), `certification_code_ttl_days`, `certification_max_attempts`,
`certification_max_per_day`, `certification_similarity_x100`.
Clés API facultatives : `YOUTUBE_API_KEY`, `TWITCH_CLIENT_ID/SECRET`. Secret du webhook : `PRESENCE_WEBHOOK_SECRET`.
