/**
 * Mime (`mime2`), chaîne alternée. +100 par mot trouvé, 0 sinon.
 *
 * Rang impair : mime ce qu'il a entendu. Rang pair : chuchote ce qu'il a vu.
 * Le dernier annonce à voix haute, quel que soit son rang.
 * La longueur maximale de la file est une décision ouverte : aucun plafond ici.
 */

import { verifierEntierPositif } from './scores';

export const POINTS_MOT_TROUVE = 100;

export type RoleMaillon = 'mime' | 'oreille' | 'annonce';

export function scoreMime(trouve: boolean): number {
  return trouve ? POINTS_MOT_TROUVE : 0;
}

/** `rang` commence à 1 : J1 est celui qui reçoit le secret. */
export function roleMaillon(rang: number, longueurFile: number): RoleMaillon {
  verifierEntierPositif(rang, 'Le rang');
  verifierEntierPositif(longueurFile, 'La longueur de la file');
  if (rang < 1 || rang > longueurFile) {
    throw new RangeError(`Rang ${rang} hors de la file (1 à ${longueurFile}).`);
  }
  if (rang === longueurFile) return 'annonce';
  return rang % 2 === 1 ? 'mime' : 'oreille';
}
