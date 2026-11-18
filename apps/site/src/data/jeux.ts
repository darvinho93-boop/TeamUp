/**
 * Les sept jeux et les deux duels en bêta. Les cinq premiers sont ceux de la spec v3 ; le Blind
 * test (2026-11-15) et le Portrait mystère (2026-11-18) sont venus ensuite, marqués « Nouveau ».
 * `body` est l'accroche d'un jeu, partagée par l'accueil et la page Les jeux : elle raconte
 * ce que vit la salle, la règle détaillée reste sur Les jeux.
 */
export type GameSummary = {
  id: string;
  icon: 'users' | 'cross' | 'hand' | 'mime' | 'camera' | 'music' | 'portrait';
  /** Teinte du pictogramme, reprise des maquettes : un fond distinct par jeu. */
  tone: 'navy' | 'sage' | 'amber' | 'mint' | 'stone';
  title: string;
  body: string;
  /** Pastille « Nouveau » sur la page Les jeux. */
  nouveau?: boolean;
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
  {
    id: 'blind-test',
    icon: 'music',
    tone: 'navy',
    title: 'Blind test',
    body: 'Quelques notes suffisent : toute la salle fredonne, mais seul le capitaine le plus rapide peut buzzer.',
    nouveau: true,
  },
  {
    id: 'portrait-mystere',
    icon: 'portrait',
    tone: 'sage',
    title: 'Portrait mystère',
    body: 'Vingt-cinq noms sur le grand écran, un seul est le bon. Trois indices pour le trouver… et une carte noire à éviter.',
    nouveau: true,
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
