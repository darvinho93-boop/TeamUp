import { z } from 'zod';
import { normaliserCode } from '@/lib/partie';
import { renommerEquipe } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Nom = z.object({ nom: z.string().trim().min(1).max(24) });

const STATUT = { session: 401, capitaine: 403, fige: 409, nom: 422 } as const;

/** Le capitaine renomme son équipe ; renvoie l'état à jour pour l'afficher sans attendre. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/equipe'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Nom.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'nom' }, 422);

  const resultat = await renommerEquipe(code, saisie.data.nom);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
