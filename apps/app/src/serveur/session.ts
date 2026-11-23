import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { domaineDuCookie, DUREE_SESSION_S } from '@/lib/cookies';

/**
 * Session d'un joueur : un jeton aléatoire dans un cookie httpOnly, un par code de salle.
 * La base n'en voit que le SHA-256 ; le jeton en clair ne quitte jamais le navigateur et ce
 * serveur. C'est lui qui fait revenir un joueur sans rien ressaisir.
 *
 * Lot 15 (2026-11-15) : posé pour tout `teamup-game.fr`, le cookie est lu aussi bien en ligne
 * que sur la machine de la salle (`soiree.teamup-game.fr`), et dure 30 jours.
 */

const nomCookie = (code: string) => `tu_j_${code}`;

export function hacher(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

export async function jetonDe(code: string): Promise<string | null> {
  return (await cookies()).get(nomCookie(code))?.value ?? null;
}

/**
 * Le jeton d'une demande d'inscription (2026-11-23) : la réponse peut se perdre après l'écriture
 * en base, et le nouvel essai du même téléphone doit retrouver sa fiche au lieu de buter sur
 * « prénom déjà pris ». Le navigateur ne connaît que la demande, jamais la valeur du cookie.
 */
export function jetonDeDemande(code: string, demande: string): string {
  return createHash('sha256').update(`tu-arrivee:${code}:${demande}`).digest('base64url');
}

export async function nouvelleSession(code: string, jetonImpose?: string): Promise<string> {
  const jeton = jetonImpose ?? randomBytes(32).toString('base64url');
  const domaine = domaineDuCookie((await headers()).get('host'));
  (await cookies()).set(nomCookie(code), jeton, {
    httpOnly: true,
    sameSite: 'lax',
    // Secours de la machine de la salle sans certificat, servie en http (`TU_RESEAU_LOCAL=1` au
    // démarrage) : un cookie `secure` y serait refusé par le téléphone. En ligne, la variable est
    // absente.
    secure: process.env.NODE_ENV === 'production' && process.env.TU_RESEAU_LOCAL !== '1',
    path: '/',
    maxAge: DUREE_SESSION_S,
    ...(domaine ? { domain: domaine } : {}),
  });
  return jeton;
}
