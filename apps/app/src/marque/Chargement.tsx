import { Wordmark } from '@teamup/ui/react';
import { Pictogramme } from './Pictogramme';

/**
 * Écran de chargement : les quatre personnages se rejoignent, puis le nom et une barre. Le mot
 * reste « Loading… » dans toutes les langues (décision du 2026-10-09), comme dans la vidéo.
 * La barre va et vient : rien ici ne mesure une progression réelle.
 */
export function Chargement() {
  return (
    <div className="tu-chargement" role="status">
      <Pictogramme taille="xl" anime />
      <Wordmark className="tu-chargement__nom" />
      <p className="tu-chargement__texte">Loading…</p>
      <span className="tu-chargement__barre" aria-hidden="true">
        <span className="tu-chargement__curseur" />
      </span>
    </div>
  );
}
