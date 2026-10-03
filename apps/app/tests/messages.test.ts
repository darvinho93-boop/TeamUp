import { describe, expect, it } from 'vitest';
import { SCRIPTS_EXPLICATION } from '@teamup/game';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import ta from '../messages/ta.json';

/** Toutes les clés, à plat : `attente.salut`, `jeux.list2`… */
function cles(objet: object, prefixe = ''): string[] {
  return Object.entries(objet).flatMap(([cle, valeur]) =>
    typeof valeur === 'object' && valeur !== null
      ? cles(valeur as object, `${prefixe}${cle}.`)
      : [`${prefixe}${cle}`],
  );
}

describe('traductions de l’écran joueur', () => {
  it.each([
    ['en', en],
    ['ta', ta],
  ])('%s a exactement les clés du français', (_langue, messages) => {
    expect(cles(messages).sort()).toEqual(cles(fr).sort());
  });

  it.each([
    ['en', en],
    ['ta', ta],
  ])('%s garde les variables de chaque message', (_langue, messages) => {
    const variables = (texte: string) =>
      [...texte.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
    const valeur = (m: object, cle: string) =>
      cle.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m) as string;
    for (const cle of cles(fr)) {
      expect(variables(valeur(messages, cle)), cle).toEqual(variables(valeur(fr, cle)));
    }
  });
});

describe('phrases des explications animées', () => {
  it('chaque carte de chaque script a sa phrase, et rien de plus', () => {
    for (const [script, cartes] of Object.entries(SCRIPTS_EXPLICATION)) {
      const phrases = (fr.ecran.explications as Record<string, Record<string, string>>)[script];
      expect(Object.keys(phrases ?? {}).sort(), script).toEqual(cartes.map((c) => c.cle).sort());
    }
    expect(Object.keys(fr.ecran.explications).sort()).toEqual(
      Object.keys(SCRIPTS_EXPLICATION).sort(),
    );
  });
});
