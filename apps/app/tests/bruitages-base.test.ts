import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientAnon,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from './base';

/**
 * Boîte à sons et habillage (2026-11-19, migration 20261121090000) : seul l'animateur de la
 * soirée fait jouer un son ou retire l'habillage ; ni l'un ni l'autre ne périment le pilotage ;
 * `etat_ecran` les rend à l'écran.
 */
const avecBase = describe.skipIf(!baseDisponible);

interface Etat {
  bruitage: { son: string; a_ms: number } | null;
  habillage: boolean;
}

let evenement: { id: string; code: string };

async function etat(): Promise<Etat> {
  const anna = await clientAnimateur('anna@teamup.test');
  const { data, erreur } = await appeler<Etat>(anna, 'etat_ecran', { p_code: evenement.code });
  if (!data) throw new Error(`etat_ecran : ${erreur}`);
  return data;
}

async function majLe(): Promise<string> {
  const { data } = await clientService()
    .from('pilotage')
    .select('maj_le')
    .eq('evenement_id', evenement.id)
    .single();
  return (data as { maj_le: string }).maj_le;
}

avecBase('boîte à sons et habillage', () => {
  beforeAll(async () => {
    evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  });
  afterAll(() => supprimerEvenements([evenement.id]));

  it('une soirée neuve : aucun bruitage, habillage actif', async () => {
    const e = await etat();
    expect(e.bruitage).toBeNull();
    expect(e.habillage).toBe(true);
  });

  it('l’animateur fait jouer un son, à l’heure de la base, sans périmer le pilotage', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const avant = await majLe();
    const debut = Date.now();
    const { erreur } = await appeler(anna, 'jouer_bruitage', {
      p_evenement: evenement.id,
      p_son: 'applaudissements',
    });
    expect(erreur).toBeNull();
    const e = await etat();
    expect(e.bruitage?.son).toBe('applaudissements');
    expect(Math.abs(e.bruitage!.a_ms - debut)).toBeLessThan(60_000);
    expect(await majLe()).toBe(avant);

    // Le même son rejoué : une nouvelle heure, que l'écran voit changer.
    await new Promise((r) => setTimeout(r, 20));
    await appeler(anna, 'jouer_bruitage', { p_evenement: evenement.id, p_son: 'applaudissements' });
    expect((await etat()).bruitage!.a_ms).toBeGreaterThan(e.bruitage!.a_ms);
  });

  it('refuse un son inconnu', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { erreur } = await appeler(anna, 'jouer_bruitage', {
      p_evenement: evenement.id,
      p_son: 'sirene',
    });
    expect(erreur).toMatch(/bruitage inconnu/);
  });

  it('ni un curieux ni l’animateur d’une autre soirée ne font jouer de son', async () => {
    const avant = (await etat()).bruitage;
    const { erreur } = await appeler(clientAnon(), 'jouer_bruitage', {
      p_evenement: evenement.id,
      p_son: 'buzzer',
    });
    expect(erreur).not.toBeNull();
    const brahim = await clientAnimateur('brahim@teamup.test');
    await appeler(brahim, 'jouer_bruitage', { p_evenement: evenement.id, p_son: 'buzzer' });
    await appeler(brahim, 'regler_habillage', { p_evenement: evenement.id, p_actif: false });
    const apres = await etat();
    expect(apres.bruitage).toEqual(avant);
    expect(apres.habillage).toBe(true);
  });

  it('l’animateur retire puis remet l’habillage, sans périmer le pilotage', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const avant = await majLe();
    await appeler(anna, 'regler_habillage', { p_evenement: evenement.id, p_actif: false });
    expect((await etat()).habillage).toBe(false);
    await appeler(anna, 'regler_habillage', { p_evenement: evenement.id, p_actif: true });
    expect((await etat()).habillage).toBe(true);
    expect(await majLe()).toBe(avant);
  });
});
