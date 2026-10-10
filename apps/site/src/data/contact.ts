/**
 * Les coordonnées publiques de Team Up! et le délai de rappel promis après une demande de
 * devis, fournis le 2026-10-10. Une seule source : pied de page, devis, confirmation, e-mail
 * d'accusé et pages légales les lisent ici.
 */
export const CONTACT = {
  email: 'contact@teamup-game.fr',
  telephone: '+33 6 36 04 77 03',
  /** Le même numéro, sans espaces, pour un lien `tel:`. */
  telephoneLien: '+33636047703',
  delaiRappel: '48 heures',
} as const;
