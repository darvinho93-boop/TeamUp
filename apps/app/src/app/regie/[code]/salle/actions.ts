'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { evenementDeLaRegie } from '@/serveur/regie';

export type EtatAjoutInvite = { erreur?: string; ok?: string } | undefined;

const Invite = z.object({
  prenom: z.string().trim().min(1).max(40),
  groupe: z.uuid().nullable(),
});

/**
 * Un invité sans téléphone, ajouté par l'animateur : son équipe se tire comme à l'arrivée
 * (`ajouter_invite_regie`, qui revérifie que la soirée est bien la sienne).
 */
export async function ajouterInvite(
  code: string,
  _: EtatAjoutInvite,
  donnees: FormData,
): Promise<EtatAjoutInvite> {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  const t = await getTranslations('regie.salle');
  const saisie = Invite.safeParse({
    prenom: donnees.get('prenom'),
    groupe: donnees.get('groupe') || null,
  });
  if (!saisie.success) return { erreur: t('ajoutInvalide') };
  const { data, error } = await supabase.rpc('ajouter_invite_regie', {
    p_evenement: evenement.id,
    p_prenom: saisie.data.prenom,
    ...(saisie.data.groupe ? { p_groupe: saisie.data.groupe } : {}),
  });
  if (error) return { erreur: /complet/.test(error.message) ? t('complet') : t('ajoutEchec') };
  revalidatePath(`/regie/${evenement.code}/salle`);
  const ajout = data as { prenom: string; equipe: { nom: string } | null };
  return {
    ok: ajout.equipe
      ? t('ajoute', { prenom: ajout.prenom, equipe: ajout.equipe.nom })
      : t('ajouteSansEquipe', { prenom: ajout.prenom }),
  };
}

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

/**
 * Un seul capitaine par équipe : c'est lui qui enverra les photos (lot 8). Jamais un invité
 * sans téléphone : la base le refuse aussi.
 */
export async function designerCapitaine(code: string, joueurId: string) {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  const { data: joueur } = await supabase
    .from('joueurs')
    .select('equipe_id, sans_telephone')
    .eq('id', joueurId)
    .eq('evenement_id', evenement.id)
    .single();
  if (!joueur?.equipe_id || joueur.sans_telephone) return;
  await supabase
    .from('joueurs')
    .update({ capitaine: false })
    .eq('equipe_id', joueur.equipe_id)
    .eq('capitaine', true);
  await supabase.from('joueurs').update({ capitaine: true }).eq('id', joueurId);
  revalidatePath(`/regie/${evenement.code}/salle`);
}

/** Autorise un joueur (avec téléphone) à ajouter des invités depuis le sien, ou l'en retire. */
export async function autoriserAjout(code: string, joueurId: string, oui: boolean) {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  await supabase
    .from('joueurs')
    .update({ peut_ajouter: oui })
    .eq('id', joueurId)
    .eq('evenement_id', evenement.id)
    .eq('sans_telephone', false);
  revalidatePath(`/regie/${evenement.code}/salle`);
}

/** Destitue le capitaine sans en nommer d'autre : l'équipe reste sans capitaine. */
export async function retirerCapitaine(code: string, joueurId: string) {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  await supabase
    .from('joueurs')
    .update({ capitaine: false })
    .eq('id', joueurId)
    .eq('evenement_id', evenement.id);
  revalidatePath(`/regie/${evenement.code}/salle`);
}

/**
 * Retire un joueur de la soirée. Ses réponses au quiz partent avec lui (cascade) ; s'il avait
 * un téléphone, celui-ci revient à l'arrivée et peut rejoindre de nouveau par le QR code.
 */
export async function retirerJoueur(code: string, joueurId: string) {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  await supabase.from('joueurs').delete().eq('id', joueurId).eq('evenement_id', evenement.id);
  revalidatePath(`/regie/${evenement.code}/salle`);
}

/** Les membres à l'écran : tous les prénoms d'un coup, ou des pages qui tournent. */
export async function reglerMembres(code: string, mode: 'tous' | 'carrousel') {
  const { supabase, evenement } = await evenementDeLaRegie(code);
  await supabase.rpc('regler_membres', { p_evenement: evenement.id, p_mode: mode });
  revalidatePath(`/regie/${evenement.code}/salle`);
}
