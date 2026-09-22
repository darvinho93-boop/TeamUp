/**
 * Filtre anti-robots, sans captcha. Deux indices suffisent pour écarter le spam courant :
 * un champ piège invisible rempli, ou un formulaire envoyé trop vite après son affichage.
 * Un robot écarté voit la même confirmation qu'un humain : il n'apprend rien.
 */

/** Champ piège : caché aux humains et aux lecteurs d'écran, tentant pour un robot. */
export const CHAMP_PIEGE = 'site_web';
/** Horodatage posé à l'affichage du formulaire. */
export const CHAMP_OUVERTURE = 'ouvert_a';
/** Aucun humain ne remplit huit champs en moins de trois secondes. */
export const DELAI_MINIMAL_MS = 3000;

export function estUnRobot(form: FormData, maintenant = Date.now()): boolean {
  const piege = form.get(CHAMP_PIEGE);
  if (typeof piege === 'string' && piege.trim() !== '') return true;

  const ouverture = Number(form.get(CHAMP_OUVERTURE));
  if (!Number.isFinite(ouverture) || ouverture <= 0) return true;
  return maintenant - ouverture < DELAI_MINIMAL_MS;
}
