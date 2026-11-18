/**
 * Avis des joueurs en fin de soirée (2026-11-18) : un retour en deux temps, en texte libre.
 * D'abord une à trois choses aimées, puis ce qui a moins plu, ou « rien à redire ». La régie
 * ouvre et ferme le questionnaire. Logique pure : le nettoyage des textes (le même qu'en base,
 * `nettoyer_avis`) et la synthèse de la page Avis. L'export CSV est dans `export.ts`.
 */

import type { Langue } from './partie';

/** Choses aimées, au plus. */
export const AVIS_POSITIFS_MAX = 3;
/** Longueur d'une chose aimée, en caractères (un émoji en vaut un, comme dans la base). */
export const AVIS_POSITIF_MAX = 200;
/** Longueur de ce qui a moins plu. */
export const AVIS_NEGATIF_MAX = 500;

/** L'avis d'un joueur, tel que `etat_joueur` le lui rend. */
export interface AvisDuJoueur {
  positifs: string[];
  negatif: string | null;
  rien_a_redire: boolean;
  citable: boolean;
}

/** Un avis lu par la régie (`avis_joueurs`, sous la session de l'animateur). */
export interface AvisLu extends AvisDuJoueur {
  id: string;
  /** Seulement quand le joueur accepte d'être cité. */
  prenom: string | null;
  langue: Langue;
  modifie_le: string;
}

const longueur = (texte: string) => Array.from(texte).length;

/** Une ligne : caractères de contrôle et blancs réduits à une espace, bords retirés. */
export function nettoyerLigne(texte: string): string {
  return texte.replace(/[\p{Cc}\s]+/gu, ' ').trim();
}

/**
 * Plusieurs lignes : les sauts de ligne restent, deux d'affilée au plus ; les autres caractères
 * de contrôle deviennent des espaces, les espaces se réduisent.
 */
export function nettoyerTexte(texte: string): string {
  return texte
    .replace(/\r\n?/g, '\n')
    .replace(/(?!\n)\p{Cc}/gu, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \n]+|[ \n]+$/g, '');
}

/** Caractères restants dans un champ des choses aimées (négatif : trop long). */
export function restantsPositif(texte: string): number {
  return AVIS_POSITIF_MAX - longueur(nettoyerLigne(texte));
}

/** Caractères restants dans le champ de ce qui a moins plu. */
export function restantsNegatif(texte: string): number {
  return AVIS_NEGATIF_MAX - longueur(nettoyerTexte(texte));
}

/**
 * Les choses aimées prêtes à partir : nettoyées, vides retirées, dans l'ordre. `null` si aucune
 * n'est remplie, s'il y en a plus de trois ou si l'une est trop longue (la base refuserait).
 */
export function positifsValides(positifs: readonly string[]): string[] | null {
  if (positifs.length > AVIS_POSITIFS_MAX) return null;
  const propres = positifs.map(nettoyerLigne);
  if (propres.some((p) => longueur(p) > AVIS_POSITIF_MAX)) return null;
  const remplis = propres.filter((p) => p !== '');
  return remplis.length > 0 ? remplis : null;
}

/** Ce qui a moins plu, prêt à partir ; `null` si vide ou trop long. */
export function negatifValide(texte: string): string | null {
  const propre = nettoyerTexte(texte);
  const n = longueur(propre);
  return n >= 1 && n <= AVIS_NEGATIF_MAX ? propre : null;
}

export interface SyntheseAvis {
  recus: number;
  /** Avis reçus sur joueurs qui ont un téléphone ; `null` sans aucun joueur. */
  taux: number | null;
  rienARedire: number;
  citables: number;
}

/**
 * Les chiffres de la page Avis. Un joueur retiré garde son avis : le taux est borné à 1.
 */
export function syntheseAvis(avis: readonly AvisLu[], joueursAvecTelephone: number): SyntheseAvis {
  const recus = avis.length;
  return {
    recus,
    taux: joueursAvecTelephone > 0 ? Math.min(1, recus / joueursAvecTelephone) : null,
    rienARedire: avis.filter((a) => a.rien_a_redire).length,
    citables: avis.filter((a) => a.citable).length,
  };
}
