/**
 * Les paroles du karaoké (2026-11-23), règles pures : lire ce que l'admin colle (texte brut ou
 * fichier `.lrc`), dire si c'est prêt à enregistrer, et ce que l'écran montre à un instant donné.
 * Mêmes limites que `paroles_bien_formees` en base. Depuis le 2026-11-26, une ligne peut porter
 * sa version en lettres latines (`latin`), affichée dessous : collée à part, ligne pour ligne.
 */

export const PAROLES_MAX_LIGNES = 400;
export const LIGNE_MAX = 120;
/** Une ligne ne se remplit pas plus lentement : au-delà, c'est un pont musical. */
export const DUREE_LIGNE_MAX_MS = 8000;
/** La dernière ligne n'a pas de suivante pour dire quand elle finit. */
export const DUREE_DERNIERE_LIGNE_MS = 4000;

export interface LigneParoles {
  t_ms: number;
  texte: string;
  /** La même ligne en lettres latines, sous l'écriture tamoule. */
  latin?: string | undefined;
}

/** Une ligne en cours de calage : pas encore d'instant tant qu'on n'a pas tapé dessus. */
export interface LigneBrouillon {
  t_ms: number | null;
  texte: string;
  latin?: string | undefined;
}

/** `latin` : la version en lettres latines n'a pas autant de lignes que les paroles. */
export type RefusParoles = 'vide' | 'longue' | 'trop' | 'latin';

const HORODATAGES = /^(?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*)+/;
const HORODATAGE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
/** Les en-têtes d'un `.lrc` : `[ar:Artiste]`, `[ti:Titre]`, `[offset:0]`… */
const EN_TETE = /^\[[a-z]+:.*\]$/i;

/** Les lignes d'un texte brut (sans instants) ou d'un `.lrc` (rangé par instant). */
function lireLignes(brut: string): LigneBrouillon[] {
  const lignes: LigneBrouillon[] = [];
  for (const ligne of brut.split(/\r?\n/)) {
    const propre = ligne.trim();
    if (!propre) continue;
    const marques = HORODATAGES.exec(propre)?.[0];
    if (marques) {
      const texte = propre.slice(marques.length).trim();
      // Une marque sans texte : un passage instrumental dans un `.lrc`.
      if (!texte) continue;
      // Un refrain peut porter plusieurs instants sur une seule ligne.
      for (const [, min, sec, fraction = ''] of marques.matchAll(HORODATAGE)) {
        const ms = Number(fraction.padEnd(3, '0'));
        lignes.push({ t_ms: Number(min) * 60_000 + Number(sec) * 1000 + ms, texte });
      }
      continue;
    }
    if (EN_TETE.test(propre)) continue;
    lignes.push({ t_ms: null, texte: propre });
  }
  if (lignes.every((l) => l.t_ms !== null)) {
    lignes.sort((a, b) => a.t_ms! - b.t_ms!);
  }
  return lignes;
}

/**
 * Lit les paroles (texte brut, une ligne par ligne chantée, ou `.lrc` déjà calé) et, à part,
 * leur version en lettres latines, rangée ligne pour ligne sous elles. Les instants viennent des
 * paroles ; à défaut, de la version latine (un `.lrc` en lettres latines sous un texte tamoul).
 */
export function lireParoles(
  brut: string,
  brutLatin = '',
): {
  lignes: LigneBrouillon[];
  refus: RefusParoles | null;
  /** Les lignes de la version latine, pour dire l'écart quand elles ne tombent pas juste. */
  latines: number;
} {
  const lus = lireLignes(brut);
  const latines = lireLignes(brutLatin);
  const lignes =
    latines.length > 0 && latines.length === lus.length
      ? lus.map((l, i) => ({
          t_ms: l.t_ms ?? latines[i]!.t_ms,
          texte: l.texte,
          latin: latines[i]!.texte,
        }))
      : lus;
  const refus: RefusParoles | null =
    lignes.length === 0
      ? 'vide'
      : lignes.length > PAROLES_MAX_LIGNES
        ? 'trop'
        : latines.length > 0 && latines.length !== lus.length
          ? 'latin'
          : lignes.some((l) => l.texte.length > LIGNE_MAX || (l.latin?.length ?? 0) > LIGNE_MAX)
            ? 'longue'
            : null;
  return { lignes, refus, latines: latines.length };
}

/**
 * Relire des paroles sans instants ne perd pas le calage déjà fait : une ligne restée la même, à
 * la même place, garde son instant (pour ajouter la version latine après coup, par exemple).
 */
export function garderInstants(
  nouvelles: readonly LigneBrouillon[],
  anciennes: readonly LigneBrouillon[],
): LigneBrouillon[] {
  if (nouvelles.length !== anciennes.length) return [...nouvelles];
  return nouvelles.map((l, i) =>
    l.t_ms === null && anciennes[i]!.texte === l.texte ? { ...l, t_ms: anciennes[i]!.t_ms } : l,
  );
}

/** Les lignes prêtes à enregistrer, ou `null` : une ligne sans instant, ou deux dans le désordre. */
export function parolesPretes(lignes: readonly LigneBrouillon[]): LigneParoles[] | null {
  if (lignes.length === 0 || lignes.length > PAROLES_MAX_LIGNES) return null;
  const pretes: LigneParoles[] = [];
  let avant = -1;
  for (const { t_ms, texte, latin } of lignes) {
    if (t_ms === null || !Number.isInteger(t_ms) || t_ms <= avant) return null;
    if (!texte.trim() || texte.length > LIGNE_MAX) return null;
    const enLatin = latin?.trim();
    if (enLatin && enLatin.length > LIGNE_MAX) return null;
    pretes.push(enLatin ? { t_ms, texte, latin: enLatin } : { t_ms, texte });
    avant = t_ms;
  }
  return pretes;
}

const deux = (n: number) => String(n).padStart(2, '0');

/** Un instant lisible et réutilisable dans un `.lrc` : `01:23.450`. */
export function horodatage(tMs: number): string {
  const ms = Math.max(0, Math.round(tMs));
  const reste = ms % 60_000;
  return `${deux(Math.floor(ms / 60_000))}:${deux(Math.floor(reste / 1000))}.${String(
    reste % 1000,
  ).padStart(3, '0')}`;
}

/** Le texte à remettre dans le champ : relu par `lireParoles`, il redonne les mêmes lignes. */
export function versLrc(lignes: readonly LigneBrouillon[]): string {
  return lignes
    .map((l) => (l.t_ms === null ? l.texte : `[${horodatage(l.t_ms)}] ${l.texte}`))
    .join('\n');
}

/** La version latine à remettre dans son champ : rien tant qu'une ligne n'en a pas. */
export function versLatin(lignes: readonly LigneBrouillon[]): string {
  return lignes.length > 0 && lignes.every((l) => l.latin)
    ? lignes.map((l) => l.latin).join('\n')
    : '';
}

/** Les paroles lues en base, sans confiance : rien d'utilisable donne une liste vide. */
export function parolesDe(brut: unknown): LigneParoles[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((l: unknown) => {
    const ligne = l as { t_ms?: unknown; texte?: unknown; latin?: unknown } | null;
    if (typeof ligne?.t_ms !== 'number' || typeof ligne.texte !== 'string') return [];
    return [
      typeof ligne.latin === 'string' && ligne.latin.trim()
        ? { t_ms: ligne.t_ms, texte: ligne.texte, latin: ligne.latin }
        : { t_ms: ligne.t_ms, texte: ligne.texte },
    ];
  });
}

export interface VueKaraoke {
  /** La ligne chantée (son rang), -1 avant la première. */
  index: number;
  precedente: string | null;
  courante: string | null;
  suivante: string | null;
  /** Où en est le remplissage de la ligne chantée, de 0 à 1. */
  avancement: number;
}

/** Ce que l'écran montre quand la chanson en est à `positionMs`. */
export function vueKaraoke(lignes: readonly LigneParoles[], positionMs: number): VueKaraoke {
  let bas = 0;
  let haut = lignes.length - 1;
  let index = -1;
  while (bas <= haut) {
    const milieu = (bas + haut) >> 1;
    if (lignes[milieu]!.t_ms <= positionMs) {
      index = milieu;
      bas = milieu + 1;
    } else {
      haut = milieu - 1;
    }
  }
  const courante = index >= 0 ? lignes[index]! : null;
  const suivante = lignes[index + 1] ?? null;
  const duree = courante
    ? suivante
      ? Math.min(suivante.t_ms - courante.t_ms, DUREE_LIGNE_MAX_MS)
      : DUREE_DERNIERE_LIGNE_MS
    : 1;
  return {
    index,
    precedente: index > 0 ? lignes[index - 1]!.texte : null,
    courante: courante?.texte ?? null,
    suivante: suivante?.texte ?? null,
    avancement: courante ? Math.min(1, Math.max(0, (positionMs - courante.t_ms) / duree)) : 0,
  };
}

/** Une ligne en écriture tamoule : elle a besoin de sa police, et prend plus de place. */
export const contientTamoul = (texte: string) => /[஀-௿]/.test(texte);

/** Au-delà, une ligne passe sur deux rangées : elle resterait sinon trop petite pour la salle. */
export const RANGEE_MAX = 34;
export const RANGEE_MAX_TAMOUL = 26;

export interface Rangee {
  texte: string;
  /** La part de la ligne chantée avant cette rangée, et la sienne (de 0 à 1). */
  debut: number;
  part: number;
}

/** Une ligne en une ou deux rangées, coupée à l'espace le plus proche du milieu. */
export function rangees(texte: string): Rangee[] {
  const seule: Rangee[] = [{ texte, debut: 0, part: 1 }];
  if (texte.length <= (contientTamoul(texte) ? RANGEE_MAX_TAMOUL : RANGEE_MAX)) return seule;
  const milieu = texte.length / 2;
  let coupe = -1;
  for (let i = 1; i < texte.length - 1; i++) {
    if (texte[i] === ' ' && (coupe < 0 || Math.abs(i - milieu) < Math.abs(coupe - milieu))) {
      coupe = i;
    }
  }
  if (coupe < 0) return seule;
  const a = texte.slice(0, coupe).trimEnd();
  const b = texte.slice(coupe + 1).trimStart();
  const total = a.length + b.length;
  return [
    { texte: a, debut: 0, part: a.length / total },
    { texte: b, debut: a.length / total, part: b.length / total },
  ];
}
