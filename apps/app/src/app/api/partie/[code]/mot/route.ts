import { z } from 'zod';
import { LONGUEUR_MOT_MAX } from '@teamup/game';
import { normaliserCode } from '@/lib/partie';
import { motSurenchere } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Mot = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ajouter'),
    mot: z.string().trim().min(1).max(LONGUEUR_MOT_MAX),
    // Le thème pour lequel le mot a été tapé (facultatif : un ancien téléphone ne l'envoie pas).
    passage: z.uuid().optional(),
  }),
  z.object({ type: z.literal('retirer'), id: z.uuid() }),
]);

const STATUT = {
  session: 401,
  capitaine: 403,
  fermee: 409,
  doublon: 409,
  trop: 409,
  mot: 422,
} as const;

/** Surenchère en mode téléphones : le capitaine ajoute ou retire un mot ; renvoie l'état à jour. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/mot'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Mot.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'mot' }, 422);

  const resultat = await motSurenchere(code, saisie.data);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
