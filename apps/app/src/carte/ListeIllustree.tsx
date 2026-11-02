import type { ReactNode } from 'react';
import { cx } from '@teamup/ui/react';

/** Les teintes des pictogrammes, celles de la page Les jeux de la vitrine. */
export type Teinte = 'navy' | 'sage' | 'ambre' | 'menthe' | 'pierre';

export type ElementIllustre = {
  id: string;
  teinte: Teinte;
  /** Le tracé du pictogramme, au trait, dans une boîte de 24 × 24. */
  trace: ReactNode;
  nom: string;
  texte: string;
  /** Facultative : une action sur la carte entière (voir la vidéo d'un jeu). */
  action?: { libelle: string; detail?: string; surClic: () => void };
};

/**
 * Une liste de cartes des pages de la carte Team Up! : un pictogramme sur sa teinte, un nom, une
 * phrase. Les jeux (`Jeux.tsx`) et ce qui attend l'invité (`Soirees.tsx`) ont ainsi la même forme.
 */
export function ListeIllustree({
  elements,
  niveau: Titre = 'h2',
}: {
  elements: ElementIllustre[];
  /** Le niveau du nom : h2 sous le titre de la page, h3 sous un intertitre. */
  niveau?: 'h2' | 'h3';
}) {
  return (
    <ul className="tu-carte-items">
      {elements.map((e) => (
        <li key={e.id} className={cx('tu-carte-item', e.action && 'tu-carte-item--action')}>
          <span
            className={cx('tu-carte-item__icone', `tu-carte-item__icone--${e.teinte}`)}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">{e.trace}</svg>
          </span>
          <div>
            <Titre className="tu-carte-item__nom">{e.nom}</Titre>
            <p className="tu-carte-item__texte">{e.texte}</p>
            {e.action && (
              // Toute la carte répond au doigt (::after du bouton) : une grande cible, sans
              // bouton de plus sous chaque jeu.
              <button type="button" className="tu-carte-item__action" onClick={e.action.surClic}>
                <span className="tu-carte-item__lecture" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
                {e.action.libelle}
                <span className="tu-visually-hidden"> : {e.nom}</span>
                {e.action.detail && (
                  <span className="tu-carte-item__detail">({e.action.detail})</span>
                )}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
