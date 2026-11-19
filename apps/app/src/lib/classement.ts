/**
 * Le classement qui monte (2026-11-19, audit « jeu télé ») : l'écran part des totaux d'avant le
 * dernier jeu, fait pousser les barres jusqu'aux totaux d'aujourd'hui, puis range les équipes à
 * leur nouvelle place. Le dernier jeu est celui de la ligne de score la plus récente ; une
 * correction faite hors jeu (sans manche) reste dans « avant ».
 */

/** Une ligne du journal des scores, telle que l'écran la lit. */
export interface LigneScore {
  equipe_id: string;
  manche_id: string | null;
  points: number;
  cree_le: string;
}

interface EquipeClassee {
  id: string;
  numero: number;
  points: number;
}

/** La pousse des barres, puis le moment où les équipes changent de place (`--tu-dur-classement`). */
export const POUSSE_CLASSEMENT_MS = 1300;
export const DEPART_POUSSE_MS = 300;
export const CHANGEMENT_DE_PLACE_MS = DEPART_POUSSE_MS + POUSSE_CLASSEMENT_MS;

/** Le total de chaque équipe avant le dernier jeu ; sans jeu dans le journal, tout part de 0. */
export function totauxAvant(
  lignes: readonly LigneScore[],
  equipes: readonly EquipeClassee[],
): Map<string, number> {
  let derniere: LigneScore | null = null;
  for (const l of lignes) {
    if (l.manche_id !== null && (!derniere || l.cree_le > derniere.cree_le)) derniere = l;
  }
  if (!derniere) return new Map(equipes.map((e) => [e.id, 0]));
  const duDernier = new Map<string, number>();
  for (const l of lignes) {
    if (l.manche_id === derniere.manche_id)
      duDernier.set(l.equipe_id, (duDernier.get(l.equipe_id) ?? 0) + l.points);
  }
  return new Map(equipes.map((e) => [e.id, e.points - (duDernier.get(e.id) ?? 0)]));
}

/** Le rang de chaque équipe (0 en tête) selon des totaux, à égalité par numéro d'équipe. */
export function rangs(
  equipes: readonly EquipeClassee[],
  totaux: ReadonlyMap<string, number>,
): Map<string, number> {
  const ordre = [...equipes].sort(
    (a, b) => (totaux.get(b.id) ?? 0) - (totaux.get(a.id) ?? 0) || a.numero - b.numero,
  );
  return new Map(ordre.map((e, i) => [e.id, i]));
}
