/**
 * Pilotage du Blind test (2026-11-15), un titre par passage :
 *
 *   pret ──lancer──▶ ecoute ──buzz──▶ buzz ──bonne──▶ revele
 *                      ▲                │
 *                      └──relancer── pause ◀──mauvaise
 *   ecoute, pause ──reveler──▶ revele
 *
 * `ecoute` : la musique joue sur l'écran commun, le chrono de la salle montre ce qui reste de
 * l'extrait ; tant qu'il court, le capitaine d'une équipe qui a encore la main peut buzzer (côté
 * base, `buzzer_blind`, qui fait la même transition) ; la régie peut buzzer pour une équipe dont
 * le téléphone a lâché. `buzz` : la musique s'arrête, l'équipe a 7 s pour répondre à voix haute,
 * la régie juge. Une mauvaise réponse bloque l'équipe sur ce titre, et la musique ne reprend que
 * quand la régie la relance, là où elle s'était arrêtée.
 */

import type { Chrono } from './transition';

export type EtapeBlind = 'pret' | 'ecoute' | 'buzz' | 'pause' | 'revele';

/** Un titre trouvé : le barème du Mime et des survivants du quiz. */
export const POINTS_BLIND = 100;
/** Le temps de réponse de l'équipe qui a buzzé, à voix haute. */
export const REPONSE_BLIND_S = 7;
/** Durée d'écoute d'un titre, réglable à la préparation. */
export const EXTRAIT_BLIND_DEFAUT_S = 30;
export const EXTRAIT_BLIND_MIN_S = 10;
export const EXTRAIT_BLIND_MAX_S = 90;
/** Nombre de titres d'une manche, choisi à la préparation. */
export const TITRES_BLIND_MIN = 3;
export const TITRES_BLIND_MAX = 20;
export const TITRES_BLIND_DEFAUT = 8;

export type ActionBlind =
  | { type: 'lancer' }
  | { type: 'buzz'; equipe: number }
  | { type: 'bonne' }
  | { type: 'mauvaise' }
  | { type: 'relancer' }
  | { type: 'reveler' };

/** Ce qu'un titre garde de son déroulé (le résultat du passage). */
export interface ResultatBlind {
  /** L'écoute déjà faite, chrono arrêté : la musique reprend de là. */
  ecouteMs: number;
  /** Les équipes (numéros) qui ont mal répondu sur ce titre : elles ne buzzent plus. */
  bloquees: number[];
  /** L'équipe qui a la main, pendant `buzz`. */
  buzz: number | null;
  /** L'équipe qui a trouvé, une fois révélé. */
  trouvePar: number | null;
}

export const RESULTAT_BLIND_VIDE: ResultatBlind = {
  ecouteMs: 0,
  bloquees: [],
  buzz: null,
  trouvePar: null,
};

export interface EtatBlind {
  etape: EtapeBlind;
  resultat: ResultatBlind;
  extraitS: number;
  /** Les équipes en jeu (numéros), celles qui ont des joueurs. */
  equipes: readonly number[];
  /** Le temps écoulé sur le chrono de la salle au moment de l'appui. */
  ecouleMs: number;
}

export interface TransitionBlind {
  etape: EtapeBlind;
  chrono: Chrono;
  resultat: ResultatBlind;
  /** Les points donnés par cette touche, par numéro d'équipe. */
  points?: Record<number, number>;
}

/** Ce qui reste de l'extrait à écouter, en ms. */
export function resteExtraitMs(extraitS: number, ecouteMs: number): number {
  return Math.max(0, extraitS * 1000 - ecouteMs);
}

/** L'écoute faite à l'instant de l'appui : ce qui était fait, plus le chrono en cours. */
function ecouteA(etat: EtatBlind): number {
  if (etat.etape !== 'ecoute') return etat.resultat.ecouteMs;
  const reste = resteExtraitMs(etat.extraitS, etat.resultat.ecouteMs);
  return etat.resultat.ecouteMs + Math.min(Math.max(0, etat.ecouleMs), reste);
}

/** Une équipe peut-elle buzzer sur ce titre ? Elle est en jeu et n'a pas déjà mal répondu. */
export function peutBuzzer(etat: Pick<EtatBlind, 'resultat' | 'equipes'>, equipe: number): boolean {
  return etat.equipes.includes(equipe) && !etat.resultat.bloquees.includes(equipe);
}

export function actionsBlind(etat: EtatBlind): ActionBlind['type'][] {
  switch (etat.etape) {
    case 'pret':
      return ['lancer'];
    case 'ecoute': {
      const ouvert = ecouteA(etat) < etat.extraitS * 1000;
      return ouvert ? ['buzz', 'reveler'] : ['reveler'];
    }
    case 'buzz':
      return ['bonne', 'mauvaise'];
    case 'pause': {
      const reste = resteExtraitMs(etat.extraitS, etat.resultat.ecouteMs) > 0;
      const quelquUn = etat.equipes.some((e) => peutBuzzer(etat, e));
      return reste && quelquUn ? ['relancer', 'reveler'] : ['reveler'];
    }
    case 'revele':
      return [];
  }
}

/** La durée du chrono d'écoute : ce qui reste de l'extrait, en secondes entières (1 au moins). */
const chronoEcoute = (extraitS: number, ecouteMs: number): Chrono => ({
  demarrer: Math.max(1, Math.ceil(resteExtraitMs(extraitS, ecouteMs) / 1000)),
});

export function appliquerBlind(etat: EtatBlind, action: ActionBlind): TransitionBlind {
  if (!actionsBlind(etat).includes(action.type)) {
    throw new Error(`Blind test : « ${action.type} » impossible à l'étape « ${etat.etape} ».`);
  }
  const r = etat.resultat;
  switch (action.type) {
    case 'lancer':
    case 'relancer':
      return {
        etape: 'ecoute',
        chrono: chronoEcoute(etat.extraitS, r.ecouteMs),
        resultat: { ...r, buzz: null },
      };
    case 'buzz':
      if (!peutBuzzer(etat, action.equipe)) {
        throw new Error(`Blind test : l'équipe ${action.equipe} n'a plus la main.`);
      }
      return {
        etape: 'buzz',
        chrono: { demarrer: REPONSE_BLIND_S },
        resultat: { ...r, ecouteMs: ecouteA(etat), buzz: action.equipe },
      };
    case 'bonne':
      return {
        etape: 'revele',
        chrono: 'arreter',
        resultat: { ...r, buzz: null, trouvePar: r.buzz },
        points: r.buzz === null ? {} : { [r.buzz]: POINTS_BLIND },
      };
    case 'mauvaise':
      return {
        etape: 'pause',
        chrono: 'arreter',
        resultat: {
          ...r,
          buzz: null,
          bloquees:
            r.buzz === null || r.bloquees.includes(r.buzz) ? r.bloquees : [...r.bloquees, r.buzz],
        },
      };
    case 'reveler':
      return {
        etape: 'revele',
        chrono: 'arreter',
        resultat: { ...r, ecouteMs: ecouteA(etat), buzz: null, trouvePar: null },
      };
  }
}

/**
 * Où en est l'extrait, en ms depuis le début du fichier : le début choisi à la préparation, plus
 * l'écoute déjà faite, plus celle en cours. Deux écrans, ou un écran rechargé, reprennent ainsi à
 * la même seconde.
 */
export function positionExtraitMs(
  debutS: number,
  resultat: Pick<ResultatBlind, 'ecouteMs'>,
  etape: EtapeBlind,
  ecouleMs: number,
  extraitS: number,
): number {
  const enCours =
    etape === 'ecoute'
      ? Math.min(Math.max(0, ecouleMs), resteExtraitMs(extraitS, resultat.ecouteMs))
      : 0;
  return Math.max(0, debutS) * 1000 + resultat.ecouteMs + enCours;
}

/** Le résultat d'un passage tel que la base le garde (clés en snake_case), lu sans confiance. */
export function resultatBlindDe(brut: Record<string, unknown> | null | undefined): ResultatBlind {
  const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const bloquees = Array.isArray(brut?.['bloquees'])
    ? (brut['bloquees'] as unknown[]).flatMap((v) => (nombre(v) === null ? [] : [v as number]))
    : [];
  return {
    ecouteMs: Math.max(0, nombre(brut?.['ecoute_ms']) ?? 0),
    bloquees,
    buzz: nombre(brut?.['buzz']),
    trouvePar: nombre(brut?.['trouve_par']),
  };
}

/** Le même, prêt à écrire en base. */
export function resultatBlindVers(r: ResultatBlind): Record<string, unknown> {
  return { ecoute_ms: r.ecouteMs, bloquees: r.bloquees, buzz: r.buzz, trouve_par: r.trouvePar };
}
