/**
 * Valeurs de la charte, recopiées de `design/brand/tokens.css` : la vidéo est rendue hors du
 * site, sans feuille de style partagée. Si un token change là-bas, le reporter ici.
 */
export const couleurs = {
  navy900: '#071A38',
  navy700: '#0F2D5B',
  navy500: '#1F4B8F',
  navy200: '#C3D2E8',
  sage500: '#65C3A6',
  sage200: '#C4E8DB',
  corail: '#FF8A7A',
  ambre: '#E0A100',
  creme: '#FAF7F2',
  pierre: '#EAE3D7',
  texteDoux: '#5C6B85',
  texteDouxScene: '#A9BCD9',
  blanc: '#FFFFFF',
} as const;

export const polices = {
  titre: '"Poppins", "Segoe UI", system-ui, sans-serif',
  texte: '"Inter", system-ui, "Segoe UI", sans-serif',
} as const;

/** Format vertical des réseaux sociaux. */
export const FORMAT = { largeur: 1080, hauteur: 1920, ips: 30 } as const;
