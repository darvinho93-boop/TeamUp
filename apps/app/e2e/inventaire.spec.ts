import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from '../tests/base';

/**
 * Inventaire visuel (2026-10-23) : chaque état de l'écran commun et du téléphone joueur, capturé
 * en taille réelle, pour la passe qualité / agencement. Hors CI : ne tourne qu'avec
 * `INVENTAIRE=<dossier>`, où les captures sont rangées.
 *   INVENTAIRE=C:/chemin pnpm exec playwright test e2e/inventaire.spec.ts --project=mobile
 */

const DOSSIER = process.env['INVENTAIRE'];
/** Fausses photos : une étiquette lisible au milieu (des images de test, hors de la charte). */
const TAILLE_ETIQUETTE = 120;
test.skip(!DOSSIER, 'inventaire visuel : INVENTAIRE=<dossier> pour le lancer');

type L = 'fr' | 'en' | 'ta';
type Tri<T> = Record<L, T>;

const PRENOMS = [
  'Alexandrine',
  'Jean-Christophe',
  'Kavya',
  'Léa',
  'Mohamed',
  'Priyanka',
  'Sébastien',
  'Thiruvalluvan',
  'Zoé',
  'Malik',
  'Anaïs',
  'Rajeshwari',
  'Hugo',
  'Inès',
  'Karthikeyan',
  'Chloé',
  'Nathan',
  'Sangeetha',
  'Yanis',
  'Camille',
  'Vignesh',
  'Maëlle',
  'Arjun',
  'Lucas',
  'Divya',
  'Emma',
  'Gabriel',
  'Lakshmi',
  'Louise',
  'Raphaël',
  'Shalini',
  'Jules',
  'Manon',
  'Sivakumar',
  'Clara',
  'Adam',
  'Meenakshi',
  'Arthur',
  'Jade',
  'Prakash',
  'Lina',
  'Noah',
  'Anitha',
  'Paul',
  'Rose',
  'Ganesh',
  'Alice',
  'Tom',
  'Kalaivani',
  'Victor',
  'Sarah',
  'Murugan',
  'Lou',
  'Ethan',
  'Nithya',
  'Mathis',
  'Eva',
  'Balasubramaniam',
  'Romane',
  'Théo',
  'Deepika',
  'Axel',
  'Julia',
  'Senthil',
  'Agathe',
  'Sacha',
  'Revathi',
  'Léon',
  'Margaux',
  'Vijay',
  'Nina',
  'Enzo',
  'Harini',
  'Baptiste',
  'Océane',
  'Suresh',
  'Lisa',
  'Maxime',
  'Kamala',
  'Charlotte',
  'Antoine',
  'Pooja',
  'Elise',
  'Quentin',
  'Abirami',
  'Valentin',
];
const EQUIPES = [
  'Les Navy',
  'Les Corail',
  'Les Sauge',
  'Les Sable',
  'Les Super Champions 2026',
  'Les Ambre',
];

const CONTENUS = {
  list2: [
    {
      fr: [
        'Levez-vous si ça vous concerne.',
        'les personnes qui ont déjà dansé à un mariage',
        [
          'Cela se passe souvent tard le soir, après le repas',
          'Il y a de la musique et une piste au milieu de la salle',
        ],
      ],
      en: [
        'Stand up if this applies to you.',
        'people who have already danced at a wedding',
        [
          'It often happens late in the evening, after dinner',
          'There is music and a floor in the middle of the room',
        ],
      ],
      ta: [
        'இது உங்களுக்குப் பொருந்தினால் எழுந்து நில்லுங்கள்.',
        'திருமணத்தில் ஏற்கனவே நடனமாடியவர்கள்',
        [
          'இது பெரும்பாலும் இரவு உணவுக்குப் பிறகு தாமதமாக நடக்கும்',
          'இசை இருக்கும், அறையின் நடுவில் ஒரு மேடை',
        ],
      ],
    },
  ],
  qcm2: {
    fr: [
      'Où les mariés se sont-ils rencontrés pour la première fois ?',
      [
        'À la bibliothèque universitaire de Jaffna',
        'Au mariage d’un cousin, à Paris',
        'Dans un train entre Lyon et Marseille',
        'Sur une application de rencontre',
      ],
    ],
    en: [
      'Where did the newlyweds first meet?',
      [
        'At the Jaffna university library',
        'At a cousin’s wedding in Paris',
        'On a train between Lyon and Marseille',
        'On a dating app',
      ],
    ],
    ta: [
      'மணமக்கள் முதன்முதலில் எங்கே சந்தித்தார்கள்?',
      [
        'யாழ்ப்பாணப் பல்கலைக்கழக நூலகத்தில்',
        'பாரிஸில் ஒரு உறவினரின் திருமணத்தில்',
        'லியோனுக்கும் மார்சேயுக்கும் இடையிலான ரயிலில்',
        'ஒரு டேட்டிங் செயலியில்',
      ],
    ],
  },
  enchere2: [
    {
      fr: ['Cinéma', 'Films de Rajinikanth'],
      en: ['Cinema', 'Rajinikanth films'],
      ta: ['திரைப்படம்', 'ரஜினிகாந்த் திரைப்படங்கள்'],
    },
    {
      fr: ['Musique', 'Chansons d’amour en français'],
      en: ['Music', 'Love songs in French'],
      ta: ['இசை', 'பிரெஞ்சு காதல் பாடல்கள்'],
    },
    {
      fr: ['Gastronomie', 'Noms d’épices'],
      en: ['Food', 'Names of spices'],
      ta: ['சமையல்', 'மசாலாப் பொருட்களின் பெயர்கள்'],
    },
  ],
  mime2: [
    { fr: 'la danse des mariés', en: 'the first dance', ta: 'மணமக்களின் முதல் நடனம்' },
    { fr: 'éléphant', en: 'elephant', ta: 'யானை' },
  ],
  photo2: {
    fr: 'La photo la plus drôle avec les mariés',
    en: 'The funniest photo with the couple',
    ta: 'மணமக்களுடன் மிகவும் வேடிக்கையான புகைப்படம்',
  },
} as const;

let evenement: { id: string; code: string };
const contenus: string[] = [];
const chemins: string[] = [];

test.afterAll(async () => {
  if (!DOSSIER) return;
  const service = clientService();
  if (chemins.length) await service.storage.from('photos').remove(chemins);
  if (evenement) await supprimerEvenements([evenement.id]);
  if (contenus.length) await service.from('contenus').delete().in('id', contenus);
});

async function contenu(jeu: string, publics: Tri<object>, secrets: Tri<object> | null) {
  const service = clientService();
  const { data } = await service
    .from('contenus')
    .insert({ jeu, etiquette: 'tout_public', actif: false })
    .select('id')
    .single();
  const id = data!['id'] as string;
  contenus.push(id);
  await service.from('contenus_traductions').insert(
    (Object.keys(publics) as L[]).map((langue) => ({
      contenu_id: id,
      langue,
      valeur: publics[langue],
    })),
  );
  if (secrets) {
    await service.from('contenus_secrets').insert(
      (Object.keys(secrets) as L[]).map((langue) => ({
        contenu_id: id,
        langue,
        valeur: secrets[langue],
      })),
    );
  }
  return id;
}

const tri = <T>(f: (l: L) => T): Tri<T> => ({ fr: f('fr'), en: f('en'), ta: f('ta') });

async function manche(jeu: string, ordre: number, options: object, passages: object[]) {
  const service = clientService();
  const { data: m, error } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu, ordre, options })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const id = m['id'] as string;
  const { data: p, error: e2 } = await service
    .from('passages')
    .insert(
      passages.map((x, i) => ({ manche_id: id, evenement_id: evenement.id, ordre: i + 1, ...x })),
    )
    .select('id, ordre')
    .order('ordre');
  if (e2) throw new Error(e2.message);
  return { id, passages: p.map((x) => x['id'] as string) };
}

test('inventaire visuel de l’écran commun et du téléphone', async ({ browser }) => {
  test.setTimeout(30 * 60_000);
  const service = clientService();
  evenement = await creerEvenementJetable({ equipes: 6, langues: ['fr', 'en', 'ta'] });
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const equipe = (n: number) => equipes!.find((e) => e['numero'] === n)!['id'] as string;
  for (const [i, nom] of EQUIPES.entries())
    await service
      .from('equipes')
      .update({ nom })
      .eq('id', equipe(i + 1));
  await service.from('groupes').insert(
    ['Famille de la mariée', 'Famille du marié', 'Amis'].map((nom, i) => ({
      evenement_id: evenement.id,
      nom,
      ordre: i + 1,
    })),
  );

  // --- Contenus.
  const l2 = CONTENUS.list2[0];
  const pointCommun = await contenu(
    'list2',
    tri((l) => ({ consigne: l2[l][0] })),
    tri((l) => ({ reponse: l2[l][1], indices: l2[l][2] })),
  );
  const q = CONTENUS.qcm2;
  const questions: string[] = [];
  for (let i = 0; i < 4; i++) {
    questions.push(
      await contenu(
        'qcm2',
        tri((l) => ({ question: q[l][0], propositions: q[l][1] })),
        tri(() => ({ bonne: 1 })),
      ),
    );
  }
  const themes: string[] = [];
  for (const th of CONTENUS.enchere2) {
    themes.push(
      await contenu(
        'enchere2',
        tri((l) => ({ theme: th[l][0] })),
        tri((l) => ({ sujet: th[l][1] })),
      ),
    );
  }
  const mots: string[] = [];
  for (const mot of CONTENUS.mime2)
    mots.push(
      await contenu(
        'mime2',
        tri(() => ({})),
        tri((l) => ({ mot: mot[l] })),
      ),
    );
  const themePhoto = await contenu(
    'photo2',
    tri((l) => ({ theme: CONTENUS.photo2[l] })),
    null,
  );

  // --- Programme.
  const pc = await manche(
    'list2',
    1,
    { passages_par_equipe: 1, ordre_tire: true },
    [3, 1, 5, 2, 6, 4].map((n) => ({ contenu_id: pointCommun, equipe_id: equipe(n) })),
  );
  const quiz = await manche(
    'qcm2',
    2,
    { questions: 4 },
    questions.map((c) => ({ contenu_id: c })),
  );
  const sur = await manche(
    'enchere2',
    3,
    { themes: 3, chrono_s: 30 },
    themes.map((c) => ({ contenu_id: c })),
  );
  const mime = await manche(
    'mime2',
    4,
    { maillons_max: 6 },
    mots.map((c, i) => ({ contenu_id: c, equipe_id: equipe(i + 1) })),
  );
  const photo = await manche('photo2', 5, { themes: 1 }, [{ contenu_id: themePhoto }]);
  const duel = await manche('grab', 6, {}, [{}]);
  const jetons = await manche(
    'qcm2',
    7,
    { questions: 4 },
    questions.map((c) => ({ contenu_id: c })),
  );

  // --- Les invités : 84 avec téléphone, répartis, un capitaine par équipe.
  const { data: joueurs, error } = await service
    .from('joueurs')
    .insert(
      PRENOMS.map((prenom, i) => ({
        evenement_id: evenement.id,
        equipe_id: equipe((i % 6) + 1),
        prenom,
        langue: (['fr', 'en', 'ta'] as const)[i % 3],
        capitaine: i < 6,
        jeton_hash: hacher(`inventaire-${evenement.id}-${i}`),
      })),
    )
    .select('id, prenom, equipe_id');
  if (error) throw new Error(error.message);
  await service.from('scores').insert(
    [420, 610, 380, 550, 290, 505].map((points, i) => ({
      evenement_id: evenement.id,
      equipe_id: equipe(i + 1),
      points,
      motif: 'Inventaire',
    })),
  );

  // --- Photos : une par équipe, formats variés.
  const fabrique = await (await browser.newContext()).newPage();
  const formats = [
    [1600, 1200],
    [1200, 1600],
    [1600, 900],
    [1200, 1200],
    [900, 1600],
    [1600, 1066],
  ];
  for (let n = 1; n <= 6; n++) {
    const [w, h] = formats[n - 1]!;
    await fabrique.setViewportSize({ width: w!, height: h! });
    await fabrique.setContent(
      `<body style="margin:0;display:grid;place-items:center;height:100vh;background:oklch(70% 0.12 ${n * 55});font:bold ${TAILLE_ETIQUETTE}px sans-serif;color:white">Équipe ${n}</body>`,
    );
    const jpeg = await fabrique.screenshot({ type: 'jpeg', quality: 70 });
    const chemin = `${evenement.id}/${equipe(n)}/inventaire.jpg`;
    chemins.push(chemin);
    await service.storage
      .from('photos')
      .upload(chemin, jpeg, { contentType: 'image/jpeg', upsert: true });
    await service
      .from('photos')
      .insert({ evenement_id: evenement.id, equipe_id: equipe(n), theme_id: themePhoto, chemin });
  }

  // --- Pilotage.
  const anna = await clientAnimateur('anna@teamup.test');
  const etape = async (pilotage: object, extra: object = {}) => {
    const { data, erreur: lecture } = await appeler<{ pilotage: { version: string } }>(
      anna,
      'etat_ecran',
      { p_code: evenement.code },
    );
    if (!data) throw new Error(`etat_ecran : ${lecture}`);
    const { erreur } = await appeler(anna, 'enregistrer_etape', {
      p_evenement: evenement.id,
      p_version: data.pilotage.version,
      p_pilotage: pilotage,
      ...extra,
    });
    expect(erreur, JSON.stringify(pilotage)).toBeNull();
  };

  // --- Régie connectée, écran commun, téléphones.
  const bureau = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
  });
  const regie = await bureau.newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  const salle = await browser.newContext({
    storageState: await bureau.storageState(),
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
    reducedMotion: 'no-preference',
  });
  const ecran = await salle.newPage();

  const telephone = async (largeur: number, hauteur: number) =>
    browser.newContext({
      viewport: { width: largeur, height: hauteur },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
  const tels: { nom: string; contexte: BrowserContext; page: Page }[] = [];
  const rejoindre = async (
    nom: string,
    prenom: string,
    langue: L,
    largeur: number,
    hauteur: number,
    volontaire = false,
  ) => {
    const contexte = await telephone(largeur, hauteur);
    const page = await contexte.newPage();
    const r = await page.request.post(`/api/partie/${evenement.code}/rejoindre`, {
      data: { prenom, langue, volontaire },
    });
    expect(r.status(), prenom).toBe(200);
    tels.push({ nom, contexte, page });
    return page;
  };
  // Léa, capitaine (fr, 390) ; Kavya, joueuse (ta, 360) ; Hugo, joueur (en, 360).
  const lea = await rejoindre('fr-390-capitaine', 'Léa Martin', 'fr', 390, 844, true);
  await rejoindre('ta-360', 'Kavya Ramesh', 'ta', 360, 740);
  const hugo = await rejoindre('en-360', 'Hugo B.', 'en', 360, 740);
  const { data: lj } = await service
    .from('joueurs')
    .select('id, equipe_id')
    .eq('evenement_id', evenement.id)
    .eq('prenom', 'Léa Martin')
    .single();
  await service
    .from('joueurs')
    .update({ capitaine: false })
    .eq('equipe_id', lj!['equipe_id'] as string);
  await service
    .from('joueurs')
    .update({ capitaine: true, peut_ajouter: true })
    .eq('id', lj!['id'] as string);

  const tailles = [
    { nom: '1920', width: 1920, height: 1080 },
    { nom: '1280', width: 1280, height: 720 },
  ];
  let numero = 0;
  const capturer = async (
    nom: string,
    options: { attente?: number; sans_rechargement?: boolean; telephones?: boolean } = {},
  ) => {
    numero++;
    const prefixe = String(numero).padStart(2, '0');
    for (const t of tailles) {
      await ecran.setViewportSize({ width: t.width, height: t.height });
      if (!options.sans_rechargement) await ecran.goto(`/ecran/${evenement.code}`);
      await ecran
        .locator('[data-en-direct="true"]')
        .waitFor({ timeout: 20_000 })
        .catch(() => {});
      await ecran.waitForTimeout(options.attente ?? 1500);
      await ecran.screenshot({ path: `${DOSSIER}/ecran-${t.nom}/${prefixe}-${nom}.png` });
    }
    if (options.telephones) {
      for (const t of tels) {
        await t.page.goto(`/${evenement.code}`);
        await t.page.waitForTimeout(1200);
        await t.page.screenshot({
          path: `${DOSSIER}/tel-${t.nom}/${prefixe}-${nom}.png`,
          fullPage: true,
        });
      }
    }
  };

  // ========== Écran commun : hors jeu.
  await capturer('ouverture', { attente: 5000 });
  await etape({ scene: 'accueil' });
  await capturer('accueil', { telephones: true });
  await etape({ scene: 'equipes' });
  await capturer('equipes-tous');
  await appeler(anna, 'regler_membres', { p_evenement: evenement.id, p_mode: 'carrousel' });
  await capturer('equipes-carrousel');
  await appeler(anna, 'regler_membres', { p_evenement: evenement.id, p_mode: 'tous' });
  await etape({ scene: 'programme' });
  await capturer('programme');

  // ========== Points communs.
  await etape({ scene: 'intro', manche_id: pc.id, etape: null });
  await capturer('pc-intro');
  await etape({
    scene: 'intro',
    manche_id: pc.id,
    etape: 'explication',
    chrono: 'demarrer',
    chrono_duree_s: 40,
  });
  await capturer('pc-explication', { attente: 2500 });
  const pcPassage = { scene: 'jeu', manche_id: pc.id, passage_id: pc.passages[0] };
  await etape(
    { ...pcPassage, etape: 'pret', chrono: 'arreter' },
    {
      p_manche: { id: pc.id, statut: 'en_cours' },
      p_passage: { id: pc.passages[0], statut: 'en_cours' },
    },
  );
  await capturer('pc-pret', { telephones: true });
  await etape({ ...pcPassage, etape: 'consigne' });
  await capturer('pc-consigne');
  await etape({ ...pcPassage, etape: 'masque' });
  await capturer('pc-masque');
  await etape({ ...pcPassage, etape: 'lance', chrono: 'demarrer', chrono_duree_s: 130 });
  await capturer('pc-lance');
  await etape({ ...pcPassage, etape: 'lance', indices: 2, chrono: 'garder' });
  await capturer('pc-lance-2-indices');
  await service
    .from('passages')
    .update({ statut: 'termine', points: 120, resultat: { ecoule_ms: 70_000 } })
    .eq('id', pc.passages[0]!);
  await etape({ ...pcPassage, etape: 'trouve', indices: 2, chrono: 'arreter' });
  await capturer('pc-trouve');

  // ========== Quiz (croix, puis téléphone).
  const qp = (i: number) => ({ scene: 'jeu', manche_id: quiz.id, passage_id: quiz.passages[i] });
  await etape(
    { scene: 'intro', manche_id: quiz.id, etape: null },
    { p_manche: { id: pc.id, statut: 'terminee' } },
  );
  await capturer('quiz-intro');
  await etape(
    { ...qp(0), etape: 'pret', chrono: 'arreter' },
    { p_manche: { id: quiz.id, statut: 'en_cours', options: { mode: 'telephone' } } },
  );
  await capturer('quiz-pret', { telephones: true });
  await etape(
    { ...qp(0), etape: 'question', indices: 0 },
    { p_passage: { id: quiz.passages[0], statut: 'en_cours' } },
  );
  await capturer('quiz-question-seule', { telephones: true });
  await etape({ ...qp(0), etape: 'question', indices: 2 });
  await capturer('quiz-question-2-reponses');
  await etape({ ...qp(0), etape: 'question', indices: 4, chrono: 'demarrer', chrono_duree_s: 30 });
  await capturer('quiz-question-chrono', { telephones: true });
  // Léa répond juste, Hugo faux ; Kavya ne répond pas.
  await lea.request.post(`/api/partie/${evenement.code}/quiz`, { data: { choix: 1 } });
  await hugo.request.post(`/api/partie/${evenement.code}/quiz`, { data: { choix: 2 } });
  await capturer('quiz-repondu', { telephones: true });
  await service.from('passages').update({ statut: 'termine' }).eq('id', quiz.passages[0]!);
  await etape({ ...qp(0), etape: 'reponse', indices: 4, chrono: 'arreter' });
  await capturer('quiz-reponse', { telephones: true });
  await etape({ scene: 'jeu', manche_id: quiz.id, passage_id: null, etape: 'survivants' });
  await capturer('quiz-survivants', { telephones: true });
  await etape(
    { scene: 'jeu', manche_id: quiz.id, passage_id: null, etape: 'resultat' },
    {
      p_manche: {
        id: quiz.id,
        statut: 'terminee',
        options: { survivants: { 1: 9, 2: 4, 3: 12, 4: 0, 5: 7, 6: 3 } },
      },
    },
  );
  await capturer('quiz-resultat');

  // ========== Quiz en mode jetons.
  const jp = (i: number) => ({
    scene: 'jeu',
    manche_id: jetons.id,
    passage_id: jetons.passages[i],
  });
  await etape(
    { ...jp(0), etape: 'pret', chrono: 'arreter' },
    { p_manche: { id: jetons.id, statut: 'en_cours', options: { mode: 'jetons', jetons: 15 } } },
  );
  await etape(
    { ...jp(0), etape: 'question', indices: 4, chrono: 'demarrer', chrono_duree_s: 30 },
    { p_passage: { id: jetons.passages[0], statut: 'en_cours' } },
  );
  await lea.request.post(`/api/partie/${evenement.code}/mise`, {
    data: { repartition: [8, 4, 3, 0], valider: false },
  });
  await capturer('jetons-question', { telephones: true, attente: 2500 });
  await lea.request.post(`/api/partie/${evenement.code}/mise`, {
    data: { repartition: [8, 4, 3, 0], valider: true },
  });
  await capturer('jetons-valide', { telephones: true, attente: 2500 });
  await service.from('passages').update({ statut: 'termine' }).eq('id', jetons.passages[0]!);
  await etape({ ...jp(0), etape: 'reponse', indices: 4, chrono: 'arreter' });
  await capturer('jetons-reponse', { telephones: true, attente: 2500 });
  await etape(
    { scene: 'jeu', manche_id: jetons.id, passage_id: null, etape: 'survivants' },
    { p_manche: { id: jetons.id, statut: 'terminee' } },
  );
  await capturer('jetons-fin', { telephones: true });

  // ========== Surenchère.
  const sp = (i: number) => ({ scene: 'jeu', manche_id: sur.id, passage_id: sur.passages[i] });
  await etape(
    { scene: 'jeu', manche_id: sur.id, passage_id: null, etape: 'themes' },
    { p_manche: { id: sur.id, statut: 'en_cours' } },
  );
  await capturer('surenchere-themes');
  await etape(
    { ...sp(0), etape: 'chrono', chrono: 'demarrer', chrono_duree_s: 30 },
    { p_passage: { id: sur.passages[0], statut: 'en_cours' } },
  );
  await capturer('surenchere-chrono');
  await service
    .from('passages')
    .update({ statut: 'termine', resultat: { equipe_champion: 5, tenu: true } })
    .eq('id', sur.passages[0]!);
  await etape({ ...sp(0), etape: 'tenu', chrono: 'arreter' });
  await capturer('surenchere-tenu');
  await etape({ scene: 'jeu', manche_id: sur.id, passage_id: null, etape: 'themes' });
  await capturer('surenchere-themes-apres');

  // ========== Mime.
  const mp = { scene: 'jeu', manche_id: mime.id, passage_id: mime.passages[0] };
  await etape({ ...mp, etape: 'pret' }, { p_manche: { id: sur.id, statut: 'terminee' } });
  await etape(
    { ...mp, etape: 'pret' },
    {
      p_manche: { id: mime.id, statut: 'en_cours' },
      p_passage: { id: mime.passages[0], statut: 'en_cours' },
    },
  );
  await capturer('mime-pret', { telephones: true });
  await etape({ ...mp, etape: 'secret' });
  await capturer('mime-secret');
  await etape({ ...mp, etape: 'lance', chrono: 'demarrer', chrono_duree_s: 60 });
  await capturer('mime-lance');
  await service
    .from('passages')
    .update({ statut: 'termine', points: 150 })
    .eq('id', mime.passages[0]!);
  await etape({ ...mp, etape: 'trouve', chrono: 'arreter' });
  await capturer('mime-trouve');

  // ========== Photo.
  const pp = { scene: 'jeu', manche_id: photo.id, passage_id: photo.passages[0] };
  await etape(
    { ...pp, etape: 'theme' },
    {
      p_manche: { id: photo.id, statut: 'en_cours' },
      p_passage: { id: photo.passages[0], statut: 'en_cours' },
    },
  );
  await capturer('photo-theme', { attente: 3000, telephones: true });
  await service
    .from('passages')
    .update({ statut: 'termine', resultat: { equipe_gagnante: 2 } })
    .eq('id', photo.passages[0]!);
  await etape({ ...pp, etape: 'gagnante' });
  await capturer('photo-gagnante', { attente: 3000 });

  // ========== Duel.
  const [d1, d2] = [joueurs[6]!, joueurs[13]!];
  const duellistes = [d1, d2].map((j) => ({
    joueur_id: j['id'],
    prenom: j['prenom'],
    equipe: equipes!.find((e) => e['id'] === j['equipe_id'])!['numero'],
  }));
  const dp = { scene: 'jeu', manche_id: duel.id, passage_id: duel.passages[0] };
  await etape(
    { ...dp, etape: 'tirage' },
    {
      p_manche: { id: duel.id, statut: 'en_cours' },
      p_passage: { id: duel.passages[0], statut: 'en_cours' },
    },
  );
  await capturer('duel-tirage');
  await service.from('passages').update({ resultat: { duellistes } }).eq('id', duel.passages[0]!);
  await etape({ ...dp, etape: 'face_a_face' });
  await capturer('duel-face-a-face');
  await etape({ ...dp, etape: 'chrono', chrono: 'demarrer', chrono_duree_s: 30 });
  await capturer('duel-chrono');
  await service
    .from('passages')
    .update({ statut: 'termine', resultat: { duellistes, gagnant: 1 } })
    .eq('id', duel.passages[0]!);
  await etape({ ...dp, etape: 'gagne', chrono: 'arreter' });
  await capturer('duel-gagne');

  // ========== Fin de soirée.
  await etape({ scene: 'scores' }, { p_manche: { id: duel.id, statut: 'terminee' } });
  await capturer('scores', { telephones: true });
  await etape({ scene: 'podium' });
  await capturer('podium', { attente: 6000 });
  await etape({ scene: 'instagram' });
  await capturer('instagram');
  await etape({ scene: 'cloture' });
  await capturer('cloture', { attente: 12_000 });

  // ========== Téléphone hors jeu : arrivée, vues du capitaine, hors ligne, soirée finie.
  for (const [nom, l, w, h] of [
    ['fr-390', 'fr', 390, 844],
    ['ta-360', 'ta', 360, 740],
  ] as const) {
    const c = await telephone(w, h);
    const p = await c.newPage();
    const prise = (n: string) =>
      p.screenshot({ path: `${DOSSIER}/arrivee-${nom}/${n}.png`, fullPage: true });
    await p.goto('/');
    await p.waitForTimeout(800);
    await prise('1-code');
    await p.goto(`/${evenement.code}`);
    await p.waitForTimeout(800);
    await prise('2-langue');
    await p.getByRole('button', { name: l === 'fr' ? 'Français' : 'தமிழ்' }).click();
    await p.waitForTimeout(1500);
    await prise('3-prenom');
    await p.getByRole('textbox').fill('Alexandrine');
    await p.getByRole('textbox').press('Enter');
    await p.waitForTimeout(1200);
    await prise('4-prenom-pris');
    await p.getByRole('textbox').fill(`Alexandrine ${nom}`);
    await p.getByRole('textbox').press('Enter');
    await p.waitForTimeout(1200);
    await prise('5-groupe');
    await p.getByRole('button').first().click();
    await p.waitForTimeout(800);
    await prise('6-capitaine');
    await p.getByRole('button').first().click();
    await p.waitForTimeout(2000);
    await prise('7-equipe');
    await c.close();
  }
  const prendreLea = (n: string) =>
    lea.screenshot({ path: `${DOSSIER}/tel-fr-390-capitaine/vue-${n}.png`, fullPage: true });
  await lea.goto(`/${evenement.code}`);
  await lea.waitForTimeout(1000);
  await prendreLea('attente');
  for (const [bouton, n] of [
    [/Renommer/, 'nom'],
    [/Ajouter un invité/, 'ajout'],
    [/photo/i, 'photos'],
  ] as const) {
    await lea.goto(`/${evenement.code}`);
    await lea.getByRole('button', { name: bouton }).first().click();
    await lea.waitForTimeout(800);
    await prendreLea(n);
  }
  await lea.goto(`/${evenement.code}`);
  await lea.context().setOffline(true);
  await lea.waitForTimeout(9000);
  await prendreLea('hors-ligne');
  await lea.context().setOffline(false);
  await service.from('evenements').update({ statut: 'termine' }).eq('id', evenement.id);
  await capturer('soiree-terminee', { telephones: true });
});
