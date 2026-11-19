import { aleaDepuis } from '@teamup/game';
import { INTERLUDE_MS } from './sons';

/**
 * Le suspense du quiz (2026-11-19, audit « jeu télé ») : à « Révéler », un roulement court
 * pendant lequel les mauvaises réponses s'éteignent une à une, puis la bonne passe en vert. Il
 * dure le temps du roulement de l'interlude (le son `presentation`) ; les téléphones attendent
 * autant avant leur verdict, pour ne jamais devancer l'écran.
 */
export const SUSPENSE_MS = INTERLUDE_MS;

/**
 * L'ordre dans lequel les mauvaises cases s'éteignent : pour chaque case, son rang (0, 1, 2…),
 * `null` pour la bonne. Tiré de l'identifiant de la question : deux écrans montrent le même.
 */
export function rangsDExtinction(passageId: string, bonne: number, cases = 4): (number | null)[] {
  const fausses = Array.from({ length: cases }, (_, i) => i).filter((i) => i !== bonne);
  const alea = aleaDepuis(passageId);
  for (let i = fausses.length - 1; i > 0; i -= 1) {
    const j = Math.floor(alea() * (i + 1));
    [fausses[i], fausses[j]] = [fausses[j]!, fausses[i]!];
  }
  return Array.from({ length: cases }, (_, i) => (i === bonne ? null : fausses.indexOf(i)));
}
