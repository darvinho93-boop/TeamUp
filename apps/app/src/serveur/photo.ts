import 'server-only';
import type { EtatJoueur, RefusPhoto } from '@/lib/partie';
import { etatPourJeton } from './partie';
import { hacher, jetonDe } from './session';
import { supabaseService } from './supabase';

const BUCKET = 'photos';

/**
 * Photo du capitaine pour un thème. Le fichier arrive déjà compressé par le téléphone.
 *
 * L'état du joueur écarte d'abord ce qui ne peut pas passer, sans rien déposer. Puis le fichier
 * va au bucket, sous un nom tiré par le téléphone (`envoiId`) : un renvoi de la file d'attente
 * écrase le même objet au lieu d'en créer un autre. La base tranche ensuite, à son heure
 * (`envoyer_photo`) ; refusé, le fichier repart ; accepté, c'est l'ancienne photo qui repart.
 */
export async function envoyerPhoto(
  code: string,
  themeId: string,
  envoiId: string,
  fichier: Blob,
): Promise<{ ok: true; etat: EtatJoueur } | { ok: false; refus: RefusPhoto }> {
  const jeton = await jetonDe(code);
  const etat = jeton ? await etatPourJeton(code, jeton) : null;
  if (!jeton || !etat) return { ok: false, refus: 'session' };
  if (!etat.joueur.capitaine || !etat.equipe) return { ok: false, refus: 'capitaine' };
  if (!etat.photos?.themes.some((t) => t.theme_id === themeId))
    return { ok: false, refus: 'theme' };
  if (etat.photos.closes) return { ok: false, refus: 'close' };

  const service = supabaseService();
  const chemin = `${etat.evenement.id}/${etat.equipe.id}/${envoiId}.jpg`;
  const depot = await service.storage
    .from(BUCKET)
    .upload(chemin, fichier, { contentType: 'image/jpeg', upsert: true });
  if (depot.error) throw new Error(`dépôt de la photo : ${depot.error.message}`);

  const { data, error } = await service.rpc('envoyer_photo', {
    p_jeton_hash: hacher(jeton),
    p_theme: themeId,
    p_chemin: chemin,
  });
  if (error) {
    await service.storage.from(BUCKET).remove([chemin]);
    const refus: RefusPhoto | null = /session/.test(error.message)
      ? 'session'
      : /capitaine/.test(error.message)
        ? 'capitaine'
        : /clos/.test(error.message)
          ? 'close'
          : /thème|chemin/.test(error.message)
            ? 'theme'
            : null;
    if (!refus) throw new Error(error.message);
    return { ok: false, refus };
  }

  const ancien = (data as { ancien: string | null } | null)?.ancien;
  if (ancien) await service.storage.from(BUCKET).remove([ancien]);
  return { ok: true, etat: (await etatPourJeton(code, jeton)) ?? etat };
}
