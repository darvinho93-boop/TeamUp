import { normaliserCode } from '@/lib/partie';
import { buzzerBlind } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const STATUT = { session: 401, capitaine: 403, bloquee: 403, tard: 409 } as const;

/** Blind test : le buzz du capitaine ; renvoie l'état à jour pour l'afficher sans attendre. */
export async function POST(_req: Request, { params }: RouteContext<'/api/partie/[code]/buzz'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);
  const resultat = await buzzerBlind(code);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
