import { z } from 'zod';
import { normaliserCode, TAILLE_MAX_PHOTO } from '@/lib/partie';
import { envoyerPhoto } from '@/serveur/photo';
import { reponse } from '@/serveur/reponse';

const Envoi = z.object({
  theme_id: z.uuid(),
  envoi_id: z.uuid(),
  fichier: z
    .instanceof(Blob)
    .refine((f) => f.type === 'image/jpeg' && f.size > 0 && f.size <= TAILLE_MAX_PHOTO),
});

const STATUT = { session: 401, capitaine: 403, close: 409, theme: 422, fichier: 422 } as const;

/**
 * Photo du capitaine, en multipart. Le corps reste sous la limite de Vercel (4,5 Mo) : le
 * téléphone compresse avant d'envoyer. Renvoie l'état à jour pour l'afficher sans attendre.
 */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/photo'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const formulaire = await req.formData().catch(() => null);
  const saisie = Envoi.safeParse({
    theme_id: formulaire?.get('theme_id'),
    envoi_id: formulaire?.get('envoi_id'),
    fichier: formulaire?.get('fichier'),
  });
  if (!saisie.success) return reponse({ erreur: 'fichier' }, STATUT.fichier);

  const { theme_id, envoi_id, fichier } = saisie.data;
  const resultat = await envoyerPhoto(code, theme_id, envoi_id, fichier);
  return resultat.ok
    ? reponse(resultat.etat)
    : reponse({ erreur: resultat.refus }, STATUT[resultat.refus]);
}
