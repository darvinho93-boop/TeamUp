import type { IconListItem } from '../components/layout/IconList.astro';

/** Partagé par « Entreprises » et « Comment ça marche », qui affichent la même paire. */
export const fourni: IconListItem[] = [
  { icon: 'check', label: "L'animation et la coordination de la partie, jusqu'au podium" },
  {
    icon: 'check',
    label: "Les jeux, l'écran de jeu et les contenus préparés, traduits si besoin",
  },
  { icon: 'check', label: 'Les accessoires nécessaires, marquage au sol compris' },
  { icon: 'check', label: 'Les photos et les scores de la soirée, remis en souvenir' },
];

export const surPlace: IconListItem[] = [
  { icon: 'screen', label: 'Un grand écran ou un vidéoprojecteur' },
  { icon: 'mic', label: 'Une sonorisation avec micro' },
  { icon: 'floor', label: 'Un espace adapté, avec de la place pour quatre zones de jeu' },
  { icon: 'wifi', label: 'Une connexion Wi-Fi ou mobile pour les téléphones' },
];
