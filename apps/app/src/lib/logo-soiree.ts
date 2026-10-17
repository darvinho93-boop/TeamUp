/**
 * Le logo d'une soirée : un monogramme (« V | M ») et le titre qu'il devient à l'écran
 * (« Vinoyan & Mélanie »). Rien n'est propre au mariage : « 30 » et « Les 30 ans de Léa »,
 * « TU » et « Séminaire Acme » marchent de la même façon.
 */

export interface LogoSoiree {
  initiales: string[];
  titre: string;
}

export const PARTIES_MAX = 3;
export const PARTIE_MAX = 3;
export const TITRE_MAX = 60;

/** « V | M » → ['V', 'M'] ; `null` si la saisie n'a pas de une à trois parties courtes. */
export function lireMonogramme(saisie: string): string[] | null {
  const parties = saisie
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parties.length < 1 || parties.length > PARTIES_MAX) return null;
  return parties.every((p) => [...p].length <= PARTIE_MAX) ? parties : null;
}

/** ['V', 'M'] → « V | M », pour remplir le champ de la Salle. */
export function ecrireMonogramme(initiales: readonly string[]): string {
  return initiales.join(' | ');
}

/**
 * Un morceau du titre : un mot rattaché à une initiale (`tete` est le début du mot tel qu'il
 * est écrit, `reste` ce qui s'écrit ensuite), ou du texte qui apparaît entre eux (« & »).
 */
export type Segment =
  { type: 'mot'; initiale: string; tete: string; reste: string } | { type: 'texte'; texte: string };

const normal = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr');

/**
 * Le titre découpé pour que chaque initiale se déploie en son mot : « V | M » et « Vinoyan &
 * Mélanie » donnent V + « inoyan », « & », M + « élanie ». Chaque initiale prend, dans l'ordre,
 * le premier mot suivant qui commence par elle (sans tenir compte des accents ni de la casse).
 * `null` si une initiale ne trouve pas son mot : l'écran passe alors du monogramme au titre
 * par un simple fondu.
 */
export function deploiement(initiales: readonly string[], titre: string): Segment[] | null {
  const morceaux = titre.trim().split(/(\s+)/);
  const segments: Segment[] = [];
  let texte = '';
  let rang = 0;
  for (const morceau of morceaux) {
    const initiale = initiales[rang];
    const mot = /\S/.test(morceau);
    if (mot && initiale && normal(morceau).startsWith(normal(initiale))) {
      if (texte) segments.push({ type: 'texte', texte });
      texte = '';
      const coupe = [...morceau];
      const longueur = [...initiale].length;
      segments.push({
        type: 'mot',
        initiale,
        tete: coupe.slice(0, longueur).join(''),
        reste: coupe.slice(longueur).join(''),
      });
      rang += 1;
    } else {
      texte += morceau;
    }
  }
  if (rang < initiales.length) return null;
  if (texte) segments.push({ type: 'texte', texte });
  return segments;
}

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
