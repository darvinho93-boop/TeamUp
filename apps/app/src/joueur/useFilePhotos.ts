'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EtatJoueur, RefusPhoto } from '@/lib/partie';
import { compresserPhoto } from '@/lib/compression';
import { cleEnvoi, enAttente, mettreEnFile, retirer, type EnvoiEnAttente } from './filePhotos';

/**
 * Identifiant v4 de l'envoi. `crypto.randomUUID` n'existe qu'en contexte sécurisé : sur le réseau
 * local (`pnpm dev:host`, en http), on le fabrique à partir de `getRandomValues`.
 */
function nouvelIdentifiant(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const o = crypto.getRandomValues(new Uint8Array(16));
  o[6] = (o[6]! & 0x0f) | 0x40;
  o[8] = (o[8]! & 0x3f) | 0x80;
  const h = Array.from(o, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Tant qu'une photo attend, on retente à ce rythme, en plus des retours du réseau. */
const RELANCE_MS = 15_000;

export type SortPhoto =
  { etat: 'attente' } | { etat: 'envoi' } | { etat: 'refusee'; refus: RefusPhoto | 'decodage' };

/**
 * La file des photos du capitaine. Elle se vide seule : à la prise, au retour du réseau, quand
 * l'app revient au premier plan, et toutes les 15 s tant qu'il reste une photo. Les envois
 * partent un par un. Une erreur réseau garde la photo ; un refus de la base (envois clos, plus
 * capitaine…) la retire et le dit : réessayer n'y changerait rien.
 */
export function useFilePhotos(code: string, remplacer: (etat: EtatJoueur) => void) {
  const [sorts, setSorts] = useState<Record<string, SortPhoto>>({});
  const [apercus, setApercus] = useState<Record<string, string>>({});
  const enCours = useRef(false);
  const relance = useRef(false);

  const poser = useCallback((themeId: string, sort: SortPhoto | null) => {
    setSorts((avant) => {
      const suite = { ...avant };
      if (sort) suite[themeId] = sort;
      else delete suite[themeId];
      return suite;
    });
  }, []);

  const apercu = useCallback((themeId: string, photo: Blob) => {
    setApercus((avant) => {
      if (avant[themeId]) URL.revokeObjectURL(avant[themeId]);
      return { ...avant, [themeId]: URL.createObjectURL(photo) };
    });
  }, []);

  const envoyer = useCallback(
    async (envoi: EnvoiEnAttente): Promise<'fait' | 'reseau'> => {
      const corps = new FormData();
      corps.set('theme_id', envoi.theme_id);
      corps.set('envoi_id', envoi.envoi_id);
      corps.set('fichier', envoi.photo, `${envoi.envoi_id}.jpg`);
      let reponse: Response;
      try {
        reponse = await fetch(`/api/partie/${code}/photo`, { method: 'POST', body: corps });
      } catch {
        return 'reseau';
      }
      if (reponse.status >= 500) return 'reseau';
      const donnees = (await reponse.json().catch(() => null)) as
        EtatJoueur | { erreur: RefusPhoto } | null;
      if (!donnees) return 'reseau';
      await retirer(envoi);
      if ('erreur' in donnees) {
        poser(envoi.theme_id, { etat: 'refusee', refus: donnees.erreur });
      } else {
        poser(envoi.theme_id, null);
        remplacer(donnees);
      }
      return 'fait';
    },
    [code, poser, remplacer],
  );

  const vider = useCallback(async () => {
    if (enCours.current) {
      relance.current = true;
      return;
    }
    enCours.current = true;
    try {
      do {
        relance.current = false;
        const file = await enAttente(code);
        for (const envoi of file) {
          if (!navigator.onLine) {
            poser(envoi.theme_id, { etat: 'attente' });
            continue;
          }
          poser(envoi.theme_id, { etat: 'envoi' });
          if ((await envoyer(envoi)) === 'reseau') {
            poser(envoi.theme_id, { etat: 'attente' });
            break;
          }
        }
      } while (relance.current);
    } finally {
      enCours.current = false;
    }
  }, [code, envoyer, poser]);

  /** Une photo vient d'être prise : compressée, mise en file, puis envoyée si possible. */
  const ajouter = useCallback(
    async (themeId: string, fichier: File) => {
      let photo: Blob;
      try {
        photo = await compresserPhoto(fichier);
      } catch {
        poser(themeId, { etat: 'refusee', refus: 'decodage' });
        return;
      }
      apercu(themeId, photo);
      poser(themeId, { etat: 'attente' });
      await mettreEnFile({
        cle: cleEnvoi(code, themeId),
        code,
        theme_id: themeId,
        envoi_id: nouvelIdentifiant(),
        photo,
        prise_le: Date.now(),
      });
      await vider();
    },
    [code, apercu, poser, vider],
  );

  // Au chargement : ce qui attendait (onglet fermé hors réseau) reprend sa place, puis part.
  useEffect(() => {
    let actif = true;
    void enAttente(code).then((file) => {
      if (!actif) return;
      for (const envoi of file) {
        apercu(envoi.theme_id, envoi.photo);
        poser(envoi.theme_id, { etat: 'attente' });
      }
      void vider();
    });
    return () => {
      actif = false;
    };
  }, [code, apercu, poser, vider]);

  const attend = Object.values(sorts).some((s) => s.etat === 'attente' || s.etat === 'envoi');

  useEffect(() => {
    const auRetour = () => void vider();
    const aLaVue = () => {
      if (document.visibilityState === 'visible') void vider();
    };
    window.addEventListener('online', auRetour);
    document.addEventListener('visibilitychange', aLaVue);
    const minuterie = attend ? setInterval(() => void vider(), RELANCE_MS) : undefined;
    return () => {
      window.removeEventListener('online', auRetour);
      document.removeEventListener('visibilitychange', aLaVue);
      clearInterval(minuterie);
    };
  }, [attend, vider]);

  return { sorts, apercus, ajouter };
}
