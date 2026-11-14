import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cheminLogo, logoAcceptable, TAILLE_MAX_LOGO } from '@/lib/logo';
import { evenementDeLaRegie } from '@/serveur/regie';
import { reponse } from '@/serveur/reponse';
import { signalerSalle } from '@/serveur/signal';

/**
 * Le logo du partenaire de la soirée (2026-11-11), déposé et retiré à la préparation. Tout se
 * fait sous la session de l'animateur : les policies du bucket « logos » et de `evenements`
 * limitent à ses soirées, le rôle de service n'y sert pas.
 *
 * Le navigateur envoie un PNG déjà rogné et réduit ; le serveur revérifie les octets, les
 * dimensions et le poids, quel que soit le type annoncé.
 */

type Contexte = Awaited<ReturnType<typeof evenementDeLaRegie>>;

/** Le logo en place, ou `null`. Sans la migration 20261111090000, la lecture échoue : aucun. */
async function logoActuel({ supabase, evenement }: Contexte): Promise<string | null> {
  const { data } = await supabase
    .from('evenements')
    .select('logo_partenaire')
    .eq('id', evenement.id)
    .maybeSingle();
  return data?.logo_partenaire ?? null;
}

/** L'écran commun relit aussitôt, les pages de la régie aussi. */
async function prevenir({ evenement }: Contexte) {
  await signalerSalle(evenement.id);
  revalidatePath(`/regie/${evenement.code}`, 'layout');
}

export async function POST(req: Request, { params }: RouteContext<'/regie/[code]/logo'>) {
  const contexte = await evenementDeLaRegie((await params).code);
  const { supabase, evenement } = contexte;

  const fichier = (await req.formData().catch(() => null))?.get('fichier');
  if (!(fichier instanceof Blob) || fichier.size === 0 || fichier.size > TAILLE_MAX_LOGO) {
    return reponse({ erreur: 'fichier' }, 422);
  }
  const octets = new Uint8Array(await fichier.arrayBuffer());
  if (!logoAcceptable(octets)) return reponse({ erreur: 'fichier' }, 422);

  const ancien = await logoActuel(contexte);
  const chemin = cheminLogo(evenement.id, randomUUID());
  const depot = await supabase.storage
    .from('logos')
    // Le chemin change à chaque dépôt : le fichier peut rester en cache un an.
    .upload(chemin, octets, { contentType: 'image/png', cacheControl: '31536000' });
  if (depot.error) return reponse({ erreur: 'depot' }, 500);

  const { error } = await supabase
    .from('evenements')
    .update({ logo_partenaire: chemin })
    .eq('id', evenement.id);
  if (error) {
    await supabase.storage.from('logos').remove([chemin]);
    return reponse({ erreur: 'depot' }, 500);
  }
  if (ancien) await supabase.storage.from('logos').remove([ancien]);

  await prevenir(contexte);
  return reponse({ chemin });
}

export async function DELETE(_: Request, { params }: RouteContext<'/regie/[code]/logo'>) {
  const contexte = await evenementDeLaRegie((await params).code);
  const { supabase, evenement } = contexte;

  const ancien = await logoActuel(contexte);
  const { error } = await supabase
    .from('evenements')
    .update({ logo_partenaire: null })
    .eq('id', evenement.id);
  if (error) return reponse({ erreur: 'depot' }, 500);
  if (ancien) await supabase.storage.from('logos').remove([ancien]);

  await prevenir(contexte);
  return reponse({ chemin: null });
}
