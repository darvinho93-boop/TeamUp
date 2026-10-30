'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { evenementDeLaRegie } from '@/serveur/regie';
import { signalerSalle } from '@/serveur/signal';

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

/**
 * Clôture de la soirée, depuis la régie (2026-10-30) : statut `termine`. La base refuse alors
 * toute arrivée et tout invité ajouté ; les téléphones passent sur « soirée terminée » à leur
 * relecture, que le signal déclenche aussitôt. Le pilotage reste ouvert. Réouverture possible,
 * pour une clôture faite par erreur.
 */
export async function cloturerSoiree(code: string): Promise<{ erreur?: string }> {
  return changerStatut(code, true);
}

export async function rouvrirSoiree(code: string): Promise<{ erreur?: string }> {
  return changerStatut(code, false);
}

async function changerStatut(code: string, cloturer: boolean): Promise<{ erreur?: string }> {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  const t = await getTranslations('regie.cloture');
  const { error } = await supabase
    .from('evenements')
    .update(
      cloturer
        ? { statut: 'termine', termine_le: new Date().toISOString() }
        : { statut: 'en_cours', termine_le: null },
    )
    .eq('id', evenement.id);
  if (error) return { erreur: t('echec') };
  await signalerSalle(evenement.id);
  revalidatePath(`/regie/${evenement.code}`, 'layout');
  revalidatePath('/regie');
  return {};
}
