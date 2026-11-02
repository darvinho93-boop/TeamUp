import { cx, teamModifier, type TeamIndex } from '@teamup/ui/react';

/** Un personnage des explications du jeu, debout : son équipe (jamais 2, le corail) et sa taille. */
export type Perso = { equipe: TeamIndex; grand?: boolean };

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
