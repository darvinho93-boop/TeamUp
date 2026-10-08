import navy from '@teamup/brand/logo/calques/navy.png';
import vert from '@teamup/brand/logo/calques/vert.png';
import corail from '@teamup/brand/logo/calques/corail.png';
import sable from '@teamup/brand/logo/calques/sable.png';
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
 */
export function Pictogramme({
  taille = 'sm',
  anime = false,
  nom,
  className,
}: {
  taille?: 'sm' | 'coin' | 'lg' | 'xl';
  anime?: boolean;
  nom?: string;
  className?: string;
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
    </span>
  );
}
