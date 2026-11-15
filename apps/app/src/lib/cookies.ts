/**
 * Cookies partagés entre l'en ligne et la machine de la salle (lot 15, 2026-11-15).
 *
 * Un invité s'inscrit des jours avant sur `app.teamup-game.fr`, puis joue le soir sur
 * `soiree.teamup-game.fr`, servie par la machine posée en salle. Pour que son téléphone y soit
 * reconnu sans rien ressaisir, la session et la langue sont posées pour tout `teamup-game.fr`.
 * Ailleurs (localhost, adresse IP, tests), le cookie reste attaché à l'adresse qui l'a posé.
 */

/** Le domaine commun à l'app en ligne et à la machine de la salle. */
export const DOMAINE_PARTAGE = 'teamup-game.fr';

/** Durée d'une session de joueur : une inscription peut se faire des semaines avant la soirée. */
export const DUREE_SESSION_S = 30 * 24 * 60 * 60;

/**
 * Le domaine à donner au cookie pour cette adresse (en-tête `Host`, avec ou sans port), ou
 * `undefined` : le cookie reste alors attaché à l'adresse exacte.
 */
export function domaineDuCookie(hote: string | null | undefined): string | undefined {
  if (!hote) return undefined;
  const nom = hote.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  return nom === DOMAINE_PARTAGE || nom.endsWith(`.${DOMAINE_PARTAGE}`)
    ? DOMAINE_PARTAGE
    : undefined;
}
