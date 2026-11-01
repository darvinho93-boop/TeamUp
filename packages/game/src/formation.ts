/**
 * Formation des équipes par la régie (lot 14, tranché le 2026-11-01). Les invités s'inscrivent
 * sans équipe ; l'animateur choisit le nombre d'équipes et lance la formation : groupes mélangés,
 * un capitaine par équipe tiré parmi les volontaires (l'équipe prend le nom qu'il a proposé),
 * puis les contenus de Points communs et du Mime tirés dans la réserve de chaque manche.
 * L'appelant fournit le hasard : rien ici ne dépend d'une horloge.
 */

import type { Alea } from './duels';
import { tirerOrdre } from './ordre';

export const MIN_EQUIPES = 2;
export const MAX_EQUIPES = 8;

export interface Inscrit {
  id: string;
  /** Groupe choisi à l'inscription (lot 11) ; `null` : sans groupe. */
  groupe: string | null;
  /** S'est proposé comme capitaine. */
  volontaire: boolean;
  /** Nom d'équipe proposé par un volontaire. */
  nomPropose: string | null;
  /** Un invité sans téléphone ne peut pas être capitaine (lot du 2026-10-17). */
  telephone: boolean;
}

export interface EquipeFormee {
  /** De 1 à `nbEquipes`. */
  numero: number;
  /** Nom proposé par le capitaine volontaire ; `null` : nom par défaut, à poser par l'appelant. */
  nom: string | null;
  capitaine: string | null;
  membres: string[];
}

/**
 * Répartit les inscrits en `nbEquipes` équipes. D'abord les capitaines : les volontaires
 * mélangés, un par équipe. Puis chaque groupe, du plus nombreux au moins nombreux, et enfin les
 * inscrits sans groupe : chacun va dans l'équipe qui compte le moins de son groupe, puis le
 * moins de joueurs, au hasard entre ex aequo. Une équipe restée sans volontaire prend pour
 * capitaine un de ses membres qui a un téléphone, au hasard.
 */
export function formerEquipes({
  inscrits,
  nbEquipes,
  alea,
}: {
  inscrits: readonly Inscrit[];
  nbEquipes: number;
  alea: Alea;
}): EquipeFormee[] {
  if (!Number.isInteger(nbEquipes) || nbEquipes < MIN_EQUIPES || nbEquipes > MAX_EQUIPES) {
    throw new RangeError(`nombre d'équipes hors de ${MIN_EQUIPES} à ${MAX_EQUIPES}`);
  }
  const equipes: EquipeFormee[] = Array.from({ length: nbEquipes }, (_, i) => ({
    numero: i + 1,
    nom: null,
    capitaine: null,
    membres: [],
  }));
  const parGroupe = equipes.map(() => new Map<string | null, number>());
  const groupeDe = new Map(inscrits.map((j) => [j.id, j.groupe]));
  const placer = (equipe: number, id: string) => {
    equipes[equipe]!.membres.push(id);
    const groupe = groupeDe.get(id) ?? null;
    parGroupe[equipe]!.set(groupe, (parGroupe[equipe]!.get(groupe) ?? 0) + 1);
  };

  // Les capitaines volontaires : les équipes dans un ordre tiré, pour que l'équipe 1 n'ait pas
  // toujours le premier volontaire.
  const volontaires = tirerOrdre(
    inscrits.filter((j) => j.volontaire && j.telephone),
    alea,
  );
  const ordreEquipes = tirerOrdre(
    equipes.map((_, i) => i),
    alea,
  );
  const places = new Set<string>();
  volontaires.slice(0, nbEquipes).forEach((j, k) => {
    const i = ordreEquipes[k]!;
    equipes[i]!.capitaine = j.id;
    const nom = j.nomPropose?.trim();
    equipes[i]!.nom = nom ? nom : null;
    placer(i, j.id);
    places.add(j.id);
  });

  // Les autres, groupe par groupe : les plus nombreux d'abord, ils se répartissent mieux.
  const restants = inscrits.filter((j) => !places.has(j.id));
  const groupes = new Map<string | null, Inscrit[]>();
  for (const j of restants) groupes.set(j.groupe, [...(groupes.get(j.groupe) ?? []), j]);
  const ordreGroupes = [...groupes.entries()].sort(
    ([ga, a], [gb, b]) => Number(ga === null) - Number(gb === null) || b.length - a.length,
  );
  for (const [groupe, membres] of ordreGroupes) {
    for (const j of tirerOrdre(membres, alea)) {
      const cle = (i: number) =>
        [parGroupe[i]!.get(groupe) ?? 0, equipes[i]!.membres.length] as const;
      const candidates = equipes
        .map((_, i) => i)
        .filter((i) => {
          const [g, n] = cle(i);
          return equipes.every((_, k) => {
            const [gk, nk] = cle(k);
            return g < gk || (g === gk && n <= nk);
          });
        });
      placer(candidates[Math.floor(alea() * candidates.length)]!, j.id);
    }
  }

  // Une équipe sans volontaire : un capitaine tiré parmi ses membres qui ont un téléphone.
  const telephone = new Set(inscrits.filter((j) => j.telephone).map((j) => j.id));
  for (const equipe of equipes) {
    if (equipe.capitaine) continue;
    const possibles = equipe.membres.filter((id) => telephone.has(id));
    if (possibles.length) equipe.capitaine = possibles[Math.floor(alea() * possibles.length)]!;
  }
  return equipes;
}

/**
 * Les contenus d'une manche jouée une équipe à la fois (Points communs, Mime), tirés dans sa
 * réserve sans remise : `tours` contenus par équipe. Le k-ième tour de chaque équipe vient après
 * le tour k − 1 de toutes les équipes ; l'ordre de passage se tire ensuite (lot 13).
 */
export function tirerContenus(
  reserve: readonly string[],
  equipes: readonly string[],
  tours: number,
  alea: Alea,
): { equipe: string; contenu: string; ordre: number }[] {
  const uniques = [...new Set(reserve)];
  const besoin = equipes.length * tours;
  if (uniques.length < besoin) {
    throw new RangeError(`réserve insuffisante : ${uniques.length} contenus pour ${besoin}`);
  }
  const tires = tirerOrdre(uniques, alea);
  const resultat: { equipe: string; contenu: string; ordre: number }[] = [];
  for (let tour = 0; tour < tours; tour++) {
    equipes.forEach((equipe, i) => {
      const n = tour * equipes.length + i;
      resultat.push({ equipe, contenu: tires[n]!, ordre: n + 1 });
    });
  }
  return resultat;
}
