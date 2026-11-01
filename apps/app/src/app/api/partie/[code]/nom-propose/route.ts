import { z } from 'zod';
import { normaliserCode } from '@/lib/partie';
import { proposerNom } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Nom = z.object({ nom: z.string().trim().max(24) });

const STATUT = { session: 401, volontaire: 403, formees: 409, nom: 422 } as const;

/** Le volontaire change le nom d'équipe qu'il propose, avant la formation des équipes (lot 14). */
export async function POST(
  req: Request,
  { params }: RouteContext<'/api/partie/[code]/nom-propose'>,
) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Nom.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'nom' }, 422);

  const resultat = await proposerNom(code, saisie.data.nom);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
