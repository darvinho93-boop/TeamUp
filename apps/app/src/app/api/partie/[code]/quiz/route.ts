import { z } from 'zod';
import { normaliserCode } from '@/lib/partie';
import { repondreQuiz } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Reponse = z.object({ choix: z.number().int().min(0).max(3) });

const STATUT = { session: 401, fermee: 409, spectateur: 409, elimine: 409, deja: 409 } as const;

/** Réponse au quiz en mode téléphone ; renvoie l'état à jour pour l'afficher sans attendre. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/quiz'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Reponse.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'choix' }, 422);

  const resultat = await repondreQuiz(code, saisie.data.choix);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
