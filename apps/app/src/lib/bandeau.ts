/**
 * Le bandeau de prénoms de la page du QR code (2026-11-04) : les joueurs déjà arrivés glissent
 * sous le QR code, et chaque nouvel arrivé est salué. Logique pure, testée ; le mouvement est dans
 * `src/ecran/BandeauPrenoms.tsx`.
 */

/** Deux rangées, qui glissent en sens opposés. */
export const RANGEES_BANDEAU = 2;

/** Vitesse d'un bandeau, en rem par seconde de la scène de référence (lisible du fond de salle). */
export const VITESSE_BANDEAU_REM_S = 4;

/** Au-delà, le message d'accueil dit « et N autres ». */
export const BIENVENUE_MAX = 3;

/** Un prénom du bandeau : la clé reste la même tant que le joueur est là, même en double. */
export interface PrenomDuBandeau {
  cle: string;
  prenom: string;
}

/**
 * Les prénoms, une clé chacun : le prénom et son rang parmi ses homonymes (les prénoms sont
 * uniques par soirée depuis le 2026-10-23, mais pas ceux d'avant).
 */
export function avecCles(prenoms: readonly string[]): PrenomDuBandeau[] {
  const vus = new Map<string, number>();
  return prenoms.map((prenom) => {
    const rang = vus.get(prenom) ?? 0;
    vus.set(prenom, rang + 1);
    return { cle: `${prenom}#${rang}`, prenom };
  });
}

/**
 * Les prénoms répartis en rangées, un sur deux, dans l'ordre d'arrivée : un nouvel arrivé se met au
 * bout de sa rangée, les autres ne changent pas de place.
 */
export function rangeesDe<T>(prenoms: readonly T[], rangees = RANGEES_BANDEAU): T[][] {
  const resultat: T[][] = Array.from({ length: rangees }, () => []);
  prenoms.forEach((p, i) => resultat[i % rangees]!.push(p));
  return resultat;
}

/** Les prénoms arrivés depuis la lecture précédente, dans leur ordre d'arrivée (homonymes compris). */
export function nouveauxPrenoms(avant: readonly string[], apres: readonly string[]): string[] {
  const restants = new Map<string, number>();
  for (const p of avant) restants.set(p, (restants.get(p) ?? 0) + 1);
  const nouveaux: string[] = [];
  for (const p of apres) {
    const n = restants.get(p) ?? 0;
    if (n > 0) restants.set(p, n - 1);
    else nouveaux.push(p);
  }
  return nouveaux;
}

/** Le message d'accueil : les prénoms nommés, et combien d'autres arrivés en même temps. */
export interface Bienvenue {
  prenoms: string[];
  autres: number;
}

export function bienvenueDe(nouveaux: readonly string[], max = BIENVENUE_MAX): Bienvenue | null {
  if (nouveaux.length === 0) return null;
  if (nouveaux.length <= max) return { prenoms: [...nouveaux], autres: 0 };
  return { prenoms: nouveaux.slice(0, max), autres: nouveaux.length - max };
}
