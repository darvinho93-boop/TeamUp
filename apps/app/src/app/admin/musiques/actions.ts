'use server';

import { revalidatePath } from 'next/cache';
import { exigerAdmin } from '@/serveur/supabase-animateur';

/** Désactiver ou réactiver une musique : rien ne se supprime, comme pour les contenus. */
export async function basculerMusique(id: string, actif: boolean): Promise<boolean> {
  const { supabase } = await exigerAdmin();
  const { error } = await supabase.from('musiques').update({ actif }).eq('id', id);
  revalidatePath('/admin/musiques');
  return !error;
}
