import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDisponible, clientAnimateur, clientAnon, clientService } from './base';

/**
 * La bibliothèque de musiques (2026-11-15) : un admin écrit, un animateur lit (pour cocher à la
 * préparation et jouer à l'écran), personne d'autre. Le bucket est privé, MP3 seul.
 */
const avecBase = describe.skipIf(!baseDisponible);

/** Un vrai début de MP3 (étiquette ID3 vide), suffisant pour le stockage. */
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const chemins: string[] = [];
const ids: string[] = [];

const nouveauChemin = () => {
  const chemin = `${randomUUID()}.mp3`;
  chemins.push(chemin);
  return chemin;
};

let musique: { id: string; chemin: string };

beforeAll(async () => {
  if (!baseDisponible) return;
  const admin = await clientAnimateur('admin@teamup.test');
  const chemin = nouveauChemin();
  const { error: depot } = await admin.storage
    .from('musiques')
    .upload(chemin, MP3, { contentType: 'audio/mpeg' });
  expect(depot).toBeNull();
  const { data, error } = await admin
    .from('musiques')
    .insert({ titre: 'Générique de test', chemin, taille: MP3.length })
    .select('id, chemin')
    .single();
  expect(error).toBeNull();
  musique = data as { id: string; chemin: string };
  ids.push(musique.id);
});

afterAll(async () => {
  if (!baseDisponible) return;
  const service = clientService();
  if (ids.length) await service.from('musiques').delete().in('id', ids);
  if (chemins.length) await service.storage.from('musiques').remove(chemins);
});

avecBase('la bibliothèque de musiques', () => {
  it('se lit par un animateur, pas sans compte', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { data } = await anna.from('musiques').select('id, titre').eq('id', musique.id);
    expect(data).toEqual([{ id: musique.id, titre: 'Générique de test' }]);
    const { data: signee, error } = await anna.storage
      .from('musiques')
      .createSignedUrl(musique.chemin, 60);
    expect(error).toBeNull();
    expect(signee?.signedUrl).toContain(musique.chemin);

    const anon = clientAnon();
    const { data: rien } = await anon.from('musiques').select('id').eq('id', musique.id);
    expect(rien ?? []).toEqual([]);
    const { error: refus } = await anon.storage
      .from('musiques')
      .createSignedUrl(musique.chemin, 60);
    expect(refus).not.toBeNull();
  });

  it('ne s’écrit que par un admin : un animateur ne dépose ni ne modifie', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { error: depot } = await anna.storage
      .from('musiques')
      .upload(nouveauChemin(), MP3, { contentType: 'audio/mpeg' });
    expect(depot).not.toBeNull();
    const { error: ligne } = await anna
      .from('musiques')
      .insert({ titre: 'Intrus', chemin: nouveauChemin(), taille: 10 });
    expect(ligne).not.toBeNull();
    const { data: modifiees } = await anna
      .from('musiques')
      .update({ actif: false })
      .eq('id', musique.id)
      .select('id');
    expect(modifiees ?? []).toEqual([]);
  });

  it('refuse un autre type que le MP3, un chemin hors forme, un titre vide', async () => {
    const admin = await clientAnimateur('admin@teamup.test');
    const { error: type } = await admin.storage
      .from('musiques')
      .upload(nouveauChemin(), MP3, { contentType: 'image/png' });
    expect(type).not.toBeNull();
    const { error: nom } = await admin.storage
      .from('musiques')
      .upload('dossier/musique.mp3', MP3, { contentType: 'audio/mpeg' });
    expect(nom).not.toBeNull();
    const { error: titre } = await admin
      .from('musiques')
      .insert({ titre: '  ', chemin: nouveauChemin(), taille: 10 });
    expect(titre).not.toBeNull();
    const { error: forme } = await admin
      .from('musiques')
      .insert({ titre: 'Forme', chemin: 'pas-un-uuid.mp3', taille: 10 });
    expect(forme).not.toBeNull();
  });

  it('se désactive par l’admin, sans disparaître', async () => {
    const admin = await clientAnimateur('admin@teamup.test');
    const { error } = await admin.from('musiques').update({ actif: false }).eq('id', musique.id);
    expect(error).toBeNull();
    const anna = await clientAnimateur('anna@teamup.test');
    const { data } = await anna.from('musiques').select('actif').eq('id', musique.id).single();
    expect(data).toEqual({ actif: false });
  });
});
