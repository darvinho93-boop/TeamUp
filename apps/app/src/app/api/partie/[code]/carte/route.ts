import { z } from 'zod';
import { CARTE_AGE_MAX, CARTE_AGE_MIN, CARTE_ANECDOTE_MAX, CARTE_METIER_MAX } from '@/lib/cartes';
import { normaliserCode } from '@/lib/partie';
import { enregistrerCarte } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

// Large ici (émojis comptés en double par JavaScript) : la base tranche au caractère près.
const Carte = z.object({
  age: z.number().int().min(CARTE_AGE_MIN).max(CARTE_AGE_MAX).nullable(),
  metier: z
    .string()
    .max(CARTE_METIER_MAX * 4)
    .nullable(),
  anecdote: z
    .string()
    .max(CARTE_ANECDOTE_MAX * 4)
    .nullable(),
  accord: z.boolean(),
});

const STATUT = { session: 401, termine: 409, carte: 422 } as const;

/** Un joueur écrit sa carte « Faisons connaissance » (2026-11-18) ; renvoie l'état à jour. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/carte'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Carte.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'carte' }, 422);

  const resultat = await enregistrerCarte(code, saisie.data);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
