import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  deroule,
  estBattement,
  fichierDe,
  fondA,
  FOND_SOUS_UN_SON,
  INTERLUDE_MS,
  NIVEAUX,
  reglageDe,
  SONS,
  sonDuChrono,
  sonsPour,
  type Instant,
} from '../src/lib/sons';

const instant = (extra: Partial<Instant> = {}): Instant => ({
  scene: 'accueil',
  etape: null,
  mancheId: null,
  passageId: null,
  jeu: null,
  joueurs: 0,
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
    ['qcm2', 'question', 'reponse', 'revelation'],
    ['mime2', 'lance', 'trouve', 'reussite'],
    ['mime2', 'lance', 'rate', 'echec'],
    ['photo2', 'theme', 'gagnante', 'reussite'],
    ['grab', 'chrono', 'gagne', 'reussite'],
    ['cup', 'chrono', 'gagne', 'reussite'],
  ] as const)('%s : %s → %s sonne « %s »', (jeu, de, vers, son) => {
    expect(sonsPour(enJeu(jeu, de), enJeu(jeu, vers))).toEqual([son]);
    // Relu tel quel, le verdict ne sonne pas une seconde fois.
    expect(sonsPour(enJeu(jeu, vers), enJeu(jeu, vers))).toEqual([]);
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
  it('est l’ambiance à l’accueil, et rien pendant les jeux', () => {
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
