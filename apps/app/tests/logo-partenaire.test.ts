import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cheminLogo, dimensionsPng, logoAcceptable, TAILLE_MAX_LOGO } from '../src/lib/logo';
import {
  acces,
  appeler,
  baseDisponible,
  clientAnimateur,
  clientAnon,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from './base';
import { fabriquerPng } from './png';

const avecBase = describe.skipIf(!baseDisponible);

const PNG = fabriquerPng(120, 40, [{ x: 10, y: 5, l: 100, h: 30 }]);
const publique = (chemin: string) => `${acces!.url}/storage/v1/object/public/logos/${chemin}`;

describe('le PNG de test', () => {
  it('passe le contrôle du serveur', () => {
    expect(dimensionsPng(PNG)).toEqual({ largeur: 120, hauteur: 40 });
    expect(logoAcceptable(PNG)).toBe(true);
  });
});

avecBase('logo du partenaire', () => {
  let soiree: { id: string; code: string };
  const deposes: string[] = [];
  const nouveau = () => {
    const chemin = cheminLogo(soiree.id, randomUUID());
    deposes.push(chemin);
    return chemin;
  };

  beforeAll(async () => {
    // Animée par Anna.
    soiree = await creerEvenementJetable({ equipes: 1, langues: ['fr'] });
  });

  afterAll(async () => {
    await clientService().storage.from('logos').remove(deposes);
    await supprimerEvenements([soiree.id]);
  });

  it("l'animateur de la soirée dépose son logo, l'écran en reçoit le chemin, tout le monde le lit", async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const chemin = nouveau();

    const depot = await anna.storage
      .from('logos')
      .upload(chemin, PNG, { contentType: 'image/png' });
    expect(depot.error).toBeNull();
    const { error } = await anna
      .from('evenements')
      .update({ logo_partenaire: chemin })
      .eq('id', soiree.id);
    expect(error).toBeNull();

    const { data } = await appeler<{ evenement: { logo_partenaire: string | null } }>(
      anna,
      'etat_ecran',
      { p_code: soiree.code },
    );
    expect(data!.evenement.logo_partenaire).toBe(chemin);

    // Bucket public : l'écran l'affiche sans URL signée, qui ne tiendrait pas la soirée.
    const lecture = await fetch(publique(chemin));
    expect(lecture.status).toBe(200);
    expect(lecture.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await lecture.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("un autre animateur ne dépose pas, n'écrit pas et ne retire rien pour cette soirée", async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const brahim = await clientAnimateur('brahim@teamup.test');
    const enPlace = nouveau();
    await anna.storage.from('logos').upload(enPlace, PNG, { contentType: 'image/png' });

    const depot = await brahim.storage
      .from('logos')
      .upload(nouveau(), PNG, { contentType: 'image/png' });
    expect(depot.error).not.toBeNull();

    const { data: ecrites } = await brahim
      .from('evenements')
      .update({ logo_partenaire: enPlace })
      .eq('id', soiree.id)
      .select('id');
    expect(ecrites ?? []).toHaveLength(0);

    const retrait = await brahim.storage.from('logos').remove([enPlace]);
    expect(retrait.data ?? []).toHaveLength(0);
    expect((await fetch(publique(enPlace))).status).toBe(200);
  });

  it('sans compte, rien ne se dépose', async () => {
    const depot = await clientAnon()
      .storage.from('logos')
      .upload(nouveau(), PNG, { contentType: 'image/png' });
    expect(depot.error).not.toBeNull();
  });

  it("le bucket n'accepte que du PNG, jusqu'à 512 Ko", async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const autreType = await anna.storage
      .from('logos')
      .upload(nouveau(), PNG, { contentType: 'image/svg+xml' });
    expect(autreType.error).not.toBeNull();

    const lourd = Buffer.concat([PNG, Buffer.alloc(TAILLE_MAX_LOGO)]);
    const tropLourd = await anna.storage
      .from('logos')
      .upload(nouveau(), lourd, { contentType: 'image/png' });
    expect(tropLourd.error).not.toBeNull();
  });

  it("la base refuse un chemin qui n'est pas dans le dossier de la soirée", async () => {
    const service = clientService();
    for (const chemin of [
      cheminLogo(randomUUID(), randomUUID()),
      `${soiree.id}/logo.png`,
      `${soiree.id}/${randomUUID()}.svg`,
      'https://exemple.test/logo.png',
    ]) {
      const { error } = await service
        .from('evenements')
        .update({ logo_partenaire: chemin })
        .eq('id', soiree.id);
      expect(error?.message, chemin).toMatch(/evenements_logo_partenaire_forme/);
    }
  });

  it("le retrait par l'animateur rend le fichier introuvable", async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const chemin = nouveau();
    await anna.storage.from('logos').upload(chemin, PNG, { contentType: 'image/png' });
    expect((await fetch(publique(chemin))).status).toBe(200);

    const retrait = await anna.storage.from('logos').remove([chemin]);
    expect(retrait.data ?? []).toHaveLength(1);
    expect((await fetch(publique(chemin))).status).not.toBe(200);
  });
});
