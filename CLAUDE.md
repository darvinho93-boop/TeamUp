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
- `apps/site` : **Astro**, site vitrine statique, en français. Domaine `teamup.fr`.
- `apps/app` : **Next.js** (App Router), PWA. Domaine `app.teamup.fr`.
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
- Deux thèmes : clair (vitrine, joueur) et `data-theme="stage"` (écran commun, régie).
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

- Repêchage du quiz (3-4 questions sans repêchage, ou 6 avec).
- Clôture des envois photo : manuelle par la régie, ou automatique au lancement de la diffusion.
- Longueur maximale de la file de mime (6 ou 8 maillons).
- Durée de conservation des photos.
- Espace client (hors périmètre v1 par défaut).

## Commandes

Node 22.20 (`.nvmrc`) et pnpm 10.17. Toutes les commandes se lancent depuis la racine.

| Commande                            | Effet                                                        |
| ----------------------------------- | ------------------------------------------------------------ |
| `pnpm install`                      | Installe le monorepo                                         |
| `pnpm dev`                          | Démarre les deux apps : vitrine sur `:4321`, app sur `:3000` |
| `pnpm dev:site` / `pnpm dev:app`    | Une seule des deux                                           |
| `pnpm dev:host`                     | Idem, exposé sur le réseau local (test sur téléphone)        |
| `pnpm lint`                         | Garde-fou tokens (`scripts/check-tokens.mjs`) puis ESLint    |
| `pnpm typecheck`                    | `tsc` sur les paquets, `astro check` sur la vitrine          |
| `pnpm test`                         | Vitest (`packages/game` et `apps/site`)                      |
| `pnpm build`                        | Build des deux apps                                          |
| `pnpm format` / `pnpm format:check` | Prettier                                                     |
| **`pnpm verify`**                   | lint + typecheck + test + build — ce que lance la CI         |

Pages de contrôle des composants, dans les deux thèmes :
`http://localhost:4321/kit-ui` (Astro) et `http://localhost:3000/kit-ui` (React).

### Base de données (lot 3)

Supabase tourne en local dans Docker : **Docker Desktop doit être démarré**.

| Commande        | Effet                                                                |
| --------------- | -------------------------------------------------------------------- |
| `pnpm db:start` | Démarre la base locale (Studio sur `:54323`, API sur `:54321`)       |
| `pnpm db:stop`  | Arrête la base                                                       |
| `pnpm db:reset` | Rejoue toutes les migrations puis `supabase/seed.sql` (base jetable) |
| `pnpm db:types` | Régénère `apps/app/src/types/base.ts` depuis le schéma local         |

`db:start` écarte Studio, l'analytics, l'imgproxy, le realtime et les autres services dont
rien n'a encore besoin : la pile complète demande environ 8 Go d'images et 4 Go de RAM.
Le realtime sera à réintégrer au lot 6.

Les migrations vivent dans `supabase/migrations/`, une par bloc fonctionnel, jamais modifiées
après coup : on en ajoute une. Sans base joignable, les tests qui en dépendent s'annoncent
ignorés ; la CI, elle, en démarre une, donc ils y tournent pour de bon.

## Variables d'environnement

`apps/site/.env` (modèle dans `.env.example`), déclarées dans `astro.config.mjs` (`astro:env`) :

| Variable             | Rôle                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`     | Clé Resend. **Absente : mode à sec**, les e-mails de devis s'écrivent dans la console au lieu de partir. |
| `DEVIS_DESTINATAIRE` | Adresse qui reçoit les demandes de devis.                                                                |
| `DEVIS_EXPEDITEUR`   | Expéditeur sur un domaine vérifié chez Resend, ex. `Team Up! <devis@teamup.fr>`.                         |

À reporter dans les variables du projet Vercel de la vitrine avant la mise en ligne.

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
