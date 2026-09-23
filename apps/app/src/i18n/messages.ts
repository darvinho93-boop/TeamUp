import type { Langue } from '@/lib/partie';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ta from '../../messages/ta.json';

/** Les messages des trois langues : le serveur en prend un, l'écran commun celui de la salle. */
export const MESSAGES = { fr, en, ta } satisfies Record<Langue, typeof fr>;
