/**
 * Les scènes du Ciné-mime (2026-11-20) : un MP4 par contenu, déposé au back-office dans le bucket
 * privé « extraits », joué par l'écran commun. Règles pures : contrôle d'un fichier avant l'envoi,
 * forme de ce que la base rend.
 */

import { EXTRAIT_CINEMIME_MAX_MS, EXTRAIT_CINEMIME_MIN_MS } from '@teamup/game';

/** 40 Mo, la limite du bucket : une scène de 45 s en 720p en fait 10 à 20. */
export const TAILLE_MAX_EXTRAIT = 40 * 1024 * 1024;
/** Au-delà, le dépôt passe, mais le back-office conseille de raccourcir. */
export const DUREE_CONSEILLEE_MS = 45_000;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHEMIN = new RegExp(`^${UUID}\\.mp4$`);

/** Le chemin d'un nouveau fichier dans le bucket : un uuid neuf, jamais réutilisé. */
export const cheminExtrait = (uuid: string) => `${uuid}.mp4`;
export const estCheminExtrait = (chemin: unknown): chemin is string =>
  typeof chemin === 'string' && CHEMIN.test(chemin);

/**
 * Le fichier commence-t-il comme un MP4 ? Sa première boîte est `ftyp` (octets 4 à 7). Le bucket
 * ne contrôle que le type annoncé : c'est ce qui écarte un fichier renommé.
 */
export function estMp4(debut: Uint8Array): boolean {
  if (debut.length < 8) return false;
  return debut[4] === 0x66 && debut[5] === 0x74 && debut[6] === 0x79 && debut[7] === 0x70;
}

export type RefusExtrait = 'vide' | 'taille' | 'format' | 'illisible' | 'duree';

/**
 * Ce qui empêche un dépôt, ou `null`. `dureeMs` est celle que le navigateur a lue dans le
 * fichier ; `null` s'il n'a pas su le lire (codec qu'il ne connaît pas : l'écran ne le lirait pas
 * non plus).
 */
export function refusExtrait(fichier: {
  taille: number;
  debut: Uint8Array;
  dureeMs: number | null;
}): RefusExtrait | null {
  if (fichier.taille === 0) return 'vide';
  if (fichier.taille > TAILLE_MAX_EXTRAIT) return 'taille';
  if (!estMp4(fichier.debut)) return 'format';
  if (fichier.dureeMs === null || !Number.isFinite(fichier.dureeMs)) return 'illisible';
  const duree = Math.round(fichier.dureeMs);
  if (duree < EXTRAIT_CINEMIME_MIN_MS || duree > EXTRAIT_CINEMIME_MAX_MS) return 'duree';
  return null;
}

/** La vidéo d'un passage, telle que l'état de l'écran la donne : lue sans confiance. */
export interface ExtraitDuPassage {
  chemin: string;
  dureeMs: number;
}

export function extraitDe(brut: unknown): ExtraitDuPassage | null {
  if (!brut || typeof brut !== 'object') return null;
  const { chemin, duree_ms: duree } = brut as Record<string, unknown>;
  if (!estCheminExtrait(chemin) || typeof duree !== 'number' || !Number.isFinite(duree))
    return null;
  return { chemin, dureeMs: duree };
}

/** Une durée lisible : « 32 s », « 1 min 05 ». */
export function dureeLisible(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
}

/**
 * Les vidéos à précharger : celles des passages de Ciné-mime pas encore joués du programme, et
 * celle du passage en cours (sa scène rejoue au verdict). Celles déjà jouées restent en mémoire si
 * l'écran les avait.
 */
export function extraitsDuProgramme(etat: {
  programme: readonly {
    jeu: string;
    statut: string;
    passages: readonly { id: string; statut: string; extrait?: unknown }[];
  }[];
  pilotage: { passage_id: string | null };
}): string[] {
  const chemins = new Set<string>();
  for (const manche of etat.programme) {
    if (manche.jeu !== 'cinemime' || manche.statut === 'annulee') continue;
    for (const passage of manche.passages) {
      const extrait = extraitDe(passage.extrait);
      if (extrait && (passage.statut !== 'termine' || passage.id === etat.pilotage.passage_id))
        chemins.add(extrait.chemin);
    }
  }
  return [...chemins];
}
