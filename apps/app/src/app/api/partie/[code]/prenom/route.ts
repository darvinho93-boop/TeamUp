import { z } from 'zod';
import { normaliserCode } from '@/lib/partie';
import { prenomDisponible } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

const Saisie = z.object({ prenom: z.string().trim().min(1).max(40) });

/**
 * Le prénom saisi est-il libre dans cette soirée ? Demandé par le téléphone avant le groupe et
 * « Capitaine ? », pour refuser un doublon tout de suite. L'arrivée revérifie de toute façon.
 */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/prenom'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'code_inconnu' }, 404);

  const saisie = Saisie.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'prenom' }, 422);

  return reponse({ libre: await prenomDisponible(code, saisie.data.prenom) });
}
