import { expect, test, type Page } from '@playwright/test';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  hacher,
  supprimerEvenements,
} from '../tests/base';

/** Des prénoms de longueurs variées, dont quelques longs : la carte doit les loger sans couper. */
const PRENOMS = [
  'Alexandrine',
  'Bérénice',
  'Zoé',
  'Maximilien',
  'Inès',
  'Jean-Paul',
  'Ludivine',
  'Noé',
  'Gwendoline',
  'Rayan',
  'Anne-Sophie',
  'Tom',
  'Clémentine',
  'Yanis',
  'Marguerite',
  'Lina',
  'Sébastien',
  'Éva',
  'Valentin',
];

let evenement: { id: string; code: string };
/** Effectif de chaque équipe, par numéro : 150 joueurs sur 8 équipes, 19 ou 18. */
const effectifs = new Map<number, number>();

test.beforeAll(async () => {
  evenement = await creerEvenementJetable({ equipes: 8, langues: ['fr'] });
  const service = clientService();
  const { data: equipes } = await service
    .from('equipes')
    .select('id, numero')
    .eq('evenement_id', evenement.id)
    .order('numero');
  const lignes = Array.from({ length: 150 }, (_, i) => {
    const equipe = (equipes as { id: string; numero: number }[])[i % 8]!;
    const rang = Math.floor(i / 8);
    effectifs.set(equipe.numero, (effectifs.get(equipe.numero) ?? 0) + 1);
    return {
      evenement_id: evenement.id,
      equipe_id: equipe.id,
      // Un prénom par rang : chaque équipe a son Alexandrine (capitaine), sa Bérénice, etc.
      prenom: `${PRENOMS[rang % PRENOMS.length]}${rang >= PRENOMS.length ? rang : ''}`,
      langue: 'fr',
      capitaine: rang === 0,
      jeton_hash: hacher(`ecran-equipes-${evenement.id}-${i}`),
    };
  });
  const { error } = await service.from('joueurs').insert(lignes);
  if (error) throw new Error(error.message);

  // La salle passe sur la scène « Équipes », comme d'une touche de régie.
  const anna = await clientAnimateur('anna@teamup.test');
  const { data: etat } = await appeler<{ pilotage: { version: string } }>(anna, 'etat_ecran', {
    p_code: evenement.code,
  });
  const { erreur } = await appeler(anna, 'enregistrer_etape', {
    p_evenement: evenement.id,
    p_version: etat!.pilotage.version,
    p_pilotage: { scene: 'equipes' },
  });
  if (erreur) throw new Error(erreur);
});

test.afterAll(() => supprimerEvenements([evenement.id]));

/** Chaque prénom de chaque carte est dans le cadre et lisible en entier. */
async function tousDansLeCadre(ecran: Page) {
  return ecran.evaluate(() => {
    const largeur = window.innerWidth;
    const hauteur = window.innerHeight;
    return [...document.querySelectorAll<HTMLElement>('[data-testid^="membres-"] li')]
      .filter((li) => {
        const r = li.getBoundingClientRect();
        return (
          r.bottom > hauteur || r.right > largeur || r.top < 0 || li.scrollWidth > li.clientWidth
        );
      })
      .map((li) => li.textContent);
  });
}

test('8 équipes de 19 à l’écran, la Salle règle les prénoms, le capitaine et les retraits', async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const regie = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');

  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  await ecran.goto(`/ecran/${evenement.code}`);
  await expect(ecran.locator('[data-scene="equipes"]')).toBeVisible();
  await expect(ecran.locator('[data-en-direct="true"]')).toBeVisible({ timeout: 15_000 });

  // --- Tous les noms : les 8 cartes, tous leurs prénoms, d'un coup, dans le cadre.
  for (const [numero, n] of effectifs) {
    await expect(ecran.getByTestId(`membres-${numero}`).locator('li')).toHaveCount(n);
  }
  await expect(ecran.locator('.tu-stage-point')).toHaveCount(0);
  expect(await tousDansLeCadre(ecran)).toEqual([]);
  await ecran.screenshot({ path: testInfo.outputPath('tous-8x19.png') });

  // --- La Salle destitue un capitaine et retire un joueur : l'écran suit aussitôt.
  await regie.goto(`/regie/${evenement.code}/salle`);
  // Chaque équipe a son Alexandrine capitaine ; la première carte est l'équipe 1.
  await regie
    .getByRole('button', { name: /^Alexandrine · capitaine/ })
    .first()
    .click();
  await regie.getByRole('button', { name: 'Retirer le capitaine' }).click();
  await expect(ecran.getByTestId('membres-1').locator('.tu-stage-membre__capitaine')).toHaveCount(
    0,
    { timeout: 3000 },
  );

  await regie
    .getByRole('button', { name: /^Bérénice/ })
    .first()
    .click();
  const fiche = regie.getByTestId('fiche-joueur');
  await fiche.getByRole('button', { name: 'Retirer de la soirée' }).click();
  await fiche.getByRole('button', { name: /^Retirer Bérénice \?/ }).click();
  await expect(ecran.getByTestId('membres-1').locator('li')).toHaveCount(effectifs.get(1)! - 1, {
    timeout: 3000,
  });

  // --- Carrousel : des pages en 2 rem, avec leurs repères.
  await regie.getByRole('button', { name: 'Carrousel' }).click();
  await expect(ecran.locator('.tu-stage-point').first()).toBeVisible({ timeout: 3000 });
  expect(await ecran.getByTestId('membres-2').locator('li').count()).toBeLessThanOrEqual(10);
  expect(await tousDansLeCadre(ecran)).toEqual([]);
  await ecran.screenshot({ path: testInfo.outputPath('carrousel-8x19.png') });

  // --- Retour à tous les noms.
  await regie.getByRole('button', { name: 'Tous les noms' }).click();
  await expect(ecran.locator('.tu-stage-point')).toHaveCount(0, { timeout: 3000 });
});
