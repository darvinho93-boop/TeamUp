'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import {
  CHRONO_SURENCHERE_DEFAUT_S,
  CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S,
  DUELS_DEFAUT,
  EXTRAIT_BLIND_DEFAUT_S,
  EXTRAIT_BLIND_MAX_S,
  EXTRAIT_BLIND_MIN_S,
  TITRES_BLIND_DEFAUT,
  TITRES_BLIND_MAX,
  TITRES_BLIND_MIN,
  QUESTIONS_QUIZ,
  QUESTIONS_QUIZ_DEFAUT,
  CHRONO_TOUR_PORTRAIT_DEFAUT_S,
  CHRONO_TOUR_PORTRAIT_MAX_S,
  CHRONO_TOUR_PORTRAIT_MIN_S,
  CIBLES_PORTRAIT_DEFAUT,
  CIBLES_PORTRAIT_MAX,
  CIBLES_PORTRAIT_MIN,
  tirerContenus,
  tirerOrdre,
  type GameCode,
} from '@teamup/game';
import { etiquettesDe, proposable } from '@/lib/contenus';
import { MAX_GROUPES } from '@/lib/groupes';
import { completerGrille, melangerGrille } from '@/lib/portrait';
import { evenementDeLaRegie, type EvenementRegie } from '@/serveur/regie';
import type { ClientAnimateur } from '@/serveur/supabase-animateur';
import type { Json } from '@/types/base';

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
    // La banque, plus les proches de cette soirée (Portrait mystère) ; jamais ceux d'une autre.
    .or(`evenement_id.is.null,evenement_id.eq.${evenement.id}`)
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
  options: Record<string, number | string[] | { musique: null; debut_s: number }[]>,
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

/**
 * La musique sous les chronos d'un Quiz ou d'une Surenchère (2026-11-15) : les musiques cochées,
 * parmi les actives de la bibliothèque, qui tourneront d'une question ou d'un thème à l'autre.
 * Seulement avant le lancement du jeu, comme la réserve : une fois lancé, `enregistrer_etape`
 * réécrit aussi ses options.
 */
export async function enregistrerMusiques(code: string, mancheId: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const voulues = [
    ...new Set(donnees.getAll('musique').filter((x): x is string => typeof x === 'string')),
  ];
  const [{ data: manche }, { data: actives }] = await Promise.all([
    supabase
      .from('manches')
      .select('jeu, options')
      .eq('id', mancheId)
      .eq('evenement_id', evenement.id)
      .eq('statut', 'a_venir')
      .maybeSingle(),
    voulues.length
      ? supabase.from('musiques').select('id').in('id', voulues).eq('actif', true)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  if (!manche || !['qcm2', 'enchere2'].includes(manche.jeu)) return;
  const connues = new Set((actives ?? []).map((m) => m.id));
  const options = (manche.options ?? {}) as Record<string, unknown>;
  await supabase
    .from('manches')
    .update({ options: { ...options, musiques: voulues.filter((id) => connues.has(id)) } })
    .eq('id', mancheId)
    .eq('statut', 'a_venir');
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

const Blind = z.object({
  titres: z.coerce
    .number()
    .int()
    .min(TITRES_BLIND_MIN)
    .max(TITRES_BLIND_MAX)
    .catch(TITRES_BLIND_DEFAUT),
  extrait: z.coerce
    .number()
    .int()
    .min(EXTRAIT_BLIND_MIN_S)
    .max(EXTRAIT_BLIND_MAX_S)
    .catch(EXTRAIT_BLIND_DEFAUT_S),
});

/**
 * Blind test (2026-11-15) : un passage par titre. Chaque titre (une musique de la bibliothèque et
 * la seconde où l'extrait commence) vit dans `options.titres`, dans l'ordre des passages ; la durée
 * d'écoute dans `options.extrait_s`. Les titres se choisissent ensuite, un par un.
 */
export async function ajouterBlind(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { titres, extrait } = Blind.parse({
    titres: donnees.get('titres'),
    extrait: donnees.get('extrait'),
  });
  const mancheId = await nouvelleManche(supabase, evenement, 'blind', {
    extrait_s: extrait,
    titres: Array.from({ length: titres }, () => ({ musique: null, debut_s: 0 })),
  });
  await supabase.from('passages').insert(
    Array.from({ length: titres }, (_, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: null,
      ordre: i + 1,
      contenu_id: null,
    })),
  );
  rafraichir();
}

const TitreBlind = z.object({
  musique: z.string().uuid().or(z.literal('')),
  debut: z.coerce.number().int().min(0).max(3600).catch(0),
});

/** Le titre `index` d'un blind test : sa musique (parmi les actives) et le début de l'extrait. */
export async function choisirTitreBlind(
  code: string,
  mancheId: string,
  index: number,
  donnees: FormData,
) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const saisie = TitreBlind.safeParse({
    musique: donnees.get('musique') ?? '',
    debut: donnees.get('debut'),
  });
  if (!saisie.success) return;
  const [{ data: manche }, { data: musique }] = await Promise.all([
    supabase
      .from('manches')
      .select('jeu, options')
      .eq('id', mancheId)
      .eq('evenement_id', evenement.id)
      .eq('statut', 'a_venir')
      .maybeSingle(),
    saisie.data.musique
      ? supabase
          .from('musiques')
          .select('id')
          .eq('id', saisie.data.musique)
          .eq('actif', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (manche?.jeu !== 'blind') return;
  const options = (manche.options ?? {}) as Record<string, unknown>;
  const titres = Array.isArray(options['titres']) ? [...(options['titres'] as Json[])] : [];
  if (index < 0 || index >= titres.length) return;
  titres[index] = { musique: musique?.id ?? null, debut_s: saisie.data.debut };
  await supabase
    .from('manches')
    .update({ options: { ...options, titres } })
    .eq('id', mancheId)
    .eq('statut', 'a_venir');
  rafraichir();
}

const Surenchere = z.object({
  themes: z.coerce.number().int().min(1).max(6).catch(3),
  chrono: z.coerce.number().int().min(10).max(300).catch(CHRONO_SURENCHERE_DEFAUT_S),
  chronoTelephones: z.coerce
    .number()
    .int()
    .min(10)
    .max(300)
    .catch(CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S),
});

/**
 * Surenchère : un passage par thème. Deux chronos se règlent ici, celui du jeu à la voix (60 s
 * par défaut) et celui du mode téléphones (2026-11-08, 60 s : taper prend plus de temps que
 * parler) ; le mode se choisit au lancement.
 */
export async function ajouterSurenchere(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { themes, chrono, chronoTelephones } = Surenchere.parse({
    themes: donnees.get('themes'),
    chrono: donnees.get('chrono'),
    chronoTelephones: donnees.get('chrono_telephones'),
  });
  const mancheId = await nouvelleManche(supabase, evenement, 'enchere2', {
    themes,
    chrono_s: chrono,
    chrono_telephones_s: chronoTelephones,
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

// ---------------------------------------------------------------------------
// Portrait mystère (2026-11-18)
// ---------------------------------------------------------------------------

const Portrait = z.object({
  cibles: z.coerce
    .number()
    .int()
    .min(CIBLES_PORTRAIT_MIN)
    .max(CIBLES_PORTRAIT_MAX)
    .catch(CIBLES_PORTRAIT_DEFAUT),
  chrono: z.coerce
    .number()
    .int()
    .min(CHRONO_TOUR_PORTRAIT_MIN_S)
    .max(CHRONO_TOUR_PORTRAIT_MAX_S)
    .catch(CHRONO_TOUR_PORTRAIT_DEFAUT_S),
});

/** Tous les portraits que la soirée peut mettre dans une grille : banque et proches, complets. */
async function portraitsDisponibles(
  supabase: ClientAnimateur,
  evenement: EvenementRegie,
): Promise<string[]> {
  const { data } = await supabase
    .from('contenus')
    .select('id, jeu, etiquette, contenus_traductions(langue), contenus_secrets(langue)')
    .eq('jeu', 'portrait')
    .eq('actif', true)
    .in('etiquette', etiquettesDe(evenement.type_client))
    .or(`evenement_id.is.null,evenement_id.eq.${evenement.id}`);
  return (data ?? []).filter((c) => proposable(c, evenement)).map((c) => c.id);
}

/**
 * (Re)fait la grille d'une manche : ses cibles, la carte noire voulue (sinon celle d'avant, sinon
 * une au hasard), le reste tiré au hasard parmi les portraits disponibles, le tout mélangé. Ne
 * touche à rien tant qu'une cible manque ou qu'il n'y a pas de quoi arriver à 25 cartes.
 */
async function refaireGrille(
  supabase: ClientAnimateur,
  evenement: EvenementRegie,
  mancheId: string,
  noireVoulue?: string,
) {
  const [{ data: passages }, { data: avant }, disponibles] = await Promise.all([
    supabase.from('passages').select('contenu_id').eq('manche_id', mancheId).order('ordre'),
    supabase
      .from('grilles_portrait')
      .select('cartes, noire')
      .eq('manche_id', mancheId)
      .maybeSingle(),
    portraitsDisponibles(supabase, evenement),
  ]);
  const cibles = (passages ?? []).flatMap((p) => (p.contenu_id ? [p.contenu_id] : []));
  if (cibles.length === 0 || cibles.length !== (passages ?? []).length) return;
  const libres = disponibles.filter((id) => !cibles.includes(id));
  const ancienne = avant ? avant.cartes[avant.noire] : undefined;
  const noire =
    (noireVoulue && !cibles.includes(noireVoulue) ? noireVoulue : undefined) ??
    (ancienne && libres.includes(ancienne) ? ancienne : undefined) ??
    tirerOrdre(libres, aleaServeur)[0];
  if (!noire) return;
  const grille = completerGrille({ cibles, noire, disponibles, alea: aleaServeur });
  if (!grille) return;
  await supabase
    .from('grilles_portrait')
    .upsert({ manche_id: mancheId, cartes: grille.cartes, noire: grille.noire });
}

/**
 * Portrait mystère : une cible par passage, tirée au hasard parmi les portraits libres (banque et
 * proches), le chrono d'un tour de vote, puis la grille complétée d'office.
 */
export async function ajouterPortrait(code: string, donnees: FormData) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { cibles, chrono } = Portrait.parse({
    cibles: donnees.get('cibles'),
    chrono: donnees.get('chrono'),
  });
  const mancheId = await nouvelleManche(supabase, evenement, 'portrait', {
    chrono_s: chrono,
    cibles_n: cibles,
  });
  const libres = tirerOrdre(await contenusLibres(supabase, evenement, 'portrait'), aleaServeur);
  await supabase.from('passages').insert(
    Array.from({ length: cibles }, (_, i) => ({
      manche_id: mancheId,
      evenement_id: evenement.id,
      equipe_id: null,
      ordre: i + 1,
      contenu_id: libres[i] ?? null,
    })),
  );
  await refaireGrille(supabase, evenement, mancheId);
  rafraichir();
}

/** Refaire la grille au hasard, cibles et carte noire gardées. */
export async function refaireGrillePortrait(code: string, mancheId: string) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  await refaireGrille(supabase, evenement, mancheId);
  rafraichir();
}

/** Mélanger la grille, sans changer ses cartes. */
export async function melangerGrillePortrait(code: string, mancheId: string) {
  const { supabase, rafraichir } = await contexte(code);
  const { data } = await supabase
    .from('grilles_portrait')
    .select('cartes, noire')
    .eq('manche_id', mancheId)
    .maybeSingle();
  if (!data) return;
  const grille = melangerGrille(data, aleaServeur);
  await supabase
    .from('grilles_portrait')
    .update({ cartes: grille.cartes, noire: grille.noire })
    .eq('manche_id', mancheId);
  rafraichir();
}

/** Choisir la carte noire : la grille se refait autour d'elle. */
export async function choisirNoirePortrait(code: string, mancheId: string, contenuId: string) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  if (contenuId) await refaireGrille(supabase, evenement, mancheId, contenuId);
  rafraichir();
}

export interface EtatProche {
  erreur?: 'champs' | 'serveur';
  ok?: boolean;
  /** Ce qui avait été saisi, rendu après une erreur : React vide le formulaire à l'envoi. */
  valeurs?: Record<string, string>;
  instant: number;
}

/**
 * Un proche de la soirée (le marié, la grand-mère…) : son nom et trois indices, dans chaque langue
 * de la soirée. Il rejoint les portraits proposés à cette soirée seulement.
 */
export async function ajouterProche(
  code: string,
  _avant: EtatProche | undefined,
  donnees: FormData,
): Promise<EtatProche> {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const valeurs = Object.fromEntries(
    [...donnees.entries()].flatMap(([cle, v]) => (typeof v === 'string' ? [[cle, v]] : [])),
  );
  const texte = (nom: string, max: number) => {
    const brut = donnees.get(nom);
    const valeur = typeof brut === 'string' ? brut.trim() : '';
    return valeur && valeur.length <= max ? valeur : null;
  };
  const langues: Record<string, { public: { nom: string }; secret: { indices: string[] } }> = {};
  for (const langue of evenement.langues) {
    const nom = texte(`${langue}.nom`, 60);
    const indices = [1, 2, 3].map((n) => texte(`${langue}.indice${n}`, 200));
    if (!nom || indices.some((i) => i === null)) {
      return { erreur: 'champs', valeurs, instant: Date.now() };
    }
    langues[langue] = { public: { nom }, secret: { indices: indices as string[] } };
  }
  const { error } = await supabase.rpc('enregistrer_proche', {
    p_evenement: evenement.id,
    // Le type généré ne connaît pas null : la fonction crée un proche quand l'id est absent.
    p_id: null as unknown as string,
    p_langues: langues as unknown as Json,
  });
  if (error) return { erreur: 'serveur', valeurs, instant: Date.now() };
  rafraichir();
  return { ok: true, instant: Date.now() };
}

export async function choisirContenu(code: string, passageId: string, contenuId: string) {
  const { supabase, evenement, rafraichir } = await contexte(code);
  const { data: passage } = await supabase
    .from('passages')
    .update({ contenu_id: contenuId || null })
    .eq('id', passageId)
    .eq('evenement_id', evenement.id)
    .eq('statut', 'a_venir')
    .select('manche_id, manches(jeu)')
    .maybeSingle();
  // Portrait mystère : une nouvelle cible entre dans la grille, refaite autour d'elle.
  if (passage?.manches?.jeu === 'portrait') {
    await refaireGrille(supabase, evenement, passage.manche_id);
  }
  rafraichir();
}
