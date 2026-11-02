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
        <li key={e.id} className="tu-carte-item">
          <span
            className={cx('tu-carte-item__icone', `tu-carte-item__icone--${e.teinte}`)}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">{e.trace}</svg>
          </span>
          <div>
            <Titre className="tu-carte-item__nom">{e.nom}</Titre>
            <p className="tu-carte-item__texte">{e.texte}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
