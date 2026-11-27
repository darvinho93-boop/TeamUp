import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  baseDisponible,
  clientAnimateur,
  clientAnon,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from './base';

/**
 * Le thème d'une soirée (2026-11-27) : posé par la clé de service seule, lu par l'animateur de la
 * soirée seul. Ses fichiers, dans le bucket privé « themes », se lisent par tout animateur (une
 * copie de soirée reprend ceux de l'originale) et ne s'écrivent pas depuis l'app.
 */
const avecBase = describe.skipIf(!baseDisponible);

const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" stroke="black"/></svg>',
);
const dossier = `essai-${randomUUID().slice(0, 8)}`;
const chemin = `${dossier}/illustration.svg`;
let evenement: { id: string; code: string };

beforeAll(async () => {
  if (!baseDisponible) return;
  const service = clientService();
  evenement = await creerEvenementJetable();
  const { error: depot } = await service.storage
    .from('themes')
    .upload(chemin, SVG, { contentType: 'image/svg+xml' });
  expect(depot).toBeNull();
  const { error } = await service.from('themes_soiree').insert({
    evenement_id: evenement.id,
    theme: 'faire-part',
    fichiers: { illustration: chemin },
    reglages: { date: 'Samedi', orchestre_ms: 2000, notes_ms: [] },
  });
  expect(error).toBeNull();
});

afterAll(async () => {
  if (!baseDisponible) return;
  await clientService().storage.from('themes').remove([chemin]);
  if (evenement) await supprimerEvenements([evenement.id]);
});

avecBase('le thème d’une soirée', () => {
  it('se lit par son animateur, pas par un autre ni sans compte', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const { data } = await anna
      .from('themes_soiree')
      .select('theme')
      .eq('evenement_id', evenement.id);
    expect(data).toEqual([{ theme: 'faire-part' }]);

    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data: autre } = await brahim
      .from('themes_soiree')
      .select('theme')
      .eq('evenement_id', evenement.id);
    expect(autre).toEqual([]);

    const { data: personne } = await clientAnon()
      .from('themes_soiree')
      .select('theme')
      .eq('evenement_id', evenement.id);
    expect(personne ?? []).toEqual([]);
  });

  it('ne se pose, ne se change ni ne s’enlève depuis l’app', async () => {
    const anna = await clientAnimateur('anna@teamup.test');
    const autre = await creerEvenementJetable();
    const { error: pose } = await anna.from('themes_soiree').insert({
      evenement_id: autre.id,
      theme: 'faire-part',
      fichiers: {},
    });
    await supprimerEvenements([autre.id]);
    expect(pose).not.toBeNull();
    await anna
      .from('themes_soiree')
      .update({ reglages: { date: 'Changée' } })
      .eq('evenement_id', evenement.id);
    await anna.from('themes_soiree').delete().eq('evenement_id', evenement.id);
    const { data } = await clientService()
      .from('themes_soiree')
      .select('reglages')
      .eq('evenement_id', evenement.id)
      .single();
    expect((data as { reglages: { date: string } }).reglages.date).toBe('Samedi');
  });

  it('a ses fichiers lisibles par un animateur, jamais sans compte, jamais déposés par l’app', async () => {
    const brahim = await clientAnimateur('brahim@teamup.test');
    const { data: signee, error } = await brahim.storage.from('themes').createSignedUrl(chemin, 60);
    expect(error).toBeNull();
    expect(signee?.signedUrl).toContain('illustration.svg');

    const { error: anon } = await clientAnon().storage.from('themes').createSignedUrl(chemin, 60);
    expect(anon).not.toBeNull();

    const { error: depot } = await brahim.storage
      .from('themes')
      .upload(`${dossier}/intrus.svg`, SVG, { contentType: 'image/svg+xml' });
    expect(depot).not.toBeNull();
  });

  it('part avec sa soirée', async () => {
    const copie = await creerEvenementJetable();
    const service = clientService();
    await service.from('themes_soiree').insert({
      evenement_id: copie.id,
      theme: 'faire-part',
      fichiers: { illustration: chemin },
    });
    await supprimerEvenements([copie.id]);
    const { data } = await service
      .from('themes_soiree')
      .select('theme')
      .eq('evenement_id', copie.id);
    expect(data).toEqual([]);
  });
});
