import { normaliserCode } from '@/lib/partie';
import { etatDuJoueur } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

/** État de l'écran d'attente, relu régulièrement par le téléphone. */
export async function GET(_req: Request, { params }: RouteContext<'/api/partie/[code]/etat'>) {
  const code = normaliserCode((await params).code);
  const etat = code ? await etatDuJoueur(code) : null;
  return etat ? reponse(etat) : reponse({ erreur: 'session' }, 401);
}
