import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cheminFond } from '../src/lib/fonds';
import { derniereSoireeExpiree, purgerFondsExpires } from '../src/lib/purge';
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
 * Photos de fond des jeux (2026-11-15) : un bucket privé, lu et écrit par l'animateur de la
 * soirée seulement ; la colonne `manches.fond` ne prend qu'un chemin de son dossier ;
 * `etat_ecran` la donne ; la purge la retire 30 jours après la soirée.
 */
const avecBase = describe.skipIf(!baseDisponible);

/** Un JPEG réduit à ses en-têtes : le bucket ne regarde que le type annoncé. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0, 0, 0, 0, 0xff, 0xd9]);

avecBase('photos de fond des jeux', () => {
  let soiree: { id: string; code: string };
  let manche: string;
  const deposes: string[] = [];
  const nouveau = () => {
    const chemin = cheminFond(soiree.id, randomUUID());
    deposes.push(chemin);
    return chemin;
  };

  beforeAll(async () => {
    // Animée par Anna.
    soiree = await creerEvenementJetable({ equipes: 1, langues: ['fr'] });
    const { data, error } = await clientService()
      .from('manches')
      .insert({ evenement_id: soiree.id, jeu: 'qcm2', ordre: 1 })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    manche = (data as { id: string }).id;
  });

  afterAll(async () => {
    await clientService().storage.from('fonds').remove(deposes);
    await supprimerEvenements([soiree.id]);
  });

  it("l'animateur de la soirée dépose la photo d'un jeu, l'écran en reçoit le chemin", async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const chemin = nouveau();
    const depot = await anna.storage
      .from('fonds')
      .upload(chemin, JPEG, { contentType: 'image/jpeg' });
    expect(depot.error).toBeNull();
    const { error } = await anna.from('manches').update({ fond: chemin }).eq('id', manche);
    expect(error).toBeNull();

    const { data } = await appeler<{ programme: { id: string; fond: string | null }[] }>(
      anna,
      'etat_ecran',
      { p_code: soiree.code },
    );
    expect(data!.programme.find((m) => m.id === manche)?.fond).toBe(chemin);

    // Bucket privé : l'adresse publique ne donne rien, l'URL signée de l'animateur si.
    const { data: signee } = await anna.storage.from('fonds').createSignedUrl(chemin, 60);
    const lecture = await fetch(signee!.signedUrl);
    expect(lecture.status).toBe(200);
    expect(Buffer.from(await lecture.arrayBuffer()).equals(Buffer.from(JPEG))).toBe(true);
  });

  it("un autre animateur ne lit, ne dépose, n'écrit et ne retire rien pour cette soirée", async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const brahim = await clientAnimateur('brahim@teamup.test');
    const enPlace = nouveau();
    await anna.storage.from('fonds').upload(enPlace, JPEG, { contentType: 'image/jpeg' });

    const { data: signee } = await brahim.storage.from('fonds').createSignedUrl(enPlace, 60);
    expect(signee).toBeNull();
    const depot = await brahim.storage
      .from('fonds')
      .upload(nouveau(), JPEG, { contentType: 'image/jpeg' });
    expect(depot.error).not.toBeNull();
    const { data: ecrites } = await brahim
      .from('manches')
      .update({ fond: enPlace })
      .eq('id', manche)
      .select('id');
    expect(ecrites ?? []).toHaveLength(0);
    const retrait = await brahim.storage.from('fonds').remove([enPlace]);
    expect(retrait.data ?? []).toHaveLength(0);
  });

  it('sans compte, rien ne se lit ni ne se dépose', async () => {
    const anon = clientAnon();
    const depot = await anon.storage
      .from('fonds')
      .upload(nouveau(), JPEG, { contentType: 'image/jpeg' });
    expect(depot.error).not.toBeNull();
    const { data: signee } = await anon.storage.from('fonds').createSignedUrl(deposes[0]!, 60);
    expect(signee).toBeNull();
  });

  it("le bucket n'accepte que du JPEG, jusqu'à 1 Mo", async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const png = await anna.storage
      .from('fonds')
      .upload(nouveau(), JPEG, { contentType: 'image/png' });
    expect(png.error).not.toBeNull();
    const lourd = await anna.storage
      .from('fonds')
      .upload(nouveau(), Buffer.alloc(1024 * 1024 + 1), { contentType: 'image/jpeg' });
    expect(lourd.error).not.toBeNull();
  });

  it("la base refuse un chemin qui n'est pas dans le dossier de la soirée", async () => {
    const service = clientService();
    for (const chemin of [
      cheminFond(randomUUID(), randomUUID()),
      `${soiree.id}/fond.jpg`,
      `${soiree.id}/${randomUUID()}.png`,
      'https://exemple.test/fond.jpg',
    ]) {
      const { error } = await service.from('manches').update({ fond: chemin }).eq('id', manche);
      expect(error?.message, chemin).toMatch(/manches_fond_forme/);
    }
  });

  it('la purge retire la photo 31 jours après la soirée, pas avant', async () => {
    const service = clientService();
    const chemin = nouveau();
    await service.storage.from('fonds').upload(chemin, JPEG, { contentType: 'image/jpeg' });
    await service.from('manches').update({ fond: chemin }).eq('id', manche);

    // La soirée a lieu aujourd'hui : rien ne part.
    await service
      .from('evenements')
      .update({ date_evenement: new Date().toISOString().slice(0, 10) })
      .eq('id', soiree.id);
    await purgerFondsExpires(service);
    const lire = async () =>
      (
        (await service.from('manches').select('fond').eq('id', manche).single()).data as {
          fond: string | null;
        }
      ).fond;
    expect(await lire()).toBe(chemin);

    // Passée depuis 31 jours : la photo part, fichier et colonne.
    await service
      .from('evenements')
      .update({ date_evenement: derniereSoireeExpiree(new Date()) })
      .eq('id', soiree.id);
    expect(await purgerFondsExpires(service)).toBeGreaterThanOrEqual(1);
    expect(await lire()).toBeNull();
    const { data: fichiers } = await service.storage.from('fonds').list(soiree.id);
    expect((fichiers ?? []).map((f) => f.name)).not.toContain(chemin.split('/')[1]);
  });
});
