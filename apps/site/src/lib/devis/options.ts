/**
 * Choix proposés par le formulaire de devis. La page et la validation serveur lisent
 * les mêmes listes : une valeur absente d'ici est refusée.
 */

export const TYPES = ['particulier', 'entreprise'] as const;
export type TypeClient = (typeof TYPES)[number];

export const TYPE_LABELS: Record<TypeClient, string> = {
  particulier: 'Un particulier',
  entreprise: 'Une entreprise',
};

export const OCCASIONS: Record<TypeClient, readonly string[]> = {
  particulier: ['Anniversaire', 'Mariage', 'Anniversaire de mariage', 'Fête de famille', 'Autre'],
  entreprise: ['Team building', 'Séminaire', 'Intégration', 'Autre'],
};

export const CRENEAUX = [
  'Je ne sais pas encore',
  '40 minutes',
  '60 minutes',
  'Plus de 60 minutes',
] as const;

export const LANGUES = [
  { id: 'fr', label: 'Français', lang: 'fr' },
  { id: 'ta', label: 'தமிழ்', lang: 'ta' },
  { id: 'en', label: 'English', lang: 'en' },
  { id: 'autre', label: 'Autre', lang: 'fr' },
] as const;

export const EQUIPEMENTS = [
  { id: 'video', label: 'Vidéoprojecteur ou écran' },
  { id: 'sono', label: 'Sono et micro' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'nsp', label: 'Je ne sais pas' },
] as const;

/** Lit `?type=` : tout ce qui n'est pas « entreprise » retombe sur « particulier ». */
export function typeDepuis(valeur: string | null | undefined): TypeClient {
  return valeur === 'entreprise' ? 'entreprise' : 'particulier';
}
