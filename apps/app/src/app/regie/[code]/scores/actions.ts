'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { evenementDeLaRegie } from '@/serveur/regie';

export type EtatCorrection = { erreur?: string; ok?: boolean } | undefined;

const Correction = z.object({
  equipe: z.uuid(),
  points: z.coerce
    .number()
    .int()
    .min(-1000)
    .max(1000)
    .refine((n) => n !== 0),
  motif: z.string().trim().min(1).max(200),
});

/**
 * Correction manuelle : une ligne de plus dans le journal, jamais une ligne réécrite (lot 3).
 * L'historique des corrections, c'est le journal lui-même.
 */
export async function corriger(
  code: string,
  _: EtatCorrection,
  donnees: FormData,
): Promise<EtatCorrection> {
  const { supabase, animateur, evenement } = await evenementDeLaRegie(code);
  const t = await getTranslations('regie.scores');
  const saisie = Correction.safeParse({
    equipe: donnees.get('equipe'),
    points: donnees.get('points'),
    motif: donnees.get('motif'),
  });
  if (!saisie.success) return { erreur: t('invalide') };
  const { error } = await supabase.from('scores').insert({
    evenement_id: evenement.id,
    equipe_id: saisie.data.equipe,
    points: saisie.data.points,
    motif: saisie.data.motif,
    saisi_par: animateur.id,
  });
  if (error) return { erreur: t('echec') };
  revalidatePath(`/regie/${evenement.code}/scores`);
  return { ok: true };
}
