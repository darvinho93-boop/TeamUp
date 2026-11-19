import { describe, expect, it } from 'vitest';
import { typographie } from '../src/lib/typographie';
import { fondDeRonds } from '../src/lib/habillage';
import type { EtatSalle } from '../src/lib/salle';

describe('la typographie française d’un contenu (2026-11-19)', () => {
  it('rend insécable l’espace avant ? ! : ; et dans les guillemets', () => {
    expect(typographie('Où se sont-ils rencontrés ?', 'fr')).toBe('Où se sont-ils rencontrés ?');
    expect(typographie('Bravo ! Le score : 3 ; ensuite', 'fr')).toBe(
      'Bravo ! Le score : 3 ; ensuite',
    );
    expect(typographie('« Le Roi lion »', 'fr')).toBe('« Le Roi lion »');
  });

  it('n’ajoute aucune espace qui manque, ne touche ni aux heures ni aux autres langues', () => {
    expect(typographie('Rencontrés?', 'fr')).toBe('Rencontrés?');
    expect(typographie('À 20:30 précises', 'fr')).toBe('À 20:30 précises');
    expect(typographie('Where did they meet ?', 'en')).toBe('Where did they meet ?');
  });
});

describe('les ronds du logo en fond (habillage, 2026-11-19)', () => {
  const etat = (scene: string, etape: string | null, jeu?: string) =>
    ({
      pilotage: { scene, etape, manche_id: jeu ? 'm1' : null },
      programme: jeu ? [{ id: 'm1', jeu }] : [],
    }) as unknown as Pick<EtatSalle, 'pilotage' | 'programme'>;

  it('paraissent pendant les attentes', () => {
    expect(fondDeRonds(etat('programme', null))).toBe(true);
    expect(fondDeRonds(etat('scores', null))).toBe(true);
    expect(fondDeRonds(etat('intro', null, 'qcm2'))).toBe(true);
    expect(fondDeRonds(etat('jeu', 'pret', 'list2'))).toBe(true);
    expect(fondDeRonds(etat('jeu', 'masque', 'list2'))).toBe(true);
    expect(fondDeRonds(etat('jeu', 'pret', 'mime2'))).toBe(true);
  });

  it('jamais pendant un jeu, une explication, une révélation ou un verdict', () => {
    expect(fondDeRonds(etat('intro', 'explication', 'qcm2'))).toBe(false);
    expect(fondDeRonds(etat('intro', 'tirage-ordre', 'list2'))).toBe(false);
    expect(fondDeRonds(etat('jeu', 'consigne', 'list2'))).toBe(false);
    expect(fondDeRonds(etat('jeu', 'lance', 'list2'))).toBe(false);
    expect(fondDeRonds(etat('jeu', 'trouve', 'mime2'))).toBe(false);
    expect(fondDeRonds(etat('jeu', 'question', 'qcm2'))).toBe(false);
    expect(fondDeRonds(etat('podium', null))).toBe(false);
    expect(fondDeRonds(etat('accueil', null))).toBe(false);
  });
});
