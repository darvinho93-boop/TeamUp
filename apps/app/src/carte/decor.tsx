import { cx, teamModifier, type TeamIndex } from '@teamup/ui/react';

/** Un personnage des explications du jeu, debout : son équipe (jamais 2, le corail) et sa taille. */
export type Perso = { equipe: TeamIndex; grand?: boolean };

/** Autour du pictogramme, au pied des pages de la carte. */
export const PERSOS_GAUCHE: Perso[] = [{ equipe: 3 }, { equipe: 1, grand: true }, { equipe: 4 }];
export const PERSOS_DROITE: Perso[] = [{ equipe: 6 }, { equipe: 8, grand: true }, { equipe: 5 }];
/** Ceux qui attendent qu'une soirée ouvre. */
export const PERSOS_ATTENTE: Perso[] = [{ equipe: 4 }, { equipe: 3, grand: true }, { equipe: 1 }];

export function Personnages({ persos }: { persos: Perso[] }) {
  return persos.map((p, i) => (
    <span
      key={i}
      className={cx('tu-carte-perso', teamModifier(p.equipe), p.grand && 'tu-carte-perso--grand')}
    />
  ));
}

/** La flèche d'un bouton d'action. */
export function Fleche() {
  return (
    <svg className="tu-btn__icone" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
