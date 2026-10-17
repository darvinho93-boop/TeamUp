/**
 * La révélation, à l'écran commun, quand la scène passe de l'ouverture à l'accueil (ms) :
 * les ronds forment le logo Team Up!, le fond passe au marine, le monogramme paraît, se déploie
 * en titre, puis se pose dans le bandeau de la page du QR code. `fin` est égal au token
 * `--tu-dur-revelation` (testé).
 */
export const REVELATION = {
  ronds: 0,
  fond: 2200,
  monogramme: 2800,
  // Sur la cymbale du roulement de tambour (à 5 s dans le son, cf. scripts/sons-elevenlabs.mjs).
  deploiement: 5000,
  pose: 7400,
  fin: 8800,
} as const;

export const REVELATION_MS = REVELATION.fin;
