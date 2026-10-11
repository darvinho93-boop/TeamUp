/**
 * Les coordonnées publiques de Team Up! et le délai de rappel promis après une demande de
 * devis, fournis le 2026-10-10 ; Instagram, WhatsApp et la zone d'intervention le 2026-10-11.
 * Une seule source : pied de page, menu, devis, confirmation, e-mail d'accusé, pages légales
 * et données structurées les lisent ici.
 */
export const CONTACT = {
  email: 'contact@teamup-game.fr',
  telephone: '+33 6 36 04 77 03',
  /** Le même numéro, sans espaces, pour un lien `tel:`. */
  telephoneLien: '+33636047703',
  delaiRappel: '48 heures',
  /** Écrire sur WhatsApp : le même numéro, au format attendu par wa.me. */
  whatsapp: 'https://wa.me/33636047703',
  instagram: 'https://www.instagram.com/teamup_officiel',
  instagramNom: '@teamup_officiel',
  /** Où Team Up! se déplace ; le déplacement se chiffre dans le devis. */
  zone: 'partout en France',
} as const;
