import { z } from 'zod';
import { AVIS_NEGATIF_MAX, AVIS_POSITIF_MAX, AVIS_POSITIFS_MAX } from '@/lib/avis';
import { normaliserCode } from '@/lib/partie';
import { donnerAvis } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

// Large ici (émojis comptés en double par JavaScript) : la base tranche au caractère près.
const Avis = z.object({
  positifs: z
    .array(z.string().max(AVIS_POSITIF_MAX * 4))
    .min(1)
    .max(AVIS_POSITIFS_MAX),
  negatif: z
    .string()
    .max(AVIS_NEGATIF_MAX * 4)
    .nullable(),
  rien_a_redire: z.boolean(),
  citable: z.boolean(),
});

const STATUT = { session: 401, fermes: 403, avis: 422 } as const;

/** Un joueur donne son avis sur la soirée (2026-11-18) ; renvoie l'état à jour. */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/avis'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Avis.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'avis' }, 422);

  const resultat = await donnerAvis(code, saisie.data);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
