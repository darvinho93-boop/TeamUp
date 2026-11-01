import { z } from 'zod';
import { LANGUES, normaliserCode } from '@/lib/partie';
import { changerLangue } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Saisie = z.object({ langue: z.enum(LANGUES) });

const STATUT = { session: 401, langue: 422 } as const;

/** Le joueur change de langue en cours de soirée, parmi celles de la soirée. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/langue'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Saisie.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'langue' }, 422);

  const resultat = await changerLangue(code, saisie.data.langue);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
