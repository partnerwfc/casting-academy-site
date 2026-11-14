# Sécurité, confiance et RGPD

## Modèle de menace et réponses

| Menace | Réponse |
| --- | --- |
| Faux « compte officiel » | Pseudo unique insensible à la casse, pseudos réservés. Seuls les profils **vérifiés** apparaissent dans l'annuaire et peuvent alerter. Un profil non vérifié affiche un avertissement et n'est pas indexé. |
| Compte créateur volé → fausse alerte | Vérification renforcée (code e-mail < 10 min) à chaque envoi, limites SOS, journal d'audit, blocage d'alerte et suspension par l'administration. |
| Requête forgée vers l'API | `create_alert` est le seul chemin ; `alerts` n'accepte aucune écriture directe. Les fonctions du worker sont réservées au rôle `service_role`. |
| Lien d'hameçonnage | Contrôle en base et dans le worker (redirections). Le lien n'est jamais ouvert automatiquement ; le domaine est affiché avant l'ouverture. |
| Spam / contournement des quotas | Annonces en opt-in et limitées par forfait ; SOS limités ; signalements. |
| Fuite des abonnés d'un créateur | Aucune politique RLS ne laisse un créateur lire `community_memberships` ; il n'obtient que des agrégats. |
| Accès administrateur volé | Rôle en base **et** session MFA (aal2) vérifiés côté serveur à chaque appel. |

## RLS — règles clés

- Un utilisateur ne lit que ses propres lignes (suivis, préférences, appareils, jetons, consentements).
- Un créateur ne peut pas modifier son badge, son statut, son forfait ni son compteur (privilèges par colonne).
- Une alerte n'est visible d'un abonné qu'une fois contrôlée, et seulement s'il en est destinataire.
- Tout est testé dans `supabase/tests/10_flows.test.sql`.

## Secrets

- Dans les apps : uniquement l'URL Supabase et la clé `anon` (publiques, protégées par RLS).
- Côté serveur seulement : `SUPABASE_SERVICE_ROLE_KEY`, `DISPATCH_SECRET`, `EXPO_ACCESS_TOKEN`
  (secrets de fonction), clés Stripe. Jamais dans le dépôt.
- Session mobile dans le trousseau du téléphone (Keychain / Keystore).

## Vérification d'identité

Demande par le créateur → file d'attente dans l'administration → validation manuelle.
Méthodes : contrôle d'un compte social (code à placer dans la bio ou à envoyer en
message), e-mail professionnel, domaine, pièce d'identité. La preuve est conservée
dans `creator_verifications`.

**Récupération de compte.** Le compte SaveMyCommunity repose sur l'adresse e-mail du
créateur, pas sur le réseau compromis. Recommander une adresse distincte de celle du
réseau social et, à terme, un second facteur (TOTP déjà disponible, passkeys à venir).

## RGPD

| Exigence | Mise en œuvre |
| --- | --- |
| Minimisation | E-mail, langue, suivis, préférences, jeton push. Ni IP, ni identifiant publicitaire, ni contacts. |
| Consentement | SOS activé au suivi (objet du service), annonces en opt-in ; chaque changement est tracé dans `consent_records`. |
| Accès / portabilité | `export_my_data()` — bouton « Exporter mes données ». |
| Effacement | `delete_my_account()` — suppression en cascade ; l'audit ne garde qu'une empreinte. |
| Retrait | Par créateur et par type d'alerte ; jamais réactivé sans action de l'utilisateur. |
| Jetons invalides | Désactivés dès le refus du fournisseur ; supprimés à la déconnexion ou au retrait de la permission. |
| Mineurs | Déclaration d'âge (16 ans) à l'inscription. |
| Vente de données | Aucune. Les créateurs ne voient que des compteurs. |

À faire avec un juriste avant lancement : mentions légales et identité de l'éditeur,
registre des traitements, contrats de sous-traitance (Supabase, Expo, Stripe),
transferts hors UE, durées de conservation chiffrées, textes par territoire.
Les pages `/privacy` et `/terms` sont des **projets** signalés comme tels.

## Réponse à incident

1. Bloquer l'alerte (`admin_block_alert`) ou suspendre le compte
   (`admin_set_creator_status`) : les envois en cours s'arrêtent immédiatement.
2. Consulter `audit_logs` et `delivery_attempts`.
3. Faire tourner les secrets concernés.
4. Violation de données personnelles : notification à l'autorité sous 72 h.
