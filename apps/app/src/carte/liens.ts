import type { Langue, SoireeDuJour } from '@/lib/partie';

/** Les quatre onglets de la carte Team Up!. */
export type OngletCarte = 'soirees' | 'jeux' | 'comment' | 'nous';

/**
 * Demande de devis sur la vitrine, marquée comme venue de la carte : `via=carte` suit le visiteur
 * jusqu'au formulaire, et l'e-mail de l'équipe porte la provenance (convention du 2026-10-11).
 */
export const DEVIS_DEPUIS_CARTE = 'https://teamup-game.fr/devis?via=carte';

/** L'arrivée d'une soirée depuis la carte : la langue choisie sur la carte sert si la soirée la propose. */
export function lienInscription(soiree: SoireeDuJour, langue: Langue): string {
  return soiree.langues.includes(langue) ? `/${soiree.code}?carte=1` : `/${soiree.code}`;
}
