import { Chargement } from '@/marque/Chargement';

/**
 * Affiché pendant qu'une page du back-office arrive. Le gabarit du back-office, au-dessus, garde
 * son 404 pour qui n'est pas admin.
 */
export default function Loading() {
  return <Chargement />;
}
