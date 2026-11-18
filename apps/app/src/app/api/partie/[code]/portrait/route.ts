import { z } from 'zod';
import { CARTES_PORTRAIT } from '@teamup/game';
import { normaliserCode } from '@/lib/partie';
import { voterPortrait } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Vote = z.object({
  carte: z
    .number()
    .int()
    .min(0)
    .max(CARTES_PORTRAIT - 1),
});

const STATUT = {
  session: 401,
  capitaine: 403,
  eliminee: 403,
  ferme: 409,
  trouve: 409,
  carte: 422,
} as const;

/** Portrait mystère (2026-11-18) : le vote du capitaine ; renvoie l'état à jour. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/portrait'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Vote.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'carte' }, 422);

  const resultat = await voterPortrait(code, saisie.data.carte);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
