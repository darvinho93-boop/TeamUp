import { describe, expect, it } from 'vitest';
import {
  classementDuTheme,
  enTeteDuTheme,
  equipesEnJeu,
  motsAffiches,
  RELECTURE_APRES_CHRONO_MS,
  relectureDesMots,
  surenchereAuTelephone,
} from '../src/lib/mots';
import type { EquipeSalle, EtatSalle, PassageSalle } from '../src/lib/salle';

const equipe = (numero: number, joueurs: number): EquipeSalle => ({
  id: `e${numero}`,
  numero,
  nom: `Équipe ${numero}`,
  points: 0,
  joueurs,
  prenoms: [],
});

const passage = (extra: Partial<PassageSalle> = {}): PassageSalle => ({
  id: 't1',
  ordre: 1,
  statut: 'en_cours',
  equipe_id: null,
  points: null,
  resultat: {},
  contenu_id: null,
  public: {},
  secret: null,
  ...extra,
});

function etat(
  pilotage: Partial<EtatSalle['pilotage']>,
  options: Record<string, unknown> = { mode: 'telephones' },
  statut: 'a_venir' | 'en_cours' = 'en_cours',
): EtatSalle {
  return {
    serveur_ms: 0,
    evenement: {
      id: 'ev',
      code: 'ABCDEF',
      langues: ['fr'],
      statut: 'en_cours',
      client_nom: 'Test',
      creneau_minutes: 40,
      photos_closes: false,
    },
    pilotage: {
      scene: 'jeu',
      manche_id: 'se',
      passage_id: 't1',
      etape: 'chrono',
      indices: 0,
      chrono_depart_ms: 10_000,
      chrono_duree_s: 60,
      version: 'v1',
      ...pilotage,
    },
    equipes: [equipe(1, 3), equipe(2, 0), equipe(3, 4)],
    joueurs: 7,
    connectes: 7,
    programme: [{ id: 'se', jeu: 'enchere2', ordre: 1, statut, options, passages: [passage()] }],
  };
}

describe('Surenchère en mode téléphones, côté écran et régie', () => {
  it('ne concerne que la manche en cours, lancée en mode téléphones', () => {
    expect(surenchereAuTelephone(etat({}))?.passage?.id).toBe('t1');
    expect(surenchereAuTelephone(etat({}, { mode: 'voix' }))).toBeNull();
    // Lancée avant le mode téléphones : à la voix.
    expect(surenchereAuTelephone(etat({}, {}))).toBeNull();
    expect(surenchereAuTelephone(etat({}, { mode: 'telephones' }, 'a_venir'))).toBeNull();
    expect(surenchereAuTelephone(etat({ scene: 'scores' }))).toBeNull();
  });

  it('relit l’état juste après la fin du chrono, seulement pendant le chrono', () => {
    expect(relectureDesMots(etat({}))).toBe(10_000 + 60_000 + RELECTURE_APRES_CHRONO_MS);
    expect(relectureDesMots(etat({ etape: 'sujet' }))).toBeNull();
    expect(relectureDesMots(etat({ etape: 'podium' }))).toBeNull();
    expect(relectureDesMots(etat({ chrono_depart_ms: null }))).toBeNull();
    expect(relectureDesMots(etat({}, { mode: 'voix' }))).toBeNull();
  });

  it('fait jouer les équipes qui ont des joueurs', () => {
    expect(equipesEnJeu(etat({})).map((e) => e.numero)).toEqual([1, 3]);
  });

  it('sait si les mots sont à l’écran (la base ne les donne qu’après le chrono)', () => {
    expect(motsAffiches(passage())).toBe(false);
    expect(motsAffiches(passage({ mots: { '1': { valides: 2, liste: null } } }))).toBe(false);
    expect(motsAffiches(passage({ mots: { '1': { valides: 0, liste: [] } } }))).toBe(true);
  });

  it('lit le classement d’un thème joué au téléphone, et ses équipes en tête', () => {
    const joue = passage({
      statut: 'termine',
      resultat: {
        mode: 'telephones',
        comptes: { 1: 9, 3: 9, 2: 0 },
        rangs: { 1: 1, 3: 1 },
        points: { 1: 100, 3: 100 },
      },
    });
    expect(classementDuTheme(joue)).toEqual({
      comptes: { 1: 9, 2: 0, 3: 9 },
      rangs: { 1: 1, 3: 1 },
      points: { 1: 100, 3: 100 },
    });
    const enTete = enTeteDuTheme(joue, etat({}).equipes);
    expect(enTete?.equipes.map((e) => e.numero)).toEqual([1, 3]);
    expect(enTete?.mots).toBe(9);
    // Un thème joué à la voix n'a pas ce classement.
    expect(classementDuTheme(passage({ resultat: { tenu: true, equipe_champion: 1 } }))).toBeNull();
    // Aucun mot validé : personne en tête.
    const vide = passage({ resultat: { mode: 'telephones', comptes: {}, rangs: {}, points: {} } });
    expect(enTeteDuTheme(vide, etat({}).equipes)).toBeNull();
  });
});
