'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { lireSaisie, type Erreur, type JeuContenu } from '@/lib/contenus';
import { exigerAdmin } from '@/serveur/supabase-animateur';
import type { Json } from '@/types/base';

export type EtatContenu =
  | {
      erreur: string;
      erreurs: Record<string, Erreur>;
      valeurs: Record<string, string>;
      instant: number;
    }
  | undefined;

/**
 * Crée (`id` null) ou modifie un contenu. La saisie est vérifiée ici, champ par champ, puis de
 * nouveau en base par `enregistrer_contenu`, qui écrit tout en une transaction.
 */
export async function enregistrerContenu(
  jeu: JeuContenu,
  id: string | null,
  _: EtatContenu,
  donnees: FormData,
): Promise<EtatContenu> {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.formulaire');
  // Rendues au formulaire en cas d'erreur : React le vide après chaque envoi.
  const valeurs = Object.fromEntries(
    [...donnees.entries()].filter(([, v]) => typeof v === 'string') as [string, string][],
  );

  const saisie = lireSaisie(jeu, (nom) => donnees.get(nom));
  if (!saisie.ok)
    return { erreur: t('corriger'), erreurs: saisie.erreurs, valeurs, instant: Date.now() };

  const { error } = await supabase.rpc('enregistrer_contenu', {
    // Le type généré ne connaît pas le null d'un uuid facultatif.
    p_id: id as string,
    p_jeu: jeu,
    p_etiquette: saisie.etiquette,
    p_langues: saisie.langues as Json,
  });
  if (error) return { erreur: t('echec'), erreurs: {}, valeurs, instant: Date.now() };

  revalidatePath('/admin/contenus', 'layout');
  redirect(`/admin/contenus?jeu=${jeu}`);
}

/** Un contenu ne se supprime pas (des passages peuvent le citer) : il se désactive. */
export async function basculerContenu(id: string, actif: boolean): Promise<void> {
  const { supabase } = await exigerAdmin();
  await supabase.from('contenus').update({ actif }).eq('id', id);
  revalidatePath('/admin/contenus', 'layout');
}
