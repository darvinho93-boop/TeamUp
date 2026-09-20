/**
 * Les cinq jeux socles et les deux duels en bêta de la spec v3. Rien d'autre n'existe.
 * Repris des maquettes « Accueil » et « Les jeux », qui partagent ces libellés.
 */
export type GameSummary = {
  id: string;
  icon: 'users' | 'cross' | 'hand' | 'mime' | 'camera';
  tone: 'navy' | 'sage' | 'amber';
  title: string;
  body: string;
  duration: string;
};

export const games: GameSummary[] = [
  {
    id: 'points-communs',
    icon: 'users',
    tone: 'navy',
    title: 'Points communs',
    body: "Une équipe dos à l'écran devine ce qui rassemble les invités qui se lèvent.",
    duration: '2 min 10 par équipe',
  },
  {
    id: 'quiz',
    icon: 'cross',
    tone: 'sage',
    title: 'Quiz',
    body: 'Quatre zones au sol, une question. Mauvaise zone : on sort du jeu.',
    duration: '≈ 30 s par question',
  },
  {
    id: 'surenchere',
    icon: 'hand',
    tone: 'amber',
    title: 'Surenchère',
    body: 'Les champions surenchérissent à voix haute sur un sujet dévoilé au dernier moment.',
    duration: '≈ 2 min par thème',
  },
  {
    id: 'mime',
    icon: 'mime',
    tone: 'navy',
    title: 'Mime',
    body: "Le mot traverse l'équipe en alternant mime et chuchotement. Il arrive rarement intact.",
    duration: '2 min 30 par équipe',
  },
  {
    id: 'photo',
    icon: 'camera',
    tone: 'navy',
    title: 'Photo challenge',
    body: 'Toute la soirée, chaque équipe met en scène des thèmes. Diffusion en clôture.',
    duration: '≈ 5 min de diffusion',
  },
];

export const duels = [
  {
    title: 'Tête, épaule, gobelet',
    body: "L'animateur enchaîne les consignes et les pièges. Au mot « gobelet », le premier qui l'attrape gagne.",
    duration: '45 s par duel',
  },
  {
    title: "Attrape l'objet",
    body: "Une musique part, les deux duellistes attrapent sur la table l'objet qui va avec.",
    duration: '30 s par duel',
  },
];
