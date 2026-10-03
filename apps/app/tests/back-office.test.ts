import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appeler, baseDisponible, clientAnimateur, clientService } from './base';

/**
 * Back-office (lot 9) : seul un admin écrit les banques, par `enregistrer_contenu`, qui vérifie
 * en base la forme de chaque langue ; seul un admin lit l'annuaire ; il reste toujours un admin.
 */

const avecBase = describe.skipIf(!baseDisponible);
const ADMIN = '11111111-1111-4111-8111-111111111111';

const pointCommun = (consigne: string) => ({
  public: { consigne },
  secret: { reponse: 'les lève-tôt', indices: ['Le matin', 'Un réveil'] },
});

avecBase('enregistrer un contenu', () => {
  let admin: Awaited<ReturnType<typeof clientAnimateur>>;
  let anna: Awaited<ReturnType<typeof clientAnimateur>>;
  const crees: string[] = [];

  beforeAll(async () => {
    admin = await clientAnimateur('admin@teamup.test');
    anna = await clientAnimateur('anna@teamup.test');
  });

  afterAll(async () => {
    if (crees.length) await clientService().from('contenus').delete().in('id', crees);
  });

  const enregistrer = (client: typeof admin, args: Record<string, unknown>) =>
    appeler<string>(client, 'enregistrer_contenu', {
      p_id: null,
      p_jeu: 'list2',
      p_etiquette: 'b2c',
      ...args,
    });

  it('un admin crée un contenu en trois langues, secret compris', async () => {
    const { data: id, erreur } = await enregistrer(admin, {
      p_langues: {
        fr: pointCommun('Levez-vous'),
        en: pointCommun('Stand up'),
        ta: pointCommun('எழுந்திருங்கள்'),
      },
    });
    expect(erreur).toBeNull();
    crees.push(id!);

    const service = clientService();
    const { data: contenu } = await service
      .from('contenus')
      .select('jeu, etiquette, cree_par')
      .eq('id', id!)
      .single();
    expect(contenu).toEqual({ jeu: 'list2', etiquette: 'b2c', cree_par: ADMIN });
    const { count: secrets } = await service
      .from('contenus_secrets')
      .select('*', { count: 'exact', head: true })
      .eq('contenu_id', id!);
    expect(secrets).toBe(3);
  });

  it('une modification remplace les langues : une langue retirée disparaît', async () => {
    const { data: id } = await enregistrer(admin, {
      p_langues: { fr: pointCommun('Avant'), en: pointCommun('Before') },
    });
    crees.push(id!);
    const { erreur } = await enregistrer(admin, {
      p_id: id,
      p_etiquette: 'tout_public',
      p_langues: { fr: pointCommun('Après') },
    });
    expect(erreur).toBeNull();

    const { data: traductions } = await clientService()
      .from('contenus_traductions')
      .select('langue, valeur')
      .eq('contenu_id', id!);
    expect(traductions).toEqual([{ langue: 'fr', valeur: { consigne: 'Après' } }]);
    const { count } = await clientService()
      .from('contenus_secrets')
      .select('*', { count: 'exact', head: true })
      .eq('contenu_id', id!);
    expect(count).toBe(1);
  });

  it.each([
    ['sans français', { en: pointCommun('Stand up') }],
    [
      'un indice manquant',
      { fr: { public: { consigne: 'X' }, secret: { reponse: 'Y', indices: ['Z'] } } },
    ],
    [
      'un secret glissé dans la partie publique',
      { fr: { ...pointCommun('X'), public: { consigne: 'X', reponse: 'Y' } } },
    ],
    ['une langue inconnue', { fr: pointCommun('X'), de: pointCommun('X') }],
  ])('refuse un contenu %s', async (_, langues) => {
    const { erreur } = await enregistrer(admin, { p_langues: langues });
    expect(erreur).not.toBeNull();
  });

  it('refuse un quiz dont la bonne réponse change selon la langue', async () => {
    const quiz = (bonne: number) => ({
      public: { question: 'Q ?', propositions: ['a', 'b', 'c', 'd'] },
      secret: { bonne },
    });
    const { erreur } = await enregistrer(admin, {
      p_jeu: 'qcm2',
      p_langues: { fr: quiz(1), en: quiz(2) },
    });
    expect(erreur).toMatch(/bonne réponse/);
    const { data: id, erreur: aucune } = await enregistrer(admin, {
      p_jeu: 'qcm2',
      p_langues: { fr: quiz(1), en: quiz(1) },
    });
    expect(aucune).toBeNull();
    crees.push(id!);
  });

  it('une photo n’a pas de secret', async () => {
    const { data: id, erreur } = await enregistrer(admin, {
      p_jeu: 'photo2',
      p_langues: { fr: { public: { theme: 'Un selfie' } } },
    });
    expect(erreur).toBeNull();
    crees.push(id!);
    const { erreur: refus } = await enregistrer(admin, {
      p_jeu: 'photo2',
      p_langues: { fr: { public: { theme: 'Un selfie' }, secret: { mot: 'x' } } },
    });
    expect(refus).not.toBeNull();
  });

  it('un animateur ne peut pas écrire les banques', async () => {
    const { erreur } = await enregistrer(anna, { p_langues: { fr: pointCommun('Levez-vous') } });
    expect(erreur).toMatch(/réservé aux admins/);
  });
});

avecBase('les comptes animateurs', () => {
  const EMAIL = `test-${Date.now()}@teamup.test`;
  let id: string;

  beforeAll(async () => {
    const { data, error } = await clientService().auth.admin.createUser({
      email: EMAIL,
      password: 'motdepasse',
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    id = data.user.id;
    await clientService().from('animateurs').insert({ id, nom: 'Testeur' });
  });

  afterAll(async () => {
    if (id) await clientService().auth.admin.deleteUser(id);
  });

  it("l'annuaire donne les e-mails à l'admin, rien à un animateur", async () => {
    const admin = await clientAnimateur('admin@teamup.test');
    const { data } = await appeler<{ email: string }[]>(admin, 'annuaire_animateurs', {});
    expect(data?.map((a) => a.email)).toEqual(expect.arrayContaining(['anna@teamup.test', EMAIL]));

    const anna = await clientAnimateur('anna@teamup.test');
    const { data: rien } = await appeler<unknown[]>(anna, 'annuaire_animateurs', {});
    expect(rien).toEqual([]);
  });

  it('un animateur désactivé ne lit plus rien, même avec sa session ouverte', async () => {
    const testeur = await clientAnimateur(EMAIL);
    const { data: avant } = await testeur.from('contenus').select('id').limit(1);
    expect(avant).toHaveLength(1);

    const admin = await clientAnimateur('admin@teamup.test');
    const { error } = await admin.from('animateurs').update({ actif: false }).eq('id', id);
    expect(error).toBeNull();

    const { data: apres } = await testeur.from('contenus').select('id').limit(1);
    expect(apres).toEqual([]);
  });

  it('le dernier admin actif ne peut pas être désactivé', async () => {
    const admin = await clientAnimateur('admin@teamup.test');
    const { error } = await admin.from('animateurs').update({ actif: false }).eq('id', ADMIN);
    expect(error?.message).toMatch(/au moins un admin actif/);
  });
});
