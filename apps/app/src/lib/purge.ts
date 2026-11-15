import type { SupabaseClient } from '@supabase/supabase-js';

/** Taille d'un lot : `storage.remove` accepte 1 000 chemins au plus par appel. */
const LOT = 1000;

/**
 * Supprime les photos expirées (conservation : 30 jours après la soirée, tranché le
 * 2026-10-03). Le fichier part d'abord : une ligne sans fichier se repurge au passage suivant,
 * alors qu'un fichier sans ligne resterait introuvable à jamais. Rend le nombre de photos
 * supprimées.
 *
 * Le client doit pouvoir écrire le bucket et la table : en production, le rôle de service,
 * appelé par la route cron (`/api/cron/purge-photos`).
 */
export async function purgerPhotosExpirees(
  client: SupabaseClient,
  maintenant: Date = new Date(),
): Promise<number> {
  let total = 0;
  for (;;) {
    const { data, error } = await client
      .from('photos')
      .select('id, chemin')
      .lte('expire_le', maintenant.toISOString())
      .limit(LOT);
    if (error) throw new Error(`lecture des photos expirées : ${error.message}`);
    const photos = (data ?? []) as { id: string; chemin: string }[];
    if (photos.length === 0) return total;

    const retrait = await client.storage.from('photos').remove(photos.map((p) => p.chemin));
    if (retrait.error) throw new Error(`retrait des fichiers : ${retrait.error.message}`);
    const { error: suppression } = await client
      .from('photos')
      .delete()
      .in(
        'id',
        photos.map((p) => p.id),
      );
    if (suppression) throw new Error(`suppression des lignes : ${suppression.message}`);
    total += photos.length;
    if (photos.length < LOT) return total;
  }
}

/** Le dernier jour de soirée dont les photos sont expirées : 31 jours avant aujourd'hui (UTC). */
export function derniereSoireeExpiree(maintenant: Date): string {
  const jour = new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
  );
  jour.setUTCDate(jour.getUTCDate() - 31);
  return jour.toISOString().slice(0, 10);
}

/**
 * Retire les photos de fond des jeux (2026-11-15) des soirées passées depuis 31 jours, comme les
 * photos du Photo challenge : ce sont souvent des photos de famille. Le fichier part d'abord, puis
 * la colonne revient à `null`. Rend le nombre de photos retirées.
 */
export async function purgerFondsExpires(
  client: SupabaseClient,
  maintenant: Date = new Date(),
): Promise<number> {
  let total = 0;
  for (;;) {
    const { data, error } = await client
      .from('manches')
      .select('id, fond, evenements!inner(date_evenement)')
      .not('fond', 'is', null)
      .lte('evenements.date_evenement', derniereSoireeExpiree(maintenant))
      .limit(LOT);
    if (error) throw new Error(`lecture des fonds expirés : ${error.message}`);
    const fonds = (data ?? []) as unknown as { id: string; fond: string }[];
    if (fonds.length === 0) return total;

    const retrait = await client.storage.from('fonds').remove(fonds.map((f) => f.fond));
    if (retrait.error) throw new Error(`retrait des fonds : ${retrait.error.message}`);
    const { error: oubli } = await client
      .from('manches')
      .update({ fond: null })
      .in(
        'id',
        fonds.map((f) => f.id),
      );
    if (oubli) throw new Error(`oubli des fonds : ${oubli.message}`);
    total += fonds.length;
    if (fonds.length < LOT) return total;
  }
}
