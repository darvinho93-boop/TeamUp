'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx, teamModifier } from '@teamup/ui/react';
import { dispositionArbre, signaturePrenoms } from '@/lib/arbre';
import type { MatchSalle } from '@/lib/tournoi';
import { Recompense } from './Recompense';
import { useTenirEnLargeur } from './useTenirEnLargeur';

/**
 * L'arbre du tournoi : les deux moitiés du tableau montent vers la coupe, au centre, sous le nom du
 * tour. Seuls les prénoms du tour en cours sont écrits ; les tours passés ne sont plus que le
 * chemin, à la couleur de l'équipe de chaque joueur encore en lice. Les matchs lancés portent leur
 * poste.
 */
export function ArbreTournoi({
  matchs,
  sequence,
  tour,
  entete,
  pied,
}: {
  matchs: MatchSalle[];
  sequence: number | null;
  /** Le tour de la séquence lancée, `null` avant la première. */
  tour: number | null;
  entete: ReactNode;
  pied?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const arbre = useMemo(() => dispositionArbre(matchs, sequence, tour), [matchs, sequence, tour]);
  useTenirEnLargeur(ref, signaturePrenoms(arbre.places), '.tu-arbre__prenom', 0.4);

  // Les traits ne s'allument en fondu qu'une fois l'arbre posé : rien ne rejoue au chargement.
  const [vivant, setVivant] = useState(false);
  useEffect(() => {
    const image = requestAnimationFrame(() => setVivant(true));
    return () => cancelAnimationFrame(image);
  }, []);

  return (
    <div ref={ref} className="tu-arbre" data-vivant={vivant} data-testid="tournoi-arbre">
      {/* Remonté à chaque nouveau tour : l'arbre se recompose en fondu autour des nouveaux noms. */}
      <div key={arbre.tourVisible} className="tu-arbre__plan">
        <svg
          className="tu-arbre__traits"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {arbre.lignes.map((l) => (
            <path
              key={l.cle}
              d={l.d}
              className={cx('tu-arbre__trait', l.equipe !== null && teamModifier(l.equipe))}
              data-allume={l.equipe !== null}
              data-actif={l.active}
              data-passe={l.passe}
            />
          ))}
        </svg>

        {arbre.places.map((p) => (
          <span
            key={p.cle}
            className={cx('tu-arbre__place', p.joueur && teamModifier(p.joueur.equipe))}
            style={
              {
                '--tu-arbre-x': p.x,
                '--tu-arbre-y': p.y,
                '--tu-arbre-l': p.largeur,
                '--tu-arbre-rangs': p.rangs,
              } as CSSProperties
            }
            data-etat={p.etat}
            data-cote={p.cote}
            data-pastille={p.pastille}
            data-actif={p.actif}
            data-tour={p.tour}
          >
            {!p.pastille && p.joueur && <span className="tu-arbre__prenom">{p.joueur.prenom}</span>}
          </span>
        ))}

        {arbre.postes.map((p) => (
          <span
            key={p.cle}
            className="tu-arbre__poste"
            style={
              {
                '--tu-arbre-x': p.x,
                '--tu-arbre-y': p.y,
                '--tu-arbre-rangs': p.rangs,
              } as CSSProperties
            }
            data-juge={p.juge}
            data-testid={`poste-${p.poste}`}
          >
            {p.poste}
          </span>
        ))}
      </div>

      <div className="tu-arbre__centre">
        <div className="tu-arbre__entete">{entete}</div>
        <div className="tu-arbre__trophee">
          <Recompense place={1} className="tu-arbre__coupe" />
          {arbre.champion && (
            <span
              className={cx(
                'tu-team tu-team--badge tu-arbre__champion',
                teamModifier(arbre.champion.equipe),
              )}
              data-testid="tournoi-champion"
            >
              {arbre.champion.prenom}
            </span>
          )}
        </div>
        <div className="tu-arbre__pied">{pied}</div>
      </div>
    </div>
  );
}
