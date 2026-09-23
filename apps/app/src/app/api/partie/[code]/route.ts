import { normaliserCode } from '@/lib/partie';
import { evenementPublic } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

/** Le code ouvre-t-il une partie, et dans quelles langues ? */
export async function GET(_req: Request, { params }: RouteContext<'/api/partie/[code]'>) {
  const code = normaliserCode((await params).code);
  const evenement = code ? await evenementPublic(code) : null;
  return evenement ? reponse(evenement) : reponse({ erreur: 'code_inconnu' }, 404);
}
