import type { IconListItem } from '../components/layout/IconList.astro';

/** Partagé par « Entreprises » et « Comment ça marche », qui affichent la même paire. */
export const fourni: IconListItem[] = [
  { icon: 'check', label: 'Un animateur qui tient la salle du début à la fin' },
  { icon: 'check', label: 'La régie, les jeux et tous les contenus' },
  { icon: 'check', label: 'Le matériel de jeu : marquage au sol, accessoires' },
  { icon: 'check', label: "L'export des scores et des photos après l'événement" },
];

export const surPlace: IconListItem[] = [
  { icon: 'screen', label: 'Un vidéoprojecteur ou un grand écran' },
  { icon: 'mic', label: 'Une sonorisation avec micro' },
  { icon: 'floor', label: 'De la place au sol pour quatre zones de jeu' },
  { icon: 'wifi', label: 'Une connexion Wi-Fi ou 4G pour les téléphones' },
];
