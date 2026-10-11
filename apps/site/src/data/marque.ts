/**
 * Le nom et le slogan de la marque, tels que la vitrine les annonce aux moteurs de recherche.
 * Le slogan est aussi écrit dans l'image d'aperçu des liens (`scripts/apercu-partage.mjs`, qui
 * ne peut pas lire ce fichier) : les changer ensemble.
 */
export const MARQUE = {
  nom: 'Team Up!',
  slogan: 'On joue. On se rencontre. On crée du lien.',
  /** Ce que vend la marque, dans les mots que les gens cherchent. */
  service: 'Animation de soirée',
} as const;

/** Sérialise des données structurées pour une balise `<script type="application/ld+json">`. */
export const enJsonLd = (donnees: unknown) => JSON.stringify(donnees).replace(/</g, '\\u003c');
