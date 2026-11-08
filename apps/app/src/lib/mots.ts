/**
 * Surenchère en mode téléphones (2026-11-08), côté écran et régie : quand relire l'état pour que
 * les mots paraissent à la fin du chrono, qui joue, et ce qu'un thème classé a donné. La base
 * tranche (saisie, visibilité des mots, masquage) ; ces règles ne font que l'annoncer.
 */

import { modeDeLaSurenchere } from './pilotage';
import {
  mancheCourante,
  passageCourant,
  type EquipeSalle,
  type EtatSalle,
  type MancheSalle,
  type PassageSalle,
} from './salle';

/**
 * La base accepte un mot jusqu'à une seconde après la fin du chrono, puis donne les mots à
 * l'écran : il relit un peu après.
 */
export const RELECTURE_APRES_CHRONO_MS = 1300;

/** La Surenchère en cours se joue-t-elle au téléphone ? La manche et le thème, le cas échéant. */
export function surenchereAuTelephone(
  etat: EtatSalle,
): { manche: MancheSalle; passage: PassageSalle | null } | null {
  const manche = mancheCourante(etat);
  if (etat.pilotage.scene !== 'jeu' || !manche || modeDeLaSurenchere(manche) !== 'telephones') {
    return null;
  }
  return { manche, passage: passageCourant(etat) };
}

/**
 * L'instant (heure de la base) où relire l'état pour recevoir les mots : peu après la fin du
 * chrono d'un thème en cours ; `null` sinon.
 */
export function relectureDesMots(etat: EtatSalle): number | null {
  const enJeu = surenchereAuTelephone(etat);
  const { etape, chrono_depart_ms: depart, chrono_duree_s: duree } = etat.pilotage;
  if (!enJeu?.passage || etape !== 'chrono' || depart === null || duree === null) return null;
  return depart + duree * 1000 + RELECTURE_APRES_CHRONO_MS;
}

/** Les équipes qui jouent : celles qui ont des joueurs. */
export function equipesEnJeu(etat: EtatSalle): EquipeSalle[] {
  return etat.equipes.filter((e) => e.joueurs > 0);
}

/** Les mots d'un thème sont-ils à l'écran ? (la base ne les donne qu'une fois le chrono écoulé) */
export function motsAffiches(passage: PassageSalle): boolean {
  return Object.values(passage.mots ?? {}).some((m) => m.liste !== null);
}

export interface ClassementTheme {
  comptes: Record<number, number>;
  rangs: Record<number, number>;
  points: Record<number, number>;
}

/** Ce qu'un thème classé au téléphone a donné, lu dans son résultat ; `null` sinon. */
export function classementDuTheme(passage: PassageSalle): ClassementTheme | null {
  const r = passage.resultat;
  if (r['mode'] !== 'telephones') return null;
  const nombres = (v: unknown): Record<number, number> => {
    const sortie: Record<number, number> = {};
    if (v && typeof v === 'object') {
      for (const [k, n] of Object.entries(v)) if (typeof n === 'number') sortie[Number(k)] = n;
    }
    return sortie;
  };
  return {
    comptes: nombres(r['comptes']),
    rangs: nombres(r['rangs']),
    points: nombres(r['points']),
  };
}

/** Les équipes en tête d'un thème classé (plusieurs en cas d'égalité), et leur nombre de mots. */
export function enTeteDuTheme(
  passage: PassageSalle,
  equipes: EquipeSalle[],
): { equipes: EquipeSalle[]; mots: number } | null {
  const classement = classementDuTheme(passage);
  if (!classement) return null;
  const premieres = equipes.filter((e) => classement.rangs[e.numero] === 1);
  if (premieres.length === 0) return null;
  return { equipes: premieres, mots: classement.comptes[premieres[0]!.numero] ?? 0 };
}
