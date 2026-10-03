/**
 * Banques de contenus (lot 9) : la saisie du back-office, et ce que la préparation propose.
 *
 * Un contenu a une partie publique et, sauf la photo, une partie secrète, par langue (forme
 * documentée en tête de `20260922092000_contenus_et_secrets.sql`, vérifiée aussi en base par
 * `enregistrer_contenu`). Le français est obligatoire ; l'anglais et le tamoul sont facultatifs,
 * mais une langue entamée doit être complète.
 */

import { z } from 'zod';
import { LANGUES, type Langue } from './partie';

export const JEUX_CONTENUS = ['list2', 'qcm2', 'enchere2', 'mime2', 'photo2'] as const;
export type JeuContenu = (typeof JEUX_CONTENUS)[number];

export const ETIQUETTES = ['b2c', 'b2b', 'tout_public'] as const;
export type Etiquette = (typeof ETIQUETTES)[number];

export function estJeuContenu(valeur: unknown): valeur is JeuContenu {
  return (JEUX_CONTENUS as readonly unknown[]).includes(valeur);
}

/** Les champs saisis par langue, dans l'ordre du formulaire. La bonne réponse du quiz est à part. */
export const CHAMPS = {
  list2: ['consigne', 'reponse', 'indice1', 'indice2'],
  qcm2: ['question', 'proposition1', 'proposition2', 'proposition3', 'proposition4'],
  enchere2: ['theme', 'sujet'],
  mime2: ['mot'],
  photo2: ['theme'],
} as const satisfies Record<JeuContenu, readonly string[]>;

export type Champ = (typeof CHAMPS)[JeuContenu][number];

/** Nom du champ de formulaire : `fr.consigne`, `ta.mot`… */
export const nomChamp = (langue: Langue, champ: string) => `${langue}.${champ}`;

export const TEXTE_MAX = 300;
const Texte = z.string().trim().min(1).max(TEXTE_MAX);

type Valeur = Record<string, unknown>;
export interface Bloc {
  public: Valeur;
  secret?: Valeur;
}
export type Langues = Partial<Record<Langue, Bloc>>;

export type Erreur = 'requis' | 'trop_long' | 'invalide';

export type Saisie =
  | { ok: true; etiquette: Etiquette; langues: Langues }
  | { ok: false; erreurs: Record<string, Erreur> };

/** D'un bloc de langue complet à la charge utile rangée en base. */
function versBloc(jeu: JeuContenu, v: Record<string, string>, bonne: number): Bloc {
  switch (jeu) {
    case 'list2':
      return {
        public: { consigne: v['consigne'] },
        secret: { reponse: v['reponse'], indices: [v['indice1'], v['indice2']] },
      };
    case 'qcm2':
      return {
        public: {
          question: v['question'],
          propositions: [
            v['proposition1'],
            v['proposition2'],
            v['proposition3'],
            v['proposition4'],
          ],
        },
        secret: { bonne },
      };
    case 'enchere2':
      return { public: { theme: v['theme'] }, secret: { sujet: v['sujet'] } };
    case 'mime2':
      return { public: {}, secret: { mot: v['mot'] } };
    case 'photo2':
      return { public: { theme: v['theme'] } };
  }
}

/**
 * Lit le formulaire d'un contenu. `lire(nom)` rend la valeur brute d'un champ (un `FormData`
 * s'y branche directement). Erreurs rangées par nom de champ, pour les afficher en face.
 */
export function lireSaisie(jeu: JeuContenu, lire: (nom: string) => unknown): Saisie {
  const erreurs: Record<string, Erreur> = {};
  const texte = (nom: string) => {
    const brut = lire(nom);
    return typeof brut === 'string' ? brut.trim() : '';
  };

  const etiquette = z.enum(ETIQUETTES).safeParse(lire('etiquette'));
  if (!etiquette.success) erreurs['etiquette'] = 'invalide';

  let bonne = -1;
  if (jeu === 'qcm2') {
    const lue = z.enum(['0', '1', '2', '3']).safeParse(lire('bonne'));
    if (lue.success) bonne = Number(lue.data);
    else erreurs['bonne'] = 'requis';
  }

  const langues: Langues = {};
  for (const langue of LANGUES) {
    const champs = CHAMPS[jeu];
    const valeurs = Object.fromEntries(champs.map((c) => [c, texte(nomChamp(langue, c))]));
    // Une langue facultative laissée vide est simplement absente.
    if (langue !== 'fr' && champs.every((c) => valeurs[c] === '')) continue;
    for (const c of champs) {
      const lu = Texte.safeParse(valeurs[c]);
      if (!lu.success) erreurs[nomChamp(langue, c)] = valeurs[c] ? 'trop_long' : 'requis';
    }
    langues[langue] = versBloc(jeu, valeurs, bonne);
  }

  if (Object.keys(erreurs).length > 0 || !etiquette.success) return { ok: false, erreurs };
  return { ok: true, etiquette: etiquette.data, langues };
}

export interface Traduite {
  langue: string;
  valeur: unknown;
}

const chaine = (v: unknown) => (typeof v === 'string' ? v : '');
const liste = (v: unknown, i: number) => (Array.isArray(v) ? chaine(v[i]) : '');

/**
 * Ce qu'on reconnaît d'un contenu dans une liste : la réponse, le thème et son sujet, la
 * question, le mot. Dans la langue demandée, sinon en français.
 */
export function libelleContenu(
  jeu: string,
  publics: Traduite[],
  secrets: Traduite[],
  langue: string,
): string {
  const dans = (l: Traduite[]) =>
    ((l.find((t) => t.langue === langue) ?? l.find((t) => t.langue === 'fr'))?.valeur ??
      {}) as Valeur;
  const texte = (v: Valeur, cle: string) => chaine(v[cle]) || '—';
  const p = dans(publics);
  const s = dans(secrets);
  if (jeu === 'list2') return texte(s, 'reponse');
  if (jeu === 'enchere2') return `${texte(p, 'theme')} — ${texte(s, 'sujet')}`;
  if (jeu === 'qcm2') return texte(p, 'question');
  if (jeu === 'mime2') return texte(s, 'mot');
  if (jeu === 'photo2') return texte(p, 'theme');
  return '—';
}

/** L'inverse de `lireSaisie` : les valeurs du formulaire d'un contenu existant. */
export function valeursDuFormulaire(
  jeu: JeuContenu,
  publics: Traduite[],
  secrets: Traduite[],
): Record<string, string> {
  const valeurs: Record<string, string> = {};
  for (const langue of LANGUES) {
    const p = (publics.find((t) => t.langue === langue)?.valeur ?? null) as Valeur | null;
    const s = (secrets.find((t) => t.langue === langue)?.valeur ?? {}) as Valeur;
    if (!p) continue;
    const champs: Record<string, string> = {
      consigne: chaine(p['consigne']),
      reponse: chaine(s['reponse']),
      indice1: liste(s['indices'], 0),
      indice2: liste(s['indices'], 1),
      question: chaine(p['question']),
      proposition1: liste(p['propositions'], 0),
      proposition2: liste(p['propositions'], 1),
      proposition3: liste(p['propositions'], 2),
      proposition4: liste(p['propositions'], 3),
      theme: chaine(p['theme']),
      sujet: chaine(s['sujet']),
      mot: chaine(s['mot']),
    };
    for (const c of CHAMPS[jeu]) valeurs[nomChamp(langue, c)] = champs[c] ?? '';
    if (jeu === 'qcm2' && typeof s['bonne'] === 'number') valeurs['bonne'] = String(s['bonne']);
  }
  return valeurs;
}

// ---------------------------------------------------------------------------
// Préparation : ce qu'on propose à l'animateur
// ---------------------------------------------------------------------------

/** Les étiquettes d'une soirée : celle de son public, plus « tout public ». */
export function etiquettesDe(typeClient: 'particulier' | 'entreprise'): Etiquette[] {
  return typeClient === 'entreprise' ? ['b2b', 'tout_public'] : ['b2c', 'tout_public'];
}

export interface ContenuBanque {
  jeu: string;
  etiquette: string;
  contenus_traductions: { langue: string }[];
  contenus_secrets: { langue: string }[];
}

/** Les langues dans lesquelles un contenu est complet : partie publique, et secret s'il en a un. */
export function languesCompletes(c: ContenuBanque): Langue[] {
  const publiques = new Set(c.contenus_traductions.map((t) => t.langue));
  const secretes = new Set(c.contenus_secrets.map((t) => t.langue));
  return LANGUES.filter((l) => publiques.has(l) && (c.jeu === 'photo2' || secretes.has(l)));
}

/**
 * Un contenu se propose à une soirée s'il est complet dans toutes ses langues (sinon l'écran
 * aurait un trou) et, sauf `tout`, s'il convient à son public.
 */
export function proposable(
  c: ContenuBanque,
  soiree: { langues: readonly string[]; type_client: 'particulier' | 'entreprise' },
  tout = false,
): boolean {
  const completes = languesCompletes(c) as string[];
  if (!soiree.langues.every((l) => completes.includes(l))) return false;
  return tout || (etiquettesDe(soiree.type_client) as string[]).includes(c.etiquette);
}
