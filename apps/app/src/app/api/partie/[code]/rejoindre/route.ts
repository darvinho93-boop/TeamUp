import { z } from 'zod';
import { LANGUES, normaliserCode } from '@/lib/partie';
import { etatDuJoueur, etatPourJeton, rejoindre } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';
import { nouvelleSession } from '@/serveur/session';

const Arrivee = z.object({
  prenom: z.string().trim().min(1).max(40),
  langue: z.enum(LANGUES),
  groupe: z.uuid().nullish(),
});

const STATUT = { code_inconnu: 404, complet: 409, langue: 422, groupe: 422 } as const;

/**
 * Entrée dans la partie. Idempotente : un joueur qui a déjà sa session dans cette salle
 * (double appui, retour arrière) la retrouve au lieu d'en créer une seconde.
 */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/rejoindre'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'code_inconnu' }, 404);

  const dejaLa = await etatDuJoueur(code);
  if (dejaLa) return reponse(dejaLa);

  const saisie = Arrivee.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'prenom' }, 422);

  const jeton = await nouvelleSession(code);
  const { prenom, langue, groupe } = saisie.data;
  const resultat = await rejoindre(code, prenom, langue, jeton, groupe ?? null);
  if (!resultat.ok) return reponse({ erreur: resultat.erreur }, STATUT[resultat.erreur]);

  return reponse(await etatPourJeton(code, jeton));
}
