'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { MOT_DE_PASSE_MIN } from '@/lib/comptes';
import { LANGUES } from '@/lib/partie';
import { exigerAnimateur, supabaseAnimateur } from '@/serveur/supabase-animateur';

export type EtatFormulaire = { erreur?: string } | undefined;

const Connexion = z.object({
  email: z.email(),
  motDePasse: z.string().min(1),
  suite: z.string().optional(),
});

export async function connecter(_: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const t = await getTranslations('regie.connexion');
  const saisie = Connexion.safeParse({
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
    suite: donnees.get('suite') ?? undefined,
  });
  if (!saisie.success) return { erreur: t('incomplet') };

  const supabase = await supabaseAnimateur();
  const { error } = await supabase.auth.signInWithPassword({
    email: saisie.data.email,
    password: saisie.data.motDePasse,
  });
  if (error) return { erreur: t('refus') };

  // Retour à la page demandée, jamais vers un autre site.
  const suite = saisie.data.suite;
  const interne = ['/regie', '/ecran', '/admin'].some((debut) => suite?.startsWith(debut));
  redirect(interne ? suite! : '/regie');
}

export async function deconnecter(): Promise<void> {
  const supabase = await supabaseAnimateur();
  await supabase.auth.signOut();
  redirect('/regie/connexion');
}

export type EtatCompte = { erreur?: string; ok?: string } | undefined;

/** Mon compte : le mot de passe provisoire posé par l'admin se change ici. */
export async function changerMotDePasse(_: EtatCompte, donnees: FormData): Promise<EtatCompte> {
  const t = await getTranslations('regie.compte');
  const { supabase } = await exigerAnimateur();
  const motDePasse = donnees.get('motDePasse');
  if (typeof motDePasse !== 'string' || motDePasse.length < MOT_DE_PASSE_MIN) {
    return { erreur: t('court', { min: MOT_DE_PASSE_MIN }) };
  }
  if (motDePasse !== donnees.get('confirmation')) return { erreur: t('different') };
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) return { erreur: t('echec') };
  return { ok: t('change') };
}

const NouvelEvenement = z.object({
  client: z.string().trim().min(1).max(200),
  type: z.enum(['particulier', 'entreprise']),
  date: z.iso.date(),
  creneau: z.coerce.number().int().min(10).max(240),
  equipes: z.coerce.number().int().min(2).max(8),
  langues: z.array(z.enum(LANGUES)).min(1).max(3),
  // Facultatif : sert au taux de connexion des invités (mesure, lot 10).
  invites: z.union([z.literal(''), z.coerce.number().int().min(1).max(1000)]),
});

export async function creerEvenement(
  _: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const t = await getTranslations('regie.evenements');
  const { supabase, animateur } = await exigerAnimateur();
  const saisie = NouvelEvenement.safeParse({
    client: donnees.get('client'),
    type: donnees.get('type'),
    date: donnees.get('date'),
    creneau: donnees.get('creneau'),
    equipes: donnees.get('equipes'),
    langues: donnees.getAll('langues'),
    invites: donnees.get('invites') ?? '',
  });
  if (!saisie.success) return { erreur: t('invalide') };

  const { data: evenement, error } = await supabase
    .from('evenements')
    .insert({
      animateur_id: animateur.id,
      client_nom: saisie.data.client,
      type_client: saisie.data.type,
      date_evenement: saisie.data.date,
      creneau_minutes: saisie.data.creneau,
      langues: saisie.data.langues,
      invites_attendus: saisie.data.invites === '' ? null : saisie.data.invites,
    })
    .select('id, code')
    .single();
  if (error) return { erreur: t('echec') };

  const { error: erreurEquipes } = await supabase.from('equipes').insert(
    Array.from({ length: saisie.data.equipes }, (_, i) => ({
      evenement_id: evenement.id,
      numero: i + 1,
      nom: t('equipeParDefaut', { numero: i + 1 }),
    })),
  );
  if (erreurEquipes) return { erreur: t('echec') };

  redirect(`/regie/${evenement.code}/preparation`);
}
