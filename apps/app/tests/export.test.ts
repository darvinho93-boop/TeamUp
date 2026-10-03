import { describe, expect, it } from 'vitest';
import { cheminDansLeZip, csvScores, nomSur, rangs } from '../src/lib/export';

const libelles = {
  classement: 'Classement',
  rang: 'Rang',
  equipe: 'Équipe',
  points: 'Points',
  journal: 'Journal des points',
  heure: 'Heure',
  jeu: 'Jeu',
  motif: 'Motif',
};

describe('export des scores en CSV', () => {
  it('classe, puis déroule le journal, lisible par Excel en français', () => {
    const csv = csvScores({
      classement: [
        { nom: 'Navy', points: 150 },
        { nom: 'Corail', points: 300 },
      ],
      journal: [
        {
          heure: '21:04',
          jeu: 'Quiz',
          motif: 'Quiz – 3 survivants',
          equipe: 'Corail',
          points: 300,
        },
        { heure: '21:30', jeu: 'Duel', motif: 'Duel gagné par Zoé', equipe: 'Navy', points: 50 },
      ],
      libelles,
    });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Classement',
      'Rang;Équipe;Points',
      '1;Corail;300',
      '2;Navy;150',
      '',
      'Journal des points',
      'Heure;Jeu;Motif;Équipe;Points',
      '21:04;Quiz;Quiz – 3 survivants;Corail;300',
      '21:30;Duel;Duel gagné par Zoé;Navy;50',
      '',
    ]);
  });

  it('protège les points-virgules, guillemets et retours à la ligne', () => {
    const csv = csvScores({
      classement: [{ nom: 'Les "As"; et cie', points: 0 }],
      journal: [],
      libelles,
    });
    expect(csv).toContain('1;"Les ""As""; et cie";0');
  });

  it('partage le rang en cas d’égalité', () => {
    expect(rangs([300, 150, 150, 50])).toEqual([1, 2, 2, 4]);
  });
});

describe('noms de fichiers du ZIP des photos', () => {
  it('range par thème, dans l’ordre, et marque la gagnante', () => {
    expect(
      cheminDansLeZip({
        ordreTheme: 1,
        theme: "Toute l'équipe dans le cadre",
        equipeNumero: 2,
        equipeNom: 'Corail',
        gagnante: true,
      }),
    ).toBe('01-Toute-l-equipe-dans-le-cadre/Equipe-2-Corail-gagnante.jpg');
  });

  it('se rabat sur un nom neutre quand il ne reste rien (tamoul, symboles)', () => {
    expect(nomSur('முழு அணியும்', 'theme-3')).toBe('theme-3');
    expect(
      cheminDansLeZip({
        ordreTheme: 3,
        theme: 'முழு',
        equipeNumero: 4,
        equipeNom: '★',
        gagnante: false,
      }),
    ).toBe('03-theme-3/Equipe-4-4.jpg');
  });

  it('coupe les noms trop longs sans laisser de tiret final', () => {
    expect(nomSur('a'.repeat(59) + ' b', 'x')).toBe('a'.repeat(59));
  });
});
