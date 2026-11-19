import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COUP_FINALE_MS,
  deroule,
  estBattement,
  fichierDe,
  fondA,
  FOND_SOUS_UN_SON,
  INTERLUDE_MS,
  NIVEAUX,
  reglageDe,
  SONS,
  extraitA,
  FONDU_MUSIQUE_MS,
  monteeDuChrono,
  musiqueA,
  sonDuChrono,
  sonsDeLaFinale,
  sonsPour,
  type Instant,
} from '../src/lib/sons';
import { FINALE } from '../src/lib/ouverture';
import type { EtatSalle, MancheSalle } from '../src/lib/salle';

const instant = (extra: Partial<Instant> = {}): Instant => ({
  scene: 'accueil',
  etape: null,
  mancheId: null,
  passageId: null,
  jeu: null,
  joueurs: 0,
  chronoDepartMs: null,
  indices: 0,
  bruitageSon: null,
  bruitageMs: null,
  ...extra,
});
const enJeu = (jeu: Instant['jeu'], etape: string, passageId = 'p1') =>
  instant({ scene: 'jeu', mancheId: 'm1', jeu, etape, passageId });

describe('les fichiers de son', () => {
  it('existent tous, et chacun a son niveau', () => {
    for (const son of SONS) {
      const fichier = fileURLToPath(new URL(`../public${fichierDe(son)}`, import.meta.url));
      expect(existsSync(fichier), `${fichierDe(son)} (pnpm --filter @teamup/app sons)`).toBe(true);
      expect(NIVEAUX[son]).toBeGreaterThan(0);
      expect(NIVEAUX[son]).toBeLessThanOrEqual(1);
    }
  });
});

describe('le son d’un changement d’état', () => {
  it('reste muet quand rien ne change', () => {
    for (const i of [instant(), instant({ scene: 'podium' }), enJeu('list2', 'trouve')]) {
      expect(sonsPour(i, i)).toEqual([]);
    }
  });

  it('salue une arrivée à l’accueil, d’un seul son même pour dix invités', () => {
    expect(sonsPour(instant({ joueurs: 3 }), instant({ joueurs: 13 }))).toEqual(['arrivee']);
    // Pendant un jeu, un retardataire n'interrompt rien.
    expect(
      sonsPour(
        { ...enJeu('list2', 'lance'), joueurs: 3 },
        { ...enJeu('list2', 'lance'), joueurs: 4 },
      ),
    ).toEqual([]);
    // Un joueur retiré ne sonne pas.
    expect(sonsPour(instant({ joueurs: 3 }), instant({ joueurs: 2 }))).toEqual([]);
  });

  it('joue le jingle quand un nouveau jeu est présenté, pas quand on y revient', () => {
    const intro = instant({ scene: 'intro', mancheId: 'm1', jeu: 'list2' });
    expect(sonsPour(instant({ scene: 'programme' }), intro)).toEqual(['jingle']);
    expect(sonsPour(intro, { ...intro, mancheId: 'm2', jeu: 'qcm2' })).toEqual(['jingle']);
    // Une explication lancée puis arrêtée : même jeu, pas de nouveau jingle.
    expect(sonsPour(intro, { ...intro, etape: 'explication' })).toEqual([]);
    expect(sonsPour({ ...intro, etape: 'explication' }, intro)).toEqual([]);
  });

  it('lance le roulement au tirage de l’ordre', () => {
    const intro = instant({ scene: 'intro', mancheId: 'm1', jeu: 'mime2' });
    expect(sonsPour(intro, { ...intro, etape: 'tirage-ordre' })).toEqual(['roulement']);
    expect(
      sonsPour({ ...intro, etape: 'tirage-ordre' }, { ...intro, etape: 'tirage-ordre' }),
    ).toEqual([]);
  });

  it('lance le roulement au dévoilement des équipes, et quand on le rejoue', () => {
    const devoilement = instant({ scene: 'equipes', etape: 'formation', chronoDepartMs: 1000 });
    expect(sonsPour(instant(), devoilement)).toEqual(['roulement']);
    // Rejoué : un nouveau départ posé par la base.
    expect(sonsPour(devoilement, { ...devoilement, chronoDepartMs: 9000 })).toEqual(['roulement']);
    // Relu tel quel, ou retrouvé après un détour par une autre scène : rien.
    expect(sonsPour(devoilement, devoilement)).toEqual([]);
    expect(sonsPour({ ...devoilement, scene: 'programme' }, devoilement)).toEqual([]);
  });

  it('sonne la fanfare au podium', () => {
    expect(sonsPour(instant({ scene: 'scores' }), instant({ scene: 'podium' }))).toEqual([
      'fanfare',
    ]);
  });

  it.each([
    ['list2', 'lance', 'trouve', 'reussite'],
    ['list2', 'lance', 'echec', 'echec'],
    ['enchere2', 'chrono', 'tenu', 'reussite'],
    ['enchere2', 'chrono', 'rate', 'echec'],
    ['qcm2', 'survivants', 'resultat', 'reussite'],
    ['mime2', 'lance', 'trouve', 'reussite'],
    ['mime2', 'lance', 'rate', 'echec'],
    ['photo2', 'theme', 'gagnante', 'reussite'],
    ['grab', 'chrono', 'gagne', 'reussite'],
    ['cup', 'chrono', 'gagne', 'reussite'],
    ['grab', 'pret', 'tirage', 'roulement'],
    ['cup', 'tirage', 'face_a_face', 'revelation'],
    ['blind', 'ecoute', 'buzz', 'buzzer'],
  ] as const)('%s : %s → %s sonne « %s »', (jeu, de, vers, son) => {
    expect(sonsPour(enJeu(jeu, de), enJeu(jeu, vers))).toEqual([son]);
    // Relu tel quel, le verdict ne sonne pas une seconde fois.
    expect(sonsPour(enJeu(jeu, vers), enJeu(jeu, vers))).toEqual([]);
  });

  it('laisse la bonne réponse du quiz à la scène, qui joue son suspense', () => {
    expect(sonsPour(enJeu('qcm2', 'question'), enJeu('qcm2', 'reponse'))).toEqual([]);
  });

  it('sonne le top au départ de chaque chrono de jeu, sauf au Blind test et au Portrait', () => {
    const lance = (jeu: Instant['jeu'], etape: string, depart: number | null) => ({
      ...enJeu(jeu, etape),
      chronoDepartMs: depart,
    });
    expect(sonsPour(lance('list2', 'masque', null), lance('list2', 'lance', 1000))).toEqual([
      'top',
    ]);
    expect(sonsPour(lance('mime2', 'secret', null), lance('mime2', 'lance', 1000))).toEqual([
      'top',
    ]);
    expect(sonsPour(lance('enchere2', 'sujet', null), lance('enchere2', 'chrono', 1000))).toEqual([
      'top',
    ]);
    expect(sonsPour(lance('grab', 'face_a_face', null), lance('grab', 'chrono', 1000))).toEqual([
      'top',
    ]);
    // Le chrono gardé (un indice aux Points communs) ne resonne pas.
    expect(sonsPour(lance('list2', 'lance', 1000), lance('list2', 'lance', 1000))).toEqual([]);
    expect(sonsPour(lance('blind', 'pret', null), lance('blind', 'ecoute', 1000))).toEqual([]);
    expect(sonsPour(lance('portrait', 'pret', null), lance('portrait', 'vote', 1000))).toEqual([
      'indice',
    ]);
    // Hors jeu, le chrono de la salle (dévoilement, explication) garde ses propres sons.
    expect(
      sonsPour(
        instant({ scene: 'intro', mancheId: 'm1', jeu: 'list2' }),
        instant({
          scene: 'intro',
          mancheId: 'm1',
          jeu: 'list2',
          etape: 'explication',
          chronoDepartMs: 1000,
        }),
      ),
    ).toEqual([]);
  });

  it('fait glisser la question du quiz, puis chacune de ses réponses', () => {
    const question = (indices: number, depart: number | null = null) => ({
      ...enJeu('qcm2', 'question'),
      indices,
      chronoDepartMs: depart,
    });
    expect(sonsPour(enJeu('qcm2', 'pret'), question(0))).toEqual(['glisse']);
    expect(sonsPour(question(0), question(1))).toEqual(['glisse']);
    expect(sonsPour(question(3), question(4))).toEqual(['glisse']);
    // « Lancer le chrono » : le top, pas de glissé.
    expect(sonsPour(question(4), question(4, 1000))).toEqual(['top']);
    expect(sonsPour(question(4, 1000), question(4, 1000))).toEqual([]);
  });

  it('joue le son demandé par la boîte à sons de la régie, une fois, jamais au chargement', () => {
    const jeu = enJeu('list2', 'lance');
    const applaudir = { ...jeu, bruitageSon: 'applaudissements', bruitageMs: 1000 };
    expect(sonsPour(jeu, applaudir)).toEqual(['applaudissements']);
    // Relu tel quel : rien.
    expect(sonsPour(applaudir, applaudir)).toEqual([]);
    // Le même son redemandé : une nouvelle heure, il rejoue.
    expect(sonsPour(applaudir, { ...applaudir, bruitageMs: 5000 })).toEqual(['applaudissements']);
    expect(
      sonsPour(applaudir, { ...applaudir, bruitageSon: 'presentation', bruitageMs: 6000 }),
    ).toEqual(['presentation']);
    // Un son hors de la boîte n'est jamais joué.
    expect(sonsPour(jeu, { ...jeu, bruitageSon: 'finale', bruitageMs: 7000 })).toEqual([]);
  });

  it('roule pendant que le classement monte', () => {
    expect(sonsPour(instant({ scene: 'programme' }), instant({ scene: 'scores' }))).toEqual([
      'presentation',
    ]);
    expect(sonsPour(instant({ scene: 'scores' }), instant({ scene: 'scores' }))).toEqual([]);
  });

  it('laisse les autres touches silencieuses', () => {
    expect(sonsPour(enJeu('list2', 'pret'), enJeu('list2', 'consigne'))).toEqual([]);
    expect(sonsPour(enJeu('list2', 'masque'), enJeu('list2', 'lance'))).toEqual([]);
    expect(sonsPour(enJeu('photo2', 'theme'), enJeu('photo2', 'aucune'))).toEqual([]);
    expect(sonsPour(enJeu('list2', 'trouve'), enJeu('list2', 'pret', 'p2'))).toEqual([]);
  });

  it('resonne quand deux passages de suite ont le même verdict', () => {
    expect(sonsPour(enJeu('photo2', 'gagnante', 't1'), enJeu('photo2', 'gagnante', 't2'))).toEqual([
      'reussite',
    ]);
  });
});

describe('la musique de fond', () => {
  it('est l’ambiance à l’ouverture et à l’accueil, et rien pendant les jeux', () => {
    expect(fondA(instant({ scene: 'ouverture' }))).toBe('ambiance');
    expect(fondA(instant())).toBe('ambiance');
    expect(fondA(instant({ scene: 'equipes' }))).toBeNull();
    expect(fondA(enJeu('qcm2', 'question'))).toBeNull();
  });

  it('accompagne l’explication animée d’un jeu, pas son intro fixe ni le tirage', () => {
    const intro = instant({ scene: 'intro', mancheId: 'm1', jeu: 'qcm2' });
    expect(fondA(intro)).toBeNull();
    expect(fondA({ ...intro, etape: 'explication' })).toBe('explication');
    expect(fondA({ ...intro, etape: 'explication-telephone' })).toBe('explication');
    expect(fondA({ ...intro, etape: 'tirage-ordre' })).toBeNull();
  });
});

describe('la passe finale de l’ouverture', () => {
  it('joue la piste du reel, son coup sur le logo (2026-10-18)', () => {
    expect(sonsDeLaFinale()).toEqual([{ son: 'finale', apresMs: FINALE.logo - COUP_FINALE_MS }]);
    expect(FINALE.logo - COUP_FINALE_MS).toBeGreaterThanOrEqual(0);
  });

  it('reprise en cours de boucle, part plus tôt ou en route, le coup toujours sur le logo', () => {
    const avance = FINALE.logo - COUP_FINALE_MS;
    expect(sonsDeLaFinale(1000)).toEqual([{ son: 'finale', apresMs: avance - 1000 }]);
    expect(sonsDeLaFinale(4000)).toEqual([
      { son: 'finale', apresMs: 0, dansLeSonMs: 4000 - avance },
    ]);
  });

  it('le coup annoncé est bien celui du fichier, à 15 ms près', () => {
    const octets = readFileSync(new URL('../public/sons/finale.wav', import.meta.url));
    const frequence = octets.readUInt32LE(24);
    let crete = 0;
    let coup = 0;
    for (let i = 44; i + 1 < octets.length; i += 2) {
      const v = Math.abs(octets.readInt16LE(i));
      if (v > crete) {
        crete = v;
        coup = (i - 44) / 2;
      }
    }
    expect(Math.abs((coup / frequence) * 1000 - COUP_FINALE_MS)).toBeLessThan(15);
  });

  it('ne sonne pas au clic : l’écran la joue quand la boucle en cours a fini', () => {
    expect(sonsPour(instant({ scene: 'ouverture' }), instant())).toEqual([]);
  });
});

describe('présenter un jeu', () => {
  it('se déroule en deux temps : le roulement sous le logo, puis le jingle sur le nom du jeu', () => {
    expect(deroule('jingle', false)).toEqual([
      { son: 'presentation', apresMs: 0 },
      { son: 'jingle', apresMs: INTERLUDE_MS },
    ]);
  });

  it('sans mouvement, il n’y a pas d’interlude : le jingle part seul', () => {
    expect(deroule('jingle', true)).toEqual([{ son: 'jingle', apresMs: 0 }]);
  });

  it('laisse les autres sons partir tout de suite', () => {
    expect(deroule('fanfare', false)).toEqual([{ son: 'fanfare', apresMs: 0 }]);
  });
});

describe('le battement du chrono', () => {
  it('se tait au-dessus des dix dernières secondes', () => {
    expect(sonDuChrono(130)).toBeNull();
    expect(sonDuChrono(11)).toBeNull();
  });

  it('alterne tic et tac, puis sonne la fin', () => {
    expect([10, 9, 8, 1].map(sonDuChrono)).toEqual(['tic', 'tac', 'tic', 'tac']);
    expect(sonDuChrono(0)).toBe('fin-de-temps');
  });
});

describe('le réglage de la régie', () => {
  it('vaut « actif à 80 » tant que la base ne le donne pas', () => {
    expect(reglageDe({})).toEqual({ actif: true, volume: 80 });
  });

  it('suit la régie, borné de 0 à 100', () => {
    expect(reglageDe({ son: { actif: false, volume: 35 } })).toEqual({ actif: false, volume: 35 });
    expect(reglageDe({ son: { actif: true, volume: 250 } })).toEqual({ actif: true, volume: 100 });
  });
});

describe('un son à la fois', () => {
  it('seuls les battements du chrono se posent sur un autre son', () => {
    expect(SONS.filter(estBattement)).toEqual(['tic', 'tac']);
  });

  it('la musique de fond s’efface sous un son, sans s’arrêter', () => {
    expect(FOND_SOUS_UN_SON).toBeGreaterThan(0);
    expect(FOND_SOUS_UN_SON).toBeLessThan(0.5);
  });
});

describe('la montée des dernières secondes', () => {
  it('monte en niveau et en vitesse de la dixième à la dernière seconde', () => {
    const montees = [10, 9, 5, 2, 1].map(monteeDuChrono);
    for (let i = 1; i < montees.length; i++) {
      expect(montees[i]!.gain).toBeGreaterThan(montees[i - 1]!.gain);
      expect(montees[i]!.vitesse).toBeGreaterThan(montees[i - 1]!.vitesse);
    }
    expect(monteeDuChrono(10)).toEqual({ gain: 0.7, vitesse: 1 });
    expect(monteeDuChrono(1).gain).toBeCloseTo(1.5);
    expect(monteeDuChrono(1).vitesse).toBeCloseTo(1.35);
  });
});

describe('la page Instagram et la clôture', () => {
  it('la clôture joue la piste du reel, une fois, son coup sur le logo', () => {
    expect(sonsPour(instant({ scene: 'podium' }), instant({ scene: 'cloture' }))).toEqual([
      'finale',
    ]);
    expect(sonsPour(instant({ scene: 'cloture' }), instant({ scene: 'cloture' }))).toEqual([]);
    expect(deroule('finale', false)).toEqual(sonsDeLaFinale());
    expect(deroule('finale', true)).toEqual([{ son: 'finale', apresMs: 0 }]);
  });

  it('l’ambiance joue sous la page Instagram et la clôture', () => {
    expect(fondA(instant({ scene: 'instagram' }))).toBe('ambiance');
    expect(fondA(instant({ scene: 'cloture' }))).toBe('ambiance');
    expect(fondA(instant({ scene: 'podium' }))).toBeNull();
  });
});

describe('la musique sous les chronos (2026-11-15)', () => {
  const T0 = 1_000_000;
  const passage = (id: string, ordre: number) => ({
    id,
    ordre,
    statut: 'en_cours' as const,
    equipe_id: null,
    points: null,
    resultat: {},
    contenu_id: null,
    public: {},
    secret: null,
  });
  const manche = (jeu: MancheSalle['jeu'], musiques: unknown): MancheSalle => ({
    id: 'm1',
    jeu,
    ordre: 1,
    statut: 'en_cours',
    options: { musiques },
    passages: [passage('p1', 1), passage('p2', 2), passage('p3', 3)],
  });
  const salle = (
    jeu: MancheSalle['jeu'],
    etape: string,
    passage_id = 'p1',
    musiques: unknown = ['a', 'b'],
    depart: number | null = T0,
  ): Pick<EtatSalle, 'pilotage' | 'programme'> => ({
    pilotage: {
      scene: 'jeu',
      manche_id: 'm1',
      passage_id,
      etape,
      indices: 4,
      chrono_depart_ms: depart,
      chrono_duree_s: depart === null ? null : 30,
      version: 'v1',
    },
    programme: [manche(jeu, musiques)],
  });
  const toutes = new Set(['a', 'b', 'c']);

  it('joue pendant le chrono d’une question, jusqu’aux dix dernières secondes', () => {
    expect(musiqueA(salle('qcm2', 'question'), T0 + 1000, toutes)).toEqual({
      id: 'a',
      // 30 s de chrono : « 10 » paraît à 19 s (secondes arrondies par défaut), et la musique
      // finit son fondu de sortie juste avant.
      jusquA: T0 + 19_000 - FONDU_MUSIQUE_MS,
    });
    expect(musiqueA(salle('qcm2', 'question'), T0 + 18_200, toutes)).toBeNull();
    // La question affichée, chrono pas encore lancé : rien.
    expect(musiqueA(salle('qcm2', 'question', 'p1', ['a'], null), T0, toutes)).toBeNull();
    expect(musiqueA(salle('qcm2', 'reponse'), T0 + 1000, toutes)).toBeNull();
  });

  it('joue pendant le chrono d’un thème de la Surenchère, pas sur la grille ni au verdict', () => {
    expect(musiqueA(salle('enchere2', 'chrono'), T0, toutes)?.id).toBe('a');
    for (const etape of ['themes', 'sujet', 'tenu', 'podium']) {
      expect(musiqueA(salle('enchere2', etape), T0, toutes)).toBeNull();
    }
    // Un autre jeu, même à une étape du même nom, n'en a pas.
    expect(musiqueA(salle('list2', 'chrono'), T0, toutes)).toBeNull();
  });

  it('tourne d’une question à l’autre, dans l’ordre des passages', () => {
    expect(musiqueA(salle('qcm2', 'question', 'p2'), T0, toutes)?.id).toBe('b');
    expect(musiqueA(salle('qcm2', 'question', 'p3'), T0, toutes)?.id).toBe('a');
  });

  it('ne joue que les musiques cochées et encore actives', () => {
    expect(musiqueA(salle('qcm2', 'question', 'p1', []), T0, toutes)).toBeNull();
    expect(musiqueA(salle('qcm2', 'question', 'p1', null), T0, toutes)).toBeNull();
    // « a » désactivée : la rotation se fait sur ce qui reste.
    expect(musiqueA(salle('qcm2', 'question', 'p1'), T0, new Set(['b']))?.id).toBe('b');
    expect(musiqueA(salle('qcm2', 'question', 'p1'), T0, new Set())).toBeNull();
  });
});

describe('l’extrait du blind test (2026-11-15)', () => {
  const T0 = 1_000_000;
  const salle = (
    etape: string,
    resultat: Record<string, unknown> = {},
    titres: unknown = [{ musique: 'a', debut_s: 45 }],
  ): Pick<EtatSalle, 'pilotage' | 'programme'> => ({
    pilotage: {
      scene: 'jeu',
      manche_id: 'm1',
      passage_id: 'p1',
      etape,
      indices: 0,
      chrono_depart_ms: T0,
      chrono_duree_s: 22,
      version: 'v1',
    },
    programme: [
      {
        id: 'm1',
        jeu: 'blind',
        ordre: 1,
        statut: 'en_cours',
        options: { extrait_s: 30, titres },
        passages: [
          {
            id: 'p1',
            ordre: 1,
            statut: 'en_cours',
            equipe_id: null,
            points: null,
            resultat,
            contenu_id: null,
            public: {},
            secret: null,
          },
        ],
      },
    ],
  });
  const actives = new Set(['a']);

  it('reprend là où l’écoute s’était arrêtée : début choisi, écoute faite, chrono en cours', () => {
    expect(extraitA(salle('ecoute', { ecoute_ms: 8000 }), T0 + 2500, actives)).toEqual({
      id: 'a',
      depuisS: 55.5,
      jusquA: T0 + 22_000,
    });
  });

  it('se tait hors de l’écoute, chrono écoulé, ou sans musique active', () => {
    for (const etape of ['pret', 'buzz', 'pause', 'revele']) {
      expect(extraitA(salle(etape), T0, actives)).toBeNull();
    }
    expect(extraitA(salle('ecoute'), T0 + 22_000, actives)).toBeNull();
    expect(extraitA(salle('ecoute'), T0, new Set())).toBeNull();
    expect(extraitA(salle('ecoute', {}, [{ musique: null, debut_s: 0 }]), T0, actives)).toBeNull();
  });
});
