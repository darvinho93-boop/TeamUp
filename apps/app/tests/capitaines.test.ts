import { afterAll, describe, expect, it } from 'vitest';
import {
  appeler,
  baseDisponible,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from './base';

const avecBase = describe.skipIf(!baseDisponible);

const crees: string[] = [];
afterAll(() => supprimerEvenements(crees));

async function soiree(equipes = 1) {
  const evenement = await creerEvenementJetable({ equipes, langues: ['fr'] });
  crees.push(evenement.id);
  return evenement;
}

let compteur = 0;

/** Un invité qui arrive par le QR code, volontaire ou non ; renvoie son jeton. */
async function arriver(code: string, prenom: string, volontaire: boolean) {
  compteur += 1;
  const jeton = `capitaines-${code}-${compteur}`;
  const { erreur } = await appeler(clientService(), 'rejoindre_evenement', {
    p_code: code,
    p_prenom: prenom,
    p_langue: 'fr',
    p_jeton_hash: hacher(jeton),
    p_volontaire: volontaire,
  });
  if (erreur) throw new Error(erreur);
  return jeton;
}

async function capitaines(evenementId: string) {
  const { data } = await clientService()
    .from('joueurs')
    .select('prenom')
    .eq('evenement_id', evenementId)
    .eq('capitaine', true);
  return (data as { prenom: string }[]).map((j) => j.prenom).sort();
}

const tirer = async (evenementId: string, email = 'anna@teamup.test') =>
  appeler<number>(await clientAnimateur(email), 'tirer_capitaines', { p_evenement: evenementId });

const renommer = (jeton: string, nom: string) =>
  appeler<{ nom: string }>(clientService(), 'renommer_equipe', {
    p_jeton_hash: hacher(jeton),
    p_nom: nom,
  });

avecBase('le tirage des capitaines', () => {
  it('garde le volontariat donné à l’arrivée', async () => {
    const { id, code } = await soiree();
    await arriver(code, 'Vera', true);
    await arriver(code, 'Nils', false);
    const { data } = await clientService()
      .from('joueurs')
      .select('prenom, volontaire')
      .eq('evenement_id', id)
      .order('prenom');
    expect(data).toEqual([
      { prenom: 'Nils', volontaire: false },
      { prenom: 'Vera', volontaire: true },
    ]);
  });

  it('choisit un volontaire, même parmi d’autres joueurs', async () => {
    const { id, code } = await soiree();
    for (const prenom of ['Amir', 'Bea', 'Cleo', 'Dan']) await arriver(code, prenom, false);
    await arriver(code, 'Vera', true);
    expect((await tirer(id)).data).toBe(1);
    expect(await capitaines(id)).toEqual(['Vera']);
  });

  it('sans volontaire, tire parmi les joueurs qui ont un téléphone', async () => {
    const { id, code } = await soiree();
    await arriver(code, 'Amir', false);
    await appeler(await clientAnimateur('anna@teamup.test'), 'ajouter_invite_regie', {
      p_evenement: id,
      p_prenom: 'Sans téléphone',
    });
    expect((await tirer(id)).data).toBe(1);
    expect(await capitaines(id)).toEqual(['Amir']);
  });

  it('garde un capitaine déjà nommé, et ne tire rien une seconde fois', async () => {
    const { id, code } = await soiree(2);
    await arriver(code, 'Amir', false); // équipe 1
    await arriver(code, 'Bea', false); // équipe 2
    await arriver(code, 'Vera', true); // équipe 1
    const anna = await clientAnimateur('anna@teamup.test');
    await anna
      .from('joueurs')
      .update({ capitaine: true })
      .eq('evenement_id', id)
      .eq('prenom', 'Amir');
    expect((await tirer(id)).data).toBe(1);
    expect(await capitaines(id)).toEqual(['Amir', 'Bea']);
    expect((await tirer(id)).data).toBe(0);
  });

  it('ne laisse rien tirer à un animateur d’une autre soirée', async () => {
    const { id, code } = await soiree();
    await arriver(code, 'Amir', true);
    expect((await tirer(id, 'brahim@teamup.test')).data).toBe(0);
    expect(await capitaines(id)).toEqual([]);
  });
});

avecBase('le capitaine renomme son équipe', () => {
  it('change le nom, que l’écran et les téléphones voient', async () => {
    const { id, code } = await soiree();
    const jeton = await arriver(code, 'Vera', true);
    await tirer(id);
    const { data, erreur } = await renommer(jeton, '  Les Invincibles ');
    expect(erreur).toBeNull();
    expect(data!.nom).toBe('Les Invincibles');
    const { data: ecran } = await appeler<{ equipes: { nom: string }[] }>(
      await clientAnimateur('anna@teamup.test'),
      'etat_ecran',
      { p_code: code },
    );
    expect(ecran!.equipes[0]!.nom).toBe('Les Invincibles');
    const { data: tel } = await appeler<{ equipe: { nom: string; nom_fige: boolean } }>(
      clientService(),
      'etat_joueur',
      { p_jeton_hash: hacher(jeton) },
    );
    expect(tel!.equipe).toMatchObject({ nom: 'Les Invincibles', nom_fige: false });
  });

  it('refuse un joueur qui n’est pas capitaine, et une session inconnue', async () => {
    const { code } = await soiree();
    const jeton = await arriver(code, 'Nils', false);
    expect((await renommer(jeton, 'Pirates')).erreur).toMatch(/pas capitaine/);
    expect((await renommer('inconnu', 'Pirates')).erreur).toMatch(/session inconnue/);
  });

  it('refuse un nom vide ou trop long', async () => {
    const { id, code } = await soiree();
    const jeton = await arriver(code, 'Vera', true);
    await tirer(id);
    expect((await renommer(jeton, '   ')).erreur).toMatch(/nom invalide/);
    expect((await renommer(jeton, 'x'.repeat(25))).erreur).toMatch(/nom invalide/);
    expect((await renommer(jeton, 'x'.repeat(24))).erreur).toBeNull();
  });

  it('refuse quand la régie a figé le nom', async () => {
    const { id, code } = await soiree();
    const jeton = await arriver(code, 'Vera', true);
    await tirer(id);
    const anna = await clientAnimateur('anna@teamup.test');
    await anna.from('equipes').update({ nom_fige: true }).eq('evenement_id', id);
    expect((await renommer(jeton, 'Pirates')).erreur).toMatch(/nom figé/);
    const { data: tel } = await appeler<{ equipe: { nom_fige: boolean } }>(
      clientService(),
      'etat_joueur',
      { p_jeton_hash: hacher(jeton) },
    );
    expect(tel!.equipe.nom_fige).toBe(true);
  });

  it('ne s’appelle qu’avec le rôle de service', async () => {
    const { erreur } = await appeler(await clientAnimateur('anna@teamup.test'), 'renommer_equipe', {
      p_jeton_hash: 'x',
      p_nom: 'Pirates',
    });
    expect(erreur).toMatch(/permission denied/);
  });
});
