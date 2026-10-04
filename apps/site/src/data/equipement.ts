import type { IconListItem } from '../components/layout/IconList.astro';

/** Partagé par « Entreprises » et « Comment ça marche », qui affichent la même paire. */
export const fourni: IconListItem[] = [
  { icon: 'check', label: 'Un animateur qui tient la salle du début à la fin' },
  {
    icon: 'check',
    label: 'Les jeux, le grand écran de jeu et tous les contenus, traduits si besoin',
  },
  { icon: 'check', label: 'Le matériel de jeu : marquage au sol, accessoires' },
  { icon: 'check', label: 'Les photos et les scores de la soirée, remis en souvenir' },
];

export const surPlace: IconListItem[] = [
  { icon: 'screen', label: 'Un vidéoprojecteur ou un grand écran' },
  { icon: 'mic', label: 'Une sonorisation avec micro' },
  { icon: 'floor', label: 'De la place au sol pour quatre zones de jeu' },
  { icon: 'wifi', label: 'Une connexion Wi-Fi ou 4G pour les téléphones' },
];
