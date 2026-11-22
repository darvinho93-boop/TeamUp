'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { musiquesDe } from '@/lib/musiques';
import {
  deroule,
  extraitA,
  fondA,
  FONDU_KARAOKE_MS,
  instantDe,
  musiqueA,
  reglageDe,
  sonsPour,
  type Instant,
  type Montee,
  type Son,
} from '@/lib/sons';
import { titresBlind } from '@/lib/pilotage';
import { mancheCourante, type EtatSalle } from '@/lib/salle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import { creerLecteur, type Lecteur } from './lecteur';

/** Une URL signée de musique ne sert qu'au téléchargement d'avance : une heure suffit. */
const URL_MUSIQUE_S = 60 * 60;
/** Ce qu'on ajoute à un minuteur, qui part parfois une milliseconde avant l'heure. */
const MARGE_MINUTEUR_MS = 20;

/**
 * De quoi jouer un son, pour les composants qui en déclenchent d'eux-mêmes (le chrono, l'arrêt
 * d'un palier). `null` partout sauf sur l'écran commun : la régie et son aperçu restent muets.
 */
export const SonsContexte = createContext<
  ((son: Son, apresMs?: number, montee?: Montee) => void) | null
>(null);

/**
 * Où en est vraiment la chanson du karaoké (2026-11-23), en secondes : les paroles suivent ce qu'on
 * entend. `null` partout sauf sur l'écran commun au son activé : l'horloge de la base prend le relais.
 */
export const PositionExtraitContexte = createContext<(() => number | null) | null>(null);

declare global {
  interface Window {
    /** Le lecteur de l'écran commun (journal des sons joués, réglage), pour les contrôles. */
    __tuLecteur?: Lecteur;
  }
}

/**
 * Le son de l'écran commun : un clic l'active (les navigateurs l'exigent), puis chaque
 * changement d'état joue ce que `sonsPour` en dit, la musique de fond suit le moment, et le
 * volume suit la régie.
 */
export function useSons(etat: EtatSalle, eteint: boolean, decalageMs: number) {
  const [lecteur, setLecteur] = useState<Lecteur | null>(null);
  const precedent = useRef<Instant | null>(null);
  const reglage = reglageDe(etat);
  const instant = instantDe(etat);

  // Un second clic pendant le chargement ne crée pas un second lecteur.
  const chargement = useRef(false);
  const activer = useCallback(async () => {
    if (chargement.current) return;
    chargement.current = true;
    try {
      const neuf = await creerLecteur(reglageDe(etat), {
        // Le son est parti dans un autre onglet : celui-ci repropose de l'activer.
        surCession: () => setLecteur(null),
      });
      window.__tuLecteur = neuf;
      setLecteur(neuf);
    } finally {
      chargement.current = false;
    }
  }, [etat]);

  // Réveillé tant que l'écran est monté, en veille sinon (voir `veiller`).
  useEffect(() => {
    lecteur?.veiller(false);
    return () => lecteur?.veiller(true);
  }, [lecteur]);

  const { actif, volume } = reglage;
  useEffect(() => lecteur?.regler({ actif, volume }), [lecteur, actif, volume]);

  const {
    scene,
    etape,
    mancheId,
    passageId,
    jeu,
    joueurs,
    chronoDepartMs,
    indices,
    bruitageSon,
    bruitageMs,
  } = instant;
  useEffect(() => {
    const apres: Instant = {
      scene,
      etape,
      mancheId,
      passageId,
      jeu,
      joueurs,
      chronoDepartMs,
      indices,
      bruitageSon,
      bruitageMs,
    };
    const avant = precedent.current;
    precedent.current = apres;
    if (!lecteur) return;
    // À l'activation, pas d'« avant » à comparer : seule la musique de fond du moment démarre.
    if (avant) {
      const sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const son of sonsPour(avant, apres))
        for (const pas of deroule(son, sansMouvement)) lecteur.jouer(pas.son, pas.apresMs);
    }
  }, [
    lecteur,
    scene,
    etape,
    mancheId,
    passageId,
    jeu,
    joueurs,
    chronoDepartMs,
    indices,
    bruitageSon,
    bruitageMs,
  ]);

  // La musique de fond du moment. Celle d'une explication s'arrête avec elle : l'étape reste
  // « explication » tant que la régie n'a rien touché, mais le script, lui, a une fin.
  const { chrono_depart_ms: depart, chrono_duree_s: duree } = etat.pilotage;
  useEffect(() => {
    if (!lecteur) return;
    const fond = fondA({
      scene,
      etape,
      mancheId,
      passageId,
      jeu,
      joueurs,
      chronoDepartMs: depart,
      indices,
      bruitageSon: null,
      bruitageMs: null,
    });
    if (fond !== 'explication' || depart === null || duree === null) {
      lecteur.fond(fond);
      return;
    }
    const reste = depart + duree * 1000 - (Date.now() + decalageMs);
    lecteur.fond(reste > 0 ? fond : null);
    if (reste <= 0) return;
    const fin = setTimeout(() => lecteur.fond(null), reste);
    return () => clearTimeout(fin);
  }, [lecteur, scene, etape, mancheId, passageId, jeu, joueurs, depart, duree, decalageMs]);

  // Les musiques du jeu présenté (2026-11-15) : lues dans la bibliothèque dès la présentation,
  // puis téléchargées d'avance. Seules les actives jouent ; une musique retirée de la bibliothèque
  // après coup se tait.
  const mancheEnCours = mancheCourante(etat);
  // Blind test (2026-11-15) : les extraits de ses titres se téléchargent de même.
  const cochees = [
    ...new Set([
      ...musiquesDe(mancheEnCours?.options),
      ...(mancheEnCours?.jeu === 'blind'
        ? titresBlind(mancheEnCours).flatMap((x) => (x.musique ? [x.musique] : []))
        : []),
    ]),
  ].join('|');
  const [actives, setActives] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!lecteur || !cochees) {
      // Déjà vide (le cas de presque tous les écrans) : aucun rendu de plus.
      setActives((avant) => (avant.size ? new Set() : avant));
      return;
    }
    let actif = true;
    void (async () => {
      const supabase = supabaseNavigateur();
      const { data } = await supabase
        .from('musiques')
        .select('id, chemin')
        .in('id', cochees.split('|'))
        .eq('actif', true);
      const lignes = data ?? [];
      if (!actif) return;
      setActives(new Set(lignes.map((l) => l.id)));
      if (lignes.length === 0) return;
      const { data: signees } = await supabase.storage.from('musiques').createSignedUrls(
        lignes.map((l) => l.chemin),
        URL_MUSIQUE_S,
      );
      for (const ligne of lignes) {
        const url = signees?.find((x) => x.path === ligne.chemin)?.signedUrl;
        if (url) void lecteur.charger(ligne.id, url);
      }
    })();
    return () => {
      actif = false;
    };
  }, [lecteur, cochees]);

  // La musique du chrono : de son départ aux dix dernières secondes, puis le tic-tac seul.
  // Le minuteur peut partir un peu tôt : chaque passage le réarme jusqu'à l'heure dite.
  const [passage, relancer] = useState(0);
  const musique = lecteur ? musiqueA(etat, Date.now() + decalageMs, actives) : null;
  const musiqueId = musique?.id ?? null;
  const jusquA = musique?.jusquA ?? null;
  useEffect(() => {
    lecteur?.musique(musiqueId);
    if (!lecteur || jusquA === null) return;
    const reste = jusquA - (Date.now() + decalageMs);
    const fin = setTimeout(() => relancer((n) => n + 1), Math.max(0, reste) + MARGE_MINUTEUR_MS);
    return () => clearTimeout(fin);
  }, [lecteur, musiqueId, jusquA, decalageMs, passage]);

  // L'extrait du blind test : il part à l'écoute, à la seconde où il en est, et s'arrête net au
  // buzz (l'étape change) ou quand le chrono de l'extrait est écoulé. Le décalage d'horloge se
  // réestime à chaque relecture : il passe par une référence, sans quoi l'extrait repartirait.
  const extrait = lecteur ? extraitA(etat, Date.now() + decalageMs, actives) : null;
  const extraitId = extrait?.id ?? null;
  const extraitFin = extrait?.jusquA ?? null;
  // La chanson d'un karaoké s'en va en fondu, quelle que soit la touche qui la quitte (2026-11-23).
  const extraitKaraoke = extrait?.karaoke === true;
  const karaokeRef = useRef(false);
  const depuisRef = useRef(0);
  depuisRef.current = extrait?.depuisS ?? 0;
  const decalageRef = useRef(decalageMs);
  decalageRef.current = decalageMs;
  const [tour, relancerExtrait] = useState(0);
  useEffect(() => {
    if (!lecteur) return;
    const fondu = !extraitId && karaokeRef.current ? FONDU_KARAOKE_MS / 1000 : undefined;
    karaokeRef.current = extraitKaraoke;
    lecteur.extrait(extraitId, depuisRef.current, fondu);
    if (extraitFin === null) return;
    const reste = extraitFin - (Date.now() + decalageRef.current);
    const fin = setTimeout(
      () => relancerExtrait((n) => n + 1),
      Math.max(0, reste) + MARGE_MINUTEUR_MS,
    );
    return () => clearTimeout(fin);
  }, [lecteur, extraitId, extraitFin, extraitKaraoke, tour]);

  const jouer = useCallback(
    (son: Son, apresMs?: number, montee?: Montee, dansLeSonMs?: number) =>
      lecteur?.jouer(son, apresMs, montee, dansLeSonMs),
    [lecteur],
  );
  const positionExtrait = useCallback(() => lecteur?.positionExtrait() ?? null, [lecteur]);

  return {
    /** À proposer tant que le son n'est pas activé sur cet écran. */
    aActiver: !eteint && !lecteur,
    activer,
    jouer: eteint || !lecteur ? null : jouer,
    positionExtrait: eteint || !lecteur ? null : positionExtrait,
  };
}
