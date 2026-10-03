import { describe, expect, it } from 'vitest';
import {
  etiquettesDe,
  languesCompletes,
  lireSaisie,
  proposable,
  valeursDuFormulaire,
  type ContenuBanque,
} from '../src/lib/contenus';

const formulaire = (valeurs: Record<string, string>) => (nom: string) => valeurs[nom] ?? null;

describe('saisie d’un contenu', () => {
  it('range un point commun en partie publique et secrète, FR seul', () => {
    const saisie = lireSaisie(
      'list2',
      formulaire({
        etiquette: 'b2c',
        'fr.consigne': ' Levez-vous ',
        'fr.reponse': 'les lève-tôt',
        'fr.indice1': 'Le matin',
        'fr.indice2': 'Un réveil',
      }),
    );
    expect(saisie).toEqual({
      ok: true,
      etiquette: 'b2c',
      langues: {
        fr: {
          public: { consigne: 'Levez-vous' },
          secret: { reponse: 'les lève-tôt', indices: ['Le matin', 'Un réveil'] },
        },
      },
    });
  });

  it('exige le français, champ par champ', () => {
    const saisie = lireSaisie('enchere2', formulaire({ etiquette: 'b2b', 'fr.theme': 'Sport' }));
    expect(saisie).toEqual({ ok: false, erreurs: { 'fr.sujet': 'requis' } });
  });

  it('ignore une langue facultative vide, refuse une langue entamée', () => {
    const base = { etiquette: 'tout_public', 'fr.mot': 'vélo' };
    expect(lireSaisie('mime2', formulaire(base))).toMatchObject({ ok: true });
    const entame = lireSaisie(
      'qcm2',
      formulaire({
        etiquette: 'tout_public',
        bonne: '2',
        'fr.question': 'Q ?',
        'fr.proposition1': 'a',
        'fr.proposition2': 'b',
        'fr.proposition3': 'c',
        'fr.proposition4': 'd',
        'ta.question': 'கேள்வி?',
      }),
    );
    expect(entame).toEqual({
      ok: false,
      erreurs: {
        'ta.proposition1': 'requis',
        'ta.proposition2': 'requis',
        'ta.proposition3': 'requis',
        'ta.proposition4': 'requis',
      },
    });
  });

  it('donne la même bonne réponse du quiz à chaque langue', () => {
    const champs = (l: string, q: string) => ({
      [`${l}.question`]: q,
      [`${l}.proposition1`]: '6',
      [`${l}.proposition2`]: '8',
      [`${l}.proposition3`]: '10',
      [`${l}.proposition4`]: '12',
    });
    const saisie = lireSaisie(
      'qcm2',
      formulaire({
        etiquette: 'tout_public',
        bonne: '1',
        ...champs('fr', 'Pattes ?'),
        ...champs('en', 'Legs?'),
      }),
    );
    expect(saisie.ok && saisie.langues.fr?.secret).toEqual({ bonne: 1 });
    expect(saisie.ok && saisie.langues.en?.secret).toEqual({ bonne: 1 });
  });

  it('refuse une bonne réponse absente, une étiquette inconnue, un texte trop long', () => {
    const saisie = lireSaisie(
      'photo2',
      formulaire({ etiquette: 'vip', 'fr.theme': 'x'.repeat(301) }),
    );
    expect(saisie).toEqual({
      ok: false,
      erreurs: { etiquette: 'invalide', 'fr.theme': 'trop_long' },
    });
    expect(lireSaisie('qcm2', formulaire({ etiquette: 'b2c' }))).toMatchObject({
      ok: false,
      erreurs: { bonne: 'requis' },
    });
  });

  it('une photo n’a pas de secret', () => {
    const saisie = lireSaisie('photo2', formulaire({ etiquette: 'b2c', 'fr.theme': 'Un selfie' }));
    expect(saisie).toEqual({
      ok: true,
      etiquette: 'b2c',
      langues: { fr: { public: { theme: 'Un selfie' } } },
    });
  });

  it('relit un contenu existant dans les champs du formulaire', () => {
    expect(
      valeursDuFormulaire(
        'qcm2',
        [{ langue: 'fr', valeur: { question: 'Q ?', propositions: ['a', 'b', 'c', 'd'] } }],
        [{ langue: 'fr', valeur: { bonne: 3 } }],
      ),
    ).toEqual({
      'fr.question': 'Q ?',
      'fr.proposition1': 'a',
      'fr.proposition2': 'b',
      'fr.proposition3': 'c',
      'fr.proposition4': 'd',
      bonne: '3',
    });
  });
});

describe('contenus proposés à la préparation', () => {
  const contenu = (
    jeu: string,
    etiquette: string,
    publiques: string[],
    secretes: string[],
  ): ContenuBanque => ({
    jeu,
    etiquette,
    contenus_traductions: publiques.map((langue) => ({ langue })),
    contenus_secrets: secretes.map((langue) => ({ langue })),
  });

  it('une langue n’est complète qu’avec son secret, sauf pour la photo', () => {
    expect(languesCompletes(contenu('list2', 'b2c', ['fr', 'en', 'ta'], ['fr', 'en']))).toEqual([
      'fr',
      'en',
    ]);
    expect(languesCompletes(contenu('photo2', 'b2c', ['fr', 'ta'], []))).toEqual(['fr', 'ta']);
  });

  it('écarte un contenu incomplet dans une langue de la soirée', () => {
    const fr = contenu('mime2', 'tout_public', ['fr'], ['fr']);
    expect(proposable(fr, { langues: ['fr'], type_client: 'particulier' })).toBe(true);
    expect(proposable(fr, { langues: ['fr', 'en'], type_client: 'particulier' })).toBe(false);
    expect(proposable(fr, { langues: ['fr', 'en'], type_client: 'particulier' }, true)).toBe(false);
  });

  it('filtre par public, sauf à tout afficher', () => {
    expect(etiquettesDe('particulier')).toEqual(['b2c', 'tout_public']);
    expect(etiquettesDe('entreprise')).toEqual(['b2b', 'tout_public']);
    const mariage = contenu('enchere2', 'b2c', ['fr'], ['fr']);
    const soiree = { langues: ['fr'], type_client: 'entreprise' } as const;
    expect(proposable(mariage, soiree)).toBe(false);
    expect(proposable(mariage, soiree, true)).toBe(true);
    expect(proposable(contenu('enchere2', 'tout_public', ['fr'], ['fr']), soiree)).toBe(true);
  });
});
