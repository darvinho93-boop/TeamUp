import { describe, expect, it } from 'vitest';
import type {
  BlindJoueur,
  EtatJoueur,
  PortraitJoueur,
  QuizJetons,
  QuizTelephone,
  SurenchereJoueur,
} from '../src/lib/partie';
import { GRACE_CHRONO_MS, prioriteDuDirect } from '../src/lib/priorite';

const DEPART = 1_000_000;
const PENDANT = DEPART + 5000;
const APRES = DEPART + 30_000 + GRACE_CHRONO_MS;

const vide = { quiz: null, surenchere: null, blind: null, portrait: null, tournoi: null } as Pick<
  EtatJoueur,
  'quiz' | 'surenchere' | 'blind' | 'portrait' | 'tournoi'
>;

const commun = {
  serveur_ms: DEPART,
  etape: 'question' as const,
  passage_id: 'p1',
  numero: 1,
  total: 4,
  chrono_depart_ms: DEPART,
  chrono_duree_s: 30,
  question: { question: 'Q ?', propositions: ['A', 'B', 'C', 'D'] },
  bonne: null,
};

const telephone = (champs: Partial<QuizTelephone> = {}): QuizTelephone => ({
  ...commun,
  mode: 'telephone',
  ma_reponse: null,
  participant: true,
  elimine: false,
  ...champs,
});

const jetons = (champs: Partial<QuizJetons> = {}): QuizJetons => ({
  ...commun,
  mode: 'jetons',
  capitaine: true,
  equipe: true,
  jetons: 5,
  repartition: [0, 0, 0, 0],
  valide: false,
  fige: false,
  ...champs,
});

const blind = (champs: Partial<BlindJoueur> = {}): BlindJoueur => ({
  etape: 'ecoute',
  titre: 1,
  titres: 3,
  equipe: 1,
  buzz: null,
  trouve_par: null,
  bloquee: false,
  peut_buzzer: false,
  ...champs,
});

const surenchere = (champs: Partial<SurenchereJoueur> = {}): SurenchereJoueur => ({
  mode: 'telephones',
  serveur_ms: DEPART,
  etape: 'chrono',
  passage_id: 'p1',
  chrono_depart_ms: DEPART,
  chrono_duree_s: 30,
  theme: 'T',
  sujet: 'S',
  capitaine: false,
  equipe: true,
  mots: [],
  rang: null,
  points: null,
  ...champs,
});

const portrait = (champs: Partial<PortraitJoueur> = {}): PortraitJoueur => ({
  mode: 'telephones',
  serveur_ms: DEPART,
  etape: 'vote',
  cible: 1,
  cibles: 5,
  tour: 1,
  chrono_depart_ms: DEPART,
  chrono_duree_s: 30,
  equipe: 1,
  capitaine: false,
  eliminee: false,
  trouvee: null,
  vote: null,
  peut_voter: false,
  cartes: [],
  ...champs,
});

const urgent = (etat: Partial<typeof vide>, maintenant = PENDANT) =>
  prioriteDuDirect({ ...vide, ...etat }, maintenant).urgent;

describe('prioriteDuDirect', () => {
  it('ne prend pas la main sans jeu en cours', () => {
    expect(prioriteDuDirect(vide, PENDANT)).toEqual({ jeu: null, urgent: false, finMs: null });
  });

  it('quiz au téléphone : la question prend la main jusqu’à la réponse ou la fin du chrono', () => {
    expect(urgent({ quiz: telephone({ chrono_depart_ms: null }) })).toBe(true);
    expect(urgent({ quiz: telephone() })).toBe(true);
    expect(prioriteDuDirect({ ...vide, quiz: telephone() }, PENDANT).finMs).toBe(APRES);
    expect(urgent({ quiz: telephone({ ma_reponse: 2 }) })).toBe(false);
    expect(urgent({ quiz: telephone() }, APRES)).toBe(false);
  });

  it('quiz au téléphone : un spectateur ou un éliminé garde sa navigation', () => {
    expect(urgent({ quiz: telephone({ participant: false }) })).toBe(false);
    expect(urgent({ quiz: telephone({ elimine: true }) })).toBe(false);
    expect(urgent({ quiz: telephone({ etape: 'reponse' }) })).toBe(false);
  });

  it('quiz à jetons : le capitaine reste attendu, même débloqué après le chrono', () => {
    expect(urgent({ quiz: jetons() }, APRES)).toBe(true);
    expect(urgent({ quiz: jetons({ fige: true }) }, APRES)).toBe(false);
    expect(urgent({ quiz: jetons({ valide: true }) })).toBe(false);
    expect(urgent({ quiz: jetons({ jetons: 0 }) })).toBe(false);
  });

  it('quiz à jetons : un coéquipier suit la mise pendant le chrono seulement', () => {
    expect(urgent({ quiz: jetons({ capitaine: false }) })).toBe(true);
    expect(urgent({ quiz: jetons({ capitaine: false }) }, APRES)).toBe(false);
    expect(urgent({ quiz: jetons({ equipe: false }) })).toBe(false);
  });

  it('blind test : l’écoute et la main de son équipe, pas celle d’une autre', () => {
    expect(urgent({ blind: blind() })).toBe(true);
    expect(urgent({ blind: blind({ bloquee: true }) })).toBe(false);
    expect(urgent({ blind: blind({ etape: 'buzz', buzz: 1 }) })).toBe(true);
    expect(urgent({ blind: blind({ etape: 'buzz', buzz: 2 }) })).toBe(false);
    expect(urgent({ blind: blind({ equipe: null }) })).toBe(false);
  });

  it('Surenchère : le sujet, puis le chrono', () => {
    expect(urgent({ surenchere: surenchere({ etape: 'sujet' }) })).toBe(true);
    expect(urgent({ surenchere: surenchere() })).toBe(true);
    expect(urgent({ surenchere: surenchere() }, APRES)).toBe(false);
    expect(urgent({ surenchere: surenchere({ etape: 'podium' }) })).toBe(false);
    expect(urgent({ surenchere: surenchere({ equipe: false }) })).toBe(false);
  });

  it('Portrait : le tour de vote au téléphone, pour une équipe encore en lice', () => {
    expect(urgent({ portrait: portrait() })).toBe(true);
    expect(urgent({ portrait: portrait() }, APRES)).toBe(false);
    expect(urgent({ portrait: portrait({ mode: 'voix' }) })).toBe(false);
    expect(urgent({ portrait: portrait({ eliminee: true }) })).toBe(false);
    expect(urgent({ portrait: portrait({ trouvee: 1 }) })).toBe(false);
  });
});
