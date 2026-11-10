import {
  expect as expectDeBase,
  request,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { randomBytes } from 'node:crypto';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from '../tests/base';

// Ce qui ne mesure rien attend jusqu'à 20 s : sur un poste lent, l'accès à Docker s'arrête
// parfois 10 s (vu le 2026-11-09), sans rien dire de l'app. Les délais mesurés ont leurs bornes.
const expect = expectDeBase.configure({ timeout: 20_000 });

/**
 * Surenchère en mode téléphones, à l'épreuve (2026-11-09).
 *
 * 1. Huit capitaines tapent en même temps, quarante téléphones relisent en fond : on mesure, mot
 *    par mot, l'instant où l'écran commun, la régie, le téléphone du capitaine et celui d'un
 *    coéquipier **peignent** le mot (une image d'animation après la mutation du DOM, pas au
 *    sondage de Playwright). Puis les touches de la régie, et la fin du chrono jusqu'aux mots.
 * 2. Scénarios de casse : rafale, doublons simultanés, deux onglets, limite de 60 en parallèle,
 *    saisies invalides et piégées, usurpations, rechargements, coupure réseau, capitaine changé
 *    en plein chrono, mots partis trop tard, mots en attente d'un thème au suivant, double
 *    validation, classement validé par une régie au réseau lent.
 * 3. Des téléphones à l'heure fausse jouent quand même.
 */

// Contenus de la démo : « La cuisine » → « citer des épices », puis « Les voyages ».
const THEMES = ['aaaa0201-0000-4000-8000-000000000201', 'aaaa0202-0000-4000-8000-000000000202'];

const evenements: string[] = [];
test.afterAll(() => supprimerEvenements(evenements));

const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

// ---------------------------------------------------------------------------
// Mise en place
// ---------------------------------------------------------------------------

async function preparerSurenchere(evenementId: string, chronoTelephonesS: number) {
  const service = clientService();
  const { data: m, error: e1 } = await service
    .from('manches')
    .insert({
      evenement_id: evenementId,
      jeu: 'enchere2',
      ordre: 1,
      options: { themes: 2, chrono_s: 30, chrono_telephones_s: chronoTelephonesS },
    })
    .select('id')
    .single();
  if (e1) throw new Error(e1.message);
  const manche = m['id'] as string;
  const { data: passages, error } = await service
    .from('passages')
    .insert(
      THEMES.map((contenu, i) => ({
        manche_id: manche,
        evenement_id: evenementId,
        ordre: i + 1,
        contenu_id: contenu,
      })),
    )
    .select('id, ordre')
    .order('ordre');
  if (error) throw new Error(error.message);
  return { manche, passages: passages.map((p) => p['id'] as string) };
}

interface Inscrit {
  prenom: string;
  equipe: number;
  capitaine?: boolean;
}

/** Des joueurs inscrits en base, chacun avec son jeton de session (le cookie `tu_j_<CODE>`). */
async function inscrire(evenementId: string, joueurs: Inscrit[]) {
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenementId);
  const equipe = (n: number) => equipes!.find((e) => e['numero'] === n)!['id'] as string;
  const jetons = new Map<string, string>();
  const { error } = await service.from('joueurs').insert(
    joueurs.map((j) => {
      const jeton = randomBytes(24).toString('base64url');
      jetons.set(j.prenom, jeton);
      return {
        evenement_id: evenementId,
        equipe_id: equipe(j.equipe),
        prenom: j.prenom,
        langue: 'fr',
        capitaine: j.capitaine ?? false,
        jeton_hash: hacher(jeton),
      };
    }),
  );
  if (error) throw new Error(error.message);
  return { jetons, equipe };
}

/** Un vrai téléphone (navigateur), déjà inscrit : le cookie de session suffit. */
async function telephone(
  browser: Browser,
  baseURL: string,
  code: string,
  jeton: string,
  decalageHorlogeMs = 0,
): Promise<Page> {
  const contexte = await browser.newContext();
  await contexte.addCookies([{ name: `tu_j_${code}`, value: jeton, url: baseURL }]);
  if (decalageHorlogeMs) await fausserLHorloge(contexte, decalageHorlogeMs);
  const page = await contexte.newPage();
  await page.goto(`/${code}`);
  return page;
}

/** Un téléphone simulé (requêtes seules), avec ou sans session. */
function telephoneSimule(baseURL: string, code: string, jeton?: string) {
  return request.newContext({
    baseURL,
    // Une connexion par requête : un socket gardé entre deux envois peut être fermé par le
    // serveur au moment même où le test s'en ressert (voir quiz.spec.ts).
    extraHTTPHeaders: {
      connection: 'close',
      ...(jeton ? { cookie: `tu_j_${code}=${jeton}` } : {}),
    },
  });
}

/** Un téléphone dont l'horloge avance (ou retarde) : `Date` seule est décalée, pas les minuteries. */
async function fausserLHorloge(contexte: BrowserContext, decalageMs: number) {
  await contexte.addInitScript((decalage: number) => {
    const Vraie = Date;
    const maintenant = () => Vraie.now() + decalage;
    class Fausse extends Vraie {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(maintenant());
        else super(...(args as [string | number | Date]));
      }
      static override now() {
        return maintenant();
      }
    }
    globalThis.Date = Fausse as DateConstructor;
  }, decalageMs);
}

async function connecterRegie(browser: Browser): Promise<Page> {
  const regie = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  return regie;
}

async function ouvrirEcran(browser: Browser, regie: Page, code: string): Promise<Page> {
  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${code}`);
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  return ecran;
}

const scene = (ecran: Page, etape: string) =>
  ecran.locator(`[data-scene="enchere2"][data-mode="telephones"][data-etape="${etape}"]`);
const compteur = (ecran: Page, n: number) =>
  ecran.getByTestId(`compteur-${n}`).locator('.tu-stage-compteur__n');

/** De l'accueil au thème dévoilé : Présenter, Mode téléphones, Dévoiler. */
async function jusquAuSujet(regie: Page, ecran: Page, code: string) {
  await regie.goto(`/regie/${code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 30_000 });
  await regie.getByRole('button', { name: /^Mode téléphones/ }).click();
  await expect(ecran.locator('[data-scene="enchere2"][data-etape="themes"]')).toBeVisible({});
  await regie.getByRole('button', { name: 'Dévoiler', exact: true }).first().click();
  await expect(scene(ecran, 'sujet')).toBeVisible({ timeout: 15_000 });
}

/**
 * L'horloge de la base : son décalage avec celle de cette machine, et la fin du chrono en cours
 * (heure de cette machine, celle des navigateurs du test).
 */
async function finDuChrono(code: string): Promise<number> {
  const anna = await clientAnimateur('anna@teamup.test');
  const avant = Date.now();
  const { data } = await appeler<{
    serveur_ms: number;
    pilotage: { chrono_depart_ms: number | null; chrono_duree_s: number | null };
  }>(anna, 'etat_ecran', { p_code: code });
  const decalage = data!.serveur_ms - (avant + Date.now()) / 2;
  const { chrono_depart_ms: depart, chrono_duree_s: duree } = data!.pilotage;
  if (depart === null || duree === null) throw new Error('aucun chrono en cours');
  return depart + duree * 1000 - decalage;
}

async function motsEnBase(evenementId: string, passageId: string, equipeId: string) {
  const { data } = await clientService()
    .from('mots_surenchere')
    .select('mot, refuse, masque')
    .eq('evenement_id', evenementId)
    .eq('passage_id', passageId)
    .eq('equipe_id', equipeId)
    .order('ajoute_le');
  return data!.map((m) => m['mot'] as string);
}

// ---------------------------------------------------------------------------
// Ce que la page peint, et quand
// ---------------------------------------------------------------------------

interface Image {
  t: number;
  /** `scène:étape` de chaque `[data-scene]` affiché. */
  scenes: string;
  /** Le compte affiché par équipe (écran : « 3 mots » ; régie : « 3 mots · … »). */
  comptes: Record<string, number>;
  /** Les listes de mots de l'écran sont là (fin du chrono). */
  listes: boolean;
  /** Téléphone : les mots de l'équipe confirmés par la base (hors file d'attente). */
  confirmes: number;
}

/**
 * Note chaque image où ce que la page montre change, à l'image d'animation qui suit la mutation :
 * l'instant où la salle le voit, à 16 ms près. `prefixe` : le `data-testid` des comptes par
 * équipe, `cible` : l'élément qui porte le nombre (sinon l'élément lui-même).
 */
async function noterLesImages(page: Page, prefixe: string, cible = '') {
  await page.evaluate(
    ({ prefixe, cible }) => {
      const w = window as unknown as { __images: unknown[] };
      w.__images = [];
      let derniere = '';
      let prevue = false;
      const lire = () => {
        prevue = false;
        const comptes: Record<string, number> = {};
        for (const el of document.querySelectorAll(`[data-testid^="${prefixe}"]`)) {
          const n = el.getAttribute('data-testid')!.slice(prefixe.length);
          if (!/^\d+$/.test(n)) continue;
          const porteur = cible ? el.querySelector(cible) : el;
          comptes[n] = Number(porteur?.textContent?.match(/\d+/)?.[0] ?? 0);
        }
        const image = {
          scenes: [...document.querySelectorAll('[data-scene]')]
            .map((e) => `${e.getAttribute('data-scene')}:${e.getAttribute('data-etape') ?? ''}`)
            .join(' '),
          comptes,
          listes: document.querySelector('[data-testid="listes"]') !== null,
          confirmes: document.querySelectorAll(
            '[data-testid="mots-equipe"] li:not(.tu-mots__mot--attente)',
          ).length,
        };
        const cle = JSON.stringify(image);
        if (cle !== derniere) {
          derniere = cle;
          w.__images.push({ t: Date.now(), ...image });
        }
      };
      new MutationObserver(() => {
        if (prevue) return;
        prevue = true;
        requestAnimationFrame(lire);
      }).observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      lire();
    },
    { prefixe, cible },
  );
}

const imagesDe = (page: Page) =>
  page.evaluate(() => (window as unknown as { __images: Image[] }).__images);

/** La première image, après `depuis`, qui montre ce qu'on attend : son délai, ou `null`. */
function delaiALImage(images: Image[], depuis: number, voulu: (i: Image) => boolean) {
  const image = images.find((i) => i.t >= depuis && voulu(i));
  return image ? image.t - depuis : null;
}

function resume(ms: number[]) {
  const tries = [...ms].sort((a, b) => a - b);
  const centile = (q: number) => tries[Math.min(tries.length - 1, Math.floor(q * tries.length))]!;
  return {
    n: tries.length,
    mediane: centile(0.5),
    p90: centile(0.9),
    max: tries.at(-1)!,
  };
}

const lisible = (r: ReturnType<typeof resume>) =>
  `médiane ${r.mediane} ms, 90e centile ${r.p90} ms, max ${r.max} ms (${r.n} mesures)`;

// ---------------------------------------------------------------------------
// 1. La charge et le temps de réponse à l'image
// ---------------------------------------------------------------------------

const EQUIPES = 8;
// Un mot toutes les 3 s par capitaine (vite, au pouce), huit capitaines : 2,7 mots par seconde.
const TOURS = 10;
const ECART_TOURS_MS = 3000;
// Les relectures de fond (40 en CI). `RELECTEURS=0` mesure l'écran sans elles, sur un poste lent.
const RELECTEURS = Number(process.env['RELECTEURS'] ?? 40);
const EPICES = [
  'Cannelle',
  'Curcuma',
  'Gingembre',
  'Muscade',
  'Safran',
  'Paprika',
  'Cumin',
  'Coriandre',
  'Fenugrec',
  'Sumac',
  'Vanille',
  'Cardamome',
];

test('huit capitaines tapent ensemble : l’écran peint chaque mot en moins d’une seconde', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const evenement = await creerEvenementJetable({ equipes: EQUIPES, langues: ['fr'] });
  evenements.push(evenement.id);
  const { code } = evenement;
  const CHRONO_S = 50;
  const { manche } = await preparerSurenchere(evenement.id, CHRONO_S);

  // Un capitaine par équipe ; un coéquipier de l'équipe 1 ; quarante invités qui relisent en fond.
  const { jetons } = await inscrire(evenement.id, [
    ...Array.from({ length: EQUIPES }, (_, i) => ({
      prenom: `Capitaine ${i + 1}`,
      equipe: i + 1,
      capitaine: true,
    })),
    { prenom: 'Coéquipier', equipe: 1 },
    ...Array.from({ length: RELECTEURS }, (_, i) => ({
      prenom: `Invité ${i + 1}`,
      equipe: (i % EQUIPES) + 1,
    })),
  ]);
  const jeton = (prenom: string) => jetons.get(prenom)!;

  const capitaine1 = await telephone(browser, baseURL!, code, jeton('Capitaine 1'));
  const coequipier = await telephone(browser, baseURL!, code, jeton('Coéquipier'));
  const capitaines = new Map<number, APIRequestContext>();
  for (let n = 2; n <= EQUIPES; n++) {
    capitaines.set(n, await telephoneSimule(baseURL!, code, jeton(`Capitaine ${n}`)));
  }
  const relecteurs = await Promise.all(
    Array.from({ length: RELECTEURS }, (_, i) =>
      telephoneSimule(baseURL!, code, jeton(`Invité ${i + 1}`)),
    ),
  );

  const regie = await connecterRegie(browser);
  const ecran = await ouvrirEcran(browser, regie, code);
  await noterLesImages(ecran, 'compteur-', '.tu-stage-compteur__n');

  // --- Les touches de la régie, de l'appui à l'image sur l'écran commun.
  const touches: { touche: string; ms: number }[] = [];
  const toucher = async (touche: string, appui: () => Promise<void>, etape: string) => {
    const t0 = Date.now();
    await appui();
    // L'image se note à l'image d'animation qui suit le changement : Playwright peut trouver la
    // scène dans le DOM avant qu'elle soit peinte (vu en CI le 2026-11-10, la lecture du journal
    // arrivait avant l'image), on attend donc qu'elle y soit.
    let ms = Number.NaN;
    await expect
      .poll(async () => {
        const d = delaiALImage(await imagesDe(ecran), t0, (i) =>
          i.scenes.includes(`enchere2:${etape}`),
        );
        if (d !== null) ms = d;
        return d;
      }, `touche ${touche} : l'image de l'écran`)
      .not.toBeNull();
    touches.push({ touche, ms });
  };
  await regie.goto(`/regie/${code}/pilotage`);
  await regie.getByRole('button', { name: 'Présenter' }).first().click();
  await expect(ecran.locator('[data-scene="intro"]')).toBeVisible({ timeout: 30_000 });
  await toucher(
    'Mode téléphones',
    () => regie.getByRole('button', { name: /^Mode téléphones/ }).click(),
    'themes',
  );
  await toucher(
    'Dévoiler',
    () => regie.getByRole('button', { name: 'Dévoiler', exact: true }).first().click(),
    'sujet',
  );

  // Les quarante invités relisent leur état toutes les 4 s, comme leurs téléphones.
  let fond = true;
  const relectures = relecteurs.map(async (r, i) => {
    await attendre((i * 4000) / RELECTEURS);
    while (fond) {
      await r.get(`/api/partie/${code}/etat`).catch(() => null);
      await attendre(4000);
    }
  });

  await toucher(
    'Lancer le chrono',
    () => regie.getByRole('button', { name: `Lancer le chrono (${CHRONO_S} s)` }).click(),
    'chrono',
  );
  const fin = await finDuChrono(code);
  const champ = capitaine1.getByLabel('Un mot sur le sujet');
  await expect(champ).toBeVisible();
  await noterLesImages(capitaine1, '-');
  await noterLesImages(coequipier, '-');
  await noterLesImages(regie, 'regie-compte-');

  // --- Dix tours : à chaque tour, les huit capitaines envoient un mot en même temps.
  const envois: { equipe: number; rang: number; t0: number }[] = [];
  const accuses: number[] = [];
  const refus: string[] = [];
  for (let rang = 1; rang <= TOURS; rang++) {
    const debut = Date.now();
    // Jamais après la fin : le champ du téléphone aurait disparu.
    if (debut > fin - 3000)
      throw new Error(`tour ${rang} : plus le temps, la machine est trop lente`);
    const mot = EPICES[rang - 1]!;
    const simules = [...capitaines].map(([equipe, c]) => {
      const t0 = Date.now();
      envois.push({ equipe, rang, t0 });
      return c.post(`/api/partie/${code}/mot`, { data: { type: 'ajouter', mot } }).then((r) => {
        accuses.push(Date.now() - t0);
        if (r.status() !== 200) refus.push(`équipe ${equipe}, ${mot} : ${r.status()}`);
      });
    });
    await champ.fill(mot);
    envois.push({ equipe: 1, rang, t0: Date.now() });
    await champ.press('Enter');
    await Promise.all(simules);
    await attendre(debut + ECART_TOURS_MS - Date.now());
  }
  const margeMs = fin - Date.now();
  for (let n = 1; n <= EQUIPES; n++) {
    await expect(compteur(ecran, n)).toHaveText(`${TOURS} mots`);
  }

  // --- Fin du chrono : tous les mots d'un coup.
  await expect(ecran.getByTestId('listes')).toBeVisible({ timeout: CHRONO_S * 1000 });
  await expect(ecran.locator('.tu-stage-mot')).toHaveCount(EQUIPES * TOURS);
  fond = false;
  await Promise.all(relectures);
  await attendre(4500); // le coéquipier relit toutes les 4 s
  const imgEcran = await imagesDe(ecran);
  const imgRegie = await imagesDe(regie);
  const imgCapitaine = await imagesDe(capitaine1);
  const imgCoequipier = await imagesDe(coequipier);
  const finALImage = delaiALImage(imgEcran, fin, (i) => i.listes);

  await toucher(
    'Valider le classement',
    async () => {
      await regie.getByRole('button', { name: 'Valider le classement' }).click();
      await regie.getByRole('button', { name: 'Confirmer : Valider le classement' }).click();
    },
    'podium',
  );
  // Huit ex aequo : huit premières places, +100 chacune, une ligne de score par équipe.
  await expect(ecran.locator('[data-testid^="place-"]')).toHaveCount(EQUIPES);
  for (let n = 1; n <= EQUIPES; n++) {
    await expect(ecran.getByTestId(`place-${n}`)).toContainText('1re place');
  }
  const { data: scores } = await clientService()
    .from('scores')
    .select('points')
    .eq('manche_id', manche);
  expect(scores!.map((s) => s['points'])).toEqual(Array(EQUIPES).fill(100));
  await toucher(
    'Retour aux thèmes',
    () => regie.getByRole('button', { name: 'Retour aux thèmes' }).click(),
    'themes',
  );

  // --- Les délais, mot par mot, du départ du mot à l'image.
  const compte = (images: Image[], equipe: number, rang: number, t0: number) => {
    const image = images.find((i) => (i.comptes[String(equipe)] ?? -1) >= rang);
    return image ? Math.max(0, image.t - t0) : Number.NaN;
  };
  const confirme = (images: Image[], rang: number, t0: number) => {
    const image = images.find((i) => i.confirmes >= rang);
    return image ? Math.max(0, image.t - t0) : Number.NaN;
  };
  const deLEquipe1 = envois.filter((e) => e.equipe === 1);
  const mesures = {
    ecran: resume(envois.map((e) => compte(imgEcran, e.equipe, e.rang, e.t0))),
    regie: resume(envois.map((e) => compte(imgRegie, e.equipe, e.rang, e.t0))),
    capitaine: resume(deLEquipe1.map((e) => confirme(imgCapitaine, e.rang, e.t0))),
    coequipier: resume(deLEquipe1.map((e) => confirme(imgCoequipier, e.rang, e.t0))),
    accuseServeur: resume(accuses),
    finDuChronoAuxMots: finALImage,
    touches,
  };
  const rapport = [
    `Téléphone → écran commun : ${lisible(mesures.ecran)}`,
    `Téléphone → régie : ${lisible(mesures.regie)}`,
    `Téléphone du capitaine, mot confirmé : ${lisible(mesures.capitaine)}`,
    `Téléphone d'un coéquipier (relecture de 4 s, voulu) : ${lisible(mesures.coequipier)}`,
    `Réponse du serveur à un mot (7 capitaines simulés) : ${lisible(mesures.accuseServeur)}`,
    `Fin du chrono → mots à l'écran (dont 1 s de grâce voulue) : ${finALImage} ms`,
    ...touches.map((t) => `Régie « ${t.touche} » → écran : ${t.ms} ms`),
  ];
  console.log(`\nSurenchère, ${EQUIPES} capitaines et ${RELECTEURS} relectures en fond :`);
  for (const ligne of rapport) console.log(`  ${ligne}`);
  // En CI, le rapport devient aussi une annotation du run, lisible sans compte GitHub (le journal et
  // les pièces jointes en demandent un). Une seule : GitHub n'en garde que dix par étape.
  if (process.env['GITHUB_ACTIONS'])
    console.log(`\n::notice title=Latences de la Surenchère::${rapport.join('%0A')}`);
  for (const ligne of rapport)
    test.info().annotations.push({ type: 'latence', description: ligne });
  await test.info().attach('latences.json', {
    body: JSON.stringify(mesures, null, 2),
    contentType: 'application/json',
  });

  expect(refus, 'envois refusés').toEqual([]);
  expect(margeMs, 'les tours tiennent dans le chrono').toBeGreaterThan(0);
  // L'exigence du produit : l'écran à jour en moins d'une seconde (90e centile).
  for (const [vue, r] of Object.entries({
    écran: mesures.ecran,
    régie: mesures.regie,
    capitaine: mesures.capitaine,
  })) {
    expect(Number.isNaN(r.max), `${vue} : un mot n'a jamais paru`).toBe(false);
    expect(r.p90, `${vue} : 90e centile`).toBeLessThan(1000);
  }
  // Le coéquipier n'écoute pas les mots (un appui de capitaine ne fait pas relire 150 téléphones) :
  // il les voit à sa relecture de 4 s.
  expect(mesures.coequipier.max, 'coéquipier').toBeLessThan(4000 + 1500);
  // La base garde la saisie ouverte 1 s de plus, l'écran relit 1,3 s après la fin.
  expect(finALImage, 'fin du chrono → mots').not.toBeNull();
  expect(finALImage!, 'fin du chrono → mots').toBeLessThan(1300 + 1000);
  for (const t of touches) expect(t.ms, `touche ${t.touche}`).toBeLessThan(1500);

  await Promise.all([...capitaines.values(), ...relecteurs].map((c) => c.dispose()));
});

// ---------------------------------------------------------------------------
// 2. Les scénarios de casse
// ---------------------------------------------------------------------------

const PIEGE_HTML = '<img src=x onerror=window.__pirate=1>';
const PIEGE_SQL = "Robert'); DROP TABLE mots;--";
const MOT_40 = 'Poivre long de Java et poivre de Cubèbe!';

test('la Surenchère tient : coupures, rechargements, rafales, usurpations, régie lente', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(360_000);
  expect(MOT_40).toHaveLength(40);
  const evenement = await creerEvenementJetable({ equipes: 3, langues: ['fr'] });
  evenements.push(evenement.id);
  const { code } = evenement;
  const CHRONO_S = 75;
  const { passages } = await preparerSurenchere(evenement.id, CHRONO_S);
  const [theme1, theme2] = passages as [string, string];
  const { jetons, equipe } = await inscrire(evenement.id, [
    { prenom: 'Alice', equipe: 1, capitaine: true },
    { prenom: 'Bruno', equipe: 1 },
    { prenom: 'Chloé', equipe: 2, capitaine: true },
    { prenom: 'Damien', equipe: 2 },
    { prenom: 'Élise', equipe: 3, capitaine: true },
  ]);
  const jeton = (prenom: string) => jetons.get(prenom)!;
  const service = clientService();

  // Un intrus, inscrit à une autre soirée.
  const autre = await creerEvenementJetable({ equipes: 1, langues: ['fr'] });
  evenements.push(autre.id);
  const { jetons: jetonsAutre } = await inscrire(autre.id, [
    { prenom: 'Intrus', equipe: 1, capitaine: true },
  ]);

  const alice = await telephone(browser, baseURL!, code, jeton('Alice'));
  const chloe = await telephone(browser, baseURL!, code, jeton('Chloé'));
  const damien = await telephone(browser, baseURL!, code, jeton('Damien'));
  const bruno = await telephoneSimule(baseURL!, code, jeton('Bruno'));
  const elise = await telephoneSimule(baseURL!, code, jeton('Élise'));
  const anonyme = await telephoneSimule(baseURL!, code);
  const intrus = await telephoneSimule(baseURL!, autre.code, jetonsAutre.get('Intrus'));
  const mot = (c: APIRequestContext, data: unknown, code_ = code) =>
    c.post(`/api/partie/${code_}/mot`, { data: data as Record<string, unknown> });
  const ajouter = (c: APIRequestContext, m: string) => mot(c, { type: 'ajouter', mot: m });

  const regie = await connecterRegie(browser);
  const ecran = await ouvrirEcran(browser, regie, code);
  await jusquAuSujet(regie, ecran, code);
  await regie.getByRole('button', { name: `Lancer le chrono (${CHRONO_S} s)` }).click();
  await expect(scene(ecran, 'chrono')).toBeVisible();
  const fin = await finDuChrono(code);
  const champ = (p: Page) => p.getByLabel('Un mot sur le sujet');
  await expect(champ(alice)).toBeVisible();

  // --- Rafale : douze mots tapés sans attendre la base. Aucun ne se perd, l'ordre est gardé.
  for (const m of EPICES) {
    await champ(alice).fill(m);
    await champ(alice).press('Enter');
  }
  await expect.poll(() => motsEnBase(evenement.id, theme1, equipe(1))).toEqual(EPICES);
  await expect(compteur(ecran, 1)).toHaveText('12 mots');

  // --- Le même mot envoyé deux fois en même temps : un seul passe.
  const doubles = await Promise.all([
    ajouter(alice.request, 'Badiane'),
    ajouter(alice.request, 'BADIANE'),
  ]);
  expect(doubles.map((r) => r.status()).sort()).toEqual([200, 409]);
  // Celui des deux qui est arrivé le premier, tel quel.
  const badiane = (await motsEnBase(evenement.id, theme1, equipe(1))).find(
    (m) => m.toLowerCase() === 'badiane',
  )!;

  // --- Deux onglets du même capitaine tapent en même temps (le second ouvert en plein chrono).
  const alice2 = await alice.context().newPage();
  await alice2.goto(`/${code}`);
  await expect(champ(alice2)).toBeVisible();
  const taper = async (p: Page, mots: string[]) => {
    for (const m of mots) {
      await champ(p).fill(m);
      await champ(p).press('Enter');
    }
  };
  await Promise.all([
    taper(alice, ['Anis', 'Carvi', 'Aneth']),
    taper(alice2, ['Estragon', 'Origan', 'Thym']),
  ]);
  await expect(compteur(ecran, 1)).toHaveText('19 mots');
  expect(new Set(await motsEnBase(evenement.id, theme1, equipe(1))).size).toBe(19);
  await alice2.close();

  // --- La limite de 60 sous des envois parallèles : exactement 60, jamais 61.
  const { error: e58 } = await service.from('mots_surenchere').insert(
    Array.from({ length: 58 }, (_, i) => ({
      passage_id: theme1,
      evenement_id: evenement.id,
      equipe_id: equipe(3),
      mot: `Épice ${i + 1}`,
      cle: `epice ${i + 1}`,
    })),
  );
  if (e58) throw new Error(e58.message);
  const rafale = await Promise.all(
    ['Zaatar', 'Macis', 'Nigelle', 'Ajowan', 'Galanga'].map((m) => ajouter(elise, m)),
  );
  expect(rafale.map((r) => r.status()).sort()).toEqual([200, 200, 409, 409, 409]);
  expect(await motsEnBase(evenement.id, theme1, equipe(3))).toHaveLength(60);

  // --- Saisies invalides : refusées avant la base.
  for (const corps of [
    { type: 'ajouter', mot: 'x'.repeat(41) },
    { type: 'ajouter', mot: '   ' },
    {},
    { type: 'ajouter' },
    { type: 'supprimer', mot: 'Cumin' },
    { type: 'retirer', id: 'pas-un-uuid' },
  ]) {
    expect((await mot(elise, corps)).status(), JSON.stringify(corps)).toBe(422);
  }
  const brut = await elise.post(`/api/partie/${code}/mot`, {
    data: 'pas du json',
    headers: { 'content-type': 'application/json' },
  });
  expect(brut.status()).toBe(422);

  // --- Usurpations : coéquipier, sans session, autre soirée, mot d'une autre équipe.
  expect((await ajouter(bruno, 'Poivre')).status()).toBe(403);
  expect((await ajouter(anonyme, 'Poivre')).status()).toBe(401);
  expect((await mot(anonyme, { type: 'ajouter', mot: 'Poivre' }, 'ZZZZZZ')).status()).toBe(401);
  expect((await ajouter(intrus, 'Poivre')).status()).toBe(401);
  expect((await mot(intrus, { type: 'ajouter', mot: 'Poivre' }, autre.code)).status()).toBe(409);
  const { data: cannelle } = await service
    .from('mots_surenchere')
    .select('id')
    .eq('passage_id', theme1)
    .eq('equipe_id', equipe(1))
    .eq('mot', 'Cannelle')
    .single();
  expect((await mot(chloe.request, { type: 'retirer', id: cannelle!['id'] })).status()).toBe(200);
  expect((await mot(bruno, { type: 'retirer', id: cannelle!['id'] })).status()).toBe(403);
  expect(await motsEnBase(evenement.id, theme1, equipe(1))).toContain('Cannelle');

  // --- Mots piégés, écritures d'ailleurs, 40 caractères pile : gardés tels quels.
  await expect(champ(chloe)).toBeVisible();
  await taper(chloe, [PIEGE_HTML, PIEGE_SQL, 'மிளகு', '🌶️ Piment']);
  await expect.poll(async () => (await motsEnBase(evenement.id, theme1, equipe(2))).length).toBe(4);
  expect((await ajouter(chloe.request, MOT_40)).status()).toBe(200);
  await expect
    .poll(() => motsEnBase(evenement.id, theme1, equipe(2)))
    .toEqual([PIEGE_HTML, PIEGE_SQL, 'மிளகு', '🌶️ Piment', MOT_40]);
  await expect(compteur(ecran, 2)).toHaveText('5 mots');

  // --- Rechargements en plein chrono : téléphone, écran, régie. Rien ne se perd, rien ne fuit.
  await alice.reload();
  await expect(alice.getByTestId('mots-equipe')).toContainText(badiane);
  await expect(champ(alice)).toBeVisible();
  await ecran.reload();
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });
  await expect(compteur(ecran, 1)).toHaveText('19 mots');
  await expect(compteur(ecran, 2)).toHaveText('5 mots');
  await expect(compteur(ecran, 3)).toHaveText('60 mots');
  await expect(ecran.getByText(badiane)).toHaveCount(0);
  await expect(ecran.getByText(PIEGE_HTML)).toHaveCount(0);
  await regie.reload();
  await expect(regie.getByRole('button', { name: `Rayer « ${badiane} »` })).toBeVisible();

  // --- Coupure réseau chez le capitaine : les mots attendent, puis partent au retour, une fois.
  await alice.context().setOffline(true);
  await taper(alice, ['Hors-ligne un', 'Hors-ligne deux', 'Hors-ligne trois']);
  await expect(alice.locator('.tu-mots__mot--attente')).toHaveCount(3);
  await attendre(2000);
  await expect(compteur(ecran, 1)).toHaveText('19 mots');
  const retour = Date.now();
  await alice.context().setOffline(false);
  await expect(compteur(ecran, 1)).toHaveText('22 mots');
  const repriseMs = Date.now() - retour;
  await expect(alice.locator('.tu-mots__mot--attente')).toHaveCount(0);
  expect(
    (await motsEnBase(evenement.id, theme1, equipe(1))).filter((m) => m.startsWith('Hors-ligne')),
  ).toEqual(['Hors-ligne un', 'Hors-ligne deux', 'Hors-ligne trois']);

  // --- La régie raye puis rétablit ; raye pour de bon un mot déplacé.
  await regie.getByRole('button', { name: `Rayer « ${badiane} »` }).click();
  await expect(compteur(ecran, 1)).toHaveText('21 mots');
  await regie.getByRole('button', { name: `Rétablir « ${badiane} »` }).click();
  await expect(compteur(ecran, 1)).toHaveText('22 mots');
  await regie.getByRole('button', { name: `Rayer « ${PIEGE_SQL} »` }).click();
  await expect(compteur(ecran, 2)).toHaveText('4 mots');

  // --- Capitaine changé en plein chrono (sans signal : au pire, la relecture de 4 s).
  await service
    .from('joueurs')
    .update({ capitaine: false })
    .eq('id', await idDe('Chloé'));
  await service
    .from('joueurs')
    .update({ capitaine: true })
    .eq('id', await idDe('Damien'));
  expect((await ajouter(chloe.request, 'Poivre')).status()).toBe(403);
  await expect(champ(chloe)).toHaveCount(0);
  await expect(chloe.getByTestId('statut-surenchere')).toContainText('Votre capitaine tape');
  await expect(champ(damien)).toBeVisible();
  await taper(damien, ['Curry']);
  await expect(compteur(ecran, 2)).toHaveText('5 mots');

  // --- Juste avant la fin, Alice et Damien perdent le réseau avec des mots en attente.
  expect(fin - Date.now(), 'les scénarios tiennent dans le chrono').toBeGreaterThan(6000);
  await attendre(fin - 4000 - Date.now());
  await alice.context().setOffline(true);
  await damien.context().setOffline(true);
  await taper(alice, ['Trop tard un', 'Trop tard deux']);
  await taper(damien, ['Clou de girofle', 'Poivre rose']);
  await attendre(fin + 2500 - Date.now());

  // Alice revient après la fin : ses deux mots sont refusés, et elle le sait.
  await alice.context().setOffline(false);
  await expect(alice.getByTestId('statut-surenchere')).toHaveText(
    "2 mots n'ont pas pu partir à temps.",
  );
  expect(await motsEnBase(evenement.id, theme1, equipe(1))).not.toContain('Trop tard un');

  // L'écran montre tous les mots : pas les masqués, pas les tardifs ; les pièges en texte.
  await expect(ecran.getByTestId('listes')).toBeVisible();
  await expect(ecran.getByTestId('mots-1')).toContainText(badiane);
  await expect(ecran.getByTestId('mots-1').locator('.tu-stage-mot--refuse')).toHaveCount(0);
  await expect(ecran.getByTestId('mots-1')).not.toContainText('Trop tard');
  await expect(ecran.getByTestId('mots-2')).toContainText(PIEGE_HTML);
  await expect(ecran.getByTestId('mots-2')).toContainText('மிளகு');
  await expect(ecran.getByTestId('mots-2')).not.toContainText('DROP TABLE');
  await expect(ecran.getByTestId('mots-2')).not.toContainText('Clou de girofle');
  for (const page of [ecran, regie]) {
    expect(await page.evaluate(() => 'pirate' in window || '__pirate' in window)).toBe(false);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  }

  // --- Deux régies valident le classement au même instant : les points ne comptent qu'une fois.
  const regie2 = await regie.context().newPage();
  await regie2.goto(`/regie/${code}/pilotage`);
  // Les deux boutons armés, puis les deux appuis envoyés ensemble, sans attendre que le bouton soit
  // immobile : en CI, la première validation atteignait la seconde régie (signal, relecture) pendant
  // que Playwright attendait la fin de sa transition, et le bouton disparaissait (2026-11-10).
  const confirmer = (r: Page) =>
    r.getByRole('button', { name: 'Confirmer : Valider le classement' });
  await Promise.all(
    [regie, regie2].map((r) => r.getByRole('button', { name: 'Valider le classement' }).click()),
  );
  for (const r of [regie, regie2]) await expect(confirmer(r)).toBeVisible();
  await Promise.all(
    [regie, regie2].map((r) => confirmer(r).dispatchEvent('click', undefined, { timeout: 2000 })),
  );
  await expect(scene(ecran, 'podium')).toBeVisible();
  await expect(ecran.getByTestId('place-3')).toContainText('1re place');
  const points = async () => {
    const { data } = await service
      .from('scores')
      .select('equipe_id, points')
      .eq('evenement_id', evenement.id)
      .order('cree_le');
    return Object.fromEntries(
      [1, 2, 3].map((n) => [
        n,
        data!.filter((s) => s['equipe_id'] === equipe(n)).map((s) => s['points'] as number),
      ]),
    );
  };
  // Équipe 3 : 60 mots ; équipe 1 : 22 ; équipe 2 : 5 (le mot rayé ne compte pas).
  expect(await points()).toEqual({ 1: [60], 2: [30], 3: [100] });
  await regie2.close();

  // --- Thème suivant, pendant que Damien est toujours coupé avec deux mots du thème 1.
  await regie.getByRole('button', { name: 'Retour aux thèmes' }).click();
  await regie.getByRole('button', { name: 'Dévoiler', exact: true }).first().click();
  await expect(scene(ecran, 'sujet')).toBeVisible();
  await regie.getByRole('button', { name: `Lancer le chrono (${CHRONO_S} s)` }).click();
  await expect(scene(ecran, 'chrono')).toBeVisible();

  // Damien retrouve le réseau, mais lentement : sa relecture traîne derrière sa file d'envoi.
  await damien.route('**/api/partie/*/etat', async (route) => {
    await attendre(2500);
    await route.continue().catch(() => undefined);
  });
  await damien.context().setOffline(false);
  await attendre(4000);
  const theme2Equipe2 = await motsEnBase(evenement.id, theme2, equipe(2));
  expect(theme2Equipe2, 'des mots du thème 1 sont passés au thème 2').not.toContain(
    'Clou de girofle',
  );
  expect(theme2Equipe2).not.toContain('Poivre rose');
  await damien.unroute('**/api/partie/*/etat');

  // Le thème 2 se joue normalement ensuite.
  await expect(champ(damien)).toBeVisible();
  await taper(damien, ['Passeport']);
  await expect(champ(alice)).toBeVisible();
  await taper(alice, ['Valise']);
  await expect(regie.getByTestId('regie-compte-1')).toHaveText(/^1 mot/);
  await expect(regie.getByTestId('regie-compte-2')).toHaveText(/^1 mot/);

  // --- Classement validé avant la fin par une régie au réseau lent : il compte les mots arrivés
  // entre-temps, comme l'écran les montre.
  await regie.route('**/rest/v1/rpc/etat_ecran*', async (route) => {
    await attendre(4000);
    await route.continue().catch(() => undefined);
  });
  for (const m of ['Boussole', 'Carte']) expect((await ajouter(elise, m)).status()).toBe(200);
  await expect(compteur(ecran, 3)).toHaveText('2 mots');
  await regie.getByRole('button', { name: 'Valider le classement' }).click();
  await regie.getByRole('button', { name: 'Confirmer : Valider le classement' }).click();
  await expect(scene(ecran, 'podium')).toBeVisible();
  await regie.unroute('**/rest/v1/rpc/etat_ecran*');
  await expect(ecran.getByTestId('place-3')).toContainText('1re place');
  expect(await points()).toEqual({ 1: [60, 60], 2: [30, 60], 3: [100, 100] });

  // Après le classement, plus rien n'entre.
  expect((await ajouter(alice.request, 'Sac à dos')).status()).toBe(409);
  await expect(alice.getByTestId('statut-surenchere')).toHaveText('2e place : +60 points !');

  console.log(`\nReprise après une coupure (3 mots en attente → écran) : ${repriseMs} ms`);
  test.info().annotations.push({
    type: 'latence',
    description: `Reprise après une coupure (3 mots en attente → écran) : ${repriseMs} ms`,
  });
  await Promise.all([bruno, elise, anonyme, intrus].map((c) => c.dispose()));

  async function idDe(prenom: string) {
    const { data } = await service
      .from('joueurs')
      .select('id')
      .eq('evenement_id', evenement.id)
      .eq('prenom', prenom)
      .single();
    return data!['id'] as string;
  }
});

// ---------------------------------------------------------------------------
// 3. L'heure du téléphone
// ---------------------------------------------------------------------------

test('un capitaine dont le téléphone n’est pas à l’heure joue le vrai chrono', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const evenement = await creerEvenementJetable({ equipes: 2, langues: ['fr'] });
  evenements.push(evenement.id);
  const { code } = evenement;
  const CHRONO_S = 20;
  const { passages } = await preparerSurenchere(evenement.id, CHRONO_S);
  const { jetons, equipe } = await inscrire(evenement.id, [
    { prenom: 'Avance', equipe: 1, capitaine: true },
    { prenom: 'Retard', equipe: 2, capitaine: true },
  ]);
  // Une montre qui avance de 45 s, une qui retarde de 20 s (réglées à la main, sans réseau).
  const avance = await telephone(browser, baseURL!, code, jetons.get('Avance')!, 45_000);
  const retard = await telephone(browser, baseURL!, code, jetons.get('Retard')!, -20_000);
  expect((await avance.evaluate(() => Date.now())) - Date.now()).toBeGreaterThan(40_000);
  expect((await retard.evaluate(() => Date.now())) - Date.now()).toBeLessThan(-15_000);

  const regie = await connecterRegie(browser);
  const ecran = await ouvrirEcran(browser, regie, code);
  await jusquAuSujet(regie, ecran, code);
  await regie.getByRole('button', { name: `Lancer le chrono (${CHRONO_S} s)` }).click();
  const fin = await finDuChrono(code);

  // En avance : le chrono n'est pas « déjà fini » ; le capitaine tape.
  const champAvance = avance.getByLabel('Un mot sur le sujet');
  await expect(champAvance).toBeVisible();
  const [, mn, sec] = (await avance.getByRole('timer').textContent())!.match(/(\d+):(\d+)/)!;
  const reste = Number(mn) * 60 + Number(sec);
  expect(reste, 'secondes affichées en avance').toBeGreaterThan(CHRONO_S - 8);
  await champAvance.fill('Cannelle');
  await champAvance.press('Enter');
  const champRetard = retard.getByLabel('Un mot sur le sujet');
  await expect(champRetard).toBeVisible();
  await champRetard.fill('Cumin');
  await champRetard.press('Enter');
  await expect(compteur(ecran, 1)).toHaveText('1 mot');
  await expect(compteur(ecran, 2)).toHaveText('1 mot');
  expect(await motsEnBase(evenement.id, passages[0]!, equipe(1))).toEqual(['Cannelle']);

  // En retard : à la vraie fin, la saisie se ferme ; elle ne reste pas ouverte 20 s de trop.
  await attendre(fin + 2000 - Date.now());
  await expect(champRetard).toHaveCount(0, { timeout: 10_000 });
  await expect(retard.getByTestId('statut-surenchere')).toContainText('Temps écoulé');
  await expect(champAvance).toHaveCount(0);
});
