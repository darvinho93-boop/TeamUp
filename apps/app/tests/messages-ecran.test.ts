import { describe, expect, it } from 'vitest';
import {
  ATTENTE_BULLE_MAX_MS,
  DUREE_BULLE_MS,
  SORTIE_BULLE_MS,
  attenteDuRefus,
  bullesA,
  bullesEnCours,
  caracteresRestants,
  nettoyerMessage,
  planDesBulles,
  type MessageSalle,
} from '../src/lib/messages';

const message = (id: string, cree_ms: number, retire = false): MessageSalle => ({
  id,
  prenom: id,
  regie: false,
  equipe: 1,
  texte: `Message ${id}`,
  cree_ms,
  retire,
});

describe('nettoyerMessage', () => {
  it('une ligne, espaces réduits, bords retirés', () => {
    expect(nettoyerMessage('  Vive\nles \t mariés !\u0007 ')).toBe('Vive les mariés !');
  });
  it('vide ou au-delà de 100 caractères : refusé', () => {
    expect(nettoyerMessage(' \n ')).toBeNull();
    expect(nettoyerMessage('x'.repeat(101))).toBeNull();
    expect(nettoyerMessage('x'.repeat(100))).toBe('x'.repeat(100));
  });
  it('un émoji compte pour un caractère, comme dans la base', () => {
    expect(nettoyerMessage('🎉'.repeat(100))).toBe('🎉'.repeat(100));
    expect(caracteresRestants('🎉🎉')).toBe(98);
  });
});

describe('planDesBulles', () => {
  it('trois bulles à la fois, la quatrième attend la première place libre', () => {
    const plan = planDesBulles([
      message('a', 0),
      message('b', 100),
      message('c', 200),
      message('d', 300),
    ]);
    expect(plan.map((b) => [b.message.id, b.debutMs])).toEqual([
      ['a', 0],
      ['b', 100],
      ['c', 200],
      ['d', DUREE_BULLE_MS],
    ]);
  });

  it('un message qui attendrait plus de 60 s est abandonné, sans prendre de place', () => {
    // 3 places × 8 s : au 25e message envoyé d'un coup, l'attente dépasse 60 s.
    const rafale = Array.from({ length: 30 }, (_, i) => message(String(i).padStart(2, '0'), i));
    const plan = planDesBulles(rafale);
    expect(plan.every((b) => b.debutMs - b.message.cree_ms <= ATTENTE_BULLE_MAX_MS)).toBe(true);
    expect(plan.length).toBeLessThan(30);
    expect(plan.length).toBe(24);
  });

  it('ne dépend pas de l’ordre reçu ; un message retiré ne prend aucune place', () => {
    const liste = [message('b', 100), message('a', 0), message('x', 50, true)];
    expect(planDesBulles(liste).map((b) => b.message.id)).toEqual(['a', 'b']);
  });
});

describe('bullesA', () => {
  const liste = [message('a', 1000), message('b', 3000)];

  it('montre les bulles en cours, et signale celle qui s’efface', () => {
    expect(bullesA(liste, 500)).toEqual([]);
    expect(bullesA(liste, 2000).map((b) => b.message.id)).toEqual(['a']);
    const fin = bullesA(liste, 1000 + DUREE_BULLE_MS - SORTIE_BULLE_MS / 2);
    expect(fin.map((b) => [b.message.id, b.sortie])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    expect(bullesA(liste, 3000 + DUREE_BULLE_MS).map((b) => b.message.id)).toEqual([]);
  });

  it('bullesEnCours : vrai tant qu’une bulle est à l’écran ou en file', () => {
    expect(bullesEnCours(liste, 0)).toBe(true);
    expect(bullesEnCours(liste, 3000 + DUREE_BULLE_MS)).toBe(false);
  });
});

describe('attenteDuRefus', () => {
  it('lit le temps restant du refus de cadence', () => {
    expect(attenteDuRefus('trop tôt:12')).toBe(12);
    expect(attenteDuRefus('messages fermés')).toBeNull();
  });
});
