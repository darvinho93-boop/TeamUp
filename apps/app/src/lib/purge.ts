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
