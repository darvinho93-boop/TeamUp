import { z } from 'astro/zod';
import { CRENEAUX, EQUIPEMENTS, LANGUES, OCCASIONS, TYPES, typeDepuis } from './options';

/** Ce que le visiteur a tapé, tel quel : de quoi réafficher le formulaire après une erreur. */
export interface Saisie {
  type: string;
  occasion: string;
  date: string;
  lieu: string;
  invites: string;
  nom: string;
  tel: string;
  email: string;
  societe: string;
  creneau: string;
  groupes: string;
  langues: string[];
  equipement: string[];
  message: string;
  consentement: boolean;
}

export type Champ = keyof Saisie;
export type Erreurs = Partial<Record<Champ, string>>;

const MAX_INVITES = 1000;
const MAX_MESSAGE = 2000;

const texte = (requis: string, max: number, tropLong: string) =>
  z.string().trim().min(1, requis).max(max, tropLong);

const facultatif = (max: number, tropLong: string) =>
  z
    .string()
    .trim()
    .max(max, tropLong)
    .transform((valeur) => valeur || undefined);

function schema(aujourdhui: string) {
  return z.object({
    type: z.enum(TYPES, 'Indiquez si vous êtes un particulier ou une entreprise.'),
    occasion: z.string().min(1, 'Choisissez une occasion.'),
    date: z
      .string()
      .min(1, "Indiquez la date de l'événement.")
      .refine(estUneDate, "Cette date n'est pas valide.")
      .refine((date) => date >= aujourdhui, 'Cette date est déjà passée.'),
    lieu: texte('Indiquez la ville ou le lieu.', 120, 'Restez sous 120 caractères.'),
    invites: z
      .string()
      .trim()
      .min(1, "Indiquez le nombre d'invités.")
      .regex(/^\d+$/, 'Indiquez un nombre entier, en chiffres.')
      .transform(Number)
      .refine((n) => n >= 2, 'Il faut au moins 2 invités.')
      .refine(
        (n) => n <= MAX_INVITES,
        `Au-delà de ${MAX_INVITES} invités, indiquez-le dans votre message.`,
      ),
    nom: texte('Indiquez votre nom.', 100, 'Restez sous 100 caractères.'),
    tel: z
      .string()
      .trim()
      .min(1, 'Indiquez un numéro de téléphone.')
      .refine(estUnTelephone, "Ce numéro de téléphone n'est pas valide."),
    email: z
      .string()
      .trim()
      .min(1, 'Indiquez votre adresse e-mail.')
      .pipe(z.email("Cette adresse e-mail n'est pas valide, par exemple vous@exemple.fr.")),
    societe: facultatif(120, 'Restez sous 120 caractères.'),
    creneau: z.enum(CRENEAUX, 'Choisissez une durée dans la liste.').optional(),
    groupes: facultatif(200, 'Restez sous 200 caractères.'),
    langues: z.array(
      z.enum(
        LANGUES.map((l) => l.id),
        'Langue inconnue.',
      ),
    ),
    equipement: z.array(
      z.enum(
        EQUIPEMENTS.map((e) => e.id),
        'Équipement inconnu.',
      ),
    ),
    message: facultatif(MAX_MESSAGE, `Restez sous ${MAX_MESSAGE} caractères.`),
    consentement: z.literal(true, "Cochez cette case pour que l'on puisse vous recontacter."),
  });
}

export type Demande = z.output<ReturnType<typeof schema>>;

export type Lecture =
  { ok: true; demande: Demande; saisie: Saisie } | { ok: false; erreurs: Erreurs; saisie: Saisie };

/** Une saisie vierge : le formulaire tel qu'il s'affiche à la première visite. */
export function saisieVide(type: string | null = null): Saisie {
  return {
    type: typeDepuis(type),
    occasion: '',
    date: '',
    lieu: '',
    invites: '',
    nom: '',
    tel: '',
    email: '',
    societe: '',
    creneau: '',
    groupes: '',
    langues: ['fr'],
    equipement: [],
    message: '',
    consentement: false,
  };
}

export function saisieDepuis(form: FormData): Saisie {
  const texteDe = (champ: string) => {
    const valeur = form.get(champ);
    return typeof valeur === 'string' ? valeur : '';
  };
  const listeDe = (champ: string) =>
    form.getAll(champ).filter((valeur): valeur is string => typeof valeur === 'string');

  return {
    type: texteDe('type'),
    occasion: texteDe('occasion'),
    date: texteDe('date'),
    lieu: texteDe('lieu'),
    invites: texteDe('invites'),
    nom: texteDe('nom'),
    tel: texteDe('tel'),
    email: texteDe('email'),
    societe: texteDe('societe'),
    creneau: texteDe('creneau'),
    groupes: texteDe('groupes'),
    langues: listeDe('langues'),
    equipement: listeDe('equipement'),
    message: texteDe('message'),
    consentement: form.has('consentement'),
  };
}

/**
 * Valide une demande de devis. `aujourdhui` (AAAA-MM-JJ, heure de Paris) est passé
 * par l'appelant pour que la règle « date à venir » reste testable.
 */
export function lireDevis(form: FormData, aujourdhui: string): Lecture {
  const saisie = saisieDepuis(form);
  // La société ne concerne que les entreprises : un reste de saisie côté particulier est ignoré.
  const entree = {
    ...saisie,
    societe: saisie.type === 'entreprise' ? saisie.societe : '',
    creneau: saisie.creneau || undefined,
  };

  const resultat = schema(aujourdhui).safeParse(entree);

  const erreurs: Erreurs = {};
  for (const issue of resultat.error?.issues ?? []) {
    const champ = issue.path[0] as Champ;
    erreurs[champ] ??= issue.message;
  }
  // L'occasion dépend du type : vérifiée à part pour s'afficher en même temps que les autres erreurs.
  const type = typeDepuis(saisie.type);
  if (!erreurs.occasion && saisie.occasion && !OCCASIONS[type].includes(saisie.occasion)) {
    erreurs.occasion = 'Choisissez une occasion dans la liste.';
  }

  if (resultat.success && Object.keys(erreurs).length === 0) {
    return { ok: true, demande: resultat.data, saisie };
  }
  return { ok: false, erreurs, saisie };
}

/** Date du jour à Paris, au format des champs `type="date"`. */
export function aujourdhuiAParis(maintenant = new Date()): string {
  return maintenant.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

function estUneDate(valeur: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const date = new Date(`${valeur}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(valeur);
}

/** Numéro français ou international : de 9 à 15 chiffres, espaces, points, tirets et + initial tolérés. */
function estUnTelephone(valeur: string): boolean {
  if (!/^\+?[\d\s.\-()]+$/.test(valeur)) return false;
  const chiffres = valeur.replace(/\D/g, '').length;
  return chiffres >= 9 && chiffres <= 15;
}
