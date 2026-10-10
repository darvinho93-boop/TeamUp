/**
 * Adresse de l'app de jeu (joueurs, régie). Fixée au déploiement par `PUBLIC_APP_URL` ;
 * à défaut, le sous-domaine prévu.
 */
const declaree = import.meta.env['PUBLIC_APP_URL'] as string | undefined;

export const APP_URL = (declaree || 'https://app.teamup-game.fr').replace(/\/$/, '');
