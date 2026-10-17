# Team Up!

Animation de soirée en salle, vendue sur devis. Un animateur Team Up! fait jouer des invités
répartis en équipes mélangées (mariages, anniversaires, séminaires, team building).
Le produit numérique a deux parties : un **site vitrine** qui génère des demandes de devis,
et une **app de jeu** (écran joueur, écran commun projeté, régie animateur, back-office).

Projet repris **de zéro** : aucun code ni aucune base de la V1 n'est réutilisé.

## Documents de référence

Lis-les avant de concevoir quoi que ce soit. En cas de contradiction, l'ordre ci-dessous fait foi.

1. `docs/spec-jeux-v3.md` — règles des 5 jeux et des 2 duels, barèmes, chronos, budget de minutes.
   Ignore les lignes « Existant réutilisé » (numéros de migration, RPC) : elles concernent la V1.
2. `docs/cahier-des-charges.md` — acteurs, architecture, pages, écrans, exigences transverses.
3. `docs/charte-marque.md` + `design/brand/tokens.css` — charte et design tokens.
4. `design/maquettes/*.dc.html` — maquettes du site vitrine (desktop et `-mobile`).
5. `docs/lots.md` — découpage du travail.

## Stack

- Monorepo **pnpm + Turborepo**, TypeScript strict partout.
- `apps/site` : **Astro**, site vitrine statique, en français. Domaine `teamup-game.fr`.
- `apps/app` : **Next.js** (App Router), PWA. Domaine `app.teamup-game.fr`.
  Surfaces : `/[code]` (joueur), `/ecran/[code]` (écran commun), `/regie`, `/admin`.
- `packages/ui` : tokens (importés depuis `tokens.css`) et composants partagés.
- `packages/game` : logique de jeu **pure**, sans I/O (barèmes, paliers, chronos,
  calcul de durée d'un programme). Entièrement testée.
- **Supabase** (région UE) : Postgres, Auth (animateurs et admins uniquement), Realtime, Storage (photos).
- i18n de l'app : FR, EN, tamoul (`next-intl`). Vitrine : FR seulement.
- E-mails du formulaire de devis : Resend.
- Tests : Vitest (`packages/game`, logique serveur), Playwright (parcours critiques).
- Déploiement : Vercel, un projet par app.

## Règles non négociables

**Design**

- Toute couleur, taille, espacement, rayon passe par les tokens. Aucune valeur en dur.
- Corail (`--tu-accent`) réservé aux actions (« Demander un devis », « Envoyer », « c'est à toi »). Jamais en décor.
- Cibles tactiles ≥ 56 px (`--tu-tap-min`) sur l'écran joueur.
- Un seul fond dans toute l'app : le beige du logo (`--tu-bg`, `#F7F3E6`), décision du 2026-10-09.
  `data-theme="stage"` (sombre) ne sert plus qu'aux blocs marine de la vitrine.
- Polices : Poppins (titres, chiffres), Inter (texte), Noto Sans Tamil (obligatoire pour le tamoul).
- `prefers-reduced-motion` respecté.
- Vitrine : **aucune photo d'événement**, uniquement des visuels du jeu.
- Les maquettes sont une **référence visuelle** : reconstruis-les avec des composants et les tokens,
  ne recopie pas leurs styles inline. Les logos des maquettes pointent vers `/_blob/…` :
  utilise ceux de `design/brand/logo/`.
- Tout texte entre crochets dans les maquettes (`[DÉLAI]`, `[CITATION CLIENT]`, `[LOGO CLIENT]`…)
  est un contenu à fournir. Garde-le en placeholder, n'invente rien.

**Produit**

- Seuls les 5 jeux et les 2 duels de la spec v3 existent. N'en ajoute aucun.
- Le téléphone est un instrument de régie, pas un support de jeu (voir spec v3).
- Les joueurs sont anonymes : prénom seul, aucun compte, aucune donnée de contact.
- Les secrets (mot de mime, sujet de surenchère, réponse de points communs) ne quittent
  jamais le serveur vers un téléphone non désigné. À garantir côté base (RLS / fonctions),
  pas en masquant côté interface.
- Comportement en cas de coupure réseau : celui décrit jeu par jeu dans la spec v3.
- Capacité cible : 150 joueurs par événement, mise à jour des écrans en moins d'1 s.

## Façon de travailler

- Un lot de `docs/lots.md` à la fois. Commence chaque lot en mode plan et attends ma validation.
- Petits commits, un sujet chacun. Tests obligatoires pour `packages/game`.
- Si un point listé dans « Décisions ouvertes » bloque, **pose la question** au lieu de trancher.
- Si la spec et une maquette divergent, signale-le.

## Décisions ouvertes

Ne les tranche pas seul :

- Espace client (hors périmètre v1 par défaut).

## Commandes

Node 22.20 (`.nvmrc`) et pnpm 10.17. Toutes les commandes se lancent depuis la racine.

| Commande                            | Effet                                                        |
| ----------------------------------- | ------------------------------------------------------------ |
| `pnpm install`                      | Installe le monorepo                                         |
| `pnpm dev`                          | Démarre les deux apps : vitrine sur `:4321`, app sur `:3000` |
| `pnpm dev:site` / `pnpm dev:app`    | Une seule des deux                                           |
| `pnpm dev:host`                     | Idem, exposé sur le réseau local (test sur téléphone)        |
| `pnpm lint`                         | Garde-fou tokens, types de routes de l'app, puis ESLint      |
| `pnpm typecheck`                    | `tsc` sur les paquets, `astro check` sur la vitrine          |
| `pnpm test`                         | Vitest (`packages/game` et `apps/site`)                      |
| `pnpm build`                        | Build des deux apps                                          |
| `pnpm format` / `pnpm format:check` | Prettier                                                     |
| **`pnpm verify`**                   | lint + typecheck + test + build — ce que lance la CI         |
| `pnpm test:e2e`                     | Playwright sur un build de production de l'app (`:3100`)     |

Pages de contrôle des composants, dans les deux thèmes :
`http://localhost:4321/kit-ui` (Astro) et `http://localhost:3000/kit-ui` (React).

### Base de données (lot 3)

Supabase tourne en local dans Docker : **Docker Desktop doit être démarré**.

| Commande        | Effet                                                                |
| --------------- | -------------------------------------------------------------------- |
| `pnpm db:start` | Démarre la base locale (API et Realtime sur `:54321`)                |
| `pnpm db:stop`  | Arrête la base                                                       |
| `pnpm db:reset` | Rejoue toutes les migrations puis `supabase/seed.sql` (base jetable) |
| `pnpm db:types` | Régénère `apps/app/src/types/base.ts` depuis le schéma local         |

`db:start` écarte Studio, l'analytics, l'imgproxy et les autres services dont rien n'a besoin :
la pile complète demande environ 8 Go d'images et 4 Go de RAM. Le Realtime y est (lot 6).

Comptes de démo (mot de passe `motdepasse`) : `anna@teamup.test` anime la soirée `FETE24`,
`brahim@teamup.test` la soirée `BUREAU`, `admin@teamup.test` est administrateur.

Les migrations vivent dans `supabase/migrations/`, une par bloc fonctionnel, jamais modifiées
après coup : on en ajoute une. Sans base joignable, les tests qui en dépendent s'annoncent
ignorés ; la CI, elle, en démarre une, donc ils y tournent pour de bon.

## Variables d'environnement

`apps/site/.env` (modèle dans `.env.example`), déclarées dans `astro.config.mjs` (`astro:env`) :

| Variable             | Rôle                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`     | Clé Resend. **Absente : mode à sec**, les e-mails de devis s'écrivent dans la console au lieu de partir. |
| `DEVIS_DESTINATAIRE` | Adresse qui reçoit les demandes de devis.                                                                |
| `DEVIS_EXPEDITEUR`   | Expéditeur sur un domaine vérifié chez Resend, ex. `Team Up! <devis@teamup-game.fr>`.                    |
| `PUBLIC_APP_URL`     | Adresse de l'app (lien « Espace animateur », page Rejoindre). À défaut : `https://app.teamup-game.fr`.   |

À reporter dans les variables du projet Vercel de la vitrine avant la mise en ligne.

`apps/app/.env.local` (modèle dans `apps/app/.env.example`), lues côté serveur uniquement :

| Variable                        | Rôle                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                  | API Supabase. En local : `http://127.0.0.1:54321`.                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Clé du rôle de service (`SERVICE_ROLE_KEY` de `pnpm db:start`). Jamais en `NEXT_PUBLIC_`.                                    |
| `NEXT_PUBLIC_SUPABASE_URL`      | La même URL, pour la régie et l'écran (connexion, temps réel).                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (`ANON_KEY`) : publique par nature, elle n'ouvre aucun droit (lot 3).                                               |
| `NEXT_PUBLIC_APP_URL`           | Facultative. Adresse du QR code de l'écran (`https://app.teamup-game.fr`) ; à défaut, l'hôte de la requête.                  |
| `CRON_SECRET`                   | Secret de la purge quotidienne des photos (Vercel Cron l'envoie en `Authorization: Bearer`). Absente : la route refuse tout. |

## Conventions posées au lot 0

- `design/brand` est le paquet `@teamup/brand` : `tokens.css` reste la source unique de vérité,
  `packages/ui` l'importe, personne ne le recopie.
- Les styles ne sont écrits qu'une fois, en CSS dans `packages/ui/src/styles`. Les composants
  Astro (`@teamup/ui/astro/*.astro`) et React (`@teamup/ui/react`) ne font que poser les classes.
  La vitrine n'embarque donc aucun React.
- Polices auto-hébergées (`@fontsource`) : aucune requête vers Google.
- Les paquets du workspace sont consommés en TypeScript source, sans étape de build.
- TypeScript reste en 5.9 tant que `typescript-eslint` n'accepte pas la 7.

## Conventions posées au lot 1

- Logotype (`.tu-wordmark`) : « Up » sauge et « ! » corail conservés sur fond clair, malgré un
  contraste de 1,98:1. Exemption WCAG 1.4.3 (logotypes), décision assumée : axe et Lighthouse
  le signalent, c'est la seule alerte attendue. Exclure `.tu-wordmark` des contrôles de contraste.
- Le plugin Astro de Prettier réindente les commentaires CSS multilignes à chaque passage :
  dans les `<style>` des `.astro`, commentaires sur une seule ligne.

## Conventions posées au lot 5

- Les joueurs passent uniquement par les routes `apps/app/src/app/api/partie/[code]/…`, qui
  appellent les fonctions joueur avec le rôle de service (`src/serveur/`, `server-only`).
  Session : cookie httpOnly `tu_j_<CODE>`, la base n'en voit que le SHA-256.
- Équipe attribuée à l'arrivée (la moins remplie), sous verrou par événement. La régie
  pourra déplacer un joueur au lot 6.
- L'écran d'attente relit l'état toutes les 4 s (`useEtatJoueur`). Le temps réel poussé,
  au lot 6, remplacera ce hook sans toucher aux écrans.
- Langue du joueur : cookie `tu_langue`, `next-intl` sans préfixe d'URL. Messages dans
  `apps/app/messages/`, le français fait référence (types et test des clés).
  **Le tamoul est un premier jet, à faire relire par un locuteur natif.**
- `apps/app/AGENTS.md` et `CLAUDE.md` sont écrits par `next dev` 16 : on les garde versionnés.

## Conventions posées au lot 6

- Régie et écran commun agissent sous la **session de l'animateur** (Supabase SSR, rafraîchie
  par `src/proxy.ts`) : la RLS s'applique, le rôle de service n'y sert jamais. L'écran commun
  est une seconde fenêtre de la régie ; sur un autre appareil, l'animateur s'y connecte.
- Une ligne `pilotage` par événement dit ce que la salle voit. On ne l'écrit que par
  `enregistrer_etape` (une transaction, version contrôlée, chrono posé par la base) ; on la
  lit, avec tout le reste, par `etat_ecran`, qui ne sort un secret qu'à l'étape qui le montre
  à la salle (la régie, `p_regie`, voit tout).
- Une touche de régie : `calculerEtape` (`src/lib/pilotage.ts`, règles de `packages/game`),
  écriture directe depuis le navigateur, puis un signal broadcast **sans données** sur
  `salle:<id>` : l'écran relit aussitôt. `postgres_changes` ne sert qu'aux arrivées et aux
  corrections de score ; ne pas y ajouter une table que le signal couvre déjà.
- Latence régie → écran mesurée par `e2e/partie.spec.ts` sur build de production : médiane
  sous 500 ms et 90e centile sous 1 s exigés.
- Contenus à l'écran dans toutes les langues de la soirée (la première en grand), libellés de
  l'écran dans la première. Régie en fr, en et ta (tamoul à relire).
- Sur le thème stage, l'équipe 1 passe au navy 500 avec un liseré : le navy 700 disparaît
  sur le fond navy 900.

## Conventions posées au lot 7

Tranché le 2026-09-24 : quiz **sans repêchage** (3 ou 4 questions, 4 par défaut) ; file de
mime **sans plafond** dans l'app (la composer revient à l'animateur).

- Mime : le mot se montre à J1 **sur l'écran de régie seulement** (spec v3). `secret_visible`
  ne le sort vers l'écran qu'au verdict ; aucun téléphone ne le reçoit, `joueur_designe_id`
  n'y sert pas.
- Quiz : le mode (croix ou téléphone) se fixe **au lancement de la manche**, dans
  `manches.options.mode` (`enregistrer_etape` fusionne `p_manche.options`). Une question par
  passage : révélée = passage terminé ; annulée = terminé avec `resultat.annulee`, elle ne compte pas.
- Réponses du mode téléphone : table `reponses_quiz`, écrite **uniquement** par
  `repondre_quiz` (rôle de service), qui refuse tout sauf une première réponse d'un
  participant encore en jeu, question ouverte, chrono pas écoulé à l'heure de la base (+1 s).
  Pas de réponse = éliminé ; arrivé après la 1re question = spectateur.
- Les survivants se calculent **en base** (`quiz_joueurs`, `survivants_quiz`) ; les points,
  une seule fois, par `scoreQuiz` à la validation, quel que soit le mode. Les survivants validés
  sont gardés dans `manches.options.survivants` pour l'écran.
- Téléphones : ils écoutent le même signal `salle:<id>` que l'écran (clé anon, sans données) et
  relisent `/api/partie/[code]/etat`, étalés sur 250 ms ; la relecture de 4 s reste en secours.
  `etat_joueur` expose donc `evenement.id`.
- La régie écoute en plus les `INSERT` de `reponses_quiz` (compteur de réponses) ; l'écran non.

## Conventions posées au lot 8

Tranché le 2026-09-24 : clôture des envois photo **des deux façons**, bouton de la régie
(confirmé, réouverture possible tant que la diffusion n'a pas commencé) et clôture automatique
au lancement de la diffusion (déclencheur `manches_clore_photos`).

- Les thèmes sont les passages de la manche `photo2`, choisis à la préparation. L'écran Photos
  du joueur est ouvert toute la soirée ; seul le capitaine envoie, une photo par thème,
  remplaçable jusqu'à la clôture.
- Le téléphone compresse avant tout (`src/lib/compression.ts` : 1 600 px de côté, JPEG
  dégressif, sous `TAILLE_MAX_PHOTO`), puis met en file dans IndexedDB (`src/joueur/filePhotos.ts`,
  repli en mémoire) : une entrée par thème, la dernière photo prise remplace celle qui attendait.
  La file repart au retour du réseau et toutes les 15 s.
- `POST /api/partie/[code]/photo` dépose le fichier dans le bucket, puis appelle
  `envoyer_photo` (rôle de service), qui refuse session inconnue, non-capitaine, envois clos
  (heure de la base) ou thème étranger. Rejouer le même envoi ne change rien : la file peut
  réessayer sans risque. L'ancienne photo remplacée est retirée du bucket.
- `etat_ecran` donne des **chemins** : à la régie toujours, à l'écran une fois la diffusion
  lancée (il précharge tout). Les images passent par des URL signées, que seule la session
  de l'animateur obtient (`usePhotosSignees`).
- La gagnante d'un thème est reportée sur `photos.gagnante` par déclencheur, dans la
  transaction de `enregistrer_etape` : l'export du lot 10 n'aura qu'à la lire.
- Latences e2e : `partie.spec.ts` exige médiane < 500 ms et 90e centile < 1 s ;
  `quiz.spec.ts` (trente téléphones simulés sur la même machine) exige 90e centile < 1 s et
  aucune touche au-delà de 1,5 s.

## Conventions posées au lot 9

Tranché le 2026-10-03 : l'admin crée un compte avec un **mot de passe provisoire** (aucun
e-mail), que l'animateur change dans `/regie/compte` ; un contenu a le **français obligatoire**,
l'anglais et le tamoul facultatifs ; l'historique des événements est au back-office dès ce lot.

- `/admin` (contenus, animateurs, historique) : même coque et thème stage que la régie,
  gardé par `exigerAdmin()` (404 pour un animateur) ; la RLS du lot 3 reste la vraie garde.
- Un contenu s'écrit **uniquement** par `enregistrer_contenu` (une transaction : contenu,
  traductions, secrets), qui revérifie en base la forme de chaque langue, le français et la
  même bonne réponse du quiz partout. La saisie et le filtre vivent dans `src/lib/contenus.ts`.
- Rien ne se supprime : contenus et animateurs se **désactivent**. Un déclencheur garde
  toujours un admin actif ; un admin ne se désactive pas lui-même.
- Le rôle de service ne sert au back-office qu'à créer l'utilisateur Auth
  (`src/serveur/comptes.ts`) ; la fiche `animateurs` s'écrit sous la session de l'admin.
  Les e-mails viennent de `annuaire_animateurs()`, réservée à l'admin.
- Préparation : un contenu n'est proposé que s'il est **complet** (partie publique et secret)
  dans toutes les langues de la soirée, et de l'étiquette du public (particulier → B2C,
  entreprise → B2B) ou tout public ; `?tout=1` lève le filtre du public, jamais celui des
  langues. Le contenu déjà choisi pour un passage reste toujours dans son menu.
- `pnpm db:types` écrit le fichier même quand la base ne répond pas : il le vide. Vérifier
  `git diff --stat` après coup.

## Conventions posées au lot 10

Tranché le 2026-10-03 : duel gagné **+50** à l'équipe du vainqueur (la spec n'en disait rien) ;
photos conservées **30 jours** après la soirée ; mesure de la vitrine par **Vercel Web
Analytics** ; export en **CSV** et **ZIP**.

- Duels (`grab`, `cup`) : un passage par duel, une machine commune
  (`packages/game/src/pilotage/duel.ts`) : tirage, face-à-face, chrono, verdict. Les duellistes
  (id, prénom, équipe) sont gardés dans `passages.resultat` dès le tirage ; l'écran ne les
  montre qu'à « Présenter ». Tirage en rotation équitable (`tirerDuel`) sur tous les duels de la
  soirée, parmi les joueurs lus au moment du tirage.
- Tête, épaule, gobelet : la séquence se tire de l'identifiant du passage (`aleaDepuis`), donc
  identique après un rechargement, et ne s'affiche que sur la régie. Mots et pièges : premier
  jet à valider.
- Duels hors programme par défaut : section « Bêta » de la préparation seulement, avec un
  avertissement sous 60 min de créneau.
- Photos : `expire_le` = soirée + 31 jours à minuit UTC, posé par déclencheur et suivi si la
  date change. `/api/cron/purge-photos` (Vercel Cron, `apps/app/vercel.json`, 3 h UTC) retire
  le fichier puis la ligne (`src/lib/purge.ts`).
- Export : `/regie/[code]/export/scores.csv` (`;`, BOM, CRLF) et `photos.zip` (fflate, diffusé
  en flux, sans recompression), sous la session de l'animateur. **À vérifier sur Vercel avec
  une vraie soirée** : la limite de taille de réponse d'une fonction (4,5 Mo) ne devrait pas
  s'appliquer à une réponse diffusée en flux, mais rien ne l'a encore prouvé.
- Mesure : `src/lib/mesure.ts` (prévu = chronos + 15 % ; réel = `commence_le` → `termine_le`
  des manches), `/admin/mesure` et l'historique. Taux de connexion = joueurs ÷
  `evenements.invites_attendus` (facultatif, saisi à la création de la soirée).
- `pnpm add` dans un paquet peut casser les liens des autres (vu sur `@astrojs/vercel`) :
  relancer `pnpm install` à la racine.

## Conventions posées au lot 11

Tranché le 2026-10-03 : l'invité **choisit son groupe** à l'arrivée (ou « Je préfère ne pas
répondre ») ; le groupe ne sert qu'au tirage de l'équipe, **rien n'est gardé sur le joueur**.

- `groupes` (au plus 6 par soirée, écrits à la préparation sous la session de l'animateur) et
  `equipes_groupes` (un compteur par équipe et par groupe, sans aucun lien vers un joueur),
  écrit **uniquement** par `rejoindre_evenement`.
- Avec un groupe : l'équipe qui en compte le moins, puis la moins remplie, au hasard entre
  ex aequo, sous le verrou d'arrivée du lot 5. Sans groupe : comportement du lot 5 inchangé.
- La répartition affichée à la Salle est celle **des arrivées** : déplacer un joueur à la régie
  ne la change pas (on ne sait pas de quel groupe il est, et c'est voulu). Pas de rééquilibrage
  après coup.
- `evenement_public` expose les libellés des groupes ; l'étape « groupe » du téléphone
  n'apparaît que si la soirée en a.

## Conventions posées au lot 12

Tranché le 2026-10-03 : explication **codée** (ni MP4 ni vidéo générée), **20 à 30 s**, lancée
par une touche **« Expliquer »** de la régie, pour les **5 jeux et les 2 duels**.

- Scripts dans `packages/game/src/explications.ts` : des cartes `{ cle, dureeS, visuel }`,
  20 à 30 s par script, 4 s au moins par carte (testé). Le Quiz en a deux, croix et
  téléphone, puisque son mode ne se choisit qu'au lancement.
- Une étape de la scène `intro` : `explication` ou `explication-telephone`, avec le chrono de
  la salle démarré pour la durée du script. Aucune migration. L'écran déduit la carte de
  `chrono_depart_ms` (`carteA`), donc un second écran ou un rechargement retombe au même
  endroit. « Rejouer » repart de zéro, « Arrêter » remet l'étape à `null`.
- Phrases dans `ecran.explications.<script>.<cle>`, dans toutes les langues de la soirée
  (`Multilingue`, lues dans `MESSAGES`). Un test vérifie qu'à chaque carte correspond une phrase.
- Décors dans `src/ecran/explications/Visuels.tsx`, styles dans `explication.css`, tailles
  dans `tokens-layout.css` (`--tu-expl-*`). Couleurs d'équipe 1, 3, 4 et 6 seulement :
  jamais le corail. Sous `prefers-reduced-motion`, les cartes changent mais rien ne bouge.
- Hors de la durée prévue du programme et de la mesure : l'explication est à la demande et
  précède `commence_le`.

## Conventions posées au lot 13

Tranché le 2026-10-03 : l'ordre de passage des jeux joués une équipe à la fois (Points communs,
Mime) se tire **en direct, à la régie**, et l'écran l'anime ; **un ordre** tiré, repris à
chaque tour.

- Le tirage : `tirerOrdre` (Fisher-Yates) et `ordreDesPassages` dans
  `packages/game/src/ordre.ts`, avec le hasard du navigateur de la régie (`crypto.getRandomValues`).
- L'écriture : `ordonner_passages` (security invoker, une transaction, contrainte d'ordre
  différable), d'abord, puis `enregistrer_etape` avec l'étape `tirage-ordre` de l'intro et le
  chrono de la salle pour 5 s. Refusé dès qu'un passage ou la manche a commencé. La manche
  garde `options.ordre_tire`, et l'intro fixe rappelle alors l'ordre.
- L'écran (`src/ecran/TirageOrdre.tsx`) : 3 s de mélange, puis une équipe rangée par quart de
  seconde. Le mélange se tire de l'identifiant de la manche et de l'instant, donc deux écrans
  montrent le même. Sous `prefers-reduced-motion`, l'ordre final s'affiche d'emblée.

## Conventions posées le 2026-10-08 (Points communs)

Tranché le 2026-10-08 : le chrono de Points communs **s'arrête seul** à la fin des paliers 1
et 2 ; l'animateur donne l'indice ; le chrono **repart seul 5 s après** ; on peut valider
pendant l'arrêt, au score du palier qui s'ouvre ; la durée prévue du programme ne change pas.

- Aucune migration : le chrono de la base reste un instant de départ. Le temps de jeu se
  déduit du temps écoulé et des instants des indices (`tempsDeJeu`,
  `packages/game/src/points-communs.ts`) ; barème, paliers et affichage lisent ce temps de jeu.
- Les instants des indices (ms depuis le lancement) vivent dans `passages.resultat.indices_ms`
  pendant le passage (`indicesMsDe`, `src/lib/salle.ts`), écrits par la touche « Indice » avec
  le passage `en_cours`. Un second écran ou un rechargement retombe donc au même endroit.
- `passages.resultat.ecoule_ms` est le **temps de jeu**, arrêts déduits.
- Sans indice donné, le chrono attend indéfiniment : c'est voulu.

## Conventions posées le 2026-10-09 (membres des équipes)

Tranché le 2026-10-08 : à l'écran, **toutes les équipes restent affichées et les prénoms
défilent par pages** ; à la régie, membres en **étiquettes**, **recherche**, commandes d'un
invité **au clic** sur son prénom, membres de l'équipe qui passe au pilotage ; ordre
**capitaine d'abord, puis alphabétique**. Scène « Équipes » seulement (ni podium, ni appel).

- Rangement, pages et recherche : `apps/app/src/lib/membres.ts` (pur, testé). La page
  affichée se déduit de l'heure de la base (`pageA`, 5 s par page) : deux écrans montrent la
  même, toutes les cartes tournent ensemble. Au premier rendu, la page 0 (le serveur et le
  navigateur n'ont pas la même heure : sinon, erreur d'hydratation).
- Grille de la scène et pages : revues le 2026-10-17 (voir « Salle et écran des équipes »).
  En carrousel, toujours 26 prénoms par page sur une rangée de cartes, 10 sur deux, en 2 rem.
- `etat_ecran` donne `capitaine` (son prénom ou `null`) par équipe. Le client tolère son
  absence : sans la migration `20261009090000`, tri alphabétique sans capitaine marqué.
- Page Salle : la page serveur lit et se rafraîchit, `src/regie/SalleEquipes.tsx` affiche.
  Une seule fiche d'invité ouverte à la fois.

## Conventions posées le 2026-10-09 (identité : logo, beige, chargement, transitions)

Tranché le 2026-10-09 : **fond beige partout** (téléphones, écran commun, régie, back-office) ;
**pictogramme seul** sur chaque page ; écran de chargement au logo ; fondu à chaque changement
de scène et d'écran ; logo en plein écran entre deux jeux ; « Loading… » dans toutes les langues.
Les mentions plus anciennes du « thème stage » pour l'écran et la régie (lots 6, 9, 12) sont
caduques : même coque, fond beige.

- Le pictogramme est fait des quatre calques du logo (`design/brand/logo/calques/`), empilés
  par `src/marque/Pictogramme.tsx` ; styles dans `packages/ui/src/styles/components/brand.css`.
  En-tête du téléphone, de la régie et du back-office ; coin haut droit de l'écran commun avec le nom « Team Up! », sauf
  à l'accueil qui le porte près du nom.
- Chargement : `src/marque/Chargement.tsx`, branché par un `loading.tsx` dans `[code]/` (le
  téléphone), `regie/[code]/` (les pages d'une soirée) et `admin/`. **Jamais plus haut qu'un
  gabarit qui vérifie un accès** : un `loading.tsx` fait partir la réponse (200) avant le verdict
  des gabarits et des pages qu'il enveloppe, et un `notFound()` n'y donne plus un vrai 404 (vu
  sur `/admin` avec un `loading.tsx` à la racine ; `back-office.spec.ts` le garde). L'écran
  commun n'en a donc pas : sa page répond 404 à un code inconnu. Il n'apparaît qu'après
  `--tu-dur-attente` (300 ms) : une page rapide ne clignote pas. La barre va et vient, elle ne
  mesure rien. Page de contrôle : `/kit-ui/chargement`.
- Fondu : `.tu-stage__body` et les enfants de `.tu-player` fondent à leur montage. À l'écran,
  `Salle.tsx` donne à la scène la clé `scène:manche` : elle est remontée au changement de scène
  ou de jeu, **jamais par une touche pendant un jeu**.
- Interlude : quand l'intro d'un nouveau jeu arrive, le logo passe par-dessus la scène déjà à
  jour (`--tu-dur-interlude`, 1,6 s depuis qu'il porte un roulement de tambour, à garder égal à
  `INTERLUDE_MS` dans `src/lib/sons.ts` et à `INTERLUDE_S` dans `scripts/sons-elevenlabs.mjs`). Ni au rechargement, ni dans
  l'aperçu de la régie, ni sous `prefers-reduced-motion`.
- Sur beige, la sauge 500 ne tient pas comme couleur de texte ni comme repère (1,9:1) :
  `--tu-success` (sauge 700) pour les verdicts et l'état « connecté ».
- Icônes (`design/brand/icons/`, onglet du navigateur et app installée) : les quatre calques
  sur le beige du logo, fabriquées par `pnpm --filter @teamup/site icones`
  (`apps/site/scripts/icones.mjs`, `sharp` étant une dépendance de la vitrine). À relancer si
  le logo change ; ne pas les retoucher à la main.
- Revue visuelle : `node e2e/captures.mjs <dossier> [CODE]` depuis `apps/app` capture chaque
  écran en taille réelle (serveur local démarré).

## Conventions posées le 2026-10-09 (son)

Tranché le 2026-10-09 : le son sort de **l'écran commun seulement** ; chronos, verdicts, temps
forts et ambiance ; sons **composés en code**, esprit « jeu télé » du teaser ; coupure et
volume **depuis la régie**.

- Les sons sont **générés par ElevenLabs** (effets sonores à partir d'une description), puis
  recalés par `apps/app/scripts/sons-elevenlabs.mjs` (`pnpm --filter @teamup/app sons`) :
  silence coupé au début, niveau aligné, roulement monté avec la cymbale à 5 s. Une première
  série synthétisée en code a été jugée trop artificielle par l'utilisateur le 2026-10-09 et
  remplacée ; elle reste dans l'historique git (`scripts/sons.mjs`).
- Une version par son dans `apps/app/public/sons/` (5,6 Mo). Deux prises avaient été générées ;
  l'utilisateur a gardé la « a » partout le 2026-10-09, les « b » sont retirées. `--prise b`
  régénère une autre prise à la place : à faire écouter avant de commiter.
- Générer coûte des crédits ElevenLabs : les sons bruts restent dans `scripts/sons-bruts/`
  (ignoré par git, lourd) et ne sont pas redemandés. La clé (`ELEVENLABS_API_KEY`, `.env` de la
  racine) doit avoir la permission « Sound Effects ». ElevenLabs renvoie du PCM **stéréo**.
- `src/lib/sons.ts` (pur, testé) dit quel son part à quel changement d'état (`sonsPour`), quand
  l'ambiance joue (`ambianceA`, à l'accueil) et ce que bat un chrono (`sonDuChrono`, les dix
  dernières secondes). Rien ne sonne au chargement ni à la relecture d'un état inchangé.
- `src/ecran/sons/` : `creerLecteur` (Web Audio, tout décodé d'avance) et `useSons`, branché
  dans `Salle.tsx`. `SonsContexte` n'est fourni que par l'écran commun : `Chrono` et l'arrêt d'un
  palier s'en servent, donc la régie et son aperçu, qui partagent ces composants, restent muets.
- Présenter un jeu se déroule en deux temps (`deroule`) : le roulement `presentation` pendant
  que le logo est à l'écran, puis le `jingle` quand le nom du jeu paraît. Le roulement est un
  extrait de celui du tirage, monté par le script (aucune génération).
- Deux musiques de fond en boucle (`fondA`) : `ambiance` à l'accueil, `explication` sous
  l'explication animée d'un jeu. Celle-ci s'arrête à la fin du script (chrono de la salle),
  même si l'étape reste « explication » tant que la régie n'a rien touché.
- **Un son à la fois** : un son coupe celui qui jouait encore (seuls les battements du chrono se
  posent dessus), et l'ambiance s'efface dessous puis revient. **Un onglet à la fois** : celui
  qui active le son le prend aux autres onglets du même navigateur (`BroadcastChannel`), qui
  reproposent « Activer le son ». Deux écrans ouverts ne jouent donc pas en double.
- Un navigateur ne joue rien sans geste : le bouton « Activer le son » est la seule commande
  visible sur l'écran commun, à cliquer une fois par ouverture.
- Réglage : `pilotage.son_actif` et `son_volume`, écrits par `regler_son` (qui ne touche pas à
  `maj_le` : pas de « pilotage périmé » à la touche suivante), lus dans `etat_ecran.son`. Le
  client tient sans la migration `20261010090000` (actif à 80).
- Contrôle en navigateur : `window.__tuLecteur` (journal des sons joués, réglage appliqué, et
  `mesure()` : état du contexte audio et niveau réellement en sortie). Le journal seul ne prouve
  rien : un son « joué » dans un contexte fermé ne s'entend pas, vérifier `mesure()`.
- Le lecteur ne se ferme jamais dans un nettoyage d'effet : il se met en veille (`veiller`).
  En développement, React démonte et remonte chaque composant une fois ; une fermeture à ce
  moment-là rendait tout muet (vu le 2026-10-09).
- Points communs : « Lancer » remet les indices à zéro (`resultat: {}`). Sans cela, un passage
  relancé gardait les instants du premier essai et le chrono repartait seul au palier.

## Conventions posées le 2026-10-10 (vitrine : wording, mouvement, prix, légal)

Tranché le 2026-10-10 : le wording dit ce que Team Up! **apporte** (l'émotion d'abord, puis la
sérénité de l'organisateur, le nombre en preuve : jusqu'à 150 invités) ; domaine
**`teamup-game.fr`** (`teamup.fr` appartient à une autre société) ; particuliers **à partir de
690 € TTC**, offre de lancement **à partir de 470 € TTC** pour les dix premières soirées et au
plus tard jusqu'au 31/12/2026, déplacement chiffré au devis ; entreprises **sur devis**.

- Coordonnées et délai de rappel (48 heures) : une seule source, `apps/site/src/data/contact.ts`.
- **Aucun crochet visible** : un contenu qui manque se cache, il ne s'affiche pas entre crochets
  (cela remplace, pour la vitrine en ligne, la règle « garde le placeholder »). Témoignages et
  logos : `PREUVES_FOURNIES` dans `src/data/preuves.ts`. Pages masquées par un tiret bas, donc
  hors du site : `_mentions-legales.astro` et `_cgv.astro` (la société n'est pas encore créée),
  `_qui-sommes-nous.astro` (textes à fournir). Pour en remettre une : la renommer, puis rétablir
  ses liens (pied de page, `LegalLayout`, carte de l'accueil).
- Les écrans de jeu illustrés (`components/visuels/Screen*.astro`) **restent en bleu marine** :
  essayés en beige comme l'app, l'utilisateur a préféré le marine.
- Logo de la vitrine : `@teamup/ui/astro/Pictogramme.astro`, les quatre calques, mêmes classes
  que l'app.
- Mouvement : `packages/ui/src/styles/site-motion.css`, importé par la vitrine seule (transitions
  entre pages natives, entrée des hauts de page, survols). Un bloc marqué `data-tu-apparait`
  apparaît en entrant dans la fenêtre ; le script en ligne de `Base.astro` pose `tu-anime` sur
  `<html>` avant le premier affichage, donc sans script rien n'est caché. Rien ne bouge sous
  `prefers-reduced-motion`.
- Vidéo du haut de l'accueil : `VideoEcran.astro` joue `public/videos/boucle-accueil.mp4`
  seulement quand elle est à l'écran, jamais sous `prefers-reduced-motion` (l'affiche `.jpg`
  reste). Elle se compose avec Remotion dans `video/src/site/` (hors dépôt pour l'instant, avec
  le reste du projet vidéo) : le podium montre des **équipes**, jamais un joueur seul.
- Consentement : `Consentement.astro`. Le site ne dépose aucun cookie ; la mesure d'audience
  Vercel n'est plus posée d'office (`webAnalytics.enabled: false`), elle se charge après un
  « Accepter ». Deux boutons égaux, choix gardé six mois en `localStorage`, modifiable depuis
  la page Cookies (`data-tu-consentement-rouvrir`).
- Le serveur de développement d'Astro garde parfois d'anciens styles quand un fichier est
  modifié par script : le redémarrer avant de juger un rendu.

## Conventions posées le 2026-10-11 (vitrine sur téléphone)

Tranché le 2026-10-11 : sur téléphone, la vitrine reprend **les blocs, les formes et l'ordre de
la version ordinateur**, qui devient la référence des deux. Les maquettes `*-mobile.dc.html`
ne font plus foi là où elles retiraient un visuel ou transformaient des cartes en liste.

- Haut de page (`PageIntro.astro`) : surtitre, titre, **visuel**, chapeau, boutons, note. Le
  balisage ne change pas : sous 60 rem le bloc de texte passe en `display: contents` et les
  éléments se rangent par `order`. Même procédé pour « Pourquoi ça marche » et les bénéfices.
  Les deux boutons sont côte à côte quand ils tiennent, pleine largeur chacun sinon.
- Plus aucun `desktop-only` : le téléphone devant l'écran (`Stage.astro`) et les visuels
  d'accompagnement s'affichent partout. L'écran du haut de page rétrécit comme le téléphone
  (`--tu-visual-screen-zoom`), son contenu gardant la mise en page d'une pleine largeur.
- Une rangée de cartes reste une rangée de cartes : classe `.tu-rail`
  (`packages/ui/src/styles/site-rail.css`, vitrine seule). Sur ordinateur elle ne fait rien ;
  sur téléphone les cartes glissent au doigt, la suivante dépasse (`--tu-rail-item`), accroche
  carte par carte. Sélecteur triplé exprès, pour l'emporter sur la grille de chaque page.
  Réglages par bloc : `--tu-rail-item`, `--tu-rail-gap`, `--tu-rail-bord` (dans un panneau).
- Restent adaptés au petit écran, par lisibilité : les écrans de jeu illustrés (équipes en
  carré, paliers abrégés, photos en carré), la frise d'une soirée, le tableau des durées.
- **Plus de barre d'action fixe en bas d'écran** : essayée discrète (cachée quand un bouton de
  devis était visible), l'utilisateur l'a fait retirer le 2026-10-11 (« elle amochit la
  page »). Ne pas la reproposer. Cela s'écarte du cahier des charges §4 : sur téléphone,
  « Rejoindre une partie » et « Demander un devis » sont dans le menu, et « Demander un
  devis » reste en haut et en bas de chaque page.
- Lien de la page courante : le site construit sert `/les-jeux/`, le serveur de développement
  `/les-jeux` ; `SiteHeader.astro` compare sans la barre finale.
- Contrôle : captures large et téléphone de chaque page, et comparaison point par point des
  captures larges avec le site en ligne (seule la vidéo de l'accueil doit différer).

Confort d'usage, mesuré le 2026-10-11 sur le site construit (téléphone 390 px, « 4G lente »,
processeur bridé ; axe-core pour l'accessibilité) :

- Vidéo de l'accueil : sous 60 rem, `VideoEcran.astro` sert `boucle-accueil-mobile.mp4`
  (720 px de large, 1,1 Mo au lieu de 2,9), par `<source media>`. Elle se fabrique depuis la
  grande, dans `video/`, avec `pnpm exec remotion ffmpeg` et les options
  `-vf scale=720:480:flags=lanczos -crf 30 -preset slow -an -movflags +faststart`.
  **À refaire si la grande change.** Aucune lecture, donc aucun téléchargement, pour un
  visiteur en économie de données (`saveData`).
- Police des titres préchargée (`@teamup/ui/astro/PoliceTitres.astro`, Poppins 700) : sans
  cela le grand titre changeait de largeur à l'arrivée de la police et le haut de page sautait.
- Sous le doigt : 44 px au moins (`--tu-tap-compact`) pour le logo de l'en-tête, les liens du
  pied de page, le mail et le téléphone. Plus aucun texte sous 12 px.
- Texte discret du pied de page : `--tu-text-muted-on-stone` ; `--tu-text-muted` y tombait à
  4,2:1 sur la pierre. Seule alerte de contraste attendue : le logotype (lot 1).
- Saut vers une ancre : `scroll-padding-top` sur `<html>`, le titre visé s'arrête sous
  l'en-tête collant.
- Une rangée sans lien ni bouton devient focalisable tant qu'elle défile (script de
  `Base.astro`).
- Aperçu des liens partagés (WhatsApp, iMessage, réseaux) : `public/apercu-partage.jpg`,
  1 200 × 630, sur le beige : le pictogramme, dessous le nom, dessous le slogan en petit sur
  une ligne (choix du 2026-10-11, préféré à une scène de la vidéo), annoncée par `og:image`
  dans `Base.astro`
  (avec ses dimensions, et `twitter:card` en grand format). Elle se refait par
  `pnpm --filter @teamup/site apercu` (Playwright de l'app, logo pris sur le site en ligne) ;
  à relancer si le logo ou le slogan changent. WhatsApp garde un aperçu en mémoire par
  adresse : pour en voir un nouveau tout de suite, partager l'adresse avec `?v=2` au bout.

## Conventions posées le 2026-10-11 (partage, contact, référencement, vidéos des jeux)

Tranché le 2026-10-11 : Team Up! intervient **partout en France** ; Instagram
`@teamup_officiel` et WhatsApp (même numéro) s'ajoutent au contact ; on garde la demande de
consentement pour la mesure d'audience ; sur « Les jeux », **une vidéo par jeu à la place des
écrans illustrés**.

- Coordonnées, Instagram, WhatsApp et zone : toujours `apps/site/src/data/contact.ts`. Nom,
  slogan et intitulé du service : `src/data/marque.ts`.
- Où ils s'affichent, après les retraits demandés le 2026-10-11 : Instagram dans le pied de
  page et sur la confirmation, **pas dans le menu** ; WhatsApp sur la page Devis et dans le
  bloc de partage, **pas dans le pied de page**. Ne pas les y remettre.
- Retirés le même jour, à ne pas reproposer : sur « Les jeux », les repères « Durée / Qui joue
  / Téléphone » de chaque jeu ; sur « Entreprises », les formules « L'Essentiel » et « Le Grand
  format » (jamais validées ; les vraies formules à l'année restent à définir).
- Partage : `components/layout/Partage.astro`, en bas de page (jamais fixe à l'écran), posé
  par `Base.astro` sauf `partage={false}` (devis, rejoindre, pages légales, 404, kit) ; la page
  de confirmation en porte un, avec son propre titre. WhatsApp avec un message déjà écrit,
  « Copier le lien », et le partage du téléphone là où le navigateur le propose.
- Provenance des devis, **sans cookie ni stockage** (`lib/devis/provenance.ts`) : un lien
  partagé porte `?via=whatsapp|instagram|lien|partage` ; le script de `Base.astro` recopie
  `via` sur les liens internes et ajoute `depuis=<page>` aux liens vers le devis ; le
  formulaire les renvoie en champs cachés, filtrés (minuscules, chiffres, tirets, 24 au plus).
  Seul l'e-mail de l'équipe porte la ligne « Provenance », jamais l'accusé du prospect. C'est
  ce qui compense une mesure d'audience partielle. Pour une nouvelle source (flyer, salon) :
  un lien `https://teamup-game.fr/?via=<mot>`, rien à coder.
- Référencement : données structurées dans `Base.astro` (organisation, site, service, zone
  France, Instagram) et dans `Faq.astro` (les questions qui ont une réponse). **Pas de prix**
  dans ces données tant que l'offre de lancement court. Les descriptions disent « partout en
  France ». Search Console : à relier par l'utilisateur (compte Google, ligne DNS chez OVH).
- Vidéos des jeux : `video/src/site/BoucleJeu.tsx`, cinq compositions `Jeu-<fichier>`
  (4,8 s, même plateau que la boucle de l'accueil), rendues en 720 × 480
  (`--muted --crf=28 --scale=0.75`, environ 400 Ko), affiche à l'image 84, déposées dans
  `apps/site/public/videos/jeux/`. `les-jeux.astro` les joue avec `VideoEcran` ; les écrans
  illustrés restent sur les autres pages. L'affiche de la vidéo de l'accueil est chargée en
  priorité (`imagePrioritaire` de `Base.astro`).
- Vercel : `apps/site/vercel.json` pose les en-têtes de protection (pas d'intégration dans une
  autre page, types de fichiers stricts, référent limité, capteurs refusés). Pas de règle sur
  les scripts : le site en a en ligne. La fonction du formulaire tourne à Paris (`cdg1`,
  réglage du projet `teamup-site`).

## Conventions posées le 2026-10-17 (invités sans téléphone)

Tranché le 2026-10-17 : un invité sans téléphone s'ajoute **à la Salle de la régie**, par
l'animateur, ou **depuis le téléphone d'un joueur que l'animateur y autorise** ; son équipe se
**tire comme à l'arrivée** (groupe facultatif) ; au quiz en mode téléphone il est **spectateur**.

- Un invité ajouté est un joueur **sans session** : `joueurs.jeton_hash` est vide (colonne
  générée `sans_telephone`). Aucune fonction joueur ne le trouve, il n'a pas d'écran.
  Il joue tout ce qui se joue en salle, duels compris (il peut être tiré).
- Jamais capitaine (il ne peut pas envoyer de photo) ni autorisé à ajouter : deux contraintes
  de la base. `peut_ajouter` ne se pose que sur un joueur qui a un téléphone.
- Le tirage de l'équipe vit dans `placer_joueur` (interne), commun à `rejoindre_evenement`,
  `ajouter_invite` (rôle de service, jeton du parrain, sa langue) et `ajouter_invite_regie`
  (session de l'animateur, `anime()`, première langue de la soirée). La limite de 150 compte
  les invités ajoutés. Pas de lien gardé entre l'invité et qui l'a ajouté.
- Quiz : `quiz_joueurs` écarte les joueurs sans session ; ils ne comptent ni pour ni contre
  leur équipe. En mode croix, l'animateur les compte debout comme les autres.
- Régie : formulaire « Ajouter un invité » en haut de la Salle ; sur l'étiquette, un anneau
  pour « sans téléphone » (jamais compté connecté) et un « + » pour qui peut ajouter ;
  l'autorisation se donne et se retire dans la fiche de l'invité.
- Téléphone : `etat_joueur.joueur.peut_ajouter` fait paraître « Ajouter un invité » à la
  relecture suivante ; `POST /api/partie/[code]/invite` renvoie le prénom et l'équipe tirée,
  à annoncer à l'invité.
- Le test des 150 arrivées simultanées (`tests/arrivee.test.ts`) est instable sur le poste
  (dépassement de 30 s une fois sur trois, avant comme après ce changement, A/B fait le
  2026-10-17) : la CI fait foi.

## Conventions posées le 2026-10-17 (Salle et écran des équipes)

Tranché le 2026-10-17 : à la Salle, on **destitue un capitaine** (« Nommer capitaine » sur un
autre le remplace toujours) et on **retire un joueur** (suppression ; un vrai invité peut
rejoindre de nouveau par le QR code) ; à l'écran, les **8 équipes tiennent dans le cadre** et
la Salle choisit entre « **tous les noms** » (défaut) et « **carrousel** ».

- Retirer : un `delete` sous la session de l'animateur, derrière `BoutonConfirme`. Ses réponses
  au quiz partent en cascade, `passages.joueur_designe_id` et `photos.envoyee_par` passent à
  `null`. Le compteur des groupes à l'arrivée ne bouge pas (comme un déplacement, lot 11).
- Le mode vit dans `pilotage.membres_mode`, écrit par `regler_membres` (comme `regler_son` :
  ne touche pas à `maj_le`), lu dans `etat_ecran.membres_mode`. Le client tient sans la
  migration `20261017100000` (« tous »).
- La Salle prévient l'écran après chaque changement (`src/regie/SignalSalle.tsx` : le signal
  sans données de la régie sur `salle:<id>`) ; sans lui, l'écran n'écoute que les arrivées et
  attendrait sa relecture de sûreté (20 s).
- Grille (`grilleDesEquipes`, `src/lib/membres.ts`) : une rangée jusqu'à 3 équipes, puis 2 × 2,
  3 × 2 et 4 × 2. Les rangées se partagent la hauteur de la scène (`.tu-stage-teams--scene`).
  Le nom de l'équipe et son effectif sont sur une ligne.
- « Tous les noms » (`dispositionDesMembres`) : jusqu'à 20 prénoms par carte d'un coup sur deux
  rangées de cartes, 40 sur une ; au-delà, des pages équilibrées. Colonnes de prénoms selon la
  largeur des cartes (4, 3, puis 2), une seule pour une petite équipe ; rangs d'après la plus
  grande équipe (5 au moins), donc la même taille de texte sur toutes les cartes. La scène
  passe rangs et colonnes en variables CSS (des nombres) ; la police remplit le rang, bornée
  par la largeur d'une colonne et par `--tu-stage-membre-max` (requêtes de conteneur `cqh`,
  `cqi` : elle suit aussi un projecteur plus petit que 1 920 × 1 080).
- **Écart assumé au cahier des charges § 5.2** (plancher de 2 rem) en mode « tous » : environ
  1,4 rem à 8 équipes de 19, 2 rem à 4 de 19, 2,75 rem à 8 de 5 (mesuré à 1 920 × 1 080).
  Le carrousel garde 2 rem.
- `e2e/ecran-equipes.spec.ts` : 8 équipes et 150 joueurs en 1 920 × 1 080, chaque prénom dans
  le cadre et entier, destitution et retrait suivis à l'écran, bascule en carrousel.
- `e2e/partie.spec.ts` dépasse parfois son plafond de 1,5 s sur ce poste, avant comme après ces
  changements (A/B fait le 2026-10-17) : la CI fait foi.
