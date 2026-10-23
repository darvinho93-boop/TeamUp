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
mime **sans plafond** dans l'app (la composer revient à l'animateur). Revu le 2026-10-18 : **de 3
à 10 questions** à la préparation (4 par défaut), et la régie peut **terminer le quiz après
n'importe quelle réponse révélée** (« Terminer le quiz ici », confirmé) ; les questions non jouées
ne comptent pour rien (ni élimination, ni jetons), les points se calculent sur celles jouées.

- Mime : le mot se montre à J1 **sur l'écran de régie seulement** (spec v3). `secret_visible`
  ne le sort vers l'écran qu'au verdict ; aucun téléphone ne le reçoit, `joueur_designe_id`
  n'y sert pas. **Revu le 2026-10-18** : le mot paraît aussi sur l'écran commun à l'étape
  « secret » (voir « déroulé des jeux à l'écran » plus bas).
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

Tranché le 2026-10-03 : explication **codée** (ni MP4 ni vidéo générée), **20 à 30 s** (allongée
à **30 à 50 s** le 2026-10-22, la salle n'avait pas le temps de lire), lancée
par une touche **« Expliquer »** de la régie, pour les **5 jeux et les 2 duels**.

- Scripts dans `packages/game/src/explications.ts` : des cartes `{ cle, dureeS, visuel }`,
  30 à 50 s par script, 6 s au moins par carte (testé), environ 9 s chacune ; les animations
  des décors battent au pas de `--tu-dur-expl` (1 s). Le Quiz en a deux, croix et
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
  En carrousel, 26 prénoms par page sur une rangée de cartes, 10 sur deux, en 2 rem ; 7 sur une
  seule colonne quand il y a quatre cartes par rangée (7 ou 8 équipes).
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
  attendrait sa relecture de sûreté (20 s). Le signal part dès que le canal existe, au pilotage
  (`useEtatSalle`) comme à la Salle : avant, une touche frappée aussitôt la page chargée, avant
  la création du canal, se perdait (vu le 2026-10-17 et le 2026-10-18). L'écran suit une action
  de la Salle en 0,3 à 1,7 s sur le poste (l'action serveur recharge la page avant le signal) :
  les e2e lui laissent 5 s.
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
  Le carrousel garde 2 rem ; à quatre cartes par rangée, une colonne de 7 (deux colonnes de
  2 rem coupaient « Alexandrine », vu en CI le 2026-10-17 selon la page qui tournait).
- `e2e/ecran-equipes.spec.ts` : 8 équipes et 150 joueurs en 1 920 × 1 080, chaque prénom dans
  le cadre et entier, destitution et retrait suivis à l'écran, bascule en carrousel.
- `e2e/partie.spec.ts` dépasse parfois son plafond de 1,5 s sur ce poste, avant comme après ces
  changements (A/B fait le 2026-10-17) : la CI fait foi.

## Conventions posées le 2026-10-17 (capitaines et noms d'équipe)

Tranché le 2026-10-17 : à l'arrivée, l'invité **se propose comme capitaine** ou non ; la régie
**tire les capitaines** d'un bouton à la Salle (volontaires d'abord, sinon tout joueur qui a un
téléphone ; une équipe qui a déjà son capitaine le garde) ; le capitaine **renomme son équipe**
depuis son téléphone, tout de suite à l'écran, et la régie peut renommer et **bloquer** le nom.

- **Écart assumé à la spec v3** (« deux principes ») : le téléphone y sert à trois choses ;
  renommer l'équipe en est une quatrième, hors jeu, un téléphone par équipe. Le cahier des
  charges (§ 2, « rôle attribué par la régie ») reste tenu : c'est la régie qui lance le tirage.
- `joueurs.volontaire` (jamais vrai pour un invité sans téléphone), posé par
  `rejoindre_evenement(…, p_volontaire)` via `placer_joueur`. L'étape « Capitaine ? » vient après
  le prénom et le groupe ; le choix part avec l'arrivée (`volontaire` dans la route `rejoindre`).
- `tirer_capitaines(p_evenement)` : security invoker (RLS de l'animateur), une requête
  (`distinct on` par équipe, volontaires d'abord, puis au hasard), renvoie le nombre de
  capitaines nommés ; se relance sans risque après de nouvelles arrivées.
- `renommer_equipe(p_jeton_hash, p_nom)` : rôle de service ; refuse session inconnue, non-capitaine,
  nom figé, nom vide ou de plus de 24 caractères (la carte de l'écran le loge en entier). La régie
  écrit `equipes.nom` (60 au plus) et `equipes.nom_fige` sous sa session.
- Un nom changé par un téléphone n'est couvert par aucun signal de la régie : après un
  renommage réussi, **le serveur envoie lui-même le signal** `relire` sur `salle:<id>`
  (`src/serveur/signal.ts`, API de diffusion de Supabase, au mieux). Écouter les `UPDATE` de
  `equipes` (`postgres_changes`) avait été essayé : en CI, l'écran ne les recevait pas à temps.
  `equipes` reste dans la publication temps réel (migration `20261017110000`), sans abonné.
  `etat_joueur.equipe.nom_fige` masque « Renommer l'équipe » au téléphone.
- `e2e/capitaines.spec.ts` : une volontaire et un non-volontaire, tirage, renommage vu à l'écran
  sans touche de régie, nom bloqué puis renommé par la régie. Les parcours d'arrivée existants
  passent l'étape « Capitaine ? » par « Non merci ».

## Conventions posées le 2026-10-17 (ouverture de l'écran commun)

Tranché le 2026-10-17, revu le 2026-10-18 : avant la page du QR code, une **ouverture** en boucle
(les quatre ronds du teaser) ; une **nouvelle soirée démarre dessus**. Au passage à « Accueil »,
la **boucle en cours va à son terme** (on ne coupe jamais la cinématique), puis une **passe
finale** forme le logo Team Up! et son nom, et la page du QR se découvre ; depuis le 2026-10-18,
sur **la piste du reel Team Up!** (son coup sur le logo), à la place du roulement et du jingle.

- **Le logo de la soirée est retiré le 2026-10-18** (monogramme « V | M » déployé en « Vinoyan &
  Mélanie », bandeau marine et or, encart de la Salle, polices Cinzel et Great Vibes) : plus
  aucun écart à la charte. Les colonnes `evenements.logo_initiales` et `logo_titre` (migration
  `20261017121000`) **restent en base, vides et inutilisées**, à la demande de l'utilisateur ;
  `etat_ecran.evenement.logo` vaut `null` et l'écran l'ignore. Le code retiré est dans
  l'historique git (`7ca138c`, `b9056f2`).
- Base : scène `ouverture` (migration `20261017120000`, seule : une valeur d'énumération ne sert
  pas dans la transaction qui l'ajoute), scène par défaut des nouvelles soirées
  (`20261017121000`). Les soirées de test (`creerEvenementJetable`, `partie.spec`) repartent de
  l'accueil.
- Logique pure, testée (`src/lib/ouverture.ts`) : `CYCLE_OUVERTURE_MS` (9 s, égal à
  `--tu-dur-ronds-cycle`, testé), `attenteFinDeBoucle` (ce qui reste du cycle en cours), `FINALE`
  (instants de la passe finale : logo à 5 s, sur la cymbale du roulement ; nom à 5,6 s ; fondu
  vers le QR de 7,4 à 8 s).
- `Ronds` (`src/marque/Ronds.tsx`, tout en CSS dans `ouverture.css`) : `boucle` pour l'ouverture,
  `finale` pour la passe finale (mêmes images clés jusqu'au pictogramme, puis il reste, et
  « Team Up! » paraît). `src/ecran/Finale.tsx` la pose par-dessus la page du QR.
- Déroulé (`Salle.tsx`) : un effet note le départ de la boucle quand la scène d'ouverture est
  montée. Au passage d'`ouverture` à `accueil` vu par cet écran (ni au chargement, ni dans
  l'aperçu, ni sous `prefers-reduced-motion`), l'écran **garde la scène d'ouverture affichée sans
  la remonter** (`data-fin-de-boucle` sur la scène), attend `attenteFinDeBoucle`, puis montre
  l'accueil sous la passe finale, retirée à `FINALE.fin`. Si la régie quitte l'accueil entre-temps,
  la nouvelle scène s'affiche.
- Sons : `sonsDeLaFinale`, joués par `Salle.tsx` au début de la passe finale avec le lecteur du
  moment (`jouer` de `useSons` accepte un délai) ; rien au clic. L'ambiance joue à l'ouverture
  comme à l'accueil. Depuis le 2026-10-18, un seul son, `finale` : la piste du reel
  (`teamup_reel.mp4`, 6,5 s), recalée par `scripts/son-finale.mjs` (silence du début coupé, crête
  à 0,85 ; la vidéo se décode d'abord avec le ffmpeg du projet vidéo, commande dans le script ; le
  brut reste dans `scripts/sons-bruts/`, ignoré). Il part à `FINALE.logo - COUP_FINALE_MS` pour que
  son coup tombe sur le logo, à 5 s ; `COUP_FINALE_MS` (2 668 ms) est testé sur le fichier.
- Régie : « Ouverture » en tête des scènes libres du pilotage. Une soirée existante ne bascule
  pas seule sur l'ouverture.
- `e2e/ouverture.spec.ts` : ouverture à l'écran, « Accueil », l'écran reste sur la boucle
  (`data-fin-de-boucle`), puis la passe finale avec « Team Up! », puis la page du QR et son code.

## Conventions posées le 2026-10-18 (Quiz en mode jetons)

Tranché le 2026-10-18 : un troisième mode du Quiz, **jetons**. Le capitaine de chaque équipe,
réunie autour de lui, répartit **tous** les jetons de l'équipe sur les quatre réponses depuis son
téléphone (− et +, puis « Valider ») ; les jetons posés sur une mauvaise réponse sont perdus.
**Toutes les équipes partent avec l'effectif de la plus grande**, fixé au lancement. En fin de
manche, **jetons restants × 100** (le barème des survivants). 3 ou 4 questions, 30 s chacune.
Chrono écoulé sans validation : l'équipe est **figée** jusqu'à ce que la régie la **débloque**.
« Révéler » **attend** toutes les mises ; « Révéler quand même » (confirmé) coûte ses jetons non
posés à l'équipe en retard. À l'écran, **tout en direct, dans les cases des réponses**.

- **Écart assumé à la spec v3**, qui ne prévoit que les modes croix et téléphone : un troisième
  mode, pas un nouveau jeu (mêmes questions, même barème), un seul téléphone actif par équipe.
- Logique pure : `packages/game/src/jetons.ts` (`jetonsDeDepart`, `miseValide`, `jetonsApres`) ;
  côté régie, `src/lib/jetons.ts` (`capitainesManquants`, `misesDesEquipes`, `revelationPrete`).
- Base (migration `20261018090000`) : `mises_quiz`, une ligne par passage et par équipe
  (`repartition smallint[4]`, `valide`, `debloquee`), lue par l'animateur, écrite **uniquement**
  par `miser_quiz` (rôle de service ; refuse session inconnue, question fermée, non-capitaine,
  mise déjà validée, temps écoulé à l'heure de la base + 1 s sauf déblocage, mise invalide) et
  `debloquer_mise` (session de l'animateur). `jetons_quiz(manche)` chaîne les jetons : le départ
  (`manches.options.jetons`, posé par « Commencer »), puis, question révélée après question
  révélée (les annulées ne comptent pas), la mise sur la bonne réponse ; sans mise, zéro.
- `quiz_du_joueur` passe la main à `quiz_jetons_du_joueur` en mode jetons ; le mode téléphone
  gagne la clé `mode`. `etat_ecran` expose `manche.jetons`, `passage.mises` (publiques : l'écran
  les montre) et `equipe.capitaine_connecte` (téléphone vu depuis moins de 30 s).
- Temps réel : chaque mise passe par `POST /api/partie/[code]/mise`, puis le serveur envoie le
  signal **`mises`** sur `salle:<id>` (`signalerSalle(id, 'mises')`), que seuls l'écran et la
  régie écoutent : un appui de capitaine ne fait pas relire 150 téléphones. Les coéquipiers
  voient la mise à leur relecture de 4 s.
- Téléphone (`src/joueur/QuizJetons.tsx`) : la mise part 400 ms après le dernier appui, tout de
  suite à la validation, les envois en file ; un bouton tenu appuyé répète. La lettre est dans le
  texte de la ligne : une pastille ne laissait plus de place au libellé sur 360 px.
- Régie : « Mode jetons » grisé tant qu'une équipe qui a des joueurs n'a pas de capitaine ; liste
  des capitaines et de leur téléphone, lien vers la Salle. Pendant la question, la mise et le
  statut de chaque équipe (validée, en cours, figée, sans jetons), « Débloquer ». La Salle compte
  les arrivées par QR code, les connectés et les inscrits à la main.
- Écran : dans chaque case, la réponse part du milieu et monte en haut (un `::before` dont le
  `flex-grow` passe de 1 à 0 : `--tu-dur-mises-attente`, puis `--tu-dur-mises-monte`), puis les
  pastilles des équipes (`--tu-stage-mise-min`, trois par rangée) s'y ajoutent en direct, coche
  à la validation. La liste a une clé par question : l'animation repart à chaque question. Rien ne
  bouge sous `prefers-reduced-motion`.
- Explication : script `qcm2-jetons` (29 s), étape `explication-jetons`, touche « Expliquer
  (jetons) » ; `scriptExplication(jeu, mode)` prend le mode du Quiz.
- Cases du quiz à l'écran, tous modes (revu le 2026-10-18 avec le quiz d'un mariage, réponses
  longues en trois langues, qui sortaient de l'écran) : les deux rangées se partagent la hauteur,
  et `useAjusterQuiz` (`src/ecran/`) réduit le texte par pas de 5 % (`--tu-quiz-echelle`, 0,5 au
  plus bas) jusqu'à ce qu'aucune case ne déborde. En mode jetons, la place des pastilles de toutes
  les équipes en jeu est réservée d'abord (`--tu-mises-rangs`, pastilles de hauteur fixe, réduites
  avec le texte mais jamais sous 70 %). Recalculé par question et étape, au chargement des polices
  et au redimensionnement, jamais à l'arrivée d'une mise. L'e2e à 8 équipes joue une question
  longue en fr, en et ta et vérifie qu'aucune case ne déborde.
- Même mécanique pour la Surenchère (même jour, mêmes contenus de mariage) : `useAjusterTexte`
  (`src/ecran/`, générique, `useAjusterQuiz` s'appuie dessus) réduit le texte des cartes de la
  grille des thèmes (`--tu-themes-echelle` ; trois colonnes au plus, deux pour quatre thèmes,
  rangées qui se partagent la hauteur) et celui de l'écran du sujet (`--tu-surenchere-echelle` :
  thème, sujet, chrono, verdict). La mesure compare les **boîtes** des éléments au bas du bloc,
  pas `scrollHeight` : les glyphes d'un chrono géant (hauteur de ligne 1) dépassent de leur ligne
  sans rien couper, et `scrollHeight` les comptait (tout tombait à 50 % pour rien). En largeur,
  les mots longs se coupent en CSS (`overflow-wrap`, césure sauf en tamoul).
  `e2e/surenchere-ecran.spec.ts` : six thèmes longs en trois langues, chrono, verdict et grille.
- `e2e/quiz-jetons.spec.ts` : parcours à deux équipes (lancement refusé sans capitaine, mises en
  direct, gel et déblocage, révéler quand même, × 100) et contrôle des cases à 8 équipes en
  1 920 × 1 080.

## Conventions posées le 2026-10-18 (déroulé des jeux à l'écran)

Tranché le 2026-10-18 après un aperçu de soirée : au quiz, **une touche par réponse** puis
« Lancer le chrono », **dans tous les modes** ; au Mime, le mot à l'écran **le temps que le
premier de la file le lise**.

- Accueil de l'écran commun : sous le code, le **lien complet** à taper tel quel
  (`app.teamup-game.fr/CODE`, `data-testid="lien"`), à la place de « tapez le code sur … ».
- Capitaine : ses responsabilités (nom de l'équipe, photos, jetons du quiz) sont dites à
  l'arrivée (`capitaine.aide`) et sur l'écran d'attente (`attente.capitaine`).
- Points communs : à l'étape `masque`, l'écran ne montre plus que « Équipe X, ouvrez les yeux ! » :
  la consigne affichée jusque-là donnait le point commun à l'équipe qui rouvre les yeux.
- Quiz : `question` en trois temps. « Afficher la question » (la question seule, sans chrono),
  puis « Afficher la réponse A » … « D » (`proposition`, une touche chacune), puis « Lancer le
  chrono » (`lancer`, 30 s). Les propositions affichées vivent dans `pilotage.indices` (contrainte
  élargie à 0–4, migration `20261018120000`) ; « Révéler » n'est possible qu'une fois le chrono
  lancé. L'écran garde les quatre cases, celles à venir en retrait avec leur lettre seule
  (`data-affichee`). Les téléphones montrent la question seule et « Regardez l'écran : les réponses
  arrivent une à une » (`QuestionSeule`, `src/joueur/quizCommun.tsx`) ; on ne répond ni ne mise
  avant le lancement, ce que la base garantissait déjà (`chrono_depart` nul : question fermée).
- Mime : à l'étape `secret`, l'écran commun montre le mot en grand sous « Seul le premier de la
  file regarde l'écran ! » ; `secret_visible` le donne à l'écran à cette étape seulement (migration
  `20261018120000`), il disparaît au lancement de la chaîne et revient au verdict. Aucun téléphone
  ne le reçoit (testé). **Écart à la spec v3**, qui le réservait à l'écran de régie.

## Conventions posées le 2026-10-22 (retours de la démo TEAMUP)

Tranché le 2026-10-22 après la démo du 21 : paliers de Points communs **inchangés** (60 / 35 /
35 s, le code fait foi) ; explications **plus longues et plus lentes** ; langues après la première
à **80 %** de sa taille ; **plus de classement d'office** après un jeu ; une page **Instagram** et
une **clôture** ; `@teamup_officiel` sur toutes les scènes ; « Je préfère ne pas répondre » au
choix de l'animateur.

- **Écart assumé à la spec v3** : « Terminer la manche » mène au **programme** (jeu coché), plus
  au classement ; la régie montre le classement (« Scores ») quand elle le décide.
- Langues : `.tu-stage-multi` porte `--tu-multi-taille`, les langues suivantes en prennent
  `--tu-multi-ratio` (0,8). Un bloc ne règle que la variable, jamais deux tailles.
- Présentation d'un jeu : la règle dans un encadré en haut (`.tu-stage-regle`), dans toutes les
  langues de la soirée ; l'explication reprend l'encadré pour son titre.
- Points communs : une couleur par palier (`--tu-palier-1/2/3`, sauge 700, ambre, framboise ;
  jamais le corail), son temps restant sous chaque palier (`etatPaliers(...).restesS` : il descend
  pendant le palier, puis reste à 0:00) ; l'indice n porte la couleur du palier n + 1.
- Fête (`src/ecran/Celebration.tsx`, `celebration.css`, CSS seul) : confettis et fusées, `force`
  1 à 3. Mot trouvé (plus forte au palier 1), photo gagnante, podium. `useArrivee` : seulement
  quand l'état change sous les yeux de l'écran, pas au rechargement (sauf le podium, qui la rejoue).
  Rien sous `prefers-reduced-motion`.
- Chrono de l'écran : `phaseDuChrono` (`packages/game`), orange (`--tu-alerte`) de 10 à 6 s,
  rouge de 5 à 0. Le battement monte (`monteeDuChrono` : niveau 70 → 150 %, vitesse de lecture
  1 → 1,35), sans nouveau son ; `lecteur.jouer(son, apresMs, montee)`.
- Podium : coupe et médailles (`src/ecran/Recompense.tsx`, `--tu-or/argent/bronze`), le 3e, puis
  le 2e, puis le 1er (`--tu-dur-podium-ecart`). Photos : cadre à la couleur de l'équipe, la
  gagnante en doré avec la coupe.
- Coins de l'écran : `@teamup_officiel` en haut à gauche (`src/marque/instagram.ts`, sauf sur les
  pages Instagram et clôture) ; en haut à droite, `Ronds mode="coin"` (cycle de 16 s, le
  pictogramme reste l'essentiel du temps).
- Scènes `instagram` et `cloture` (migration `20261022090000`, seule). QR du compte en fichier fixe
  (`public/qr-instagram.svg`, `scripts/qr-instagram.mjs`, à relancer si le compte change).
  Clôture : `Ronds mode="finale"`, la piste du reel (`deroule('finale')` = `sonsDeLaFinale`), puis
  « Merci ! » (`--tu-cloture-merci`) et l'invitation (`--tu-cloture-insta`). L'ambiance joue
  dessous, comme à l'accueil.
- Groupes : `evenements.groupe_facultatif` (vrai par défaut, migration `20261022100000`), case à
  la préparation ; faux, `rejoindre_evenement` refuse un invité sans groupe quand la soirée en a.
  Les invités ajoutés par la régie ou un parrain n'y sont pas soumis.

## Conventions posées le 2026-10-23 (audit sécurité et performance)

- **Jamais `serialization_failure` (40001) ni `deadlock_detected` pour un refus métier** :
  PostgREST 14 réessaie seul ces erreurs, sans fin si la cause demeure. Un refus que le client doit
  voir prend un code `PTxxx` (PostgREST en fait le statut HTTP, ex. `PT409`) ou une classe 22/23/P0.
- Dépendances : `pnpm audit --prod` sans critique ni haute exploitable. Overrides dans
  `pnpm-workspace.yaml` (source-map-js, vite), à retirer quand next et astro suivent. Reste une
  haute sans correctif publié (`http-cache-semantics`, cache d'images distantes d'Astro, inutilisé
  par la vitrine). La vitrine ne monte pas d'Astro au-delà de 7.3 tant que le projet est en Node
  22.20 (les suivantes exigent 22.23).
- App : en-têtes de protection dans `apps/app/vercel.json` (comme la vitrine). L'appareil photo
  reste permis (`camera=(self)`).
- Le canal `salle:<id>` est public (les téléphones n'ont que la clé anon) : il ne transporte
  rien, et un téléphone espace ses relectures sur signal (750 ms au moins, une en attente à la
  fois). Ne jamais y faire passer de données.
- Photo : le serveur vérifie les octets d'en-tête JPEG, pas seulement le type annoncé.
- Risques connus, non traités : aucune limite de débit sur l'arrivée (un script pourrait remplir
  une soirée jusqu'à 150 ; la Salle permet de retirer) ni sur le formulaire de devis (champ piège
  et délai seulement ; une règle de limite de débit Vercel est possible).

## Conventions posées le 2026-10-23 (prénoms, indices, ouverture)

- **Prénoms uniques par soirée** : `placer_joueur` refuse, sous le verrou d'arrivée, un prénom
  déjà pris (`cle_prenom` : sans casse, sans accents latins, espaces réduits ; erreur
  `unique_violation`, « prénom déjà pris »). Couvre le QR code, l'invité ajouté par un joueur et
  celui de la régie (migration `20261023110000`). Le téléphone le demande dès l'écran du prénom
  (`POST /api/partie/[code]/prenom` → `prenom_disponible`, rôle de service), avant le groupe et
  « Capitaine ? » ; un doublon arrivé entre-temps ramène au prénom. Message : ajouter l'initiale
  du nom. Les doublons d'avant ne sont pas touchés.
- Points communs à l'écran : les indices **côte à côte**, et chrono, paliers, indices et verdict
  se réduisent ensemble (`--tu-pc-echelle`, `useAjusterTexte`) jusqu'à tenir. La fête est hors
  du bloc mesuré (position fixe). `e2e/points-communs-ecran.spec.ts` : trois indices en trois
  langues.
- Ouverture → accueil, **raccourcie** : la passe finale **prend la boucle au vol** tant qu'elle
  la suit à l'identique (avant 62 % du cycle, `raccordFinale`), sinon la boucle finit son cycle
  (3,4 s au plus). Ses animations et le fondu sont avancés de `--tu-finale-depuis` ; la piste du
  reel part plus tôt ou **en route** (`dansLeSonMs`), son coup toujours sur le logo. Le QR paraît
  0,8 s après le nom (`FINALE.qr` 6,4 s, `fin` 7 s). On ne coupe toujours pas la cinématique.
