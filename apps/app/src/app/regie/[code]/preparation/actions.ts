'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import {
  CHRONO_SURENCHERE_DEFAUT_S,
  DUELS_DEFAUT,
  QUESTIONS_QUIZ,
  QUESTIONS_QUIZ_DEFAUT,
  type GameCode,
} from '@teamup/game';
import { etiquettesDe, proposable } from '@/lib/contenus';
import { MAX_GROUPES } from '@/lib/groupes';
import { evenementDeLaRegie, type EvenementRegie } from '@/serveur/regie';
import type { ClientAnimateur } from '@/serveur/supabase-animateur';

/**
 * Préparation d'une soirée : équipes et programme. Tout passe par la session de l'animateur,
 * donc par la RLS : il ne prépare que ses propres événements.
 */

const MAX_EQUIPES = 8;
const MIN_EQUIPES = 2;

async function contexte(code: string) {
  const ctx = await evenementDeLaRegie(code);
  return { ...ctx, rafraichir: () => revalidatePath(`/regie/${ctx.evenement.code}`, 'layout') };
}

export async function renommerEquipes(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { data: equipes } = await supabase
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id);
  for (const { id } of equipes ?? []) {
    const brut = donnees.get(`nom-${id}`);
    const nom = typeof brut === 'string' ? brut.trim() : '';
    if (nom.length >= 1 && nom.length <= 60) {
      await supabase.from('equipes').update({ nom }).eq('id', id);
    }
  }
  rafraichir();
}

export async function ajouterEquipe(code: string) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const t = await getTranslations('regie.evenements');
  const { data: equipes } = await supabase
    .from('equipes')
    .select('numero')
    .eq('evenement_id', evenement.id);
  const numeros = new Set((equipes ?? []).map((e) => e.numero));
  if (numeros.size >= MAX_EQUIPES) return;
  const numero = Array.from({ length: MAX_EQUIPES }, (_, i) => i + 1).find((n) => !numeros.has(n))!;
  await supabase
    .from('equipes')
    .insert({ evenement_id: evenement.id, numero, nom: t('equipeParDefaut', { numero }) });
  rafraichir();
}

/** Retire la dernière équipe, seulement si personne ne l'a encore rejointe. */
export async function retirerEquipe(code: string, equipeId: string) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { count: equipes } = await supabase
    .from('equipes')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id);
  const { count: joueurs } = await supabase
    .from('joueurs')
    .select('*', { count: 'exact', head: true })
    .eq('equipe_id', equipeId);
  if ((equipes ?? 0) <= MIN_EQUIPES || (joueurs ?? 0) > 0) return;
  await supabase.from('equipes').delete().eq('id', equipeId).eq('evenement_id', evenement.id);
  rafraichir();
}

/**
 * Groupes à mélanger (lot 11) : une case par rang, de 1 à 6. Une case remplie crée ou renomme
 * le groupe de ce rang, ses compteurs restent ; une case vidée le retire, compteurs compris.
 */
export async function enregistrerGroupes(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const remplis: { evenement_id: string; ordre: number; nom: string }[] = [];
  const vides: number[] = [];
  for (let ordre = 1; ordre <= MAX_GROUPES; ordre++) {
    const brut = donnees.get(`groupe-${ordre}`);
    const nom = typeof brut === 'string' ? brut.trim().slice(0, 40) : '';
    if (nom) remplis.push({ evenement_id: evenement.id, ordre, nom });
    else vides.push(ordre);
  }
  if (vides.length) {
    await supabase.from('groupes').delete().eq('evenement_id', evenement.id).in('ordre', vides);
  }
  if (remplis.length) {
    await supabase.from('groupes').upsert(remplis, { onConflict: 'evenement_id,ordre' });
  }
  rafraichir();
}

/**
 * Les contenus de la banque que cette soirée n'utilise pas encore, adaptés à son public et
 * complets dans toutes ses langues.
 */
async function contenusLibres(
  supabase: ClientAnimateur,
  evenement: EvenementRegie,
  jeu: GameCode,
): Promise<string[]> {
  const { data: banque } = await supabase
    .from('contenus')
    .select('id, jeu, etiquette, contenus_traductions(langue), contenus_secrets(langue)')
    .eq('jeu', jeu)
    .eq('actif', true)
    .in('etiquette', etiquettesDe(evenement.type_client))
    .order('cree_le');
  const { data: utilises } = await supabase
    .from('passages')
    .select('contenu_id')
    .eq('evenement_id', evenement.id);
  const pris = new Set((utilises ?? []).map((p) => p.contenu_id));
  return (banque ?? [])
    .filter((c) => proposable(c, evenement))
    .map((c) => c.id)
    .filter((id) => !pris.has(id));
}

async function nouvelleManche(
  supabase: ClientAnimateur,
  evenement: EvenementRegie,
  jeu: GameCode,
  options: Record<string, number>,
) {
  const { data: dernieres } = await supabase
    .from('manches')
    .select('ordre')
    .eq('evenement_id', evenement.id)
    .order('ordre', { ascending: false })
    .limit(1);
  const ordre = (dernieres?.[0]?.ordre ?? 0) + 1;
  const { data: manche, error } = await supabase
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu, ordre, options })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return manche.id;
}

const Tours = z.coerce.number().int().min(1).max(3);

/** Jeux séquentiels (Points communs, Mime) : un passage par équipe et par tour. */
async function ajouterParEquipe(code: string, donnees: FormData, jeu: 'list2' | 'mime2') {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const tours = Tours.catch(1).parse(donnees.get('tours'));
  const { data: equipes } = await supabase
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const mancheId = await nouvelleManche(supabase, evenement, jeu, {
    passages_par_equipe: tours,
  });
  const libres = await contenusLibres(supabase, evenement, jeu);
  const passages = Array.from({ length: tours }, () => equipes ?? [])
    .flat()
    .map((equipe, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: equipe.id,
      ordre: i + 1,
      contenu_id: libres[i] ?? null,
    }));
  if (passages.length) await supabase.from('passages').insert(passages);
  rafraichir();
}

/** Points communs : un passage par équipe et par tour, chacun avec un contenu de la banque. */
export async function ajouterPointsCommuns(code: string, donnees: FormData) {
  await ajouterParEquipe(code, donnees, 'list2');
}

/** Mime : un passage par équipe et par tour, chacun avec un mot de la banque. */
export async function ajouterMime(code: string, donnees: FormData) {
  await ajouterParEquipe(code, donnees, 'mime2');
}

const Questions = z.coerce
  .number()
  .int()
  .refine((n) => (QUESTIONS_QUIZ as readonly number[]).includes(n))
  .catch(QUESTIONS_QUIZ_DEFAUT);

/**
 * Quiz : une question par passage, trois ou quatre, sans repêchage (décision du 2026-09-24).
 * Le mode (croix ou téléphone) ne se fixe pas ici : il se choisit au lancement de la manche.
 */
export async function ajouterQuiz(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const questions = Questions.parse(donnees.get('questions'));
  const mancheId = await nouvelleManche(supabase, evenement, 'qcm2', { questions });
  const libres = await contenusLibres(supabase, evenement, 'qcm2');
  await supabase.from('passages').insert(
    Array.from({ length: questions }, (_, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: null,
      ordre: i + 1,
      contenu_id: libres[i] ?? null,
    })),
  );
  rafraichir();
}

const Surenchere = z.object({
  themes: z.coerce.number().int().min(1).max(6).catch(3),
  chrono: z.coerce.number().int().min(10).max(300).catch(CHRONO_SURENCHERE_DEFAUT_S),
});

/** Surenchère : un passage par thème ; le chrono géant se règle ici (60 s par défaut). */
export async function ajouterSurenchere(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { themes, chrono } = Surenchere.parse({
    themes: donnees.get('themes'),
    chrono: donnees.get('chrono'),
  });
  const mancheId = await nouvelleManche(supabase, evenement, 'enchere2', {
    themes,
    chrono_s: chrono,
  });
  const libres = await contenusLibres(supabase, evenement, 'enchere2');
  await supabase.from('passages').insert(
    Array.from({ length: themes }, (_, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: null,
      ordre: i + 1,
      contenu_id: libres[i] ?? null,
    })),
  );
  rafraichir();
}

const Duels = z.coerce.number().int().min(1).max(8).catch(DUELS_DEFAUT);

/**
 * Duels en bêta (spec v3) : un passage par duel, sans contenu. Les duellistes se tirent en
 * soirée, à la régie. Jamais ajoutés d'office : seulement par ce bouton.
 */
export async function ajouterDuels(code: string, jeu: 'grab' | 'cup', donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const duels = Duels.parse(donnees.get('duels'));
  const mancheId = await nouvelleManche(supabase, evenement, jeu, { duels });
  await supabase.from('passages').insert(
    Array.from({ length: duels }, (_, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: null,
      ordre: i + 1,
    })),
  );
  rafraichir();
}

const Photo = z.object({ themes: z.coerce.number().int().min(1).max(6).catch(2) });

/**
 * Photo challenge : un passage par thème. Les thèmes s'ouvrent aux capitaines dès qu'ils
 * existent (spec v3 : annoncés au début, envois toute la soirée) ; une seule manche par soirée.
 */
export async function ajouterPhoto(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { count } = await supabase
    .from('manches')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', evenement.id)
    .eq('jeu', 'photo2')
    .neq('statut', 'annulee');
  if ((count ?? 0) > 0) return;
  const { themes } = Photo.parse({ themes: donnees.get('themes') });
  const mancheId = await nouvelleManche(supabase, evenement, 'photo2', { themes });
  const libres = await contenusLibres(supabase, evenement, 'photo2');
  await supabase.from('passages').insert(
    Array.from({ length: themes }, (_, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: null,
      ordre: i + 1,
      contenu_id: libres[i] ?? null,
    })),
  );
  rafraichir();
}

export async function deplacerManche(code: string, mancheId: string, sens: -1 | 1) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { data: manches } = await supabase
    .from('manches')
    .select('id, ordre')
    .eq('evenement_id', evenement.id)
    .order('ordre');
  const liste = manches ?? [];
  const i = liste.findIndex((m) => m.id === mancheId);
  const voisine = liste[i + sens];
  if (i < 0 || !voisine) return;
  await supabase.rpc('echanger_manches', { p_a: mancheId, p_b: voisine.id });
  rafraichir();
}

/** Retire une manche qui n'a pas commencé (ses passages partent avec elle). */
export async function retirerManche(code: string, mancheId: string) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  await supabase
    .from('manches')
    .delete()
    .eq('id', mancheId)
    .eq('evenement_id', evenement.id)
    .eq('statut', 'a_venir');
  rafraichir();
}

export async function choisirContenu(code: string, passageId: string, contenuId: string) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  await supabase
    .from('passages')
    .update({ contenu_id: contenuId || null })
    .eq('id', passageId)
    .eq('evenement_id', evenement.id)
    .eq('statut', 'a_venir');
  rafraichir();
}
