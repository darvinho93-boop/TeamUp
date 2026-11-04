'use client';

import { useLayoutEffect, useRef } from 'react';
import {
  departDu,
  DEPARTS_DEBUT_MS,
  DUREE_DEVOILEMENT_MS,
  etatDuPrenom,
  ordreDesDeparts,
  placesDuTourbillon,
} from '@/lib/devoilement';
import type { Membre } from '@/lib/membres';

/** Le tourbillon occupe ces parts de la scène, autour de son centre. */
const TOURBILLON_LARGEUR = 0.32;
const TOURBILLON_HAUTEUR = 0.3;
/** Les places d'arrivée se remesurent ce temps avant le premier départ. */
const REMESURE_AVANT_MS = 200;

/**
 * Le dévoilement des équipes (2026-11-04) : une couche posée sur la scène Équipes, dont les
 * prénoms sont masqués. Chaque prénom tourbillonne au centre, puis file vers sa place dans sa
 * carte, à tour de rôle entre les équipes ; posé, il a exactement la taille et la place du prénom
 * de la carte, qui le remplace à la fin. Tout part de l'instant posé par la base : deux écrans,
 * ou un écran rechargé, montrent la même image. Une transformation par image, sans rendu React.
 */
export function VolDesPrenoms({
  equipes,
  departMs,
  decalageMs,
  graine,
  surFin,
}: {
  /** Les prénoms visibles de chaque carte, dans l'ordre de la grille. */
  equipes: readonly (readonly Membre[])[];
  departMs: number;
  decalageMs: number;
  /** Tire le tourbillon : l'événement et l'instant du dévoilement. */
  graine: string;
  surFin: () => void;
}) {
  const couche = useRef<HTMLDivElement>(null);
  const prenomsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const finRef = useRef(surFin);
  useLayoutEffect(() => {
    finRef.current = surFin;
  });

  const membres = equipes.flat();
  // Le k-ième départ : le rang de chaque prénom (dans l'ordre de la grille) dans la file.
  const effectifs = equipes.map((e) => e.length);
  const debuts = effectifs.map((_, i) => effectifs.slice(0, i).reduce((a, b) => a + b, 0));
  const departs = Array<number>(membres.length).fill(0);
  ordreDesDeparts(effectifs).forEach(({ equipe, rang }, k) => {
    departs[(debuts[equipe] ?? 0) + rang] = departDu(k, membres.length);
  });
  const cle = `${graine}:${effectifs.join(',')}:${membres.map((m) => m.prenom).join(',')}`;

  useLayoutEffect(() => {
    const el = couche.current;
    const corps = el?.parentElement;
    if (!el || !corps) return;
    // Les places d'arrivée : les prénoms de la grille, déjà ajustés (effets des enfants d'abord),
    // ramenés à la scène de référence (l'écran la met à l'échelle du projecteur). Mesurées au
    // montage, puis de nouveau juste avant les départs : les listes de la grille finissent alors
    // leur révélation (600 ms, une légère mise à l'échelle) depuis longtemps.
    const mesurer = () => {
      const cibles = [...corps.querySelectorAll<HTMLElement>('.tu-stage-membres .tu-stage-membre')];
      const base = el.getBoundingClientRect();
      const echelle = base.width / el.offsetWidth || 1;
      const mesures = cibles.map((cible) => {
        const r = cible.getBoundingClientRect();
        const style = getComputedStyle(cible);
        return {
          x: (r.left - base.left) / echelle,
          y: (r.top - base.top) / echelle,
          largeur: r.width / echelle,
          hauteur: r.height / echelle,
          police: style.fontSize,
          interligne: style.lineHeight,
        };
      });
      mesures.forEach((a, i) => {
        const s = prenomsRef.current[i];
        if (!s) return;
        s.style.width = `${a.largeur}px`;
        s.style.height = `${a.hauteur}px`;
        s.style.fontSize = a.police;
        s.style.lineHeight = a.interligne;
      });
      return mesures;
    };
    let arrivees = mesurer();
    let remesure = false;
    const tourbillon = {
      cx: el.offsetWidth / 2,
      cy: el.offsetHeight / 2,
      rx: el.offsetWidth * TOURBILLON_LARGEUR,
      ry: el.offsetHeight * TOURBILLON_HAUTEUR,
    };
    const places = placesDuTourbillon(arrivees.length, graine);

    let id = 0;
    const pas = () => {
      const t = Date.now() + decalageMs - departMs;
      if (!remesure && t >= DEPARTS_DEBUT_MS - REMESURE_AVANT_MS) {
        remesure = true;
        arrivees = mesurer();
      }
      arrivees.forEach((a, i) => {
        const s = prenomsRef.current[i];
        const place = places[i];
        if (!s || !place) return;
        const centre = { x: a.x + a.largeur / 2, y: a.y + a.hauteur / 2 };
        const e = etatDuPrenom(t, place, departs[i] ?? 0, centre, tourbillon);
        s.style.transform = `translate(${e.x - a.largeur / 2}px, ${e.y - a.hauteur / 2}px) scale(${e.echelle})`;
        s.style.opacity = String(e.opacite);
      });
      if (t >= DUREE_DEVOILEMENT_MS) {
        finRef.current();
        return;
      }
      id = requestAnimationFrame(pas);
    };
    pas();
    return () => cancelAnimationFrame(id);
    // `cle` résume les prénoms et la graine ; les départs s'en déduisent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, departMs, decalageMs]);

  return (
    <div ref={couche} className="tu-devoilement" aria-hidden="true" data-testid="devoilement">
      {membres.map((m, i) => (
        <span
          key={i}
          ref={(s) => {
            prenomsRef.current[i] = s;
          }}
          className="tu-stage-membre tu-devoilement__prenom"
        >
          {m.capitaine && <span className="tu-stage-membre__capitaine">★</span>}
          {m.prenom}
        </span>
      ))}
    </div>
  );
}
