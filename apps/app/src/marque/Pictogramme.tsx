import navy from '@teamup/brand/logo/calques/navy.png';
import vert from '@teamup/brand/logo/calques/vert.png';
import corail from '@teamup/brand/logo/calques/corail.png';
import sable from '@teamup/brand/logo/calques/sable.png';
import type { CSSProperties } from 'react';
import { cx } from '@teamup/ui/react';

const CALQUES = [
  { nom: 'navy', image: navy },
  { nom: 'corail', image: corail },
  { nom: 'sable', image: sable },
  { nom: 'vert', image: vert },
] as const;

/**
 * Le pictogramme de Team Up! : quatre personnages, un calque par couleur (ceux du logo, sans
 * retouche). `anime` les fait arriver chacun de son côté pour se rejoindre, comme dans la vidéo
 * « Loading ». Décoratif par défaut : là où il est seul à dire la marque, lui donner un `nom`.
 * `teinte` (2026-11-27, thème d'une soirée) pose sur chaque calque sa silhouette, à peindre d'une
 * autre couleur par la feuille du thème ; invisible tant qu'elle ne la montre pas.
 */
export function Pictogramme({
  taille = 'sm',
  anime = false,
  nom,
  className,
  teinte = false,
}: {
  taille?: 'sm' | 'coin' | 'lg' | 'xl';
  anime?: boolean;
  nom?: string;
  className?: string;
  teinte?: boolean;
}) {
  return (
    <span
      className={cx('tu-picto', `tu-picto--${taille}`, anime && 'tu-picto--anime', className)}
      {...(nom ? { role: 'img', 'aria-label': nom } : { 'aria-hidden': true })}
    >
      {CALQUES.map((calque) => (
        // Calques de 6 Ko, déjà à la bonne taille : l'optimisation d'image n'apporterait rien.
        <img
          key={calque.nom}
          className={`tu-picto__calque tu-picto__calque--${calque.nom}`}
          src={calque.image.src}
          alt=""
          draggable={false}
        />
      ))}
      {teinte &&
        CALQUES.map((calque) => (
          <span
            key={`teinte-${calque.nom}`}
            className={`tu-picto__teinte tu-picto__teinte--${calque.nom}`}
            style={{ '--tu-calque': `url(${calque.image.src})` } as CSSProperties}
          />
        ))}
    </span>
  );
}
