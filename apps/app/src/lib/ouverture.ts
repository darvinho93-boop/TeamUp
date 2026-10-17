/**
 * L'ouverture de l'écran commun : les quatre ronds du teaser tournent en boucle avant la page du
 * QR code. Au passage à « Accueil », la boucle en cours va à son terme (on ne coupe pas la
 * cinématique), puis une passe finale forme le logo Team Up! et mène à la page du QR.
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
 * deviennent le pictogramme à 52-58 % d'un cycle, comme dans la boucle. Le logo tombe sur la
 * cymbale du roulement de tambour (à 5 s dans le son, cf. `scripts/sons-elevenlabs.mjs`), le nom
 * suit, puis la page du QR paraît en fondu.
 */
export const FINALE = {
  ronds: 0,
  logo: 5000,
  nom: 5600,
  qr: 7400,
  fin: 8000,
} as const;
