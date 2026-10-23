/**
 * L'ouverture de l'écran commun : les quatre ronds du teaser tournent en boucle avant la page du
 * QR code. Au passage à « Accueil », une passe finale forme le logo Team Up! et mène à la page
 * du QR, sans jamais couper la cinématique : elle reprend la boucle là où elle en est quand
 * c'est possible (`raccordFinale`), sinon elle attend la fin du cycle en cours.
 */

/** Un cycle de la boucle, égal au token `--tu-dur-ronds-cycle` (testé). */
export const CYCLE_OUVERTURE_MS = 9000;

/** Ce qui reste du cycle en cours, la boucle ayant commencé il y a `ecouleMs`. */
export function attenteFinDeBoucle(ecouleMs: number, cycleMs = CYCLE_OUVERTURE_MS): number {
  const dans = ((Math.max(0, ecouleMs) % cycleMs) + cycleMs) % cycleMs;
  return (cycleMs - dans) % cycleMs;
}

/**
 * La passe finale (ms depuis son début), calquée sur la boucle : les ronds arrivent, tournent et
 * deviennent le pictogramme à 52-58 % d'un cycle, comme dans la boucle. Le logo tombe sur le coup
 * de la piste du reel (`COUP_FINALE_MS`, `src/lib/sons.ts`), le nom suit, puis la page du QR
 * paraît en fondu (raccourci le 2026-10-23 : 0,8 s sur le nom au lieu de 1,8 s).
 */
export const FINALE = {
  ronds: 0,
  logo: 5000,
  nom: 5600,
  qr: 6400,
  fin: 7000,
} as const;

/**
 * Jusqu'où, dans un cycle, la passe finale peut reprendre la boucle à l'identique : elle en suit
 * les images clés jusqu'au pictogramme formé, et s'en sépare quand le nom paraît (62 %), là où la
 * boucle commence à défaire le logo.
 */
export const PART_REPRISE = 0.62;

/**
 * Au passage à l'accueil, la boucle ayant commencé il y a `ecouleMs` : la passe finale part après
 * `attenteMs`, à `depuisMs` de son début. Avant que le nom ne paraisse, elle prend la boucle au vol
 * (aucune attente) ; au-delà, la boucle va au bout de son cycle et la passe repart de zéro.
 */
export function raccordFinale(
  ecouleMs: number,
  cycleMs = CYCLE_OUVERTURE_MS,
): { attenteMs: number; depuisMs: number } {
  const position = Math.max(0, ecouleMs) % cycleMs;
  return position < cycleMs * PART_REPRISE
    ? { attenteMs: 0, depuisMs: position }
    : { attenteMs: cycleMs - position, depuisMs: 0 };
}
