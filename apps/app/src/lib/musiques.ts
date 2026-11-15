/**
 * La bibliothèque de musiques (2026-11-15) : des MP3 déposés au back-office, que la préparation
 * coche pour chaque Quiz et chaque Surenchère, et que l'écran commun joue sous les chronos.
 * Règles pures : contrôle d'un fichier avant l'envoi, choix d'une manche.
 */

/** 15 Mo, la limite du bucket « musiques » : un extrait ou un morceau entier, pas un album. */
export const TAILLE_MAX_MUSIQUE = 15 * 1024 * 1024;
export const TITRE_MAX_MUSIQUE = 80;

/** Une musique de la bibliothèque, telle que la lit la régie. */
export interface Musique {
  id: string;
  titre: string;
  chemin: string;
  taille: number;
  actif: boolean;
}

/**
 * Le fichier commence-t-il comme un MP3 ? Une étiquette ID3 (« ID3 »), ou directement une trame
 * MPEG audio (onze bits de synchronisation à 1). Le bucket ne contrôle que le type annoncé :
 * c'est ce qui écarte un fichier renommé.
 */
export function estMp3(debut: Uint8Array): boolean {
  if (debut.length < 3) return false;
  if (debut[0] === 0x49 && debut[1] === 0x44 && debut[2] === 0x33) return true;
  return debut[0] === 0xff && (debut[1]! & 0xe0) === 0xe0;
}

export type RefusMusique = 'titre' | 'format' | 'taille' | 'vide';

/** Ce qui empêche un dépôt, ou `null`. */
export function refusMusique(
  titre: string,
  fichier: { taille: number; debut: Uint8Array },
): RefusMusique | null {
  const propre = titre.trim();
  if (propre.length < 1 || propre.length > TITRE_MAX_MUSIQUE) return 'titre';
  if (fichier.taille === 0) return 'vide';
  if (fichier.taille > TAILLE_MAX_MUSIQUE) return 'taille';
  if (!estMp3(fichier.debut)) return 'format';
  return null;
}

/** Le chemin d'un nouveau fichier dans le bucket : un uuid neuf, jamais réutilisé. */
export const cheminMusique = (uuid: string) => `${uuid}.mp3`;

/** La taille lisible d'un fichier : en Ko sous le Mo, en Mo à une décimale au-delà. */
export function tailleLisible(octets: number, langue: string): string {
  if (octets < 1024 * 1024)
    return `${Math.max(1, Math.round(octets / 1024)).toLocaleString(langue)} Ko`;
  const mo = octets / (1024 * 1024);
  return `${mo.toLocaleString(langue, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Mo`;
}

/** Les musiques cochées pour une manche (`options.musiques`), sans doublon ni valeur étrangère. */
export function musiquesDe(options: Record<string, unknown> | null | undefined): string[] {
  const liste = options?.['musiques'];
  if (!Array.isArray(liste)) return [];
  return [...new Set(liste.filter((x): x is string => typeof x === 'string' && x.length > 0))];
}
