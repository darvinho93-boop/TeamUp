# Team up! — Spécification v3

**Les cinq jeux retenus, plus les duels en bêta.**
Suite du dossier d'arbitrage v3 · 05 septembre 2026

Ce document remplace la bibliothèque de vingt jeux. Tout ce qui n'y figure pas n'est pas
reconstruit. Les quinze autres jeux du MVP restent en base mais ne sont plus exposés, et
leur contenu n'est plus traduit ni maintenu.

---

## Ce qui a été tranché

| Arbitrage | Décision |
|---|---|
| ① Points communs | **v2 seule** — dos à l'écran |
| ② Quiz | **v2, avec les deux affichages** — croix au sol et téléphone, même barème |
| ③ Surenchère | **v2 seule** — à la voix |
| ④ Mime | **v2 modifiée** — chaîne alternée mime / oreille |
| ⑤ Photo challenge | **v2 modifiée** — prise en continu, diffusion en clôture |
| Duels 1 contre 1 | **bêta** — construits, testés en conditions réelles avant décision |

Deux principes structurent la v3 et doivent primer sur toute demande ponctuelle.

**Le téléphone est un instrument de régie, pas un support de jeu.** Il ne sert plus qu'à
trois choses : porter un secret jusqu'à un joueur désigné, permettre au capitaine
d'envoyer une photo, et offrir au quiz un mode assis. Aucun jeu ne demande à cent
personnes de regarder leur écran en même temps.

**Tout passage est chronométré.** Les deux jeux séquentiels ont un chrono de passage
fixe et affiché. C'est ce qui rend la durée d'une manche calculable à l'avance, donc le
programme arbitrable en amont plutôt qu'improvisé en salle.

---

## 01 — Points communs v2

`list2` · reconduit sans changement fonctionnel · **statut : socle**

Une équipe, dos à l'écran, doit deviner ce qui rassemble les invités debout.

**Déroulé.** L'équipe qui joue ferme les yeux. L'écran montre le point commun à toute la
salle (« les personnes retraitées »), puis se masque. L'équipe rouvre les yeux, les
bonnes personnes se lèvent, top chrono. Trois paliers de 60 / 35 / 35 s, un indice
supplémentaire à chaque palier.

**Arrêt à chaque palier** (décision du 8 octobre 2026). À la fin des paliers 1 et 2, le
chrono s'arrête seul. L'animateur donne l'indice ; le chrono repart de lui-même 5 s plus
tard. Tant que l'indice n'est pas donné, le chrono attend. L'équipe peut répondre pendant
l'arrêt : le palier qui s'ouvre compte alors en entier (105 points au premier arrêt, 35 au
second).

| | |
|---|---|
| Support | Aucun écran joueur — tout en salle |
| Chrono de passage | **2 min 10** (130 s de jeu, hors installation et hors arrêts pour les indices) |
| Qui joue | Une équipe à la fois, la salle participe |
| Matériel | De la place pour asseoir une équipe dos à l'écran |
| Barème | Temps restant × multiplicateur de palier (×3 / ×2 / ×1), max 285, échec 0 |
| À préparer | Une consigne + la réponse + 2 indices, par passage |
| Existant réutilisé | `0045`, `0053`, `0058`, `round_item_secrets` |

**Régie.** Cinq étapes manuelles par passage : afficher, masquer, lancer, indice, valider.
« Indice » ne se donne que chrono arrêté, une fois par arrêt.
C'est le jeu le plus exigeant pour la personne en régie — à confier à quelqu'un de rodé,
ou à répéter une fois avant la soirée.

**Réseau tombé.** Le jeu continue. Rien ne transite depuis les téléphones des joueurs ;
seul le score est écrit à la fin.

---

## 02 — Quiz v2

`qcm2` · double affichage · **statut : socle**

Les mêmes questions, deux façons d'y répondre. Mauvaise réponse = éliminé.

### Les deux modes

**Mode croix.** Une croix au sol délimite quatre zones A/B/C/D ; l'écran affiche la
question dans les mêmes quadrants. Chacun va se placer dans la zone de sa réponse. Les
mauvaises zones sortent du jeu. La régie saisit le nombre de survivants par équipe en
fin de manche.

**Mode téléphone.** La question s'affiche en grand, quatre boutons sur le téléphone. Une
mauvaise réponse élimine le joueur, qui passe spectateur et voit son écran le lui dire.
L'app compte les survivants toute seule.

Le mode se choisit **au lancement de la manche**, pas au joueur. Les deux peuvent
cohabiter dans une même soirée sur deux manches différentes, jamais dans la même
manche.

| | |
|---|---|
| Support | Aucun (croix) ou téléphone de chaque joueur |
| Durée | ≈ 30 s par question |
| Qui joue | Tout le monde |
| Matériel | Mode croix : de quoi tracer 4 zones bien visibles (adhésif, craie) |
| Barème | **Survivants × 100 par équipe, calculé une seule fois en fin de manche** |
| À préparer | Les questions — famille requise, même éditeur pour les deux modes |
| Existant réutilisé | `0046`, `0054`, éditeur QCM, `0022` (élimination) |

**Le barème est identique dans les deux modes.** C'est ce qui résout le problème de
comparabilité : on ne compte plus ni la rapidité ni une moyenne individuelle, seulement
des survivants. Un score de manche est donc lisible même si la soirée a mélangé les deux
affichages.

**Le mode téléphone existe pour une seule raison :** une salle trop petite, trop pleine ou
trop assise pour tracer une croix. Ce n'est pas le mode par défaut, et l'app n'a pas à le
proposer en premier.

**Ce qu'il faut décider avant d'écrire les questions.** L'élimination sort des gens tôt. À
six questions, une bonne partie de la salle est spectatrice à la quatrième. Deux
garde-fous possibles, à choisir maintenant car ils changent la structure de manche :
limiter à trois ou quatre questions, ou prévoir un repêchage à mi-manche. Sans l'un des
deux, le jeu se termine avec quinze personnes debout et quatre-vingts assises.

**Réseau tombé.** Mode croix : le jeu continue, seule la saisie finale attend. Mode
téléphone : le jeu s'arrête.

---

## 03 — Surenchère v2

`enchere2` · reconduit sans changement · **statut : socle**

Même bluff que la v1, mais à main levée avec l'animateur.

**Déroulé.** Tous les thèmes s'affichent d'avance, les équipes s'organisent hors app. Les
champions s'avancent, **puis** la régie dévoile le sujet précis — gardé secret en base,
illisible depuis un téléphone. La surenchère se fait à la voix. Adjugé, la régie lance un
chrono géant qui vire au rouge à zéro ; l'animateur tranche.

| | |
|---|---|
| Support | Aucun — tout à la voix |
| Durée | ≈ 2 min par thème |
| Qui joue | Un champion par équipe |
| Matériel | Rien |
| Barème | Tenu → +100 à l'équipe · raté → +20 à chacune des autres équipes ayant des joueurs |
| À préparer | Des couples thème → sujet, un sujet par thème |
| Existant réutilisé | `0048`, `0055` |

**Régie.** Une seule RPC de résultat. C'est le jeu le moins coûteux du programme côté
logiciel, et le plus dépendant de l'animateur : sans quelqu'un qui tient la salle, il ne se
passe rien. Aucun garde-fou logiciel n'est prévu, et c'est assumé.

---

## 04 — Mime v2 modifiée — chaîne alternée

`mime2` · **modification fonctionnelle** · **statut : socle**

Le mot traverse l'équipe en alternant mime et parole. Il se déforme deux fois plus vite.

### La chaîne

```
régie ──(secret)──▶ J1
J1  ──mime──▶  J2
J2  ──oreille──▶  J3
J3  ──mime──▶  J4
J4  ──oreille──▶  J5
…
Jn  ──annonce à voix haute──▶  la salle
```

Les joueurs de rang impair miment ce qu'ils ont **entendu**. Les joueurs de rang pair
chuchotent ce qu'ils ont **vu**. Le dernier annonce à voix haute, quel que soit son rang.

**Déroulé.** L'équipe se met en file, tous tournés dans le même sens, les suivants ne
voyant rien. La régie montre le mot à J1 seul sur l'écran de régie. Chaque maillon
s'exécute à la vue de la salle sauf les passages à l'oreille. Le dernier annonce ; la régie
révèle le mot : écran **vert** si trouvé, **rouge** sinon.

| | |
|---|---|
| Support | Aucun — le mot n'est affiché nulle part côté joueur |
| Chrono de passage | **2 min 30** — la chaîne alternée est plus lente que la file de mimes |
| Qui joue | Une équipe à la fois, en file |
| Matériel | De la place pour aligner une équipe |
| Barème | +100 par mot trouvé, 0 sinon |
| À préparer | Une banque de mots |
| Existant réutilisé | `0049`, `round_item_secrets` |

**Ce qui change par rapport à la v2 du MVP.** Le maillon oral réintroduit une langue dans
un jeu qui n'en avait aucune. C'est assumé : la déformation par la parole est ce qui rend
la chaîne drôle. Deux conséquences pour la banque de mots, à respecter à la rédaction :

- **un mot, pas une expression** — un groupe nominal traverse mal quatre traductions
  mentales ;
- **un mot dont la traduction est évidente dans les trois langues** — un objet concret,
  un animal, une action physique. Pas de référence culturelle, pas de jeu de mots.

La composition des files relève de l'animateur, pas de l'app : il place les maillons oraux
entre des personnes qui partagent une langue. C'est une consigne de briefing, pas une
fonctionnalité.

**Réseau tombé.** Le jeu continue intégralement. Rien ne transite côté joueur.

---

## 05 — Photo challenge v2 en continu

`photo2` · **modification fonctionnelle** · **statut : socle, format de clôture**

Ce n'est plus une manche. C'est une surface ouverte toute la soirée, révélée à la fin.

**Déroulé.** Les thèmes sont annoncés au tout début de la soirée et restent consultables
en permanence dans l'app. Les équipes shootent quand elles veulent, entre les manches,
au bar, dehors. Le capitaine envoie une photo par thème, remplaçable jusqu'à la clôture
des envois. En fin de soirée, on diffuse thème par thème, toutes les photos côte à côte ;
les héros de la fête désignent la gagnante à l'oral, la régie clique.

| | |
|---|---|
| Support | Téléphone du capitaine seulement |
| Durée | Prise de vue : toute la soirée · **diffusion finale : ≈ 5 min** |
| Qui joue | Une équipe entière pour la mise en scène |
| Matériel | Rien |
| Barème | 100 par thème gagné · une seule gagnante par thème, aucun vote |
| À préparer | Les thèmes |
| Existant réutilisé | `0047`, `0056` (diaporama), upload par thème |

**Ce que le passage en continu impose côté app.** Le jeu a besoin d'un écran permanent,
accessible hors manche : la liste des thèmes, l'état des envois de mon équipe, le bouton
d'envoi. Ce n'est plus un écran de manche piloté par la régie. Il faut aussi une **clôture
des envois** commandée par la régie, sinon une équipe envoie pendant la diffusion.

**Ce que ça débloque.** Les uploads s'étalent sur la soirée entière au lieu de se
concentrer sur trois minutes. Le risque de charge réseau, qui était le vrai danger du
produit, disparaît presque entièrement.

**Réseau tombé.** Les envois s'arrêtent, mais reprennent dès le retour du réseau — c'est
le seul jeu du programme qui tolère une coupure sans perdre la manche, précisément
parce qu'il n'est plus une manche.

---

## Bêta — les duels 1 contre 1

`grab` et `cup` · **statut : construits, non programmés par défaut**

Les deux duels partagent entièrement leur moteur (`0040` : tirage en rotation équitable,
verdict animateur). Les construire tous les deux ne coûte presque rien de plus que d'en
construire un.

**16 — Attrape l'objet.** Une musique part, les duellistes attrapent sur la table l'objet qui
va avec. 30 s par duel. Demande une table, des objets et une playlist courte.

**17 — Tête, épaule, gobelet.** Séquence soufflée à l'animateur sur son écran, avec les
pièges. Au mot *gobelet*, le premier qui l'attrape gagne. 45 s par duel. Un gobelet, aucune
préparation de contenu.

**Ce que la bêta doit trancher.** Trois questions, à observer en conditions réelles plutôt
qu'à décider sur le papier :

1. Deux joueurs occupés et cent spectateurs — est-ce que ça tient plus de deux duels
   d'affilée, ou est-ce que la salle décroche ?
2. Le verdict à l'œil de l'animateur est-il contesté quand c'est serré ?
3. Le gobelet suffit-il seul ? Si oui, Attrape l'objet perd son seul avantage et son
   matériel devient injustifiable.

**Recommandation de programmation.** Les tenir hors du programme nominal, en réserve,
et ne les lancer que sur un créneau de 60 min ou plus, en changement de registre après
un jeu long. Tête, épaule, gobelet passe en premier : aucun matériel à transporter,
aucun contenu à écrire.

---

## Le budget de minutes

Les deux jeux séquentiels — Points communs v2 et Mime v2 — coûtent un passage par
équipe. C'est la contrainte qui détermine tout le reste.

| Nombre d'équipes | Points communs v2 | Mime v2 | **Total séquentiel** |
|---|---|---|---|
| 4 équipes | 8 min 40 | 10 min | **18 min 40** |
| 5 équipes | 10 min 50 | 12 min 30 | **23 min 20** |
| 6 équipes | 13 min | 15 min | **28 min** |
| 8 équipes | 17 min 20 | 20 min | **37 min 20** |

À quoi s'ajoutent, quel que soit le nombre d'équipes : Quiz 4 questions ≈ 2 min,
Surenchère 3 thèmes ≈ 6 min, diffusion photo ≈ 5 min. Soit **13 minutes de socle
non séquentiel**, plus les transitions.

### Ce que ça donne sur le créneau réel

Le créneau obtenu le 15/08 était de **40 minutes**. Transitions comprises, il faut compter
environ 15 % au-delà des chronos.

- **4 équipes** — 18 min 40 + 13 min + transitions ≈ 36 min. Le programme complet tient.
- **5 équipes** — ≈ 42 min. Il faut retirer un thème de surenchère, ou une question de quiz.
- **6 équipes** — ≈ 47 min. **Un des deux jeux séquentiels ne peut pas être joué**, ou ne
  fait qu'un passage sur deux équipes.
- **8 équipes** — ≈ 58 min. Le programme à cinq jeux est hors de portée sur 40 minutes.

**La conséquence.** Le nombre d'équipes n'est pas un réglage de confort, c'est la variable
qui décide du programme. Au-delà de cinq équipes sur un créneau de 40 minutes, il faut
soit obtenir 60 minutes, soit accepter de ne jouer qu'un seul des deux jeux séquentiels.
Autant le savoir en composant les équipes plutôt qu'en salle.

---

## Ce qui reste à décider

Quatre points ouverts, tous à trancher avant d'écrire le contenu.

**Le repêchage du quiz.** Trois ou quatre questions sans repêchage, ou six avec ? Change
la structure de manche, donc le code.

**La composition des équipes.** Le tableau ci-dessus suppose qu'on choisit le nombre
d'équipes. Si ce nombre est subi (par tablée, par famille), le programme doit être
composé après le placement, pas avant.

**Le point de clôture des envois photo.** Commandé par la régie, ou automatique au
lancement de la diffusion ? Le second est plus sûr, le premier plus souple.

**La longueur de la file de mime.** À douze personnes, la chaîne alternée fait six
transmissions et le mot ne survit pas. C'est peut-être le but — ou peut-être qu'un mot
jamais trouvé, trois passages de suite, cesse d'être drôle. À calibrer sur le premier test :
plafonner la file à six ou huit maillons est probablement nécessaire.
