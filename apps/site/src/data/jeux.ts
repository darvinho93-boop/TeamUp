/**
 * Les cinq jeux socles et les deux duels en bêta de la spec v3. Rien d'autre n'existe.
 * `body` est l'accroche d'un jeu, partagée par l'accueil et la page Les jeux : elle raconte
 * ce que vit la salle, la règle détaillée reste sur Les jeux.
 */
export type GameSummary = {
  id: string;
  icon: 'users' | 'cross' | 'hand' | 'mime' | 'camera';
  /** Teinte du pictogramme, reprise des maquettes : un fond distinct par jeu. */
  tone: 'navy' | 'sage' | 'amber' | 'mint' | 'stone';
  title: string;
  body: string;
};

export const games: GameSummary[] = [
  {
    id: 'points-communs',
    icon: 'users',
    tone: 'navy',
    title: 'Points communs',
    body: "Toute la salle est dans la confidence, sauf une équipe. Ceux qui se lèvent sont l'indice : à elle de deviner ce qui les rassemble.",
  },
  {
    id: 'quiz',
    icon: 'cross',
    tone: 'sage',
    title: 'Quiz',
    body: "Une question, quatre coins de la salle. Chacun file vers sa réponse… et découvre qui l'a suivi.",
  },
  {
    id: 'surenchere',
    icon: 'hand',
    tone: 'amber',
    title: 'Surenchère',
    body: "« J'en cite dix ! — Douze ! » Les champions font monter les enchères, puis doivent tenir parole devant tout le monde.",
  },
  {
    id: 'mime',
    icon: 'mime',
    tone: 'mint',
    title: 'Mime',
    body: 'Le mot passe de joueur en joueur, mimé puis chuchoté. Ce qui arrive au bout de la file fait toujours rire la salle.',
  },
  {
    id: 'photo',
    icon: 'camera',
    tone: 'stone',
    title: 'Photo challenge',
    body: 'Tout au long de la soirée, chaque équipe met en scène ses plus belles photos. Elles sont dévoilées en grand, en final.',
  },
];

export const duels = [
  {
    title: 'Tête, épaule, gobelet',
    body: "L'animateur enchaîne les consignes et glisse des pièges. Au mot « gobelet », le plus rapide l'attrape et l'emporte.",
    duration: 'Environ 45 s par duel',
  },
  {
    title: "Attrape l'objet",
    body: "Une musique démarre : les deux duellistes se jettent sur l'objet qui va avec. Le premier qui le tient gagne.",
    duration: 'Environ 30 s par duel',
  },
];
