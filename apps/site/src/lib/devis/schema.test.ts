import { describe, expect, it } from 'vitest';
import { aujourdhuiAParis, lireDevis } from './schema';

const AUJOURDHUI = '2026-09-22';

type Champs = Record<string, string | string[] | undefined>;

function formulaire(champs: Champs = {}): FormData {
  const valides: Champs = {
    type: 'particulier',
    occasion: 'Mariage',
    date: '2026-11-14',
    lieu: 'Strasbourg',
    invites: '80',
    nom: 'Camille Martin',
    tel: '06 12 34 56 78',
    email: 'camille@exemple.fr',
    langues: ['fr', 'en'],
    consentement: 'on',
    ...champs,
  };
  const form = new FormData();
  for (const [nom, valeur] of Object.entries(valides)) {
    if (valeur === undefined) continue;
    for (const v of Array.isArray(valeur) ? valeur : [valeur]) form.append(nom, v);
  }
  return form;
}

const erreursDe = (champs: Champs) => {
  const lecture = lireDevis(formulaire(champs), AUJOURDHUI);
  return lecture.ok ? {} : lecture.erreurs;
};

describe('lireDevis', () => {
  it('accepte une demande complète et convertit les invités en nombre', () => {
    const lecture = lireDevis(formulaire({ message: '  Surprise !  ' }), AUJOURDHUI);
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.demande.invites).toBe(80);
    expect(lecture.demande.message).toBe('Surprise !');
    expect(lecture.demande.langues).toEqual(['fr', 'en']);
  });

  it('rend les champs facultatifs vides absents', () => {
    const lecture = lireDevis(formulaire({ groupes: '', creneau: '' }), AUJOURDHUI);
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.demande.groupes).toBeUndefined();
    expect(lecture.demande.creneau).toBeUndefined();
  });

  it('signale chaque champ requis manquant, tous à la fois', () => {
    const lecture = lireDevis(new FormData(), AUJOURDHUI);
    expect(lecture.ok).toBe(false);
    if (lecture.ok) return;
    expect(Object.keys(lecture.erreurs).sort()).toEqual(
      ['consentement', 'date', 'email', 'invites', 'lieu', 'nom', 'occasion', 'tel', 'type'].sort(),
    );
    expect(lecture.erreurs.nom).toBe('Indiquez votre nom.');
  });

  it('garde la saisie telle quelle pour réafficher le formulaire', () => {
    const lecture = lireDevis(formulaire({ email: 'pas-une-adresse' }), AUJOURDHUI);
    expect(lecture.saisie.email).toBe('pas-une-adresse');
    expect(lecture.saisie.langues).toEqual(['fr', 'en']);
    expect(lecture.saisie.consentement).toBe(true);
  });

  it.each<[string, Champs, string, string | undefined]>([
    ['date passée', { date: '2026-09-21' }, 'date', 'Cette date est déjà passée.'],
    ['date du jour acceptée', { date: AUJOURDHUI }, 'date', undefined],
    ['date impossible', { date: '2026-02-30' }, 'date', "Cette date n'est pas valide."],
    [
      'invités en lettres',
      { invites: 'quatre-vingts' },
      'invites',
      'Indiquez un nombre entier, en chiffres.',
    ],
    ['un seul invité', { invites: '1' }, 'invites', 'Il faut au moins 2 invités.'],
    [
      "trop d'invités",
      { invites: '1001' },
      'invites',
      'Au-delà de 1000 invités, indiquez-le dans votre message.',
    ],
    [
      'e-mail invalide',
      { email: 'camille@' },
      'email',
      "Cette adresse e-mail n'est pas valide, par exemple vous@exemple.fr.",
    ],
    ['téléphone trop court', { tel: '06 12' }, 'tel', "Ce numéro de téléphone n'est pas valide."],
    [
      'téléphone avec lettres',
      { tel: '06 12 34 56 AB' },
      'tel',
      "Ce numéro de téléphone n'est pas valide.",
    ],
    ['téléphone international accepté', { tel: '+44 20 7946 0958' }, 'tel', undefined],
    ['lieu blanc', { lieu: '   ' }, 'lieu', 'Indiquez la ville ou le lieu.'],
    ['message trop long', { message: 'a'.repeat(2001) }, 'message', 'Restez sous 2000 caractères.'],
    [
      'consentement absent',
      { consentement: undefined },
      'consentement',
      "Cochez cette case pour que l'on puisse vous recontacter.",
    ],
    [
      'type inconnu',
      { type: 'association' },
      'type',
      'Indiquez si vous êtes un particulier ou une entreprise.',
    ],
    ['créneau inconnu', { creneau: '3 heures' }, 'creneau', 'Choisissez une durée dans la liste.'],
    ['langue inconnue', { langues: ['fr', 'de'] }, 'langues', 'Langue inconnue.'],
  ])('%s', (_cas, champs, champ, attendu) => {
    expect(erreursDe(champs)[champ as keyof ReturnType<typeof erreursDe>]).toBe(attendu);
  });

  it("refuse une occasion qui n'appartient pas au type", () => {
    expect(erreursDe({ type: 'entreprise', occasion: 'Mariage' }).occasion).toBe(
      'Choisissez une occasion dans la liste.',
    );
    expect(erreursDe({ type: 'entreprise', occasion: 'Séminaire' }).occasion).toBeUndefined();
  });

  it("signale l'occasion en même temps que les autres erreurs", () => {
    const erreurs = erreursDe({ occasion: 'Séminaire', email: '' });
    expect(erreurs.occasion).toBeDefined();
    expect(erreurs.email).toBeDefined();
  });

  it("ignore la société d'un particulier, la garde pour une entreprise", () => {
    const particulier = lireDevis(formulaire({ societe: 'ACME' }), AUJOURDHUI);
    expect(particulier.ok && particulier.demande.societe).toBeUndefined();
    const entreprise = lireDevis(
      formulaire({ type: 'entreprise', occasion: 'Séminaire', societe: 'ACME' }),
      AUJOURDHUI,
    );
    expect(entreprise.ok && entreprise.demande.societe).toBe('ACME');
  });
});

describe('aujourdhuiAParis', () => {
  it('passe au lendemain à minuit à Paris, pas à minuit UTC', () => {
    expect(aujourdhuiAParis(new Date('2026-09-22T21:59:00Z'))).toBe('2026-09-22');
    expect(aujourdhuiAParis(new Date('2026-09-22T22:01:00Z'))).toBe('2026-09-23');
  });
});
