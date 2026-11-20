'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { positionCinemime } from '@teamup/game';
import type { ExtraitDuPassage } from '@/lib/extraits';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import { SonsContexte } from './sons/useSons';

/**
 * Les scènes du Ciné-mime déjà téléchargées par l'écran commun (`useFichiersLocaux`) : chemin →
 * adresse locale. Vide dans l'aperçu de la régie, qui lit la vidéo en flux.
 */
export const ExtraitsContexte = createContext<ReadonlyMap<string, string>>(new Map());

/** Une URL signée, quand la scène n'est pas encore en mémoire : le temps de la jouer. */
const URL_DISTANTE_S = 600;

/**
 * La vidéo d'une scène du Ciné-mime (2026-11-20). Elle part du début au départ du chrono de la
 * salle et se cale sur l'heure de la base : un second écran, ou un écran rechargé, retombe à la
 * même image. Elle s'arrête sur sa dernière image.
 *
 * `son` : seulement à la revue, après le verdict ; pendant le jeu, la scène est muette (le son
 * donnerait le film aux groupes dos tourné). Le son suit alors la régie (coupure, volume) et ne
 * sort que sur l'écran commun, une fois « Activer le son » touché : l'aperçu de la régie et un
 * onglet qui a cédé le son restent muets (`SonsContexte` y est nul).
 */
export function VideoDeScene({
  extrait,
  departMs,
  decalageMs,
  son,
  reglage,
  className,
  surFin,
}: {
  extrait: ExtraitDuPassage;
  departMs: number | null;
  decalageMs: number;
  son: boolean;
  reglage: { actif: boolean; volume: number };
  className?: string;
  /** La vidéo est au bout (ou l'était déjà à l'ouverture de l'écran). */
  surFin?: (finie: boolean) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const locale = useContext(ExtraitsContexte).get(extrait.chemin) ?? null;
  const [distante, setDistante] = useState<string | null>(null);
  const jouer = useContext(SonsContexte);
  const sonPermis = son && jouer !== null && reglage.actif;
  // Lus par le calage et la fin de la vidéo, sans la relancer quand ils changent.
  const finRef = useRef(surFin);
  const decalageRef = useRef(decalageMs);
  useEffect(() => {
    finRef.current = surFin;
    decalageRef.current = decalageMs;
  }, [surFin, decalageMs]);

  // Pas encore téléchargée : lue en flux, par URL signée.
  useEffect(() => {
    if (locale) return;
    let actif = true;
    void supabaseNavigateur()
      .storage.from('extraits')
      .createSignedUrl(extrait.chemin, URL_DISTANTE_S)
      .then(({ data }) => {
        if (actif) setDistante(data?.signedUrl ?? null);
      });
    return () => {
      actif = false;
    };
  }, [extrait.chemin, locale]);

  const src = locale ?? distante;

  // Le son, posé à la main : React ne pose pas toujours l'attribut `muted` sur l'élément.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = !sonPermis;
    video.volume = Math.min(1, Math.max(0, reglage.volume / 100));
  }, [sonPermis, reglage.volume, src]);

  // Le départ : à la position que dit l'heure de la base, ou sur la dernière image si c'est fini.
  useEffect(() => {
    const video = ref.current;
    if (!video || !src || departMs === null) return;
    let annule = false;
    const caler = () => {
      if (annule) return;
      const ecoule = Date.now() + decalageRef.current - departMs;
      const { positionMs, finie } = positionCinemime(extrait.dureeMs, ecoule);
      finRef.current?.(finie);
      if (finie) {
        video.currentTime = Math.max(
          0,
          (Number.isFinite(video.duration) ? video.duration : 0) - 0.05,
        );
        video.pause();
        return;
      }
      video.currentTime = positionMs / 1000;
      void video.play().catch(() => {
        // Le navigateur refuse le son sans geste : la scène passe quand même, muette.
        if (annule || video.muted) return;
        video.muted = true;
        void video.play().catch(() => undefined);
      });
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) caler();
    else video.addEventListener('loadedmetadata', caler, { once: true });
    return () => {
      annule = true;
      video.removeEventListener('loadedmetadata', caler);
    };
  }, [src, departMs, extrait.dureeMs]);

  return (
    <video
      ref={ref}
      className={className}
      src={src ?? undefined}
      preload="auto"
      playsInline
      muted
      disablePictureInPicture
      data-testid="scene-video"
      data-son={sonPermis ? 'oui' : 'non'}
      onEnded={() => finRef.current?.(true)}
    />
  );
}
