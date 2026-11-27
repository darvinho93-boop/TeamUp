/**
 * Le thème « faire-part » de l'écran commun (2026-11-27), fait pour le mariage du 5 décembre : la
 * soirée prend l'univers du faire-part de ses hôtes. Rien des hôtes dans le code : leurs fichiers
 * sont dans le bucket privé « themes », leurs textes dans la ligne `themes_soiree`, posée par la
 * clé de service (`scripts/theme-soiree.mjs`). Règles pures : forme de la ligne, fichiers à
 * télécharger, minutage de l'entrée.
 */

/** Les fichiers d'un thème faire-part, par rôle : des chemins du bucket « themes ». */
export interface FichiersFairePart {
  /** Le monogramme des hôtes (PNG ou WebP, fond transparent). */
  monogramme: string;
  /** Leurs prénoms, écrits (une image : leurs polices ne sont pas libres). */
  prenoms: string;
  /** L'illustration de leur carte, en SVG : elle se dessine trait par trait. */
  illustration: string;
  /** Les rinceaux des bords de l'écran (SVG en motif vertical). */
  rinceau: string;
  /** Le grain du papier (SVG en motif). */
  grain: string;
  /** La musique de l'arrivée : les premières notes, puis l'orchestre (WAV). */
  musique: string;
  /** L'ambiance de la soirée, en boucle (WAV ou MP3) ; sans elle, l'ambiance Team Up! reste. */
  ambiance?: string;
}

export interface ReglagesFairePart {
  /** La date de la fête, telle qu'affichée sous les prénoms. */
  date: string;
  /** Le merci de la clôture. */
  merci?: string;
  /** L'instant (ms) où l'orchestre entre dans la musique de l'arrivée : la bascule y tombe. */
  orchestreMs: number;
  /** La durée d'un temps de cette musique (ms) : l'entrée suit ses mesures, de quatre temps. */
  tempsMs: number;
  /** Les notes des premières mesures (ms depuis le début de la musique) : un éclat sur chacune. */
  notesMs: number[];
}

export interface ThemeFairePart {
  theme: 'faire-part';
  fichiers: FichiersFairePart;
  reglages: ReglagesFairePart;
}

const ROLES_OBLIGATOIRES = [
  'monogramme',
  'prenoms',
  'illustration',
  'rinceau',
  'grain',
  'musique',
] as const;

/** Un chemin du bucket : des segments sages, sans `..` ni barre initiale. */
const CHEMIN = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9._-]*)+$/;
const estChemin = (x: unknown): x is string =>
  typeof x === 'string' && CHEMIN.test(x) && !x.includes('..');

/** L'orchestre entre au plus tard 20 s après le début : au-delà, l'attente serait trop longue. */
const ORCHESTRE_MAX_MS = 20_000;

/** Le temps par défaut : 64 temps par minute, celui de la musique du 5 décembre. */
const TEMPS_PAR_DEFAUT_MS = 937;
const TEMPS_MIN_MS = 300;
const TEMPS_MAX_MS = 2000;

/**
 * Le thème que la base rend, vérifié, ou `null` : une ligne mal formée laisse l'écran Team Up!
 * habituel, jamais un écran à moitié habillé.
 */
export function themeDe(ligne: unknown): ThemeFairePart | null {
  if (!ligne || typeof ligne !== 'object') return null;
  const { theme, fichiers, reglages } = ligne as Record<string, unknown>;
  if (theme !== 'faire-part') return null;
  if (!fichiers || typeof fichiers !== 'object') return null;
  if (!reglages || typeof reglages !== 'object') return null;
  const f = fichiers as Record<string, unknown>;
  if (!ROLES_OBLIGATOIRES.every((role) => estChemin(f[role]))) return null;
  if (f['ambiance'] !== undefined && !estChemin(f['ambiance'])) return null;
  const r = reglages as Record<string, unknown>;
  const date = typeof r['date'] === 'string' ? r['date'].trim() : '';
  const orchestreMs = r['orchestre_ms'];
  const notesMs = Array.isArray(r['notes_ms']) ? r['notes_ms'] : [];
  const tempsMs = r['temps_ms'] ?? TEMPS_PAR_DEFAUT_MS;
  if (!date || date.length > 60) return null;
  if (typeof orchestreMs !== 'number' || !(orchestreMs >= 0 && orchestreMs <= ORCHESTRE_MAX_MS))
    return null;
  if (typeof tempsMs !== 'number' || !(tempsMs >= TEMPS_MIN_MS && tempsMs <= TEMPS_MAX_MS))
    return null;
  const notes = notesMs.filter(
    (n): n is number => typeof n === 'number' && n >= 0 && n < orchestreMs,
  );
  const merci = typeof r['merci'] === 'string' && r['merci'].trim() ? r['merci'].trim() : undefined;
  return {
    theme: 'faire-part',
    fichiers: {
      monogramme: f['monogramme'] as string,
      prenoms: f['prenoms'] as string,
      illustration: f['illustration'] as string,
      rinceau: f['rinceau'] as string,
      grain: f['grain'] as string,
      musique: f['musique'] as string,
      ...(f['ambiance'] ? { ambiance: f['ambiance'] } : {}),
    },
    reglages: {
      date,
      ...(merci ? { merci } : {}),
      orchestreMs,
      tempsMs,
      notesMs: notes.slice(0, 12),
    },
  };
}

/** Les images du thème : l'écran ne s'habille qu'une fois toutes téléchargées. */
export function imagesDuTheme(theme: ThemeFairePart): string[] {
  const { monogramme, prenoms, illustration, rinceau, grain } = theme.fichiers;
  return [monogramme, prenoms, illustration, rinceau, grain];
}

/** Les sons du thème, pour l'écran projeté seulement (l'aperçu de la régie reste muet). */
export function sonsDuTheme(theme: ThemeFairePart): string[] {
  const { musique, ambiance } = theme.fichiers;
  return ambiance ? [musique, ambiance] : [musique];
}

/**
 * La musique d'arrivée commence quand le reel de la passe finale s'est éteint (il finit vers 7,1 s
 * et n'est plus qu'un souffle dès 6,8 s) : on ne coupe ni la cinématique de Team Up!, ni la musique
 * des hôtes, jouée telle quelle (revu le 2026-11-27, maquette D v6).
 */
export const DEPART_MUSIQUE_MS = 6950;

/** Après la bascule, un élément par temps de l'orchestre : le rythme grimpe. */
export const APRES_BASCULE_TEMPS = { coin: 2, encadre: 3, qr: 4, textes: 5, compte: 6 } as const;

/** Ce que dure la dernière apparition (le compte des joueurs, le bandeau). */
const DERNIERE_APPARITION_MS = 1000;

/**
 * Le minutage de l'entrée, en ms depuis le début de la passe finale (celle de l'ouverture
 * classique, `FINALE`), sur la musique des hôtes :
 * - ses premières notes quand le reel s'est éteint ;
 * - un élément de plus au début de chacune des trois mesures qui précèdent l'orchestre (son
 *   intro y répète son motif en montant) ; jamais avant les premières notes ;
 * - la bascule quand l'orchestre entre, puis un élément par temps jusqu'au QR code.
 * La feuille de style (`faire-part.css`) lit ces instants en variables.
 */
export function entreeFairePart(reglages: Pick<ReglagesFairePart, 'orchestreMs' | 'tempsMs'>) {
  const notes = DEPART_MUSIQUE_MS;
  const bascule = notes + reglages.orchestreMs;
  const temps = reglages.tempsMs;
  const passage = (mesuresAvant: number) => Math.max(notes, bascule - mesuresAvant * 4 * temps);
  const apres = (n: number) => bascule + n * temps;
  return {
    notes,
    passages: [passage(3), passage(2), passage(1)] as const,
    bascule,
    temps,
    coin: apres(APRES_BASCULE_TEMPS.coin),
    encadre: apres(APRES_BASCULE_TEMPS.encadre),
    qr: apres(APRES_BASCULE_TEMPS.qr),
    textes: apres(APRES_BASCULE_TEMPS.textes),
    compte: apres(APRES_BASCULE_TEMPS.compte),
    fin: apres(APRES_BASCULE_TEMPS.compte) + DERNIERE_APPARITION_MS,
  };
}

/** Les éclats des premières notes, en ms depuis le début de la passe finale. */
export function eclatsDesNotes(reglages: Pick<ReglagesFairePart, 'notesMs'>): number[] {
  return reglages.notesMs.map((n) => DEPART_MUSIQUE_MS + n);
}
