import { z } from 'zod';
import { normaliserCode } from '@/lib/partie';
import { ajouterInvite } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Invite = z.object({
  prenom: z.string().trim().min(1).max(40),
  groupe: z.uuid().nullish(),
});

const STATUT = { session: 401, interdit: 403, complet: 409, groupe: 422, close: 409 } as const;

/**
 * Un joueur autorisé ajoute un invité sans téléphone. Renvoie le prénom et l'équipe tirée,
 * pour qu'il les annonce à l'invité.
 */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/invite'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Invite.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'prenom' }, 422);

  const resultat = await ajouterInvite(code, saisie.data.prenom, saisie.data.groupe ?? null);
  return resultat.ok
    ? reponse({ prenom: resultat.prenom, equipe: resultat.equipe })
    : reponse({ erreur: resultat.erreur }, STATUT[resultat.erreur]);
}
