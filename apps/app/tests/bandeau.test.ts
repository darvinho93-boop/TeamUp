import { describe, expect, it } from 'vitest';
import { avecCles, bienvenueDe, nouveauxPrenoms, rangeesDe } from '../src/lib/bandeau';

describe('le bandeau de prénoms de la page du QR code', () => {
  it('répartit les prénoms en deux rangées, un sur deux, dans l’ordre d’arrivée', () => {
    expect(rangeesDe(['Léa', 'Sam', 'Ana', 'Tom', 'Zoé'])).toEqual([
      ['Léa', 'Ana', 'Zoé'],
      ['Sam', 'Tom'],
    ]);
    expect(rangeesDe([])).toEqual([[], []]);
  });

  it('un nouvel arrivé se met au bout de sa rangée, sans déplacer les autres', () => {
    const avant = rangeesDe(['Léa', 'Sam', 'Ana']);
    const apres = rangeesDe(['Léa', 'Sam', 'Ana', 'Tom']);
    expect(apres[0]).toEqual(avant[0]);
    expect(apres[1]).toEqual([...avant[1]!, 'Tom']);
  });

  it('donne une clé stable à chaque prénom, homonymes compris', () => {
    expect(avecCles(['Léa', 'Sam', 'Léa']).map((p) => p.cle)).toEqual(['Léa#0', 'Sam#0', 'Léa#1']);
  });

  it('trouve les nouveaux d’une lecture à l’autre', () => {
    expect(nouveauxPrenoms(['Léa', 'Sam'], ['Léa', 'Sam', 'Ana', 'Tom'])).toEqual(['Ana', 'Tom']);
    // Un homonyme arrivé ensuite est nouveau ; un joueur retiré ne l'est pas.
    expect(nouveauxPrenoms(['Léa'], ['Léa', 'Léa'])).toEqual(['Léa']);
    expect(nouveauxPrenoms(['Léa', 'Sam'], ['Sam'])).toEqual([]);
    expect(nouveauxPrenoms([], [])).toEqual([]);
  });

  it('salue jusqu’à trois prénoms, puis compte les autres', () => {
    expect(bienvenueDe([])).toBeNull();
    expect(bienvenueDe(['Léa'])).toEqual({ prenoms: ['Léa'], autres: 0 });
    expect(bienvenueDe(['Léa', 'Sam', 'Ana'])).toEqual({
      prenoms: ['Léa', 'Sam', 'Ana'],
      autres: 0,
    });
    expect(bienvenueDe(['Léa', 'Sam', 'Ana', 'Tom', 'Zoé'])).toEqual({
      prenoms: ['Léa', 'Sam', 'Ana'],
      autres: 2,
    });
  });
});
