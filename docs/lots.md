# Découpage en lots

Un lot par session. Chaque lot se termine quand ses critères « Fini quand » sont tous vrais.

| Lot | Contenu | Fini quand |
| --- | --- | --- |
| 0 — Socle | Monorepo, TypeScript, lint, format, CI. `packages/ui` : tokens, polices, composants de base (bouton, champ, carte, pastille d'équipe, en-tête, pied de page). | `apps/site` et `apps/app` démarrent ; une page de test affiche les composants dans les deux thèmes ; la CI passe. Section « Commandes » de `CLAUDE.md` remplie. |
| 1 — Vitrine | Les pages des maquettes, desktop et mobile : accueil, particuliers, entreprises, les jeux, comment ça marche, rejoindre, confirmation, pages légales. SEO de base (titres, meta, sitemap). | Chaque page correspond à sa maquette aux deux tailles ; accueil < 2,5 s en 4G simulée ; navigation clavier et contrastes AA. |
| 2 — Devis | Formulaire de devis : validation, anti-spam (honeypot), consentement RGPD, e-mail à Team Up! et accusé de réception, redirection vers la confirmation. | Une demande de test arrive par e-mail ; les erreurs de saisie s'affichent champ par champ. |
| 3 — Données | Schéma Supabase : événements, équipes, joueurs, programme, manches, contenus et traductions, secrets, scores, photos. RLS. Auth animateur et admin. Données de démo. | Un joueur anonyme ne peut lire aucun secret qui ne lui est pas destiné (test automatisé). |
| 4 — Moteur | `packages/game` : barèmes des 5 jeux, paliers de points communs, chronos, calcul de durée d'un programme selon le nombre d'équipes (tableau « budget de minutes » de la spec v3). | Tests couvrant chaque barème et chaque ligne du budget de minutes. |
| 5 — Rejoindre | App joueur : code ou QR, langue, prénom, équipe, écran d'attente, reconnexion sans ressaisie. | 150 joueurs simulés rejoignent le même événement ; une coupure puis un retour réseau reprennent la session. |
| 6 — Écran et régie | Écran commun et régie en temps réel : accueil avec QR, équipes, programme, scores, podium. Premiers jeux : Points communs et Surenchère (sans téléphone). | Une partie complète de ces deux jeux se pilote depuis la régie, écran projeté à jour en moins d'1 s. |
| 7 — Mime et quiz | Mime (secret au premier joueur, révélation vert / rouge). Quiz en mode croix puis en mode téléphone, même barème. | Les deux modes du quiz donnent le même score pour les mêmes survivants. |
| 8 — Photo challenge | Écran permanent côté joueur, envoi par le capitaine (compression, file d'attente hors ligne), clôture, diffusion thème par thème. | Une photo prise hors réseau part seule au retour du réseau. |
| 9 — Back-office | Gestion des animateurs, banques de contenus multilingues avec étiquettes B2C / B2B / tout public. | Un admin crée un contenu en trois langues et un animateur le retrouve à la préparation. |
| 10 — Finitions | Duels en bêta, export des scores et photos, mesure (conversion devis, durée réelle par jeu). | — |

## Avant de commencer

- **Lots 5 à 9 : les maquettes de l'app n'existent pas encore.** Seule la vitrine est maquettée.
  Soit on les dessine avant le lot 5, soit Claude Code s'appuie sur les sections 5 et 6 du
  cahier des charges et sur les visuels d'écrans présents dans les maquettes vitrine.
- **Lot 7** : repêchage tranché le 2026-09-24 (aucun, 3 ou 4 questions). Lot clos, critère vérifié par `e2e/quiz.spec.ts`.
- **Lot 8** : clôture tranchée le 2026-09-24 (bouton de la régie et clôture automatique au lancement de la diffusion). Lot clos, critère vérifié par `e2e/photo.spec.ts`.
- **Lot 10** : trancher la durée de conservation des photos.

## Prompt de démarrage type

> Lis `CLAUDE.md` et les documents qu'il référence. On attaque le lot N de `docs/lots.md`.
> Propose un plan (fichiers, étapes, risques) sans écrire de code, puis attends ma validation.
