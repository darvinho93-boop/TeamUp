'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import {
  CHRONO_SURENCHERE_DEFAUT_S,
  DUELS_DEFAUT,
  QUESTIONS_QUIZ,
  QUESTIONS_QUIZ_DEFAUT,
  tirerContenus,
  type GameCode,
} from '@teamup/game';
import { etiquettesDe, proposable } from '@/lib/contenus';
import { MAX_GROUPES } from '@/lib/groupes';
import { evenementDeLaRegie, type EvenementRegie } from '@/serveur/regie';
import type { ClientAnimateur } from '@/serveur/supabase-animateur';

/**
 * Préparation d'une soirée : équipes prévues, groupes et programme (les équipes se forment à la
 * Salle, lot 14). Tout passe par la session de l'animateur,
 * donc par la RLS : il ne prépare que ses propres événements.
 */

/** Au plus 8 équipes et 3 tours : 24 contenus suffisent toujours. */
const MAX_RESERVE = 24;

async function contexte(code: string) {
  const ctx = await evenementDeLaRegie(code);
  return { ...ctx, rafraichir: () => revalidatePath(`/regie/${ctx.evenement.code}`, 'layout') };
}

const EquipesPrevues = z.coerce.number().int().min(2).max(8);

/** Lot 14 : le nombre d'équipes prévu, pour la durée du programme et la formation à la Salle. */
export async function enregistrerEquipesPrevues(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const saisie = EquipesPrevues.safeParse(donnees.get('equipes_prevues'));
  if (!saisie.success) return;
  await supabase.from('evenements').update({ equipes_prevues: saisie.data }).eq('id', evenement.id);
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
  // « Je préfère ne pas répondre » proposé à l'arrivée, ou non (2026-10-22).
  await supabase
    .from('evenements')
    .update({ groupe_facultatif: donnees.get('groupe_facultatif') === 'on' })
    .eq('id', evenement.id);
  rafraichir();
}

/**
 * Carte Team Up! (2026-11-01) : la soirée paraît le jour même sur `/soirees`, sous un titre
 * public. Cochée sans titre, elle ne paraît pas (la page de préparation le dit).
 */
export async function enregistrerCarte(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const brut = donnees.get('titre_public');
  const titre = typeof brut === 'string' ? brut.trim().slice(0, 60) : '';
  await supabase
    .from('evenements')
    .update({
      titre_public: titre || null,
      carte_visible: donnees.get('carte_visible') === 'on' && titre !== '',
    })
    .eq('id', evenement.id);
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
  // Les contenus en réserve d'une manche par équipe (lot 14) sont pris eux aussi.
  const { data: reserves } = await supabase
    .from('manches')
    .select('options')
    .eq('evenement_id', evenement.id)
    .in('jeu', ['list2', 'mime2']);
  const pris = new Set([
    ...(utilises ?? []).map((p) => p.contenu_id),
    ...(reserves ?? []).flatMap((m) => reserveDe(m.options)),
  ]);
  return (banque ?? [])
    .filter((c) => proposable(c, evenement))
    .map((c) => c.id)
    .filter((id) => !pris.has(id));
}

async function nouvelleManche(
  supabase: ClientAnimateur,
  evenement: EvenementRegie,
  jeu: GameCode,
  options: Record<string, number | string[]>,
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
/** Taille de la réserve d'une manche par équipe, au choix de l'animateur (2026-11-01). */
const TailleReserve = z.coerce.number().int().min(1).max(MAX_RESERVE);

/** La réserve d'une manche par équipe : des identifiants de contenus, dans l'ordre affiché. */
function reserveDe(options: unknown): string[] {
  const reserve = (options as Record<string, unknown> | null)?.['reserve'];
  return Array.isArray(reserve) ? reserve.filter((x): x is string => typeof x === 'string') : [];
}

/** Le hasard du serveur, pour un tirage fait à la préparation. */
const aleaServeur = () => randomInt(0, 2 ** 32) / 2 ** 32;

/**
 * Jeux séquentiels (Points communs, Mime) : une réserve de contenus (lot 14). La formation des
 * équipes, à la Salle, y tire un contenu par équipe et par tour. Si la soirée a déjà ses
 * équipes, le tirage se fait tout de suite.
 */
async function ajouterParEquipe(code: string, donnees: FormData, jeu: 'list2' | 'mime2') {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const tours = Tours.catch(1).parse(donnees.get('tours'));
  const taille = TailleReserve.catch(evenement.equipes_prevues * tours).parse(
    donnees.get('reserve'),
  );
  const libres = await contenusLibres(supabase, evenement, jeu);
  const reserve = libres.slice(0, taille);
  const mancheId = await nouvelleManche(supabase, evenement, jeu, {
    passages_par_equipe: tours,
    reserve,
  });
  const { data: equipes } = await supabase
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const ids = (equipes ?? []).map((e) => e.id);
  if (ids.length && reserve.length >= ids.length * tours) {
    const passages = tirerContenus(reserve, ids, tours, aleaServeur).map((p) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: p.equipe,
      ordre: p.ordre,
      contenu_id: p.contenu,
    }));
    await supabase.from('passages').insert(passages);
  }
  rafraichir();
}

async function ecrireReserve(code: string, mancheId: string, modifier: (r: string[]) => string[]) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { data: manche } = await supabase
    .from('manches')
    .select('options')
    .eq('id', mancheId)
    .eq('evenement_id', evenement.id)
    .eq('statut', 'a_venir')
    .maybeSingle();
  if (!manche) return;
  const options = (manche.options ?? {}) as Record<string, unknown>;
  await supabase
    .from('manches')
    .update({ options: { ...options, reserve: modifier(reserveDe(options)) } })
    .eq('id', mancheId)
    .eq('statut', 'a_venir');
  rafraichir();
}

/** Change un contenu de la réserve ; vide, la ligne reste à remplir. */
export async function choisirContenuReserve(
  code: string,
  mancheId: string,
  index: number,
  contenuId: string,
) {
  await ecrireReserve(code, mancheId, (reserve) => {
    const suite = [...reserve];
    if (!contenuId) {
      suite.splice(index, 1);
    } else {
      // Déjà ailleurs dans la réserve : les deux lignes s'échangent.
      const ailleurs = suite.indexOf(contenuId);
      if (ailleurs >= 0) suite[ailleurs] = suite[index]!;
      suite[index] = contenuId;
    }
    return suite.filter(Boolean).slice(0, MAX_RESERVE);
  });
}

/** Une ligne de plus dans la réserve (le premier contenu libre), ou la dernière en moins. */
export async function ajusterReserve(code: string, mancheId: string, jeu: GameCode, sens: 1 | -1) {
  const { supabase, evenement } = await contexte(code);
  const libres = sens === 1 ? await contenusLibres(supabase, evenement, jeu) : [];
  await ecrireReserve(code, mancheId, (reserve) =>
    sens === 1
      ? libres[0] && reserve.length < MAX_RESERVE
        ? [...reserve, libres[0]]
        : reserve
      : reserve.slice(0, -1),
  );
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
 * Quiz : une question par passage, de trois à dix, sans repêchage (décisions du 2026-09-24 et
 * du 2026-10-18 : on en prévoit plus, la régie termine quand elle veut). Le mode ne se fixe
 * pas ici : il se choisit au lancement de la manche.
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
