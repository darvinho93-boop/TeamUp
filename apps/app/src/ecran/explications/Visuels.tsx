import type { ReactNode } from 'react';
import { cx, teamModifier } from '@teamup/ui/react';
import type { VisuelExplication } from '@teamup/game';

/**
 * Le décor de chaque carte d'explication (lot 12) : silhouettes, écran, quadrants,
 * téléphone, gobelet… Aucun texte à traduire ici, seulement des lettres de réponse et des
 * nombres ; la phrase de la carte porte le sens. Équipes 1, 3, 4 et 6 : jamais le corail.
 */

const EQUIPES = [1, 3, 4, 6] as const;

function Perso({
  equipe,
  className,
}: {
  equipe?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cx('tu-expl-perso', equipe !== undefined && teamModifier(equipe), className)}
    />
  );
}

/** Une rangée d'invités, de couleurs d'équipes mêlées. */
function Salle({ n, debout = [] }: { n: number; debout?: number[] }) {
  return (
    <div className="tu-expl-groupe">
      {Array.from({ length: n }, (_, i) =>
        debout.includes(i) ? (
          <Perso key={i} equipe={EQUIPES[i % EQUIPES.length]} className="tu-expl-se-leve" />
        ) : (
          <Perso key={i} className="tu-expl-perso--assis tu-expl-perso--eteint" />
        ),
      )}
    </div>
  );
}

/** Une équipe en file : `n` silhouettes de la même couleur. */
function Equipe({ n, equipe = 1, className }: { n: number; equipe?: number; className?: string }) {
  return (
    <div className={cx('tu-expl-groupe', className)}>
      {Array.from({ length: n }, (_, i) => (
        <Perso key={i} equipe={equipe} />
      ))}
    </div>
  );
}

const LETTRES = ['A', 'B', 'C', 'D'] as const;

function Quadrants({
  bonne,
  joueurs = false,
}: {
  /** Index de la bonne réponse, une fois révélée. */
  bonne?: number;
  /** Des invités placés dans les zones. */
  joueurs?: boolean;
}) {
  return (
    <ul className="tu-expl-quadrants">
      {LETTRES.map((lettre, i) => (
        <li
          key={lettre}
          className={cx(
            'tu-expl-quadrants__zone',
            bonne !== undefined &&
              (i === bonne ? 'tu-expl-quadrants__zone--bonne' : 'tu-expl-quadrants__zone--fausse'),
          )}
        >
          {lettre}
          {joueurs && (
            <span className="tu-expl-groupe tu-expl-suite">
              <Perso equipe={EQUIPES[i]} />
              <Perso equipe={EQUIPES[(i + 1) % EQUIPES.length]} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Telephone({ children }: { children: ReactNode }) {
  return <div className="tu-expl-telephone">{children}</div>;
}

function Photo({ equipe, className }: { equipe: number; className?: string }) {
  return <span className={cx('tu-expl-photo', teamModifier(equipe), className)} />;
}

function Duellistes({ milieu }: { milieu: ReactNode }) {
  return (
    <>
      <Perso equipe={1} className="tu-expl-perso--grand" />
      {milieu}
      <Perso equipe={3} className="tu-expl-perso--grand" />
    </>
  );
}

function Table({ elu = false }: { elu?: boolean }) {
  return (
    <div className="tu-expl-table">
      <span className={cx('tu-expl-objet', teamModifier(4))} />
      <span
        className={cx(
          'tu-expl-objet tu-expl-objet--rond',
          teamModifier(6),
          elu && 'tu-expl-objet--elu tu-expl-pulse',
        )}
      />
      <span className={cx('tu-expl-objet', teamModifier(3))} />
    </div>
  );
}

const VISUELS: Record<VisuelExplication, () => ReactNode> = {
  // ---- Points communs
  'equipe-dos': () => (
    <>
      <div className="tu-expl-ecran">?</div>
      <Equipe n={4} className="tu-expl-suite" />
    </>
  ),
  'ecran-cache': () => (
    <>
      <div className="tu-expl-ecran">
        <span className="tu-expl-ecran__rideau" />
      </div>
      <Salle n={6} />
    </>
  ),
  'salle-debout': () => (
    <>
      <Equipe n={3} />
      <Salle n={7} debout={[1, 3, 4]} />
    </>
  ),
  paliers: () => (
    <div className="tu-expl-paliers tu-expl-suite">
      {['×3', '×2', '×1'].map((m) => (
        <div key={m} className="tu-expl-paliers__palier">
          {m}
          <span className="tu-expl-paliers__barre" />
        </div>
      ))}
    </div>
  ),

  // ---- Quiz
  quadrants: () => <Quadrants />,
  zones: () => <Quadrants joueurs />,
  telephone: () => (
    <Telephone>
      {LETTRES.map((l, i) => (
        <span
          key={l}
          className={cx(
            'tu-expl-telephone__touche',
            i === 2 && 'tu-expl-telephone__touche--choisie tu-expl-pulse',
          )}
        >
          {l}
        </span>
      ))}
    </Telephone>
  ),
  elimine: () => <Quadrants joueurs bonne={2} />,
  survivants: () => (
    <>
      <Equipe n={3} equipe={3} className="tu-expl-suite" />
      <span className="tu-expl-points">×100</span>
    </>
  ),

  // ---- Surenchère
  champions: () => (
    <div className="tu-expl-groupe tu-expl-suite">
      {EQUIPES.map((e) => (
        <Perso key={e} equipe={e} className="tu-expl-perso--grand" />
      ))}
    </div>
  ),
  encheres: () => (
    <>
      <Perso equipe={1} className="tu-expl-perso--grand" />
      <div className="tu-expl-groupe tu-expl-suite">
        <span className="tu-expl-bulle">5 !</span>
        <span className="tu-expl-bulle">7 !</span>
        <span className="tu-expl-bulle">9 !</span>
      </div>
      <Perso equipe={4} className="tu-expl-perso--grand" />
    </>
  ),
  chrono: () => (
    <>
      <Perso equipe={4} className="tu-expl-perso--grand tu-expl-mime" />
      <span className="tu-expl-anneau" />
    </>
  ),
  verdict: () => (
    <div className="tu-expl-groupe tu-expl-suite">
      <span className="tu-expl-points">+100</span>
      <span className="tu-expl-points tu-expl-points--discret">+20</span>
    </div>
  ),

  // ---- Mime
  file: () => <Equipe n={5} equipe={6} className="tu-expl-suite" />,
  mot: () => (
    <>
      <span className="tu-expl-bulle">• • •</span>
      <Perso equipe={6} className="tu-expl-perso--grand tu-expl-mime" />
      <span className="tu-expl-fleche">→</span>
      <Perso equipe={6} className="tu-expl-perso--grand" />
    </>
  ),
  chaine: () => (
    <div className="tu-expl-groupe tu-expl-suite">
      <Perso equipe={6} className="tu-expl-mime" />
      <span className="tu-expl-fleche">→</span>
      <Perso equipe={6} />
      <span className="tu-expl-fleche tu-expl-fleche--pointillee">⇢</span>
      <Perso equipe={6} className="tu-expl-mime" />
      <span className="tu-expl-fleche">→</span>
    </div>
  ),
  annonce: () => (
    <>
      <Equipe n={4} equipe={6} />
      <span className="tu-expl-bulle tu-expl-pulse">!</span>
      <span className="tu-expl-points">+100</span>
    </>
  ),

  // ---- Photo challenge
  capitaine: () => (
    <>
      <Perso equipe={4} className="tu-expl-perso--grand" />
      <Telephone>
        <span className="tu-expl-telephone__photo tu-expl-pulse" />
      </Telephone>
    </>
  ),
  diaporama: () => (
    <div className="tu-expl-groupe tu-expl-suite">
      {EQUIPES.map((e) => (
        <Photo key={e} equipe={e} />
      ))}
    </div>
  ),
  gagnante: () => (
    <div className="tu-expl-groupe">
      {EQUIPES.map((e) => (
        <Photo
          key={e}
          equipe={e}
          className={e === 3 ? 'tu-expl-photo--gagnante' : 'tu-expl-photo--eteinte'}
        />
      ))}
    </div>
  ),
  'points-photo': () => (
    <>
      <Photo equipe={3} className="tu-expl-photo--gagnante" />
      <span className="tu-expl-points">+100</span>
    </>
  ),

  // ---- Duels
  'duellistes-table': () => <Duellistes milieu={<Table />} />,
  musique: () => <Duellistes milieu={<span className="tu-expl-notes tu-expl-pulse">♪ ♫ ♪</span>} />,
  attrape: () => <Duellistes milieu={<Table elu />} />,
  'duellistes-gobelet': () => <Duellistes milieu={<span className="tu-expl-gobelet" />} />,
  'tete-epaule': () => (
    <>
      <span className="tu-expl-repere">
        <Perso equipe={1} className="tu-expl-perso--grand" />
        <span className="tu-expl-repere__point tu-expl-repere__point--tete" />
        <span className="tu-expl-repere__point tu-expl-repere__point--epaule" />
      </span>
      <span className="tu-expl-gobelet" />
      <span className="tu-expl-repere">
        <Perso equipe={3} className="tu-expl-perso--grand" />
        <span className="tu-expl-repere__point tu-expl-repere__point--tete" />
        <span className="tu-expl-repere__point tu-expl-repere__point--epaule" />
      </span>
    </>
  ),
  gobelet: () => (
    <Duellistes milieu={<span className="tu-expl-gobelet tu-expl-gobelet--saute" />} />
  ),
  'points-duel': () => (
    <>
      <Perso equipe={1} className="tu-expl-perso--grand" />
      <span className="tu-expl-points">+50</span>
    </>
  ),
};

export function VisuelCarte({ visuel }: { visuel: VisuelExplication }) {
  return (
    <div className="tu-expl-visuel" aria-hidden="true" data-visuel={visuel}>
      {VISUELS[visuel]()}
    </div>
  );
}
