/**
 * Messages sur le grand écran (2026-11-15) : un joueur ou la régie écrit, l'écran commun montre
 * une bulle temporaire. Logique pure, sans I/O : le nettoyage du texte (le même qu'en base,
 * `nettoyer_message`) et le planning des bulles.
 *
 * Le planning se calcule à partir de l'heure de la base (`cree_ms`) : deux écrans qui ont la
 * même liste montrent les mêmes bulles, et un rechargement retombe au même endroit.
 */

/** Longueur d'un message, en caractères (un émoji en vaut un, comme dans la base). */
export const MESSAGE_MAX = 100;
/** Entre deux messages d'un même joueur, vérifié par la base. */
export const CADENCE_MESSAGE_S = 20;
/** Bulles à l'écran en même temps, au plus. */
export const BULLES_MAX = 3;
/** Durée d'une bulle à l'écran. */
export const DUREE_BULLE_MS = 8000;
/** Fin de la bulle : elle s'efface. */
export const SORTIE_BULLE_MS = 600;
/** Au-delà, un message en file n'est plus montré : il serait hors de propos. */
export const ATTENTE_BULLE_MAX_MS = 60_000;

/** Un message tel que `etat_ecran` le donne. */
export interface MessageSalle {
  id: string;
  /** Null : la régie (« Team Up! »). */
  prenom: string | null;
  regie: boolean;
  /** Numéro de l'équipe du joueur à l'envoi, pour la couleur ; null sans équipe. */
  equipe: number | null;
  texte: string;
  cree_ms: number;
  /** Régie seulement : l'écran ne reçoit jamais un message retiré. */
  retire?: boolean;
}

export interface Bulle {
  message: MessageSalle;
  debutMs: number;
  finMs: number;
  /** La bulle s'efface (ses dernières `SORTIE_BULLE_MS`). */
  sortie: boolean;
}

const longueur = (texte: string) => Array.from(texte).length;

/** Une ligne, espaces réduits, sans caractère de contrôle ; `null` si vide ou trop long. */
export function nettoyerMessage(texte: string): string | null {
  const propre = texte.replace(/[\p{Cc}\s]+/gu, ' ').trim();
  const n = longueur(propre);
  return n >= 1 && n <= MESSAGE_MAX ? propre : null;
}

/** Caractères restants dans le champ du téléphone (négatif : trop long). */
export function caracteresRestants(texte: string): number {
  return MESSAGE_MAX - longueur(texte.replace(/[\p{Cc}\s]+/gu, ' ').trim());
}

/**
 * Le planning de toutes les bulles : par ordre d'envoi, chaque message prend la première des
 * `BULLES_MAX` places qui se libère, pour `DUREE_BULLE_MS`. Un message qui attendrait plus de
 * `ATTENTE_BULLE_MAX_MS` est abandonné (il ne prend aucune place). Retirés exclus.
 */
export function planDesBulles(messages: readonly MessageSalle[]): Omit<Bulle, 'sortie'>[] {
  const places: number[] = Array.from({ length: BULLES_MAX }, () => -Infinity);
  const plan: Omit<Bulle, 'sortie'>[] = [];
  const tries = messages
    .filter((m) => !m.retire)
    .sort((a, b) => a.cree_ms - b.cree_ms || a.id.localeCompare(b.id));
  for (const message of tries) {
    const libre = Math.min(...places);
    const debutMs = Math.max(message.cree_ms, libre);
    if (debutMs - message.cree_ms > ATTENTE_BULLE_MAX_MS) continue;
    const place = places.indexOf(libre);
    places[place] = debutMs + DUREE_BULLE_MS;
    plan.push({ message, debutMs, finMs: debutMs + DUREE_BULLE_MS });
  }
  return plan;
}

/** Les bulles à l'écran à cet instant (heure de la base), de la plus ancienne à la plus récente. */
export function bullesA(messages: readonly MessageSalle[], maintenantMs: number): Bulle[] {
  return planDesBulles(messages)
    .filter((b) => b.debutMs <= maintenantMs && maintenantMs < b.finMs)
    .map((b) => ({ ...b, sortie: maintenantMs >= b.finMs - SORTIE_BULLE_MS }));
}

/** Une bulle est à l'écran ou en file : l'écran doit continuer de se redessiner. */
export function bullesEnCours(messages: readonly MessageSalle[], maintenantMs: number): boolean {
  return planDesBulles(messages).some((b) => maintenantMs < b.finMs);
}

/** Le temps à attendre, lu dans le refus de la base (« trop tôt:12 »), en secondes. */
export function attenteDuRefus(message: string): number | null {
  const n = /trop tôt:(\d+)/.exec(message)?.[1];
  return n ? Number(n) : null;
}
