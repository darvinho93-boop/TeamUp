import { z } from 'zod';
import { normaliserCode } from '@/lib/partie';
import { miserQuiz } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Mise = z.object({
  repartition: z.array(z.number().int().min(0).max(999)).length(4),
  valider: z.boolean(),
});

const STATUT = {
  session: 401,
  capitaine: 403,
  fermee: 409,
  deja: 409,
  temps: 409,
  invalide: 422,
} as const;

/** Mise du capitaine en mode jetons ; renvoie l'état à jour pour l'afficher sans attendre. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/mise'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Mise.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'invalide' }, 422);

  const resultat = await miserQuiz(code, saisie.data.repartition, saisie.data.valider);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
