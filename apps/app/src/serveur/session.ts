import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Session d'un joueur : un jeton aléatoire dans un cookie httpOnly, un par code de salle.
 * La base n'en voit que le SHA-256 ; le jeton en clair ne quitte jamais le navigateur et ce
 * serveur. C'est lui qui fait revenir un joueur sans rien ressaisir.
 */

const DUREE_S = 24 * 60 * 60;

const nomCookie = (code: string) => `tu_j_${code}`;

export function hacher(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

export async function jetonDe(code: string): Promise<string | null> {
  return (await cookies()).get(nomCookie(code))?.value ?? null;
}

export async function nouvelleSession(code: string): Promise<string> {
  const jeton = randomBytes(32).toString('base64url');
  (await cookies()).set(nomCookie(code), jeton, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DUREE_S,
  });
  return jeton;
}
