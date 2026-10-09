import { Chargement } from '@/marque/Chargement';

/**
 * Affiché pendant qu'une page de la soirée arrive (Préparation, Salle, Pilotage…). Placé sous le
 * gabarit de l'événement, pas plus haut : c'est lui qui vérifie l'accès, et un écran de
 * chargement posé au-dessus ferait partir la réponse (200) avant son verdict (404).
 */
export default function Loading() {
  return <Chargement />;
}
