'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EXTRAIT_CINEMIME_MAX_MS, EXTRAIT_CINEMIME_MIN_MS } from '@teamup/game';
import { lireSaisie, type Erreur, type JeuContenu } from '@/lib/contenus';
import { estCheminExtrait } from '@/lib/extraits';
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
 * La vidéo d'une scène du Ciné-mime, déposée par le navigateur juste avant : son chemin et sa
 * durée, ou `null` (rien de neuf). `false` : une valeur reçue mais hors forme.
 */
function lireExtrait(donnees: FormData): { chemin: string; duree_ms: number } | null | false {
  const chemin = donnees.get('extrait_chemin');
  if (chemin === null || chemin === '') return null;
  const duree = Number(donnees.get('extrait_duree_ms'));
  if (!estCheminExtrait(chemin) || !Number.isInteger(duree)) return false;
  if (duree < EXTRAIT_CINEMIME_MIN_MS || duree > EXTRAIT_CINEMIME_MAX_MS) return false;
  return { chemin, duree_ms: duree };
}

/**
 * Crée (`id` null) ou modifie un contenu. La saisie est vérifiée ici, champ par champ, puis de
 * nouveau en base par `enregistrer_contenu`, qui écrit tout en une transaction. Une vidéo de
 * Ciné-mime déposée pour rien (refus, échec) est retirée du bucket ; celle qu'elle remplace aussi,
 * une fois le contenu enregistré.
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

  const extrait = jeu === 'cinemime' ? lireExtrait(donnees) : null;
  const deposeEnVain = async () => {
    const chemin = donnees.get('extrait_chemin');
    if (estCheminExtrait(chemin)) await supabase.storage.from('extraits').remove([chemin]);
  };

  const saisie = lireSaisie(jeu, (nom) => donnees.get(nom));
  if (!saisie.ok || extrait === false) {
    await deposeEnVain();
    return {
      erreur: t('corriger'),
      erreurs: saisie.ok ? {} : saisie.erreurs,
      valeurs,
      instant: Date.now(),
    };
  }

  // La vidéo remplacée, à retirer une fois le contenu enregistré.
  const { data: avant } =
    id && extrait
      ? await supabase.from('contenus').select('extrait').eq('id', id).maybeSingle()
      : { data: null };

  const { error } = await supabase.rpc('enregistrer_contenu', {
    // Le type généré ne connaît pas le null d'un uuid facultatif.
    p_id: id as string,
    p_jeu: jeu,
    p_etiquette: saisie.etiquette,
    p_langues: saisie.langues as Json,
    ...(extrait ? { p_extrait: extrait as Json } : {}),
  });
  if (error) {
    await deposeEnVain();
    return { erreur: t('echec'), erreurs: {}, valeurs, instant: Date.now() };
  }
  if (avant?.extrait && extrait && avant.extrait !== extrait.chemin) {
    await supabase.storage.from('extraits').remove([avant.extrait]);
  }

  revalidatePath('/admin/contenus', 'layout');
  redirect(`/admin/contenus?jeu=${jeu}`);
}

/** Un contenu ne se supprime pas (des passages peuvent le citer) : il se désactive. */
export async function basculerContenu(id: string, actif: boolean): Promise<void> {
  const { supabase } = await exigerAdmin();
  await supabase.from('contenus').update({ actif }).eq('id', id);
  revalidatePath('/admin/contenus', 'layout');
}
