'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { PAROLES_MAX_LIGNES, parolesPretes, type LigneBrouillon } from '@/lib/paroles';
import { exigerAdmin } from '@/serveur/supabase-animateur';

/** Désactiver ou réactiver une musique : rien ne se supprime, comme pour les contenus. */
export async function basculerMusique(id: string, actif: boolean): Promise<boolean> {
  const { supabase } = await exigerAdmin();
  const { error } = await supabase.from('musiques').update({ actif }).eq('id', id);
  revalidatePath('/admin/musiques');
  return !error;
}

const Saisie = z.object({
  id: z.string().uuid(),
  lignes: z
    .array(
      z.object({
        t_ms: z.number().int().nonnegative().nullable(),
        texte: z.string(),
        latin: z.string().optional(),
      }),
    )
    .max(PAROLES_MAX_LIGNES)
    .nullable(),
});

/**
 * Les paroles d'une musique pour le karaoké (2026-11-23), toutes calées ; `null` les retire. La
 * base revérifie leur forme (`paroles_bien_formees`).
 */
export async function enregistrerParoles(
  id: string,
  lignes: readonly LigneBrouillon[] | null,
): Promise<boolean> {
  const { supabase } = await exigerAdmin();
  const saisie = Saisie.safeParse({ id, lignes });
  if (!saisie.success) return false;
  const pretes = saisie.data.lignes === null ? null : parolesPretes(saisie.data.lignes);
  if (saisie.data.lignes !== null && !pretes) return false;
  const { data, error } = await supabase
    .from('musiques')
    .update({
      paroles:
        pretes?.map((l) =>
          l.latin
            ? { t_ms: l.t_ms, texte: l.texte, latin: l.latin }
            : { t_ms: l.t_ms, texte: l.texte },
        ) ?? null,
    })
    .eq('id', saisie.data.id)
    .select('id');
  revalidatePath('/admin/musiques');
  revalidatePath(`/admin/musiques/${saisie.data.id}/paroles`);
  return !error && data?.length === 1;
}
