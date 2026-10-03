'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { MOT_DE_PASSE_MIN } from '@/lib/comptes';
import { creerCompte } from '@/serveur/comptes';
import { exigerAdmin } from '@/serveur/supabase-animateur';

export type EtatAnimateur = { erreur?: string; ok?: string } | undefined;

const NouvelAnimateur = z.object({
  nom: z.string().trim().min(1).max(100),
  email: z.email(),
  motDePasse: z.string().min(MOT_DE_PASSE_MIN).max(72),
  role: z.enum(['animateur', 'admin']),
});

export async function creerAnimateur(_: EtatAnimateur, donnees: FormData): Promise<EtatAnimateur> {
  const { supabase } = await exigerAdmin();
  const t = await getTranslations('admin.animateurs');
  const saisie = NouvelAnimateur.safeParse({
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
    role: donnees.get('role'),
  });
  if (!saisie.success) return { erreur: t('invalide', { min: MOT_DE_PASSE_MIN }) };

  const resultat = await creerCompte(supabase, {
    ...saisie.data,
    email: saisie.data.email.toLowerCase(),
  });
  if (!resultat.ok) return { erreur: t(resultat.raison) };
  revalidatePath('/admin/animateurs');
  return { ok: t('cree', { nom: saisie.data.nom }) };
}

/** Désactiver ou réactiver un compte. Un admin ne se désactive pas lui-même. */
export async function basculerAnimateur(id: string, actif: boolean): Promise<string | null> {
  const { supabase, animateur } = await exigerAdmin();
  const t = await getTranslations('admin.animateurs');
  if (id === animateur.id && !actif) return t('soiMeme');
  const { error } = await supabase.from('animateurs').update({ actif }).eq('id', id);
  revalidatePath('/admin/animateurs');
  if (error) return error.message.includes('au moins un admin') ? t('dernierAdmin') : t('echec');
  return null;
}
