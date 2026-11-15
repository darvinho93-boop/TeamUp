import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cheminFond, estCheminFond, fondAcceptable, TAILLE_MAX_FOND } from '@/lib/fonds';
import { evenementDeLaRegie } from '@/serveur/regie';
import { reponse } from '@/serveur/reponse';
import { signalerSalle } from '@/serveur/signal';

/**
 * La photo de fond d'un jeu (2026-11-15), déposée, remplacée ou retirée à la préparation, à tout
 * moment de la soirée. Tout se fait sous la session de l'animateur : les policies du bucket
 * « fonds » et de `manches` limitent à ses soirées, le rôle de service n'y sert pas.
 *
 * Le navigateur envoie un JPEG déjà recadré et réduit ; le serveur revérifie les octets, les
 * dimensions et le poids, quel que soit le type annoncé.
 */

type Contexte = Awaited<ReturnType<typeof evenementDeLaRegie>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** La manche de cette soirée et sa photo en place ; `null` si la manche n'en est pas. */
async function mancheDe({ supabase, evenement }: Contexte, id: string) {
  if (!UUID.test(id)) return null;
  const { data } = await supabase
    .from('manches')
    .select('id, fond')
    .eq('id', id)
    .eq('evenement_id', evenement.id)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, fond: estCheminFond(data.fond) ? data.fond : null };
}

/** L'écran commun relit aussitôt, les pages de la régie aussi. */
async function prevenir({ evenement }: Contexte) {
  await signalerSalle(evenement.id);
  revalidatePath(`/regie/${evenement.code}`, 'layout');
}

export async function POST(req: Request, { params }: RouteContext<'/regie/[code]/fond/[manche]'>) {
  const { code, manche: id } = await params;
  const contexte = await evenementDeLaRegie(code);
  const { supabase, evenement } = contexte;
  const manche = await mancheDe(contexte, id);
  if (!manche) return reponse({ erreur: 'manche' }, 404);

  const fichier = (await req.formData().catch(() => null))?.get('fichier');
  if (!(fichier instanceof Blob) || fichier.size === 0 || fichier.size > TAILLE_MAX_FOND) {
    return reponse({ erreur: 'fichier' }, 422);
  }
  const octets = new Uint8Array(await fichier.arrayBuffer());
  if (!fondAcceptable(octets)) return reponse({ erreur: 'fichier' }, 422);

  const chemin = cheminFond(evenement.id, randomUUID());
  const depot = await supabase.storage
    .from('fonds')
    // Le chemin change à chaque dépôt : le fichier peut rester en cache un an.
    .upload(chemin, octets, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (depot.error) return reponse({ erreur: 'depot' }, 500);

  const { error } = await supabase.from('manches').update({ fond: chemin }).eq('id', manche.id);
  if (error) {
    await supabase.storage.from('fonds').remove([chemin]);
    return reponse({ erreur: 'depot' }, 500);
  }
  if (manche.fond) await supabase.storage.from('fonds').remove([manche.fond]);

  await prevenir(contexte);
  return reponse({ chemin });
}

export async function DELETE(_: Request, { params }: RouteContext<'/regie/[code]/fond/[manche]'>) {
  const { code, manche: id } = await params;
  const contexte = await evenementDeLaRegie(code);
  const manche = await mancheDe(contexte, id);
  if (!manche) return reponse({ erreur: 'manche' }, 404);

  const { error } = await contexte.supabase
    .from('manches')
    .update({ fond: null })
    .eq('id', manche.id);
  if (error) return reponse({ erreur: 'depot' }, 500);
  if (manche.fond) await contexte.supabase.storage.from('fonds').remove([manche.fond]);

  await prevenir(contexte);
  return reponse({ chemin: null });
}
