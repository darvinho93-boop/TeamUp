/**
 * Les sept jeux et les deux duels en bêta. Les cinq premiers sont ceux de la spec v3 ; le Blind
 * test (2026-11-15) et le Portrait mystère (2026-11-18) sont venus ensuite, marqués « Nouveau ».
 * `body` est l'accroche d'un jeu (refonte éditoriale du 2026-11-18), en tête de sa fiche sur
 * Les jeux ; la règle détaillée suit, en étapes.
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
    body: 'Et si vous aviez plus en commun que vous ne le pensiez ?',
  },
  {
    id: 'quiz',
    icon: 'cross',
    tone: 'sage',
    title: 'Quiz',
    body: 'Une question. Quatre possibilités. À vous de choisir.',
  },
  {
    id: 'surenchere',
    icon: 'hand',
    tone: 'amber',
    title: 'Surenchère',
    body: "Jusqu'où oserez-vous aller ?",
  },
  {
    id: 'mime',
    icon: 'mime',
    tone: 'mint',
    title: 'Mime',
    body: 'Quand un simple geste devient toute une histoire.',
  },
  {
    id: 'photo',
    icon: 'camera',
    tone: 'stone',
    title: 'Photo challenge',
    body: "Vos invités ont de l'imagination. À eux de le montrer.",
  },
  {
    id: 'blind-test',
    icon: 'music',
    tone: 'navy',
    title: 'Blind test',
    body: 'Quelques notes. Et soudain, tout le monde reconnaît la chanson.',
    nouveau: true,
  },
  {
    id: 'portrait-mystere',
    icon: 'portrait',
    tone: 'sage',
    title: 'Portrait mystère',
    body: 'Trois indices. Une identité. Et un choix décisif.',
    nouveau: true,
  },
];

export const duels = [
  {
    title: 'Tête, épaule, gobelet',
    body: 'Écoutez les consignes et soyez le premier à saisir le gobelet.',
    duration: 'Environ 45 s par duel',
  },
  {
    title: "Attrape l'objet",
    body: "À partir d'un signal musical, retrouvez l'objet demandé avant votre adversaire.",
    duration: 'Environ 30 s par duel',
  },
];
