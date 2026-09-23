'use server';

import { revalidatePath } from 'next/cache';
import { evenementDeLaRegie } from '@/serveur/regie';

/** Déplace un joueur dans une autre équipe du même événement (l'arrivée l'avait placé seule). */
export async function deplacerJoueur(code: string, joueurId: string, equipeId: string) {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  // Un capitaine qui change d'équipe cesse de l'être : sa nouvelle équipe a peut-être le sien.
  await supabase
    .from('joueurs')
    .update({ equipe_id: equipeId, capitaine: false })
    .eq('id', joueurId)
    .eq('evenement_id', evenement.id);
  revalidatePath(`/regie/${evenement.code}/salle`);
}

/** Un seul capitaine par équipe : c'est lui qui enverra les photos (lot 8). */
export async function designerCapitaine(code: string, joueurId: string) {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  const { data: joueur } = await supabase
    .from('joueurs')
    .select('equipe_id')
    .eq('id', joueurId)
    .eq('evenement_id', evenement.id)
    .single();
  if (!joueur?.equipe_id) return;
  await supabase
    .from('joueurs')
    .update({ capitaine: false })
    .eq('equipe_id', joueur.equipe_id)
    .eq('capitaine', true);
  await supabase.from('joueurs').update({ capitaine: true }).eq('id', joueurId);
  revalidatePath(`/regie/${evenement.code}/salle`);
}
